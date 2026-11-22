import { AUDIO } from './constants.js'

// Músicas PRÉ-RENDERIZADAS (scripts/musica/renderizar.mjs): cada .mid de assets-fonte/musicas/
// virou Opus (.webm) e AAC (.m4a, a reserva do Safari) em public/assets/musicas/render/, com o
// mesmo sintetizador e soundfont de antes. Nenhum sintetizador roda no navegador: o decode é
// nativo, fora da thread principal.
//
// Mesma API do antigo midi.js (tocarMidi, pararMidi, pausarMidi, ...), para o audio.js só trocar
// o import. `url` aqui é o nome da música (ex.: 'menu'); um caminho antigo
// ('assets/musicas/menu.mid') também vale.
//
// Cadeia (a mesma de antes, no MESMO AudioContext do jogo: a cópia da transmissão LAN, o Phaser):
//   voz(es) -> entrada -> grave (lowshelf) -> [fita] -> ganho -> compressor -> saída -> destino
// Dois jeitos de tocar uma faixa:
//   - "buffer": loops curtos (< CURTA_S) viram um AudioBuffer com loopStart/loopEnd (loop exato,
//     na amostra). playbackRate muda tom e andamento juntos: só é usado com andamento 1 (o
//     COGUMELO, que muda tom e andamento juntos de propósito, funciona nele).
//   - "elemento": as longas tocam num <audio> ligado por createMediaElementSource (decodifica
//     aos poucos: uma faixa de 150 s em AudioBuffer seriam 57 MB). O <audio> não tem loopStart e
//     o loop dele tem buraco, então a emenda é feita com DUAS vozes do mesmo arquivo: perto do
//     loopEnd a segunda começa muda no ponto equivalente antes do loopStart (o arquivo tem PRE_S
//     antes do loop igual ao fim dele e POS_S depois igual ao começo), é alinhada pelo
//     currentTime (um empurrãozinho no playbackRate enquanto está muda) e entra num crossfade
//     curto. O andamento (morte súbita, relógio, câmera lenta do replay) usa playbackRate com
//     preservesPitch = true. Uma faixa curta que precisa de andamento passa para "elemento".
// O COGUMELO (setTomMidi): tom e andamento juntos, como um toca-discos (playbackRate com
// preservesPitch = false), deslizando em ~0,45 s: a música "derrete" para o grave no coração
// gigante e acelera para o agudo no mini.
//
// Toca só com o contexto 'running' (a aba escondida suspende o contexto e as vozes pausam junto:
// a música continua de onde estava, como antes).

const RENDER = 'assets/musicas/render/'
const MANIFESTO = `${RENDER}musicas.json`
const FADE_S = 0.35
const GRAVE_HZ = 180 // realce de graves (setGraveMidi): lowshelf abaixo daqui
const GRAVE_BASE_DB = 3 // peso extra permanente; o Modo Festa soma seu próprio realce
const MARGEM_SAIDA_DB = -1 // margem depois do compressor, sem alterar o slider
const CURTA_S = 30 // loops abaixo disso tocam de AudioBuffer
const TIQUE_MS = 50 // vigia da emenda das vozes <audio>
const JANELA_S = 1.2 // quanto antes do loopEnd a segunda voz começa (o arquivo tem 1,5 s de margem)
const ALINHADO_S = 0.003 // diferença entre as vozes que já vale o crossfade
const CROSS_S = 0.05
const LONGE_S = 0.04 // diferença entre as vozes acima disso: busca de novo em vez de empurrar
let latenciaBusca = 0.03 // aprendida a cada emenda (s entre pedir play/busca e a voz andar)
const RAMPA_TOM_MS = 450
const MAX_BUFFERS = 3 // AudioBuffers decodificados guardados (as curtas: ~4 MB cada)
export const POOL_VOZES = 4 // elementos <audio> (destravados no 1º gesto, reaproveitados)

let manifesto = null // Promise<{ faixas } | null>
let formato = null // 'webm' | 'm4a'
let motor = null // { ctx, entrada, grave, ganho, compressor, saida }
let faixa = null // a faixa tocando (FaixaBuffer | FaixaElemento)
let atual = null // nome da música tocando
let pedido = 0 // descarta pedidos antigos quando a música muda no meio do carregamento
let pausada = false // menu de pause aberto (pausarMidi)
let cortada = false // corte seco pedido pelo jogo (cortarMidi), independente do pause
let silencio = 0 // descarta a pausa agendada por um silenciar() que já foi desfeito
let volume = 1 // slider "volume da música" (0 a 1)
let velocidade = 1 // andamento pedido (setVelocidadeMidi): sobrevive à troca de música
let tom = 0 // semitons pedidos (setTomMidi): sobrevive à troca de música
let graveDb = 0 // realce de graves pedido (setGraveMidi)
// andamento e fator de tom de verdade agora (as rampas andam até os pedidos)
const taxa = { vel: 1, tom: 1, rampaVel: null, rampaTom: null, timer: null }
const buffers = new Map() // url -> Promise<AudioBuffer | null> (LRU)
const vozes = [] // pool de { el, fonte, g, livre }

