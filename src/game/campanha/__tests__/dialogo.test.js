// node --test src/game/campanha/__tests__/dialogo.test.js
// O motor dos diálogos: texto datilografado, A completa / passa, escolha de 2 opções, falas que
// dependem da escolha e o modo "reduzir animações" (texto inteiro na hora).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarDialogo, falasValidas } from '../dialogo.js'

const CENA = [
  { quem: 'ralsei', texto: 'Olá, Kris!' },
  { escolha: { chave: 'lapis', opcoes: [{ valor: 'vermelho', texto: 'Vermelho' }, { valor: 'verde', texto: 'Verde' }] } },
  { quem: 'ralsei', texto: 'Vermelho!', se: { lapis: 'vermelho' } },
  { quem: 'ralsei', texto: 'Verde!', se: { lapis: 'verde' } },
  { quem: 'narrador', texto: 'Fim.' },
]

test('datilografa letra a letra e A completa antes de passar', () => {
  const d = criarDialogo(CENA, { letraMs: 10 })
  assert.equal(d.atual.visivel, '')
  assert.equal(d.avancar(25), 2)
  assert.equal(d.atual.visivel, 'Ol')
  assert.equal(d.atual.completo, false)
  assert.equal(d.confirmar(), 'completou')
  assert.equal(d.atual.visivel, 'Olá, Kris!')
  assert.equal(d.avancar(1000), 0)
  assert.equal(d.confirmar(), 'proxima')
  assert.ok(d.atual.escolha)
})

test('escolha: ↑↓ troca, A escolhe, a fala certa aparece e a escolha fica guardada', () => {
  const d = criarDialogo(CENA, { instantaneo: true })
  d.confirmar()
  assert.equal(d.atual.indice, 0)
  d.mover(1)
  assert.equal(d.atual.indice, 1)
  d.mover(1)
  assert.equal(d.atual.indice, 0)
  d.mover(-1)
  assert.equal(d.confirmar(), 'escolheu')
  assert.equal(d.atual.texto, 'Verde!')
  assert.deepEqual(d.novas, { lapis: 'verde' })
  assert.equal(d.confirmar(), 'proxima')
  assert.equal(d.atual.texto, 'Fim.')
  assert.equal(d.confirmar(), 'fim')
  assert.equal(d.acabou, true)
  assert.equal(d.atual, null)
})

test('escolha que já veio de antes vale (e não vira escolha nova)', () => {
  const d = criarDialogo(CENA.slice(2), { escolhas: { lapis: 'vermelho' }, instantaneo: true })
  assert.equal(d.atual.texto, 'Vermelho!')
  assert.deepEqual(d.novas, {})
})

test('reduzir animações: o texto aparece inteiro; pular para na escolha', () => {
  const d = criarDialogo(CENA, { instantaneo: true })
  assert.equal(d.atual.completo, true)
  assert.equal(d.pular(), 'escolha')
  assert.ok(d.atual.escolha)
  d.confirmar()
  assert.equal(d.pular(), 'fim')
})

test('falasValidas confere o formato', () => {
  assert.equal(falasValidas(CENA), true)
  assert.equal(falasValidas([{ quem: 'x' }]), false)
  assert.equal(falasValidas([{ escolha: { chave: 'a', opcoes: [{ valor: 'b', texto: 'c' }] } }]), false)
})
