// node --test src/game/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BOTOES_PADRAO,
  ZONA_MORTA_PADRAO,
  atribuirBotao,
  criarLeitorPads,
  direcaoDoPad,
  ehPadraoBotoes,
  nomeBotao,
  normalizarBotoes,
  problemasDosBotoes,
  zonaMortaValida,
} from '../gamepad.js'

// um controle "standard" de mentira: botões soltos, eixos no centro
const botoes = (...apertados) => Array.from({ length: 17 }, (_, i) => ({ pressed: apertados.includes(i), value: apertados.includes(i) ? 1 : 0 }))
const pad = ({ index = 0, apertados = [], axes = [0, 0, 0, 0], mapping = 'standard', id = 'Pad X', connected = true } = {}) => ({ index, id, connected, mapping, axes, buttons: botoes(...apertados) })

test('direção: analógico dentro da zona morta é zero', () => {
  assert.deepEqual(direcaoDoPad(pad({ axes: [0.25, -0.2, 0, 0] })), { x: 0, y: 0 })
  assert.deepEqual(direcaoDoPad(pad({ axes: [0.34, 0, 0, 0] })), { x: 0, y: 0 })
  assert.deepEqual(direcaoDoPad(pad()), { x: 0, y: 0 })
})

test('direção: fora da zona morta recomeça do zero na borda e chega a 100 no fundo', () => {
  const meio = direcaoDoPad(pad({ axes: [0.675, 0, 0, 0] })) // metade do caminho entre 0.35 e 1
  assert.equal(meio.y, 0)
  assert.ok(meio.x >= 49 && meio.x <= 51, `x=${meio.x}`)
  assert.deepEqual(direcaoDoPad(pad({ axes: [1, 0, 0, 0] })), { x: 100, y: 0 })
  assert.deepEqual(direcaoDoPad(pad({ axes: [0, -1, 0, 0] })), { x: 0, y: -100 })
  // diagonal no canto do quadrado (módulo > 1): continua dentro de -100..100
  const d = direcaoDoPad(pad({ axes: [1, 1, 0, 0] }))
  assert.ok(Math.abs(d.x) <= 100 && Math.abs(d.y) <= 100 && d.x > 0 && d.y > 0)
})

test('direção: a zona morta é configurável e valor ruim volta ao padrão', () => {
  const p = pad({ axes: [0.5, 0, 0, 0] })
  assert.equal(direcaoDoPad(p, 0.6).x, 0)
  assert.ok(direcaoDoPad(p, 0.2).x > 0)
  assert.deepEqual(direcaoDoPad(p, 'oi'), direcaoDoPad(p, ZONA_MORTA_PADRAO))
  assert.deepEqual(direcaoDoPad(p, NaN), direcaoDoPad(p, ZONA_MORTA_PADRAO))
})

test('direção: o D-pad (12-15) vale mais que o analógico', () => {
  assert.deepEqual(direcaoDoPad(pad({ apertados: [14] })), { x: -100, y: 0 })
  assert.deepEqual(direcaoDoPad(pad({ apertados: [12, 15] })), { x: 100, y: -100 })
  assert.deepEqual(direcaoDoPad(pad({ apertados: [13], axes: [-1, 0, 0, 0] })), { x: 0, y: 100 })
  // direções opostas se anulam
  assert.deepEqual(direcaoDoPad(pad({ apertados: [14, 15] })), { x: 0, y: 0 })
})

test('direção: controle fora do padrão usa os eixos 6 e 7 como D-pad', () => {
  const generico = (axes) => pad({ mapping: '', axes })
  assert.deepEqual(direcaoDoPad(generico([0, 0, 0, 0, 0, 0, -1, 1])), { x: -100, y: 100 })
  assert.deepEqual(direcaoDoPad(generico([0, 0, 0, 0, 0, 0, 0, 0])), { x: 0, y: 0 })
  // no padrão, os eixos 6/7 (gatilhos em alguns) não mexem a direção
  assert.deepEqual(direcaoDoPad(pad({ axes: [0, 0, 0, 0, 0, 0, 1, 1] })), { x: 0, y: 0 })
  // eixo sujo (NaN) não quebra
  assert.deepEqual(direcaoDoPad(pad({ axes: [NaN, undefined, 0, 0] })), { x: 0, y: 0 })
})

