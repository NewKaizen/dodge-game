import { test } from 'node:test'
import assert from 'node:assert/strict'
import { vigiarContextoWebgl, MENSAGEM_CONTEXTO_PERDIDO } from '../contextoPerdido.js'

function elemento() {
  const ouvintes = {}
  return {
    filhos: [],
    style: {},
    setAttribute() {},
    addEventListener(n, f) { ouvintes[n] = f },
    removeEventListener(n) { delete ouvintes[n] },
    appendChild(f) { this.filhos.push(f) },
    remove() { this.removido = true },
    emitir(n, e = {}) { ouvintes[n]?.(e) },
    ouvintes,
  }
}

test('mostra a mensagem ao perder o contexto e recarrega no clique', () => {
  const canvas = elemento()
  const container = elemento()
  let recarregou = 0
  const doc = { createElement: () => elemento() }
  vigiarContextoWebgl(canvas, container, doc, () => recarregou++)
  let evitou = false
  canvas.emitir('webglcontextlost', { preventDefault: () => (evitou = true) })
  assert.ok(evitou)
  assert.equal(container.filhos.length, 1)
  assert.equal(container.filhos[0].textContent, MENSAGEM_CONTEXTO_PERDIDO)
  canvas.emitir('webglcontextlost', {}) // de novo: não duplica
  assert.equal(container.filhos.length, 1)
  container.filhos[0].emitir('click')
  assert.equal(recarregou, 1)
})

test('some se o navegador restaurar o contexto e desliga os ouvintes', () => {
  const canvas = elemento()
  const container = elemento()
  const doc = { createElement: () => elemento() }
  const desligar = vigiarContextoWebgl(canvas, container, doc, () => {})
  canvas.emitir('webglcontextlost', {})
  canvas.emitir('webglcontextrestored')
  assert.ok(container.filhos[0].removido)
  desligar()
  assert.equal(Object.keys(canvas.ouvintes).length, 0)
})

test('sem canvas não faz nada', () => {
  assert.equal(typeof vigiarContextoWebgl(null, null), 'function')
})
