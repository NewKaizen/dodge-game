// node --test src/lib/__tests__/roleta.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { construirFita, itemDaRecompensa, sortearIsca } from '../roleta.js'
import { PESOS, ESCALA, POOL_BAU, ehItemDoBau } from '../cosmeticos.js'

// gerador determinístico (mulberry32)
const semente = (s) => () => {
  s = (s + 0x6d2b79f5) | 0
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const REAL = { tipo: 'item', id: 'som.cabra', raridade: 'lendario' }

test('a carta de verdade fica exatamente no índice de parada', () => {
  for (const parada of [0, 1, 17, 58, 59]) {
    const fita = construirFita({ real: REAL, tamanho: 60, parada, rng: semente(parada + 1) })
    assert.equal(fita.length, 60)
    assert.equal(fita[parada], REAL)
  }
})

test('parada fora da fita ou tamanho ruim: erro', () => {
  assert.throws(() => construirFita({ real: REAL, tamanho: 10, parada: 10 }))
  assert.throws(() => construirFita({ real: REAL, tamanho: 10, parada: -1 }))
  assert.throws(() => construirFita({ real: REAL, tamanho: 0, parada: 0 }))
})

test('com o mesmo gerador a fita é a mesma (determinística)', () => {
  const a = construirFita({ real: REAL, tamanho: 50, parada: 30, rng: semente(42) })
  const b = construirFita({ real: REAL, tamanho: 50, parada: 30, rng: semente(42) })
  assert.deepEqual(a, b)
  const c = construirFita({ real: REAL, tamanho: 50, parada: 30, rng: semente(43) })
  assert.notDeepEqual(a, c)
})

test('as iscas são itens do catálogo e seguem as chances publicadas', () => {
  const rng = semente(7)
  const n = 40_000
  const cont = { comum: 0, raro: 0, epico: 0, lendario: 0 }
  for (let i = 0; i < n; i++) {
    const c = sortearIsca(rng)
    assert.ok(ehItemDoBau(c.id), c.id)
    assert.ok(POOL_BAU[c.raridade].includes(c.id), 'a raridade da carta é a do item')
    cont[c.raridade]++
  }
  for (const r of Object.keys(PESOS)) {
    const esperado = PESOS[r] / ESCALA
    assert.ok(Math.abs(cont[r] / n - esperado) < 0.012, `${r}: ${cont[r] / n} vs ${esperado}`)
  }
})

test('as iscas da fita também seguem as chances (a fita inteira, fora a real)', () => {
  const rng = semente(99)
  const cont = { comum: 0, raro: 0, epico: 0, lendario: 0 }
  let total = 0
  for (let k = 0; k < 400; k++) {
    const fita = construirFita({ real: { tipo: 'item', id: 'som.latido', raridade: 'comum' }, tamanho: 60, parada: 44, rng })
    fita.forEach((c, i) => {
      if (i === 44) return
      cont[c.raridade]++
      total++
    })
  }
  assert.ok(Math.abs(cont.comum / total - 0.6) < 0.03)
  assert.ok(Math.abs(cont.lendario / total - 0.02) < 0.01)
})

test('sem cartas iguais lado a lado nem a carta de verdade em volta dela', () => {
  const fita = construirFita({ real: REAL, tamanho: 80, parada: 50, rng: semente(5) })
  for (let i = 1; i < fita.length; i++) assert.notEqual(fita[i].id, fita[i - 1].id)
  assert.notEqual(fita[49].id, REAL.id)
  assert.notEqual(fita[51].id, REAL.id)
})

test('itemDaRecompensa: item, duplicado e xp', () => {
  assert.deepEqual(itemDaRecompensa({ tipo: 'item', id: 'som.latido', raridade: 'comum' }), { tipo: 'item', id: 'som.latido', raridade: 'comum' })
  assert.deepEqual(itemDaRecompensa({ tipo: 'duplicado', id: 'som.latido', raridade: 'comum', xp: 15 }), { tipo: 'item', id: 'som.latido', raridade: 'comum', duplicado: true, xp: 15 })
  assert.deepEqual(itemDaRecompensa({ tipo: 'xp', raridade: 'raro', xp: 50 }), { tipo: 'xp', raridade: 'raro', xp: 50 })
})
