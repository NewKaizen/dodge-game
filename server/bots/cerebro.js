// O CÉREBRO de um bot do JOGAR RÁPIDO (docs/online.md "Bots do Jogar Rápido"): um cliente do lobby
// (server/lan.js) que não tem navegador. Ele recebe EXATAMENTE as mensagens que um navegador
// receberia (o "ws" dele é de mentira: server/bots/index.js) e responde com as mesmas mensagens que o
// navegador de um CONVIDADO mandaria: confirmar a partida achada, o ping, os sinais do WebRTC (que
// nunca abrem: o canal vai pelo servidor, como o de quem está atrás de um NAT difícil) e o canal da
// partida (src/lib/lan/canal.js, o MESMO código do navegador: numeração, sessão, recibos).
//
// Na partida o bot faz o papel do PC do convidado (docs/rede-pvp.md):
//   PvpEscolha  o cursor anda e confirma um personagem ("main" do bot, às vezes outro)
//   PvpVoto     o cursor anda e vota (ou não vota) numa arena
//   PvpArena    a cada rodada: espera o `inicio` do host, pensa, mexe o cursor e manda a `jogada`;
//               na esquiva roda a caixa dele de verdade (server/bots/esquiva.js) e manda `coracao`,
//               `dano`, `graze` e `fimEsquiva`; no duelo (server/bots/duelo.js) e no CTRL+C CTRL+V faz o
//               mesmo que o Duelo/Copia do convidado; no fim manda o `resultadoPronto`
//   PvpResultado manda o `resultado` ao servidor (como o navegador), às vezes topa a revanche, e sai
//
// AUTORIDADE: o bot é dono do PRÓPRIO coração (como qualquer convidado): só ele decide o dano que leva.
// Ele guarda a PRÓPRIA vida (vidaPropria) e não aceita do host um HP menor que ela (um host que forja o
// estado não mata o bot); o relato do resultado é o que o bot viu. Se o host diz uma coisa e o bot vê
// outra, os relatos divergem e o servidor marca a partida como contestada (server/partidas.js).
//
//   const c = criarCerebro({ cliente, conta, faixa, q, favoritos, enviar, agendar, agora, sorte, log, aoSair, aoResultado })
//   c.receber(msg)        uma mensagem do servidor (o que iria para o navegador)
//   c.parar()             cancela tudo (o servidor desligando)
import crypto from 'node:crypto'
import { criarCanal } from '../../src/lib/lan/canal.js'
import { aplicarDano, curar, registrarGrazes, hpInicial } from '../../src/game/pvp/regras.js'
import { EVENTO, COPIA } from '../../src/game/pvp/bonus.js'
import { BotCopia } from '../../src/game/pvp/bonus/botCopia.js'
import { DUELO } from '../../src/game/pvp/bonus/dueloRegras.js'
import { fatorAceleracao, nivelAceleracao, ACELERACAO } from '../../src/game/constants.js'
import { criarCaixa, PASSO_MS } from './esquiva.js'
import { criarDuelo } from './duelo.js'
import { numerosDe } from './habilidade.js'
import { escolherCarta, tempoDePensar, caminhoDoCursor, escolherPersonagem, escolherArena, IDS_PERSONAGENS, OPCOES_ARENA } from './decisoes.js'
const TEMPO_ESCOLHA_MS = 15000 // PvpArena TEMPO.escolha
const ENVIO_MS = 33 // ~30 posições por segundo (ArenaRede, redeDuelo)
const CURSOR_MS = 300 // PvpEscolha/PvpVoto: o cursor vai de novo de tempos em tempos
const QUERO_MS = 5000 // lib/lan/transmissao.js: o convidado pede a ligação direta de novo
const FIM_KO_MS = 900 // PvpArena.nocaute: as caixas param logo depois do K.O.
const ESPERA_LONGA_MS = 90_000
const CONTAGEM_COPIA_MS = 520 // Copia.js CONTAGEM_MS
const REVANCHES_SEGUIDAS = 2

const LETRAS_ICE = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/'
const entre = (sorte, a, b) => a + (b - a) * sorte()
const um = (sorte, chance) => sorte() < chance

// o relógio de escolha da rodada (PvpArena.atualizarAceleracao)
export function tempoDaEscolha(rodada) {
  const f = fatorAceleracao(rodada)
  return Math.max(Math.min(TEMPO_ESCOLHA_MS, ACELERACAO.escolhaMinMs), Math.round(TEMPO_ESCOLHA_MS / f / 500) * 500)
}

