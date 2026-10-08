import { AUDIO } from './constants.js'
import { tocarMidi, pararMidi, pausarMidi, retomarMidi, cortarMidi, setVolumeMidi, setVelocidadeMidi, setGraveMidi, setTomMidi, tempoMidi, existeMidi, estadoMidi } from './midi.js'

// Sons: arquivo carregado pela Boot (som-<nome>: ASSETS.sons e os manifestos
// de SUPER/habilidades/menu) ou sintetizado com WebAudio (SINTESE).
// Músicas: public/assets/musicas/<nome>.mid, tocadas com soundfont (midi.js).

let contexto = null
let ligado = true
// multiplicadores dos sliders (0 a 1), em cima de AUDIO.volume
const volumes = { musica: 1, efeitos: 1 }
let abafo = 1 // abaixarMusica(): fração do volume da música enquanto algo importante toca
let nomeMusica = null // nome (musica(nome)) da música pedida por último
let guardada = null // tocarMusicaEspecial(): { nome, arquivo, tempo } da música que estava tocando
let pedidoEspecial = 0 // descarta tocarMusicaEspecial que ainda estava conferindo o arquivo
const continuos = new Set() // somContinuo() tocando (setSomLigado(false) para todos)

const arquivoMusica = (nome) => `assets/musicas/${nome}.mid`

export function setVolumes(musica, efeitos) {
  // o store muda a todo instante (joystick): só age quando o volume mudou de verdade
  if (musica === volumes.musica && efeitos === volumes.efeitos) return
  volumes.musica = musica
  volumes.efeitos = efeitos
  setVolumeMidi(musica * abafo)
}

// Abaixa a música (fator 0..1 do volume normal) numa rampa curta, ex.: a
// roleta do bonus round; restaurarMusica() volta ao normal
export function abaixarMusica(fator = 0.35) {
  abafo = Math.max(0, Math.min(1, fator))
  setVolumeMidi(volumes.musica * abafo) // o midi já faz a rampa (setTargetAtTime)
}

export function restaurarMusica() {
  abaixarMusica(1)
}

export function setSomLigado(valor) {
  ligado = valor
  if (!valor) {
    pararMusica()
    for (const c of [...continuos]) c.parar(0)
  }
}

// opcoes: repassadas ao som sintetizado (ex.: roletaGiro { duracao })
export function tocar(scene, nome, opcoes) {
  if (!ligado) return
  const chave = `som-${nome}`
  if (scene.cache.audio.exists(chave)) {
    scene.sound.play(chave, { volume: AUDIO.volume * volumes.efeitos })
    return
  }
  const c = obterContexto()
  if (c) SINTESE[nome]?.(sintetizador(c), opcoes ?? {})
}

// reserva: outra música para tocar se <nome>.mid não existir (ex.: 'menu'
// cai na 'jevil' enquanto não houver menu.mid em public/assets/musicas/)
let pedidoMusica = 0
export function musica(nome, reserva) {
  const pedido = ++pedidoMusica
  esquecerEspecial() // outra música pedida: a especial (e o que ela guardou) perdeu a vez
  nomeMusica = nome
  const c = obterContexto()
  if (!ligado || !c) return pararMidi()
  tocarMidi(c, arquivoMusica(nome)).then((ok) => {
    // só cai na reserva se ninguém pediu outra música nesse meio tempo
    if (!ok && reserva && reserva !== nome && pedido === pedidoMusica) musica(reserva)
  })
}

// Andamento da música (1 = normal), para a morte súbita das partidas longas
// (ACELERACAO em constants.js). Vale para a música atual e as próximas, até
// pedirem 1 de novo: as cenas que aceleram voltam para 1 ao começar e ao sair.
export const velocidadeMusica = (fator = 1) => setVelocidadeMidi(fator)

// Menu de pause: congela a música e continua do mesmo ponto depois
export const pausarMusica = () => pausarMidi()
export const retomarMusica = () => retomarMidi()

// Corte SECO da música (true) e a volta do mesmo ponto (false), ex.: a DANÇA DA
// ESTÁTUA. Não briga com o pause do menu. Fica valendo até pedirem false: sempre desfaça.
export const cortarMusica = (cortar = true) => cortarMidi(cortar)

