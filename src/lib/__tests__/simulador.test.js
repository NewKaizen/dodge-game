// node --test src/lib/__tests__/
// Auto-ativação do teclado: a primeira tecla do jogo liga sozinha, sem botão para clicar.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { get } from 'svelte/store'

const ouvintes = {}
globalThis.window = {
  addEventListener: (nome, fn) => (ouvintes[nome] ??= new Set()).add(fn),
  removeEventListener: (nome, fn) => ouvintes[nome]?.delete(fn),
}
// dispara o evento para todos os ouvintes de agora (como o navegador faz)
const tecla = (code, extra = {}) => {
  const e = { code, repeat: false, target: {}, preventDefault() { this.evitado = true }, ...extra }
  for (const fn of [...(ouvintes.keydown ?? [])]) fn(e)
  return e
}
const soltar = (code) => [...(ouvintes.keyup ?? [])].forEach((fn) => fn({ code, target: {}, preventDefault() {} }))

const { jogo } = await import('../estado.js')
const { armarTeclado, pararSimulador } = await import('../simulador.js')
const desarmar = armarTeclado()

test('antes da primeira tecla nada está ligado', () => {
  assert.equal(get(jogo).conectado, false)
  assert.equal(get(jogo).fontes.teclado, false)
})

test('teclas que não são do jogo (F, Ctrl+W, Tab, campo de texto) não ligam', () => {
  tecla('KeyF')
  tecla('Tab')
  tecla('KeyS', { ctrlKey: true })
  tecla('KeyS', { target: { tagName: 'INPUT' } })
  assert.equal(get(jogo).conectado, false)
})

test('a primeira tecla de direção liga o teclado e já move naquele mesmo aperto', () => {
  const e = tecla('KeyD')
  assert.equal(get(jogo).fontes.teclado, true)
  assert.equal(get(jogo).fonte, 'teclado')
  assert.equal(get(jogo).conectado, true)
  assert.deepEqual(get(jogo).jogadores[0].joy, { x: 100, y: 0 })
  assert.equal(e.evitado, true)
  soltar('KeyD')
  assert.deepEqual(get(jogo).jogadores[0].joy, { x: 0, y: 0 })
})

test('depois de ligado, A/B/C valem normalmente (e só um ouvinte fica)', () => {
  assert.equal(ouvintes.keydown.size, 1)
  tecla('Space')
  assert.equal(get(jogo).botao.botao, 'A')
  const n = get(jogo).botao.id
  tecla('Space', { repeat: true }) // segurar não repete
  assert.equal(get(jogo).botao.id, n)
  tecla('ArrowUp') // P2 no mesmo teclado
  assert.deepEqual(get(jogo).jogadores[1].joy, { x: 0, y: -100 })
})

test('parar desliga e arma de novo para a próxima tecla', () => {
  pararSimulador()
  assert.equal(get(jogo).conectado, false)
  assert.equal(ouvintes.keydown.size, 1)
  tecla('KeyA')
  assert.equal(get(jogo).fontes.teclado, true)
})

test('a primeira tecla de botão só acorda (não escolhe a 1ª opção do menu)', () => {
  pararSimulador()
  const antes = get(jogo).botao?.id
  const e = tecla('Enter')
  assert.equal(get(jogo).fontes.teclado, true)
  assert.equal(get(jogo).botao?.id, antes)
  assert.equal(e.evitado, true)
  tecla('Enter', { repeat: false })
  assert.equal(get(jogo).botao.jogador, 1) // Enter é o A do P2
})

test('desarmar tira os ouvintes', () => {
  pararSimulador()
  desarmar()
  assert.equal(ouvintes.keydown.size, 0)
})
