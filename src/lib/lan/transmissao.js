import { writable, derived, get } from 'svelte/store'
import { lan, aoParceiro, enviarAoParceiro, enviarQuadro, aoQuadro, parceiro } from './rede.js'
import { faixaDeAudio } from './audioTap.js'
import { contextoAudio } from '../../game/audio.js'

// Conexão direta do modo LAN/ONLINE (docs/lan.md): um WebRTC entre os dois
// PCs da sala, com um canal de dados (o da partida em rede, game/rede.js) e o
// ping da ligação. Os sinais do WebRTC passam pelo servidor (rede.js), que
// troca os nomes .local pelo IP.
//
// NÃO USADO HOJE: a imagem. Este arquivo nasceu para o "Remote Play" (o host
// rodava o jogo e mandava a imagem do canvas + o som, audioTap.js, para o
// convidado, que só assistia). Agora a partida numa sala, PVP e CO-OP, roda
// no PC de cada um, e a imagem fica sempre parada (semImagem). O código do
// vídeo e da imagem reserva continua aqui (as faixas entram na negociação e
// são pausadas na hora, como já era no PVP); ninguém mostra o que chega.
//
// Se o WebRTC não conectar em alguns segundos (firewall, rede estranha), cai
// na RESERVA: JPEGs pelo WebSocket do servidor, sem som.
//
// ONLINE (docs/online.md): o WebRTC usa os STUN/TURN que o servidor mandou, a
// imagem vai com menos banda (a internet de casa não é a LAN) e a reserva
// manda menos quadros (eles passam pelo servidor).
//
// Junto com a imagem vai um canal de dados (RTCDataChannel) direto entre os
// dois PCs: as mensagens da partida (game/rede.js) vão por ele, sem dar a
// volta pelo servidor (que pode estar em outro país). Sem ele, vão pelo servidor.
// A cada segundo lê o ping da ligação direta, por onde ela passa e os quadros
// por segundo da imagem (store `ligacao`).
//
// A partida numa sala é em rede (game/rede.js): cada PC roda o próprio jogo e
// a imagem não serve para nada. A conexão continua (o canal de dados direto é
// o da partida e o ping vem dela), mas o host não manda imagem nem som: tira
// as faixas dos remetentes (replaceTrack(null)) e solta a captura do canvas; a
// reserva também não manda quadros.
//
//   ligarJogo(game)            host: o Phaser.Game de onde sai a imagem
//   ligarTela(video, canvas)   convidado: onde a imagem aparece (não usado hoje)
//   tela                       store { modo: null | 'video' | 'reserva', estado, fps }
//   ligacao                    store { ping, rota, fps }: ping (ms) da ligação direta,
//                              rota 'direta' | 'turn' | null, fps da imagem
//   enviarRapido(dados) · aoRapido(fn)   mensagens da partida: pelo canal direto (ou pelo servidor)
export const tela = writable({ modo: null, estado: 'parada' }) // estado: parada | conectando | ao-vivo | reserva
export const ligacao = writable({ ping: null, rota: null, fps: null })

// O ping que importa na partida: o da ligação direta entre os dois PCs (por
// onde vão a imagem e os controles). Sem ela, a volta pelo servidor: o meu
// ping até ele mais o do outro. { ms, rota: 'direta' | 'turn' | 'servidor' | null, fps }
export const pingPartida = derived([lan, ligacao], ([s, l]) => {
  const outro = s.fase === 'sala' ? s.sala?.membros.find((m) => m.id !== s.eu.id) : null
  if (!outro) return { ms: null, rota: null, fps: null }
  if (l.ping != null) return { ms: l.ping, rota: l.rota, fps: l.fps }
  const ms = s.ping != null && outro.ping != null ? s.ping + outro.ping : null
  return { ms, rota: ms == null ? null : 'servidor', fps: l.fps }
})
export const ROTAS = { direta: 'direto', turn: 'por TURN', servidor: 'pelo servidor' }
// verde / amarelo / vermelho
export const corDoPing = (ms) => (ms == null ? '#9a9ab0' : ms <= 80 ? '#6dffb0' : ms <= 150 ? '#ffd23a' : '#ff6070')

