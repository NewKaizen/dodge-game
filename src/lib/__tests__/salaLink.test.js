import { test } from 'node:test'
import assert from 'node:assert/strict'
import { codigoDaBusca, linkDaSala } from '../salaLink.js'

test('codigoDaBusca: lê ?sala= em qualquer caixa e com lixo em volta', () => {
  assert.equal(codigoDaBusca('?sala=K7QX2'), 'K7QX2')
  assert.equal(codigoDaBusca('?sala=k7qx2'), 'K7QX2')
  assert.equal(codigoDaBusca('?x=1&sala=k7-qx2&y=2'), 'K7QX2')
  assert.equal(codigoDaBusca('sala=K7QX2'), 'K7QX2')
})

test('codigoDaBusca: ignora o que não parece um código de sala', () => {
  assert.equal(codigoDaBusca(''), '')
  assert.equal(codigoDaBusca(null), '')
  assert.equal(codigoDaBusca('?sala='), '')
  assert.equal(codigoDaBusca('?sala=ABC'), '', 'curto demais')
  assert.equal(codigoDaBusca('?sala=ABCDEFGH'), '', 'longo demais')
  assert.equal(codigoDaBusca('?sala=A0O1I'), '', 'letras que o servidor nunca usa (0, O, 1, I)')
  assert.equal(codigoDaBusca('?sala=<script>'), '')
  assert.equal(codigoDaBusca('?outra=K7QX2'), '')
})

test('linkDaSala: https://site/?sala=CODIGO', () => {
  assert.equal(linkDaSala('k7qx2', 'https://dodge.exemplo.com'), 'https://dodge.exemplo.com/?sala=K7QX2')
  assert.equal(linkDaSala('K7QX2', 'http://localhost:5180/'), 'http://localhost:5180/?sala=K7QX2')
  assert.equal(linkDaSala('', 'https://x'), '')
})

test('o link gerado volta como o mesmo código', () => {
  const url = new URL(linkDaSala('M4ZP8', 'https://dodge.exemplo.com'))
  assert.equal(codigoDaBusca(url.search), 'M4ZP8')
})
