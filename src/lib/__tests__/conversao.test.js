import { test } from 'node:test'
import assert from 'node:assert/strict'
import { linhaVida } from '../conversao.js'

// ---------- VIDA <hpAtual> <hpMaximo> ----------

test('exemplos do protocolo', () => {
  assert.equal(linhaVida(0, 40, 80), '1 VIDA 40 80')
  assert.equal(linhaVida(0, 150, 200), '1 VIDA 150 200')
  assert.equal(linhaVida(1, 25, 50), '2 VIDA 25 50')
  assert.equal(linhaVida(1, 240, 300), '2 VIDA 240 300')
  assert.equal(linhaVida(0, 0, 200), '1 VIDA 0 200')
})

test('HP fora da faixa fica entre 0 e o máximo, inteiro', () => {
  assert.equal(linhaVida(0, -5, 80), '1 VIDA 0 80')
  assert.equal(linhaVida(0, 120, 100), '1 VIDA 100 100')
  assert.equal(linhaVida(0, 33.4, 100), '1 VIDA 33 100')
})

test('HP máximo inválido ou HP lixo não mandam nada', () => {
  assert.equal(linhaVida(0, 10, 0), null)
  assert.equal(linhaVida(0, 10, undefined), null)
  assert.equal(linhaVida(0, NaN, 100), null)
})