export function pararMusica() {
  esquecerEspecial()
  pararMidi()
}

// ---------- música especial (carta SUPER) ----------
// tocarMusicaEspecial(nome): se assets/musicas/<nome>.mid existir, guarda a
// música que estava tocando (nome e segundo onde parou) e toca a especial em
// loop. Sem o arquivo não faz NADA (a música de batalha continua) e devolve false.
// voltarMusicaNormal(): volta a guardada do ponto onde parou, com fade-in.
// O andamento da morte súbita e o abafo continuam valendo nas duas.
export async function tocarMusicaEspecial(nome) {
  if (!ligado) return false
  const meu = ++pedidoEspecial
  const arquivo = arquivoMusica(nome)
  if (!(await existeMidi(arquivo))) return false
  // voltarMusicaNormal/musica()/pararMusica() no meio da conferência: desiste
  const c = obterContexto()
  if (meu !== pedidoEspecial || !ligado || !c) return false
  // só guarda se ainda não há nada guardado: a 2ª especial seguida não pode
  // guardar a 1ª como "música normal"
  if (!guardada) {
    const { tocando } = estadoMidi()
    guardada = { nome: nomeMusica, arquivo: tocando, tempo: tocando ? tempoMidi() : 0 }
  }
  pedidoMusica++ // uma reserva atrasada de musica() não atropela a especial
  tocarMidi(c, arquivo)
  return true
}

export function voltarMusicaNormal() {
  pedidoEspecial++ // cancela uma tocarMusicaEspecial ainda conferindo o arquivo
  const g = guardada
  if (!g) return
  guardada = null
  nomeMusica = g.nome
  pedidoMusica++
  const c = ligado && g.arquivo && obterContexto()
  if (c) tocarMidi(c, g.arquivo, { inicio: g.tempo }) // tocarMidi já entra em fade-in
  else pararMidi() // não havia música antes da especial
}

// musica()/pararMusica(): esquece a especial e o que ela guardou
function esquecerEspecial() {
  pedidoEspecial++
  guardada = null
}

// Tom da música em semitons (0 = normal), sem mudar o andamento. Ex.: o
// COGUMELO MALUCO deixa a música grave com o coração gigante e aguda com o mini.
// Fica valendo até alguém pedir 0: sempre desfaça.
export const tomMusica = (semitons = 0) => setTomMidi(semitons)

// Realce de graves na música (dB num lowshelf de ~180 Hz; 0 = normal), ex.: o
// MODO FESTA. Fica valendo até alguém pedir 0.
export function reforcarGrave(db = 0, ms = 400) {
  setGraveMidi(db, ms)
}

