// node --test src/game/pvp/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decidir, alvoDoBot, podeAcertar, direcao8, difAngulo, BotDuelo, NIVEIS_DUELO } from '../bonus/botDuelo.js'

const LIMITES = { left: 115, right: 525, top: 96, bottom: 304 }
const sempre = () => 0 // rng: sempre o menor valor (gatilho/erro decididos pelo cfg)
const nunca = () => 0.999

function estado({ eu = {}, inimigo = {}, perigos = [] } = {}) {
  return {
    eu: { x: 200, y: 200, dir: { x: 1, y: 0 }, arma: 'tiro', pronto: true, velocidade: 180, alcance: 320, ...eu },
    inimigo: { x: 440, y: 200, ko: false, arma: 'tiro', pronto: true, alcance: 320, ...inimigo },
    limites: LIMITES,
    perigos,
    hitbox: 6,
  }
}

const semErro = { ...NIVEIS_DUELO.dificil, erro: 0, gatilho: 1 }

test('direcao8 e difAngulo', () => {
  assert.deepEqual(direcao8(0), { x: 1, y: 0 })
  assert.deepEqual(direcao8(Math.PI), { x: -1, y: 0 })
  assert.deepEqual(direcao8(Math.PI / 2 + 0.1), { x: 0, y: 1 })
  assert.ok(Math.abs(difAngulo(Math.PI - 0.1, -Math.PI + 0.1) + 0.2) < 1e-9)
})

test('tiro: inimigo alinhado na horizontal -> atira virado para ele', () => {
  const r = decidir(estado(), semErro, sempre)
  assert.equal(r.atacar, true)
  assert.ok(r.joy.x > 0 && r.joy.y === 0)
})

test('tiro: fora de alinhamento não atira e anda para alinhar', () => {
  const s = estado({ inimigo: { x: 440, y: 260 } })
  assert.equal(podeAcertar(s, semErro), false)
  const r = decidir(s, semErro, sempre)
  assert.equal(r.atacar, false)
  const alvo = alvoDoBot(s)
  // o alvo é um ponto alinhado com o inimigo (mesma linha, coluna ou diagonal)
  const dx = Math.abs(alvo.x - 440)
  const dy = Math.abs(alvo.y - 260)
  assert.ok(dx < 1 || dy < 1 || Math.abs(dx - dy) < 1, `alvo ${JSON.stringify(alvo)}`)
})

test('arma recarregando: não ataca', () => {
  const r = decidir(estado({ eu: { pronto: false } }), semErro, sempre)
  assert.equal(r.atacar, false)
})

test('espada: longe se aproxima; perto golpeia', () => {
  const longe = estado({ eu: { arma: 'espada', alcance: 40 } })
  const r1 = decidir(longe, semErro, sempre)
  assert.equal(r1.atacar, false)
  assert.ok(r1.joy.x > 50, `deveria ir para a direita: ${JSON.stringify(r1.joy)}`)
  const perto = estado({ eu: { arma: 'espada', alcance: 40 }, inimigo: { x: 230, y: 210 } })
  assert.equal(decidir(perto, semErro, sempre).atacar, true)
})

test('explosao: com a própria bomba no chão, foge dela', () => {
  const s = estado({
    eu: { arma: 'explosao', pronto: false, alcance: 90, x: 300, y: 200 },
    inimigo: { x: 480, y: 200 },
    perigos: [{ x: 320, y: 200, raio: 48, desdeMs: 100, ateMs: 400, bomba: true, minha: true, peso: 1.5 }],
  })
  const r = decidir(s, semErro, nunca)
  assert.equal(r.atacar, false)
  assert.ok(r.joy.x < 0, `deveria fugir para a esquerda: ${JSON.stringify(r.joy)}`)
})

test('desvia de tiro vindo na direção dele', () => {
  // inimigo longe na diagonal (não dá para atacar) e um tiro vindo reto
  const s = estado({ eu: { pronto: false }, inimigo: { x: 480, y: 120 }, perigos: [{ x: 260, y: 200, vx: -300, vy: 0, raio: 4 }] })
  const r = decidir(s, semErro, nunca)
  assert.ok(Math.abs(r.joy.y) > 30, `deveria sair da linha do tiro: ${JSON.stringify(r.joy)}`)
})

test('inimigo nocauteado: não ataca', () => {
  const r = decidir(estado({ inimigo: { ko: true } }), semErro, sempre)
  assert.equal(r.atacar, false)
})

test('BotDuelo: tempo de reação segura a decisão', () => {
  const bot = new BotDuelo({ nivel: 'normal', rng: () => 0.5 })
  const s = estado({ eu: { pronto: false }, inimigo: { x: 440, y: 260 } })
  const r1 = bot.atualizar(16, s)
  const r2 = bot.atualizar(16, s)
  assert.deepEqual(r2.joy, r1.joy)
  assert.equal(r2.atacar, false)
  // joystick sempre dentro de -100..100
  for (let k = 0; k < 50; k++) {
    const r = bot.atualizar(50, s)
    assert.ok(Math.abs(r.joy.x) <= 100 && Math.abs(r.joy.y) <= 100)
  }
})

test('fácil hesita mais que difícil', () => {
  const s = estado()
  const conta = (nivel) => {
    let n = 0
    let semente = 1
    const rng = () => ((semente = (semente * 16807) % 2147483647) / 2147483647)
    for (let k = 0; k < 400; k++) if (decidir(s, NIVEIS_DUELO[nivel], rng).atacar) n++
    return n
  }
  assert.ok(conta('facil') < conta('dificil'))
})
