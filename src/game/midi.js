import { WorkletSynthesizer, Sequencer } from 'spessasynth_lib'
import { AUDIO } from './constants.js'

// Músicas em MIDI tocadas com soundfont (instrumentos General MIDI de verdade).
//
// Como funciona: um sintetizador SF2/SF3 (spessasynth_lib) roda num
// AudioWorklet; o soundfont é baixado UMA vez (na primeira música) e cada
// .mid é lido e tocado em loop pelo sequenciador.
//
// Arquivos (em public/):
//   assets/audio/soundfont.sf3                    banco de instrumentos (GeneralUser GS em SF3, ver SOUNDFONT-LICENCA.txt)
//   assets/audio/spessasynth_processor.min.js     processador do AudioWorklet (mesma versão da lib!)
//   assets/musicas/<nome>.mid                     as músicas (ver ASSETS.musicas em assets.js)

const SOUNDFONT = 'assets/audio/soundfont.sf3'
const PROCESSADOR = 'assets/audio/spessasynth_processor.min.js'
const FADE_S = 0.35
const GRAVE_HZ = 180 // realce de graves (setGraveMidi): lowshelf abaixo daqui

let preparo = null // Promise do sintetizador pronto (uma vez só)
let motor = null // { ctx, synth, seq, ganho, grave }
let atual = null // url da música tocando
let pedido = 0 // descarta pedidos antigos quando a música muda no meio do carregamento
const arquivos = new Map() // url -> Promise<ArrayBuffer | null>
let pausada = false // menu de pause aberto (pausarMidi)
let volume = 1 // slider "volume da música" (0 a 1)
let velocidade = 1 // andamento pedido pelo jogo (setVelocidadeMidi): sobrevive à troca de música
let rampa = null // setInterval da rampa de andamento em andamento
let graveDb = 0 // realce de graves pedido (setGraveMidi): sobrevive à troca de música

const alvo = () => AUDIO.volume * AUDIO.musica * volume

// Slider do painel: muda o volume na hora (suave, sem estalo)
export function setVolumeMidi(v) {
  volume = v
  if (!motor || !atual || pausada) return
  const t = motor.ctx.currentTime
  motor.ganho.gain.cancelScheduledValues(t)
  motor.ganho.gain.setTargetAtTime(alvo(), t, 0.05)
}

// Andamento da música (1 = normal; 1.24 = 24% mais rápida), para a "morte
// súbita" das partidas longas. Muda numa rampa curta (sem tranco) e fica
// valendo para as próximas músicas, até alguém pedir 1 de novo (as cenas voltam para 1 ao sair).
export function setVelocidadeMidi(fator, ms = 600) {
  velocidade = Math.max(0.25, Math.min(4, Number(fator) || 1))
  clearInterval(rampa)
  rampa = null
  // sem música: só guarda
  if (!motor || !atual) return
  const seq = motor.seq
  const de = seq.playbackRate
  const para = velocidade
  if (!ms || Math.abs(para - de) < 0.001) {
    seq.playbackRate = para
    return
  }
  const inicio = performance.now()
  rampa = setInterval(() => {
    const p = Math.min(1, (performance.now() - inicio) / ms)
    // a música parou no meio: não mexe mais no andamento
    if (atual) seq.playbackRate = de + (para - de) * p
    if (p >= 1) {
      clearInterval(rampa)
      rampa = null
    }
  }, 30)
}

// Realce de graves (dB no lowshelf de ~180 Hz; 0 = normal), ex.: o MODO FESTA
// "batendo" mais forte. Rampa suave; fica valendo para as próximas músicas
// até alguém pedir 0.
export function setGraveMidi(db = 0, ms = 400) {
  graveDb = Math.max(-24, Math.min(24, Number(db) || 0))
  if (!motor) return // preparar() já cria o filtro com graveDb
  const g = motor.grave.gain
  const t = motor.ctx.currentTime
  g.cancelScheduledValues(t)
  g.setValueAtTime(g.value, t)
  g.linearRampToValueAtTime(graveDb, t + Math.max(0.01, ms / 1000))
}

// Segundo atual (posição na música) do sequenciador; 0 sem música
export function tempoMidi() {
  if (!motor || !atual) return 0
  const tempo = motor.seq.currentTime || 0
  const duracao = motor.seq.midiData?.duration ?? motor.seq.duration
  return duracao > 0 ? tempo % duracao : tempo // depois de dar a volta no loop
}

// O .mid existe? (usa o mesmo cache de baixar(): não baixa duas vezes)
export async function existeMidi(url) {
  return !!(await baixar(url))
}

