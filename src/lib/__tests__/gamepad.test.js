// node --test src/lib/__tests__/
// O controle físico ponta a ponta, com navigator.getGamepads e a janela de mentira:
// ativação, vagas dos jogadores, aviso, pausa por desconexão e remapeamento.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { get } from 'svelte/store'

// ---------- o navegador de mentira (antes de importar o módulo) ----------
const ouvintes = {}
globalThis.window = {
  addEventListener: (nome, fn) => (ouvintes[nome] ??= new Set()).add(fn),
  removeEventListener: (nome, fn) => ouvintes[nome]?.delete(fn),
}
let quadro = null
globalThis.requestAnimationFrame = (fn) => ((quadro = fn), 1)
globalThis.cancelAnimationFrame = () => (quadro = null)
let pads = []
Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => pads }, configurable: true })
const tick = () => quadro?.()

const { jogo } = await import('../estado.js')
const { iniciarGamepads, capturarBotaoPad, controlesLigados } = await import('../gamepad.js')
const { definirPref, pref } = await import('../../game/preferencias.js')

const controle = ({ index = 0, id = 'Pad Teste', apertados = [], axes = [0, 0, 0, 0], connected = true } = {}) => ({
  index,
  id,
  connected,
  mapping: 'standard',
  axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: apertados.includes(i), value: apertados.includes(i) ? 1 : 0 })),
})

const avisos = []
const perdas = []
const parar = iniciarGamepads({ aviso: (a) => avisos.push(a), aoPerder: (m) => perdas.push(m) })

test('sem apertar nada, o controle não liga (nem pelo analógico solto)', () => {
  pads = [controle({ axes: [0.9, 0, 0, 0] })]
  tick()
  assert.equal(get(jogo).fontes.gamepad, false)
  assert.equal(get(jogo).conectado, false)
  assert.equal(avisos.length, 0)
})

test('o primeiro botão liga o controle como jogador 1, avisa e não vale como aperto', () => {
  pads = [controle({ apertados: [0], axes: [0, 0, 0, 0] })]
  tick()
  const s = get(jogo)
  assert.equal(s.fontes.gamepad, true)
  assert.equal(s.conectado, true)
  assert.equal(s.fonte, 'gamepad')
  assert.equal(s.botao, null) // só acordou
  assert.equal(avisos.length, 1)
  assert.equal(avisos[0].titulo, 'CONTROLE CONECTADO')
  assert.equal(avisos[0].texto, 'jogador 1')
  assert.deepEqual(controlesLigados(), [{ pad: 0, vaga: 0, chave: 'Pad Teste#0' }])
})

test('depois de ligado, A/B/Start viram BTN do jogador 1 (uma vez por aperto)', () => {
  pads = [controle()]
  tick()
  pads = [controle({ apertados: [0] })]
  tick()
  assert.deepEqual({ ...get(jogo).botao, id: 0 }, { jogador: 0, botao: 'A', id: 0 })
  const id = get(jogo).botao.id
  tick() // segurando: nada novo
  assert.equal(get(jogo).botao.id, id)
  pads = [controle({ apertados: [1] })]
  tick()
  assert.equal(get(jogo).botao.botao, 'B')
  pads = [controle({ apertados: [9] })]
  tick()
  assert.equal(get(jogo).botao.botao, 'C')
  pads = [controle()]
  tick()
})

test('o analógico e o D-pad movem o jogador 1 e soltar zera', () => {
  pads = [controle({ axes: [1, 0, 0, 0] })]
  tick()
  assert.deepEqual(get(jogo).jogadores[0].joy, { x: 100, y: 0 })
  pads = [controle({ apertados: [12] })]
  tick()
  assert.deepEqual(get(jogo).jogadores[0].joy, { x: 0, y: -100 })
  pads = [controle()]
  tick()
  assert.deepEqual(get(jogo).jogadores[0].joy, { x: 0, y: 0 })
})

test('a zona morta das preferências vale', () => {
  definirPref('zonaMorta', 0.8)
  pads = [controle({ axes: [0.7, 0, 0, 0] })]
  tick()
  assert.deepEqual(get(jogo).jogadores[0].joy, { x: 0, y: 0 })
  definirPref('zonaMorta', 0.2)
  tick()
  assert.ok(get(jogo).jogadores[0].joy.x > 50)
  definirPref('zonaMorta', 0.35)
  pads = [controle()]
  tick()
})

