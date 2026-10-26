import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { aposQuadros } from '../quadros.js'

test('chama só depois de n quadros desenhados', () => {
  const e = new EventEmitter()
  let chamou = 0
  aposQuadros(e, 2, () => chamou++)
  assert.equal(chamou, 0)
  e.emit('postrender')
  assert.equal(chamou, 0)
  e.emit('postrender')
  assert.equal(chamou, 1)
  e.emit('postrender')
  assert.equal(chamou, 1)
})

test('pelo menos um quadro, mesmo pedindo 0', () => {
  const e = new EventEmitter()
  let chamou = 0
  aposQuadros(e, 0, () => chamou++)
  assert.equal(chamou, 0)
  e.emit('postrender')
  assert.equal(chamou, 1)
})

test('cancelar impede a chamada', () => {
  const e = new EventEmitter()
  let chamou = 0
  const cancelar = aposQuadros(e, 2, () => chamou++)
  e.emit('postrender')
  cancelar()
  e.emit('postrender')
  e.emit('postrender')
  assert.equal(chamou, 0)
})
