import { writable, get } from 'svelte/store'
import { jogo } from '../estado.js'
import { tokenConta, aoMudarConta, recarregarPerfil } from '../conta.js'
import { codigoDaBusca, limparSalaDaUrl } from '../salaLink.js'
import { criarReligar, guardarChave, lerChave, apagarChave } from './religar.js'

// Conexão do modo LAN/ONLINE com o servidor (server/lan.js, docs/lan.md,
// docs/online.md) e o estado do lobby, lido pela cena Lan (Phaser) e pelos
// painéis Svelte. O servidor diz nas boas-vindas se é ONLINE (na internet:
// salas só por código) e quais servidores STUN/TURN o WebRTC usa.
//
//   abrirLobby() / fecharLobby()        entra / sai do lobby
//   criarSala() · entrarSala(resumo) · entrarCodigo('K7QX2') · conectarIp('192.168.0.10[:porta]') · sairSala()
//   alternarPronto() · mudarModo('pvp'|'coop') · enviarChat(texto) · expulsar() · mudarNome(nome)
//   iniciarPartida() / encerrarPartida()  (host) a partida começa / volta ao lobby
//   enviarAoParceiro(dados) · aoParceiro(fn)   mensagens para o outro PC da sala
//   enviarQuadro(blob) · aoQuadro(fn)          transmissão reserva (JPEG pelo servidor)
//
// Amigos (lib/amigos.js): logado, a conexão com o servidor de casa fica aberta
// mesmo fora da tela ONLINE (manterLobby) para a presença e os convites
// chegarem. aoServidor(fn) entrega a amigos.js as mensagens dele; enviarLobby
// manda as ações dele (convidar, responderConvite, amigosMudaram).
//
// JOGAR RÁPIDO (server/fila.js, docs/online.md): fila casual de PVP 1x1.
//   entrarFila() · sairFila() · responderPartida(aceitar)   procurar / desistir / aceitar o par
//   consumirCasual()        (cena Lan, host) o id da sala casual a começar agora, uma vez só
//   pedirRevanche(aceitar) · limparRevanche() · salaCasual()   (PvpResultado) revanche com aceite duplo
//   estado: fila (procurando/pareado), filaAviso, casual, revanche, ultimaCasual
//
// XP (server/partidas.js, Fase 1D; CO-OP na 2F): cada partida (PVP ou CO-OP de 2) da sala tem um
// sala.partidaId; no fim, enviarResultado({...}) manda o que este PC viu UMA
// vez por partida (revanche e cena reiniciando não reenviam). O servidor
// responde com `recompensa` (estado.recompensa) e o perfil é relido.
//
// Link de convite (?sala=CODIGO, lib/salaLink.js): salaDoLink() diz se há uma
// sala esperando; ao conectar, o lobby entra nela sozinho.
//
// Conta (lib/conta.js): logado, o "ola" leva o JWT e o servidor responde com o
// resumo do perfil (eu.conta). O token só vai para o servidor que serviu a
// página (casa), nunca para o de outro PC da LAN.
//
// Recuperação de conexão (Fase 2D, lib/lan/religar.js): a conexão caiu NO MEIO
// DE UMA PARTIDA: o servidor guarda a vaga 20 s e daqui o lobby tenta voltar
// sozinho (ola {retomar: chave}, a chave do último bemvindo, no sessionStorage),
// SEM sair da sala: estado.religando = { ate } enquanto tenta. Voltou: o mesmo
// lugar na sala (o host volta a rodada, game/rede.js). O outro caiu: o membro
// dele vem com `caiu` e estado.outroCaiu = { id, nome, ate }. A janela acabou:
// sai da sala com o aviso.
export const PROTOCOLO = 7
export const PORTA_PADRAO = 5180
const CHAVE_NOME = 'dodge-lan-nome'
const MAX_CHAT = 40 // mensagens guardadas
const LISTAR_MS = 1500
const PING_MS = 2000
export const CPU_APOS_MS = 30_000 // procurando há tanto tempo: oferece jogar contra a CPU

function nomeSalvo() {
  try {
    return localStorage.getItem(CHAVE_NOME) || null
  } catch {
    return null
  }
}
const lerNome = () => nomeSalvo() ?? `JOGADOR ${Math.floor(100 + Math.random() * 900)}`

