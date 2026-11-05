// node --test src/game/campanha/__tests__/cenario.test.js
// O cenário da campanha (campanha/cenario.js) e o mapa da escada (campanha/mapa.js): puros e determinísticos.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gerarCenario, moverParticula, TEMAS, tabuleiro, porta } from '../cenario.js'
import { layoutDoMapa, PORTA, PORTA_CHEFE } from '../mapa.js'
import { TEXTOS, MUNDOS, textosDaFase } from '../mundos/index.js'

const L = 854
const A = 480

test('mesma semente, mesmo cenário; semente diferente, cenário diferente', () => {
  for (const tema of Object.keys(TEMAS)) {
    const a = gerarCenario(tema, { largura: L, altura: A })
    const b = gerarCenario(tema, { largura: L, altura: A })
    assert.deepEqual(a, b, tema)
    assert.equal(a.tema, tema)
    const c = gerarCenario(tema, { largura: L, altura: A, semente: 'outra' })
    assert.notDeepEqual(c, a, tema)
  }
  assert.equal(gerarCenario('inventado').tema, 'mapa')
})

test('as formas são válidas: polígonos com pontos pares e finitos, alphas em 0..1, cores de 24 bits, nada longe da tela', () => {
  for (const tema of Object.keys(TEMAS)) {
    const c = gerarCenario(tema, { largura: L, altura: A })
    assert.ok(c.formas.length > 20, tema)
    for (const f of c.formas) {
      assert.ok(f.alpha >= 0 && f.alpha <= 1, `${tema}: alpha ${f.alpha}`)
      assert.ok(Number.isInteger(f.cor) && f.cor >= 0 && f.cor <= 0xffffff)
      const pts = f.tipo === 'poligono' ? f.pontos : [f.x1, f.y1, f.x2, f.y2]
      assert.ok(f.tipo !== 'poligono' || (pts.length >= 6 && pts.length % 2 === 0), tema)
      for (let k = 0; k < pts.length; k += 2) {
        assert.ok(Number.isFinite(pts[k]) && Number.isFinite(pts[k + 1]))
        assert.ok(pts[k] > -L && pts[k] < 2 * L && pts[k + 1] > -A && pts[k + 1] < 2 * A, `${tema}: ponto fora (${pts[k]}, ${pts[k + 1]})`)
      }
    }
    // o fundo é escuro (mundo sombrio): cada canal abaixo de 16
    for (const s of [16, 8, 0]) assert.ok(((c.fundo >> s) & 255) < 16, tema)
    // a luz é fraca: nenhum feixe somado acima de 0,9 (e quase todos bem abaixo)
    for (const f of c.formas.filter((x) => x.luz)) assert.ok(f.alpha <= 0.9)
  }
})

test('o chão xadrez: as casas ficam mais fortes perto de quem olha', () => {
  const f = tabuleiro({ horizonte: 240, altura: A, fuga: L / 2, base: L * 2, linhas: 8, colunas: 10, cores: [1, 2] })
  const casas = f.slice(1)
  const yMedio = (p) => (p.pontos[1] + p.pontos[5]) / 2
  const longe = casas.filter((p) => yMedio(p) < 260)
  const perto = casas.filter((p) => yMedio(p) > 400)
  assert.ok(longe.length && perto.length)
  assert.ok(Math.max(...longe.map((p) => p.alpha)) < Math.min(...perto.map((p) => p.alpha)))
})

test('porta: com luz tem a fresta acesa (forma somada); sem luz, nenhuma', () => {
  assert.ok(porta({ x: 100, y: 200, w: 40, h: 66, luz: 1 }).some((f) => f.luz))
  assert.ok(!porta({ x: 100, y: 200, w: 40, h: 66, luz: 0 }).some((f) => f.luz))
})

test('partículas andam e dão a volta pelas bordas', () => {
  const p = moverParticula({ x: 10, y: -11, vx: 0, vy: -10 }, 1000, L, A)
  assert.ok(p.y > A)
  const q = moverParticula({ x: L + 11, y: 50, vx: 10, vy: 0 }, 1000, L, A)
  assert.ok(q.x < 0)
  const r = moverParticula({ x: 100, y: 100, vx: 3, vy: -4 }, 500, L, A)
  assert.deepEqual([r.x, r.y], [101.5, 98])
})

test('cada fase do mundo 1 tem um cenário que existe', () => {
  for (const f of MUNDOS[0].fases) assert.ok(TEMAS[textosDaFase(1, f.n).cenario], f.id)
  assert.ok(TEMAS[TEXTOS[1].cenarioMapa])
})

test('mapa: uma escada que desce; patamares em ordem, dentro da tela, a porta do chefe maior', () => {
  const m = layoutDoMapa(6, { largura: L })
  assert.equal(m.patamares.length, 6)
  for (let i = 1; i < 6; i++) {
    assert.ok(m.patamares[i].x > m.patamares[i - 1].x, 'anda para a direita')
    assert.ok(m.patamares[i].y > m.patamares[i - 1].y, 'desce')
  }
  for (const p of m.patamares) {
    assert.ok(p.x - p.largura / 2 >= 0 && p.x + p.largura / 2 <= L)
    assert.ok(p.porta.y - p.porta.h > 60, 'a porta não invade o título')
    assert.ok(p.estrelas.every((e) => e.y < 368), 'as estrelas ficam acima do painel')
    assert.equal(p.estrelas.length, 3)
  }
  assert.deepEqual([m.patamares[5].porta.w, m.patamares[5].porta.h], [PORTA_CHEFE.w, PORTA_CHEFE.h])
  assert.deepEqual([m.patamares[0].porta.w, m.patamares[0].porta.h], [PORTA.w, PORTA.h])
  // os degraus ligam um patamar ao outro, sempre descendo
  assert.ok(m.degraus.length >= 5 * 2)
  for (let i = 1; i < m.degraus.length; i++) assert.ok(m.degraus[i].x >= m.degraus[i - 1].x)
  assert.deepEqual(layoutDoMapa(6, { largura: L }), m)
  assert.equal(layoutDoMapa(1).degraus.length, 0)
})
