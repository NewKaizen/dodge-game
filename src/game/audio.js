import { ASSETS } from './assets.js'
import { AUDIO } from './constants.js'
import { tocarMidi, pararMidi, pausarMidi, retomarMidi, setVolumeMidi, distorcerMidi, setVelocidadeMidi } from './midi.js'

// Sons: se assets.js tiver um arquivo, toca o arquivo; senão sintetiza com WebAudio.
// Músicas: arquivo .mid toca com soundfont (midi.js); .ogg/.mp3 tocam direto.
// Sem nada em assets.js, procura public/assets/musicas/<nome>.mid; não
// achou, silêncio.

let contexto = null
let ligado = true
let musicaAtual = null
// multiplicadores dos sliders do painel (0 a 1), em cima de AUDIO.volume
const volumes = { musica: 1, efeitos: 1 }
let andamento = 1 // velocidade da música (velocidadeMusica)

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

// reserva: outra música para tocar se `nome` não existir (ex.: 'pvp' cai na
// 'jevil' enquanto não houver pvp.mid em public/assets/musicas/)
let pedidoMusica = 0
export function musica(scene, nome, reserva) {
  const pedido = ++pedidoMusica
  const arquivo = ASSETS.musicas[nome] ?? `assets/musicas/${nome}.mid`
  if (/\.midi?$/i.test(arquivo)) {
    musicaAtual?.stop()
    musicaAtual?.destroy()
    musicaAtual = null
    const c = obterContexto()
    if (!ligado || !c) return pararMidi()
    tocarMidi(c, arquivo).then((ok) => {
      // só cai na reserva se ninguém pediu outra música nesse meio tempo
      if (!ok && reserva && reserva !== nome && pedido === pedidoMusica) musica(scene, reserva)
    })
    return
  }
  const chave = `musica-${nome}`
  if (musicaAtual?.key === chave && musicaAtual.isPlaying) return
  pararMusica()
  if (!ligado || !ASSETS.musicas[nome] || !scene.cache.audio.exists(chave)) return reserva && reserva !== nome ? musica(scene, reserva) : undefined
  musicaAtual = scene.sound.add(chave, { loop: true, volume: AUDIO.volume * volumes.musica, rate: andamento })
  musicaAtual.play()
}

// Andamento da música (1 = normal), para a morte súbita das partidas longas
// (ACELERACAO em constants.js). Vale para a música atual e as próximas, até
// pedirem 1 de novo: as cenas que aceleram voltam para 1 ao começar e ao sair.
// .mid acelera sem mudar o tom; .ogg/.mp3 (rate do Phaser) sobe o tom junto.
export function velocidadeMusica(fator = 1) {
  andamento = fator
  setVelocidadeMidi(fator)
  if (musicaAtual?.isPlaying || musicaAtual?.isPaused) musicaAtual.setRate(fator)
}

// Menu de pause: congela a música e continua do mesmo ponto depois
export function pausarMusica() {
  pausarMidi()
  if (musicaAtual?.isPlaying) musicaAtual.pause()
}

export function retomarMusica() {
  retomarMidi()
  if (musicaAtual?.isPaused) musicaAtual.resume()
}

export function pararMusica() {
  pararMidi()
  musicaAtual?.stop()
  musicaAtual?.destroy()
  musicaAtual = null
}

// Fim de luta: distorce a música tocando (fita perdendo força, filtro
// fechando) e para. Serve para .mid (midi.js) e .ogg/.mp3 (rate + detune do
// Phaser). Sem música tocando, resolve na hora.
//   opcoes.suave    chefe poupado: cai menos e termina em fade, sem estalo
//   opcoes.sombrio  party derrotada: despenca muito, abafa e some, sem estalo
// Devolve Promise<boolean> (true se havia música); aceita também um callback.
export function distorcerEParar(ms = 1600, opcoes = {}, aoTerminar) {
  const estalo = () => {
    const c = ligado && obterContexto()
    if (c) SINTESE.estalo(sintetizador(c))
  }
  const promessa = musicaAtual ? distorcerArquivo(ms, opcoes, estalo) : distorcerMidi(ms, { ...opcoes, aoCortar: estalo })
  if (aoTerminar) promessa.then(aoTerminar)
  return promessa
}

// Versão para música em arquivo (som do Phaser)
function distorcerArquivo(ms, { suave = false, sombrio = false }, estalo) {
  const som = musicaAtual
  musicaAtual = null // a próxima musica() começa limpa (outro objeto de som)
  if (!som.isPlaying) {
    som.destroy()
    return Promise.resolve(false)
  }
  const volume = som.volume
  const cfg = sombrio ? { ritmo: 0.85, cents: -2400 } : suave ? { ritmo: 0.4, cents: -300 } : { ritmo: 0.75, cents: -900 }
  return new Promise((resolver) => {
    const inicio = performance.now()
    const passo = setInterval(() => {
      const p = Math.min(1, (performance.now() - inicio) / ms)
      som.setRate(Math.max(0.1, 1 - cfg.ritmo * p ** 1.4))
      som.setDetune(cfg.cents * p ** 2 + Math.sin(p * 38) * 35 * p)
      if (suave) som.setVolume(volume * (1 - p))
      if (sombrio) som.setVolume(volume * Math.min(1, (1 - p) / 0.55))
      if (p < 1) return
      clearInterval(passo)
      som.stop()
      som.destroy()
      if (!suave && !sombrio) estalo()
      resolver(true)
    }, 30)
  })
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
  // ---------- derrota e game over ----------
  // batida fraca do coração (tum-tum grave)
  batimento: (s) => {
    s.tom(64, 0.2, 'sine', 0.5, 38)
    s.tom(56, 0.24, 'sine', 0.36, 34, 0.21)
    s.ruido(0.1, 0.06, 0, 220)
  },
  // o coração trincando: estalo agudo, lascas e um gemido grave por baixo
  trincar: (s) => {
    s.ruido(0.05, 0.36, 0, 8000)
    s.tom(2300, 0.04, 'square', 0.06, 700)
    s.ruido(0.04, 0.22, 0.055, 6000)
    s.ruido(0.03, 0.16, 0.12, 7500)
    s.tom(150, 0.32, 'sawtooth', 0.12, 55)
  },
  // o coração se partindo: estouro de vidro, baque fundo e cacos tilintando
  estilhacar: (s) => {
    s.ruido(0.09, 0.45, 0, 9000)
    s.ruido(0.55, 0.26, 0, 1400)
    s.tom(96, 0.55, 'sine', 0.45, 28)
    s.tom(190, 0.18, 'square', 0.1, 50)
    for (let i = 0; i < 11; i++) {
      const f = 2100 + Math.random() * 2400
      s.tom(f, 0.05 + Math.random() * 0.08, 'triangle', 0.05, f * 0.96, 0.05 + i * 0.045 + Math.random() * 0.03)
    }
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
}
