// node --test src/game/__tests__/phaserPuro.test.js
// phaserPuro.js faz EXATAMENTE o que o Phaser faz: o gerador aleatório dá a mesma sequência para a
// mesma semente (os ataques do PvP não mudam), e as contas de geometria batem.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { Aleatorio, limitar, embrulharAngulo, contem } from '../phaserPuro.js'

// os arquivos-fonte do Phaser, pelo caminho (o pacote não exporta esses subcaminhos)
const exigir = createRequire(new URL('../../../node_modules/phaser/package.json', import.meta.url))
const RDG = exigir('./src/math/random-data-generator/RandomDataGenerator.js')
const Wrap = exigir('./src/math/angle/Wrap.js')
const Contains = exigir('./src/geom/rectangle/Contains.js')
const Clamp = exigir('./src/math/Clamp.js')

test('Aleatorio = Phaser.Math.RandomDataGenerator (mesma semente, mesma sequência)', () => {
  for (const semente of ['a', 'pvp:7:r3', '1234567890', String(2 ** 31 + 0.5), '']) {
    const p = new RDG([semente])
    const q = new Aleatorio([semente])
    for (let i = 0; i < 300; i++) {
      const k = i % 5
      if (k === 0) assert.equal(q.frac(), p.frac())
      if (k === 1) assert.equal(q.integer(), p.integer())
      if (k === 2) assert.equal(q.realInRange(-40, 90), p.realInRange(-40, 90))
      if (k === 3) assert.equal(q.between(0, 9), p.between(0, 9))
      if (k === 4) assert.equal(q.pick(['x', 'y', 'z']), p.pick(['x', 'y', 'z']))
    }
    // a sub-semente de contexto.js (String(integer()))
    assert.equal(new Aleatorio([String(q.integer())]).frac(), new RDG([String(p.integer())]).frac())
  }
})

test('limitar, embrulharAngulo e contem = Clamp, Angle.Wrap e Rectangle.Contains', () => {
  for (const v of [-5, 0, 3.3, 99]) assert.equal(limitar(v, 0, 10), Clamp(v, 0, 10))
  for (const a of [-10, -Math.PI, 0, 1, Math.PI, 7.5, 100]) assert.equal(embrulharAngulo(a), Wrap(a))
  const r = { x: 10, y: 20, width: 100, height: 50 }
  for (const [x, y] of [[10, 20], [110, 70], [111, 30], [50, 19], [60, 40]]) assert.equal(contem(r, x, y), Contains(r, x, y))
  assert.equal(contem({ x: 0, y: 0, width: 0, height: 5 }, 0, 0), false)
})