// Uma resposta de WebRTC que um navegador mandaria: bem formada (o setRemoteDescription aceita), com
// candidatos só de rede local (nomes .local do mDNS), que nunca conectam. O canal vai pelo servidor.
export function respostaWebRtc(oferta, sorte = Math.random) {
  const mid = /a=mid:(\S+)/.exec(String(oferta ?? ''))?.[1] ?? '0'
  const texto = (n, letras = LETRAS_ICE) => Array.from({ length: n }, () => letras[Math.floor(sorte() * letras.length)]).join('')
  const ufrag = texto(4)
  const pwd = texto(24)
  const digitos = (n) => String(1 + Math.floor(sorte() * 9)) + texto(n - 1, '0123456789')
  const impressao = Array.from({ length: 32 }, () => Math.floor(sorte() * 256).toString(16).toUpperCase().padStart(2, '0')).join(':')
  const sdp = [
    'v=0',
    `o=- ${digitos(19)} 2 IN IP4 127.0.0.1`,
    's=-',
    't=0 0',
    `a=group:BUNDLE ${mid}`,
    'a=extmap-allow-mixed',
    'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    `a=ice-ufrag:${ufrag}`,
    `a=ice-pwd:${pwd}`,
    'a=ice-options:trickle',
    `a=fingerprint:sha-256 ${impressao}`,
    'a=setup:active',
    `a=mid:${mid}`,
    'a=sctp-port:5000',
    'a=max-message-size:262144',
    '',
  ].join('\r\n')
  const candidatos = Array.from({ length: 1 + Math.floor(sorte() * 2) }, (_, k) => ({
    candidate: `candidate:${digitos(9 + k)} 1 udp 2113937151 ${crypto.randomUUID()}.local ${49152 + Math.floor(sorte() * 16000)} typ host generation 0 ufrag ${ufrag} network-cost 999`,
    sdpMid: mid,
    sdpMLineIndex: 0,
    usernameFragment: ufrag,
  }))
  return { sdp, candidatos }
}