// ---------- sons contínuos (loop até parar) ----------
// somContinuo(scene, nome) -> { parar(ms = 400) }: o arquivo som-<nome> em
// loop, com fade de entrada e de saída (ex.: 'chuva' no apagão).
export function somContinuo(scene, nome) {
  if (!ligado) return { parar() {} }
  const som = scene.sound.add(`som-${nome}`, { loop: true, volume: 0 })
  som.play()
  const alvo = () => AUDIO.volume * volumes.efeitos
  let rampa = null
  const rampaPara = (de, para, ms, fim) => {
    clearInterval(rampa)
    const inicio = performance.now()
    rampa = setInterval(() => {
      const p = Math.min(1, (performance.now() - inicio) / Math.max(1, ms))
      if (som.manager && !som.pendingRemove) som.setVolume(de + (para - de) * p)
      if (p < 1) return
      clearInterval(rampa)
      fim?.()
    }, 30)
  }
  rampaPara(0, alvo(), 600)
  let parado = false
  const controle = {
    parar(ms = 400) {
      if (parado) return
      parado = true
      continuos.delete(controle)
      rampaPara(som.volume, 0, ms, () => {
        som.stop()
        som.destroy()
      })
    },
  }
  continuos.add(controle)
  return controle
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
    // como tom(), mas entra devagar (ataque em s): bom para notas longas e roncos
    nota(freq, dur, tipo = 'sine', vol = 0.2, freqFinal = freq, atraso = 0, ataque = 0.25) {
      const t = agora + atraso
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = tipo
      o.frequency.setValueAtTime(freq, t)
      o.frequency.exponentialRampToValueAtTime(Math.max(1, freqFinal), t + dur)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(vol, t + Math.min(ataque, dur * 0.8))
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
    // bolinha rolando na roda da roleta: chiado num passa-faixa que desce de
    // tom, com um "trrr" (tremolo) que desacelera junto com a roda
    rolamento(dur, vol = 0.1, atraso = 0) {
      const t = agora + atraso
      const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate)
      const dados = buffer.getChannelData(0)
      for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1
      const fonte = c.createBufferSource()
      fonte.buffer = buffer
      const filtro = c.createBiquadFilter()
      filtro.type = 'bandpass'
      filtro.Q.value = 3
      filtro.frequency.setValueAtTime(3200, t)
      filtro.frequency.exponentialRampToValueAtTime(900, t + dur)
      // tremolo: ganho base + LFO (o LFO desacelera de 22 Hz para 6 Hz)
      const trem = c.createGain()
      trem.gain.value = 0.5
      const lfo = c.createOscillator()
      lfo.type = 'square'
      lfo.frequency.setValueAtTime(22, t)
      lfo.frequency.exponentialRampToValueAtTime(6, t + dur)
      const profundidade = c.createGain()
      profundidade.gain.value = 0.45
      lfo.connect(profundidade).connect(trem.gain)
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(vol, t + Math.min(0.12, dur * 0.2))
      g.gain.setValueAtTime(vol, t + dur * 0.7)
      g.gain.exponentialRampToValueAtTime(0.001, t + dur)
      fonte.connect(filtro).connect(trem).connect(g).connect(saida)
      fonte.start(t)
      lfo.start(t)
      lfo.stop(t + dur + 0.02)
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
  // COMBO/PAR no contra-ataque do CO-OP: arpejo rápido subindo + estalo
  combo: (s) => {
    s.ruido(0.06, 0.2, 0, 5000)
    const notas = [587, 740, 988, 1318]
    notas.forEach((f, i) => s.tom(f, 0.07, 'square', 0.1, f * 1.02, i * 0.045))
  },
  explosao: (s) => s.ruido(0.4, 0.35, 0, 800),
  // corte seco da música no fim da luta: clique curto + baque abafado
  estalo: (s) => {
    s.ruido(0.035, 0.5, 0, 6000)
    s.tom(90, 0.12, 'sine', 0.35, 40)
  },
  // chefe derrotado se desfazendo em pedaços
  estouro: (s) => {
    s.ruido(0.6, 0.35, 0, 1400)
    s.tom(220, 0.5, 'square', 0.12, 50)
    s.ruido(0.25, 0.2, 0.08, 5000)
  },
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
  // entrada na batalha: batidas graves que aceleram, sobem de tom e de volume (~0,9 s)
  tensao: (s) => {
    let t = 0
    for (let i = 0; i < 11; i++) {
      const k = i / 10
      s.tom(48 + k * 46, 0.16, 'sawtooth', 0.07 + k * 0.17, 30 + k * 20, t)
      s.tom(96 + k * 92, 0.08, 'square', 0.03 + k * 0.05, 60, t)
      s.ruido(0.07, 0.04 + k * 0.12, t, 300 + k * 900)
      t += 0.13 - k * 0.085 // cada batida mais perto da outra
    }
  },
  // vidro trincando
  rachar: (s) => {
    s.ruido(0.06, 0.28, 0, 7000)
    s.tom(1700, 0.05, 'square', 0.05, 520)
    s.ruido(0.05, 0.16, 0.035, 5000)
  },
  // o estouro da entrada: baque fundo, estilhaço agudo e um rastro que ecoa
  impacto: (s) => {
    s.ruido(0.08, 0.4, 0, 9000)
    s.ruido(0.7, 0.42, 0, 700)
    s.tom(110, 0.6, 'sawtooth', 0.3, 28)
    s.tom(58, 0.9, 'sine', 0.5, 22)
    s.tom(220, 0.25, 'square', 0.1, 55, 0.02)
    s.ruido(0.5, 0.12, 0.18, 400)
  },

  // ---------- tela de vitória ----------
  // sopro subindo antes do estouro de luz
  subida: (s) => {
    s.tom(180, 0.55, 'sawtooth', 0.05, 1400)
    s.tom(360, 0.55, 'triangle', 0.05, 2200)
    s.ruido(0.5, 0.05, 0.05, 6000)
  },
  // estouro de luz/confete: baque grave + chiado brilhante
  estouroFesta: (s) => {
    s.tom(110, 0.35, 'sine', 0.35, 40)
    s.ruido(0.5, 0.28, 0, 7000)
    s.ruido(0.25, 0.2, 0, 900)
  },
  // fanfarra curta: três toques rápidos e um acorde aberto sustentado
  fanfarra: (s) => {
    ;[392, 392, 523].forEach((f, i) => s.tom(f, 0.09, 'square', 0.09, f, i * 0.1))
    for (const f of [523, 659, 784, 1046]) s.tom(f, 0.7, 'square', 0.06, f * 1.005, 0.32)
    s.tom(262, 0.7, 'triangle', 0.14, 262, 0.32)
  },
  // fogo de artifício ao fundo: estalo leve (baixinho, toca várias vezes)
  fogo: (s) => {
    s.tom(700, 0.12, 'sine', 0.04, 180)
    s.ruido(0.3, 0.07, 0.05, 5000)
  },
  // "tic" de contador rolando (curto e agudo, toca muitas vezes)
  contador: (s) => s.tom(1500 + Math.random() * 200, 0.018, 'square', 0.04),
  // fim de uma linha de estatística
  contadorFim: (s) => {
    s.tom(988, 0.05, 'square', 0.08)
    s.tom(1318, 0.09, 'square', 0.08, 1318, 0.05)
  },
  // rufar curto antes do carimbo: batidas cada vez mais rápidas e fortes
  rufar: (s) => {
    let t = 0
    for (let i = 0; i < 14; i++) {
      s.ruido(0.04, 0.06 + i * 0.012, t, 1800)
      t += Math.max(0.018, 0.06 - i * 0.004)
    }
  },
  // carimbo da nota: pancada seca + estalo
  carimbo: (s) => {
    s.tom(90, 0.25, 'square', 0.3, 35)
    s.ruido(0.18, 0.35, 0, 1500)
    s.ruido(0.05, 0.25, 0, 8000)
  },
  // entrada do game over: ronco fundo que cresce e se arrasta
  abismo: (s) => {
    s.nota(55, 3.4, 'triangle', 0.26, 41, 0, 0.7)
    s.nota(27.5, 3.4, 'sine', 0.4, 22, 0, 0.9)
    s.nota(58.3, 3, 'triangle', 0.1, 43, 0.1, 0.9) // levemente desafinado: dá o "batimento" sinistro
    s.ruido(2.4, 0.07, 0, 260)
  },
  // letra do título caindo pesada no chão
  letraPesada: (s) => {
    s.tom(88, 0.32, 'square', 0.2, 30)
    s.ruido(0.24, 0.3, 0, 650)
    s.tom(176, 0.07, 'sawtooth', 0.07, 60)
  },
  // melodia curta e lenta em menor, descendo até repousar no grave
  lamento: (s) => {
    const notas = [330, 311, 294, 262, 247]
    notas.forEach((f, i) => s.nota(f, 0.9, 'triangle', 0.09, f, i * 0.52, 0.08))
    s.nota(220, 2.4, 'triangle', 0.1, 220, notas.length * 0.52, 0.1)
    s.nota(110, 4.6, 'sine', 0.16, 108, 0, 0.6)
    s.nota(165, 2.4, 'sine', 0.05, 164, notas.length * 0.52, 0.3)
  },
  // sino distante (toca de tempos em tempos enquanto a tela espera)
  sino: (s) => {
    s.tom(98, 2.8, 'sine', 0.16, 97)
    s.tom(247, 1.7, 'sine', 0.05, 246)
    s.tom(392, 0.9, 'sine', 0.025, 391)
  },
  // brilho extra quando a nota é S
  brilhoRank: (s) => [1318, 1568, 2093, 2637].forEach((f, i) => s.tom(f, 0.16, 'triangle', 0.07, f, 0.08 + i * 0.06)),
  // ---------- cartas ----------
  // carta saindo do monte: "fsst" curto subindo
  cartaComprar: (s) => {
    s.ruido(0.07, 0.16, 0, 5000)
    s.tom(700, 0.07, 'sine', 0.06, 1500)
  },
  // cursor passando de uma carta para outra: tique leve de papel
  cartaSelecionar: (s) => {
    s.ruido(0.025, 0.1, 0, 7000)
    s.tom(900, 0.035, 'triangle', 0.06, 1150)
  },
  // carta virando na mesa: estalo de papel + batidinha grave
  cartaVirar: (s) => {
    s.ruido(0.03, 0.22, 0, 8000)
    s.tom(320, 0.06, 'square', 0.05, 160)
    s.ruido(0.05, 0.1, 0.03, 1500)
  },
  // as duas cartas aparecendo: estalo + brilho subindo
  cartaRevelar: (s) => {
    s.ruido(0.035, 0.24, 0, 8000)
    ;[784, 1046, 1318].forEach((f, i) => s.tom(f, 0.16, 'triangle', 0.06, f * 1.01, 0.03 + i * 0.04))
  },
  // carta girando no ar: zumbido que sobe e corta o ar
  cartaArremessar: (s) => {
    s.ruido(0.28, 0.14, 0, 3000)
    s.tom(220, 0.26, 'sawtooth', 0.05, 900)
    s.tom(440, 0.2, 'triangle', 0.05, 1600, 0.04)
  },
  // carta se estilhaçando no alvo: pancada, vidro e cacos
  cartaImpacto: (s) => {
    s.ruido(0.06, 0.4, 0, 9000)
    s.ruido(0.3, 0.28, 0, 1200)
    s.tom(150, 0.3, 'square', 0.16, 40)
    s.tom(70, 0.4, 'sine', 0.35, 30)
    for (let i = 0; i < 6; i++) {
      const f = 2200 + Math.random() * 2000
      s.tom(f, 0.05 + Math.random() * 0.06, 'triangle', 0.04, f * 0.95, 0.04 + i * 0.035)
    }
  },
  // carta sumindo da mão: sopro curto descendo
  cartaDescartar: (s) => {
    s.ruido(0.12, 0.12, 0, 2500)
    s.tom(500, 0.12, 'sine', 0.05, 200)
  },
  // carta deslizando no feltro até a mesa / até a coluna entre as caixas
  cartaDeslizar: (s) => {
    s.ruido(0.18, 0.13, 0, 1800)
    s.ruido(0.05, 0.08, 0.13, 6000)
    s.tom(260, 0.16, 'triangle', 0.04, 380)
  },
  // ---------- PvP ----------
  // começo da rodada: gongo curto
  rodada: (s) => {
    s.tom(196, 0.7, 'sine', 0.22, 194)
    s.tom(392, 0.4, 'triangle', 0.07, 390)
    s.tom(588, 0.25, 'sine', 0.04, 585)
    s.ruido(0.05, 0.1, 0, 4000)
  },
  // energia recarregando (gemas acendendo)
  energia: (s) => [880, 1175, 1568].forEach((f, i) => s.tom(f, 0.09, 'triangle', 0.06, f * 1.03, i * 0.05)),
  // ficha do PASSAR caindo na mesa
  passar: (s) => {
    s.tom(1250, 0.05, 'square', 0.05, 1100)
    s.tom(1250, 0.05, 'square', 0.035, 1100, 0.07)
    s.ruido(0.04, 0.08, 0, 5000)
  },
  // caixa de esquiva abrindo / fechando
  caixaAbrir: (s) => {
    s.tom(160, 0.22, 'sawtooth', 0.07, 420)
    s.ruido(0.18, 0.06, 0.04, 2500)
  },
  caixaFechar: (s) => {
    s.tom(420, 0.2, 'sawtooth', 0.06, 140)
    s.ruido(0.1, 0.06, 0.08, 1200)
  },
  // controles invertidos: tom que sobe e desce, bem enjoado
  inverter: (s) => {
    s.tom(300, 0.18, 'square', 0.07, 900)
    s.tom(900, 0.22, 'square', 0.06, 250, 0.18)
    s.tom(450, 0.4, 'sine', 0.06, 470)
  },
  // escudo de copas segurando o golpe: brilho metálico
  escudo: (s) => {
    s.tom(1760, 0.35, 'triangle', 0.06, 1720)
    s.tom(2640, 0.25, 'sine', 0.04, 2600, 0.02)
    s.tom(220, 0.12, 'square', 0.08, 180)
    s.ruido(0.05, 0.12, 0, 9000)
  },
  // espelho rebatendo: vidro tinindo e um "uóóm" que volta
  espelho: (s) => {
    s.tom(2100, 0.3, 'sine', 0.06, 2080)
    s.tom(3150, 0.2, 'sine', 0.04, 3120, 0.03)
    s.tom(600, 0.25, 'triangle', 0.07, 1500, 0.04)
  },
  // carta roubada passando para a outra mão: assobio rápido
  roubo: (s) => {
    s.ruido(0.14, 0.12, 0, 4500)
    s.tom(500, 0.12, 'sine', 0.07, 1400)
    s.tom(1400, 0.08, 'sine', 0.05, 900, 0.12)
  },
  // ninguém atacou: dois tons murchos
  vazio: (s) => {
    s.tom(330, 0.12, 'triangle', 0.08, 300)
    s.tom(262, 0.22, 'triangle', 0.08, 240, 0.13)
  },
  // HP baixo: bipe de alarme
  hpBaixo: (s) => {
    s.tom(988, 0.08, 'square', 0.06)
    s.tom(784, 0.12, 'square', 0.06, 784, 0.1)
  },
  // morte súbita: tudo acelerou (sirene curta subindo + dois toques de alerta)
  acelerar: (s) => {
    s.tom(220, 0.5, 'sawtooth', 0.08, 880)
    s.tom(330, 0.5, 'square', 0.05, 1320, 0.02)
    s.tom(1320, 0.07, 'square', 0.07, 1320, 0.5)
    s.tom(1760, 0.12, 'square', 0.07, 1760, 0.6)
    s.ruido(0.3, 0.06, 0, 5000)
  },
  // CPU confirmando a carta (igual ao jogador, um pouco mais grave)
  cpu: (s) => s.tom(520, 0.07, 'square', 0.1, 780),
  // ---------- bonus rounds do PvP (pvp/bonus/) ----------
  // "BONUS ROUND!": estalo, arpejo subindo rapidinho e acorde maior com brilho
  bonusRound: (s) => {
    s.ruido(0.06, 0.2, 0, 7000)
    ;[523, 659, 784, 1046, 1318].forEach((f, i) => s.tom(f, 0.08, 'square', 0.07, f * 1.02, i * 0.055))
    for (const f of [784, 988, 1175, 1568]) s.tom(f, 0.6, 'square', 0.045, f * 1.004, 0.3)
    s.tom(196, 0.6, 'triangle', 0.14, 196, 0.3)
    s.ruido(0.4, 0.06, 0.3, 9000)
  },
  // tique da roleta girando: a bolinha batendo nas divisórias (toca muitas vezes)
  roleta: (s) => {
    s.tom(2300 + Math.random() * 400, 0.018, 'triangle', 0.08, 1500)
    s.tom(700 + Math.random() * 80, 0.02, 'square', 0.025, 500)
    s.ruido(0.012, 0.07, 0, 8000)
  },
  // roda de cassino girando (o giro todo): bolinha rolando + ronco da roda
  roletaGiro: (s, { duracao = 1.8 } = {}) => {
    s.rolamento(duracao, 0.1)
    s.nota(110, duracao, 'triangle', 0.05, 70, 0, 0.15)
  },
  // roleta parou no evento: a bolinha cai na casa (clac-clac) e "ding" com brilho
  roletaFim: (s) => {
    s.tom(2600, 0.02, 'triangle', 0.09, 1600)
    s.tom(2200, 0.02, 'triangle', 0.07, 1400, 0.06)
    s.ruido(0.015, 0.08, 0.06, 8000)
    s.tom(1318, 0.5, 'triangle', 0.1, 1316)
    s.tom(1976, 0.35, 'sine', 0.05, 1974, 0.01)
    s.tom(659, 0.1, 'square', 0.06, 659)
    s.ruido(0.04, 0.12, 0, 8000)
  },
  // explosão grande: estalo, baque fundo e rugido que se espalha
  explosaoGrande: (s) => {
    s.ruido(0.06, 0.35, 0, 9000)
    s.ruido(0.8, 0.35, 0, 900)
    s.tom(120, 0.6, 'sawtooth', 0.18, 30)
    s.tom(60, 0.8, 'sine', 0.4, 24)
    s.ruido(0.5, 0.1, 0.15, 350)
  },
  // língua de sogra + apito de festa
  festa: (s) => {
    s.tom(520, 0.28, 'sawtooth', 0.06, 760)
    s.tom(528, 0.28, 'square', 0.04, 770)
    s.tom(2200, 0.1, 'sine', 0.06, 2600, 0.3)
    s.tom(2600, 0.16, 'sine', 0.06, 2300, 0.4)
    s.ruido(0.25, 0.05, 0, 6000)
  },
  // mundo virando de ponta-cabeça: "fuuuum" varrendo
  virarMundo: (s) => {
    s.ruido(0.6, 0.12, 0, 2500)
    s.tom(160, 0.6, 'sawtooth', 0.06, 900)
    s.tom(900, 0.4, 'triangle', 0.05, 180, 0.25)
    s.nota(220, 0.7, 'sine', 0.08, 110, 0, 0.3)
  },
  // apagão: força caindo (zumbido elétrico descendo + estalo do disjuntor)
  apagao: (s) => {
    s.ruido(0.04, 0.3, 0, 7000)
    s.tom(440, 0.9, 'sawtooth', 0.08, 30)
    s.tom(120, 0.7, 'square', 0.05, 25, 0.05)
    s.tom(60, 0.4, 'sine', 0.2, 30, 0.02)
  },
  // gravidade mudou: tom bambo, sobe e desce, e assenta grave
  gravidade: (s) => {
    s.tom(300, 0.15, 'sine', 0.1, 520)
    s.tom(520, 0.15, 'sine', 0.1, 260, 0.15)
    s.tom(260, 0.15, 'sine', 0.1, 420, 0.3)
    s.tom(420, 0.3, 'sine', 0.1, 140, 0.45)
    s.tom(90, 0.3, 'triangle', 0.15, 50, 0.6)
  },
  // os dois trocaram de lugar: zíper rápido indo e voltando
  trocar: (s) => {
    s.tom(400, 0.12, 'square', 0.05, 1600)
    s.tom(1600, 0.12, 'square', 0.05, 400, 0.12)
    s.ruido(0.24, 0.08, 0, 4000)
  },
  // PC DA ESCOLA: o "tan-dan" de PC velho ligando, com chiado de cooler
  pcLigando: (s) => {
    s.ruido(0.5, 0.05, 0, 3000)
    ;[523, 784, 659, 1046].forEach((f, i) => s.nota(f, 0.5, 'triangle', 0.07, f, 0.1 + i * 0.13, 0.04))
  },
  // travou: o "dóin" de erro duas vezes e o HD engasgando
  travou: (s) => {
    s.tom(220, 0.16, 'square', 0.08, 220)
    s.tom(165, 0.22, 'square', 0.08, 165, 0.17)
    for (let i = 0; i < 6; i++) s.ruido(0.02, 0.06, 0.05 + i * 0.05, 1800)
  },
  // AQUÁRIO: tchibum na água + borbulhar
  tchibum: (s) => {
    s.ruido(0.5, 0.25, 0, 1400)
    s.tom(500, 0.25, 'sine', 0.12, 120)
    ;[0.2, 0.28, 0.33, 0.4].forEach((d, i) => s.tom(600 + i * 150, 0.06, 'sine', 0.06, 1200 + i * 200, d))
  },
  bolha: (s) => s.tom(400 + Math.random() * 300, 0.07, 'sine', 0.05, 1100 + Math.random() * 400),
  // COGUMELO MALUCO: subida (crescer) e descida (encolher) de videogame
  crescer: (s) => [262, 330, 392, 523, 659, 784].forEach((f, i) => s.tom(f, 0.07, 'square', 0.06, f, i * 0.05)),
  encolher: (s) => [784, 659, 523, 392, 330, 262].forEach((f, i) => s.tom(f * 1.5, 0.06, 'square', 0.06, f * 1.5, i * 0.045)),
  // DANÇA DA ESTÁTUA: alarme de vigia quando o holofote pega alguém se mexendo
  pego: (s) => {
    for (let i = 0; i < 3; i++) {
      s.tom(880, 0.14, 'square', 0.07, 880, i * 0.28)
      s.tom(660, 0.14, 'square', 0.07, 660, i * 0.28 + 0.14)
    }
    s.tom(110, 0.35, 'sawtooth', 0.12, 80)
  },
  // PISTA DE GELO: cristais tilintando / patins raspando
  congelar: (s) => [1760, 2093, 2637, 3136].forEach((f, i) => s.tom(f, 0.3, 'sine', 0.05, f * 0.98, i * 0.06)),
  patins: (s) => s.ruido(0.22, 0.07, 0, 7000),
  // TERREMOTO: ronco grave (aviso) e o tremor com pedras
  ronco: (s) => s.nota(45, 0.7, 'sawtooth', 0.12, 38, 0, 0.3),
  terremoto: (s) => {
    s.ruido(0.9, 0.3, 0, 400)
    s.tom(55, 0.8, 'sawtooth', 0.15, 30)
    ;[0.15, 0.3, 0.42].forEach((d) => s.ruido(0.06, 0.15, d, 2500))
  },
  // carta maluca: "boing" de desenho animado
  maluca: (s) => {
    s.tom(180, 0.4, 'triangle', 0.14, 520)
    s.tom(360, 0.4, 'sine', 0.05, 1040)
    for (let i = 0; i < 4; i++) s.tom(500 - i * 40, 0.07, 'sine', 0.06 - i * 0.01, 620 - i * 40, 0.1 + i * 0.07)
  },
  // tiro: "pew"
  tiro: (s) => {
    s.tom(1500, 0.11, 'square', 0.05, 300)
    s.ruido(0.03, 0.08, 0, 6000)
  },
  // espadada: corte no ar
  espadada: (s) => {
    s.ruido(0.14, 0.18, 0, 5000)
    s.tom(900, 0.12, 'sawtooth', 0.04, 2200)
    s.tom(2600, 0.08, 'sine', 0.03, 2400, 0.06)
  },
  // bumerangue girando: zumbido que pulsa
  bumerangue: (s) => {
    for (let i = 0; i < 5; i++) {
      s.tom(260 + i * 20, 0.07, 'triangle', 0.06, 420 + i * 20, i * 0.07)
      s.ruido(0.05, 0.05, i * 0.07, 2500)
    }
  },
  // pavio queimando: chiado com estalinhos
  pavio: (s) => {
    s.ruido(0.5, 0.06, 0, 7000)
    for (let i = 0; i < 4; i++) s.ruido(0.02, 0.1, 0.05 + i * 0.1 + Math.random() * 0.04, 9000)
  },
  // duelo: choque de lâminas e gongo dramático
  duelo: (s) => {
    s.ruido(0.05, 0.3, 0, 9000)
    s.tom(2400, 0.3, 'triangle', 0.06, 2350)
    s.tom(3600, 0.2, 'sine', 0.04, 3550)
    s.tom(110, 1.4, 'sine', 0.26, 108, 0.05)
    s.tom(220, 1.0, 'triangle', 0.08, 218, 0.05)
    s.tom(331, 0.6, 'sine', 0.04, 329, 0.05)
    s.ruido(0.4, 0.08, 0.05, 1500)
  },
  // carta SUPER: impacto dramático e uma subida que cresce (~1,2 s)
  superAtivar: (s) => {
    s.ruido(0.07, 0.4, 0, 9000)
    s.tom(98, 0.7, 'sawtooth', 0.22, 30)
    s.tom(49, 1.0, 'sine', 0.45, 24)
    s.ruido(0.6, 0.3, 0, 800)
    s.nota(160, 1.0, 'sawtooth', 0.07, 1800, 0.2, 0.7)
    s.nota(240, 1.0, 'square', 0.04, 2400, 0.2, 0.7)
    s.nota(320, 0.95, 'triangle', 0.06, 3200, 0.25, 0.65)
    s.ruido(0.25, 0.12, 0.95, 7000)
  },
  // corte rápido da SUPER (whoosh + lâmina)
  superCorte: (s) => {
    s.ruido(0.18, 0.28, 0, 6000)
    s.tom(1600, 0.16, 'sawtooth', 0.06, 300)
    s.tom(3000, 0.07, 'sine', 0.05, 2600, 0.05)
    s.tom(120, 0.12, 'square', 0.1, 50, 0.04)
  },
}
