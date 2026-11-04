// node --test src/game/manual/__tests__/confete.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarRng } from '../../pvp/baralho.js'
import { gerarConfete, passoConfete, viradaDaPeca, CHAO } from '../confete.js'

test('confete: determinístico, sobe primeiro, cai e some da tela', () => {
  const a = gerarConfete(criarRng('c'), 20, 400, 200)
  assert.deepEqual(a, gerarConfete(criarRng('c'), 20, 400, 200))
  assert.equal(a.length, 20)
  assert.ok(a.every((p) => p.vy < 0), 'sai para cima')
  let pecas = a
  pecas = passoConfete(pecas, 50)
  assert.ok(pecas.some((p) => p.y < 200))
  for (let i = 0; i < 400 && pecas.length; i++) pecas = passoConfete(pecas, 50)
  assert.equal(pecas.length, 0, 'todas caíram abaixo do chão')
  for (const p of a) {
    assert.ok(p.y >= CHAO)
    const v = viradaDaPeca(p)
    assert.ok(v >= -1 && v <= 1)
  }
})

test('confete: a queda é lenta (papel), nunca mais de 150 px/s', () => {
  let pecas = gerarConfete(criarRng('d'), 5, 400, 100)
  for (let i = 0; i < 60; i++) pecas = passoConfete(pecas, 50)
  assert.ok(pecas.every((p) => p.vy <= 150))
})
