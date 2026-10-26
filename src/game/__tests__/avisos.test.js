// node --test src/game/__tests__/avisos.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarFilaAvisos, MS_PADRAO, PAUSA_ENTRE_MS } from '../conta/fila.js'

const aviso = (id, extra = {}) => ({ id, tipo: 'info', titulo: id, ...extra })

test('avisos: um de cada vez, na ordem, com folga entre eles', () => {
  const f = criarFilaAvisos()
  f.empurrar(aviso('a'))
  f.empurrar(aviso('b'))
  assert.equal(f.atualizar(0)?.id, 'a')
  assert.equal(f.atualizar(MS_PADRAO - 1)?.id, 'a')
  assert.equal(f.atualizar(MS_PADRAO), null, 'acabou o tempo: some e espera a folga')
  assert.equal(f.atualizar(MS_PADRAO + PAUSA_ENTRE_MS - 1), null)
  assert.equal(f.atualizar(MS_PADRAO + PAUSA_ENTRE_MS)?.id, 'b')
})

test('avisos: o mesmo id não entra duas vezes (nem depois de aparecer)', () => {
  const f = criarFilaAvisos()
  assert.equal(f.empurrar(aviso('a')), true)
  assert.equal(f.empurrar(aviso('a')), false)
  f.atualizar(0)
  f.atualizar(MS_PADRAO + 1)
  assert.equal(f.empurrar(aviso('a')), false)
  assert.equal(f.empurrar({ titulo: 'sem id' }), false)
})

test('avisos: durante a partida (pode=false) ficam na fila e saem depois', () => {
  const f = criarFilaAvisos()
  f.empurrar(aviso('a'))
  assert.equal(f.atualizar(0, false), null)
  assert.equal(f.pendentes(), 1)
  assert.equal(f.atualizar(10_000, true)?.id, 'a')
})

test('avisos: o da tela volta ao começo da fila se o menu some no meio', () => {
  const f = criarFilaAvisos()
  f.empurrar(aviso('a'))
  f.empurrar(aviso('b'))
  assert.equal(f.atualizar(0)?.id, 'a')
  assert.equal(f.atualizar(100, false), null)
  assert.equal(f.pendentes(), 2)
  assert.equal(f.atualizar(200, true)?.id, 'a', 'a ordem se mantém')
})

test('avisos: convite dura até o fim dele e some sozinho se venceu na fila', () => {
  const f = criarFilaAvisos()
  f.empurrar(aviso('c1', { tipo: 'convite', ate: 60_000 }))
  assert.equal(f.atualizar(1000)?.id, 'c1')
  assert.equal(f.atualizar(30_000)?.id, 'c1', 'passa dos 5 s padrão')
  assert.equal(f.restante(30_000), 30_000)
  assert.equal(f.atualizar(60_000), null)

  const g = criarFilaAvisos()
  g.empurrar(aviso('c2', { tipo: 'convite', ate: 5000 }))
  assert.equal(g.atualizar(0, false), null)
  assert.equal(g.atualizar(6000, true), null, 'venceu esperando a partida acabar')
  assert.equal(g.pendentes(), 0)
})

test('avisos: descartar tira da fila e da tela', () => {
  const f = criarFilaAvisos()
  f.empurrar(aviso('a'))
  f.empurrar(aviso('b'))
  f.atualizar(0)
  f.descartar('a')
  assert.equal(f.atual(), null)
  assert.equal(f.atualizar(1)?.id, 'b', 'o seguinte entra sem esperar a folga')
  f.descartar('b')
  assert.equal(f.atual(), null)
})

test('avisos: fila cheia perde o mais antigo que não é convite', () => {
  const f = criarFilaAvisos({ max: 2 })
  f.empurrar(aviso('c', { tipo: 'convite', ate: 99_999 }))
  f.empurrar(aviso('a'))
  f.empurrar(aviso('b'))
  assert.equal(f.pendentes(), 2)
  assert.equal(f.atualizar(0)?.id, 'c')
  assert.equal(f.atualizar(99_999), null)
  assert.equal(f.atualizar(99_999 + PAUSA_ENTRE_MS)?.id, 'b')
})
