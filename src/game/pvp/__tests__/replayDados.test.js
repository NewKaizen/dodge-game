// node --test src/game/pvp/__tests__/replayDados.test.js
// A esquiva em tiques fixos (passoFixo.js) e o REPLAY EM DADOS (fimDePartida/gravador.js + ressimulacao.js),
// com as classes REAIS (Pista, BattleBox, Balas, Heart, ContextoAtaque e ataques de verdade) num Phaser de
// mentira (manual/__tests__/apoio):
//   - a mesma partida (mesma semente, mesma entrada por tique) com quadros de 30, 60 e 144 Hz e engasgos
//     chega ao MESMO estado (balas, corações, acertos) depois de N tiques;
//   - o que o gravador guardou (semente, opções, entrada de cada passo, acertos) refeito numa pista de mentira
//     dá o mesmo estado final e o mesmo hash, tique a tique.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { objetoDeTela } from '../../manual/__tests__/apoio/cenaDeMentira.mjs'

register('../../manual/__tests__/apoio/ganchos.mjs', import.meta.url) // `phaser` -> Phaser de mentira
const { default: Pista } = await import('../Pista.js')
const { ataques } = await import('../../attacks/index.js')
const { criarPassoFixo, PASSO_MS } = await import('../../passoFixo.js')
const { GravacaoPista } = await import('../fimDePartida/gravador.js')
const { Ressimulacao } = await import('../fimDePartida/ressimulacao.js')

function cenaDeTeste() {
  const add = new Proxy({}, { get: () => () => objetoDeTela() })
  return {
    add,
    tweens: { add: () => objetoDeTela(), addCounter: () => objetoDeTela(), chain: () => objetoDeTela(), killTweensOf() {}, isTweening: () => false },
    time: { delayedCall() {}, addEvent: () => objetoDeTela(), now: 0 },
    cache: { audio: { exists: () => false } },
    sound: { play() {} },
    registry: { get: () => undefined },
    events: { on() {}, once() {}, off() {} },
    cameras: { main: objetoDeTela(), add: () => objetoDeTela(), remove() {} },
    textures: { exists: () => false, addDynamicTexture: () => null, remove() {} }, // (sem desenho: o teste confere a simulação)
    sys: { displayList: { list: [] } },
    children: { list: [] },
  }
}

const CAIXA = { x: 300, y: 260, largura: 220, altura: 200 }
const CAMPO = { esquerda: 150, direita: 450, topo: 120, base: 400 }

// joystick por TIQUE (não por tempo de quadro): a entrada é a mesma em qualquer taxa
const joyDoTique = (n) => ({ x: Math.round(90 * Math.sin(n / 23)), y: Math.round(90 * Math.cos(n / 37)) })

// uma esquiva de `tiques` tiques com quadros de `dts`; devolve a pista, a gravação e os acertos
function jogar(ataque, dts, tiques, { semente = 'teste', gravar = false, parado = false } = {}) {
  const cena = cenaDeTeste()
  cena.passoFixo = criarPassoFixo()
  const pista = new Pista(cena, { ...CAIXA, jogador: 0, velocidade: 150, dinamica: { campo: CAMPO } })
  if (gravar) pista.gravacao = new GravacaoPista(cena)
  const acertos = []
  pista.aoAcertar = (dano, bala) => (acertos.push({ tique: cena.passoFixo.tiques, numero: bala.numero }), true)
  pista.aberta = true
  const b = pista.caixa.base
  pista.caixa.aplicar(b.x, b.y, b.largura, b.altura)
  pista.coracoes[0].mostrar(b.x, b.y + 40)
  pista.iniciarAtaque(ataque, { dano: 4, semente, ritmo: { velocidade: 1.2 }, aceleracao: 1 })
  let feitos = 0
  let q = 0
  while (feitos < tiques) {
    cena.passoFixo.avancar(dts[q++ % dts.length], () => {
      if (feitos >= tiques) return
      pista.atualizar(PASSO_MS, parado ? { x: 0, y: 0 } : joyDoTique(feitos))
      feitos++
    })
  }
  return { cena, pista, acertos }
}

