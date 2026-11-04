// node --test src/game/manual/__tests__/pagina2.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  criarPagina2,
  falaDaEtapa2,
  expressaoDaPagina2,
  ETAPAS2,
  FALAS_INTRO2,
  FALA_VOLTA,
  TEXTOS,
  PREPARO_MS,
  RETRY_MS,
  ACERTOU_MS,
  ERROS_PARA_PULAR,
} from '../pagina2.js'
import { LICOES } from '../padroes.js'
import { EXPRESSOES } from '../ralsei.js'

const CAIXA = { esquerda: 440, direita: 780, topo: 148, base: 348 }
const nova = (op) => criarPagina2({ caixa: CAIXA, ...op })
const PARADO = { x: 0, y: 0 }

const rodar = (p, ms, joy = PARADO) => {
  for (let t = 0; t < ms; t += 16) p.tick(16, typeof joy === 'function' ? joy() : joy)
}
const passarIntro = (p) => {
  while (p.etapa === 'intro') p.avancar()
}
// joga a tentativa atual até acabar (desviando bem ou ficando parado)
function jogar(p, bem) {
  assert.equal(p.etapa, 'preparar')
  rodar(p, PREPARO_MS + 16)
  assert.equal(p.etapa, 'tentar')
  for (let i = 0; i < 2000 && p.etapa === 'tentar'; i++) p.tick(16, bem ? p.sugestao() : PARADO)
}
const eventos = (p, tipo) => p.drenar().filter((e) => e.tipo === tipo)

test('fluxo completo: intro -> 4 mini-lições (demo, tentativa, adesivo) -> concluida -> virando -> fim', () => {
  const p = nova()
  assert.equal(p.etapa, 'intro')
  assert.equal(p.fala, FALAS_INTRO2[0])
  passarIntro(p)
  LICOES.forEach((l, i) => {
    assert.equal(p.etapa, 'explicar')
    assert.equal(p.licao, i)
    assert.equal(p.fala, TEXTOS[l.id].explicar)
    p.avancar()
    if (l.demo) {
      assert.equal(p.etapa, 'demo')
      assert.ok(p.demoCoracao)
      rodar(p, l.demo + 50)
      assert.equal(p.demoVista[i], true)
    }
    jogar(p, true)
    assert.equal(p.etapa, 'acertou', l.id)
    assert.deepEqual(eventos(p, 'licao').map((e) => [e.indice, e.resultado]), [[i, 'feita']])
    assert.equal(p.licoes[i], 'feita')
    assert.equal(p.balas.length, 0)
    rodar(p, ACERTOU_MS + 20)
  })
  assert.equal(p.etapa, 'concluida')
  assert.equal(p.adesivos, 4)
  assert.ok(p.completa)
  p.avancar()
  assert.equal(p.etapa, 'virando')
  p.terminouDeVirar()
  assert.equal(p.etapa, 'fim')
  assert.equal(p.avancar(), false)
})

test('demonstração: o coração do Ralsei desvia sozinho (nunca toca numa bala) e A pula direto para a tentativa', () => {
  for (const l of LICOES.filter((x) => x.demo)) {
    const p = nova({ licoes: LICOES.map((x) => (x.id === l.id ? null : 'feita')) })
    passarIntro(p)
    assert.equal(p.licaoAtual.id, l.id)
    p.avancar()
    assert.equal(p.etapa, 'demo')
    const antes = { ...p.coracao }
    let tocou = 0
    for (let t = 0; t < l.demo + 50; t += 16) {
      p.tick(16, { x: 100, y: 100 }) // o jogador mexendo não muda nada na demo
      tocou += eventos(p, 'demoTocou').length
    }
    assert.equal(tocou, 0, l.id)
    assert.deepEqual(antes, { x: 610, y: 248 })
    assert.equal(p.etapa, 'preparar')
  }
  const p = nova()
  passarIntro(p)
  p.avancar()
  rodar(p, 300)
  assert.equal(p.etapa, 'demo')
  p.avancar() // pular
  assert.equal(p.etapa, 'preparar')
  assert.equal(p.demoVista[0], false)
  assert.equal(p.balas.length, 0, 'as balas da demo somem')
})

test('acerto: incentivo da mini-lição e recomeça SÓ ela (A ou sozinho); o padrão se repete igual', () => {
  const p = nova()
  passarIntro(p)
  p.avancar()
  p.avancar() // pula a demo
  jogar(p, false)
  assert.equal(p.etapa, 'errou')
  assert.equal(p.falhas[0], 1)
  assert.equal(p.fala, TEXTOS.chuva.errou[0])
  assert.equal(p.licao, 0)
  rodar(p, RETRY_MS + 20)
  assert.equal(p.etapa, 'preparar')
  assert.equal(p.tentativas[0], 2)
  // a mesma semente: as primeiras gotas da 2ª tentativa caem onde caíram na 1ª
  rodar(p, PREPARO_MS + 16)
  rodar(p, 400)
  const x2 = p.balas.map((b) => Math.round(b.x))
  const q = nova()
  passarIntro(q)
  q.avancar()
  q.avancar()
  rodar(q, PREPARO_MS + 16)
  rodar(q, 400)
  assert.deepEqual(q.balas.map((b) => Math.round(b.x)), x2)
  // A também recomeça na hora
  for (let i = 0; i < 2000 && p.etapa === 'tentar'; i++) p.tick(16, PARADO)
  assert.equal(p.etapa, 'errou')
  p.avancar()
  assert.equal(p.etapa, 'preparar')
})

