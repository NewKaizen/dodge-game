import { ASSETS } from './assets.js'
import { AUDIO } from './constants.js'
import { tocarMidi, pararMidi, pausarMidi, retomarMidi, setVolumeMidi, distorcerMidi, setVelocidadeMidi, setGraveMidi, tempoMidi, existeMidi, estadoMidi } from './midi.js'

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
let abafo = 1 // abaixarMusica(): fração do volume da música enquanto algo importante toca
let rampaAbafo = null
let nomeMusica = null // nome (musica(scene, nome)) da música pedida por último
let guardada = null // tocarMusicaEspecial(): a música que estava tocando, para voltar depois
let especial = null // { nome, som? } música especial tocando agora (som = Phaser, se não for .mid)
let pedidoEspecial = 0 // descarta tocarMusicaEspecial que ainda estava conferindo o arquivo
const continuos = new Set() // somContinuo() tocando (setSomLigado(false) para todos)

export function setVolumes(musica, efeitos) {
  // o store muda a todo instante (joystick): só age quando o volume mudou de verdade
  if (musica === volumes.musica && efeitos === volumes.efeitos) return
  volumes.musica = musica
  volumes.efeitos = efeitos
  setVolumeMidi(musica * abafo)
  musicaAtual?.setVolume(AUDIO.volume * musica * abafo)
}

// Abaixa a música (fator 0..1 do volume normal) numa rampa curta, ex.: a
// roleta do bonus round; restaurarMusica() volta ao normal. Vale para .mid e
// .ogg/.mp3 e respeita o slider do painel.
export function abaixarMusica(fator = 0.35, ms = 250) {
  rampaVolume(Math.max(0, Math.min(1, fator)), ms)
}

export function restaurarMusica(ms = 400) {
  rampaVolume(1, ms)
}

function rampaVolume(alvo, ms) {
  clearInterval(rampaAbafo)
  rampaAbafo = null
  abafo = alvo
  setVolumeMidi(volumes.musica * abafo) // o midi já faz a rampa (setTargetAtTime)
  const som = musicaAtual
  if (!som) return
  const de = som.volume
  const para = AUDIO.volume * volumes.musica * abafo
  const inicio = performance.now()
  rampaAbafo = setInterval(() => {
    const p = Math.min(1, (performance.now() - inicio) / Math.max(1, ms))
    if (som === musicaAtual) som.setVolume(de + (para - de) * p)
    if (p >= 1 || som !== musicaAtual) {
      clearInterval(rampaAbafo)
      rampaAbafo = null
    }
  }, 30)
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
  if (scene.cache.audio.exists(chave)) { // ASSETS.sons ou os sons dos SUPERs (pvp/super/sprites/)
    scene.sound.play(chave, { volume: AUDIO.volume * volumes.efeitos })
    return
  }
  const c = obterContexto()
  if (c) SINTESE[nome]?.(sintetizador(c), opcoes ?? {})
}

// reserva: outra música para tocar se `nome` não existir (ex.: 'pvp' cai na
// 'jevil' enquanto não houver pvp.mid em public/assets/musicas/)
let pedidoMusica = 0
export function musica(scene, nome, reserva) {
  const pedido = ++pedidoMusica
  esquecerEspecial() // outra música pedida: a especial (e o que ela guardou) perdeu a vez
  nomeMusica = nome
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
  musicaAtual = scene.sound.add(chave, { loop: true, volume: AUDIO.volume * volumes.musica * abafo, rate: andamento })
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
  esquecerEspecial()
  pararMidi()
  musicaAtual?.stop()
  musicaAtual?.destroy()
  musicaAtual = null
}