// o estado da simulação de uma pista (e um hash dele)
function estado(pista) {
  const r = (v) => Math.round(v * 1e6) / 1e6
  const c = pista.coracoes[0]
  return {
    coracao: [r(c.x), r(c.y)],
    caixa: [pista.caixa.limites.x, pista.caixa.limites.y, pista.caixa.limites.width, pista.caixa.limites.height],
    tempo: r(pista.ataque?.ctx.tempo ?? -1),
    balas: pista.balas.lista.map((b) => [b.numero, r(b.x), r(b.y), r(b.vx), r(b.vy), r(b.idade), b.inofensiva ? 1 : 0]),
  }
}

function hash(e) {
  let h = 2166136261
  for (const ch of JSON.stringify(e)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

const CASOS = [
  ['aimed (mira no coração)', () => ataques.aimed()],
  ['rain (muda a caixa)', () => ataques.rain()],
  ['juntos(spiral, quicantes)', () => ataques.juntos(ataques.spiral(), ataques.quicantes())],
  ['lasers', () => ataques.lasers()],
]

const TAXAS = {
  '60 Hz': [1000 / 60],
  '30 Hz': [1000 / 30],
  '144 Hz': [1000 / 144],
  'engasgos e quadros variados': [16, 17, 33, 8, 120, 16.7, 7, 50],
}

for (const [nome, criar] of CASOS) {
  test(`passo fixo, ${nome}: o mesmo estado depois de N tiques a 30, 60 e 144 Hz e com engasgos`, () => {
    const N = 360
    const ref = estado(jogar(criar(), TAXAS['60 Hz'], N).pista)
    assert.ok(ref.balas.length > 0 || nome === 'lasers', 'o ataque já tem balas')
    for (const [taxa, dts] of Object.entries(TAXAS)) {
      const e = estado(jogar(criar(), dts, N).pista)
      assert.deepEqual(e, ref, `${taxa}`)
    }
  })

  test(`replay em dados, ${nome}: a gravação refeita dá o mesmo estado final e o mesmo hash`, () => {
    for (const parado of [false, true]) {
      const N = 420
      const live = jogar(criar(), TAXAS['engasgos e quadros variados'], N, { gravar: true, parado })
      const gravacao = live.pista.gravacao
      assert.ok(gravacao.trecho.passos >= N, 'um passo por tique (ou mais, com passos pequenos)')
      // custo: ~30 números por passo, nada de textura
      assert.ok(gravacao.trecho.dados.length <= gravacao.trecho.passos * 20, `${gravacao.trecho.dados.length} números`)
      if (parado && nome.startsWith('aimed')) assert.ok(live.acertos.length > 0, 'parado, o coração leva acertos (o replay precisa repetir)')
      const r = new Ressimulacao(live.cena, { pista: live.pista, gravacao, campo: CAMPO, ambiente: null })
      r.preparar(Infinity)
      const a = estado(live.pista)
      const b = estado(r.pista)
      assert.deepEqual(b, a, parado ? 'parado' : 'andando')
      assert.equal(hash(b), hash(a))
      assert.equal(r.tempo, gravacao.tique(gravacao.trecho.passos - 1) * PASSO_MS, 'a re-simulação chegou ao último tique')
      r.destruir()
    }
  })
}

test('replay em dados: refeito aos pedaços (como a TV anda) dá o mesmo que de uma vez', () => {
  const live = jogar(ataques.aimed(), [1000 / 60], 300, { gravar: true })
  const g = live.pista.gravacao
  const r = new Ressimulacao(live.cena, { pista: live.pista, gravacao: g, campo: CAMPO, ambiente: null })
  for (let t = 0; t <= 300 * PASSO_MS + 1; t += 7.3) r.preparar(t, 3)
  r.preparar(Infinity)
  assert.deepEqual(estado(r.pista), estado(live.pista))
})
