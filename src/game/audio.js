import { ASSETS } from './assets.js'
import { AUDIO } from './constants.js'
import { tocarMidi, pararMidi, setVolumeMidi } from './midi.js'

// Sons: se assets.js tiver um arquivo, toca o arquivo; senão sintetiza com WebAudio.
// Músicas: arquivo .mid toca com soundfont (midi.js); .ogg/.mp3 tocam direto.
// Sem nada em assets.js, procura public/assets/musicas/<nome>.mid; não
// achou, silêncio.

let contexto = null
let ligado = true
let musicaAtual = null
// multiplicadores dos sliders do painel (0 a 1), em cima de AUDIO.volume
const volumes = { musica: 1, efeitos: 1 }

export function setVolumes(musica, efeitos) {
  // o store muda a todo instante (joystick): só age quando o volume mudou de verdade
  if (musica === volumes.musica && efeitos === volumes.efeitos) return
  volumes.musica = musica
  volumes.efeitos = efeitos
  setVolumeMidi(musica)
  musicaAtual?.setVolume(AUDIO.volume * musica)
}

export function setSomLigado(valor) {
  ligado = valor
  if (!valor) pararMusica()
}

export function tocar(scene, nome) {
  if (!ligado) return
  const chave = `som-${nome}`
  if (ASSETS.sons[nome] && scene.cache.audio.exists(chave)) {
    scene.sound.play(chave, { volume: AUDIO.volume * volumes.efeitos })
    return
  }
  const c = obterContexto()
  if (c) SINTESE[nome]?.(sintetizador(c))
}

export function musica(scene, nome) {
  const arquivo = ASSETS.musicas[nome] ?? `assets/musicas/${nome}.mid`
  if (/\.midi?$/i.test(arquivo)) {
    musicaAtual?.stop()
    musicaAtual?.destroy()
    musicaAtual = null
    const c = obterContexto()
    if (!ligado || !c) return pararMidi()
    tocarMidi(c, arquivo)
    return
  }
  const chave = `musica-${nome}`
  if (musicaAtual?.key === chave && musicaAtual.isPlaying) return
  pararMusica()
  if (!ligado || !ASSETS.musicas[nome] || !scene.cache.audio.exists(chave)) return
  musicaAtual = scene.sound.add(chave, { loop: true, volume: AUDIO.volume * volumes.musica })
  musicaAtual.play()
}

export function pararMusica() {
  pararMidi()
  musicaAtual?.stop()
  musicaAtual?.destroy()
  musicaAtual = null
}

function obterContexto() {
  if (!contexto) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    contexto = new AC()
  }
  if (contexto.state === 'suspended') contexto.resume()
  return contexto
}

function sintetizador(c) {
  const saida = c.createGain()
  saida.gain.value = AUDIO.volume * volumes.efeitos
  saida.connect(c.destination)
  const agora = c.currentTime

  return {
    tom(freq, dur, tipo = 'square', vol = 0.3, freqFinal = freq, atraso = 0) {
      const t = agora + atraso
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = tipo
      o.frequency.setValueAtTime(freq, t)
      o.frequency.exponentialRampToValueAtTime(Math.max(1, freqFinal), t + dur)
      g.gain.setValueAtTime(vol, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + dur)
      o.connect(g).connect(saida)
      o.start(t)
      o.stop(t + dur + 0.02)
    },
    ruido(dur, vol = 0.3, atraso = 0, corte = 2000) {
      const t = agora + atraso
      const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate)
      const dados = buffer.getChannelData(0)
      for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1
      const fonte = c.createBufferSource()
      fonte.buffer = buffer
      const filtro = c.createBiquadFilter()
      filtro.type = 'lowpass'
      filtro.frequency.value = corte
      const g = c.createGain()
      g.gain.setValueAtTime(vol, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + dur)
      fonte.connect(filtro).connect(g).connect(saida)
      fonte.start(t)
    },
  }
}

const SINTESE = {
  texto: (s) => s.tom(720, 0.025, 'square', 0.06),
  mover: (s) => s.tom(520, 0.04, 'square', 0.1),
  confirmar: (s) => s.tom(660, 0.06, 'square', 0.12, 990),
  cancelar: (s) => s.tom(440, 0.06, 'square', 0.1, 300),
  erro: (s) => s.tom(150, 0.12, 'sawtooth', 0.12),
  dano: (s) => {
    s.ruido(0.15, 0.3, 0, 1200)
    s.tom(180, 0.15, 'sawtooth', 0.15, 80)
    s.tom(120, 0.09, 'square', 0.18, 45) // baque grave: dá peso ao acerto
  },
  graze: (s) => s.tom(1800, 0.04, 'triangle', 0.08, 2400),
  cura: (s) => {
    s.tom(523, 0.08, 'sine', 0.2)
    s.tom(659, 0.08, 'sine', 0.2, 659, 0.08)
    s.tom(784, 0.14, 'sine', 0.2, 784, 0.16)
  },
  golpe: (s) => {
    s.ruido(0.08, 0.25, 0, 3000)
    s.tom(220, 0.08, 'square', 0.12, 110)
  },
  critico: (s) => {
    s.ruido(0.1, 0.3, 0, 4000)
    s.tom(880, 0.12, 'square', 0.14, 1760, 0.04)
  },
  // combo completo do FIGHT: arpejo rápido subindo + estalo
  combo: (s) => {
    s.ruido(0.06, 0.2, 0, 5000)
    const notas = [587, 740, 988, 1318]
    notas.forEach((f, i) => s.tom(f, 0.07, 'square', 0.1, f * 1.02, i * 0.045))
  },
  explosao: (s) => s.ruido(0.4, 0.35, 0, 800),
  aviso: (s) => {
    s.tom(1320, 0.05, 'square', 0.06)
    s.tom(1320, 0.05, 'square', 0.06, 1320, 0.09)
  },
  laser: (s) => s.tom(1200, 0.25, 'sawtooth', 0.08, 300),
  tpMax: (s) => {
    s.tom(1046, 0.06, 'triangle', 0.12)
    s.tom(1568, 0.1, 'triangle', 0.12, 1568, 0.06)
  },
  vitoria: (s) => [523, 659, 784, 1046].forEach((f, i) => s.tom(f, 0.18, 'square', 0.12, f, i * 0.12)),
  gameover: (s) => [392, 330, 262, 196].forEach((f, i) => s.tom(f, 0.3, 'triangle', 0.15, f, i * 0.28)),
  quebrar: (s) => {
    s.ruido(0.2, 0.3, 0, 2500)
    s.tom(300, 0.2, 'square', 0.15, 60)
  },
  voo: (s) => s.tom(400, 0.18, 'sine', 0.1, 1200),
  // fom-fom: dois tons juntos (acorde "desafinado" de buzina), duas vezes
  buzina: (s) => {
    for (const atraso of [0, 0.22]) {
      s.tom(392, 0.16, 'square', 0.09, 380, atraso)
      s.tom(470, 0.16, 'square', 0.07, 455, atraso)
    }
  },
  // ronco do motor passando
  motor: (s) => {
    s.tom(70, 0.45, 'sawtooth', 0.14, 140)
    s.ruido(0.35, 0.12, 0, 500)
  },
}