const alvo = () => AUDIO.volume * AUDIO.musica * volume
const calada = () => pausada || cortada // pause do menu OU corte do jogo
const fatorTom = (st) => 2 ** (st / 12)
const nomeDe = (url) =>
  String(url ?? '')
    .split('/')
    .pop()
    .replace(/\.(mid|webm|m4a)$/i, '')

// ---------------------------------------------------------------- manifesto e arquivos
export function escolherFormato(el) {
  // Opus em WebM onde o navegador garante; senão AAC (Safari, iPhone)
  const pode = (t) => el?.canPlayType?.(t) ?? ''
  return pode('audio/webm; codecs="opus"') === 'probably' ? 'webm' : 'm4a'
}

function carregarManifesto() {
  manifesto ??= fetch(MANIFESTO)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((m) => {
      if (!m) {
        console.warn('[música] sem o manifesto das músicas (rode scripts/musica/renderizar.mjs)')
        manifesto = null // tenta de novo no próximo pedido
      }
      return m
    })
  return manifesto
}

async function infoDe(nome) {
  const m = await carregarManifesto()
  return m?.faixas?.[nome] ?? null
}

export const curta = (info) => info.loopEnd - info.loopStart < CURTA_S

const arquivoParaInfo = new Map() // url do arquivo -> info do manifesto (para costurar o buffer)
function urlDe(info) {
  formato ??= escolherFormato(typeof Audio !== 'undefined' ? new Audio() : null)
  const arq = info.formatos[formato] ?? Object.values(info.formatos)[0]
  arquivoParaInfo.set(RENDER + arq, info)
  return RENDER + arq
}

// O arquivo é periódico na amostra, mas o codec (Opus/AAC) não decodifica o começo do loop e a
// margem depois do loopEnd exatamente igual: no salto do loop sobraria um degrau do tamanho do
// ruído do codec. Funde os primeiros COSTURA_S depois do loopStart a partir da continuação de
// verdade (o que vem depois do loopEnd, já decodificado): o salto fica sem degrau nenhum.
const COSTURA_S = 0.01
export function costurarBuffer(buffer, info) {
  const taxa = buffer.sampleRate
  const ini = Math.round(info.loopStart * taxa)
  const fim = Math.round(info.loopEnd * taxa)
  const n = Math.round(COSTURA_S * taxa)
  if (fim + n > buffer.length) return buffer
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c)
    for (let i = 0; i < n; i++) {
      const w = i / n
      d[ini + i] = (1 - w) * d[fim + i] + w * d[ini + i]
    }
  }
  return buffer
}

function baixarBuffer(ctx, url) {
  if (buffers.has(url)) {
    const p = buffers.get(url)
    buffers.delete(url) // LRU: volta para o fim
    buffers.set(url, p)
    return p
  }
  const p = fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((b) => (b ? ctx.decodeAudioData(b) : null))
    .then((buffer) => buffer && arquivoParaInfo.has(url) ? costurarBuffer(buffer, arquivoParaInfo.get(url)) : buffer)
    .catch((erro) => {
      console.warn(`[música] não deu para decodificar ${url}:`, erro)
      buffers.delete(url)
      return null
    })
  buffers.set(url, p)
  while (buffers.size > MAX_BUFFERS) buffers.delete(buffers.keys().next().value)
  return p
}

// Pré-carrega uma música (a da arena depois da votação, a do SUPER quando a carta é escolhida):
// as curtas já ficam decodificadas; as longas vão para o cache HTTP (o <audio> lê de lá).
const preCarregadas = new Set()
export async function preCarregarMidi(ctx, url) {
  const info = await infoDe(nomeDe(url))
  if (!info) return false
  const arquivo = urlDe(info)
  if (ctx && curta(info)) return !!(await baixarBuffer(ctx, arquivo))
  if (preCarregadas.has(arquivo)) return true
  preCarregadas.add(arquivo)
  return fetch(arquivo, { priority: 'low' })
    .then((r) => r.arrayBuffer())
    .then(() => true)
    .catch(() => (preCarregadas.delete(arquivo), false))
}

