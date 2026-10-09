// node --test src/game/pvp/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eventosDaArena } from '../arenas.js'
import { EVENTO, sortearEvento } from '../bonus.js'
import { criarRng } from '../baralho.js'

const DO_JARDIM = ['chuva', 'ventania', 'abelhas', 'vagalumes', 'polen', 'trepadeira']

test('jardim: os seis bônus da arena existem, são de esquiva e estão na lista dela', () => {
  const ids = eventosDaArena('jardim').map((e) => e.id)
  assert.ok(ids.length >= 10)
  for (const id of DO_JARDIM) {
    assert.ok(ids.includes(id), id)
    assert.equal(EVENTO[id].cartas, 'normal', id)
    assert.ok(EVENTO[id].nome === EVENTO[id].nome.toUpperCase(), `${id}: nome em caixa alta`)
  }
})

test('jardim: a roleta da arena sorteia os bônus novos', () => {
  const rng = criarRng('jardim')
  const disponiveis = eventosDaArena('jardim').map((e) => e.id)
  const vistos = new Set()
  for (let i = 0; i < 400; i++) vistos.add(sortearEvento(rng, { disponiveis }).id)
  for (const id of DO_JARDIM) assert.ok(vistos.has(id), id)
})
