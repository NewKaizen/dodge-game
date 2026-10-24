import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diferencasDeEstado, criarEspelhoCoracao } from '../rede/sincronia.js'
import { criarPartida, iniciarRodada, resolverRodada, aplicarDano } from '../regras.js'

test('diferencasDeEstado: estados iguais (cópia por JSON) não têm diferença', () => {
  const a = criarPartida({ p1: 'kris', p2: 'susie', semente: 'x' })
  iniciarRodada(a)
  const b = JSON.parse(JSON.stringify(a))
  assert.deepEqual(diferencasDeEstado(a, b), [])
})

test('diferencasDeEstado: aponta o caminho do que mudou', () => {
  const a = criarPartida({ p1: 'kris', p2: 'susie', semente: 'x' })
  iniciarRodada(a)
  const b = structuredClone(a)
  aplicarDano(b, 1, 7)
  assert.deepEqual(diferencasDeEstado(a, b), ['jogadores.1.hp'])
  b.jogadores[0].baralho.mao.pop()
  const d = diferencasDeEstado(a, b)
  assert.ok(d.includes('jogadores.0.baralho.mao.4'), d.join(','))
})

test('diferencasDeEstado: undefined e ausente são iguais; tipos diferentes contam', () => {
  assert.deepEqual(diferencasDeEstado({ a: 1, b: undefined }, { a: 1 }), [])
  assert.deepEqual(diferencasDeEstado({ a: [1] }, { a: { 0: 1 } }), ['a'])
  assert.deepEqual(diferencasDeEstado({ a: null }, { a: {} }), ['a'])
})

test('diferencasDeEstado: para no máximo pedido', () => {
  const a = { x: Array.from({ length: 20 }, (_, i) => i) }
  const b = { x: Array.from({ length: 20 }, (_, i) => -i - 1) }
  assert.equal(diferencasDeEstado(a, b, { max: 3 }).length, 3)
})

test('diferencasDeEstado: a mesma rodada resolvida nos dois dá o mesmo estado', () => {
  const host = criarPartida({ p1: 'kris', p2: 'noelle', semente: 'rede' })
  iniciarRodada(host)
  const conv = structuredClone(host)
  const jogadas = [host.jogadores[0].baralho.mao[0].id, null]
  const custo = host.jogadores[0].baralho.mao[0].custo
  if (custo > host.jogadores[0].energia) jogadas[0] = null
  resolverRodada(host, ...jogadas)
  resolverRodada(conv, ...jogadas)
  assert.deepEqual(diferencasDeEstado(host, conv), [])
})

test('espelho do coração: sem posição nenhuma devolve null', () => {
  const e = criarEspelhoCoracao({ atrasoMs: 100 })
  assert.equal(e.posicao(1000), null)
})

test('espelho do coração: interpola atrasado entre as posições que chegaram', () => {
  const e = criarEspelhoCoracao({ atrasoMs: 100 })
  e.receber(1000, { x: 0, y: 0 })
  e.receber(1100, { x: 100, y: 50 })
  // antes da 1ª (com o atraso): fica nela
  assert.deepEqual(e.posicao(1050), { x: 0, y: 0 })
  // 1150 - 100 = 1050: metade do caminho
  assert.deepEqual(e.posicao(1150), { x: 50, y: 25 })
  // passou da última: fica na última (sem adivinhar)
  assert.deepEqual(e.posicao(1500), { x: 100, y: 50 })
})

test('espelho do coração: chegadas aos trancos (jitter) ainda andam para a frente', () => {
  const e = criarEspelhoCoracao({ atrasoMs: 100 })
  // 3 posições chegam quase juntas depois de um buraco
  e.receber(0, { x: 0, y: 0 })
  e.receber(90, { x: 30, y: 0 })
  e.receber(95, { x: 60, y: 0 })
  e.receber(100, { x: 90, y: 0 })
  let antes = -Infinity
  for (let t = 100; t <= 220; t += 10) {
    const { x } = e.posicao(t)
    assert.ok(x >= antes, `voltou para trás em t=${t}`)
    antes = x
  }
  assert.equal(antes, 90)
})

test('espelho do coração: ignora posição inválida, limpar esquece tudo', () => {
  const e = criarEspelhoCoracao()
  e.receber(0, { x: NaN, y: 1 })
  e.receber(0, {})
  assert.equal(e.tamanho, 0)
  e.receber(10, { x: 1, y: 2 })
  e.receber(10, { x: 3, y: 4 }) // mesma hora: vale a mais nova
  assert.equal(e.tamanho, 1)
  assert.deepEqual(e.posicao(500), { x: 3, y: 4 })
  e.limpar()
  assert.equal(e.posicao(500), null)
})

test('espelho do coração: guarda no máximo maxAmostras', () => {
  const e = criarEspelhoCoracao({ maxAmostras: 5 })
  for (let t = 0; t < 50; t++) e.receber(t, { x: t, y: 0 })
  assert.equal(e.tamanho, 5)
})
