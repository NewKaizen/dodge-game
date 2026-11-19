// BOTS DO JOGAR RÁPIDO (docs/online.md "Bots do Jogar Rápido"): o servidor completa a fila casual de PVP 1x1
// com jogadores que ele mesmo controla, para o online não ficar vazio. Só o JOGAR RÁPIDO (server/fila.js);
// CO-OP, party e salas de amigos não têm bot.
//
// Para quem joga, um bot é uma conta de gente: perfil, nível, XP e cosméticos de verdade (0019), o mesmo
// caminho de pareamento (pareado -> confirmar -> sala casual) e o mesmo protocolo da partida (o bot é o
// CONVIDADO: server/bots/cerebro.js). O XP é o de sempre (conceder_recompensa, com os mesmos limites do
// dia), para os dois lados. A marca "é bot" só existe aqui e em public.bots (sem policy: o navegador não lê).
//
//   const bots = criarBots({ registro, ligado, agora, sorte, log, metricas, conectar })
//   bots.carregar()             lê a lista do banco (e semeia até BOTS_ALVO, se faltar); o lobby chama ao ligar
//   bots.limiarMs()             quanto um jogador procura sem achar gente antes do bot (8 a 20 s)
//   bots.oferecer(humano)       um bot para este jogador (o cliente do lobby) ou null (desligado, nenhum livre)
//   bots.atividade()            a "vida fora da fila" (o timer chama de ATIVIDADE_MS em ATIVIDADE_MS)
//   bots.resumo()               { ligado, total, livres, emJogo } (log e testes)
//   bots.fechar()
//
// conectar(entrada, { pingBase, aoSair, aoResultado }) -> cliente: o lobby cria o cliente do bot e o cérebro
// (server/lan.js conectarBot).
//
// LIGAR E DESLIGAR: DODGE_BOTS=0 desliga (a fila volta a ser só de gente, com a oferta da CPU do cliente aos
// 30 s). Sem banco com a 0019 (registro sem listarBots) também fica desligado. As métricas (bots_*) e o log
// ([bots] ...) contam as partidas com bot à parte, só para o dono do servidor.
import crypto from 'node:crypto'
import { estimarJogador, ajustarRecentes, FOLGA_ALVO } from './habilidade.js'
import { gerarApelidos } from './nomes.js'
import { gerarPerfilDeBot } from './perfil.js'

export const BOTS_ALVO = 60 // o tamanho do grupo de bots (semeado quando falta)
export const BOTS_MINIMO = 40 // abaixo disso, semeia de novo até o alvo
export const LIMIAR_MS = [8000, 20000] // procurando sem gente há tanto tempo (sorteado): bot
export const DESCANSO_MS = [25_000, 120_000] // depois de uma partida o bot "some" um tempo
export const ATIVIDADE_MS = 20 * 60_000 // de quanto em quanto a vida fora da fila anda
export const ATIVIDADE_MAX_DIAS = 3 // a vida fora da fila não recupera mais que isso de uma vez (servidor parado)
const DIA_MS = 86_400_000

export const botsLigados = (env = process.env) => !['0', 'false', 'nao', 'não', 'off'].includes(String(env.DODGE_BOTS ?? '1').toLowerCase())

const entre = (sorte, a, b) => a + (b - a) * sorte()
// Poisson com média m (m pequeno)
function poisson(m, sorte) {
  const l = Math.exp(-m)
  let k = 0
  let p = 1
  do {
    k++
    p *= sorte()
  } while (p > l && k < 60)
  return k - 1
}

// o spec do banco (criar_bot) a partir do perfil gerado
export const specDoBanco = (p) => ({
  nome: p.nome,
  faixa: p.faixa,
  q: p.q,
  xp: p.xp,
  partidas: p.partidas,
  vitorias: p.vitorias,
  favoritos: p.favoritos,
  favorito: p.favorito,
  dias_de_conta: p.diasDeConta,
  atividade: p.atividade,
  avatar_tipo: p.avatar.tipo,
  avatar_id: p.avatar.id,
  itens: p.itens,
  equipar: p.equipar,
})

