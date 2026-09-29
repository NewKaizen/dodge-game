import { WorkletSynthesizer, Sequencer } from 'spessasynth_lib'
import { AUDIO } from './constants.js'

// Músicas em MIDI tocadas com soundfont (instrumentos General MIDI de verdade).
//
// Como funciona: um sintetizador SF2/SF3 (spessasynth_lib) roda num
// AudioWorklet; o soundfont é baixado UMA vez (na primeira música) e cada
// .mid é lido e tocado em loop pelo sequenciador.
//
// Arquivos (em public/):
//   assets/audio/soundfont.sf3                    banco de instrumentos (FluidR3 Mono GM, licença MIT)
//   assets/audio/spessasynth_processor.min.js     processador do AudioWorklet (mesma versão da lib!)
//   assets/musicas/<nome>.mid                     as músicas (ver ASSETS.musicas em assets.js)

const SOUNDFONT = 'assets/audio/soundfont.sf3'
const PROCESSADOR = 'assets/audio/spessasynth_processor.min.js'
const FADE_S = 0.35

let preparo = null // Promise do sintetizador pronto (uma vez só)
let motor = null // { ctx, synth, seq, ganho }
let atual = null // url da música tocando
let pedido = 0 // descarta pedidos antigos quando a música muda no meio do carregamento
const arquivos = new Map() // url -> Promise<ArrayBuffer | null>
let volume = 1 // slider "volume da música" (0 a 1)

const alvo = () => AUDIO.volume * AUDIO.musica * volume

// Slider do painel: muda o volume na hora (suave, sem estalo)
export function setVolumeMidi(v) {
  volume = v
  if (!motor || !atual) return
  const t = motor.ctx.currentTime
  motor.ganho.gain.cancelScheduledValues(t)
  motor.ganho.gain.setTargetAtTime(alvo(), t, 0.05)
}

function preparar(ctx) {
  preparo ??= (async () => {
    await ctx.audioWorklet.addModule(PROCESSADOR)
    const synth = new WorkletSynthesizer(ctx)
    const ganho = ctx.createGain()
    ganho.gain.value = 0
    synth.connect(ganho)
    ganho.connect(ctx.destination)
    const banco = await (await fetch(SOUNDFONT)).arrayBuffer()
    await synth.soundBankManager.addSoundBank(banco, 'principal')
    await synth.isReady
    const seq = new Sequencer(synth)
    motor = { ctx, synth, seq, ganho }
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
// Devolve false se o arquivo não existe.
export async function tocarMidi(ctx, url) {
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
  m.seq.play()
  const t = m.ctx.currentTime
  m.ganho.gain.cancelScheduledValues(t)
  m.ganho.gain.setValueAtTime(0, t)
  m.ganho.gain.linearRampToValueAtTime(alvo(), t + FADE_S)
  atual = url
  return true
}

export function pararMidi() {
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
  return { tocando: atual, tempo: motor ? Math.round(motor.seq.currentTime * 10) / 10 : null, contexto: motor?.ctx.state ?? null }
}
