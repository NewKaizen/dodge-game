import test from 'node:test'
import assert from 'node:assert/strict'
import { projetar, criarPrevisao } from '../../attacks/super/previsao.js'

const caixa = { left: 0, right: 200, top: 0, bottom: 150 }

test('projetar: segue a velocidade e fica dentro da caixa', () => {
  const p = projetar({ x: 100, y: 75 }, { vx: 60, vy: 0 }, 500, caixa)
  assert.equal(Math.round(p.x), 130)
  assert.equal(p.y, 75)
  const borda = projetar({ x: 190, y: 75 }, { vx: 100, vy: 0 }, 500, caixa)
  assert.equal(borda.x, 190) // limite: right - margem
})

test('projetar: parado não muda o ponto e o deslocamento é limitado', () => {
  assert.deepEqual(projetar({ x: 80, y: 60 }, { vx: 0, vy: 0 }, 600, caixa), { x: 80, y: 60 })
  const p = projetar({ x: 20, y: 75 }, { vx: 400, vy: 0 }, 1000, caixa, { maxDist: 50 })
  assert.equal(Math.round(p.x), 70)
})

test('criarPrevisao: estima a velocidade do coração que se mexe', () => {
  let fn = null
  const c = { ativo: true, x: 20, y: 75 }
  const a = { coracoes: [c], caixa, aoAtualizar: (f) => (fn = f) }
  const pr = criarPrevisao(a)
  for (let i = 0; i < 30; i++) {
    c.x += 3 // 3 px por quadro de 16,67 ms = 180 px/s
    fn(1000 / 60)
  }
  const v = pr.velocidade({ x: c.x, y: c.y })
  assert.ok(v.vx > 150 && v.vx < 200, `vx=${v.vx}`)
  assert.ok(Math.abs(v.vy) < 1)
  assert.ok(pr.prever({ x: c.x, y: c.y }, 300).x > c.x)
})