// A música existe? (no manifesto)
export async function existeMidi(url) {
  return !!(await infoDe(nomeDe(url)))
}

// ---------------------------------------------------------------- cadeia de áudio
function preparar(ctx) {
  if (motor) return motor
  const entrada = ctx.createGain()
  const grave = ctx.createBiquadFilter()
  grave.type = 'lowshelf'
  grave.frequency.value = GRAVE_HZ
  grave.gain.value = GRAVE_BASE_DB + graveDb
  // o ganho controla fades, pause, corte e abafo; o compressor recebe o volume que sai de fato
  const ganho = ctx.createGain()
  ganho.gain.value = 0
  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -3
  compressor.knee.value = 3
  compressor.ratio.value = 20
  compressor.attack.value = 0.001
  compressor.release.value = 0.12
  const saida = ctx.createGain()
  saida.gain.value = 10 ** (MARGEM_SAIDA_DB / 20)
  entrada.connect(grave)
  grave.connect(ganho)
  ganho.connect(compressor)
  compressor.connect(saida)
  saida.connect(ctx.destination)
  motor = { ctx, entrada, grave, ganho, compressor, saida }
  // aba escondida / iPhone 'interrupted': as vozes <audio> pausam junto com o contexto
  ctx.addEventListener?.('statechange', () => faixa?.atualizar())
  return motor
}

// ---------------------------------------------------------------- vozes <audio> (pool)
// 1 amostra de silêncio (WAV): o que o pool toca para destravar no gesto do iPhone
const SILENCIO = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAgLsAAAB3AQACABAAZGF0YQIAAAAAAA=='

function criarVoz(ctx) {
  const el = new Audio()
  el.preload = 'auto'
  el.crossOrigin = 'anonymous'
  const fonte = ctx.createMediaElementSource(el)
  const g = ctx.createGain()
  g.gain.value = 0
  fonte.connect(g)
  g.connect(preparar(ctx).entrada)
  const voz = { el, fonte, g, livre: true, destravada: false }
  vozes.push(voz)
  return voz
}

function pegarVoz(ctx) {
  const voz = vozes.find((v) => v.livre) ?? (vozes.length < POOL_VOZES ? criarVoz(ctx) : null)
  if (!voz) return null
  voz.livre = false
  return voz
}

function soltarVoz(voz) {
  if (!voz) return
  voz.el.pause()
  voz.g.gain.cancelScheduledValues(0)
  voz.g.gain.value = 0
  voz.livre = true
}

// Chamado no gesto do usuário (lib/destravarAudio.js): o iPhone só deixa tocar um <audio> que
// já tocou dentro de um gesto. Cria o pool e toca silêncio em cada um.
export function destravarMusica(ctx) {
  if (!ctx || typeof Audio === 'undefined') return
  preparar(ctx)
  while (vozes.length < POOL_VOZES) criarVoz(ctx)
  for (const v of vozes) {
    if (v.destravada || !v.livre) continue
    v.destravada = true
    v.el.src = SILENCIO
    v.el.play()?.then?.(() => v.livre && v.el.pause())?.catch?.(() => (v.destravada = false))
  }
  faixa?.atualizar()
}

function ajustarElemento(el, rate, preserva) {
  el.preservesPitch = preserva
  el.mozPreservesPitch = preserva
  el.webkitPreservesPitch = preserva
  el.playbackRate = rate
}

// ---------------------------------------------------------------- faixa: AudioBuffer
class FaixaBuffer {
  modo = 'buffer'
  constructor(ctx, info, buffer) {
    this.ctx = ctx
    this.info = info
    this.buffer = buffer
    this.periodo = info.loopEnd - info.loopStart
    this.g = ctx.createGain()
    this.g.connect(motor.entrada)
    this.fonte = null
    this.pos = 0 // posição no corpo do loop no instante `marca` (s)
    this.marca = 0
    this.rate = 1
    this.congelada = false
  }
  iniciar(pos) {
    this.pos = ((pos % this.periodo) + this.periodo) % this.periodo
    this.ligar()
  }
  ligar() {
    const f = this.ctx.createBufferSource()
    f.buffer = this.buffer
    f.loop = true
    f.loopStart = this.info.loopStart
    f.loopEnd = this.info.loopEnd
    f.playbackRate.value = this.rate
    f.connect(this.g)
    f.start(0, this.info.loopStart + this.pos)
    this.fonte = f
    this.marca = this.ctx.currentTime
  }
  posicao() {
    if (this.congelada || !this.fonte) return this.pos
    const p = this.pos + (this.ctx.currentTime - this.marca) * this.rate
    return p % this.periodo
  }
  setTaxa(rate) {
    if (Math.abs(rate - this.rate) < 1e-6) return
    this.pos = this.posicao()
    this.marca = this.ctx.currentTime
    this.rate = rate
    this.fonte?.playbackRate.setValueAtTime(rate, this.ctx.currentTime)
  }
  congelar() {
    if (this.congelada) return
    this.pos = this.posicao()
    this.congelada = true
    this.desligar()
  }
  descongelar() {
    if (!this.congelada) return
    this.congelada = false
    this.ligar()
  }
  desligar() {
    try {
      this.fonte?.stop()
    } catch {}
    this.fonte?.disconnect()
    this.fonte = null
  }
  atualizar() {}
  soltar() {
    this.desligar()
    this.g.disconnect()
  }
}