// ---------- música especial (carta SUPER) ----------
// tocarMusicaEspecial(scene, nome): se assets/musicas/<nome>.mid existir (ou
// ASSETS.musicas[nome]), guarda a música que estava tocando (nome e segundo
// onde parou), para ela e toca a especial em loop. Sem o arquivo não faz
// NADA (a música de batalha continua) e devolve false.
// voltarMusicaNormal(scene): volta a guardada do ponto onde parou, com
// fade-in. Sem nada guardado, não faz nada.
// O andamento da morte súbita (velocidadeMusica) e o abafo (abaixarMusica)
// continuam valendo para a especial e para a volta.
export async function tocarMusicaEspecial(scene, nome) {
  if (!ligado) return false
  const meu = ++pedidoEspecial
  const arquivo = ASSETS.musicas[nome] ?? `assets/musicas/${nome}.mid`
  const ehMidi = /\.midi?$/i.test(arquivo)
  const chave = `musica-${nome}`
  if (ehMidi ? !(await existeMidi(arquivo)) : !scene.cache.audio.exists(chave)) return false
  // voltarMusicaNormal/musica()/pararMusica() no meio da conferência: desiste
  if (meu !== pedidoEspecial || !ligado) return false
  const c = obterContexto()
  if (ehMidi && !c) return false

  // guarda o que estava tocando (só se ainda não há nada guardado: a 2ª
  // especial seguida não pode guardar a 1ª como "música normal")
  if (!guardada) {
    if (musicaAtual) {
      if (musicaAtual.isPlaying) musicaAtual.pause()
      guardada = { tipo: 'arquivo', nome: nomeMusica, som: musicaAtual }
      musicaAtual = null // musica()/pararMusica() não destroem o som guardado
    } else {
      const { tocando } = estadoMidi()
      guardada = tocando ? { tipo: 'midi', nome: nomeMusica, arquivo: tocando, tempo: tempoMidi() } : { tipo: 'nada', nome: nomeMusica }
    }
  }
  pararEspecialArquivo()
  pedidoMusica++ // uma reserva atrasada de musica() não atropela a especial
  if (ehMidi) {
    especial = { nome }
    tocarMidi(c, arquivo)
  } else {
    pararMidi()
    const som = scene.sound.add(chave, { loop: true, volume: AUDIO.volume * volumes.musica * abafo, rate: andamento })
    especial = { nome, som }
    musicaAtual = som // slider, abafo, andamento e pause valem para ela
    som.play()
  }
  return true
}

export function voltarMusicaNormal(scene) {
  pedidoEspecial++ // cancela uma tocarMusicaEspecial ainda conferindo o arquivo
  const g = guardada
  if (!g) return
  guardada = null
  pararEspecialArquivo()
  especial = null
  nomeMusica = g.nome
  pedidoMusica++
  if (!ligado) {
    if (g.tipo === 'arquivo') g.som.destroy()
    return
  }
  if (g.tipo === 'midi') {
    const c = obterContexto()
    if (c) tocarMidi(c, g.arquivo, { inicio: g.tempo }) // tocarMidi já entra em fade-in
    else pararMidi()
    return
  }
  pararMidi()
  if (g.tipo === 'arquivo') {
    // o som do Phaser pode ter morrido junto com a cena
    if (!g.som.manager || g.som.pendingRemove) return
    musicaAtual = g.som
    const para = AUDIO.volume * volumes.musica * abafo
    g.som.setVolume(0)
    g.som.setRate(andamento)
    if (g.som.isPaused) g.som.resume()
    else g.som.play()
    const som = g.som
    const inicio = performance.now()
    const passo = setInterval(() => {
      const p = Math.min(1, (performance.now() - inicio) / 400)
      if (som === musicaAtual) som.setVolume(para * p)
      if (p >= 1 || som !== musicaAtual) clearInterval(passo)
    }, 30)
  }
  // 'nada': não havia música; a especial já parou
}

// para a especial tocada como arquivo do Phaser (a .mid é trocada direto pelo tocarMidi)
function pararEspecialArquivo() {
  const som = especial?.som
  if (!som) return
  if (musicaAtual === som) musicaAtual = null
  som.stop()
  som.destroy()
  especial = { nome: especial.nome }
}

// musica()/pararMusica(): esquece a especial e solta o que ela guardou
function esquecerEspecial() {
  pedidoEspecial++
  if (guardada?.tipo === 'arquivo') {
    guardada.som.stop()
    guardada.som.destroy()
  }
  guardada = null
  especial = null
}

// Realce de graves na música .mid (dB num lowshelf de ~180 Hz; 0 = normal),
// ex.: o MODO FESTA. Fica valendo até alguém pedir 0. (Música em .ogg/.mp3 não muda.)
export function reforcarGrave(db = 0, ms = 400) {
  setGraveMidi(db, ms)
}

// ---------- sons contínuos (loop até parar) ----------
// somContinuo(scene, nome) -> { parar(ms = 400) }. Sintetizado, volume dos
// efeitos, entra e sai em fade. Nomes: 'chuva'. Som desligado (ou nome
// desconhecido): devolve um { parar() {} } que não faz nada.
export function somContinuo(scene, nome) {
  const nada = { parar() {} }
  if (!ligado) return nada
  // com arquivo próprio (ASSETS.sons[nome]): toca o arquivo em loop
  if (ASSETS.sons[nome] && scene.cache.audio.exists(`som-${nome}`)) return somContinuoArquivo(scene, nome)
  if (!CONTINUOS[nome]) return nada
  const c = obterContexto()
  if (!c) return nada
  const saida = c.createGain()
  saida.gain.setValueAtTime(0.0001, c.currentTime)
  saida.gain.linearRampToValueAtTime(AUDIO.volume * volumes.efeitos, c.currentTime + 0.6)
  saida.connect(c.destination)
  const desfazer = CONTINUOS[nome](c, saida)
  let parado = false
  const controle = {
    parar(ms = 400) {
      if (parado) return
      parado = true
      continuos.delete(controle)
      const t = c.currentTime
      const s = Math.max(0.01, ms / 1000)
      saida.gain.cancelScheduledValues(t)
      saida.gain.setValueAtTime(saida.gain.value, t)
      saida.gain.linearRampToValueAtTime(0, t + s)
      setTimeout(() => {
        desfazer()
        saida.disconnect()
      }, s * 1000 + 60)
    },
  }
  continuos.add(controle)
  return controle
}

