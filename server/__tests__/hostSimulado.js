// Um HOST de partida PVP casual sem navegador, para os testes dos bots (server/__tests__/bots.test.js).
// Faz o que o navegador do host faz (docs/rede-pvp.md): começa a partida da sala casual, troca as cenas
// (`cena` numerada pelo canal), roda as regras (pvp/regras.js), esconde as cartas do outro (pvp/sigilo.js),
// desvia na caixa dele (o mesmo esquiva.js do bot, do lado 0) e, no fim, manda o `resultado` ao servidor.
// Não é jogo: só o protocolo, para ver o bot jogar uma partida inteira do outro lado.
//
//   const h = criarHostSimulado({ mandar, agendar, agora, sorte, bonus: { 3: 'duelo', 6: 'copia' }, forjar })
//   h.receber(msg)     (o que o lobby manda para este cliente)
//   h.fim              Promise do fim: { vencedorLado, rodadas }
//   forjar: 'hp'       um host trapaceiro: manda o HP do bot zerado no fimRodada da 2ª rodada
import { criarCanal } from '../../src/lib/lan/canal.js'
import { criarPartida, iniciarRodada, resolverRodada, podeJogar, aplicarDano, registrarGrazes, fimDaRodada, registrarPerfeitoCombo, energiaPerfeito } from '../../src/game/pvp/regras.js'
import { resolverDuelo, resolverCopia, apurarCopia, caboDaCopia, copiarEnergia } from '../../src/game/pvp/bonus.js'
import { criarFichas, embaralharEscondido, mascararEstado, mascararResultado, mascararJogada } from '../../src/game/pvp/sigilo.js'
import { criarRng } from '../../src/game/pvp/baralho.js'
import { fatorAceleracao } from '../../src/game/constants.js'
import { criarCaixa, PASSO_MS } from '../bots/esquiva.js'
import { numerosDe } from '../bots/habilidade.js'
import { escolherCarta } from '../bots/decisoes.js'

