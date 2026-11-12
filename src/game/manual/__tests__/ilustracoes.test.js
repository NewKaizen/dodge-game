// node --test src/game/manual/__tests__/ilustracoes.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarRng } from '../../pvp/baralho.js'
import { contornoDoBalao, bordaDoBalao, letrasTortas, rabiscosDaMargem, rabiscoDoCoracao, rabiscoDaBala, rabiscoDaMarca, estrelaGorda, desenhoDaCarta, iconeDoPasso } from '../ilustracoes.js'
import { caixaDasCamadas } from '../cera.js'

test('balão: determinístico, com o rabinho chegando na ponta pedida', () => {
  const op = [80, 90, 300, 120, { de: 120, x: 140, y: 260 }]
  const a = contornoDoBalao(criarRng('b'), ...op)
  assert.deepEqual(a, contornoDoBalao(criarRng('b'), ...op))
  const maisBaixo = a.reduce((m, p) => (p.y > m.y ? p : m))
  assert.ok(Math.hypot(maisBaixo.x - 140, maisBaixo.y - 260) < 3, 'a ponta do rabinho')
  // sem rabinho, o balão fica no retângulo (mais a ondinha)
  const s = contornoDoBalao(criarRng('b'), 80, 90, 300, 120, null)
  assert.ok(s.every((p) => p.x > 76 && p.x < 384 && p.y > 86 && p.y < 214))
  const borda = bordaDoBalao(criarRng('c'), a)
  assert.equal(borda.length, 2)
  assert.ok(borda.every((t) => t.length > a.length))
})

test('letras tortas: uma por caractere, tortas só um tiquinho', () => {
  const l = letrasTortas(criarRng('t'), 'Este é o seu coração')
  assert.deepEqual(l, letrasTortas(criarRng('t'), 'Este é o seu coração'))
  assert.equal(l.length, [...'Este é o seu coração'].length)
  for (const x of l) {
    assert.ok(Math.abs(x.dy) <= 1.6 && Math.abs(x.giro) <= 0.06 && x.escala >= 0.97 && x.escala <= 1.05)
  }
})

test('rabiscos de margem: cada tipo vira camadas perto do ponto pedido', () => {
  for (const tipo of ['sol', 'nuvem', 'coracao', 'estrela', 'pata']) {
    const c = rabiscosDaMargem(criarRng(tipo), [{ tipo, x: 100, y: 100, r: 8 }])
    assert.ok(c.length > 0, tipo)
    const b = caixaDasCamadas(c)
    assert.ok(b.minX > 60 && b.maxX < 140 && b.minY > 60 && b.maxY < 140, tipo)
  }
})

test('coração, bala e marca: camadas assadas + traços para o desenho progressivo', () => {
  const c = rabiscoDoCoracao(criarRng('h'), 24)
  assert.ok(c.contorno.length && c.preenchimento.length && c.camadas.length === 2)
  const b = rabiscoDaBala(criarRng('b'), 8)
  // o desenho da bala não passa de ~1,5 px + largura do traço da forma exata (a hitbox é o círculo)
  const cx = caixaDasCamadas(b.camadas)
  assert.ok(cx.maxX < 8 + 6 && cx.minX > -8 - 6)
  for (const forma of ['estrela', 'x']) {
    const m = rabiscoDaMarca(criarRng(forma), forma)
    assert.ok(m.tracos.length && m.camadas.length)
  }
  const e = estrelaGorda(0, 0, 10, 5)
  assert.equal(e.length, 10)
  assert.ok(Math.abs(Math.hypot(e[0].x, e[0].y) - 10) < 1e-9 && Math.abs(Math.hypot(e[1].x, e[1].y) - 5) < 1e-9)
})

// extras (3D): os desenhos das cartas novas (o chá e os 4 Ases) e os adesivos dos passos das páginas 6 a 9
test('extras: desenhos das cartas e adesivos dos passos existem, são determinísticos e cabem no seu raio', () => {
  for (const id of ['cha', 'espelho', 'anular', 'roubo', 'segunda']) {
    const a = desenhoDaCarta(criarRng(`c:${id}`), id, 19)
    assert.ok(a.length > 0, `carta ${id}`)
    assert.deepEqual(a, desenhoDaCarta(criarRng(`c:${id}`), id, 19), `determinístico ${id}`)
    const b = caixaDasCamadas(a)
    assert.ok(Number.isFinite(b.minX + b.maxX + b.minY + b.maxY) && b.maxX - b.minX < 19 * 3 && b.maxY - b.minY < 19 * 3, `cabe na carta: ${id}`)
  }
  const ids = ['espadas', 'ouros', 'paus', 'copas', 'coop', 'raspar', 'energia', 'marcas', 'dupla', 'carregar', 'super', 'ases']
  for (const id of ids) {
    const a = iconeDoPasso(criarRng(`i:${id}`), id, 11)
    assert.ok(a.length > 0, `adesivo ${id}`)
    assert.deepEqual(a, iconeDoPasso(criarRng(`i:${id}`), id, 11), `determinístico ${id}`)
    const b = caixaDasCamadas(a)
    assert.ok(b.maxX - b.minX <= 11 * 3 && b.maxY - b.minY <= 11 * 3, `cabe no adesivo: ${id}`)
  }
})
