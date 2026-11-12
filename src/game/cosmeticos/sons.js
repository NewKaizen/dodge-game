// SONS DE DANO: o som que toca quando o jogador leva um golpe. Tudo sintetizado com Web Audio no
// contexto do jogo (audio.js contextoAudio) -- sem arquivos. Se a entrada do registro tem
// `arquivo` (ex.: 'sons/dano/latido.ogg', em public/), o arquivo SUBSTITUI a síntese: é baixado e
// decodificado só na primeira vez que o som toca (enquanto isso toca a versão sintetizada, ou o
// padrão). Ver docs/cosmeticos.md.
//
//   tocarSomDano(scene, id)    barato e seguro de chamar à vontade (limite de 1 por 45 ms)
//   IDS_SOM                    os ids que têm receita sintetizada
//   receitas[id](kit)          cada receita dura no máximo 400 ms
import { AUDIO } from '../constants.js'
import { contextoAudio, volumeEfeitos } from '../audio.js'

export const DURACAO_MAX = 0.4
const MIN_INTERVALO_MS = 45

// ---------- kit de síntese ----------
const ruidos = new WeakMap()
function bufferRuido(c) {
  let b = ruidos.get(c)
  if (!b) {
    b = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    ruidos.set(c, b)
  }
  return b
}

// valor fixo ou lista de [segundos, valor] (rampa exponencial entre os pontos)
function programar(param, v, t0) {
  if (!Array.isArray(v)) return param.setValueAtTime(Math.max(0.001, v), t0)
  param.setValueAtTime(Math.max(0.001, v[0][1]), t0 + v[0][0])
  for (let i = 1; i < v.length; i++) param.exponentialRampToValueAtTime(Math.max(0.001, v[i][1]), t0 + v[i][0])
}

export function criarKit(c, destino, t0) {
  const envelope = (t, dur, vol, atq) => {
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t0 + t)
    g.gain.linearRampToValueAtTime(vol, t0 + t + Math.min(atq, dur * 0.5))
    g.gain.exponentialRampToValueAtTime(0.001, t0 + t + dur)
    return g
  }
  const parar = (fonte, t, dur) => fonte.stop(t0 + t + dur + 0.04)

  const kit = {
    // oscilador com envelope, formantes (filtros passa-faixa em paralelo), vibrato e tremolo
    voz({ tipo = 'sawtooth', f, t = 0, dur = 0.2, vol = 0.4, atq = 0.006, formantes = [], vib = null, am = null, lp = null }) {
      const o = c.createOscillator()
      o.type = tipo
      programar(o.frequency, f, t0 + t)
      const env = envelope(t, dur, vol, atq)
      let cabeca = env
      if (am) {
        const ag = c.createGain()
        ag.gain.setValueAtTime(1 - am.prof, t0 + t)
        const l = c.createOscillator()
        l.frequency.value = am.hz
        const lg = c.createGain()
        lg.gain.value = am.prof
        l.connect(lg).connect(ag.gain)
        l.start(t0 + t)
        parar(l, t, dur)
        env.connect(ag)
        cabeca = ag
      }
      if (vib) {
        const l = c.createOscillator()
        l.frequency.value = vib.hz
        const lg = c.createGain()
        lg.gain.value = vib.prof
        l.connect(lg).connect(o.frequency)
        l.start(t0 + t)
        parar(l, t, dur)
      }
      o.connect(env)
      let saida = cabeca
      if (lp) {
        const f2 = c.createBiquadFilter()
        f2.type = 'lowpass'
        f2.frequency.value = lp
        cabeca.connect(f2)
        saida = f2
      }
      if (formantes.length) {
        for (const fm of formantes) {
          const bp = c.createBiquadFilter()
          bp.type = 'bandpass'
          bp.Q.value = fm.q ?? 5
          programar(bp.frequency, fm.f, t0 + t)
          const gg = c.createGain()
          gg.gain.value = fm.g ?? 1
          saida.connect(bp)
          bp.connect(gg)
          gg.connect(destino)
        }
      } else {
        saida.connect(destino)
      }
      o.start(t0 + t)
      parar(o, t, dur)
    },
    // tom simples (como o tom() do audio.js)
    tom({ tipo = 'square', f, t = 0, dur = 0.15, vol = 0.3, atq = 0.003 }) {
      kit.voz({ tipo, f, t, dur, vol, atq })
    },
    ruido({ t = 0, dur = 0.1, vol = 0.3, tipo = 'bandpass', f = 2000, q = 1, atq = 0.002 }) {
      const s = c.createBufferSource()
      s.buffer = bufferRuido(c)
      s.loop = true
      const fl = c.createBiquadFilter()
      fl.type = tipo
      fl.Q.value = q
      programar(fl.frequency, f, t0 + t)
      const env = envelope(t, dur, vol, atq)
      s.connect(fl)
      fl.connect(env)
      env.connect(destino)
      s.start(t0 + t, Math.random() * 0.5)
      parar(s, t, dur)
    },
  }
  return kit
}

