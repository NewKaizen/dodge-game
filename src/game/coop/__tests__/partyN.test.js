// A party do CO-OP de 3 e 4: node --test src/game/coop/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarParty, avisoRepetido } from '../partyN.js'

const IDS = ['kris', 'susie', 'ralsei', 'dess', 'noelle', 'asriel']

test('cada um escolhe o seu, sem repetir: o primeiro pedido leva', () => {
  const p = criarParty({ vagas: 4 })
  assert.deepEqual(p.confirmar(2, 'kris', IDS), { ok: true })
  assert.deepEqual(p.confirmar(0, 'kris', IDS), { ok: false, motivo: 'repetido' })
  assert.deepEqual(p.confirmar(0, 'susie', IDS), { ok: true })
  assert.deepEqual(p.confirmar(0, 'dess', IDS), { ok: false, motivo: 'ja_confirmou' }, 'confirmar é definitivo')
  assert.deepEqual(p.confirmar(1, 'fantasma', IDS), { ok: false, motivo: 'invalido' })
  assert.deepEqual(p.confirmar(7, 'dess', IDS), { ok: false, motivo: 'invalido' })
  assert.deepEqual(p.confirmados, ['susie', null, 'kris', null])
})

test('a party está completa quando todas as vagas que estão na sala confirmaram', () => {
  const p = criarParty({ vagas: 4 })
  p.confirmar(0, 'kris', IDS)
  p.confirmar(1, 'susie', IDS)
  p.confirmar(3, 'dess', IDS)
  assert.equal(p.completa([0, 1, 2, 3]), false)
  assert.equal(p.completa([0, 1, 3]), true, 'a vaga 2 saiu da sala')
  assert.equal(p.completa([]), false)
})

test('a lista da luta é por vaga e quem saiu antes de escolher fica com um personagem que ninguém pegou', () => {
  const p = criarParty({ vagas: 4 })
  p.confirmar(0, 'susie', IDS)
  p.confirmar(2, 'kris', IDS)
  p.confirmar(3, 'ralsei', IDS)
  const lista = p.lista(IDS)
  assert.deepEqual(lista.slice(0, 1), ['susie'])
  assert.equal(lista[2], 'kris')
  assert.equal(lista[3], 'ralsei')
  assert.ok(!['susie', 'kris', 'ralsei'].includes(lista[1]), 'a vaga 1 ganha um que sobrou')
  assert.equal(new Set(lista).size, 4)
  p.liberar(0)
  assert.equal(p.confirmados[0], null)
  assert.equal(p.lista(IDS, 3).length, 3)
})

test('o aviso de personagem repetido diz quem pegou primeiro', () => {
  assert.equal(avisoRepetido('ANA', 'KRIS'), 'ANA pegou KRIS primeiro: escolha outro')
})
