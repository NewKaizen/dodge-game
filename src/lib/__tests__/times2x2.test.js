import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARRANJOS, lugaresDoTime } from '../times2x2.js'

test('lugaresDoTime: TIME A sempre na coluna da esquerda, TIME B na da direita, em todo arranjo', () => {
  for (const times of ARRANJOS) {
    const { celula, coluna } = lugaresDoTime(times)
    assert.deepEqual([...celula].sort(), [0, 1, 2, 3])
    assert.deepEqual([...coluna].sort(), [0, 1, 2, 3])
    times.forEach((t, v) => {
      assert.equal(celula[v] % 2, t, `célula da vaga ${v}`)
      assert.equal(coluna[v] < 2 ? 0 : 1, t, `coluna da vaga ${v}`)
    })
  }
})

test('lugaresDoTime: dentro do time, a vaga menor fica em cima / primeiro', () => {
  assert.deepEqual(lugaresDoTime([0, 0, 1, 1]), { celula: [0, 2, 1, 3], coluna: [0, 1, 2, 3] })
  assert.deepEqual(lugaresDoTime([0, 1, 1, 0]), { celula: [0, 1, 3, 2], coluna: [0, 2, 3, 1] })
  assert.deepEqual(lugaresDoTime([0, 1, 0, 1]), { celula: [0, 1, 2, 3], coluna: [0, 2, 1, 3] })
})
