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
const FILTRO_ABERTO = 20000 // Hz: passa-baixas "aberto" = não filtra nada audível
const GRAVE_HZ = 180 // realce de graves (setGraveMidi): lowshelf abaixo daqui

let preparo = null // Promise do sintetizador pronto (uma vez só)
let motor = null // { ctx, synth, seq, ganho, filtro, grave, seco, molhado }
let atual = null // url da música tocando
let pedido = 0 // descarta pedidos antigos quando a música muda no meio do carregamento
const arquivos = new Map() // url -> Promise<ArrayBuffer | null>
let pausada = false // menu de pause aberto (pausarMidi)
let volume = 1 // slider "volume da música" (0 a 1)
let velocidade = 1 // andamento pedido pelo jogo (setVelocidadeMidi): sobrevive à troca de música e ao distorcerMidi
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
// valendo para as próximas músicas e depois do efeito de fim de luta, até
// alguém pedir 1 de novo (as cenas voltam para 1 ao sair).
export function setVelocidadeMidi(fator, ms = 600) {
  velocidade = Math.max(0.25, Math.min(4, Number(fator) || 1))
  clearInterval(rampa)
  rampa = null
  // sem música (ou no meio do distorcerMidi, que mexe no andamento sozinho): só guarda
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
    // a música parou (ou começou o distorcerMidi) no meio: não mexe mais no andamento
    if (atual) seq.playbackRate = de + (para - de) * p
    if (p >= 1) {
      clearInterval(rampa)
      rampa = null
    }
  }, 30)
}

// Realce de graves (dB no lowshelf de ~180 Hz; 0 = normal), ex.: o MODO FESTA
// "batendo" mais forte. Rampa suave; fica valendo para as próximas músicas
// até alguém pedir 0 (restaurar() não mexe nele).
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
    // cadeia do efeito de fim de luta (em repouso não altera o som):
    // synth -> seco ─────────────┐
    //       -> saturação -> molhado ┴-> filtro passa-baixas -> grave (lowshelf) -> ganho -> saída
    const seco = ctx.createGain()
    const molhado = ctx.createGain()
    molhado.gain.value = 0
    const saturacao = ctx.createWaveShaper()
    saturacao.curve = curvaSaturacao()
    saturacao.oversample = 'none' // o chiado do serrilhado faz parte do efeito
    const filtro = ctx.createBiquadFilter()
    filtro.type = 'lowpass'
    filtro.frequency.value = FILTRO_ABERTO
    filtro.Q.value = 0.7
    const grave = ctx.createBiquadFilter()
    grave.type = 'lowshelf'
    grave.frequency.value = GRAVE_HZ
    grave.gain.value = graveDb
    synth.connect(seco)
    synth.connect(saturacao)
    saturacao.connect(molhado)
    seco.connect(filtro)
    molhado.connect(filtro)
    filtro.connect(grave)
    grave.connect(ganho)
    ganho.connect(ctx.destination)
    const banco = await (await fetch(SOUNDFONT)).arrayBuffer()
    await synth.soundBankManager.addSoundBank(banco, 'principal')
    await synth.isReady
    const seq = new Sequencer(synth)
    motor = { ctx, synth, seq, ganho, filtro, grave, seco, molhado }
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
  restaurar(m) // desfaz o efeito de fim de luta, se a última música morreu com ele
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

// Saturação com degraus (tanh quantizado): soa rasgado e meio "8 bits"
function curvaSaturacao() {
  const n = 2048
  const curva = new Float32Array(n)
  const degraus = 10
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curva[i] = Math.round(Math.tanh(x * 7) * degraus) / degraus
  }
  return curva
}

// Volta andamento (ao pedido por setVelocidadeMidi), afinação, filtro e saturação ao normal
function restaurar(m) {
  const t = m.ctx.currentTime
  m.seq.playbackRate = velocidade
  m.synth.setSystemParameter('fineTune', 0)
  for (const [param, valor] of [
    [m.filtro.frequency, FILTRO_ABERTO],
    [m.filtro.Q, 0.7],
    [m.seco.gain, 1],
    [m.molhado.gain, 0],
  ]) {
    param.cancelScheduledValues(t)
    param.setValueAtTime(valor, t)
  }
}

