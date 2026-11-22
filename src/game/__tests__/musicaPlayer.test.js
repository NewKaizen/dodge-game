// node --test src/game/__tests__/musicaPlayer.test.js
// game/musica.js com um AudioContext, <audio> e fetch de mentira: a API antiga do midi.js
// (andamento, tom do COGUMELO, posição, pause, corte, emenda do loop) cai no lugar certo.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'

// ---------------------------------------------------------------- o "navegador"
class Param {
  constructor(v = 0) {
    this.value = v
  }
  setValueAtTime(v) {
    this.value = v
  }
  linearRampToValueAtTime(v) {
    this.value = v
  }
  setTargetAtTime(v) {
    this.value = v
  }
  cancelScheduledValues() {}
}
class No {
  constructor() {
    this.saidas = []
  }
  connect(d) {
    this.saidas.push(d)
    return d
  }
  disconnect() {
    this.saidas = []
  }
}
class Fonte extends No {
  constructor() {
    super()
    this.playbackRate = new Param(1)
    this.iniciou = null
    this.parou = false
  }
  start(quando, offset) {
    this.iniciou = { quando, offset }
  }
  stop() {
    this.parou = true
  }
}
class Contexto {
  constructor() {
    this.currentTime = 0
    this.state = 'running'
    this.destination = new No()
    this.sampleRate = 48000
    this.fontes = []
    this.elementos = []
  }
  addEventListener() {}
  resume() {
    return Promise.resolve()
  }
  createGain() {
    const n = new No()
    n.gain = new Param(1)
    return n
  }
  createBiquadFilter() {
    const n = new No()
    Object.assign(n, { frequency: new Param(), gain: new Param(), Q: new Param() })
    return n
  }
  createDynamicsCompressor() {
    const n = new No()
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new Param()
    return n
  }
  createMediaElementSource(el) {
    this.elementos.push(el)
    return new No()
  }
  createBufferSource() {
    const f = new Fonte()
    this.fontes.push(f)
    return f
  }
  decodeAudioData() {
    return Promise.resolve({ duracao: 1 })
  }
  createDelay() {
    const n = new No()
    n.delayTime = new Param()
    return n
  }
  createOscillator() {
    const n = new Fonte()
    n.frequency = new Param()
    return n
  }
  createBuffer(canais, n) {
    const d = new Float32Array(n)
    return { getChannelData: () => d }
  }
}
class Audio {
  constructor() {
    this.src = ''
    this.currentTime = 0
    this.paused = true
    this.readyState = 4
    this.seeking = false
    this.playbackRate = 1
    this.preservesPitch = true
  }
  play() {
    this.paused = false
    return Promise.resolve()
  }
  pause() {
    this.paused = true
  }
  load() {}
  canPlayType(t) {
    return globalThis.__suporte?.(t) ?? (t.includes('webm') ? 'probably' : 'maybe')
  }
}
globalThis.Audio = Audio
globalThis.performance ??= { now: () => Date.now() }

const MANIFESTO = {
  versao: 1,
  taxa: 48000,
  faixas: {
    longa: { loopStart: 1.5, loopEnd: 101.5, duracao: 104, formatos: { webm: 'longa.aaaaaaaaaaaa.webm', m4a: 'longa.bbbbbbbbbbbb.m4a' } },
    curta: { loopStart: 1.5, loopEnd: 21.5, duracao: 24, formatos: { webm: 'curta.cccccccccccc.webm', m4a: 'curta.dddddddddddd.m4a' } },
  },
}
globalThis.fetch = async (url) => ({
  ok: true,
  json: async () => (url.endsWith('musicas.json') ? MANIFESTO : null),
  arrayBuffer: async () => new ArrayBuffer(8),
})

