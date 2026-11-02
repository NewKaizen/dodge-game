// BOSS SEMANAL na party: a opção do CO-OP contra o chefe da semana (party/regras.js)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { opcoesDeModo, modoDaOpcao, MODOS_PARTY, ehPvp } from '../regras.js'

test('BOSS SEMANAL entra só com a semana do servidor, com 3 ou 4, e é um CO-OP', () => {
  assert.deepEqual(opcoesDeModo(3), ['ffa', 'coop4'])
  assert.deepEqual(opcoesDeModo(3, { semanal: true }), ['ffa', 'coop4', 'semanal'])
  assert.deepEqual(opcoesDeModo(4, { semanal: true }), ['2x2', 'ffa', 'coop4', 'semanal'])
  assert.deepEqual(opcoesDeModo(2, { semanal: true }), [])
  assert.equal(modoDaOpcao('semanal'), 'coop4')
  assert.equal(modoDaOpcao('ffa'), 'ffa')
  assert.ok(MODOS_PARTY.semanal.coop && !ehPvp('semanal'))
})
