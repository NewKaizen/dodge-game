import { writable, get } from 'svelte/store'
import { lan, aoParceiro, enviarAoParceiro, enviarQuadro, aoQuadro, parceiro } from './rede.js'
import { faixaDeAudio } from './audioTap.js'
import { contextoAudio } from '../../game/audio.js'

// Transmissão do modo LAN (docs/lan.md): o host roda o jogo e manda a imagem
// do canvas + o som (audioTap.js) por WebRTC direto para o convidado, que só
// assiste e manda os controles (controleRemoto.js). Os sinais do WebRTC
// passam pelo servidor (rede.js), que troca os nomes .local pelo IP.
//
// Se o WebRTC não conectar em alguns segundos (firewall, rede estranha), cai
// na RESERVA: JPEGs pelo WebSocket do servidor, sem som.
//
// ONLINE (docs/online.md): o WebRTC usa os STUN/TURN que o servidor mandou, a
// imagem vai com menos banda (a internet de casa não é a LAN) e a reserva
// manda menos quadros (eles passam pelo servidor).
//
//   ligarJogo(game)            host: o Phaser.Game de onde sai a imagem
//   ligarTela(video, canvas)   convidado: onde a imagem aparece
//   tela                       store { modo: null | 'video' | 'reserva', estado, fps }
export const tela = writable({ modo: null, estado: 'parada' }) // estado: parada | conectando | ao-vivo | reserva

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

export const ligarJogo = (g) => (game = g)
export function ligarTela(elVideo, elCanvas) {
  video = elVideo
  canvasReserva = elCanvas
  const s = get(tela)
  if (s.stream && video) mostrarStream(s.stream)
}

const mudar = (parcial) => tela.update((s) => ({ ...s, ...parcial }))

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

  const imagem = game.canvas.captureStream(60)
  const faixaVideo = imagem.getVideoTracks()[0]
  if ('contentHint' in faixaVideo) faixaVideo.contentHint = 'motion'
  const stream = new MediaStream([faixaVideo])
  const som = faixaDeAudio(contextoAudio())
  if (som) stream.addTrack(som)
  const remetente = pc.addTrack(faixaVideo, stream)
  if (som) pc.addTrack(som, stream)
  preferirH264(pc)

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
    if (ocupado || agora - ultimo < 1000 / quadrosReserva) return
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
  pararReservaHost()
  candidatosPendentes = []
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
})