const INICIAL = {
  fase: 'fora', // fora | conectando | navegando | sala
  servidor: null, // ws://.../lan da conexão atual
  enderecos: [], // http://ip:porta onde o servidor de casa serve o jogo (dica para o outro PC)
  eu: { id: null, nome: lerNome(), escolheuNome: Boolean(nomeSalvo()), conta: null }, // conta: { tag, nome, avatar, nivel, xp, titulo } | null
  online: false, // servidor na internet: salas só por código
  ice: [], // servidores STUN/TURN que o servidor mandou (WebRTC)
  papel: null, // 'host' | 'convidado' (na sala)
  sala: null, // { id, nome, modo, emPartida, max, membros: [{ id, nome, papel, pronto, ping }] }
  salas: [], // [{ id, nome, host, jogadores, max, modo, emPartida, endereco? , ip? }]
  chat: [], // [{ nome, texto, meu, sistema }]
  ping: null, // ms até o servidor da sala
  erro: '',
  // JOGAR RÁPIDO
  fila: null, // null | { estado: 'procurando', inicio, convidado } | { estado: 'pareado', id, oponente: { nome, tag?, avatar? }, expira, eu, oponenteOk } (horários do relógio daqui)
  filaAviso: '', // o que aconteceu na fila (o oponente recusou, você não confirmou...)
  casual: null, // id da sala casual que o host começa sozinho (partidaCasual)
  revanche: null, // null | { estado: 'pedida' | 'aceita' | 'recusada' | 'expirada' | 'indisponivel', minha, expira? }
  ultimaCasual: false, // a última sala era casual: quem fica sem ela volta para a tela ONLINE
  // XP: a última resposta do servidor { partidaId, xpGanho, xpTotal?, nivelAntes?, nivelDepois?, itensNovos?, motivo }
  recompensa: null,
  // 2D: a MINHA conexão caiu no meio da partida e está tentando voltar: { ate } (Date.now)
  religando: null,
  // 2D: o OUTRO caiu no meio da partida e o servidor espera por ele: { id, nome, ate }
  outroCaiu: null,
}
export const lan = writable({ ...INICIAL })

let ws = null
let casa = null // ws://<quem serviu a página>/lan
let timerListar = null
let timerPing = null
let pingEnviado = new Map()
let numPing = 0
let numJogadoresAntes = null
let aoListar = null // conectarIp esperando a primeira lista
let manter = false // logado: não fecha a conexão ao sair da tela ONLINE
let telaAberta = false // a tela ONLINE (cena Lan) está aberta: só então lista as salas
const relatadas = new Set() // partidaIds cujo resultado já foi mandado
let relatoPendente = null // o resultado que não saiu porque a conexão estava caída (vai na volta)
let salaPendente = typeof location === 'undefined' ? '' : codigoDaBusca(location.search) // do link ?sala=
const ouvintesServidor = new Set()
const ouvintesParceiro = new Set()
const ouvintesQuadro = new Set()

const mudar = (parcial) => lan.update((s) => ({ ...s, ...parcial }))
const estado = () => get(lan)
export const souHost = () => estado().fase === 'sala' && estado().papel === 'host'
export const souConvidado = () => estado().fase === 'sala' && estado().papel === 'convidado'
export const emPartida = () => estado().fase === 'sala' && Boolean(estado().sala?.emPartida)
export const souOnline = () => estado().online
export const salaDoLink = () => salaPendente

// mensagens do servidor que são do amigos.js (t: 'presenca', 'convite'...); '_fechou' = a conexão caiu
export function aoServidor(fn) {
  ouvintesServidor.add(fn)
  return () => ouvintesServidor.delete(fn)
}
export const enviarLobby = (msg) => enviar(msg)
// partida ONLINE rolando (sem pausa, sem revanche: game/online.js)
export const partidaOnline = () => estado().online && emPartida()
export const parceiro = () => estado().sala?.membros.find((m) => m.id !== estado().eu.id) ?? null

function enderecoCasa() {
  const protocolo = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocolo}//${location.host}/lan`
}

