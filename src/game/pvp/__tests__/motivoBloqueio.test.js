// node --test src/game/pvp/__tests__/motivoBloqueio.test.js
// Por que uma carta não pode ser jogada: fonte única da regra e da tela.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarPartida, iniciarRodada, podeJogar, cartasJogaveis, motivoBloqueio } from '../regras.js'
import { podeJogarDuelo, motivoBloqueioDuelo } from '../bonus.js'
import { criarPartidaCoop, iniciarRodadaCoop, podeJogarCoop, motivoBloqueioCoop } from '../../coop/regras.js'

function naMao(estado, j, id) {
  const b = estado.jogadores[j].baralho
  for (const pilha of ['monte', 'descarte', 'mao']) {
    const i = b[pilha].findIndex((c) => c.id === id)
    if (i >= 0) {
      const [c] = b[pilha].splice(i, 1)
      b.mao.push(c)
      return c
    }
  }
  throw new Error(`carta ${id} não existe`)
}

function partida(energia) {
  const e = criarPartida({ p1: 'kris', p2: 'susie', semente: 'motivo' })
  iniciarRodada(e)
  e.jogadores.forEach((j) => (j.energia = energia))
  return e
}

test('carta que cabe na energia: sem bloqueio', () => {
  const e = partida(5)
  const k = naMao(e, 0, 'kris-espadas-13') // custo 5
  assert.equal(motivoBloqueio(e, 0, k.id), null)
  assert.equal(motivoBloqueio(e, 0, k), null, 'aceita o objeto da carta também')
})

test('falta energia: código, texto curto "tem/custa" e texto longo', () => {
  const e = partida(3)
  const k = naMao(e, 0, 'kris-espadas-13')
  const m = motivoBloqueio(e, 0, k.id)
  assert.equal(m.codigo, 'sem-energia')
  assert.equal(m.curto, 'falta energia (3/5)')
  assert.match(m.motivo, /energia insuficiente \(custa 5, tem 3\)/)
})

test('carta fora da mão', () => {
  const e = partida(10)
  assert.equal(motivoBloqueio(e, 0, 'kris-paus-99').codigo, 'fora-da-mao')
  assert.equal(motivoBloqueio(e, 0, undefined).codigo, 'fora-da-mao')
})

test('podeJogar e motivoBloqueio nunca divergem (todas as cartas da mão, energia 0 a 10)', () => {
  for (let energia = 0; energia <= 10; energia++) {
    const e = partida(energia)
    for (const c of e.jogadores[0].baralho.mao) {
      const m = motivoBloqueio(e, 0, c.id)
      const v = podeJogar(e, 0, c.id)
      assert.equal(v.ok, m === null, `${c.id} com energia ${energia}`)
      if (m) assert.equal(v.motivo, m.motivo)
    }
    const jogaveis = cartasJogaveis(e, 0).map((c) => c.id).sort()
    const semBloqueio = e.jogadores[0].baralho.mao.filter((c) => motivoBloqueio(e, 0, c.id) === null).map((c) => c.id).sort()
    assert.deepEqual(jogaveis, semBloqueio)
  }
})

test('passar a vez nunca é bloqueado', () => {
  assert.equal(podeJogar(partida(0), 0, null).ok, true)
})

test('duelo: nada custa energia, só a carta estar na mão', () => {
  const e = partida(0)
  const k = naMao(e, 0, 'kris-espadas-13')
  assert.equal(motivoBloqueioDuelo(e, 0, k.id), null)
  assert.equal(podeJogarDuelo(e, 0, k.id).ok, true)
  assert.equal(podeJogarDuelo(e, 0, 'kris-paus-99').ok, false)
})

test('CO-OP: caído vem na frente; o resto é igual ao PVP', () => {
  const e = criarPartidaCoop({ party: ['kris', 'susie'], chefe: 'king', semente: 'motivo' })
  iniciarRodadaCoop(e)
  e.jogadores.forEach((j) => (j.energia = 2))
  const k = naMao(e, 0, 'kris-espadas-13')
  assert.equal(motivoBloqueioCoop(e, 0, k.id).curto, 'falta energia (2/5)')
  assert.equal(podeJogarCoop(e, 0, k.id).ok, false)
  e.jogadores[0].caido = true
  assert.equal(motivoBloqueioCoop(e, 0, k.id).codigo, 'caido')
  assert.equal(podeJogarCoop(e, 0, k.id).motivo, 'caído')
  assert.equal(podeJogarCoop(e, 0, null).ok, true)
})