const ALTURA_MAX = 720 // linhas mandadas no vídeo (o resto vira escala)
// LAN x ONLINE
const AJUSTES = {
  lan: { esperaReserva: 7000, quadrosReserva: 30, qualidadeReserva: 0.72, bitrate: 12_000_000 },
  online: { esperaReserva: 12000, quadrosReserva: 15, qualidadeReserva: 0.6, bitrate: 4_000_000 },
}
const ajustes = () => (get(lan).online ? AJUSTES.online : AJUSTES.lan)
const configRtc = () => ({ iceServers: get(lan).ice ?? [] })

let game = null
let video = null
let canvasReserva = null
let pc = null
let papelAtual = null // 'host' | 'convidado' da conexão atual
let parceiroAtual = null
let timerReserva = null
let timerEscala = null
let reserva = null // host: { parar() }
let candidatosPendentes = []
let inicioHost = 0 // quando o host começou a conexão atual
let timerPedido = null // convidado: pede a imagem de novo enquanto ela não chega
let canal = null // RTCDataChannel aberto com o outro PC
let timerStats = null
let ultimosQuadros = null // { quadros, t } para calcular os fps
let midia = null // host: { remetenteVideo, remetenteSom, faixaVideo, som, pausada } da conexão atual
const ouvintesRapido = new Set()

export const ligarJogo = (g) => (game = g)
export function ligarTela(elVideo, elCanvas) {
  video = elVideo
  canvasReserva = elCanvas
  const s = get(tela)
  if (s.stream && video) mostrarStream(s.stream)
}

const mudar = (parcial) => tela.update((s) => ({ ...s, ...parcial }))

// partida em rede nos dois modos: nunca tem imagem (veja no topo). Era
// `sala.modo === 'pvp'` quando o CO-OP usava o Remote Play
const semImagem = () => true

// ---------- canal direto (mensagens da partida) ----------

export function enviarRapido(dados) {
  if (canal?.readyState === 'open') {
    try {
      canal.send(JSON.stringify(dados))
      return
    } catch {}
  }
  enviarAoParceiro(dados)
}

// fn(dados) recebe tanto o que vem pelo canal direto quanto pelo servidor
export function aoRapido(fn) {
  ouvintesRapido.add(fn)
  const parar = aoParceiro(fn)
  return () => {
    ouvintesRapido.delete(fn)
    parar()
  }
}

function usarCanal(c) {
  c.onopen = () => (canal = c)
  c.onclose = () => canal === c && (canal = null)
  c.onmessage = (e) => {
    let dados
    try {
      dados = JSON.parse(e.data)
    } catch {
      return
    }
    ouvintesRapido.forEach((fn) => fn(dados))
  }
  if (c.readyState === 'open') canal = c
}

