// node --test src/game/pvp/__tests__/
// O layout dos cartões da votação de arena (pvp/layoutVoto.js): serve a qualquer número de arenas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { layoutVoto, vizinho, AREA_VOTO, POR_FILEIRA_MAX } from '../layoutVoto.js'
import { ARENAS } from '../arenas.js'

const LARGURA = 854
const intersecta = (a, b, g) => Math.abs(a.x - b.x) < g.largura && Math.abs(a.y - b.y) < g.altura

test('layoutVoto: de 1 a 24 cartões, todos dentro da área, sem sobrepor e dentro da largura do painel', () => {
  for (let n = 1; n <= 24; n++) {
    const g = layoutVoto(n)
    assert.equal(g.cartoes.length, n)
    assert.ok(g.linhas >= 1 && g.linhas <= 3, `n=${n}: ${g.linhas} fileiras`)
    assert.ok(g.colunas * g.linhas >= n)
    assert.ok(g.largura >= AREA_VOTO.larguraMin && g.altura >= 40, `n=${n}: cartão ${g.largura}x${g.altura}`)
    const esquerda = Math.min(...g.cartoes.map((c) => c.x - g.largura / 2))
    const direita = Math.max(...g.cartoes.map((c) => c.x + g.largura / 2))
    assert.ok(esquerda >= (LARGURA - AREA_VOTO.largura) / 2 - 1 && direita <= (LARGURA + AREA_VOTO.largura) / 2 + 1, `n=${n}: ${esquerda}..${direita}`)
    assert.ok(Math.min(...g.cartoes.map((c) => c.y - g.altura / 2)) >= g.topo - 0.5)
    assert.ok(g.base <= AREA_VOTO.base + 1 || g.linhas === 1, `n=${n}: base ${g.base}`)
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) assert.ok(!intersecta(g.cartoes[i], g.cartoes[j], g), `n=${n}: ${i} e ${j} se sobrepõem`)
  }
})

test('layoutVoto: até 8 cartões numa fileira só (o visual de sempre); 12 viram 2 fileiras de 6', () => {
  for (let n = 1; n <= POR_FILEIRA_MAX; n++) {
    const g = layoutVoto(n)
    assert.equal(g.linhas, 1)
    assert.equal(g.altura, AREA_VOTO.alturaUmaFileira)
    assert.equal(g.compacto, false)
    assert.ok(g.cartoes.every((c) => c.y === AREA_VOTO.yUmaFileira))
  }
  const g7 = layoutVoto(7)
  assert.equal(g7.largura, 100) // 7 cartões = 760 px, igual ao painel
  const g12 = layoutVoto(12)
  assert.deepEqual([g12.linhas, g12.colunas, g12.compacto], [2, 6, true])
  assert.ok(g12.cartoes.slice(0, 6).every((c) => c.y === g12.cartoes[0].y) && g12.cartoes[6].y > g12.cartoes[0].y)
  // com as arenas de hoje (+ o "?")
  const g = layoutVoto(ARENAS.length + 1)
  assert.ok(g.cartoes.length === ARENAS.length + 1 && g.linhas <= 2)
})

test('layoutVoto: a última fileira incompleta fica centralizada', () => {
  const g = layoutVoto(11) // 2 fileiras: 6 + 5
  const ultima = g.cartoes.slice(6)
  const meio = (ultima[0].x + ultima.at(-1).x) / 2
  assert.ok(Math.abs(meio - 427) < 0.5, `centro ${meio}`)
})

test('vizinho: ← → andam em fila e dão a volta', () => {
  for (const n of [2, 7, 10, 12, 13]) {
    const g = layoutVoto(n)
    let i = 0
    const visitados = new Set()
    for (let k = 0; k < n; k++) {
      visitados.add(i)
      i = vizinho(i, 'direita', n, g.colunas)
    }
    assert.equal(i, 0, `n=${n}: volta ao começo`)
    assert.equal(visitados.size, n, `n=${n}: passou por todos`)
    assert.equal(vizinho(0, 'esquerda', n, g.colunas), n - 1)
    assert.equal(vizinho(vizinho(3 % n, 'direita', n, g.colunas), 'esquerda', n, g.colunas), 3 % n)
  }
})

test('vizinho: ↑ ↓ trocam de fileira na mesma coluna, e numa fileira só não fazem nada', () => {
  assert.equal(vizinho(3, 'baixo', 5, 5), 3)
  assert.equal(vizinho(3, 'cima', 5, 5), 3)
  const g = layoutVoto(12) // 2 x 6
  for (let i = 0; i < 12; i++) {
    const baixo = vizinho(i, 'baixo', 12, g.colunas)
    assert.equal(baixo % g.colunas, i % g.colunas, 'mesma coluna')
    assert.notEqual(Math.floor(baixo / g.colunas), Math.floor(i / g.colunas))
    assert.equal(vizinho(baixo, 'cima', 12, g.colunas), i, 'cima desfaz baixo')
  }
  // fileira de baixo incompleta: cai no último cartão em vez de sair da lista
  const g13 = layoutVoto(13) // 2 x 7: 7 + 6
  for (let i = 0; i < 13; i++) assert.ok(vizinho(i, 'baixo', 13, g13.colunas) < 13)
  assert.equal(vizinho(6, 'baixo', 13, g13.colunas), 12)
})