// ---------- receitas ----------
export const receitas = {
  'dano-padrao': (k) => {
    k.tom({ tipo: 'square', f: [[0, 260], [0.16, 80]], dur: 0.16, vol: 0.4 })
    k.ruido({ dur: 0.07, vol: 0.35, tipo: 'lowpass', f: 1800 })
  },

  'dano-latido': (k) => {
    const au = (t, f, dur) => {
      k.voz({ tipo: 'sawtooth', f: [[0, f], [dur, f * 0.55]], t, dur, vol: 0.62, atq: 0.008, formantes: [{ f: 650, q: 5 }, { f: 1250, q: 6, g: 0.7 }, { f: 2400, q: 6, g: 0.25 }] })
      k.ruido({ t, dur: dur * 0.75, vol: 0.3, f: [[0, 1100], [dur, 450]], q: 1.4 })
    }
    au(0, 440, 0.12)
    au(0.17, 390, 0.17)
  },

  'dano-pato': (k) => {
    k.voz({ f: [[0, 400], [0.1, 360], [0.27, 290]], dur: 0.27, vol: 0.65, atq: 0.012, am: { hz: 58, prof: 0.55 }, formantes: [{ f: [[0, 800], [0.27, 1200]], q: 4.5 }, { f: 2300, q: 5, g: 0.55 }] })
    k.voz({ f: [[0, 340], [0.12, 270]], t: 0.26, dur: 0.12, vol: 0.4, am: { hz: 58, prof: 0.55 }, formantes: [{ f: 950, q: 4.5 }, { f: 2200, q: 5, g: 0.5 }] })
  },

  'dano-buzina': (k) => {
    const pa = (t, f, dur, vol) => {
      const formantes = [{ f: 750, q: 2.2 }, { f: 1600, q: 2.2, g: 0.6 }]
      k.voz({ tipo: 'square', f, t, dur, vol, atq: 0.01, formantes })
      k.voz({ tipo: 'square', f: f * 1.025, t, dur, vol: vol * 0.8, atq: 0.01, formantes })
    }
    pa(0, 330, 0.09, 0.4)
    pa(0.11, 440, 0.25, 0.46)
  },

  'dano-vidro': (k) => {
    k.ruido({ dur: 0.1, vol: 0.55, tipo: 'highpass', f: 3800, q: 0.7 })
    k.tom({ tipo: 'triangle', f: [[0, 1100], [0.04, 300]], dur: 0.05, vol: 0.4 })
    const picos = [3100, 4700, 2500, 6200, 3600, 5200, 2900]
    picos.forEach((f, i) => k.tom({ tipo: 'sine', f, t: 0.03 + i * 0.036, dur: 0.12 + (i % 3) * 0.02, vol: 0.2 }))
    k.ruido({ t: 0.12, dur: 0.1, vol: 0.18, tipo: 'highpass', f: 5200 })
  },

  'dano-moeda': (k) => {
    k.tom({ tipo: 'square', f: 988, dur: 0.075, vol: 0.34 })
    k.tom({ tipo: 'square', f: 1319, t: 0.07, dur: 0.3, vol: 0.34 })
    k.tom({ tipo: 'triangle', f: 2638, t: 0.07, dur: 0.22, vol: 0.12 })
  },

  'dano-boing': (k) => {
    k.voz({ tipo: 'triangle', f: [[0, 170], [0.05, 520], [0.4, 150]], dur: 0.4, vol: 0.7, atq: 0.004, vib: { hz: 26, prof: 55 } })
    k.voz({ tipo: 'sine', f: [[0, 340], [0.05, 1040], [0.4, 300]], dur: 0.32, vol: 0.18, vib: { hz: 26, prof: 90 } })
  },

  'dano-miau': (k) => {
    k.voz({ f: [[0, 500], [0.13, 790], [0.36, 470]], dur: 0.36, vol: 0.6, atq: 0.04, vib: { hz: 7, prof: 14 }, formantes: [{ f: [[0, 650], [0.13, 2000], [0.36, 900]], q: 5 }, { f: [[0, 1500], [0.36, 2600]], q: 6, g: 0.5 }] })
  },

  'dano-sino': (k) => {
    const base = 523
    const partes = [[1, 0.55], [1.004, 0.4], [2.0, 0.3], [2.76, 0.26], [5.4, 0.12], [8.9, 0.06]]
    partes.forEach(([r, v], i) => k.tom({ tipo: 'sine', f: base * r, dur: Math.max(0.16, 0.4 - i * 0.04), vol: v, atq: 0.002 }))
    k.ruido({ dur: 0.025, vol: 0.2, tipo: 'bandpass', f: 3200, q: 1 })
  },

  'dano-cabra': (k) => {
    k.voz({ f: [[0, 300], [0.08, 410], [0.4, 300]], dur: 0.4, vol: 0.65, atq: 0.02, am: { hz: 29, prof: 0.6 }, vib: { hz: 6, prof: 10 }, formantes: [{ f: 1000, q: 5 }, { f: 1850, q: 6, g: 0.65 }] })
  },

  'dano-laser': (k) => {
    k.tom({ tipo: 'square', f: [[0, 2000], [0.16, 170]], dur: 0.16, vol: 0.28 })
    k.tom({ tipo: 'square', f: [[0, 1500], [0.15, 140]], t: 0.18, dur: 0.15, vol: 0.26 })
    k.ruido({ dur: 0.04, vol: 0.12, tipo: 'highpass', f: 5000 })
  },

  'dano-pum': (k) => {
    k.voz({ tipo: 'sawtooth', f: [[0, 120], [0.12, 92], [0.34, 58]], dur: 0.34, vol: 0.75, atq: 0.02, lp: 520, vib: { hz: 41, prof: 20 }, am: { hz: 66, prof: 0.4 } })
    k.ruido({ dur: 0.3, vol: 0.2, tipo: 'lowpass', f: 380 })
  },
}

