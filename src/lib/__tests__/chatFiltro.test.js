import { test } from 'node:test'
import assert from 'node:assert/strict'
import { censurarTexto } from '../palavrasBloqueadas.js'

test('chat: troca a palavra da lista por asteriscos e mantém o resto', () => {
  assert.equal(censurarTexto('boa partida, seu fdp'), 'boa partida, seu ***')
  assert.equal(censurarTexto('que BOSTA!'), 'que *****!')
  assert.equal(censurarTexto('c4r4lh0 que jogo'), '******* que jogo')
  assert.equal(censurarTexto('c.a.r.a.l.h.o'), '*************')
})

test('chat: não pega palavra inocente que só contém uma da lista exata', () => {
  assert.equal(censurarTexto('meu computador travou'), 'meu computador travou')
  assert.equal(censurarTexto('disputa boa'), 'disputa boa')
  assert.equal(censurarTexto('GG, revanche?'), 'GG, revanche?')
})

test('chat: acentos e emoji não quebram o tamanho', () => {
  assert.equal(censurarTexto('ótimo 😀 puta'), 'ótimo 😀 ****')
})