export function criarBots({ registro = null, ligado = true, agora = Date.now, sorte = () => crypto.randomInt(0, 2 ** 32) / 2 ** 32, log = () => {}, metricas = null, conectar = null, alvo = BOTS_ALVO, minimo = BOTS_MINIMO } = {}) {
  const pool = new Map() // id da conta -> { id, perfil, bot, ocupado, livreEm }
  const ultimoDe = new Map() // chave do jogador -> id do último bot que ele enfrentou
  const recentesDe = new Map() // chave do jogador -> [venceu, ...] contra bots (só na memória)
  let carregado = false
  let timer = null
  const disponivel = () => ligado && Boolean(registro?.listarBots) && typeof conectar === 'function'
  const chaveDe = (c) => c.usuario ?? `cliente:${c.id}`
  const contar = (nome, n) => metricas?.contar(nome, n)

  function guardar(linhas) {
    for (const { bot, perfil } of linhas) {
      if (!bot?.user_id || !perfil?.id) continue
      const atual = pool.get(bot.user_id)
      pool.set(bot.user_id, { id: bot.user_id, perfil, bot, ocupado: atual?.ocupado ?? false, livreEm: atual?.livreEm ?? 0 })
    }
  }

  async function semear(n) {
    if (!registro?.criarBot || n <= 0) return 0
    const nomes = gerarApelidos(n, sorte, [...pool.values()].map((e) => e.perfil?.nome_exibicao ?? ''))
    let feitos = 0
    for (const nome of nomes) {
      try {
        await registro.criarBot(specDoBanco(gerarPerfilDeBot({ nome, rng: sorte })))
        feitos++
      } catch (e) {
        log(`[bots] criar um bot: ${e.message}`)
      }
    }
    return feitos
  }

  async function carregar() {
    if (!disponivel()) return false
    try {
      guardar(await registro.listarBots())
      if (pool.size < minimo) {
        const feitos = await semear(alvo - pool.size)
        if (feitos) guardar(await registro.listarBots())
        log(`[bots] grupo semeado: +${feitos} (agora ${pool.size})`)
      }
      carregado = true
      // a vida fora da fila desde a última vez (o servidor pode ter ficado parado)
      await atividade()
      log(`[bots] ${pool.size} bots prontos para o JOGAR RÁPIDO`)
      return true
    } catch (e) {
      log(`[bots] não deu para carregar os bots: ${e.message}`)
      return false
    }
  }

  // o perfil de agora (depois de uma partida o XP e o nível mudaram)
  async function atualizarPerfil(e) {
    if (!registro?.perfilDeBot) return
    try {
      const p = await registro.perfilDeBot(e.id)
      if (p?.id) e.perfil = p
    } catch (erro) {
      log(`[bots] perfil de um bot: ${erro.message}`)
    }
  }

  // o bot para este jogador: perto do q estimado dele (um pouco abaixo), nunca o mesmo da última vez
  function escolher(humano) {
    const t = agora()
    const chave = chaveDe(humano)
    const q = estimarJogador({ nivel: humano.perfil?.nivel ?? 1, recentes: recentesDe.get(chave) ?? [] })
    const alvoQ = q - FOLGA_ALVO
    let livres = [...pool.values()].filter((e) => !e.ocupado && e.livreEm <= t && e.id !== humano.usuario && !humano.bloqueios?.has?.(e.id))
    const semRepetir = livres.filter((e) => e.id !== ultimoDe.get(chave))
    if (semRepetir.length) livres = semRepetir
    if (!livres.length) return null
    livres.sort((a, b) => Math.abs(a.bot.q - alvoQ) - Math.abs(b.bot.q - alvoQ))
    // um dos mais perto (não sempre o mesmo)
    const perto = livres.slice(0, Math.min(3, livres.length))
    return { entrada: perto[sorte() < 0.6 ? 0 : Math.floor(sorte() * perto.length)], q }
  }

  function oferecer(humano) {
    if (!disponivel() || !carregado) return null
    const achado = escolher(humano)
    if (!achado) return null
    const { entrada: e, q } = achado
    const chave = chaveDe(humano)
    // o ping dele: um valor de gente; se o do jogador é conhecido, o bot fica um pouco atrás (o host da
    // casual é quem tem o menor ping: o jogador, como precisa ser; server/lan.js escolherHost)
    let pingBase = Math.round(entre(sorte, 38, 135))
    if (Number.isFinite(humano.ping)) pingBase = Math.max(pingBase, Math.round(humano.ping + 34 + entre(sorte, 0, 30)))
    e.ocupado = true
    ultimoDe.set(chave, e.id)
    let cliente = null
    try {
      cliente = conectar(e, {
        pingBase,
        aoSair: (motivo) => {
          e.ocupado = false
          e.livreEm = agora() + entre(sorte, ...DESCANSO_MS)
          atualizarPerfil(e)
          log(`[bots] ${e.perfil?.nome_exibicao ?? e.id} saiu (${motivo})`)
        },
        aoResultado: ({ vencedorLado, suspeitas = 0 }) => {
          // o jogador é sempre o host da casual com bot (lado 0)
          if (vencedorLado === 0 || vencedorLado === 1) recentesDe.set(chave, ajustarRecentes(recentesDe.get(chave), vencedorLado === 0))
          contar('bots_partidas')
          contar(vencedorLado === 0 ? 'bots_vitorias_jogador' : vencedorLado === 1 ? 'bots_derrotas_jogador' : 'bots_empates')
          if (suspeitas) contar('bots_suspeitas')
          log(`[bots] partida contra ${e.perfil?.nome_exibicao ?? e.id} (${e.bot.faixa}): ${vencedorLado === 0 ? 'o jogador venceu' : vencedorLado === 1 ? 'o bot venceu' : 'empate'}${suspeitas ? `, ${suspeitas} estado(s) suspeito(s) do host` : ''}`)
        },
      })
    } catch (erro) {
      log(`[bots] conectar: ${erro.message}`)
    }
    if (!cliente) {
      e.ocupado = false
      return null
    }
    contar('bots_pares')
    log(`[bots] ${humano.nome} (q≈${q.toFixed(2)}) x ${e.perfil?.nome_exibicao ?? e.id} (${e.bot.faixa}, q=${Number(e.bot.q).toFixed(2)})`)
    return cliente
  }

  // A vida fora da fila: cada bot livre "jogou" algumas partidas por aí desde a última vez (a média dele
  // por dia, sorteada), com XP de partida de verdade (40 + 20 da vitória). Assim o grupo não fica parado.
  async function atividade() {
    if (!disponivel() || !registro?.atividadeDeBot) return 0
    const t = agora()
    let n = 0
    for (const e of pool.values()) {
      if (e.ocupado) continue
      const desde = Date.parse(e.bot.atividade_em ?? '') || t
      const dias = Math.min(ATIVIDADE_MAX_DIAS, Math.max(0, (t - desde) / DIA_MS))
      const partidas = Math.min(20, poisson((Number(e.bot.atividade) || 0) * dias, sorte))
      if (!partidas) continue
      const taxa = 0.3 + 0.35 * (Number(e.bot.q) || 0.5)
      let vitorias = 0
      for (let i = 0; i < partidas; i++) if (sorte() < taxa) vitorias++
      try {
        await registro.atividadeDeBot(e.id, { partidas, vitorias, xp: partidas * 40 + vitorias * 20 })
        e.bot.atividade_em = new Date(t).toISOString()
        await atualizarPerfil(e)
        n++
      } catch (erro) {
        log(`[bots] atividade: ${erro.message}`)
      }
    }
    return n
  }

  return {
    carregar,
    limiarMs: () => Math.round(entre(sorte, ...LIMIAR_MS)),
    oferecer,
    atividade,
    ligado: disponivel,
    iniciar() {
      if (!disponivel() || timer) return
      carregar()
      timer = setInterval(() => atividade(), ATIVIDADE_MS)
      timer.unref?.()
    },
    resumo: () => ({ ligado: disponivel(), total: pool.size, livres: [...pool.values()].filter((e) => !e.ocupado).length, emJogo: [...pool.values()].filter((e) => e.ocupado).length }),
    // (testes) o que o jogador tem de recente contra bots
    recentes: (c) => recentesDe.get(chaveDe(c)) ?? [],
    fechar() {
      clearInterval(timer)
      timer = null
    },
  }
}