export const IDS_SOM = Object.keys(receitas)

// ---------- tocar ----------
let ultimo = 0
const buffers = new Map() // id -> AudioBuffer | 'carregando' | 'falhou'
let registroSons = [] // preenchido por registro.js (evita importar em círculo)
export const definirRegistroSons = (lista) => {
  registroSons = lista
}
const urlDe = (arquivo) => `${(typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'}${arquivo}`.replace(/\/\/+/g, '/')

async function carregarArquivo(c, id, arquivo) {
  buffers.set(id, 'carregando')
  try {
    const r = await fetch(urlDe(arquivo))
    if (!r.ok) throw new Error(String(r.status))
    buffers.set(id, await c.decodeAudioData(await r.arrayBuffer()))
  } catch {
    buffers.set(id, 'falhou')
  }
}

export function tocarSomDano(scene, id = 'dano-padrao') {
  try {
    const agora = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (agora - ultimo < MIN_INTERVALO_MS) return false
    const c = contextoAudio()
    const vol = volumeEfeitos()
    if (!c || vol <= 0) return false
    ultimo = agora
    if (c.state === 'suspended') c.resume?.()
    const entrada = registroSons.find((s) => s.id === id)
    const arquivo = entrada?.arquivo
    if (arquivo) {
      const b = buffers.get(id)
      if (b && b !== 'carregando' && b !== 'falhou') {
        const s = c.createBufferSource()
        s.buffer = b
        const g = c.createGain()
        g.gain.value = AUDIO.volume * vol * 1.8
        s.connect(g)
        g.connect(c.destination)
        s.start()
        return true
      }
      if (!b) carregarArquivo(c, id, arquivo)
    }
    const receita = receitas[id] ?? receitas['dano-padrao']
    const mestre = c.createGain()
    mestre.gain.value = AUDIO.volume * vol * 1.8
    const comp = c.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 6
    mestre.connect(comp)
    comp.connect(c.destination)
    receita(criarKit(c, mestre, c.currentTime + 0.005))
    return true
  } catch {
    return false
  }
}
