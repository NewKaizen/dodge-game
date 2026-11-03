// node --test src/game/manual/__tests__/giz.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarRng } from '../../pvp/baralho.js'
import {
  linhaGiz,
  retanguloGiz,
  circuloGiz,
  coracaoGiz,
  estrelaGiz,
  xGiz,
  setaGiz,
  preencherGiz,
  contornoDoCoracao,
  cortarTracos,
  comprimentoTotal,
  caixaDosTracos,
  margemDeTremor,
  margemDeLinha,
  falhaDoGiz,
  desenharTracos,
} from '../giz.js'

const rng = (s = 'a') => criarRng(`giz:${s}`)
const finitos = (tracos) => tracos.every((t) => t.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))

test('mesma semente, mesmos traços; semente diferente, traços diferentes', () => {
  const a = linhaGiz(rng('x'), 10, 20, 200, 80)
  const b = linhaGiz(rng('x'), 10, 20, 200, 80)
  const c = linhaGiz(rng('y'), 10, 20, 200, 80)
  assert.deepEqual(a, b)
  assert.notDeepEqual(a, c)
  assert.deepEqual(coracaoGiz(rng('h'), 50, 50, 24), coracaoGiz(rng('h'), 50, 50, 24))
})

test('linha: duas passadas, pontos perto da reta e dentro da caixa com a margem', () => {
  const tremor = 1.1
  const excesso = 3
  const tracos = linhaGiz(rng(), 100, 100, 300, 100, { tremor, excesso })
  assert.equal(tracos.length, 2)
  assert.ok(finitos(tracos))
  const m = margemDeLinha(tremor, excesso)
  const c = caixaDosTracos(tracos)
  assert.ok(c.minX >= 100 - m && c.maxX <= 300 + m, `x ${c.minX}..${c.maxX}`)
  assert.ok(c.minY >= 100 - m && c.maxY <= 100 + m, `y ${c.minY}..${c.maxY}`)
  // os pontos andam: o traço tem vários pontos, não só os extremos
  assert.ok(tracos[0].length >= 20)
})

test('retângulo: os 4 lados ficam dentro da borda + margem (a colisão é a caixa exata)', () => {
  const op = { tremor: 1.2, excesso: 4 }
  const t = retanguloGiz(rng('r'), 400, 150, 340, 200, op)
  assert.equal(t.length, 8)
  const m = margemDeLinha(op.tremor, op.excesso)
  const c = caixaDosTracos(t)
  assert.ok(c.minX >= 400 - m && c.maxX <= 740 + m && c.minY >= 150 - m && c.maxY <= 350 + m)
})

test('círculo e coração: pontos a no máximo r + tremor do centro', () => {
  const tremor = 1
  const circ = circuloGiz(rng('c'), 0, 0, 20, { tremor })
  for (const t of circ)
    for (const p of t) {
      const d = Math.hypot(p.x, p.y)
      assert.ok(Math.abs(d - 20) <= margemDeTremor(tremor) + 0.01, `d=${d}`)
    }
  const cor = coracaoGiz(rng('h'), 100, 100, 22, { tremor })
  const c = caixaDosTracos(cor)
  const m = margemDeTremor(tremor) + 1
  assert.ok(c.minX >= 100 - 11 - m && c.maxX <= 100 + 11 + m)
  assert.ok(c.minY >= 100 - 12 - m && c.maxY <= 100 + 12 + m)
})

test('coração: o contorno exato está centrado e tem a largura pedida', () => {
  const poli = contornoDoCoracao(0, 0, 32, 200)
  const c = caixaDosTracos([poli])
  assert.ok(Math.abs(c.maxX - 16) < 0.2 && Math.abs(c.minX + 16) < 0.2)
  assert.ok(Math.abs(c.maxY + c.minY) < 4, 'centrado na vertical (±4)')
})

test('estrela, X e seta saem finitos e limitados', () => {
  const e = estrelaGiz(rng('e'), 50, 50, 14)
  assert.equal(e.length, 1)
  const ce = caixaDosTracos(e)
  assert.ok(ce.minX >= 50 - 14 - 3 && ce.maxX <= 50 + 14 + 3)
  const x = xGiz(rng('x'), 0, 0, 10)
  assert.equal(x.length, 4 / 2 * 1) // 2 linhas de 1 passada
  assert.ok(finitos(x))
  const s = setaGiz(rng('s'), 0, 0, 100, 0)
  assert.equal(s.length, 3, 'corpo + 2 riscos da ponta')
  assert.ok(finitos(s))
  const ultimo = s[0][s[0].length - 1]
  assert.ok(Math.hypot(ultimo.x - 100, ultimo.y) < 3, 'a seta termina onde foi pedido')
})

test('preencher: a hachura fica dentro da caixa do polígono', () => {
  const poli = contornoDoCoracao(100, 100, 24)
  const cp = caixaDosTracos([poli])
  const h = preencherGiz(rng('p'), poli, { espaco: 3, tremor: 0.5 })
  assert.ok(h.length > 5)
  const c = caixaDosTracos(h)
  assert.ok(c.minX >= cp.minX - 1.5 && c.maxX <= cp.maxX + 1.5 && c.minY >= cp.minY - 1.5 && c.maxY <= cp.maxY + 1.5)
})

test('cortarTracos: 0 vazio, 1 inteiro, meio = metade do comprimento', () => {
  const t = retanguloGiz(rng('t'), 0, 0, 100, 60)
  assert.deepEqual(cortarTracos(t, 0), [])
  assert.equal(cortarTracos(t, 1), t)
  const total = comprimentoTotal(t)
  const meio = comprimentoTotal(cortarTracos(t, 0.5))
  assert.ok(Math.abs(meio - total / 2) < 1e-6, `${meio} vs ${total / 2}`)
  // crescente
  let ant = 0
  for (let i = 1; i <= 10; i++) {
    const c = comprimentoTotal(cortarTracos(t, i / 10))
    assert.ok(c >= ant)
    ant = c
  }
})

test('falhaDoGiz é determinística e fica em 0..1', () => {
  for (let i = 0; i < 500; i++) {
    const f = falhaDoGiz(i)
    assert.ok(f >= 0 && f <= 1)
    assert.equal(f, falhaDoGiz(i))
  }
})

test('desenharTracos só chama métodos de Graphics e respeita o progresso', () => {
  const chamadas = []
  const g = new Proxy({}, { get: (_, nome) => (...a) => chamadas.push([nome, ...a]) })
  const t = linhaGiz(rng('d'), 0, 0, 100, 0)
  desenharTracos(g, t, { progresso: 0 })
  assert.equal(chamadas.length, 0)
  desenharTracos(g, t, { progresso: 1 })
  assert.ok(chamadas.some((c) => c[0] === 'strokePath'))
  assert.ok(chamadas.every((c) => ['lineStyle', 'beginPath', 'moveTo', 'lineTo', 'strokePath'].includes(c[0])))
})