// ---------------------------------------------------------------- faixa: <audio> com 2 vozes
class FaixaElemento {
  modo = 'elemento'
  constructor(ctx, info, url) {
    this.ctx = ctx
    this.info = info
    this.url = url
    this.periodo = info.loopEnd - info.loopStart
    this.a = null // voz tocando
    this.b = null // voz da emenda (só perto do loopEnd)
    this.troca = null // { ref } enquanto a emenda está em andamento
    this.rate = 1
    this.preserva = true
    this.congelada = false
    this.timer = null
    this.pendente = 0 // posição pedida antes de a voz carregar
  }
  iniciar(pos, ganhoInicial = 1) {
    this.a = pegarVoz(this.ctx)
    if (!this.a) return false
    const p = ((pos % this.periodo) + this.periodo) % this.periodo
    this.carregar(this.a, this.info.loopStart + p)
    this.a.g.gain.value = ganhoInicial
    this.timer = setInterval(() => this.tique(), TIQUE_MS)
    this.atualizar()
    return true
  }
  carregar(voz, t) {
    if (!voz.el.src.endsWith(this.url)) {
      voz.el.src = this.url
      voz.el.load()
    }
    voz.el.currentTime = t
    ajustarElemento(voz.el, this.rate, this.preserva)
  }
  deveTocar() {
    return !this.congelada && this.ctx.state === 'running'
  }
  // liga/desliga as vozes conforme o pedido e o estado do contexto
  atualizar() {
    for (const voz of [this.a, this.b]) {
      if (!voz) continue
      if (this.deveTocar()) {
        if (voz.el.paused) voz.el.play()?.catch?.(() => {})
      } else if (!voz.el.paused) voz.el.pause()
    }
  }
  posicao() {
    if (!this.a) return 0
    const p = this.a.el.currentTime - this.info.loopStart
    return ((p % this.periodo) + this.periodo) % this.periodo
  }
  setTaxa(rate, preserva) {
    this.rate = rate
    this.preserva = preserva
    if (this.a) ajustarElemento(this.a.el, rate, preserva)
    if (this.b) ajustarElemento(this.b.el, rate * (this.troca?.empurrao ?? 1), preserva)
  }
  congelar() {
    this.congelada = true
    this.cancelarTroca()
    this.atualizar()
  }
  descongelar() {
    this.congelada = false
    this.atualizar()
  }
  cancelarTroca() {
    if (this.b) soltarVoz(this.b)
    this.b = null
    this.troca = null
  }
  // A emenda: a voz B começa muda no ponto equivalente (t - período) e é alinhada pelo
  // currentTime; alinhada, entra num crossfade e vira a voz principal
  tique() {
    const a = this.a
    if (!a || !this.deveTocar() || a.el.paused || a.el.readyState < 2) return
    const { loopEnd, duracao } = this.info
    const t = a.el.currentTime
    if (!this.troca) {
      if (t >= duracao - 0.08) {
        // o vigia atrasou demais (aba engasgada): volta seco um período
        a.el.currentTime = t - this.periodo
        return
      }
      if (t < loopEnd - JANELA_S) return
      const b = pegarVoz(this.ctx)
      if (!b) return
      this.b = b
      this.troca = { empurrao: 1, desde: performance.now() }
      b.g.gain.value = 0
      this.carregar(b, t - this.periodo + latenciaBusca * this.rate) // do play() até soar
      b.el.play()?.catch?.(() => {})
      return
    }
    const b = this.b
    if (b.el.paused || b.el.readyState < 3 || b.el.seeking) return
    const d = b.el.currentTime + this.periodo - t // > 0: B adiantada
    const atrasado = t > loopEnd + 2 // a margem depois do loopEnd é 2,5 s: troca de qualquer jeito
    if (Math.abs(d) <= ALINHADO_S || atrasado) {
      this.cruzar()
      return
    }
    if (this.troca.buscou) {
      // a busca anterior terminou: aprende quanto a voz atrasa entre pedir a busca e voltar a
      // tocar (no celular lento ou na aba engasgada passa de 100 ms)
      latenciaBusca = Math.max(0, Math.min(0.5, latenciaBusca - d))
      this.troca.buscou = false
    }
    if (Math.abs(d) > LONGE_S) {
      // longe demais para o empurrão: busca de novo (a voz está muda), já contando a latência
      this.troca.buscou = true
      b.el.currentTime = t - this.periodo + latenciaBusca * this.rate
      return
    }
    // empurrãozinho no andamento da voz muda (preservesPitch: ninguém ouve) até alinhar
    this.troca.empurrao = 1 - Math.max(-0.15, Math.min(0.15, d / 0.15))
    ajustarElemento(b.el, this.rate * this.troca.empurrao, this.preserva)
  }
  cruzar() {
    const { a, b, ctx } = this
    const agora = ctx.currentTime
    ajustarElemento(b.el, this.rate, this.preserva)
    for (const [g, de, para] of [
      [a.g.gain, 1, 0],
      [b.g.gain, 0, 1],
    ]) {
      g.cancelScheduledValues(agora)
      g.setValueAtTime(de, agora)
      g.linearRampToValueAtTime(para, agora + CROSS_S)
    }
    this.a = b
    this.b = null
    this.troca = null
    setTimeout(() => soltarVoz(a), CROSS_S * 1000 + 60)
  }
  soltar() {
    clearInterval(this.timer)
    this.cancelarTroca()
    soltarVoz(this.a)
    this.a = null
  }
}