function preparar(ctx) {
  preparo ??= (async () => {
    await ctx.audioWorklet.addModule(PROCESSADOR)
    const synth = new WorkletSynthesizer(ctx)
    const ganho = ctx.createGain()
    ganho.gain.value = 0
    // synth -> grave (lowshelf) -> ganho -> saída
    const grave = ctx.createBiquadFilter()
    grave.type = 'lowshelf'
    grave.frequency.value = GRAVE_HZ
    grave.gain.value = graveDb
    synth.connect(grave)
    grave.connect(ganho)
    ganho.connect(ctx.destination)
    const banco = await (await fetch(SOUNDFONT)).arrayBuffer()
    await synth.soundBankManager.addSoundBank(banco, 'principal')
    await synth.isReady
    const seq = new Sequencer(synth)
    motor = { ctx, synth, seq, ganho, grave }
    return motor
  })().catch((erro) => {
    console.warn('[música] não deu para iniciar o MIDI:', erro)
    preparo = null
    return null
  })
  return preparo
}

// Baixa o .mid (com cache). null se o arquivo não existe.
function baixar(url) {
  if (!arquivos.has(url)) {
    arquivos.set(
      url,
      fetch(url)
        .then((r) => (r.ok && !(r.headers.get('content-type') ?? '').includes('text/html') ? r.arrayBuffer() : null))
        .catch(() => null),
    )
  }
  return arquivos.get(url)
}

// O navegador só libera som depois de um clique/tecla: se o contexto estiver
// suspenso, tenta de novo no próximo gesto
function destravar(ctx) {
  if (ctx.state !== 'suspended') return
  ctx.resume()
  const tentar = () => {
    ctx.resume()
    window.removeEventListener('pointerdown', tentar)
    window.removeEventListener('keydown', tentar)
  }
  window.addEventListener('pointerdown', tentar)
  window.addEventListener('keydown', tentar)
}

// Toca `url` em loop (se já estiver tocando, não reinicia).
// opcoes.inicio: começa desse segundo (ex.: voltar a música de batalha de onde parou)
// Devolve false se o arquivo não existe.
export async function tocarMidi(ctx, url, { inicio = 0 } = {}) {
  if (atual === url) return true
  pararMidi() // fade da anterior (incrementa `pedido`)
  const meu = ++pedido // este pedido; o incremento também cancela a pausa agendada pelo fade
  destravar(ctx)
  // só liga o sintetizador (e baixa o soundfont) se a música existir
  const dados = await baixar(url)
  if (!dados) {
    console.warn(`[música] ${url} não encontrado (ou não é um .mid válido): tocando nada`)
    return false
  }
  const m = await preparar(ctx)
  if (!m || meu !== pedido) return true
  if (ctx.state !== 'running') console.warn(`[música] ${url} pronto, mas o navegador ainda bloqueia o som: clique ou aperte uma tecla na página`)
  console.info(`[música] tocando ${url}`)
  m.seq.loadNewSongList([{ binary: dados.slice(0), fileName: url.split('/').pop() }])
  m.seq.loopCount = Infinity // loop infinito (a doc da lib fala em -1, mas o motor só repete com Infinity)
  m.seq.playbackRate = velocidade // andamento da morte súbita (setVelocidadeMidi)
  m.seq.play()
  if (inicio > 0) m.seq.currentTime = inicio // a mensagem vai na fila depois do play: pula para o ponto
  const t = m.ctx.currentTime
  m.ganho.gain.cancelScheduledValues(t)
  m.ganho.gain.setValueAtTime(0, t)
  m.ganho.gain.linearRampToValueAtTime(alvo(), t + FADE_S)
  atual = url
  return true
}

// Pause do jogo: congela a música onde está (e abafa rápido); retomarMidi continua do mesmo ponto
export function pausarMidi() {
  if (!motor || !atual || pausada) return
  pausada = true
  const { ctx, seq, synth, ganho } = motor
  const t = ctx.currentTime
  ganho.gain.cancelScheduledValues(t)
  ganho.gain.setValueAtTime(ganho.gain.value, t)
  ganho.gain.linearRampToValueAtTime(0, t + 0.08)
  setTimeout(() => {
    if (!pausada) return
    seq.pause()
    synth.stopAll(true)
  }, 100)
}

export function retomarMidi() {
  if (!motor || !pausada) return
  pausada = false
  if (!atual) return
  const { ctx, seq, ganho } = motor
  seq.play()
  const t = ctx.currentTime
  ganho.gain.cancelScheduledValues(t)
  ganho.gain.setValueAtTime(0, t)
  ganho.gain.linearRampToValueAtTime(alvo(), t + 0.25)
}

export function pararMidi() {
  pausada = false
  pedido++
  atual = null
  if (!motor) return
  const { ctx, seq, synth, ganho } = motor
  const t = ctx.currentTime
  ganho.gain.cancelScheduledValues(t)
  ganho.gain.setValueAtTime(ganho.gain.value, t)
  ganho.gain.linearRampToValueAtTime(0, t + FADE_S)
  const tocando = pedido
  setTimeout(() => {
    if (pedido !== tocando) return // outra música já começou
    seq.pause()
    synth.stopAll(true)
  }, FADE_S * 1000 + 30)
}

// Diagnóstico (debugJogo.musica()): o que está tocando e em que segundo
export function estadoMidi() {
  return { tocando: atual, velocidade, tempo: motor ? Math.round(motor.seq.currentTime * 10) / 10 : null, contexto: motor?.ctx.state ?? null }
}
