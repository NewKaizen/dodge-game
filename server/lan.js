// Servidor do modo LAN (docs/lan.md): lobby por WebSocket em /lan e descoberta
// de salas por broadcast UDP. Roda dentro do `npm run lan` (server/index.js) e
// do `npm run dev` (plugin no vite.config.js).
//
// O servidor só junta as pessoas: guarda as salas, repassa o chat, os sinais
// do WebRTC (a imagem do host vai direto para o convidado) e os controles do
// convidado. Mensagens em JSON, { t: 'tipo', ... }; binário = quadro da
// transmissão reserva (JPEG), repassado ao outro membro da sala.
//
//   anexarLan(httpServer)   liga o /lan num servidor http; devolve { fechar() }
import { WebSocketServer } from 'ws'
import dgram from 'node:dgram'
import os from 'node:os'
import crypto from 'node:crypto'

export const PROTOCOLO = 1
export const PORTA_DESCOBERTA = 47777
export const MAX_MEMBROS = 2
const ANUNCIO_MS = 1500
const VALIDADE_ANUNCIO_MS = 5000
const BATIMENTO_MS = 5000
const MAX_NOME = 16
const MAX_CHAT = 120
const MODOS = ['pvp', 'coop']

const novoId = () => crypto.randomBytes(4).toString('hex')
const limpar = (texto, max) =>
  String(texto ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max)

// ---------- endereços ----------

const semPrefixo = (ip) => String(ip ?? '').replace(/^::ffff:/, '')
export const ehLoopback = (ip) => /^127\./.test(ip) || ip === '::1' || ip === 'localhost'

// IPv4 da máquina na rede: [{ ip, mascara }]
export function enderecosLocais() {
  const lista = []
  for (const infos of Object.values(os.networkInterfaces()))
    for (const i of infos ?? []) if (i.family === 'IPv4' && !i.internal) lista.push({ ip: i.address, mascara: i.netmask })
  return lista
}

const paraNumero = (ip) => ip.split('.').reduce((n, p) => (n << 8) + Number(p), 0) >>> 0
const paraIp = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.')

// Endereço de broadcast de cada rede (192.168.0.10/24 -> 192.168.0.255)
export function broadcasts(locais = enderecosLocais()) {
  const lista = locais.map(({ ip, mascara }) => paraIp((paraNumero(ip) & paraNumero(mascara)) | (~paraNumero(mascara) >>> 0)))
  return [...new Set([...lista, '255.255.255.255'])]
}

// O IP da máquina que o outro lado alcança: o da mesma rede que `destino`
export function ipParaAlcancar(destino, locais = enderecosLocais()) {
  if (!destino || ehLoopback(destino)) return '127.0.0.1'
  const n = paraNumero(destino)
  const mesmaRede = locais.find(({ ip, mascara }) => (paraNumero(ip) & paraNumero(mascara)) === (n & paraNumero(mascara)))
  return (mesmaRede ?? locais[0])?.ip ?? '127.0.0.1'
}

// O Chrome e o Firefox escondem o IP nos candidatos do WebRTC (um nome
// "xxxx.local", resolvido por mDNS, que muitas redes bloqueiam). O servidor
// sabe o IP de quem mandou: troca o nome por ele.
export const trocarMdns = (texto, ip) => (typeof texto === 'string' ? texto.replace(/[\w-]+\.local\b/g, ip) : texto)

// ---------- salas ----------