// Faixa curta que passou a precisar de andamento com o tom preservado: troca o AudioBuffer por
// uma voz <audio> alinhada a ele (a posição do buffer é exata), com um crossfade curto
function migrarParaElemento(f) {
  const nova = new FaixaElemento(f.ctx, f.info, urlDe(f.info))
  if (!nova.iniciar(f.posicao() + 0.03, 0)) return f
  let inicio = performance.now()
  const alinhar = setInterval(() => {
    const v = nova.a
    if (faixa !== f) {
      clearInterval(alinhar)
      if (faixa !== nova) nova.soltar()
      return
    }
    // pause/corte no meio da troca: a voz muda congela junto e o relógio da troca recomeça
    if (f.congelada !== nova.congelada) f.congelada ? nova.congelar() : nova.descongelar()
    if (f.congelada) inicio = performance.now()
    if (f.congelada || v.el.paused || v.el.readyState < 3 || v.el.seeking) return
    const d = v.el.currentTime - f.info.loopStart - f.posicao()
    const dd = Math.abs(d) > f.periodo / 2 ? d - Math.sign(d) * f.periodo : d
    if (Math.abs(dd) <= ALINHADO_S || performance.now() - inicio > 1500) {
      clearInterval(alinhar)
      const agora = f.ctx.currentTime
      ajustarElemento(v.el, f.rate, true)
      f.g.gain.setValueAtTime(1, agora)
      f.g.gain.linearRampToValueAtTime(0, agora + CROSS_S)
      v.g.gain.setValueAtTime(0, agora)
      v.g.gain.linearRampToValueAtTime(1, agora + CROSS_S)
      faixa = nova
      aplicarTaxa()
      setTimeout(() => f.soltar(), CROSS_S * 1000 + 60)
      return
    }
    ajustarElemento(v.el, f.rate * (1 - Math.max(-0.1, Math.min(0.1, dd / 0.2))), true)
  }, TIQUE_MS)
  return f // continua o buffer até a voz alinhar
}

// ---------------------------------------------------------------- andamento e tom
// as duas rampas (andamento e tom) num timer só; cada passo vai para a faixa
function aplicarTaxa() {
  if (!faixa) return
  const preserva = tom === 0 && Math.abs(taxa.tom - 1) < 1e-4
  // buffer só toca no andamento 1 (o tom pode mudar: o COGUMELO junta os dois)
  if (faixa.modo === 'buffer' && Math.abs(velocidade - 1) > 1e-4) {
    if (!faixa.migrando) {
      faixa.migrando = true
      migrarParaElemento(faixa)
    }
    faixa.setTaxa(taxa.tom)
    return
  }
  faixa.setTaxa(faixa.modo === 'buffer' ? taxa.tom : taxa.vel * taxa.tom, preserva)
}

