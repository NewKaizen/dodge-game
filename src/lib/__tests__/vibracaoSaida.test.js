// levouGolpe / informarVida / voltarAoMenu (lib/saida.js) acionando a vibração do controle da vaga certa
import { test } from 'node:test'
import assert from 'node:assert/strict'

globalThis.window = { addEventListener() {}, removeEventListener() {} }
const chamadas = { 0: [], 1: [] }
let resets = 0
const pad = (i) => ({
  index: i,
  id: `Pad${i}`,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  vibrationActuator: { type: 'dual-rumble', playEffect: async (_, p) => void chamadas[i].push(p), reset: async () => void resets++ },
})
let quadro = null
globalThis.requestAnimationFrame = (fn) => ((quadro = fn), 1)
globalThis.cancelAnimationFrame = () => {}
let pads = []
Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => pads }, configurable: true })

const { jogo } = await import('../estado.js')
const { iniciarGamepads } = await import('../gamepad.js')
const saida = await import('../saida.js')

const apertar = (i) => {
  pads = pads.map((p) => (p.index === i ? { ...p, buttons: p.buttons.map((b, k) => (k === 0 ? { pressed: true, value: 1 } : b)) } : p))
  quadro()
}
iniciarGamepads()
pads = [pad(0), pad(1)]
apertar(0)
apertar(1) // dois controles: jogador 1 e 2
jogo.update((s) => ({ ...s, numJogadores: 2 }))

test('golpe no jogador 2 vibra só o controle 2', () => {
  saida.entrarNoJogo()
  saida.levouGolpe(1)
  assert.equal(chamadas[0].length, 0)
  assert.equal(chamadas[1].length, 1)
  assert.equal(chamadas[1][0].duration, 120)
  assert.equal(chamadas[1][0].strongMagnitude, 0.5 * 0.75)
})

test('K.O.: HP que cai a 0 vibra 400 ms; quem já começa com 0 não vibra', () => {
  saida.informarVida(0, 0, 5) // já começa caído
  assert.equal(chamadas[0].length, 0)
  saida.informarVida(1, 3, 5)
  saida.informarVida(1, 0, 5)
  assert.equal(chamadas[1].at(-1).duration, 400)
  const n = chamadas[1].length
  saida.informarVida(1, 0, 5) // repetido: não vibra de novo
  assert.equal(chamadas[1].length, n)
})

test('voltar ao menu para toda vibração', () => {
  const antes = resets
  saida.voltarAoMenu()
  assert.ok(resets > antes)
})

test('com 1 jogador local, todos os controles vibram', () => {
  jogo.update((s) => ({ ...s, numJogadores: 1 }))
  const a = chamadas[0].length
  const b = chamadas[1].length
  setTimeout(() => {}, 0)
  saida.levouGolpe(0)
  assert.equal(chamadas[0].length, a + 1)
  assert.equal(chamadas[1].length, b + 1)
})