// salasRede(): as salas que a descoberta achou em outros servidores
// enderecos(): http://ip:porta onde este servidor serve o jogo (dica no lobby)
export function criarLobby({ locais = enderecosLocais, salasRede = () => [], enderecos = () => [] } = {}) {
  const clientes = new Map() // id -> cliente
  const salas = new Map() // id -> sala

  const enviar = (cliente, msg) => {
    if (cliente.ws.readyState === 1) cliente.ws.send(JSON.stringify(msg))
  }

  const publica = (sala) => ({
    id: sala.id,
    nome: sala.nome,
    modo: sala.modo,
    emPartida: sala.emPartida,
    max: MAX_MEMBROS,
    membros: [...sala.membros].map((id) => {
      const c = clientes.get(id)
      return { id, nome: c.nome, papel: id === sala.host ? 'host' : 'convidado', pronto: c.pronto, ping: c.ping }
    }),
  })

  const resumo = (sala) => ({
    id: sala.id,
    nome: sala.nome,
    host: clientes.get(sala.host)?.nome ?? '?',
    jogadores: sala.membros.size,
    max: MAX_MEMBROS,
    modo: sala.modo,
    emPartida: sala.emPartida,
  })

  const avisarSala = (sala) => {
    const msg = { t: 'sala', sala: publica(sala) }
    for (const id of sala.membros) enviar(clientes.get(id), msg)
  }

  function sair(cliente, motivo = 'o host saiu') {
    const sala = salas.get(cliente.sala)
    cliente.sala = null
    cliente.pronto = false
    if (!sala) return
    sala.membros.delete(cliente.id)
    if (cliente.id === sala.host) {
      salas.delete(sala.id)
      for (const id of sala.membros) {
        const outro = clientes.get(id)
        outro.sala = null
        outro.pronto = false
        enviar(outro, { t: 'fechada', motivo })
      }
      return
    }
    avisarSala(sala)
  }

  // IP de `de` como `para` enxerga (para os candidatos do WebRTC)
  const ipVisto = (de, para) => (ehLoopback(de.ip) ? ipParaAlcancar(para.ip, locais()) : de.ip)

  const acoes = {
    ola(c, m) {
      if (m.protocolo !== PROTOCOLO) return enviar(c, { t: 'erro', msg: `versão diferente do jogo (protocolo ${m.protocolo} x ${PROTOCOLO}): atualize os dois PCs` })
      c.nome = limpar(m.nome, MAX_NOME) || 'JOGADOR'
      c.ok = true
      enviar(c, { t: 'bemvindo', id: c.id, ip: c.ip, protocolo: PROTOCOLO, enderecos: enderecos() })
    },
    nome(c, m) {
      c.nome = limpar(m.nome, MAX_NOME) || c.nome
      const sala = salas.get(c.sala)
      if (sala) avisarSala(sala)
    },
    listar(c) {
      enviar(c, { t: 'salas', salas: [...salas.values()].map(resumo), rede: salasRede() })
    },
    criar(c, m) {
      sair(c)
      const sala = { id: novoId(), nome: limpar(m.nome, 24) || `SALA DE ${c.nome}`, host: c.id, membros: new Set([c.id]), modo: 'pvp', emPartida: false }
      salas.set(sala.id, sala)
      c.sala = sala.id
      c.pronto = true
      avisarSala(sala)
    },
    entrar(c, m) {
      const sala = salas.get(m.sala)
      if (!sala) return enviar(c, { t: 'erro', msg: 'essa sala não existe mais' })
      if (sala.membros.has(c.id)) return avisarSala(sala)
      if (sala.membros.size >= MAX_MEMBROS) return enviar(c, { t: 'erro', msg: 'a sala está cheia' })
      if (sala.emPartida) return enviar(c, { t: 'erro', msg: 'a sala está no meio de uma partida' })
      sair(c)
      sala.membros.add(c.id)
      c.sala = sala.id
      c.pronto = false
      avisarSala(sala)
    },
    sair(c) {
      sair(c, 'o host fechou a sala')
    },
    pronto(c, m) {
      const sala = salas.get(c.sala)
      if (!sala || sala.host === c.id) return
      c.pronto = Boolean(m.valor)
      avisarSala(sala)
    },
    modo(c, m) {
      const sala = salas.get(c.sala)
      if (!sala || sala.host !== c.id || !MODOS.includes(m.modo)) return
      sala.modo = m.modo
      for (const id of sala.membros) if (id !== sala.host) clientes.get(id).pronto = false // mudou o combinado: confirma de novo
      avisarSala(sala)
    },
    partida(c, m) {
      const sala = salas.get(c.sala)
      if (!sala || sala.host !== c.id) return
      sala.emPartida = Boolean(m.valor)
      if (!sala.emPartida) for (const id of sala.membros) if (id !== sala.host) clientes.get(id).pronto = false
      avisarSala(sala)
    },
    expulsar(c, m) {
      const sala = salas.get(c.sala)
      const alvo = clientes.get(m.id)
      if (!sala || sala.host !== c.id || !alvo || alvo.sala !== sala.id || alvo === c) return
      sair(alvo)
      enviar(alvo, { t: 'fechada', motivo: 'o host tirou você da sala' })
    },
    chat(c, m) {
      const sala = salas.get(c.sala)
      const texto = limpar(m.texto, MAX_CHAT)
      if (!sala || !texto) return
      for (const id of sala.membros) enviar(clientes.get(id), { t: 'chat', de: c.id, nome: c.nome, texto })
    },
    ping(c, m) {
      enviar(c, { t: 'pong', n: m.n })
    },
    meuPing(c, m) {
      const ms = Math.round(Number(m.ms))
      if (!Number.isFinite(ms) || ms === c.ping) return
      c.ping = ms
      const sala = salas.get(c.sala)
      if (sala) avisarSala(sala)
    },
    // repassa para os outros da sala (sinais do WebRTC e controles)
    para(c, m) {
      const sala = salas.get(c.sala)
      if (!sala || !m.dados || typeof m.dados !== 'object') return
      for (const id of sala.membros) {
        if (id === c.id) continue
        const outro = clientes.get(id)
        let dados = m.dados
        if (dados.tipo === 'ice' && dados.candidato) dados = { ...dados, candidato: { ...dados.candidato, candidate: trocarMdns(dados.candidato.candidate, ipVisto(c, outro)) } }
        if ((dados.tipo === 'oferta' || dados.tipo === 'resposta') && dados.sdp) dados = { ...dados, sdp: trocarMdns(dados.sdp, ipVisto(c, outro)) }
        enviar(outro, { t: 'de', de: c.id, dados })
      }
    },
  }

  return {
    clientes,
    salas,
    resumos: () => [...salas.values()].map(resumo),
    conectar(ws, ip) {
      const cliente = { id: novoId(), ws, ip: semPrefixo(ip), nome: 'JOGADOR', sala: null, pronto: false, ping: null, ok: false }
      clientes.set(cliente.id, cliente)
      return cliente
    },
    receber(cliente, texto, binario) {
      if (binario) {
        const sala = salas.get(cliente.sala)
        if (!sala || sala.host !== cliente.id) return // só o host transmite
        for (const id of sala.membros) {
          const outro = clientes.get(id)
          // quadro velho não serve: se o outro lado está atrasado, pula
          if (id !== cliente.id && outro.ws.readyState === 1 && outro.ws.bufferedAmount < 1_500_000) outro.ws.send(texto, { binary: true })
        }
        return
      }
      let m
      try {
        m = JSON.parse(texto)
      } catch {
        return
      }
      if (!m || typeof m.t !== 'string' || !Object.hasOwn(acoes, m.t)) return
      if (!cliente.ok && m.t !== 'ola') return
      acoes[m.t](cliente, m)
    },
    desconectar(cliente) {
      sair(cliente, 'o host desconectou')
      clientes.delete(cliente.id)
    },
  }
}