function rampa(chave, de, para, ms) {
  taxa[chave === 'vel' ? 'rampaVel' : 'rampaTom'] = { de, para, inicio: performance.now(), ms }
  taxa.timer ??= setInterval(() => {
    const agora = performance.now()
    for (const [k, r] of [
      ['vel', 'rampaVel'],
      ['tom', 'rampaTom'],
    ]) {
      const rr = taxa[r]
      if (!rr) continue
      const p = Math.min(1, (agora - rr.inicio) / Math.max(1, rr.ms))
      // suave nas pontas (o deslize do toca-discos)
      const s = k === 'tom' ? p * p * (3 - 2 * p) : p
      taxa[k] = rr.de + (rr.para - rr.de) * s
      if (p >= 1) taxa[r] = null
    }
    aplicarTaxa()
    if (!taxa.rampaVel && !taxa.rampaTom) {
      clearInterval(taxa.timer)
      taxa.timer = null
    }
  }, 30)
}

// Andamento da música (1 = normal; 1.24 = 24% mais rápida), para a "morte súbita" das partidas
// longas, o relógio e a câmera lenta do replay. Rampa curta; fica valendo para as próximas
// músicas até alguém pedir 1 de novo (as cenas voltam para 1 ao sair). O tom não muda.
export function setVelocidadeMidi(fator, ms = 600) {
  velocidade = Math.max(0.25, Math.min(4, Number(fator) || 1))
  if (!faixa || !ms || Math.abs(velocidade - taxa.vel) < 0.001) {
    taxa.vel = velocidade
    taxa.rampaVel = null
    aplicarTaxa()
    return
  }
  rampa('vel', taxa.vel, velocidade, ms)
}

// Tom em semitons (0 = normal; o COGUMELO pede -6 / +6). Muda tom E andamento juntos, como um
// toca-discos (decisão do dono do jogo): -6 deixa a música 30% mais lenta e grave, +6 41% mais
// rápida e aguda, deslizando em ~0,45 s. Fica valendo para as próximas músicas até pedirem 0.
export function setTomMidi(semitons = 0, ms = RAMPA_TOM_MS) {
  tom = Math.max(-24, Math.min(24, Math.round(Number(semitons) || 0)))
  const para = fatorTom(tom)
  if (!faixa || !ms) {
    taxa.tom = para
    taxa.rampaTom = null
    aplicarTaxa()
    return
  }
  rampa('tom', taxa.tom, para, ms)
}

// ---------------------------------------------------------------- volume, graves, posição
export function setVolumeMidi(v) {
  volume = v
  if (!motor || !atual || calada()) return
  const t = motor.ctx.currentTime
  motor.ganho.gain.cancelScheduledValues(t)
  motor.ganho.gain.setTargetAtTime(alvo(), t, 0.05)
}

// Realce EXTRA de graves (dB no lowshelf de ~180 Hz; 0 = grave base), ex.: o MODO FESTA
export function setGraveMidi(db = 0, ms = 400) {
  graveDb = Math.max(-24, Math.min(24, Number(db) || 0))
  if (!motor) return // preparar() já cria o filtro com graveDb
  const g = motor.grave.gain
  const t = motor.ctx.currentTime
  g.cancelScheduledValues(t)
  g.setValueAtTime(g.value, t)
  g.linearRampToValueAtTime(GRAVE_BASE_DB + graveDb, t + Math.max(0.01, ms / 1000))
}

// Segundo atual dentro do loop (0 sem música): o que tocarMidi(..., { inicio }) aceita de volta
export function tempoMidi() {
  return faixa && atual ? faixa.posicao() : 0
}

// ---------------------------------------------------------------- tocar, pausar, parar
// O navegador só libera som depois de um gesto: se o contexto estiver suspenso, tenta de novo no
// próximo (no celular o que vale é pointerup/touchend; ver lib/destravarAudio.js)
const GESTOS = ['pointerdown', 'pointerup', 'touchend', 'keydown']
function destravar(ctx) {
  if (ctx.state === 'running' || typeof window === 'undefined') return
  ctx.resume()?.catch?.(() => {})
  const tentar = () => {
    destravarMusica(ctx)
    Promise.resolve(ctx.resume?.())
      .then(() => ctx.state === 'running' && GESTOS.forEach((g) => window.removeEventListener(g, tentar)))
      .catch(() => {})
  }
  GESTOS.forEach((g) => window.addEventListener(g, tentar))
}

