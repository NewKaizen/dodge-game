// O foco do todos contra todos (pvp/focoFfa.js): node --test src/game/pvp/__tests__/focoFfa.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { quemEmFoco, estadoDoCartao, TEXTO_CARTAO, vistasDaGrade, vistasDoFoco, criarTransicao, avancarTransicao, suavizar, parametrosSopro, SOPRO, FOCO, TRANSICAO, posicaoDoCartao } from '../focoFfa.js'
import { alvosDoRodizio } from '../ffa.js'
import { LARGURA, ALTURA } from '../../constants.js'

test('vivo: o foco sou eu, o alvo é quem eu ataco, o atacante é quem me ataca; os outros ficam de fora', () => {
  const alvos = alvosDoRodizio([0, 1, 2, 3], 1) // passo 1: 0→1, 1→2, 2→3, 3→0
  assert.deepEqual(quemEmFoco({ alvos, eu: 2 }), { foco: 2, alvo: 3, atacante: 1, outros: [0, 1], espectador: false })
  const duplas = alvosDoRodizio([0, 1, 2, 3], 2) // passo 2: 0↔2, 1↔3
  assert.deepEqual(quemEmFoco({ alvos: duplas, eu: 1 }), { foco: 1, alvo: 3, atacante: 3, outros: [0, 2], espectador: false })
  const tres = alvosDoRodizio([0, 1, 2], 2) // 3 vivos, para a esquerda: 0→2, 1→0, 2→1
  assert.deepEqual(quemEmFoco({ alvos: tres, eu: 0 }), { foco: 0, alvo: 2, atacante: 1, outros: [1], espectador: false })
})

test('com a vaga 1 eliminada (3 vivos de 4): ela fica nos cartões, fora do rodízio', () => {
  const alvos = alvosDoRodizio([0, 2, 3], 1, 4) // 0→2, 2→3, 3→0
  const eliminados = [false, true, false, false]
  assert.deepEqual(quemEmFoco({ alvos, eu: 3, eliminados }), { foco: 3, alvo: 0, atacante: 2, outros: [1, 2], espectador: false })
})

test('espectador: segue quem escolheu (←/→); seguindo eliminado ou nada escolhido: o primeiro vivo', () => {
  const alvos = alvosDoRodizio([1, 2, 3], 1, 4) // a vaga 0 caiu: 1→2, 2→3, 3→1
  const eliminados = [true, false, false, false]
  assert.deepEqual(quemEmFoco({ alvos, eu: 0, eliminados, seguindo: 3 }), { foco: 3, alvo: 1, atacante: 2, outros: [0, 2], espectador: true })
  assert.equal(quemEmFoco({ alvos, eu: 0, eliminados, seguindo: null }).foco, 1)
  assert.equal(quemEmFoco({ alvos, eu: 0, eliminados: [true, false, true, false], seguindo: 2 }).foco, 1)
  // dois vivos: o alvo e o atacante são o mesmo
  const dois = alvosDoRodizio([1, 3], 5, 4)
  assert.deepEqual(quemEmFoco({ alvos: dois, eu: 0, eliminados: [true, false, true, false], seguindo: 3 }), { foco: 3, alvo: 1, atacante: 1, outros: [0, 2], espectador: true })
})

test('estado do cartão de quem está fora do foco: eliminado > sem conexão > caído > desviando > sem ataque', () => {
  assert.equal(estadoDoCartao({ eliminado: true, fora: true, caido: true, comAtaque: true }), 'eliminado')
  assert.equal(estadoDoCartao({ fora: true, caido: true, comAtaque: true }), 'semConexao')
  assert.equal(estadoDoCartao({ caido: true, comAtaque: true }), 'caido')
  assert.equal(estadoDoCartao({ comAtaque: true }), 'desviando')
  assert.equal(estadoDoCartao({}), 'livre')
  for (const e of ['eliminado', 'semConexao', 'caido', 'desviando', 'livre']) assert.ok(TEXTO_CARTAO[e])
})

test('vistas: a grade é o centro de cada célula; no foco o par aparece e os outros encolhem até o cartão e somem', () => {
  const grade = vistasDaGrade(4)
  assert.deepEqual(grade.map((v) => v.escala), [1, 1, 1, 1])
  assert.ok(grade.every((v) => v.visivel))
  const sel = quemEmFoco({ alvos: alvosDoRodizio([0, 1, 2, 3], 1), eu: 0 })
  const foco = vistasDoFoco(sel, 4)
  assert.deepEqual(foco[0], { ...FOCO.foco, visivel: true })
  assert.deepEqual(foco[1], { ...FOCO.alvo, visivel: true })
  assert.equal(foco[2].visivel, false)
  assert.equal(foco[3].visivel, false)
  assert.ok(foco[2].escala < 0.3 && foco[3].y > foco[2].y)
})