test('leitor: botão só avisa na hora que aperta (borda), não enquanto segura', () => {
  const leitor = criarLeitorPads()
  assert.deepEqual(leitor.atualizar([pad()]), [])
  const e1 = leitor.atualizar([pad({ apertados: [0] })])
  assert.deepEqual(e1, [
    { tipo: 'apertou', pad: 0, indice: 0 },
    { tipo: 'botao', pad: 0, botao: 'A', indice: 0 },
  ])
  assert.deepEqual(leitor.atualizar([pad({ apertados: [0] })]), []) // segurando
  assert.deepEqual(leitor.atualizar([pad()]), []) // soltou
  assert.equal(leitor.atualizar([pad({ apertados: [0] })]).length, 2) // apertou de novo
})

test('leitor: A/X, B/Y e Start do mapa padrão; outros botões só "apertou"', () => {
  const leitor = criarLeitorPads()
  const botao = (i) => {
    const ev = leitor.atualizar([pad({ apertados: [i] })]).find((e) => e.tipo === 'botao')
    leitor.atualizar([pad()])
    return ev?.botao ?? null
  }
  assert.equal(botao(0), 'A')
  assert.equal(botao(2), 'A')
  assert.equal(botao(1), 'B')
  assert.equal(botao(3), 'B')
  assert.equal(botao(9), 'C')
  assert.equal(botao(4), null)
  // o D-pad não é botão de jogo
  assert.equal(botao(12), null)
})

test('leitor: gatilho analógico conta passando da metade', () => {
  const leitor = criarLeitorPads({ botoes: () => ({ A: [7], B: [1], C: [9] }) })
  const analogico = (v) => ({ ...pad(), buttons: Array.from({ length: 10 }, (_, i) => ({ pressed: false, value: i === 7 ? v : 0 })) })
  assert.deepEqual(leitor.atualizar([analogico(0.4)]), [])
  assert.equal(leitor.atualizar([analogico(0.8)]).find((e) => e.tipo === 'botao')?.botao, 'A')
})

test('leitor: usa o mapa remapeado (lido a cada quadro)', () => {
  let mapa = BOTOES_PADRAO
  const leitor = criarLeitorPads({ botoes: () => mapa })
  mapa = { A: [5], B: [1], C: [9] }
  assert.equal(leitor.atualizar([pad({ apertados: [5] })]).find((e) => e.tipo === 'botao')?.botao, 'A')
  leitor.atualizar([pad()])
  assert.equal(leitor.atualizar([pad({ apertados: [0] })]).find((e) => e.tipo === 'botao'), undefined)
})

test('leitor: direção só avisa quando muda e zera ao soltar', () => {
  const leitor = criarLeitorPads()
  assert.deepEqual(leitor.atualizar([pad({ apertados: [15] })]).filter((e) => e.tipo === 'joy'), [{ tipo: 'joy', pad: 0, x: 100, y: 0 }])
  assert.deepEqual(leitor.atualizar([pad({ apertados: [15] })]), []) // igual
  assert.deepEqual(leitor.atualizar([pad()]), [{ tipo: 'joy', pad: 0, x: 0, y: 0 }])
})

test('leitor: zona morta nova vale no quadro seguinte', () => {
  let zona = 0.8
  const leitor = criarLeitorPads({ zonaMorta: () => zona })
  const p = pad({ axes: [0.6, 0, 0, 0] })
  assert.deepEqual(leitor.atualizar([p]), [])
  zona = 0.1
  assert.equal(leitor.atualizar([p]).find((e) => e.tipo === 'joy')?.x > 0, true)
})

test('leitor: dois controles são independentes e um que some avisa "saiu"', () => {
  const leitor = criarLeitorPads()
  const ev = leitor.atualizar([pad({ index: 0, apertados: [0] }), pad({ index: 1, apertados: [1] })])
  assert.equal(ev.find((e) => e.tipo === 'botao' && e.pad === 0)?.botao, 'A')
  assert.equal(ev.find((e) => e.tipo === 'botao' && e.pad === 1)?.botao, 'B')
  // o 0 some (null no array do navegador) e o 1 continua
  const depois = leitor.atualizar([null, pad({ index: 1, apertados: [1] })])
  assert.deepEqual(depois, [{ tipo: 'saiu', pad: 0, estavaMexendo: false }])
  // marcado como desconectado também vale
  assert.deepEqual(leitor.atualizar([pad({ index: 1, connected: false })]), [{ tipo: 'saiu', pad: 1, estavaMexendo: false }])
  // voltando, o botão que já estava apertado conta de novo (estado novo)
  assert.equal(leitor.atualizar([pad({ index: 0, apertados: [0] })]).some((e) => e.tipo === 'botao'), true)
})