// Toca a música `url` (nome) em loop (se já estiver tocando, não reinicia).
// opcoes.inicio: começa desse segundo do loop (ex.: voltar a música de batalha de onde parou).
// Devolve false se a música não existe.
export async function tocarMidi(ctx, url, { inicio = 0 } = {}) {
  const nome = nomeDe(url)
  if (atual === nome) return true
  pararMidi() // fade da anterior (incrementa `pedido`)
  const meu = ++pedido
  destravar(ctx)
  const info = await infoDe(nome)
  if (!info) {
    console.warn(`[música] ${nome} não existe no manifesto: tocando nada`)
    return false
  }
  if (meu !== pedido) return true
  const m = preparar(ctx)
  const arquivo = urlDe(info)
  let nova
  if (curta(info) && Math.abs(velocidade - 1) < 1e-4) {
    const buffer = await baixarBuffer(ctx, arquivo)
    if (meu !== pedido) return true
    if (buffer) nova = new FaixaBuffer(ctx, info, buffer)
  }
  if (!nova) nova = new FaixaElemento(ctx, info, arquivo)
  if (ctx.state !== 'running') console.warn(`[música] ${nome} pronta, mas o navegador ainda bloqueia o som: clique ou aperte uma tecla na página`)
  console.info(`[música] tocando ${nome} (${nova.modo}, ${formato})`)
  faixa?.soltar()
  faixa = nova
  atual = nome
  taxa.vel = velocidade
  taxa.tom = fatorTom(tom)
  taxa.rampaVel = taxa.rampaTom = null
  if (nova.modo === 'buffer') nova.rate = taxa.tom
  else nova.setTaxa(taxa.vel * taxa.tom, tom === 0)
  nova.iniciar(inicio)
  if (cortada) nova.congelar() // cortada: fica parada até voltar
  const t = m.ctx.currentTime
  m.ganho.gain.cancelScheduledValues(t)
  m.ganho.gain.setValueAtTime(0, t)
  m.ganho.gain.linearRampToValueAtTime(calada() ? 0 : alvo(), t + FADE_S)
  return true
}

// Silencia (rampa de `s` segundos) e depois congela a faixa onde está
function silenciar(s) {
  const { ctx, ganho } = motor
  const t = ctx.currentTime
  ganho.gain.cancelScheduledValues(t)
  ganho.gain.setValueAtTime(ganho.gain.value, t)
  ganho.gain.linearRampToValueAtTime(0, t + s)
  const meu = ++silencio
  setTimeout(() => {
    if (meu !== silencio || !calada()) return
    faixa?.congelar()
  }, s * 1000 + 20)
}

// Continua do mesmo ponto, subindo o volume em `s` segundos
function soar(s) {
  silencio++
  const { ctx, ganho } = motor
  faixa?.descongelar()
  const t = ctx.currentTime
  ganho.gain.cancelScheduledValues(t)
  ganho.gain.setValueAtTime(ganho.gain.value, t)
  ganho.gain.linearRampToValueAtTime(alvo(), t + s)
}

// Pause do jogo: congela a música onde está (e abafa rápido); retomarMidi continua do mesmo ponto
export function pausarMidi() {
  if (!motor || !atual || pausada) return
  pausada = true
  if (!cortada) silenciar(0.08)
}

export function retomarMidi() {
  if (!motor || !pausada) return
  pausada = false
  if (atual && !cortada) soar(0.25)
}

// Corte SECO da música (true) e a volta do mesmo ponto (false), ex.: a DANÇA DA ESTÁTUA.
// Independe do pause do menu. Fica valendo até alguém pedir false: sempre desfaça.
export function cortarMidi(cortar = true) {
  cortar = Boolean(cortar)
  if (cortada === cortar) return
  cortada = cortar
  if (!motor || !atual || pausada) return
  if (cortar) silenciar(0.012)
  else soar(0.03)
}

export function pararMidi() {
  pausada = false
  silencio++
  pedido++
  atual = null
  if (!motor) return
  const { ctx, ganho } = motor
  const t = ctx.currentTime
  ganho.gain.cancelScheduledValues(t)
  ganho.gain.setValueAtTime(ganho.gain.value, t)
  ganho.gain.linearRampToValueAtTime(0, t + FADE_S)
  const tocando = pedido
  const f = faixa
  setTimeout(() => {
    if (pedido !== tocando || faixa !== f) return // outra música já começou
    f?.soltar()
    faixa = null
  }, FADE_S * 1000 + 30)
}

// Diagnóstico (debugJogo.musica()): o que está tocando, em que segundo, de que jeito
export function estadoMidi() {
  return {
    tocando: atual,
    velocidade,
    cortada,
    pausada,
    tom,
    taxa: Math.round(taxa.vel * taxa.tom * 1000) / 1000,
    tempo: faixa ? Math.round(faixa.posicao() * 10) / 10 : null,
    modo: faixa?.modo ?? null,
    formato,
    contexto: motor?.ctx.state ?? null,
  }
}

