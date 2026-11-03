import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gerarPapel, PAPEL_BASE } from '../papel.js'

test('papel: determinístico, opaco e perto do creme', () => {
  const a = gerarPapel(64, 48, 's')
  const b = gerarPapel(64, 48, 's')
  const c = gerarPapel(64, 48, 't')
  assert.equal(a.length, 64 * 48 * 4)
  assert.deepEqual(a, b)
  assert.notDeepEqual(a, c)
  let soma = 0
  for (let i = 0; i < a.length; i += 4) {
    assert.equal(a[i + 3], 255)
    soma += a[i]
  }
  const media = soma / (64 * 48)
  assert.ok(Math.abs(media - PAPEL_BASE[0]) < 20, `média do vermelho ${media}`)
})