test('3 erros na mesma mini-lição: oferece "pular esta parte" (↑/↓ + A); pular deixa sem adesivo e segue', () => {
  const p = nova()
  passarIntro(p)
  p.avancar()
  p.avancar()
  for (let k = 1; k < ERROS_PARA_PULAR; k++) {
    jogar(p, false)
    assert.equal(p.etapa, 'errou')
    p.avancar()
  }
  jogar(p, false)
  assert.equal(p.etapa, 'escolha')
  assert.equal(p.opcao, 0)
  assert.equal(p.mover('cima'), false, 'já está na primeira')
  // "tentar de novo" volta para a tentativa; errou de novo: escolha de novo
  p.avancar()
  assert.equal(p.etapa, 'preparar')
  jogar(p, false)
  assert.equal(p.etapa, 'escolha')
  assert.equal(p.mover('baixo'), true)
  assert.equal(p.opcao, 1)
  p.drenar()
  p.avancar()
  assert.deepEqual(eventos(p, 'licao'), [{ tipo: 'licao', indice: 0, resultado: 'pulada' }])
  assert.equal(p.licoes[0], 'pulada')
  assert.equal(p.etapa, 'explicar')
  assert.equal(p.licao, 1)
  assert.equal(p.adesivos, 0)
  // mover fora da escolha não faz nada
  assert.equal(p.mover('baixo'), false)
})

test('página com parte pulada também se completa (fala diferente) e conta só os adesivos ganhos', () => {
  const p = nova({ licoes: ['pulada', 'feita', 'feita', null] })
  assert.equal(p.fala, FALA_VOLTA, 'retomando: bem-vindo de volta')
  passarIntro(p)
  assert.equal(p.licao, 3)
  p.avancar() // mistura: sem demo, direto para a tentativa
  assert.equal(p.etapa, 'preparar')
  jogar(p, true)
  assert.equal(p.etapa, 'acertou')
  p.avancar()
  assert.equal(p.etapa, 'concluida')
  assert.equal(p.adesivos, 3)
  assert.notEqual(p.fala, falaDaEtapa2({ ...p, licoes: ['feita', 'feita', 'feita', 'feita'] }))
})

test('retomar: começa na 1ª mini-lição que falta; progresso inválido ou completo começa do zero', () => {
  assert.equal(nova({ licoes: ['feita', null, null, null] }).licao, 1)
  assert.equal(nova({ licoes: ['feita', 'pulada', null, 'feita'] }).licao, 2)
  for (const l of [null, 'lixo', [1, 2, 3], ['feita', 'feita', 'feita', 'feita'], ['xx', null, null, null]]) {
    const p = nova({ licoes: l })
    assert.equal(p.licao, 0, JSON.stringify(l))
    assert.deepEqual(p.licoes, [null, null, null, null])
    assert.equal(p.fala, FALAS_INTRO2[0])
  }
})

test('toda etapa tem fala e uma cara válida do Ralsei', () => {
  const p = nova()
  for (const e of ETAPAS2) {
    const q = { ...p, etapa: e, textos: p.textos, licoes: p.licoes, falhas: [1, 1, 1, 1], falas: p.falas, falaIdx: 0, licao: 0 }
    const f = falaDaEtapa2(q)
    assert.ok(typeof f === 'string' && f.length > 5 && f.length < 110, `${e}: ${f}`)
    assert.ok(EXPRESSOES.includes(expressaoDaPagina2(e)), e)
  }
  assert.equal(expressaoDaPagina2('errou'), 'incentivo')
  assert.equal(expressaoDaPagina2('demo'), 'concentrado')
  assert.equal(expressaoDaPagina2('acertou'), 'animado')
  assert.equal(expressaoDaPagina2('tentar', { tipo: 'acerto', ha: 100 }), 'surpreso')
  for (const t of Object.values(TEXTOS)) for (const f of [t.explicar, t.tentar, t.acertou, ...t.errou]) assert.ok(f.length < 110, f)
})

test('a barra da onda: 0 no preparo, sobe na tentativa, cheia no adesivo', () => {
  const p = nova()
  passarIntro(p)
  p.avancar()
  p.avancar()
  assert.equal(p.progressoOnda, 0)
  rodar(p, PREPARO_MS + 16)
  rodar(p, 3000, () => p.sugestao())
  assert.ok(p.progressoOnda > 0.4 && p.progressoOnda < 0.6)
  for (let i = 0; i < 2000 && p.etapa === 'tentar'; i++) p.tick(16, p.sugestao())
  assert.equal(p.progressoOnda, 1)
})