// ping e rota da ligação direta, fps da imagem (os dois lados)
function comecarStats(conexao) {
  clearInterval(timerStats)
  ultimosQuadros = null
  timerStats = setInterval(async () => {
    if (conexao !== pc) return
    let relatorio
    try {
      relatorio = await conexao.getStats()
    } catch {
      return
    }
    const itens = [...relatorio.values()]
    const transporte = itens.find((r) => r.type === 'transport' && r.selectedCandidatePairId)
    const par = transporte ? relatorio.get(transporte.selectedCandidatePairId) : itens.find((r) => r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded')
    const local = par && relatorio.get(par.localCandidateId)
    const remoto = par && relatorio.get(par.remoteCandidateId)
    const ping = par?.currentRoundTripTime != null ? Math.round(par.currentRoundTripTime * 1000) : null
    const rota = !par ? null : local?.candidateType === 'relay' || remoto?.candidateType === 'relay' ? 'turn' : 'direta'
    const video = itens.find((r) => (r.type === 'inbound-rtp' || r.type === 'outbound-rtp') && r.kind === 'video')
    let fps = video?.framesPerSecond ?? null
    const quadros = video?.framesDecoded ?? video?.framesEncoded
    if (fps == null && quadros != null) {
      const agora = performance.now()
      if (ultimosQuadros) fps = Math.round(((quadros - ultimosQuadros.quadros) * 1000) / (agora - ultimosQuadros.t))
      ultimosQuadros = { quadros, t: agora }
    }
    ligacao.set({ ping, rota, fps: fps == null ? null : Math.round(fps) })
  }, 1000)
}

// ---------- host ----------

async function comecarHost() {
  pararTudo()
  papelAtual = 'host'
  parceiroAtual = parceiro()?.id
  inicioHost = performance.now()
  mudar({ modo: null, estado: 'conectando', stream: null })
  if (!game?.canvas) return
  pc = new RTCPeerConnection(configRtc())
  const meu = pc
  usarCanal(pc.createDataChannel('controles', { ordered: true }))
  comecarStats(pc)
  pc.onicecandidate = (e) => e.candidate && enviarAoParceiro({ tipo: 'ice', candidato: e.candidate.toJSON() })
  pc.onconnectionstatechange = () => {
    if (meu !== pc) return
    if (pc.connectionState === 'connected') {
      clearTimeout(timerReserva)
      pararReservaHost()
      mudar({ estado: 'ao-vivo' })
      enviarAoParceiro({ tipo: 'modoTela', modo: 'video' })
    }
    if (pc.connectionState === 'failed') ligarReservaHost()
  }

  const faixaVideo = capturarCanvas()
  const stream = new MediaStream([faixaVideo])
  const som = faixaDeAudio(contextoAudio())
  if (som) stream.addTrack(som)
  const remetente = pc.addTrack(faixaVideo, stream)
  const remetenteSom = som ? pc.addTrack(som, stream) : null
  preferirH264(pc)
  // as faixas entram na negociação (como era no Remote Play) e já pausam
  midia = { remetenteVideo: remetente, remetenteSom, faixaVideo, som, pausada: false }
  atualizarImagem()

  const ajustar = async () => {
    if (meu !== pc) return
    try {
      const p = remetente.getParameters()
      if (!p.encodings?.length) p.encodings = [{}]
      p.encodings[0].maxBitrate = ajustes().bitrate
      p.encodings[0].maxFramerate = 60
      p.encodings[0].scaleResolutionDownBy = Math.max(1, (game.canvas.height || ALTURA_MAX) / ALTURA_MAX)
      p.degradationPreference = 'balanced'
      await remetente.setParameters(p)
    } catch {}
  }
  timerEscala = setInterval(ajustar, 2000) // a janela muda de tamanho: o canvas também

  const oferta = await pc.createOffer()
  if (meu !== pc) return
  await pc.setLocalDescription(oferta)
  enviarAoParceiro({ tipo: 'oferta', sdp: pc.localDescription.sdp })
  ajustar()
  timerReserva = setTimeout(() => meu === pc && pc.connectionState !== 'connected' && ligarReservaHost(), ajustes().esperaReserva)
}

function capturarCanvas() {
  const faixa = game.canvas.captureStream(60).getVideoTracks()[0]
  if ('contentHint' in faixa) faixa.contentHint = 'motion'
  return faixa
}

// host: pausa / retoma a imagem e o som (hoje: sempre pausados)
function atualizarImagem() {
  if (papelAtual !== 'host' || !midia) return
  const pausar = semImagem()
  if (pausar === midia.pausada) return
  midia.pausada = pausar
  const trocar = (remetente, faixa) => remetente?.replaceTrack(faixa).catch((e) => console.warn('[lan] replaceTrack', e))
  if (pausar) {
    trocar(midia.remetenteVideo, null)
    trocar(midia.remetenteSom, null)
    midia.faixaVideo?.stop() // a captura do canvas também custa: solta
    midia.faixaVideo = null
    return
  }
  midia.faixaVideo = capturarCanvas()
  trocar(midia.remetenteVideo, midia.faixaVideo)
  trocar(midia.remetenteSom, midia.som)
}

function preferirH264(conexao) {
  // H.264 costuma ter codificador por hardware: menos peso no PC do host
  try {
    const caps = RTCRtpSender.getCapabilities?.('video')
    if (!caps) return
    const ordem = (c) => (/h264/i.test(c.mimeType) ? 0 : /vp8/i.test(c.mimeType) ? 1 : 2)
    const codecs = [...caps.codecs].sort((a, b) => ordem(a) - ordem(b))
    for (const t of conexao.getTransceivers()) if (t.sender.track?.kind === 'video') t.setCodecPreferences(codecs)
  } catch {}
}

// Reserva do host: JPEG do canvas logo depois de cada desenho (o WebGL limpa a
// imagem depois), no máximo ajustes().quadrosReserva por segundo
function ligarReservaHost() {
  if (reserva || papelAtual !== 'host' || !game) return
  clearTimeout(timerReserva)
  const tela2d = document.createElement('canvas')
  tela2d.width = 640
  tela2d.height = 480
  const ctx = tela2d.getContext('2d')
  let ultimo = 0
  let ocupado = false
  const { quadrosReserva, qualidadeReserva } = ajustes()
  const aoDesenhar = () => {
    const agora = performance.now()
    if (ocupado || agora - ultimo < 1000 / quadrosReserva || semImagem()) return
    ultimo = agora
    ctx.drawImage(game.canvas, 0, 0, tela2d.width, tela2d.height)
    ocupado = true
    tela2d.toBlob(
      (blob) => {
        ocupado = false
        if (blob) enviarQuadro(blob)
      },
      'image/jpeg',
      qualidadeReserva,
    )
  }
  game.events.on('postrender', aoDesenhar)
  reserva = { parar: () => game?.events.off('postrender', aoDesenhar) }
  mudar({ estado: 'reserva' })
  enviarAoParceiro({ tipo: 'modoTela', modo: 'reserva' })
}

function pararReservaHost() {
  reserva?.parar()
  reserva = null
}

// ---------- convidado ----------

async function receberOferta(sdp) {
  pararTudo()
  papelAtual = 'convidado'
  parceiroAtual = parceiro()?.id
  mudar({ estado: 'conectando' })
  pc = new RTCPeerConnection(configRtc())
  const meu = pc
  pc.ondatachannel = (e) => meu === pc && usarCanal(e.channel)
  comecarStats(pc)
  pc.onicecandidate = (e) => e.candidate && enviarAoParceiro({ tipo: 'ice', candidato: e.candidate.toJSON() })
  pc.ontrack = (e) => {
    if (meu !== pc) return
    const stream = e.streams[0] ?? new MediaStream([e.track])
    mostrarStream(stream)
  }
  pc.onconnectionstatechange = () => meu === pc && pc.connectionState === 'connected' && mudar({ estado: 'ao-vivo', modo: 'video' })
  await pc.setRemoteDescription({ type: 'offer', sdp })
  for (const c of candidatosPendentes) await pc.addIceCandidate(c).catch(() => {})
  candidatosPendentes = []
  const resposta = await pc.createAnswer()
  if (meu !== pc) return
  await pc.setLocalDescription(resposta)
  enviarAoParceiro({ tipo: 'resposta', sdp: bitrateDeLan(pc.localDescription.sdp) })
}

// Na LAN sobra banda: o Chrome do host já começa mandando a imagem com
// qualidade boa em vez de subir aos poucos (x-google-*-bitrate, em kbps, nos
// codecs de vídeo da resposta que o host recebe). Online, com o teto menor.
function bitrateDeLan(sdp) {
  const { bitrate } = ajustes()
  const extra = `x-google-start-bitrate=${bitrate / 2000};x-google-min-bitrate=${bitrate / 6000};x-google-max-bitrate=${bitrate / 1000}`
  const linhas = sdp.split('\r\n')
  const video = new Set()
  let emVideo = false
  for (const l of linhas) {
    if (l.startsWith('m=')) emVideo = l.startsWith('m=video')
    const m = emVideo && l.match(/^a=rtpmap:(\d+) (H264|VP8|VP9|AV1)\//i)
    if (m) video.add(m[1])
  }
  const comFmtp = new Set()
  const saida = linhas.map((l) => {
    const m = l.match(/^a=fmtp:(\d+) /)
    if (!m || !video.has(m[1])) return l
    comFmtp.add(m[1])
    return `${l};${extra}`
  })
  // codec sem linha fmtp (ex.: VP8): ganha uma logo depois do rtpmap
  return saida
    .flatMap((l) => {
      const m = l.match(/^a=rtpmap:(\d+) /)
      return m && video.has(m[1]) && !comFmtp.has(m[1]) ? [l, `a=fmtp:${m[1]} ${extra}`] : [l]
    })
    .join('\r\n')
}

function mostrarStream(stream) {
  mudar({ stream })
  if (!video) return
  if (video.srcObject !== stream) video.srcObject = stream
  video.play?.().catch(() => {
    // sem gesto do usuário o som pode ser barrado: toca mudo e tenta de novo no próximo toque
    video.muted = true
    video.play?.().catch(() => {})
    const destravar = () => {
      video.muted = false
      window.removeEventListener('keydown', destravar)
      window.removeEventListener('pointerdown', destravar)
    }
    window.addEventListener('keydown', destravar)
    window.addEventListener('pointerdown', destravar)
  })
}

let desenhandoQuadro = false
function desenharQuadro(blob) {
  if (!canvasReserva || desenhandoQuadro) return // atrasado: pula
  desenhandoQuadro = true
  createImageBitmap(blob)
    .then((img) => {
      canvasReserva.width = img.width
      canvasReserva.height = img.height
      canvasReserva.getContext('2d').drawImage(img, 0, 0)
      img.close?.()
    })
    .catch(() => {})
    .finally(() => (desenhandoQuadro = false))
}

// ---------- os dois ----------

function pararTudo() {
  clearTimeout(timerReserva)
  clearInterval(timerEscala)
  clearInterval(timerStats)
  canal = null
  ligacao.set({ ping: null, rota: null, fps: null })
  pararReservaHost()
  candidatosPendentes = []
  midia?.faixaVideo?.stop()
  midia = null
  if (pc) {
    const velho = pc
    pc = null
    velho.close()
  }
  papelAtual = null
  parceiroAtual = null
  if (video) video.srcObject = null
  mudar({ modo: null, estado: 'parada', stream: null })
}

aoParceiro(async (dados) => {
  switch (dados?.tipo) {
    case 'oferta':
      if (get(lan).papel === 'convidado') receberOferta(dados.sdp).catch((e) => console.warn('[lan] oferta', e))
      break
    case 'resposta':
      if (papelAtual === 'host' && pc) await pc.setRemoteDescription({ type: 'answer', sdp: dados.sdp }).catch((e) => console.warn('[lan] resposta', e))
      break
    case 'ice':
      if (!pc) return
      if (!pc.remoteDescription) candidatosPendentes.push(dados.candidato)
      else await pc.addIceCandidate(dados.candidato).catch(() => {})
      break
    case 'modoTela':
      if (papelAtual === 'convidado' || get(lan).papel === 'convidado') mudar({ modo: dados.modo, estado: dados.modo === 'reserva' ? 'reserva' : get(tela).estado })
      break
    case 'quero': {
      // o convidado pediu (entrou agora, ou perdeu a imagem): começa de novo,
      // a não ser que a conexão de agora ainda esteja tentando
      if (get(lan).papel !== 'host') return
      const tentando = pc && get(tela).estado === 'conectando' && performance.now() - inicioHost < ajustes().esperaReserva + 3000
      if (!tentando) comecarHost().catch((e) => console.warn('[lan] transmissão', e))
      break
    }
  }
})
aoQuadro((blob) => get(lan).papel === 'convidado' && desenharQuadro(blob))

// Liga / desliga conforme a sala: o host transmite enquanto tem convidado (já
// no lobby, para a imagem estar pronta quando a partida começar)
let pedidoPara = null // convidado: de quem já pediu a imagem
lan.subscribe((s) => {
  const outro = s.fase === 'sala' ? s.sala?.membros.find((m) => m.id !== s.eu.id) : null
  if (!outro) {
    clearInterval(timerPedido)
    pedidoPara = null
    if (papelAtual) pararTudo()
    return
  }
  if (s.papel === 'convidado' && pedidoPara !== outro.id) {
    pedidoPara = outro.id
    const pedir = () => {
      const e = get(tela).estado
      if (e !== 'ao-vivo' && e !== 'reserva') enviarAoParceiro({ tipo: 'quero' })
    }
    pedir()
    clearInterval(timerPedido)
    timerPedido = setInterval(pedir, 5000)
  }
  if (s.papel === 'host' && parceiroAtual && parceiroAtual !== outro.id) pararTudo() // trocou o convidado: ele pede de novo
  atualizarImagem() // (sempre sem imagem: game/rede.js)
})