export function criarHostSimulado({ mandar, agendar, agora, sorte = Math.random, bonus = {}, forjar = null, q = 0.5, eu = null }) {
  const numeros = numerosDe(q)
  let sala = null
  let canal = null
  let n = 0
  let terminar
  const fim = new Promise((r) => (terminar = r))
  const correio = new Map()
  const esperas = new Map()
  const guardar = (tipo, chave, d) => {
    const k = `${tipo}|${chave ?? ''}`
    const e = esperas.get(k)
    if (e?.length) return e.shift()(d ?? {})
    if (!correio.has(k)) correio.set(k, [])
    correio.get(k).push(d ?? {})
  }
  const esperar = (tipo, chave, ms = 60_000) => {
    const k = `${tipo}|${chave ?? ''}`
    if (correio.get(k)?.length) return Promise.resolve(correio.get(k).shift())
    return new Promise((r) => {
      let feito = false
      const pronto = (d) => !feito && ((feito = true), r(d))
      if (!esperas.has(k)) esperas.set(k, [])
      esperas.get(k).push(pronto)
      agendar(() => pronto(null), ms)
    })
  }
  const dormir = (ms) => new Promise((r) => agendar(r, ms))
  const vistos = [] // tudo o que o canal entregou (para os testes)
  const danoDoOutro = []

  function ligarCanal(outro) {
    canal = criarCanal({ enviarBruto: (msg) => mandar({ t: 'para', dados: msg }), meuId: () => eu(), agora, agendar: (fn, ms) => (agendar(fn, ms), null) })
    for (const tipo of ['personagem', 'voto', 'jogada', 'fimEsquiva', 'resultadoPronto', 'dueloPronto', 'dueloFim', 'copiaPronto', 'copiaFinal', 'cenaOk'])
      canal.ao(tipo, (d, chave) => {
        vistos.push(tipo)
        guardar(tipo, chave, d)
      })
    for (const tipo of ['cursor', 'coracao', 'dueloCoracao', 'dueloAtaque', 'dueloDano', 'dueloRebate', 'copiaApertos', 'graze', 'escolhaFim']) canal.ao(tipo, () => vistos.push(tipo))
    canal.ao('dano', (d) => {
      vistos.push('dano')
      danoDoOutro.push(d)
    })
    canal.outro = outro
  }
  const irParaCena = (chave, dados = {}) => canal.enviar('cena', null, { chave, dados, n: ++n })

  async function partida() {
    await dormir(400)
    mandar({ t: 'partida', valor: true })
    irParaCena('PvpEscolha')
    const p1 = 'kris'
    const per = await esperar('personagem', null)
    const p2 = per?.id ?? 'susie'
    irParaCena('PvpVoto', { p1, p2 })
    const voto = await esperar('voto', null, 12_000)
    const arena = voto?.arena && voto.arena !== 'aleatoria' ? voto.arena : 'castelo'
    canal.enviar('apuracao', null, { votos: [arena, voto?.arena ?? null], arena, contagem: {}, empatadas: [arena], sorteios: [] })
    const semente = `rede:${agora()}`
    irParaCena('PvpArena', { p1, p2, arena, semente })
    const estado = criarPartida({ p1, p2, semente })
    embaralharEscondido(estado, sorte)
    const fichas = criarFichas(sorte)
    const ver = () => mascararEstado(estado, 1, fichas)
    const rng = criarRng(`${semente}:bonus`)
    for (;;) {
      iniciarRodada(estado)
      const rodada = estado.rodada
      canal.enviar('inicio', rodada, { estado: ver(), bonusPendente: bonus[rodada] ? true : null })
      await dormir(1500)
      const minha = escolherCarta(estado, 0, numeros.cartas, sorte)
      canal.enviar('jogada', rodada, { jogada: mascararJogada(minha, fichas) })
      const dele = await esperar('jogada', rodada)
      if (!dele) return terminar({ erro: 'sem jogada' })
      let jogadas = [minha, dele.jogada ?? null]
      const tipo = bonus[rodada]
      let r
      if (tipo === 'duelo') r = resolverDuelo(estado, jogadas[0], jogadas[1], rng)
      else if (tipo === 'copia') r = resolverCopia(estado, jogadas[0], jogadas[1])
      else {
        jogadas = jogadas.map((id, j) => (id == null || podeJogar(estado, j, id).ok ? id : null))
        r = resolverRodada(estado, jogadas[0], jogadas[1])
      }
      canal.enviar('resolucao', rodada, { jogadas, bonus: tipo ?? null, adiado: false, resultado: mascararResultado(r, 1, fichas), estado: ver() })
      danoDoOutro.length = 0
      const acertos = [0, 0]
      if (tipo === 'duelo') {
        await dormir(2600)
        canal.enviar('dueloPronto', rodada, {})
        await esperar('dueloPronto', rodada, 10_000)
        await dormir(2660 + 9000)
        canal.enviar('dueloFim', rodada, { motivo: 'tempo' })
        await esperar('dueloFim', rodada, 6000)
        for (const d of danoDoOutro) if (d.lado === 1) aplicarDano(estado, 1, d.dano)
        canal.enviar('fimEsquiva', rodada, { acertos: 0, ko: false })
        await esperar('fimEsquiva', rodada)
      } else if (tipo === 'copia') {
        await dormir(2600)
        canal.enviar('copiaPronto', rodada, {})
        await esperar('copiaPronto', rodada, 10_000)
        await dormir(2100 + 3 * 520 + 5000)
        const fimDele = await esperar('copiaFinal', rodada, 4000)
        const apertos = [20, Number(fimDele?.apertos) || 0]
        const cabo = caboDaCopia(apertos)
        const a = apurarCopia(cabo)
        const energias = estado.jogadores.map((j) => j.energia)
        const troca = a.vencedor == null ? { perdeu: 0, ganhou: 0 } : copiarEnergia(estado, 1 - a.vencedor, a.vencedor, a.quantia)
        canal.enviar('copiaResultado', rodada, { apertos, cabo, vencedor: a.vencedor, quantia: a.quantia, ...troca, energias, motivo: 'tempo' })
        canal.enviar('fimEsquiva', rodada, { acertos: 0, ko: false })
        await esperar('fimEsquiva', rodada)
      } else if (r.caixas.some(Boolean)) {
        await dormir(2900)
        const cx = r.caixas[0]
        if (cx) {
          const sim = criarCaixa({ carta: cx.carta, dano: cx.dano, ritmo: cx.ritmo, inverterMs: cx.inverterMs, semente: `${semente}:${rodada}:0`, k: 0, aceleracao: fatorAceleracao(rodada), esquiva: numeros.esquiva, sorte })
          while (!sim.acabou) {
            await dormir(33)
            for (let k = 0; k < 2 && !sim.acabou; k++) {
              const novos = sim.passo(PASSO_MS)
              for (const dano of novos.acertos) {
                acertos[0]++
                aplicarDano(estado, 0, dano)
                canal.enviar('dano', null, { lado: 0, dano, r: rodada })
              }
              for (let g = 0; g < novos.grazes; g++) {
                registrarGrazes(estado, 0, 1)
                canal.enviar('graze', null, { lado: 0, n: 1, r: rodada })
              }
            }
            canal.enviarRapido('coracao', { x: Math.round(sim.coracao.x * 10) / 10, y: Math.round(sim.coracao.y * 10) / 10, k: 0, r: rodada })
            if (estado.jogadores[0].hp <= 0) break
          }
        }
        canal.enviar('fimEsquiva', rodada, { acertos: acertos[0], ko: estado.jogadores[0].hp <= 0 })
        await esperar('fimEsquiva', rodada)
        for (const d of danoDoOutro) if (d.lado === 1 && d.r === rodada) {
          acertos[1]++
          aplicarDano(estado, 1, d.dano)
        }
        for (const k of [0, 1]) if (r.caixas[k] && !acertos[k] && estado.jogadores[k].hp > 0 && energiaPerfeito(r.caixas[k].carta)) registrarPerfeitoCombo(estado, k, r.caixas[k].carta)
      }
      // o host trapaceiro: diz que o HP do bot acabou
      if (forjar === 'hp' && rodada === 2) estado.jogadores[1].hp = 0
      const vencedor = fimDaRodada(estado)
      canal.enviar('fimRodada', rodada, { estado: ver(), vencedor })
      if (vencedor) {
        await esperar('resultadoPronto', rodada, 20_000)
        const v = vencedor === 'p1' ? 1 : vencedor === 'p2' ? 2 : 0
        irParaCena('PvpResultado', { vencedor: v, p1, p2, arena, rodadas: rodada, duracao: 100, cpu: false, estatisticas: {} })
        const vencedorLado = v === 0 ? null : v - 1
        mandar({ t: 'resultado', partidaId: sala.partidaId, vencedorLado, rodadas: rodada, duracao: 100, personagem: p1 })
        return terminar({ vencedorLado, rodadas: rodada })
      }
      if (rodada > 40) return terminar({ erro: 'longa demais' })
    }
  }

  return {
    fim,
    vistos,
    receber(m) {
      if (m.t === 'sala') sala = m.sala
      if (m.t === 'partidaCasual' && m.host === eu()) {
        const outro = sala?.membros?.find((x) => x.id !== eu())?.id
        ligarCanal(outro)
        partida().catch((e) => terminar({ erro: e.stack }))
      }
      if (m.t === 'de' && m.dados?.tipo === 'rede' && m.dados.de === m.de) canal?.entregar(m.dados)
    },
  }
}