test('o segundo controle a apertar é o jogador 2 (com aviso) e comanda a vaga dele', () => {
  const antes = avisos.length
  pads = [controle(), controle({ index: 1, id: 'Outro Pad', apertados: [0] })]
  tick() // acorda o 2
  assert.equal(avisos.length, antes + 1)
  assert.equal(avisos.at(-1).texto, 'jogador 2')
  const ligados = controlesLigados()
  assert.deepEqual(ligados.map((c) => c.vaga).sort(), [0, 1])
  pads = [controle(), controle({ index: 1, id: 'Outro Pad', axes: [-1, 0, 0, 0] })]
  tick()
  assert.deepEqual(get(jogo).jogadores[1].joy, { x: -100, y: 0 })
  assert.deepEqual(get(jogo).jogadores[0].joy, { x: 0, y: 0 })
  pads = [controle(), controle({ index: 1, id: 'Outro Pad', apertados: [1] })]
  tick()
  assert.deepEqual({ j: get(jogo).botao.jogador, b: get(jogo).botao.botao }, { j: 1, b: 'B' })
})

test('desconectar avisa, pede a pausa e a religação volta na mesma vaga', () => {
  const antesAvisos = avisos.length
  pads = [null, controle({ index: 1, id: 'Outro Pad' })] // o controle 1 (jogador 1) sumiu
  tick()
  assert.deepEqual(perdas, ['controle desconectado'])
  assert.equal(avisos.at(-1).titulo, 'CONTROLE DESCONECTADO')
  assert.equal(avisos.at(-1).texto, 'jogador 1')
  assert.equal(avisos.length, antesAvisos + 1)
  assert.equal(get(jogo).fontes.gamepad, true) // o outro continua
  // voltou (mesmo id e índice) e apertou: continua sendo o jogador 1
  pads = [controle({ apertados: [0] }), controle({ index: 1, id: 'Outro Pad' })]
  tick()
  assert.equal(avisos.at(-1).titulo, 'CONTROLE RECONECTADO')
  assert.equal(avisos.at(-1).texto, 'jogador 1')
})

test('sem nenhum controle, a fonte desliga', () => {
  pads = []
  tick()
  assert.equal(get(jogo).fontes.gamepad, false)
  assert.equal(get(jogo).conectado, false)
  assert.equal(perdas.length, 3) // um por controle que saiu
})

test('remapear: o próximo botão vai para a captura e não chega ao jogo', () => {
  pads = [controle({ apertados: [0] })]
  tick() // liga
  pads = [controle()]
  tick()
  const recebidos = []
  const cancelar = capturarBotaoPad((i) => recebidos.push(i))
  const idAntes = get(jogo).botao?.id
  pads = [controle({ apertados: [5] })]
  tick()
  assert.deepEqual(recebidos, [5])
  assert.equal(get(jogo).botao?.id, idAntes) // não virou BTN
  pads = [controle({ apertados: [5, 6] })]
  tick()
  assert.deepEqual(recebidos, [5]) // a captura é de um botão só
  cancelar()
})

test('botões remapeados nas preferências valem no jogo; lixo é recusado', () => {
  definirPref('botoesPad', { A: [5], B: [1], C: [9] })
  pads = [controle()]
  tick()
  pads = [controle({ apertados: [5] })]
  tick()
  assert.equal(get(jogo).botao.botao, 'A')
  const id = get(jogo).botao.id
  pads = [controle({ apertados: [0] })] // o antigo A não é mais nada
  tick()
  assert.equal(get(jogo).botao.id, id)
  definirPref('botoesPad', { A: [5], B: [5], C: [9] }) // repetido: recusado
  assert.deepEqual(pref('botoesPad'), { A: [5], B: [1], C: [9] })
  definirPref('zonaMorta', 5)
  assert.equal(pref('zonaMorta'), 0.35)
  definirPref('botoesPad', null)
  assert.equal(pref('botoesPad'), null)
})

test('parar desliga a fonte e tira os ouvintes', () => {
  parar()
  assert.equal(get(jogo).fontes.gamepad, false)
  assert.equal(ouvintes.gamepadconnected.size, 0)
  assert.equal(ouvintes.blur.size, 0)
})
