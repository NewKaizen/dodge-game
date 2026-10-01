// node --test src/game/pvp/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarRng, aleatorio, embaralhar, criarBaralho, comprar, completarMao, descartar, reembaralhar, totalDeCartas, MAO } from '../baralho.js'
import { CARTAS } from '../cartas.js'

test('rng com semente é determinístico e serializável', () => {
  const a = criarRng('abc')
  const b = criarRng('abc')
  const sa = Array.from({ length: 20 }, () => aleatorio(a))
  const sb = Array.from({ length: 20 }, () => aleatorio(b))
  assert.deepEqual(sa, sb)
  assert.ok(sa.every((x) => x >= 0 && x < 1))
  assert.notDeepEqual(sa, Array.from({ length: 20 }, () => aleatorio(criarRng('abd'))))
  // continuar de um estado salvo em JSON dá a mesma sequência
  const salvo = JSON.parse(JSON.stringify(a))
  assert.equal(aleatorio(salvo), aleatorio(a))
})

test('embaralhar não perde nem duplica cartas e não muda a original', () => {
  const lista = Array.from({ length: 30 }, (_, i) => i)
  const copia = [...lista]
  const emb = embaralhar(lista, criarRng('x'))
  assert.deepEqual(lista, copia)
  assert.deepEqual([...emb].sort((p, q) => p - q), lista)
  assert.notDeepEqual(emb, lista)
})

test('baralho com a mesma semente tem a mesma ordem; semente diferente muda', () => {
  const a = criarBaralho('kris', 's1')
  const b = criarBaralho('kris', 's1')
  const c = criarBaralho('kris', 's2')
  assert.deepEqual(a.monte.map((x) => x.id), b.monte.map((x) => x.id))
  assert.notDeepEqual(a.monte.map((x) => x.id), c.monte.map((x) => x.id))
  assert.equal(a.monte.length, CARTAS.kris.length)
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a) // serializável
})

test('completarMao compra até 5 e não passa disso', () => {
  const b = criarBaralho('susie', 'm')
  const topo = b.monte.slice(0, 5).map((c) => c.id)
  const compradas = completarMao(b)
  assert.deepEqual(compradas.map((c) => c.id), topo)
  assert.equal(b.mao.length, MAO.tamanho)
  assert.equal(completarMao(b).length, 0)
  descartar(b, b.mao[0].id)
  assert.equal(completarMao(b).length, 1)
  assert.equal(b.mao.length, 5)
  assert.equal(b.descarte.length, 1)
})

test('compra extra respeita MAO.maxima', () => {
  const b = criarBaralho('ralsei', 'm')
  completarMao(b)
  comprar(b, 10)
  assert.equal(b.mao.length, MAO.maxima)
})

test('monte vazio: o descarte é reembaralhado e vira o monte', () => {
  const b = criarBaralho('dess', 'r')
  const total = totalDeCartas(b)
  // joga a mão inteira várias vezes até o monte acabar
  for (let rodada = 0; rodada < 12; rodada++) {
    completarMao(b)
    for (const c of [...b.mao].slice(0, 3)) descartar(b, c.id)
    assert.equal(totalDeCartas(b), total)
  }
  assert.ok(b.reembaralhos >= 1)
  const ids = [...b.monte, ...b.mao, ...b.descarte].map((c) => c.id)
  assert.equal(new Set(ids).size, total)
})

test('reembaralho é determinístico com a mesma semente', () => {
  const rodar = () => {
    const b = criarBaralho('noelle', 'det')
    const ordem = []
    for (let k = 0; k < 40; k++) {
      completarMao(b)
      const c = b.mao[0]
      ordem.push(c.id)
      descartar(b, c.id)
    }
    return ordem
  }
  assert.deepEqual(rodar(), rodar())
})

test('sem descarte e sem monte, comprar não quebra', () => {
  const b = criarBaralho('kris', 'v')
  comprar(b, 100, 100)
  assert.equal(b.monte.length, 0)
  assert.equal(reembaralhar(b), false)
  assert.deepEqual(comprar(b, 1, 100), [])
})
