import { test } from 'node:test'
import assert from 'node:assert/strict'
import { novoAceiteN, registrarN, decidirN, expirouN, restanteN, linhasDoAceiteN, dicaDoAceiteN, ESPERA_MS } from '../fimDePartidaN.js'

test('revanche só com TODOS de acordo; um TROCAR vale para todos', () => {
  let a = novoAceiteN()
  a = registrarN(a, 0, 'revanche', 1000)
  assert.equal(a.ate, 1000 + ESPERA_MS)
  a = registrarN(a, 2, 'revanche', 2000)
  assert.equal(decidirN(a, [0, 1, 2]), null, 'falta a vaga 1')
  assert.equal(decidirN(registrarN(a, 1, 'revanche', 3000), [0, 1, 2]), 'revanche')
  assert.equal(decidirN(registrarN(a, 1, 'trocar', 3000), [0, 1, 2]), 'trocar')
  assert.equal(a.ate, 1000 + ESPERA_MS, 'a espera começa na primeira escolha')
})

test('quem saiu da sala não segura os outros; escolha inválida não conta', () => {
  let a = registrarN(novoAceiteN(), 0, 'revanche', 0)
  a = registrarN(a, 1, 'lobby', 0)
  assert.deepEqual(a.escolhas, { 0: 'revanche' })
  a = registrarN(a, 3, 'revanche', 0)
  assert.equal(decidirN(a, [0, 1, 3]), null)
  assert.equal(decidirN(a, [0, 3]), 'revanche', 'o 1 saiu')
  assert.equal(decidirN(novoAceiteN(), []), null)
})

test('expira em 15 s; linhas e dica por vaga', () => {
  const a = registrarN(novoAceiteN(), 1, 'trocar', 0)
  assert.equal(expirouN(a, ESPERA_MS - 1), false)
  assert.equal(expirouN(a, ESPERA_MS), true)
  assert.equal(restanteN(a, 5000), 10)
  assert.deepEqual(linhasDoAceiteN(a, [0, 1]), [
    { vaga: 0, texto: 'escolhendo…', pronto: false },
    { vaga: 1, texto: 'TROCAR PERSONAGEM', pronto: true },
  ])
  assert.equal(dicaDoAceiteN(a, [0, 1, 2], 5000), 'esperando 2 jogadores (10s)')
  assert.equal(dicaDoAceiteN(novoAceiteN(), [0, 1], 0), '')
})

test('2x2: TROCAR TIME só com todos respondendo; TROCAR PERSONAGEM vale mais, depois TROCAR TIME', () => {
  let a = novoAceiteN()
  for (const v of [0, 1, 2]) a = registrarN(a, v, 'revanche', 0)
  a = registrarN(a, 3, 'trocarTime', 0)
  assert.equal(decidirN(a, [0, 1, 2, 3]), 'trocarTime')
  assert.equal(decidirN(registrarN(novoAceiteN(), 3, 'trocarTime', 0), [0, 1, 2, 3]), null, 'faltam três')
  let b = novoAceiteN()
  b = registrarN(b, 0, 'trocarTime', 0)
  b = registrarN(b, 1, 'trocar', 0)
  b = registrarN(b, 2, 'revanche', 0)
  b = registrarN(b, 3, 'revanche', 0)
  assert.equal(decidirN(b, [0, 1, 2, 3]), 'trocar')
  assert.equal(dicaDoAceiteN(a, [0, 1, 2, 3], 0), 'trocando os times…')
})