const M = await import('../musica.js')
let ctx
beforeEach(() => {
  M._reiniciarParaTeste()
  ctx = new Contexto()
})
afterEach(() => M._reiniciarParaTeste())
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------- testes
test('formato pelo canPlayType: Opus só com "probably"; senão AAC', () => {
  assert.equal(M.escolherFormato(new Audio()), 'webm')
  globalThis.__suporte = (t) => (t.includes('webm') ? 'maybe' : 'probably')
  assert.equal(M.escolherFormato(new Audio()), 'm4a')
  globalThis.__suporte = () => ''
  assert.equal(M.escolherFormato(new Audio()), 'm4a')
  globalThis.__suporte = undefined
})

test('existe: pelo manifesto (nome ou caminho antigo .mid)', async () => {
  assert.equal(await M.existeMidi('longa'), true)
  assert.equal(await M.existeMidi('assets/musicas/curta.mid'), true)
  assert.equal(await M.existeMidi('nada'), false)
  assert.equal(await M.tocarMidi(ctx, 'nada'), false)
})

test('curta: AudioBuffer com loopStart/loopEnd; longa: <audio> no loopStart', async () => {
  assert.equal(await M.tocarMidi(ctx, 'curta'), true)
  const f = ctx.fontes.at(-1)
  assert.equal(M.estadoMidi().modo, 'buffer')
  assert.equal(f.loop, true)
  assert.equal(f.loopStart, 1.5)
  assert.equal(f.loopEnd, 21.5)
  assert.equal(f.iniciou.offset, 1.5)
  await M.tocarMidi(ctx, 'longa')
  assert.equal(M.estadoMidi().modo, 'elemento')
  const el = ctx.elementos.at(-1)
  assert.match(el.src, /render\/longa\.aaaaaaaaaaaa\.webm$/)
  assert.equal(el.currentTime, 1.5)
  assert.equal(el.paused, false)
  assert.ok(f.parou, 'o buffer anterior parou')
})

test('andamento (morte súbita): playbackRate com o tom preservado', async () => {
  await M.tocarMidi(ctx, 'longa')
  const el = ctx.elementos.at(-1)
  M.setVelocidadeMidi(1.24, 0)
  assert.equal(el.playbackRate, 1.24)
  assert.equal(el.preservesPitch, true)
  assert.equal(M.estadoMidi().velocidade, 1.24)
  // vale para a próxima música
  M.pararMidi()
  await M.tocarMidi(ctx, 'longa')
  assert.equal(ctx.elementos.at(-1).playbackRate, 1.24)
})

test('COGUMELO: tom e andamento juntos (sem preservar o tom), por cima da morte súbita', async () => {
  await M.tocarMidi(ctx, 'longa')
  const el = ctx.elementos.at(-1)
  M.setVelocidadeMidi(1.2, 0)
  M.setTomMidi(-6, 0)
  assert.ok(Math.abs(el.playbackRate - 1.2 * 2 ** (-6 / 12)) < 1e-9)
  assert.equal(el.preservesPitch, false)
  M.setTomMidi(6, 0)
  assert.ok(Math.abs(el.playbackRate - 1.2 * Math.SQRT2) < 1e-9)
  M.setTomMidi(0, 0)
  assert.ok(Math.abs(el.playbackRate - 1.2) < 1e-9)
  assert.equal(el.preservesPitch, true)
})

test('COGUMELO no AudioBuffer: o playbackRate do buffer, e a rampa desliza até o fim', async () => {
  await M.tocarMidi(ctx, 'curta')
  const f = ctx.fontes.at(-1)
  M.setTomMidi(6) // rampa de ~0,45 s
  await espera(80)
  const meio = f.playbackRate.value
  assert.ok(meio > 1 && meio < Math.SQRT2, `no meio da rampa: ${meio}`)
  await espera(500)
  assert.ok(Math.abs(f.playbackRate.value - Math.SQRT2) < 1e-9)
  assert.equal(M.estadoMidi().tom, 6)
})

