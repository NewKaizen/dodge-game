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

test('vinheta: 0 no meio, sobe para os cantos, nunca passa de 1', async () => {
  const { vinheta } = await import('../papel.js')
  assert.ok(vinheta(427, 240, 854, 480) < 0.01)
  assert.ok(vinheta(0, 0, 854, 480) > vinheta(200, 120, 854, 480))
  for (const [x, y] of [[0, 0], [854, 480], [0, 480], [427, 0]]) assert.ok(vinheta(x, y, 854, 480) <= 1)
})

test('fibras e furos da espiral: determinísticos e dentro da folha', async () => {
  const { fibrasDoPapel, furosDaEspiral } = await import('../papel.js')
  const a = fibrasDoPapel('s', 50, 300, 200)
  assert.deepEqual(a, fibrasDoPapel('s', 50, 300, 200))
  assert.ok(a.every((f) => f.x >= 0 && f.x <= 300 && f.y >= 0 && f.y <= 200 && f.comprimento > 0))
  const furos = furosDaEspiral(480, { topo: 20, passo: 30, base: 20 })
  assert.equal(furos[0], 20)
  assert.ok(furos.every((y, i) => i === 0 || y - furos[i - 1] === 30))
  assert.ok(furos[furos.length - 1] <= 460)
})