test('leitor: soltarTudo zera as direções sem repetir botões que seguem apertados', () => {
  const leitor = criarLeitorPads()
  leitor.atualizar([pad({ apertados: [0, 15] })])
  assert.deepEqual(leitor.soltarTudo(), [{ tipo: 'joy', pad: 0, x: 0, y: 0 }])
  const depois = leitor.atualizar([pad({ apertados: [0, 15] })])
  assert.equal(depois.some((e) => e.tipo === 'botao'), false)
  assert.equal(depois.some((e) => e.tipo === 'joy'), true) // a direção ainda está apertada
})

test('leitor: lista vazia, null e lixo não quebram', () => {
  const leitor = criarLeitorPads()
  assert.deepEqual(leitor.atualizar(undefined), [])
  assert.deepEqual(leitor.atualizar([null, undefined]), [])
  assert.deepEqual(leitor.atualizar([{ index: 3 }]), [])
})

// ---------- mapa de botões ----------

test('o mapa padrão é válido e normalizar recusa lixo', () => {
  assert.deepEqual(problemasDosBotoes(BOTOES_PADRAO), [])
  assert.ok(ehPadraoBotoes(BOTOES_PADRAO))
  for (const ruim of [null, 'oi', 3, [], { A: [0] }, { A: [], B: [1], C: [9] }, { A: [0], B: [0], C: [9] }, { A: [12], B: [1], C: [9] }, { A: [-1], B: [1], C: [9] }, { A: [1.5], B: [1], C: [9] }, { A: ['0'], B: [1], C: [9] }, { A: [99], B: [1], C: [9] }]) {
    assert.deepEqual(normalizarBotoes(ruim), BOTOES_PADRAO, JSON.stringify(ruim))
  }
  const bom = { A: [4], B: [5], C: [8] }
  assert.deepEqual(normalizarBotoes(bom), bom)
  assert.notEqual(normalizarBotoes(bom).A, bom.A) // cópia
})

test('atribuirBotao: troca simples, igual, conflito com troca e sem troca', () => {
  let r = atribuirBotao(BOTOES_PADRAO, 'A', 5)
  assert.deepEqual(r.mapa, { A: [5], B: [1, 3], C: [9] })
  assert.equal(r.tirada, null)

  r = atribuirBotao({ A: [5], B: [1], C: [9] }, 'A', 5)
  assert.equal(r.igual, true)

  // 3 era de B (que tinha 1 e 3): sai de lá, B fica com o 1
  r = atribuirBotao(BOTOES_PADRAO, 'A', 3)
  assert.deepEqual(r.mapa, { A: [3], B: [1], C: [9] })
  assert.deepEqual(r.tirada, { acao: 'B', trocou: false })

  // 9 era o único de C: C fica com os antigos de A (0 e 2)
  r = atribuirBotao(BOTOES_PADRAO, 'A', 9)
  assert.deepEqual(r.mapa, { A: [9], B: [1, 3], C: [0, 2] })
  assert.deepEqual(r.tirada, { acao: 'C', trocou: true })
  assert.deepEqual(problemasDosBotoes(r.mapa), [])
})

test('atribuirBotao: D-pad, índice estranho e ação desconhecida dão erro', () => {
  for (const i of [12, 13, 14, 15]) assert.match(atribuirBotao(BOTOES_PADRAO, 'A', i).erro, /D-pad/)
  assert.ok(atribuirBotao(BOTOES_PADRAO, 'A', -2).erro)
  assert.ok(atribuirBotao(BOTOES_PADRAO, 'A', 40).erro)
  assert.ok(atribuirBotao(BOTOES_PADRAO, 'Z', 1).erro)
})

test('nomes dos botões e limites da zona morta', () => {
  assert.equal(nomeBotao(0), 'A')
  assert.equal(nomeBotao(9), 'START')
  assert.equal(nomeBotao(20), 'BOTÃO 20')
  assert.ok(zonaMortaValida(0.35) && zonaMortaValida(0.1) && zonaMortaValida(0.8))
  for (const v of [0, 0.05, 0.9, 1, -1, NaN, Infinity, '0.3', null, undefined]) assert.equal(zonaMortaValida(v), false, String(v))
})