// ---------- descoberta (UDP) ----------
// Cada servidor anuncia as próprias salas na rede; o lobby lista as dos outros
// com o endereço do WebSocket de lá.
function criarDescoberta(lobby, porta, log) {
  const id = novoId()
  const remotos = new Map() // id do servidor -> { ip, porta, salas, visto }
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
  let timer = null

  socket.on('error', (erro) => {
    log(`[lan] descoberta de salas desligada (${erro.code ?? erro.message}); ainda dá para entrar pelo IP`)
    clearInterval(timer)
    try {
      socket.close()
    } catch {}
  })
  socket.on('message', (buf, rinfo) => {
    let m
    try {
      m = JSON.parse(buf.toString())
    } catch {
      return
    }
    if (m?.jogo !== 'dodge-lan' || m.id === id || m.protocolo !== PROTOCOLO || !Array.isArray(m.salas)) return
    remotos.set(m.id, { ip: rinfo.address, porta: Number(m.porta), salas: m.salas.slice(0, 20), visto: Date.now() })
  })
  socket.bind(PORTA_DESCOBERTA, () => {
    socket.setBroadcast(true)
    timer = setInterval(() => {
      const salas = lobby.resumos()
      const p = porta()
      if (!salas.length || !p) return
      const msg = Buffer.from(JSON.stringify({ jogo: 'dodge-lan', protocolo: PROTOCOLO, id, porta: p, salas }))
      for (const destino of broadcasts()) socket.send(msg, PORTA_DESCOBERTA, destino, () => {})
    }, ANUNCIO_MS)
  })

  return {
    salas() {
      const agora = Date.now()
      const lista = []
      for (const [chave, r] of remotos) {
        if (agora - r.visto > VALIDADE_ANUNCIO_MS) remotos.delete(chave)
        else for (const s of r.salas) lista.push({ ...s, endereco: `ws://${r.ip}:${r.porta}/lan`, ip: r.ip })
      }
      return lista
    },
    fechar() {
      clearInterval(timer)
      try {
        socket.close()
      } catch {}
    },
  }
}

// ---------- servidor ----------

export function anexarLan(httpServer, { log = console.log, descoberta = true } = {}) {
  let rede = null
  const porta = () => httpServer.address()?.port
  const lobby = criarLobby({ salasRede: () => rede?.salas() ?? [], enderecos: () => (porta() ? enderecosDoJogo(porta()) : []) })
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 * 1024 })
  if (descoberta) rede = criarDescoberta(lobby, porta, log)

  const aoUpgrade = (req, socket, head) => {
    if (new URL(req.url, 'http://x').pathname !== '/lan') return // o resto (ex.: o HMR do Vite) não é com a gente
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  }
  httpServer.on('upgrade', aoUpgrade)

  wss.on('connection', (ws, req) => {
    const cliente = lobby.conectar(ws, req.socket.remoteAddress)
    ws.vivo = true
    ws.on('pong', () => (ws.vivo = true))
    ws.on('message', (dados, binario) => lobby.receber(cliente, binario ? dados : dados.toString(), binario))
    ws.on('close', () => lobby.desconectar(cliente))
    ws.on('error', () => {})
  })

  // conexão que morreu sem fechar (Wi-Fi caiu): derruba e fecha a sala
  const batimento = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.vivo) {
        ws.terminate()
        continue
      }
      ws.vivo = false
      ws.ping()
    }
  }, BATIMENTO_MS)

  return {
    lobby,
    fechar() {
      clearInterval(batimento)
      rede?.fechar()
      httpServer.off('upgrade', aoUpgrade)
      for (const ws of wss.clients) ws.terminate()
      wss.close()
    },
  }
}

// Endereços para o outro PC abrir o jogo (http://ip:porta)
export const enderecosDoJogo = (porta) => enderecosLocais().map(({ ip }) => `http://${ip}:${porta}`)
