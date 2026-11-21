// node --test src/lib/__tests__/campoToque.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filtrarTexto, abrirCampoToque, ehCampoToque } from '../campoToque.js'

const UM = /^[a-z0-9]$/i

test('campo do celular: o texto do teclado da tela passa pelo mesmo filtro e limite das telas', () => {
  assert.equal(filtrarTexto('ab-c d9', { max: 8, permitido: UM }), 'abcd9')
  assert.equal(filtrarTexto('abcdefghij', { max: 4, permitido: UM }), 'abcd')
  assert.equal(filtrarTexto('', { max: 4, permitido: UM }), '')
  assert.equal(filtrarTexto('çãoé', { max: 10, permitido: /^\p{L}$/u }), 'çãoé')
})

test('campo do celular: sem navegador (Node) não abre nada e não quebra', () => {
  const fechar = abrirCampoToque({ inicial: 'x', max: 4, permitido: UM })
  assert.equal(typeof fechar, 'function')
  fechar()
  assert.equal(ehCampoToque(null), false)
})