// somContinuo com arquivo (som do Phaser em loop), fade de entrada e de saída
function somContinuoArquivo(scene, nome) {
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

// buffer de ruído branco em loop (n segundos)
function bufferRuido(c, s = 2) {
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * s), c.sampleRate)
  const dados = buffer.getChannelData(0)
  for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1
  return buffer
}

// Cada som contínuo: (contexto, saida) => função que desliga tudo
const CONTINUOS = {
  // chuva: chiado agudo filtrado + ronco grave (ruído em loop, com um
  // "vento" lento no volume) e gotinhas aleatórias batendo
  chuva: (c, saida) => {
    const fontes = []
    const camada = (tipo, freq, q, vol) => {
      const f = c.createBufferSource()
      f.buffer = bufferRuido(c, 2 + Math.random())
      f.loop = true
      const filtro = c.createBiquadFilter()
      filtro.type = tipo
      filtro.frequency.value = freq
      filtro.Q.value = q
      const g = c.createGain()
      g.gain.value = vol
      f.connect(filtro).connect(g).connect(saida)
      f.start()
      fontes.push(f)
      return g
    }
    camada('bandpass', 5200, 0.6, 0.22) // chiado agudo
    camada('highpass', 9000, 0.7, 0.08) // brilho fino das gotas no chão
    const ronco = camada('lowpass', 380, 0.8, 0.5) // ronco grave
    // "vento": o ronco sobe e desce devagar
    const lfo = c.createOscillator()
    lfo.frequency.value = 0.13
    const fundo = c.createGain()
    fundo.gain.value = 0.18
    lfo.connect(fundo).connect(ronco.gain)
    lfo.start()
    fontes.push(lfo)
    // gotinhas: estalinho curto (tom agudo caindo + clique de ruído)
    const clique = bufferRuido(c, 0.03)
    const gota = () => {
      const t = c.currentTime + Math.random() * 0.05
      const freq = 1800 + Math.random() * 2600
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'sine'
      o.frequency.setValueAtTime(freq, t)
      o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.04)
      const vol = 0.012 + Math.random() * 0.03
      g.gain.setValueAtTime(vol, t)
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.05)
      o.connect(g).connect(saida)
      o.start(t)
      o.stop(t + 0.06)
      const r = c.createBufferSource()
      r.buffer = clique
      const rg = c.createGain()
      rg.gain.setValueAtTime(vol * 1.5, t)
      rg.gain.exponentialRampToValueAtTime(0.0005, t + 0.025)
      r.connect(rg).connect(saida)
      r.start(t)
    }
    const intervalo = setInterval(() => {
      const n = Math.random() < 0.6 ? 1 : Math.random() < 0.7 ? 2 : 0
      for (let i = 0; i < n; i++) gota()
    }, 45)
    return () => {
      clearInterval(intervalo)
      for (const f of fontes) {
        try {
          f.stop()
        } catch {
          // já parado
        }
      }
    }
  },
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
  // trovão (APAGÃO): estalo seco e um ronco grave longo que rola e some (~2,5 s)
  trovao: (s) => {
    s.ruido(0.05, 0.45, 0, 9000)
    s.ruido(0.18, 0.35, 0.02, 2500)
    s.ruido(2.5, 0.42, 0.05, 260)
    s.nota(42, 2.4, 'sine', 0.32, 28, 0.04, 0.12)
    s.nota(63, 1.8, 'triangle', 0.08, 40, 0.1, 0.3)
    // o ronco "rola" em ondas
    for (let i = 0; i < 5; i++) s.ruido(0.5 + Math.random() * 0.4, 0.14 + Math.random() * 0.12, 0.25 + i * 0.35 + Math.random() * 0.15, 420)
  },
  // DESVIO PERFEITO: plateia batendo palmas (~1,6 s) e um "uhuu" subindo
  aplausos: (s) => {
    for (let i = 0; i < 46; i++) {
      const t = Math.random() * 1.45 * Math.sqrt(Math.random()) // mais palmas no começo
      s.ruido(0.022 + Math.random() * 0.02, 0.25 + Math.random() * 0.2, t, 3500 + Math.random() * 5000) // mais alto: o sintetizado sumia embaixo da música
    }
    s.nota(300, 0.55, 'sawtooth', 0.035, 620, 0.12, 0.08)
    s.nota(450, 0.5, 'triangle', 0.05, 900, 0.14, 0.08)
    s.nota(620, 0.4, 'sine', 0.04, 560, 0.62, 0.05)
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