export function criarCerebro({ cliente, faixa = 'medio', q = null, favoritos = [], pingBase = 70, enviar, agendar, agora = Date.now, sorte = Math.random, log = () => {}, aoSair = () => {}, aoResultado = () => {} }) {
  const numeros = numerosDe(q ?? 0.48)
  const origemRelogio = agora() - Math.round(entre(sorte, 120_000, 5_400_000)) // a "página" abriu há um tempo
  const relogio = () => agora() - origemRelogio
  const timers = new Set()
  let parado = false
  let vez = 0 // muda a cada cena (as tarefas da cena velha param)
  let sala = null // a última `sala` que chegou
  let canal = null
  let ping = pingBase
  let ultimoPersonagem = null
  let revanches = 0
  let pareadoId = null
  let partida = null // a partida em andamento (a arena)
  let fim = null // a tela de resultado

  // ---------- tempo ----------
  function depois(ms, fn) {
    const cancelar = agendar(() => {
      timers.delete(cancelar)
      if (!parado) fn()
    }, Math.max(0, Math.round(ms)))
    timers.add(cancelar)
    return cancelar
  }
  const dormir = (ms) => new Promise((r) => depois(ms, r))
  const vivo = (v) => !parado && v === vez

  // ---------- servidor ----------
  const mandar = (m) => !parado && enviar(m)
  const paraOHost = (dados) => mandar({ t: 'para', dados })

  // ---------- o canal da partida (o mesmo do navegador) ----------
  const caixa = new Map() // `${tipo}|${chave}` -> [dados]
  const esperas = new Map() // `${tipo}|${chave}` -> [resolver]
  const chaveDe = (tipo, chave) => `${tipo}|${chave ?? ''}`
  function guardar(tipo, chave, dados) {
    const k = chaveDe(tipo, chave)
    const fila = esperas.get(k)
    if (fila?.length) {
      const r = fila.shift()
      if (!fila.length) esperas.delete(k)
      return r(dados ?? {})
    }
    if (!caixa.has(k)) caixa.set(k, [])
    caixa.get(k).push(dados ?? {})
  }
  // a mensagem (tipo, chave) do host; null se não chegar em ms (ou a cena mudar)
  function esperar(tipo, chave, ms = ESPERA_LONGA_MS) {
    const k = chaveDe(tipo, chave)
    const lista = caixa.get(k)
    if (lista?.length) {
      const d = lista.shift()
      if (!lista.length) caixa.delete(k)
      return Promise.resolve(d)
    }
    return new Promise((resolver) => {
      let feito = false
      const pronto = (d) => {
        if (feito) return
        feito = true
        cancelar()
        const fila = esperas.get(k)
        const i = fila?.indexOf(pronto) ?? -1
        if (i >= 0) fila.splice(i, 1)
        resolver(d)
      }
      const cancelar = depois(ms, () => pronto(null))
      if (!esperas.has(k)) esperas.set(k, [])
      esperas.get(k).push(pronto)
    })
  }
  function soltarEsperas() {
    for (const fila of esperas.values()) for (const r of [...fila]) r(null)
    esperas.clear()
    caixa.clear()
  }

  const NA_CAIXA = ['inicio', 'resolucao', 'fimRodada', 'fimEsquiva', 'dueloPronto', 'dueloFim', 'copiaPronto', 'copiaFinal', 'copiaResultado', 'apuracao', 'personagem', 'voto', 'jogada']
  const IGNORADAS = ['cursor', 'cenaOk', 'voltarLobby', 'debug', 'resultadoPronto', 'resgate', 'regra', 'expVoto', 'expVotos', 'expEscolha', 'confirmou']
  function novoCanal(hostId) {
    canal = criarCanal({
      enviarBruto: (msg) => paraOHost(msg),
      enviarReserva: (msg) => paraOHost(msg),
      meuId: () => cliente.id,
      agora,
      // (os timers do canal são os do bot: param junto com ele, sem reenvio pendurado depois de sair)
      agendar: (fn, ms) => {
        depois(ms, fn)
        return null
      },
    })
    canal.hostId = hostId
    for (const tipo of NA_CAIXA) canal.ao(tipo, (d, chave) => guardar(tipo, chave, d))
    for (const tipo of IGNORADAS) canal.ao(tipo, () => {})
    canal.ao('cena', (d) => aoCena(d ?? {}))
    canal.ao('coracao', (d) => partida?.aoCoracao(d))
    canal.ao('dano', (d) => partida?.doHumano('dano', d))
    canal.ao('graze', (d) => partida?.doHumano('graze', d))
    canal.ao('cura', (d) => partida?.doHumano('cura', d))
    canal.ao('dueloCoracao', (d) => partida?.duelo?.humano(d))
    canal.ao('dueloAtaque', (d, chave) => chave === partida?.rodadaLuta && partida?.duelo?.replicar(d))
    canal.ao('dueloRebate', (d, chave) => chave === partida?.rodadaLuta && partida?.duelo?.rebatido(d))
    canal.ao('dueloDano', () => {})
    canal.ao('copiaApertos', (d) => partida?.copiaDele?.(d))
    canal.ao('escolhaFim', (d) => fim?.escolhaDele(d?.escolha))
  }
  const enviarCanal = (tipo, chave, dados) => canal?.enviar(tipo, chave, dados)
  const rapida = (tipo, dados) => canal?.enviarRapido(tipo, dados)

  // ---------- ping e WebRTC ----------
  function mandarPing() {
    const novo = Math.max(18, Math.round(ping + (sorte() - 0.5) * 14))
    mandar({ t: 'meuPing', ms: novo })
  }
  function cicloPing() {
    if (!sala && !pareadoId) return
    mandarPing()
    depois(entre(sorte, 1800, 2600), cicloPing)
  }
  function pedirDireto() {
    if (!sala) return
    paraOHost({ tipo: 'quero' })
    depois(QUERO_MS, pedirDireto)
  }
  function responderOferta(sdp) {
    const { sdp: resposta, candidatos } = respostaWebRtc(sdp, sorte)
    depois(entre(sorte, 30, 140), () => {
      paraOHost({ tipo: 'resposta', sdp: resposta })
      candidatos.forEach((c, k) => depois(entre(sorte, 5, 60) * (k + 1), () => paraOHost({ tipo: 'ice', candidato: c })))
    })
  }

  // ---------- lobby ----------
  function receber(m) {
    if (parado || !m || typeof m.t !== 'string') return
    switch (m.t) {
      case 'pareado': {
        pareadoId = m.id
        // o ping também vale na fila (escolhe o host da casual)
        mandarPing()
        const id = m.id
        // gente lê a tela e aperta A (às vezes demora um pouco mais)
        const atraso = entre(sorte, 1100, 3400) + (um(sorte, 0.15) ? entre(sorte, 800, 2600) : 0)
        depois(atraso, () => {
          if (pareadoId !== id) return
          mandar({ t: 'confirmar', id, aceitar: true })
        })
        break
      }
      case 'pareadoFim':
        // o par não fechou (alguém recusou ou não confirmou): o bot não volta para a fila, sai
        if (m.id === pareadoId) pareadoId = null
        sair('pareado desfeito')
        break
      case 'fila':
        if (m.estado === 'fora' && !sala) sair('fora da fila')
        break
      case 'partidaCasual':
        pareadoId = null
        break
      case 'sala': {
        const antes = sala
        sala = m.sala
        const host = sala?.membros?.find((x) => x.papel === 'host')
        if (!antes && host && host.id !== cliente.id) {
          novoCanal(host.id)
          depois(entre(sorte, 200, 900), pedirDireto)
          depois(entre(sorte, 400, 1200), cicloPing)
        }
        if (sala && (sala.membros?.length ?? 0) < 2) sairDaSala('sozinho na sala')
        break
      }
      case 'fechada':
        sala = null
        sair('sala fechada')
        break
      case 'de':
        if (!sala || m.de !== canal?.hostId || !m.dados || typeof m.dados !== 'object') return
        if (m.dados.tipo === 'rede') {
          if (m.dados.de === m.de) canal.entregar(m.dados)
        } else if (m.dados.tipo === 'oferta') responderOferta(m.dados.sdp)
        break
      case 'revanche':
        fim?.revanche(m)
        break
      default:
    }
  }

  function sairDaSala(motivo) {
    if (!sala) return sair(motivo)
    mandar({ t: 'sair' })
    sala = null
    sair(motivo)
  }

  function sair(motivo) {
    if (parado) return
    parar()
    aoSair(motivo)
  }

  function parar() {
    if (parado) return
    parado = true
    vez++
    for (const c of [...timers]) c()
    timers.clear()
    soltarEsperas()
    partida?.parar()
    partida = null
    fim = null
  }

  // ---------- cenas (o host troca, o convidado segue) ----------
  function aoCena({ chave, dados, retomada, n }) {
    if (!chave) return
    if (retomada) canal.reiniciar()
    vez++
    const v = vez
    const anterior = partida
    soltarEsperas()
    partida?.parar()
    partida = null
    fim = null
    // (o navegador responde ao abrir a cena)
    if (n != null) depois(entre(sorte, 8, 45), () => enviarCanal('cenaOk', null, { n, chave }))
    if (chave === 'PvpEscolha') escolhaDePersonagem(v)
    else if (chave === 'PvpVoto') votoDaArena(v)
    else if (chave === 'PvpArena') {
      partida = criarPartida(v, dados ?? {})
      partida.rodar().catch((e) => log(`[bots] arena: ${e.stack ?? e.message}`))
    } else if (chave === 'PvpResultado') telaDeResultado(v, dados ?? {}, anterior)
    else if (chave === 'Lan') depois(entre(sorte, 1500, 5000), () => vivo(v) && sairDaSala('voltou ao lobby'))
  }

  // ---------- escolha do personagem ----------
  async function escolhaDePersonagem(v) {
    const ids = IDS_PERSONAGENS
    const meu = escolherPersonagem(ids, favoritos, sorte)
    let indice = ultimoPersonagem && ids.includes(ultimoPersonagem) ? ids.indexOf(ultimoPersonagem) : Math.min(1, ids.length - 1)
    const alvo = ids.indexOf(meu)
    let confirmado = false
    const repetir = async () => {
      while (vivo(v) && !confirmado) {
        rapida('cursor', { tela: 'escolha', indice })
        await dormir(CURSOR_MS)
      }
    }
    await dormir(entre(sorte, 300, 700))
    if (!vivo(v)) return
    repetir()
    // olha uns dois personagens antes
    const olhar = Array.from({ length: Math.floor(sorte() * 3) }, () => Math.floor(sorte() * ids.length))
    for (const destino of [...olhar, alvo]) {
      while (vivo(v) && indice !== destino) {
        await dormir(entre(sorte, 160, 420))
        indice += destino > indice ? 1 : -1
        rapida('cursor', { tela: 'escolha', indice })
      }
      await dormir(entre(sorte, 350, 1500))
    }
    if (!vivo(v)) return
    confirmado = true
    ultimoPersonagem = meu
    enviarCanal('personagem', null, { id: meu })
  }

  // ---------- voto da arena ----------
  async function votoDaArena(v) {
    const opcoes = OPCOES_ARENA
    let indice = 1
    const voto = escolherArena(opcoes, sorte)
    let votou = false
    const repetir = async () => {
      while (vivo(v) && !votou) {
        rapida('cursor', { tela: 'voto', indice })
        await dormir(CURSOR_MS)
      }
    }
    await dormir(entre(sorte, 300, 700))
    if (!vivo(v)) return
    repetir()
    const destinos = [...Array.from({ length: 1 + Math.floor(sorte() * 3) }, () => Math.floor(sorte() * opcoes.length)), voto ? opcoes.indexOf(voto) : indice]
    for (const destino of destinos) {
      while (vivo(v) && indice !== destino) {
        await dormir(entre(sorte, 150, 380))
        indice += destino > indice ? 1 : -1
        rapida('cursor', { tela: 'voto', indice })
      }
      await dormir(entre(sorte, 300, 1300))
    }
    if (!vivo(v) || !voto) return // sem voto: o relógio do host apura sem ele
    votou = true
    enviarCanal('voto', null, { arena: voto })
  }

  // ---------- a arena ----------
  function criarPartida(v, dados) {
    const eu = 1
    const ele = 0
    const A = {
      semente: String(dados.semente ?? 'rede'),
      ids: [dados.p1, dados.p2],
      estado: null,
      vidaPropria: hpInicial(dados.p2) ?? 100,
      ko: [false, false],
      acertosRodada: [0, 0],
      rodadaLuta: null, // a esquiva/duelo desta rodada começou aqui: o que o humano manda vale
      pendentes: [],
      fimLuta: null, // quando a luta para (K.O.)
      primeiraPosicao: null, // a 1ª posição do coração do humano nesta rodada: a caixa dele abriu
      duelo: null,
      copiaDele: null,
      suspeitas: 0,
      comecou: agora(),
      parado: false,
      vencedor: undefined,
    }
    const ativa = () => vivo(v) && !A.parado

    function conferirVida(estado, onde) {
      const jog = estado?.jogadores?.[eu]
      if (!jog) return
      // a vida do bot só desce pelo dano que ELE mesmo decidiu: um HP menor vindo do host é forjado
      if (jog.hp < A.vidaPropria) {
        A.suspeitas++
        log(`[bots] o host mandou um HP do bot menor que o dele (${onde}: ${jog.hp} < ${A.vidaPropria})`)
        jog.hp = A.vidaPropria
      } else A.vidaPropria = jog.hp
    }
    function trocarEstado(estado, onde) {
      if (!estado) return
      conferirVida(estado, onde)
      A.estado = estado
    }

    // o que chega do coração do humano (dano/graze/cura): as regras daqui, na rodada certa
    A.doHumano = (tipo, d) => {
      if (!d || d.lado !== ele || !A.estado) return
      if (d.r === A.rodadaLuta && d.r === A.estado.rodada) return aplicarDoHumano(tipo, d)
      if (d.r >= (A.estado?.rodada ?? 0)) A.pendentes.push({ tipo, d })
    }
    function aplicarDoHumano(tipo, d) {
      const e = A.estado
      if (tipo === 'cura') return void curar(e, ele, Number(d.cura) || 0)
      if (tipo === 'graze') return void registrarGrazes(e, ele, Number(d.n) || 1)
      if (A.ko[ele]) return
      A.acertosRodada[ele]++
      aplicarDano(e, ele, Number(d.dano) || 0)
      if (e.jogadores[ele].hp <= 0) {
        A.ko[ele] = true
        A.fimLuta ??= agora() + FIM_KO_MS
        A.duelo?.humanoCaiu()
      }
    }
    function comecarLuta() {
      A.rodadaLuta = A.estado.rodada
      const agoraValem = A.pendentes.filter((p) => p.d.r === A.estado.rodada)
      A.pendentes = A.pendentes.filter((p) => p.d.r > A.estado.rodada)
      for (const p of agoraValem) aplicarDoHumano(p.tipo, p.d)
    }
    A.aoCoracao = (d) => {
      if (!d || !A.estado || d.r !== A.estado.rodada || A.primeiraPosicao) return
      A.primeiraPosicao = agora()
      A.avisarCaixaAbriu?.()
    }
    // o bot levou um golpe (decidido aqui): aplica e manda
    function leveiDano(dano) {
      if (A.ko[eu] || !A.estado) return
      A.acertosRodada[eu]++
      aplicarDano(A.estado, eu, dano)
      A.vidaPropria = A.estado.jogadores[eu].hp
      enviarCanal('dano', null, { lado: eu, dano, r: A.estado.rodada })
      if (A.vidaPropria <= 0) {
        A.ko[eu] = true
        A.fimLuta ??= agora() + FIM_KO_MS
      }
    }

    // ----- a escolha da carta -----
    async function escolha(acelerou) {
      const rodada = A.estado.rodada
      await dormir(entre(sorte, 750, 1250) + (acelerou ? 1500 : 0))
      if (!ativa()) return
      const tempo = tempoDaEscolha(rodada)
      const mao = A.estado.jogadores[eu].baralho.mao
      const id = escolherCarta(A.estado, eu, numeros.cartas, sorte)
      const total = mao.length
      const inicio = Math.floor(total / 2)
      const alvo = id ? mao.findIndex((c) => c.id === id) : -1
      const pensar = tempoDePensar(numeros.pensarMs, sorte, tempo - 900)
      const passos = caminhoDoCursor({ inicio, alvo, total, passar: id == null }, sorte)
      rapida('cursor', { tela: 'arena', indice: inicio, passar: false, r: rodada })
      const t0 = agora()
      for (const [i, p] of passos.entries()) {
        const quando = (pensar * (i + 1)) / (passos.length + 1) + entre(sorte, -120, 120)
        await dormir(Math.max(60, quando - (agora() - t0)))
        if (!ativa()) return
        rapida('cursor', { tela: 'arena', indice: p.indice, passar: p.passar, r: rodada })
      }
      await dormir(Math.max(80, pensar - (agora() - t0)))
      if (!ativa()) return
      enviarCanal('jogada', rodada, { jogada: id ?? null })
    }

    // ----- a esquiva (cada um na sua caixa) -----
    async function esquiva(res) {
      const rodada = A.estado.rodada
      const r = res.resultado ?? {}
      const caixas = r.caixas ?? [null, null]
      const ev = res.bonus ? EVENTO[res.bonus] : null
      const comEfeito = Boolean(ev && ev.cartas === 'normal')
      A.acertosRodada = [0, 0]
      A.ko = [false, false]
      A.fimLuta = null
      if (!caixas.some(Boolean) && !comEfeito) return true // nenhuma caixa abre (os dois passaram, só suporte)
      // a caixa do humano abre ao mesmo tempo que a espelho do bot (as duas na mesma tela): a 1ª posição
      // do coração dele marca o começo; sem caixa para ele, a conta das animações (revelação, arremesso)
      const caixaDele = Boolean(caixas[ele]) || comEfeito
      const estimado = 2900 + (res.bonus && !res.adiado ? 3600 : 0) + (r.jogadas?.some((j) => j?.super) ? 1500 : 0)
      if (!A.primeiraPosicao) {
        await new Promise((pronto) => {
          A.avisarCaixaAbriu = pronto
          depois(caixaDele ? estimado + 4000 : estimado, pronto)
        })
        A.avisarCaixaAbriu = null
      }
      if (!ativa()) return false
      comecarLuta()
      const minha = caixas[eu]
      const k = res.bonus === 'trocado' ? 0 : 1 // CORAÇÃO TROCADO: o coração do bot desvia na outra caixa
      if (!minha && !comEfeito) {
        enviarCanal('fimEsquiva', rodada, { acertos: A.acertosRodada[eu], ko: Boolean(A.ko[eu]) })
        return true
      }
      const sim = criarCaixa({
        carta: minha?.carta ?? null,
        dano: minha?.dano ?? 0,
        ritmo: minha?.ritmo ?? {},
        inverterMs: minha?.inverterMs ?? 0,
        semente: `${A.semente}:${rodada}:${eu}`,
        k,
        aceleracao: fatorAceleracao(rodada),
        esquiva: numeros.esquiva,
        sorte,
      })
      let t = 0
      const inicioReal = agora()
      let envio = 0
      while (ativa() && !sim.acabou) {
        await dormir(ENVIO_MS)
        if (!ativa()) break
        const alvoT = agora() - inicioReal
        while (t + PASSO_MS <= alvoT && !sim.acabou) {
          const n = sim.passo(PASSO_MS)
          t += PASSO_MS
          for (let g = 0; g < n.grazes; g++) {
            registrarGrazes(A.estado, eu, 1)
            enviarCanal('graze', null, { lado: eu, n: 1, r: rodada })
          }
          for (const dano of n.acertos) {
            leveiDano(dano)
            if (A.ko[eu]) sim.cair()
          }
        }
        if (A.fimLuta != null && agora() >= A.fimLuta) sim.parar()
        if (sim.coracao.ativo && agora() - envio >= ENVIO_MS - 2) {
          envio = agora()
          rapida('coracao', { x: Math.round(sim.coracao.x * 10) / 10, y: Math.round(sim.coracao.y * 10) / 10, k, r: rodada })
        }
      }
      sim.parar()
      if (!ativa()) return false
      enviarCanal('fimEsquiva', rodada, { acertos: A.acertosRodada[eu], ko: Boolean(A.ko[eu]) })
      return true
    }

    // ----- o duelo -----
    async function duelo(res) {
      const rodada = A.estado.rodada
      A.ko = [false, false]
      A.fimLuta = null
      const aceleracao = fatorAceleracao(rodada)
      const d = criarDuelo({ armas: res.resultado?.armas, aceleracao, cfg: numeros.duelo, sorte, eu })
      // o humano abriu a caixa (dueloPronto dele) e o bot também
      const dele = await esperar('dueloPronto', rodada, 12_000)
      if (!ativa()) return false
      await dormir(dele ? entre(sorte, 60, 300) : 0)
      if (!ativa()) return false
      enviarCanal('dueloPronto', rodada, {})
      A.duelo = d
      comecarLuta()
      // apresentação (1,1 s) e 3-2-1 (na contagem já anda)
      const fimApresentacao = agora() + 1100
      const fimContagem = fimApresentacao + 3 * DUELO.contagemMs
      const fimLuta = fimContagem + d.duracao
      let envio = 0
      let ultimo = agora()
      let acabou = null
      const fimDele = esperar('dueloFim', rodada, d.duracao + 15_000).then((x) => x && (acabou ??= x.motivo === 'ko' ? 'ko' : 'tempo'))
      while (ativa() && !acabou) {
        await dormir(ENVIO_MS)
        if (!ativa()) break
        const t = agora()
        const dt = Math.min(60, t - ultimo)
        ultimo = t
        if (t < fimApresentacao) continue
        const lutando = t >= fimContagem
        const s = d.passo(dt, { lutando })
        for (const a of s.ataques) enviarCanal('dueloAtaque', rodada, a)
        for (const rb of s.rebates) enviarCanal('dueloRebate', rodada, rb)
        for (const g of s.golpes) {
          leveiDano(g.dano)
          enviarCanal('dueloDano', rodada, g)
          if (A.ko[eu]) d.cair()
        }
        if (t - envio >= ENVIO_MS - 2 && !A.ko[eu]) {
          envio = t
          const c = d.coracao
          rapida('dueloCoracao', { r: rodada, t: Math.round(relogio()), x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10, vx: Math.round(c.vx), vy: Math.round(c.vy) })
        }
        if (A.fimLuta != null && t >= A.fimLuta) acabou = 'ko'
        else if (t >= fimLuta) acabou = 'tempo'
      }
      if (!ativa()) return false
      enviarCanal('dueloFim', rodada, { motivo: A.ko.some(Boolean) ? 'ko' : acabou })
      A.duelo = null
      // "FIM DO DUELO!" e a caixa fechando; depois o fim do outro (até 6 s)
      await dormir(1200 + 220 + 320)
      await Promise.race([fimDele, dormir(6000)])
      if (!ativa()) return false
      enviarCanal('fimEsquiva', rodada, { acertos: A.acertosRodada[eu], ko: Boolean(A.ko[eu]) })
      return true
    }

    // ----- CTRL+C CTRL+V -----
    async function copia() {
      const rodada = A.estado.rodada
      const dele = await esperar('copiaPronto', rodada, 12_000)
      if (!ativa()) return false
      await dormir(dele ? entre(sorte, 60, 300) : 0)
      enviarCanal('copiaPronto', rodada, {})
      comecarLuta()
      let apertosDele = 0
      A.copiaDele = (d) => {
        if (d?.r === rodada && Number(d.n) > apertosDele) apertosDele = Number(d.n)
      }
      await dormir(1900 + 200 + 3 * CONTAGEM_COPIA_MS)
      if (!ativa()) return false
      const bot = new BotCopia({ rng: sorte, duracaoMs: COPIA.duracaoMs })
      bot.cfg = { ...bot.cfg, ...numeros.copia }
      let n = 0
      let motivo = 'tempo'
      let acabouDele = false
      esperar('copiaFinal', rodada, COPIA.duracaoMs + 8000).then((x) => {
        if (x) {
          acabouDele = true
          if (Number(x.apertos) > apertosDele) apertosDele = Number(x.apertos)
        }
      })
      const t0 = agora()
      let ultimo = t0
      while (ativa() && !acabouDele && agora() - t0 < COPIA.duracaoMs) {
        await dormir(entre(sorte, 20, 40))
        const t = agora()
        const novos = bot.atualizar(t - ultimo)
        ultimo = t
        if (novos > 0) {
          n += novos
          rapida('copiaApertos', { r: rodada, n })
        }
        if (Math.abs(apertosDele - n) >= COPIA.cheio) {
          motivo = 'cheio'
          break
        }
      }
      A.copiaDele = null
      if (!ativa()) return false
      enviarCanal('copiaFinal', rodada, { apertos: n, motivo })
      await esperar('copiaResultado', rodada, 8000)
      if (!ativa()) return false
      enviarCanal('fimEsquiva', rodada, { acertos: A.acertosRodada[eu], ko: Boolean(A.ko[eu]) })
      return true
    }

    // ----- o fim da partida pelo que o BOT viu -----
    function vencedorProprio() {
      const botCaiu = A.vidaPropria <= 0
      const humanoCaiu = (A.estado?.jogadores?.[ele]?.hp ?? 1) <= 0
      if (botCaiu && humanoCaiu) return 'empate'
      if (botCaiu) return 'p1'
      if (humanoCaiu) return 'p2'
      return null
    }

    A.rodar = async () => {
      const retomada = dados.retomada?.estado
      if (retomada) {
        A.vidaPropria = retomada.jogadores?.[eu]?.hp ?? A.vidaPropria
        trocarEstado(structuredClone(retomada), 'retomada')
      }
      let rodada = A.estado?.rodada ?? 0
      while (ativa()) {
        const msg = await esperar('inicio', rodada + 1)
        if (!ativa()) return
        if (!msg) continue
        const nivelAntes = nivelAceleracao(rodada)
        trocarEstado(msg.estado, 'inicio')
        rodada = A.estado.rodada
        A.primeiraPosicao = null
        escolha(nivelAceleracao(rodada) > nivelAntes)
        const res = await esperar('resolucao', rodada)
        if (!ativa() || !res) return
        trocarEstado(res.estado, 'resolucao')
        const r = res.resultado ?? {}
        let ok
        if (r.duelo) ok = await duelo(res)
        else if (r.copia) ok = await copia()
        else ok = await esquiva(res)
        if (!ok || !ativa()) return
        A.rodadaLuta = null
        const fr = await esperar('fimRodada', rodada)
        if (!ativa() || !fr) return
        trocarEstado(fr.estado, 'fimRodada')
        if (fr.vencedor) {
          A.vencedor = vencedorProprio()
          if (A.vencedor !== fr.vencedor) log(`[bots] o fim da partida do host (${fr.vencedor}) não bate com o do bot (${A.vencedor ?? 'ninguém caiu'}): o relato do bot diverge`)
          // o replay do K.O. e o "VENCEU!" (o host espera o convidado)
          await dormir(entre(sorte, 4200, 6500))
          if (!ativa()) return
          enviarCanal('resultadoPronto', rodada, {})
          return
        }
      }
    }
    A.parar = () => {
      A.parado = true
    }
    return A
  }

  // ---------- a tela de resultado ----------
  function telaDeResultado(v, dados, anterior) {
    // o relato (uma vez por partida), pelo que o bot viu na arena
    const partidaId = sala?.partidaId ?? null
    const doHost = [1, 2].includes(dados.vencedor) ? (dados.vencedor === 1 ? 'p1' : 'p2') : 'empate'
    const visto = anterior?.vencedor === undefined ? doHost : (anterior.vencedor ?? 'empate')
    const vencedorLado = visto === 'p1' ? 0 : visto === 'p2' ? 1 : null
    if (partidaId) {
      depois(entre(sorte, 30, 250), () =>
        mandar({ t: 'resultado', partidaId, vencedorLado, rodadas: Number(dados.rodadas) || anterior?.estado?.rodada || 0, duracao: Math.round((agora() - (anterior?.comecou ?? agora())) / 1000), personagem: dados.p2 ?? ultimoPersonagem }),
      )
      aoResultado({ vencedorLado, suspeitas: anterior?.suspeitas ?? 0 })
    }
    const escolhaPropria = (escolha) => {
      if (!vivo(v) || fim.minha) return
      fim.minha = escolha
      enviarCanal('escolhaFim', null, { escolha })
      if (escolha === 'revanche') mandar({ t: 'revanche', aceitar: true })
    }
    const ir = () => vivo(v) && sairDaSala('fim da partida')
    fim = {
      minha: null,
      escolhaDele(escolha) {
        if (!vivo(v) || fim.minha) return
        if (escolha === 'revanche' && revanches < REVANCHES_SEGUIDAS && um(sorte, 0.45)) {
          revanches++
          depois(entre(sorte, 900, 3500), () => escolhaPropria('revanche'))
        } else if (escolha === 'trocar' && revanches < REVANCHES_SEGUIDAS && um(sorte, 0.35)) {
          revanches++
          depois(entre(sorte, 900, 3500), () => escolhaPropria('trocar'))
        } else depois(entre(sorte, 1500, 5000), ir)
      },
      revanche(m) {
        if (!vivo(v)) return
        if (m.estado === 'recusada' || m.estado === 'expirada' || m.estado === 'indisponivel') depois(entre(sorte, 800, 2500), ir)
      },
    }
    // ninguém escolheu nada: depois de olhar o resultado (o XP, as estatísticas), sai (às vezes pede revanche antes)
    depois(entre(sorte, 9000, 22000), () => {
      if (!vivo(v) || fim.minha) return
      if (revanches < REVANCHES_SEGUIDAS && um(sorte, 0.12)) {
        revanches++
        escolhaPropria('revanche')
        depois(16_000, ir)
      } else ir()
    })
  }

  return {
    receber,
    parar,
    get sala() {
      return sala
    },
    estadoDebug: () => ({ vez, sala: sala?.id ?? null, partida: Boolean(partida), rodada: partida?.estado?.rodada ?? null }),
  }
}
