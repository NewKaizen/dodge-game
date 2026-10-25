import { writable, get } from 'svelte/store'
import { jogo } from '../estado.js'
import { tokenConta, aoMudarConta } from '../conta.js'
import { codigoDaBusca, limparSalaDaUrl } from '../salaLink.js'

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
// Link de convite (?sala=CODIGO, lib/salaLink.js): salaDoLink() diz se há uma
// sala esperando; ao conectar, o lobby entra nela sozinho.
//
// Conta (lib/conta.js): logado, o "ola" leva o JWT e o servidor responde com o
// resumo do perfil (eu.conta). O token só vai para o servidor que serviu a
// página (casa), nunca para o de outro PC da LAN.
export const PROTOCOLO = 3
export const PORTA_PADRAO = 5180
const CHAVE_NOME = 'dodge-lan-nome'
const MAX_CHAT = 40 // mensagens guardadas
const LISTAR_MS = 1500
const PING_MS = 2000

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

// Abre (ou troca) a conexão; resolve com true quando o servidor dá as boas-vindas
function conectar(url) {
  fecharConexao()
  mudar({ fase: 'conectando', servidor: url, salas: [] })
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
        lan.update((s) => ({
          ...s,
          fase: s.fase === 'conectando' ? 'navegando' : s.fase,
          erro: '',
          eu: comConta({ ...s.eu, id: m.id }, m.conta),
          enderecos: url === casa ? m.enderecos ?? [] : s.enderecos,
          online: Boolean(m.online),
          ice: Array.isArray(m.ice) ? m.ice : [],
        }))
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
      socket.send(JSON.stringify({ t: 'ola', protocolo: PROTOCOLO, nome: estado().eu.nome, ...(token && { token }) }))
    }
    socket.onclose = () => {
      clearTimeout(tempo)
      if (ws !== socket) return
      ws = null
      pararTimers()
      ouvintesServidor.forEach((fn) => fn({ t: '_fechou' }))
      const s = estado()
      if (!aberto) {
        const semCasa = s.online ? 'sem conexão com o servidor: tentando de novo…' : 'servidor LAN não encontrado: rode "npm run lan" neste PC'
        mudar({ fase: 'navegando', sala: null, papel: null, salas: [], erro: url === casa ? semCasa : `não deu para conectar em ${url.replace(/^wss?:\/\//, '').replace(/\/lan$/, '')}` })
        resolve(false)
        // tenta de novo o servidor daqui (pode ser que ele ainda vá ser ligado)
        if (s.fase !== 'fora') setTimeout(() => estado().fase === 'navegando' && !ws && conectar(casa), url === casa ? 3000 : 2500)
        return
      }
      if (s.fase === 'fora') return
      sairDaSalaLocal(s.fase === 'sala' ? 'a conexão com a sala caiu' : '')
      mudar({ fase: 'navegando', erro: 'conexão caiu: tentando de novo…' })
      setTimeout(() => estado().fase === 'navegando' && !ws && conectar(casa), 1500)
    }
  })
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

function comecarTimers() {
  pararTimers()
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
      lan.update((s) => ({ ...s, eu: comConta(s.eu, m.conta) }))
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
      const eu = m.sala.membros.find((x) => x.id === s.eu.id)
      if (!eu) return
      const antes = s.sala
      const papel = eu.papel
      // chegou / saiu gente
      if (antes) {
        for (const x of m.sala.membros) if (!antes.membros.some((a) => a.id === x.id)) avisoChat(`${x.nome} entrou na sala`)
        for (const a of antes.membros) if (!m.sala.membros.some((x) => x.id === a.id)) avisoChat(`${a.nome} saiu da sala`)
      } else avisoChat(papel === 'host' ? 'sala criada: esperando alguém entrar' : `você entrou na sala de ${m.sala.membros.find((x) => x.papel === 'host')?.nome ?? '?'}`)
      mudar({ fase: 'sala', sala: m.sala, papel, erro: '' })
      break
    }
    case 'fechada':
      sairDaSalaLocal(m.motivo)
      mudar({ erro: m.motivo })
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
      if (estado().fase === 'sala') enviar({ t: 'meuPing', ms })
      break
    }
    case 'de':
      ouvintesParceiro.forEach((fn) => fn(m.dados, m.de))
      break
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
  mudar({ fase: 'navegando', sala: null, papel: null })
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
  if (estado().fase !== 'fora') return entrarNaSalaDoLink()
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
  enviar({ t: 'sair' })
  // logado: a conexão com o servidor de casa continua (presença e convites)
  if (manter && estado().servidor === casa && ws) {
    restaurarJogadores()
    return mudar({ fase: 'navegando', sala: null, papel: null, salas: [], chat: [], ping: null, erro: '' })
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
