// node --test src/game/__tests__/passoFixo.test.js
// O PASSO FIXO da esquiva (passoFixo.js): a simulação anda em tiques de 1/60 s qualquer que seja o
// quadro da tela; o mesmo número de tiques dá o MESMO estado, a 30, 60, 144 Hz ou com engasgos.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarPassoFixo, PASSO_MS, MAX_TIQUES, limiteDeTiques, lembrarAnterior, aplicarInterpolacao, desfazerInterpolacao } from '../passoFixo.js'

// uma "simulação" sensível ao dt: posição, velocidade com arrasto e um gerador com semente por tique
function simulacao() {
  let s = 12345
  const estado = { x: 0, v: 300, soma: 0, tiques: 0 }
  return {
    estado,
    tique(dt) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      estado.v += ((s / 4294967296 - 0.5) * 40 - estado.v * 0.8) * (dt / 1000)
      estado.x += estado.v * (dt / 1000)
      estado.soma += estado.x * 1e-3
      estado.tiques++
    },
  }
}

// roda quadros de dt até `tiques` tiques e devolve o estado (e quantos quadros levou)
function rodar(dts, tiques) {
  const sim = simulacao()
  const passo = criarPassoFixo()
  let quadros = 0
  while (sim.estado.tiques < tiques) {
    passo.avancar(dts[quadros % dts.length], (dt) => {
      if (sim.estado.tiques < tiques) sim.tique(dt)
    })
    quadros++
    if (quadros > 1e6) throw new Error('não chegou')
  }
  return { ...sim.estado, quadros }
}

test('o mesmo estado depois de N tiques com sequências de quadro diferentes (30, 60, 144 Hz, engasgos)', () => {
  const N = 600
  const ref = rodar([1000 / 60], N)
  const casos = {
    '30 Hz': [1000 / 30],
    '60 Hz do medidor (16,667)': [16.667],
    '144 Hz': [1000 / 144],
    '75 Hz': [1000 / 75],
    'quadros variados': [16, 17, 16, 33, 16, 8, 17, 7, 50],
    engasgos: [16.7, 16.7, 120, 4, 16.7, 300, 16.6],
  }
  for (const [nome, dts] of Object.entries(casos)) {
    const r = rodar(dts, N)
    assert.equal(r.tiques, N, nome)
    assert.equal(r.x, ref.x, `${nome}: x`)
    assert.equal(r.v, ref.v, `${nome}: v`)
    assert.equal(r.soma, ref.soma, `${nome}: soma`)
  }
})

test('a 60 Hz cada quadro roda exatamente um tique e desenha o estado atual (alfa = 1)', () => {
  for (const dt of [1000 / 60, 16.667]) {
    const passo = criarPassoFixo()
    for (let q = 0; q < 1200; q++) {
      let n = 0
      passo.avancar(dt, () => n++)
      assert.equal(n, 1, `dt ${dt}, quadro ${q}`)
      assert.equal(passo.alfa, 1)
    }
  }
  // 60 Hz de verdade, com o rAF tremendo um pouco: ainda um tique por quadro
  const passo = criarPassoFixo()
  for (let q = 0; q < 1200; q++) {
    let n = 0
    passo.avancar(q % 2 ? 16.9 : 16.43, () => n++)
    assert.equal(n, 1, `quadro ${q}`)
  }
})

test('a 144 Hz: tiques a cada 2 ou 3 quadros e o alfa interpola no meio', () => {
  const passo = criarPassoFixo()
  const alfas = []
  let tiques = 0
  for (let q = 0; q < 144; q++) {
    passo.avancar(1000 / 144, () => tiques++)
    alfas.push(passo.alfa)
  }
  assert.ok(tiques >= 59 && tiques <= 61, `${tiques} tiques em 1 s`)
  assert.ok(alfas.some((a) => a > 0.05 && a < 0.95), 'algum quadro fica entre dois tiques')
  assert.ok(alfas.every((a) => a >= 0 && a <= 1))
})

test('espiral da morte: no máximo MAX_TIQUES por quadro e o atraso que sobra é jogado fora', () => {
  const passo = criarPassoFixo()
  let n = 0
  passo.avancar(2000, () => n++)
  assert.equal(n, MAX_TIQUES)
  n = 0
  passo.avancar(PASSO_MS, () => n++)
  assert.equal(n, 1, 'depois do engasgo, volta a um tique por quadro')
  assert.equal(limiteDeTiques(1), MAX_TIQUES)
  assert.equal(limiteDeTiques(4), MAX_TIQUES * 4, 'debug.acelerar sobe o teto junto')
})

test('interpolação: desenha entre o anterior e o atual e o desfazer volta o sprite ao valor exato', () => {
  const sprite = { x: 10.1, y: 20.3, scene: {} }
  const o = { x: 10.1, y: 20.3 }
  lembrarAnterior([o])
  o.x = 13.7
  o.y = 18.9
  sprite.x = 13.7
  sprite.y = 18.9
  aplicarInterpolacao(o, [sprite], 0.25)
  assert.ok(Math.abs(sprite.x - (10.1 + (13.7 - 10.1) * 0.25)) < 1e-9)
  assert.ok(Math.abs(sprite.y - (20.3 + (18.9 - 20.3) * 0.25)) < 1e-9)
  desfazerInterpolacao(o)
  assert.equal(sprite.x, 13.7)
  assert.equal(sprite.y, 18.9)
  // alfa 1: nada muda (a 60 Hz o desenho é o de sempre)
  aplicarInterpolacao(o, [sprite], 1)
  assert.equal(sprite.x, 13.7)
  assert.equal(o.interp ?? null, null)
})