// Fim de luta: a música "perde a força" como uma fita parando (andamento e
// afinação despencam com um leve vibrato, o passa-baixas fecha e a saturação
// entra) e termina num corte seco. `suave` (chefe poupado): cai menos, sem
// saturação, e termina em fade em vez do corte.
// `sombrio` (party derrotada): despenca muito mais (quase três oitavas), o
// filtro fecha até virar um ronco e ela se apaga num fade, sem estalo.
// aoCortar() é chamado no instante do corte (para o estalo).
// Devolve Promise<boolean>: true se havia música e o efeito rodou até o fim.
export function distorcerMidi(ms = 1600, { suave = false, sombrio = false, aoCortar } = {}) {
  if (!motor || !atual) return Promise.resolve(false)
  const m = motor
  const { ctx, seq, synth, ganho, filtro, seco, molhado } = m
  atual = null // o slider de volume não mexe mais; musica(mesma) recomeça do zero
  const meu = ++pedido // outra música (ou pararMidi) no meio cancela o efeito
  clearInterval(rampa) // a rampa da morte súbita não briga com o efeito
  rampa = null
  const base = seq.playbackRate // a fita cai a partir do andamento atual (pode estar acelerada)
  const s = ms / 1000
  const t = ctx.currentTime
  const cfg = sombrio
    ? { ritmo: 0.9, cents: -3300, corte: 90, sat: 0.2 }
    : suave
      ? { ritmo: 0.45, cents: -500, corte: 500, sat: 0 }
      : { ritmo: 0.82, cents: -1900, corte: 160, sat: 0.12 }
  const fade = suave || sombrio // termina sumindo em vez do corte seco

  filtro.frequency.cancelScheduledValues(t)
  filtro.frequency.setValueAtTime(FILTRO_ABERTO, t)
  filtro.frequency.exponentialRampToValueAtTime(cfg.corte, t + s)
  filtro.Q.cancelScheduledValues(t)
  filtro.Q.setValueAtTime(suave ? 0.7 : 3, t) // ressonância: o "uóóó" do filtro fechando
  if (cfg.sat) {
    molhado.gain.setValueAtTime(0, t)
    molhado.gain.linearRampToValueAtTime(cfg.sat, t + s * 0.6)
    seco.gain.setValueAtTime(1, t)
    seco.gain.linearRampToValueAtTime(0.35, t + s * 0.6)
  }
  ganho.gain.cancelScheduledValues(t)
  ganho.gain.setValueAtTime(ganho.gain.value, t)
  if (suave) ganho.gain.linearRampToValueAtTime(0, t + s)
  if (sombrio) {
    // segura o volume até a metade e depois afunda junto com a afinação
    ganho.gain.setValueAtTime(ganho.gain.value, t + s * 0.45)
    ganho.gain.exponentialRampToValueAtTime(0.0005, t + s)
  }

  return new Promise((resolver) => {
    const inicio = performance.now()
    const passo = setInterval(() => {
      if (meu !== pedido) {
        clearInterval(passo)
        return resolver(false) // quem cancelou (tocarMidi) restaura ao começar a próxima
      }
      const p = Math.min(1, (performance.now() - inicio) / ms)
      seq.playbackRate = Math.max(0.05, base * (1 - cfg.ritmo * p ** 1.4))
      const vibrato = Math.sin(p * 38) * 35 * p // a "fita" oscila enquanto morre
      synth.setSystemParameter('fineTune', cfg.cents * p ** 2 + vibrato)
      if (p < 1) return
      clearInterval(passo)
      const agora = ctx.currentTime
      ganho.gain.cancelScheduledValues(agora)
      ganho.gain.setValueAtTime(fade ? 0 : ganho.gain.value, agora)
      ganho.gain.linearRampToValueAtTime(0, agora + 0.006) // corte seco
      if (!fade) aoCortar?.()
      setTimeout(() => {
        seq.pause()
        synth.stopAll(true)
        if (meu === pedido) restaurar(m)
        resolver(true)
      }, 40)
    }, 30)
  })
}

// Diagnóstico (debugJogo.musica()): o que está tocando e em que segundo
export function estadoMidi() {
  return { tocando: atual, velocidade, tempo: motor ? Math.round(motor.seq.currentTime * 10) / 10 : null, contexto: motor?.ctx.state ?? null }
}