test('curta + andamento: passa para <audio> alinhado (o tom continua preservado)', async () => {
  await M.tocarMidi(ctx, 'curta')
  const buffer = ctx.fontes.at(-1)
  M.setVelocidadeMidi(1.3, 0)
  const el = ctx.elementos.at(-1)
  assert.ok(el, 'criou a voz <audio>')
  assert.equal(M.estadoMidi().modo, 'buffer') // até alinhar
  el.currentTime = 1.5 + M.tempoMidi() // alinhada com o buffer
  await espera(120)
  assert.equal(M.estadoMidi().modo, 'elemento')
  assert.equal(el.playbackRate, 1.3)
  assert.equal(el.preservesPitch, true)
  await espera(150)
  assert.ok(buffer.parou)
})

test('posição: tempoMidi() é o segundo dentro do loop, e tocarMidi(..., { inicio }) volta nele', async () => {
  await M.tocarMidi(ctx, 'longa')
  const el = ctx.elementos.at(-1)
  el.currentTime = 1.5 + 42.25
  assert.equal(M.tempoMidi(), 42.25)
  M.pararMidi()
  await M.tocarMidi(ctx, 'longa', { inicio: 42.25 })
  assert.equal(ctx.elementos.at(-1).currentTime, 1.5 + 42.25)
  // buffer: pelo relógio do contexto
  await M.tocarMidi(ctx, 'curta', { inicio: 5 })
  assert.equal(ctx.fontes.at(-1).iniciou.offset, 6.5)
  ctx.currentTime += 2
  assert.equal(M.tempoMidi(), 7)
})

test('pause e corte: congelam no lugar e voltam do mesmo ponto', async () => {
  await M.tocarMidi(ctx, 'longa')
  const el = ctx.elementos.at(-1)
  M.pausarMidi()
  await espera(150)
  assert.equal(el.paused, true)
  M.retomarMidi()
  assert.equal(el.paused, false)
  M.cortarMidi(true)
  await espera(60)
  assert.equal(el.paused, true)
  assert.equal(M.estadoMidi().cortada, true)
  M.cortarMidi(false)
  assert.equal(el.paused, false)
})

test('contexto suspenso (aba escondida, antes do 1º gesto): o <audio> não anda', async () => {
  ctx.state = 'suspended'
  await M.tocarMidi(ctx, 'longa')
  const el = ctx.elementos.at(-1)
  assert.equal(el.paused, true)
  ctx.state = 'running'
  M._faixaParaTeste().atualizar()
  assert.equal(el.paused, false)
})

test('emenda do <audio>: perto do loopEnd a 2ª voz entra alinhada e assume', async () => {
  await M.tocarMidi(ctx, 'longa')
  const faixa = M._faixaParaTeste()
  const a = faixa.a
  a.el.currentTime = 100.6 // 0,9 s antes do loopEnd
  faixa.tique()
  const b = faixa.b
  assert.ok(b && b !== a, 'pegou a 2ª voz')
  assert.ok(Math.abs(b.el.currentTime - (100.6 - 100 + 0.03)) < 1e-9, 'no ponto equivalente antes do loopStart')
  assert.equal(b.g.gain.value, 0, 'muda')
  // desalinhada 20 ms: empurra o andamento da voz muda
  b.el.currentTime = 0.6 + 0.02
  faixa.tique()
  assert.ok(b.el.playbackRate < 1, `atrasa a voz adiantada (${b.el.playbackRate})`)
  // alinhada: crossfade, a 2ª vira a principal
  b.el.currentTime = 0.6
  faixa.tique()
  assert.equal(faixa.a, b)
  assert.equal(b.el.playbackRate, 1)
  assert.equal(b.g.gain.value, 1)
  assert.equal(a.g.gain.value, 0)
  await espera(150)
  assert.equal(a.el.paused, true)
  assert.equal(a.livre, true)
})

