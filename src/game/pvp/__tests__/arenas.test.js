// node --test src/game/pvp/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARENAS, ARENA, ALEATORIA, apurarVotos, eventosDaArena } from '../arenas.js'
import { EVENTO } from '../bonus.js'
import { criarRng } from '../baralho.js'

test('arenas: ids únicos, todas com nome, música e bônus que existem', () => {
  assert.equal(new Set(ARENAS.map((a) => a.id)).size, ARENAS.length)
  for (const a of ARENAS) {
    assert.ok(a.nome && a.descricao && a.musica, a.id)
    const ids = eventosDaArena(a.id).map((e) => e.id)
    assert.equal(new Set(ids).size, ids.length, `${a.id}: bônus repetido`)
    for (const id of ids) assert.ok(EVENTO[id], `${a.id}: ${id}`)
    for (const geral of ['duelo', 'malucas']) assert.ok(ids.includes(geral), `${a.id} sem ${geral}`)
  }
})

test('arenas: o nome próprio da arena vale só nela', () => {
  const tochas = eventosDaArena('templo').find((e) => e.id === 'apagao')
  assert.equal(tochas.nome, 'TOCHAS')
  assert.equal(tochas.cartas, 'normal') // o resto vem do evento original
  assert.equal(eventosDaArena('castelo').find((e) => e.id === 'apagao').nome, EVENTO.apagao.nome)
})

test('arenas: o templo tem os bônus próprios dele (pedra, armadilhas, areia, relógio)', () => {
  const ids = eventosDaArena('templo').map((e) => e.id)
  for (const id of ['pedra', 'armadilhas', 'areia', 'relogio']) {
    assert.ok(ids.includes(id), id)
    assert.equal(EVENTO[id].cartas, 'normal')
  }
  assert.ok(ids.length >= 10)
})

test('arenas: a mais votada ganha', () => {
  const r = apurarVotos(['templo', 'templo'], criarRng('a'))
  assert.equal(r.arena, 'templo')
  assert.deepEqual(r.empatadas, ['templo'])
  assert.equal(apurarVotos(['palco', null], criarRng('b')).arena, 'palco')
  assert.equal(apurarVotos(['jardim'], criarRng('c')).arena, 'jardim') // contra a CPU: só o P1 vota
})

test('arenas: empate sorteia só entre as empatadas (as duas saem)', () => {
  const vistas = new Set()
  for (let s = 0; s < 40; s++) {
    const r = apurarVotos(['palco', 'coliseu'], criarRng(`e${s}`))
    assert.deepEqual(r.empatadas, ['palco', 'coliseu'])
    assert.ok(['palco', 'coliseu'].includes(r.arena))
    vistas.add(r.arena)
  }
  assert.equal(vistas.size, 2)
})

test('arenas: "?" vira uma arena sorteada; ninguém votou = qualquer uma', () => {
  for (let s = 0; s < 20; s++) {
    const r = apurarVotos([ALEATORIA, null], criarRng(`q${s}`))
    assert.ok(ARENA[r.sorteios[0]])
    assert.equal(r.arena, r.sorteios[0])
  }
  const nada = apurarVotos([null, null], criarRng('n'))
  assert.ok(ARENA[nada.arena])
  assert.equal(nada.empatadas.length, ARENAS.length)
})
