import { test } from 'node:test'
import assert from 'node:assert/strict'
import { novoPlacar, normalizarPlacar, registrarFfa, registrarDupla, registrarCoop, ranking, lider, manchete } from '../placar.js'

test('todos contra todos: 3/2/1/0 pela classificação e a vitória do 1º', () => {
  const p = registrarFfa(novoPlacar(), { id: 'a', classificacao: [2, 0, 3, 1] })
  assert.deepEqual(p.pontos, { 2: 3, 0: 2, 3: 1, 1: 0 })
  assert.deepEqual(p.vitorias, { 2: 1 })
  assert.deepEqual(p.sequencia, { 2: 1, 0: 0, 3: 0, 1: 0 })
  assert.equal(p.partidas, 1)
  assert.deepEqual(p.ganho, { 2: 3, 0: 2, 3: 1, 1: 0 })
})

test('a mesma partida não soma duas vezes', () => {
  const p = registrarFfa(novoPlacar(), { id: 'a', classificacao: [0, 1, 2] })
  assert.deepEqual(registrarFfa(p, { id: 'a', classificacao: [0, 1, 2] }), p)
})

test('2x2: o time vencedor leva 3 cada; empate 1 para todos', () => {
  const p = registrarDupla(novoPlacar(), { id: 'a', times: [0, 0, 1, 1], vencedorTime: 1 })
  assert.deepEqual(p.pontos, { 0: 0, 1: 0, 2: 3, 3: 3 })
  assert.deepEqual(p.vitorias, { 2: 1, 3: 1 })
  const e = registrarDupla(p, { id: 'b', times: [0, 1, 0, 1], vencedorTime: null })
  assert.deepEqual(e.pontos, { 0: 1, 1: 1, 2: 4, 3: 4 })
  assert.deepEqual(e.sequencia, { 0: 0, 1: 0, 2: 0, 3: 0 })
})

test('co-op: chefe derrotado dá 2 para todos e conta o chefe', () => {
  const p = registrarCoop(novoPlacar(), { id: 'a', vagas: [0, 1, 2], venceu: true })
  assert.deepEqual(p.pontos, { 0: 2, 1: 2, 2: 2 })
  assert.equal(p.chefes, 1)
  const q = registrarCoop(p, { id: 'b', vagas: [0, 1, 2], venceu: false })
  assert.deepEqual(q.pontos, p.pontos)
  assert.equal(q.chefes, 1)
  assert.deepEqual(q.sequencia, { 0: 0, 1: 0, 2: 0 })
})

test('sequência cresce com vitórias seguidas e zera na derrota', () => {
  let p = novoPlacar()
  p = registrarFfa(p, { id: 'a', classificacao: [1, 0, 2] })
  p = registrarFfa(p, { id: 'b', classificacao: [1, 2, 0] })
  assert.equal(p.sequencia[1], 2)
  assert.match(manchete(p, [0, 1, 2], (v) => `J${v}`), /J1 está EM CHAMAS: 2/)
  p = registrarFfa(p, { id: 'c', classificacao: [0, 1, 2] })
  assert.equal(p.sequencia[1], 0)
})

test('ranking, líder e empate no topo', () => {
  const p = registrarFfa(novoPlacar(), { id: 'a', classificacao: [3, 1, 0, 2] })
  assert.deepEqual(ranking(p, [0, 1, 2, 3]), [3, 1, 0, 2])
  assert.equal(lider(p, [0, 1, 2, 3]), 3)
  assert.equal(lider(novoPlacar(), [0, 1, 2]), null)
  const empate = registrarDupla(novoPlacar(), { id: 'a', times: [0, 0, 1, 1], vencedorTime: 0 })
  assert.equal(lider(empate, [0, 1, 2, 3]), null)
  assert.match(manchete(empate, [0, 1, 2, 3]), /empate no topo/)
})

test('manchete da primeira partida e placar torto vindo da rede', () => {
  assert.match(manchete(novoPlacar(), [0, 1, 2]), /primeira partida/)
  const n = normalizarPlacar({ partidas: 'x', pontos: { 0: 2, a: 3, 1: 'y' } })
  assert.deepEqual(n.pontos, { 0: 2 })
  assert.equal(n.partidas, 0)
  assert.deepEqual(normalizarPlacar(null), novoPlacar())
})