// ---------- fita (replay do fim da partida PvP) ----------
// Efeito de FITA CASSETE / VHS na música: passa-baixa (som abafado), wow e flutter (o tom
// oscilando, como fita esticada: um atraso modulado por dois LFOs) e chiado de fita. Na primeira
// vez entra na cadeia
//   entrada -> grave -> [passa-baixa -> atraso modulado] -> ganho -> ...
// e fica lá (neutro: filtro aberto, sem oscilação, 16 ms de atraso fixo). O chiado vai direto ao
// compressor (independe do corte/pause da música).
//   setFitaMidi({ corte, wow, chiado }, ms)
//     corte    Hz do passa-baixa (null = aberto)
//     wow      0 = nada, 1 = fita gasta (~20 cents indo e voltando), até 3
//     chiado   0..1 volume do chiado
// Fica valendo para as próximas músicas: sempre desfaça com setFitaMidi() (tudo neutro).
const FITA = { atrasoS: 0.016, wowHz: 0.55, wowS: 0.0035, flutterHz: 6.8, flutterS: 0.00012, chiado: 0.05, aberto: 20000 }
let fita = null // nós do efeito (montados na primeira vez que alguém pede)
let pedidoFita = { corte: null, wow: 0, chiado: 0 }

function montarFita() {
  if (fita || !motor) return fita
  const { ctx, grave, ganho, compressor } = motor
  const passa = ctx.createBiquadFilter()
  passa.type = 'lowpass'
  passa.frequency.value = FITA.aberto
  passa.Q.value = 0.9
  const atraso = ctx.createDelay(0.1)
  atraso.delayTime.value = FITA.atrasoS
  const lfo = (hz) => {
    const o = ctx.createOscillator()
    o.frequency.value = hz
    const g = ctx.createGain()
    g.gain.value = 0
    o.connect(g).connect(atraso.delayTime)
    o.start()
    return g
  }
  const wow = lfo(FITA.wowHz)
  const flutter = lfo(FITA.flutterHz)
  // chiado: ruído em loop passando por um passa-altas
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const dados = buffer.getChannelData(0)
  for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1
  const ruido = ctx.createBufferSource()
  ruido.buffer = buffer
  ruido.loop = true
  const agudo = ctx.createBiquadFilter()
  agudo.type = 'highpass'
  agudo.frequency.value = 3200
  const chiado = ctx.createGain()
  chiado.gain.value = 0
  ruido.connect(agudo).connect(chiado).connect(compressor)
  ruido.start()
  grave.disconnect()
  grave.connect(passa).connect(atraso).connect(ganho)
  fita = { passa, wow, flutter, chiado }
  return fita
}

export function setFitaMidi({ corte = null, wow = 0, chiado = 0 } = {}, ms = 300) {
  pedidoFita = { corte, wow: Math.max(0, Math.min(3, Number(wow) || 0)), chiado: Math.max(0, Math.min(1, Number(chiado) || 0)) }
  const neutro = pedidoFita.corte == null && !pedidoFita.wow && !pedidoFita.chiado
  if (!motor || (!fita && neutro)) return // nada montado e nada pedido: não mexe na cadeia
  const f = montarFita()
  const t = motor.ctx.currentTime
  const s = Math.max(0.01, ms / 1000)
  const rampaParam = (param, valor) => {
    param.cancelScheduledValues(t)
    param.setValueAtTime(param.value, t)
    param.linearRampToValueAtTime(valor, t + s)
  }
  rampaParam(f.passa.frequency, Math.max(60, Math.min(FITA.aberto, pedidoFita.corte ?? FITA.aberto)))
  rampaParam(f.wow.gain, pedidoFita.wow * FITA.wowS)
  rampaParam(f.flutter.gain, pedidoFita.wow * FITA.flutterS)
  rampaParam(f.chiado.gain, pedidoFita.chiado * FITA.chiado * alvo())
}

// Só para os testes: zera o estado do módulo
export function _reiniciarParaTeste() {
  faixa?.soltar()
  manifesto = null
  formato = null
  motor = null
  faixa = null
  atual = null
  pausada = cortada = false
  volume = velocidade = 1
  tom = graveDb = 0
  Object.assign(taxa, { vel: 1, tom: 1, rampaVel: null, rampaTom: null })
  latenciaBusca = 0.03
  clearInterval(taxa.timer)
  taxa.timer = null
  buffers.clear()
  vozes.length = 0
  fita = null
}
export const _faixaParaTeste = () => faixa