test('o foco cabe em 854x480 com 3 e 4 jogadores: nada sai da tela nem entra nos cartões do alto, caixas e cartões não se cruzam', () => {
  // a caixa padrão 220x170 cresce até o campo dela (~235x199), mais a faixa de aproximação
  const caixa = (v) => ({ x0: v.x - (235 / 2) * v.escala, x1: v.x + (235 / 2) * v.escala, y0: v.y - (199 / 2) * v.escala, y1: v.y + (199 / 2) * v.escala })
  const f = caixa(FOCO.foco)
  const a = caixa(FOCO.alvo)
  for (const r of [f, a]) {
    assert.ok(r.x0 >= 0 && r.x1 <= LARGURA && r.y1 <= ALTURA - 20, JSON.stringify(r))
    assert.ok(r.y0 >= 66 + 30, 'espaço para o rótulo acima, abaixo dos cartões do alto')
  }
  assert.ok(f.x1 < a.x0, 'a minha e a do alvo lado a lado')
  for (const n of [3, 4]) {
    for (let i = 0; i < n - 2; i++) {
      const c = posicaoDoCartao(i)
      assert.ok(c.x >= f.x1 && c.x + FOCO.cartoes.largura <= LARGURA && c.y + FOCO.cartoes.altura <= ALTURA - 14, `cartão ${i}`)
      assert.ok(c.y >= a.y1, `cartão ${i} abaixo da caixa do alvo`)
    }
  }
  // o espectador de 4 vê o par e 2 cartões (o dele entre eles)
  const sel = quemEmFoco({ alvos: alvosDoRodizio([1, 2, 3], 1, 4), eu: 0, eliminados: [true, false, false, false], seguindo: 2 })
  assert.equal(sel.outros.length, 2)
})

test('transição: ease nas pontas, chega exatamente no destino; quem some só some no fim; quem aparece já começa visível', () => {
  const de = vistasDaGrade(4)
  const sel = quemEmFoco({ alvos: alvosDoRodizio([0, 1, 2, 3], 1), eu: 0 })
  const para = vistasDoFoco(sel, 4)
  const t = criarTransicao(de, para)
  assert.equal(t.ms, TRANSICAO.ms)
  assert.ok(TRANSICAO.ms >= 600 && TRANSICAO.ms <= 800)
  const meio = avancarTransicao(t, TRANSICAO.ms / 2)
  assert.equal(meio.fim, false)
  assert.ok(Math.abs(meio.k - 0.5) < 1e-9)
  assert.equal(meio.vistas[2].visivel, true, 'encolhendo, ainda aparece')
  assert.ok(suavizar(0.1) < 0.1 && suavizar(0.9) > 0.9, 'devagar nas pontas')
  const fim = avancarTransicao(t, TRANSICAO.ms)
  assert.equal(fim.fim, true)
  assert.deepEqual(fim.vistas, para)
  // a volta: os de fora começam visíveis (crescem do cartão)
  const volta = criarTransicao(para, de)
  assert.equal(avancarTransicao(volta, 1).vistas[3].visivel, true)
})

test('reduzir animações: corte seco (0 ms, já no destino no primeiro passo)', () => {
  const de = vistasDaGrade(3)
  const para = vistasDoFoco(quemEmFoco({ alvos: alvosDoRodizio([0, 1, 2], 1), eu: 1 }), 3)
  const t = criarTransicao(de, para, { reduzir: true })
  assert.equal(t.ms, 0)
  assert.equal(t.corte, true)
  const r = avancarTransicao(t, 0)
  assert.equal(r.fim, true)
  assert.deepEqual(r.vistas, para)
})

test('o whoosh: entrar sobe, sair desce, de 300 a 500 ms; reduzido é mais curto e mais baixo', () => {
  const e = parametrosSopro('entrar')
  const s = parametrosSopro('sair')
  assert.ok(e.para > e.de && s.para < s.de)
  for (const p of [e, s]) assert.ok(p.dur >= 0.3 && p.dur <= 0.5 && p.vol > 0 && p.vol <= 0.2 && p.pico > 0 && p.pico < 1)
  assert.notDeepEqual(e, s)
  for (const tipo of ['entrar', 'sair']) {
    const r = parametrosSopro(tipo, { reduzir: true })
    assert.ok(r.dur < SOPRO[tipo].dur && r.vol < SOPRO[tipo].vol && r.vol > 0)
    assert.equal(r.de, SOPRO[tipo].de)
  }
  assert.deepEqual(parametrosSopro('???'), SOPRO.entrar)
})