test('emenda: a 2ª voz começou muito longe (celular lento): busca de novo e aprende a latência', async () => {
  await M.tocarMidi(ctx, 'longa')
  const faixa = M._faixaParaTeste()
  faixa.a.el.currentTime = 100.6
  faixa.tique()
  const b = faixa.b
  b.el.currentTime = 0.6 - 0.2 // 200 ms atrasada: o empurrão de 15% levaria segundos
  faixa.tique()
  assert.ok(Math.abs(b.el.currentTime - (0.6 + 0.03)) < 1e-9, 'buscou o ponto certo + a latência')
  b.el.currentTime = 0.6 - 0.05 // a busca atrasou 80 ms além do previsto
  faixa.tique() // aprende (0,03 + 0,05) e, ainda longe, busca de novo com a latência nova
  assert.ok(Math.abs(b.el.currentTime - (0.6 + 0.08)) < 1e-9, `${b.el.currentTime}`)
})

test('emenda: se o vigia atrasou até o fim do arquivo, volta seco um período', async () => {
  await M.tocarMidi(ctx, 'longa')
  const faixa = M._faixaParaTeste()
  faixa.a.el.currentTime = 103.95
  faixa.tique()
  assert.ok(Math.abs(faixa.a.el.currentTime - 3.95) < 1e-9)
})

test('destravar (iPhone): o pool de <audio> toca silêncio no gesto', () => {
  M.destravarMusica(ctx)
  assert.equal(ctx.elementos.length, M.POOL_VOZES)
  for (const el of ctx.elementos) {
    assert.match(el.src, /^data:audio\/wav/)
    assert.equal(el.paused, false)
  }
})

test('pré-carregar: a curta já fica decodificada; a longa vai para o cache HTTP', async () => {
  const pedidos = []
  const antes = globalThis.fetch
  globalThis.fetch = async (url, op) => {
    pedidos.push(url)
    return antes(url, op)
  }
  assert.equal(await M.preCarregarMidi(ctx, 'curta'), true)
  assert.equal(await M.preCarregarMidi(ctx, 'longa'), true)
  assert.equal(await M.preCarregarMidi(ctx, 'nada'), false)
  globalThis.fetch = antes
  assert.ok(pedidos.some((u) => u.endsWith('curta.cccccccccccc.webm')))
  assert.ok(pedidos.some((u) => u.endsWith('longa.aaaaaaaaaaaa.webm')))
  // tocar a curta depois não baixa de novo
  const n = pedidos.length
  await M.tocarMidi(ctx, 'curta')
  assert.equal(pedidos.length, n)
})

test('fita e graves continuam na cadeia', async () => {
  await M.tocarMidi(ctx, 'longa')
  M.setGraveMidi(6, 0)
  M.setFitaMidi({ corte: 650 }, 0)
  M.setFitaMidi()
  assert.equal(M.estadoMidi().tocando, 'longa')
})

test('costura do AudioBuffer: o salto do loopEnd ao loopStart continua exatamente a música', () => {
  // 1 kHz de taxa: loop de 1,5 s a 3,5 s; o "codec" deixou o começo do loop diferente da margem
  const d = Float32Array.from({ length: 6000 }, (_, i) => Math.sin(i / 7) + (i >= 1500 && i < 1600 ? 0.3 : 0))
  const buffer = { sampleRate: 1000, length: d.length, numberOfChannels: 1, getChannelData: () => d }
  M.costurarBuffer(buffer, { loopStart: 1.5, loopEnd: 3.5 })
  // a amostra que toca depois de d[3499] é d[1500]: igual à continuação de verdade d[3500]
  assert.ok(Math.abs(d[1500] - d[3500]) < 1e-6)
  assert.ok(Math.abs(d[1509] - (0.1 * d[3509] + 0.9 * (Math.sin(1509 / 7) + 0.3))) < 1e-6)
  assert.ok(Math.abs(d[1520] - (Math.sin(1520 / 7) + 0.3)) < 1e-6, 'depois dos 10 ms não mexe')
})