function enviar(msg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function avisoChat(texto) {
  lan.update((s) => ({ ...s, chat: [...s.chat, { nome: '', texto, sistema: true }].slice(-MAX_CHAT) }))
}

// ---------- conexão ----------

// textos que o jogador vê quando a conexão ou a conta falham (cada um diz o que fazer)
export const MSG_SEM_SERVIDOR = 'não deu para falar com o servidor: ele pode estar ligando (leva até 1 minuto) ou a sua internet caiu. Tentando de novo…'
// antes da primeira conexão ainda não se sabe se o servidor é o online: a página
// servida de um endereço público (não localhost nem rede local) já diz
export const siteNaInternet = () => {
  const host = String(globalThis.location?.host ?? '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '')
  return Boolean(host) && !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$)/i.test(host) && !/\.local$/i.test(host)
}
export const MSG_LOTADO = 'o servidor está lotado agora: tente de novo daqui a pouco'
export const MSG_CONTA_INVALIDA = 'não deu para confirmar a sua conta: você está jogando como convidado (sem XP). Saia e entre de novo com o Google; se continuar, o serviço de contas pode estar fora do ar'

// Abre (ou troca) a conexão; resolve com true quando o servidor dá as boas-vindas
// retomar: a chave da vaga guardada (2D): a sala continua na tela enquanto tenta
function conectar(url, { retomar = null } = {}) {
  fecharConexao()
  if (!retomar) mudar({ fase: 'conectando', servidor: url, salas: [] })
  return new Promise((resolve) => {
    let socket
    try {
      socket = new WebSocket(url)
    } catch {
      mudar({ fase: 'navegando', erro: `endereço inválido: ${url}` })
      return resolve(false)
    }
    socket.binaryType = 'blob'
    ws = socket
    let aberto = false
    const tempo = setTimeout(() => {
      if (aberto || ws !== socket) return
      socket.close()
    }, 4000)
    socket.onmessage = (e) => {
      if (ws !== socket) return
      if (typeof e.data !== 'string') return ouvintesQuadro.forEach((fn) => fn(e.data))
      let m
      try {
        m = JSON.parse(e.data)
      } catch {
        return
      }
      if (m.t === 'bemvindo') {
        aberto = true
        clearTimeout(tempo)
        guardarChave(m.retomada)
        if (retomar) {
          if (m.retomado) {
            voltou()
            comecarTimers()
            resolve(true)
            return
          }
          // o servidor não guardou a vaga (prazo, sala fechada...): segue como conexão nova
          perdeuSala(`não deu para voltar à partida: ${m.retomadaNegada || 'a vaga não existe mais'}`)
        }
        lan.update((s) => ({
          ...s,
          fase: s.fase === 'conectando' ? 'navegando' : s.fase,
          erro: '',
          eu: comConta({ ...s.eu, id: m.id }, m.conta),
          enderecos: url === casa ? m.enderecos ?? [] : s.enderecos,
          online: Boolean(m.online),
          ice: Array.isArray(m.ice) ? m.ice : [],
        }))
        if (m.contaInvalida) mudar({ erro: MSG_CONTA_INVALIDA })
        comecarTimers()
        entrarNaSalaDoLink()
        resolve(true)
        return
      }
      receber(m)
    }
    socket.onopen = () => {
      if (ws !== socket) return
      const token = url === casa ? tokenConta() : null
      socket.send(JSON.stringify({ t: 'ola', protocolo: PROTOCOLO, nome: estado().eu.nome, ...(token && { token }), ...(retomar && { retomar }) }))
    }
    socket.onclose = (ev) => {
      clearTimeout(tempo)
      if (ws !== socket) return
      ws = null
      pararTimers()
      ouvintesServidor.forEach((fn) => fn({ t: '_fechou' }))
      // tentando voltar para a partida: esta tentativa não deu, a próxima vem do religar
      if (retomar && !aberto) {
        resolve(false)
        return religar.falhou()
      }
      // caiu no meio da partida: tenta voltar sem sair da sala (o servidor guarda a vaga)
      const antes = estado()
      if (aberto && antes.fase === 'sala' && antes.sala?.emPartida && lerChave()) {
        resolve(false)
        return comecarReligar(url)
      }
      if (estado().fila) mudar({ fila: null, filaAviso: 'a conexão caiu e você saiu da fila: quando reconectar, é só procurar de novo' })
      const s = estado()
      if (!aberto) {
        const semCasa = ev?.code === 1013 ? MSG_LOTADO : s.online || siteNaInternet() ? MSG_SEM_SERVIDOR : 'servidor LAN não encontrado: rode "npm run lan" neste PC'
        mudar({ fase: 'navegando', sala: null, papel: null, salas: [], erro: url === casa ? semCasa : `não deu para conectar em ${url.replace(/^wss?:\/\//, '').replace(/\/lan$/, '')}: confira o endereço e se o jogo está aberto lá` })
        resolve(false)
        // tenta de novo o servidor daqui (pode ser que ele ainda vá ser ligado)
        if (s.fase !== 'fora') setTimeout(() => estado().fase === 'navegando' && !ws && conectar(casa), url === casa ? 3000 : 2500)
        return
      }
      if (s.fase === 'fora') return
      const estavaNaSala = s.fase === 'sala'
      sairDaSalaLocal(estavaNaSala ? 'a conexão com a sala caiu' : '')
      // o aviso da sala fica (filaAviso) depois que reconectar; o "reconectando" some sozinho
      mudar({ fase: 'navegando', erro: 'a conexão caiu: reconectando…', ...(estavaNaSala && { filaAviso: 'a conexão caiu e você saiu da sala: entre de novo (com o código ou pelo convite do amigo)' }) })
      setTimeout(() => estado().fase === 'navegando' && !ws && conectar(casa), 1500)
    }
  })
}

// ---------- recuperação de conexão (2D) ----------

let urlReligar = null
const religar = criarReligar({
  tentar: () => conectar(urlReligar, { retomar: lerChave() }),
  desistir: () => perdeuSala('a conexão caiu e não voltou a tempo: você saiu da partida'),
})

function comecarReligar(url) {
  urlReligar = url
  religar.comecar()
  mudar({ religando: { ate: religar.ate() } })
}

// o servidor devolveu a vaga: o mesmo lugar na sala (a sala nova chega logo depois)
function voltou() {
  religar.conseguiu()
  mudar({ religando: null, erro: '' })
  ouvintesServidor.forEach((fn) => fn({ t: '_retomado' }))
  if (relatoPendente) {
    const r = relatoPendente
    relatoPendente = null
    enviar({ t: 'resultado', ...r })
  }
}

// não deu para voltar: sai da sala aqui (a conexão nova, se houver, segue no lobby)
function perdeuSala(motivo) {
  religar.parar()
  relatoPendente = null
  const s = estado()
  const naSala = s.fase === 'sala'
  if (naSala) sairDaSalaLocal(motivo)
  mudar({ religando: null, outroCaiu: null, erro: motivo, ...(naSala && { filaAviso: motivo }) })
  // sem conexão nenhuma (a janela acabou): conecta de novo como sempre
  if (!ws && estado().fase !== 'fora') conectar(casa)
}

function fecharConexao() {
  pararTimers()
  if (!ws) return
  const velho = ws
  ws = null
  velho.onclose = null
  velho.close()
  ouvintesServidor.forEach((fn) => fn({ t: '_fechou' }))
}

// aba do jogo em segundo plano (Fase 2F): o servidor avisa a sala se passar de uns segundos
// (o convidado vê "o host está com o jogo em segundo plano"; o host ganha o aviso de volta, conta/avisos.js)
let visivelEnviado = null
function anunciarVisibilidade() {
  if (typeof document === 'undefined') return
  const valor = document.visibilityState !== 'hidden'
  if (valor === visivelEnviado) return
  visivelEnviado = valor
  enviar({ t: 'visivel', valor })
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', anunciarVisibilidade)
// conexão nova: o servidor não sabe de nada; só precisa saber se já abriu escondida
const visibilidadeInicial = () => {
  visivelEnviado = true
  anunciarVisibilidade()
}

function comecarTimers() {
  pararTimers()
  visibilidadeInicial()
  const listar = () => telaAberta && estado().fase === 'navegando' && enviar({ t: 'listar' })
  listar()
  timerListar = setInterval(listar, LISTAR_MS)
  timerPing = setInterval(() => {
    const n = ++numPing
    pingEnviado.set(n, performance.now())
    enviar({ t: 'ping', n })
  }, PING_MS)
}

function pararTimers() {
  clearInterval(timerListar)
  clearInterval(timerPing)
  timerListar = timerPing = null
  pingEnviado.clear()
}

// ---------- mensagens do servidor ----------

// com conta, o nome no lobby é o do perfil
const comConta = (eu, c) => ({ ...eu, conta: c ?? null, ...(c?.nome && { nome: c.nome }) })

// entrou / saiu / mudou o perfil com o lobby aberto: avisa o servidor daqui
aoMudarConta((token) => {
  if (estado().servidor === casa) enviar({ t: 'conta', token })
})

function receber(m) {
  switch (m.t) {
    case 'conta':
      lan.update((s) => ({ ...s, eu: comConta(s.eu, m.conta), ...(m.contaInvalida && { erro: MSG_CONTA_INVALIDA }) }))
      break
    case 'salas': {
      // as do servidor desta conexão (sem endereço) e as que ele achou na rede
      const daqui = (m.salas ?? []).map((s) => ({ ...s, endereco: null }))
      const rede = (m.rede ?? []).filter((r) => !daqui.some((s) => s.id === r.id))
      mudar({ salas: [...daqui, ...rede] })
      aoListar?.(daqui)
      aoListar = null
      break
    }
    case 'sala': {
      const s = estado()
      let saiuNoMeio = ''
      const eu = m.sala.membros.find((x) => x.id === s.eu.id)
      if (!eu) return
      const antes = s.sala
      const papel = eu.papel
      // chegou / saiu gente
      if (antes) {
        for (const x of m.sala.membros) if (!antes.membros.some((a) => a.id === x.id)) avisoChat(`${x.nome} entrou na sala`)
        for (const a of antes.membros) if (!m.sala.membros.some((x) => x.id === a.id)) avisoChat(`${a.nome} saiu da sala`)
        saiuNoMeio = antes.emPartida ? antes.membros.find((a) => a.id !== s.eu.id && !m.sala.membros.some((x) => x.id === a.id))?.nome ?? '' : ''
      } else avisoChat(papel === 'host' ? 'sala criada: esperando alguém entrar' : `você entrou na sala de ${m.sala.membros.find((x) => x.papel === 'host')?.nome ?? '?'}`)
      // 2D: o outro caiu e o servidor está esperando por ele (caiu = ms que faltam)
      const caido = m.sala.membros.find((x) => x.id !== s.eu.id && x.caiu != null)
      const outroCaiu = caido ? { id: caido.id, nome: caido.nome, ate: Date.now() + Number(caido.caiu) } : null
      mudar({ fase: 'sala', sala: m.sala, papel, outroCaiu, erro: saiuNoMeio ? `${saiuNoMeio} saiu no meio da partida: a sala continua aberta, é só chamar outro` : '', ultimaCasual: Boolean(m.sala.casual) })
      break
    }
    case 'fechada':
      sairDaSalaLocal(m.motivo)
      mudar({ erro: m.motivo, ...(m.casual && { ultimaCasual: true }) })
      voltarParaCasa()
      break
    case 'erro':
      mudar({ erro: m.msg })
      break
    case 'chat': {
      const meu = m.de === estado().eu.id
      lan.update((s) => ({ ...s, chat: [...s.chat, { nome: m.nome, texto: m.texto, meu }].slice(-MAX_CHAT) }))
      break
    }
    case 'pong': {
      const t0 = pingEnviado.get(m.n)
      pingEnviado.delete(m.n)
      if (t0 === undefined) return
      const ms = Math.round(performance.now() - t0)
      mudar({ ping: ms })
      if (estado().fase === 'sala' || estado().fila) enviar({ t: 'meuPing', ms }) // na fila o ping ajuda a escolher o host
      break
    }
    case 'de':
      ouvintesParceiro.forEach((fn) => fn(m.dados, m.de))
      break
    // ---------- JOGAR RÁPIDO ----------
    case 'fila':
      if (m.estado === 'procurando') mudar({ fila: { estado: 'procurando', inicio: Date.now() - (Number(m.esperaMs) || 0), convidado: Boolean(m.convidado) } })
      else mudar({ fila: null, ...(m.motivo && { filaAviso: m.motivo }) })
      break
    case 'pareado':
      mudar({ fila: { estado: 'pareado', id: m.id, oponente: m.oponente ?? { nome: '?' }, expira: Date.now() + (Number(m.restanteMs) || 0), eu: false, oponenteOk: false }, filaAviso: '', erro: '' })
      break
    case 'pareadoEstado': {
      const f = estado().fila
      if (f?.id === m.id) mudar({ fila: { ...f, eu: Boolean(m.eu), oponenteOk: Boolean(m.oponente) } })
      break
    }
    case 'pareadoFim': {
      const f = estado().fila
      if (f?.estado !== 'pareado' || f.id !== m.id) break // de um par velho
      // voltou: o "procurando" chega logo depois
      mudar({ fila: m.voltou ? { estado: 'procurando', inicio: Date.now(), convidado: !estado().eu.conta } : null, filaAviso: m.motivo ?? '' })
      break
    }
    case 'filaNegada':
      mudar({ ...(m.estado === 'fora' && { fila: null }), erro: m.msg })
      break
    case 'partidaCasual':
      mudar({ casual: m.salaId, fila: null, filaAviso: '' })
      break
    case 'recompensa': {
      const r = {
        partidaId: String(m.partidaId ?? ''),
        xpGanho: Math.max(0, Number(m.xpGanho) || 0),
        xpTotal: Number.isFinite(m.xpTotal) ? m.xpTotal : null,
        nivelAntes: Number.isFinite(m.nivelAntes) ? m.nivelAntes : null,
        nivelDepois: Number.isFinite(m.nivelDepois) ? m.nivelDepois : null,
        itensNovos: Array.isArray(m.itensNovos) ? m.itensNovos.filter((i) => typeof i === 'string') : [],
        motivo: typeof m.motivo === 'string' ? m.motivo : '',
      }
      mudar({ recompensa: r })
      // o nível, o XP, o inventário e as estatísticas mudaram no banco
      if (r.xpTotal != null) recarregarPerfil()
      break
    }
    case 'revanche': {
      const minha = m.de === estado().eu.id
      mudar({ revanche: { estado: m.estado, minha, ...(m.estado === 'pedida' && { expira: Date.now() + (Number(m.restanteMs) || 0) }) } })
      break
    }
    default:
      ouvintesServidor.forEach((fn) => fn(m))
  }
}

// abriu o jogo por um link ?sala=CODIGO: entra na sala assim que o lobby deixar
function entrarNaSalaDoLink() {
  if (!salaPendente || estado().fase !== 'navegando' || ws?.readyState !== WebSocket.OPEN) return
  const codigo = salaPendente
  salaPendente = ''
  limparSalaDaUrl()
  enviar({ t: 'entrar', codigo })
}

function sairDaSalaLocal(motivo) {
  const s = estado()
  if (s.fase !== 'sala') return
  if (motivo) avisoChat(motivo)
  restaurarJogadores()
  mudar({ fase: 'navegando', sala: null, papel: null, casual: null, revanche: null, outroCaiu: null })
}

// se a conexão era com o servidor de outro PC, volta para o daqui
function voltarParaCasa() {
  if (estado().servidor !== casa) conectar(casa)
}

// ---------- jogadores (o host joga sempre com 2) ----------

function usarDoisJogadores() {
  const s = get(jogo)
  if (numJogadoresAntes === null) numJogadoresAntes = s.numJogadores
  if (s.numJogadores !== 2) jogo.update((x) => ({ ...x, numJogadores: 2 }))
}

function restaurarJogadores() {
  if (numJogadoresAntes === null) return
  const antes = numJogadoresAntes
  numJogadoresAntes = null
  jogo.update((x) => ({ ...x, numJogadores: antes }))
}

// ---------- API ----------

export function abrirLobby() {
  telaAberta = true
  if (estado().fase !== 'fora') {
    // a conexão já estava aberta (logado): pede as salas agora, sem esperar o timer
    if (estado().fase === 'navegando') enviar({ t: 'listar' })
    return entrarNaSalaDoLink()
  }
  casa = enderecoCasa()
  mudar({ ...INICIAL, eu: { ...estado().eu, id: null } })
  conectar(casa)
}

export function fecharLobby() {
  telaAberta = false
  if (salaPendente) {
    // saiu da tela ONLINE sem entrar: o link não vale mais (o menu não volta para cá)
    salaPendente = ''
    limparSalaDaUrl()
  }
  if (estado().fase === 'fora') return
  if (estado().religando) {
    religar.parar()
    mudar({ religando: null })
  }
  sairFila()
  enviar({ t: 'sair' })
  // logado: a conexão com o servidor de casa continua (presença e convites)
  if (manter && estado().servidor === casa && ws) {
    restaurarJogadores()
    return mudar({ fase: 'navegando', sala: null, papel: null, salas: [], chat: [], ping: null, erro: '', filaAviso: '', casual: null, revanche: null })
  }
  fecharConexao()
  restaurarJogadores()
  mudar({ ...INICIAL, eu: { ...estado().eu, id: null } })
  if (manter) manterLobby(true) // estava no servidor de outro PC: volta para o de casa
}

// amigos.js: logado, mantém (e abre, se preciso) a conexão com o servidor de casa
export function manterLobby(valor) {
  manter = Boolean(valor)
  if (manter) {
    if (estado().fase === 'fora') {
      casa = enderecoCasa()
      mudar({ ...INICIAL, eu: { ...estado().eu, id: null } })
      conectar(casa)
    }
  } else if (!telaAberta && estado().fase === 'navegando') {
    fecharConexao()
    mudar({ ...INICIAL, eu: { ...estado().eu, id: null } })
  }
}

export function criarSala() {
  enviar({ t: 'criar' })
}

export async function entrarSala(resumo) {
  if (!resumo) return
  if (resumo.endereco && resumo.endereco !== estado().servidor) {
    if (!(await conectar(resumo.endereco))) return
  }
  enviar({ t: 'entrar', sala: resumo.id })
}

// a sala de um amigo pelo código que ele passou (ex.: K7QX2)
export function entrarCodigo(texto) {
  const codigo = String(texto ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (!codigo) return
  if (estado().fase !== 'navegando') return mudar({ erro: 'espere conectar no servidor' })
  enviar({ t: 'entrar', codigo })
}

// '192.168.0.10' ou '192.168.0.10:5180': conecta no servidor de lá e, se ele
// tiver uma sala só, entra nela
export async function conectarIp(texto) {
  const alvo = String(texto ?? '').trim().replace(/^(https?|wss?):\/\//, '').replace(/\/.*$/, '')
  if (!alvo) return
  const [host, porta] = alvo.split(':')
  const url = `ws://${host}:${porta || location.port || PORTA_PADRAO}/lan`
  const lista = new Promise((resolve) => {
    aoListar = resolve
    setTimeout(() => resolve([]), 2500)
  })
  if (!(await conectar(url))) return
  const daquele = (await lista).filter((s) => !s.emPartida && s.jogadores < s.max)
  if (daquele.length === 1) entrarSala(daquele[0])
  else if (!daquele.length) mudar({ erro: 'nenhuma sala aberta nesse PC (alguém precisa criar uma)' })
}

export function sairSala() {
  if (estado().fase !== 'sala') return
  if (estado().religando) {
    religar.parar()
    mudar({ religando: null })
    apagarChave()
  }
  enviar({ t: 'sair' })
  sairDaSalaLocal('')
  voltarParaCasa()
}

export function alternarPronto() {
  const eu = estado().sala?.membros.find((m) => m.id === estado().eu.id)
  if (eu) enviar({ t: 'pronto', valor: !eu.pronto })
}

export const mudarModo = (modo) => enviar({ t: 'modo', modo })
export const enviarChat = (texto) => String(texto ?? '').trim() && enviar({ t: 'chat', texto })
export const expulsar = () => parceiro() && enviar({ t: 'expulsar', id: parceiro().id })

export function mudarNome(nome) {
  const limpo = String(nome ?? '').trim().slice(0, 16)
  if (!limpo) return
  try {
    localStorage.setItem(CHAVE_NOME, limpo)
  } catch {}
  lan.update((s) => ({ ...s, eu: { ...s.eu, nome: limpo, escolheuNome: true } }))
  enviar({ t: 'nome', nome: limpo })
}

// O host começa: avisa o servidor e já marca aqui (a cena vai trocar agora)
export function iniciarPartida() {
  if (!souHost()) return
  usarDoisJogadores()
  lan.update((s) => ({ ...s, sala: { ...s.sala, emPartida: true } }))
  enviar({ t: 'partida', valor: true })
}

export function encerrarPartida() {
  if (!souHost() || !estado().sala.emPartida) return
  lan.update((s) => ({ ...s, sala: { ...s.sala, emPartida: false } }))
  enviar({ t: 'partida', valor: false })
}

// ---------- JOGAR RÁPIDO ----------

// entra na fila (fora de sala); o servidor confirma com o "procurando"
export function entrarFila() {
  const s = estado()
  if (s.fase !== 'navegando' || !ws) return mudar({ erro: 'espere conectar no servidor' })
  if (s.fila) return
  mudar({ fila: { estado: 'procurando', inicio: Date.now(), convidado: !s.eu.conta }, filaAviso: '', erro: '' })
  enviar({ t: 'fila', acao: 'entrar' })
  if (s.ping != null) enviar({ t: 'meuPing', ms: s.ping })
}

export function sairFila() {
  if (!estado().fila) return
  enviar({ t: 'fila', acao: 'sair' })
  mudar({ fila: null })
}

// aceitar (ou recusar) o oponente que a fila achou
export function responderPartida(aceitar) {
  const f = estado().fila
  if (f?.estado !== 'pareado') return
  enviar({ t: 'confirmar', id: f.id, aceitar: Boolean(aceitar) })
  mudar({ fila: aceitar ? { ...f, eu: true } : null })
}

// (host) a sala casual acabou de nascer: começa uma vez só
export function consumirCasual() {
  const id = estado().casual
  if (id) mudar({ casual: null })
  return id
}

export const salaCasual = () => estado().fase === 'sala' && Boolean(estado().sala?.casual)
export const pedirRevanche = (aceitar) => salaCasual() && enviar({ t: 'revanche', aceitar: Boolean(aceitar) })
export const limparRevanche = () => mudar({ revanche: null })

// ---------- XP ----------

// fim da partida: o que este PC viu; true se mandou agora (uma vez por partidaId).
//   PVP:    { partidaId, vencedorLado: 0 | 1 | null, rodadas, duracao, personagem }
//   CO-OP:  { partidaId, vitoria: true | false (o time venceu o chefe), rodadas, duracao, personagem }
export function enviarResultado({ partidaId, vencedorLado, vitoria, rodadas, duracao, personagem }) {
  if (typeof partidaId !== 'string' || !partidaId || relatadas.has(partidaId)) return false
  const resultado = typeof vitoria === 'boolean' ? { vitoria } : { vencedorLado: vencedorLado === 0 || vencedorLado === 1 ? vencedorLado : null }
  const relato = { partidaId, ...resultado, rodadas, duracao, personagem }
  if (ws?.readyState !== WebSocket.OPEN) {
    // caiu e está voltando (2D): o relato sai na volta, uma vez só
    if (!estado().religando) return false
    relatadas.add(partidaId)
    relatoPendente = relato
    return true
  }
  relatadas.add(partidaId)
  if (relatadas.size > 200) relatadas.delete(relatadas.values().next().value)
  enviar({ t: 'resultado', ...relato })
  return true
}
export const jaRelatou = (partidaId) => relatadas.has(partidaId)

// ---------- canal com o outro PC (pelo servidor) ----------

export const enviarAoParceiro = (dados) => enviar({ t: 'para', dados })
export function aoParceiro(fn) {
  ouvintesParceiro.add(fn)
  return () => ouvintesParceiro.delete(fn)
}

// quadro da transmissão reserva; false se a conexão está entupida (pule o quadro)
export function enviarQuadro(blob) {
  if (ws?.readyState !== WebSocket.OPEN || ws.bufferedAmount > 1_000_000) return false
  ws.send(blob)
  return true
}
export function aoQuadro(fn) {
  ouvintesQuadro.add(fn)
  return () => ouvintesQuadro.delete(fn)
}
