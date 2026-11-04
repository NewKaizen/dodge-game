// node --test src/game/manual/__tests__/progresso.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  progressoValido,
  normalizarProgresso,
  progressoVazio,
  comPagina1,
  comLicao,
  comPagina2,
  paginaParaRetomar,
  resumoDoIndice,
  PAGINAS,
} from '../progresso.js'

test('valida o formato: só objetos certinhos (ou null) podem ser salvos', () => {
  assert.equal(progressoValido(null), true)
  assert.equal(progressoValido(progressoVazio()), true)
  assert.equal(progressoValido({ p1: { completa: true }, p2: { completa: false, licoes: ['feita', 'pulada', null, null] } }), true)
  for (const ruim of [
    undefined,
    1,
    'x',
    [],
    {},
    { p1: { completa: 'sim' }, p2: { completa: false, licoes: [null, null, null, null] } },
    { p1: { completa: true }, p2: { completa: false, licoes: [null, null, null] } },
    { p1: { completa: true }, p2: { completa: false, licoes: ['ok', null, null, null] } },
    { p1: { completa: true }, p2: { completa: false } },
    { p1: [], p2: { completa: false, licoes: [null, null, null, null] } },
  ])
    assert.equal(progressoValido(ruim), false, JSON.stringify(ruim))
})

test('normalizar aproveita o que dá e nunca quebra', () => {
  assert.deepEqual(normalizarProgresso(undefined), progressoVazio())
  assert.deepEqual(normalizarProgresso('lixo'), progressoVazio())
  const n = normalizarProgresso({ p1: { completa: true }, p2: { completa: true, licoes: ['feita', 'xx', 'pulada'] } })
  assert.deepEqual(n, { p1: { completa: true }, p2: { completa: false, licoes: ['feita', null, 'pulada', null] } }, 'completa sem todas resolvidas não vale')
  assert.ok(progressoValido(n))
})

test('marcar: página 1, cada mini-lição (pular não apaga adesivo) e página 2 só com tudo resolvido', () => {
  let p = comPagina1(null)
  assert.equal(p.p1.completa, true)
  p = comLicao(p, 0, 'feita')
  p = comLicao(p, 0, 'pulada')
  assert.equal(p.p2.licoes[0], 'feita')
  p = comLicao(p, 1, 'pulada')
  p = comLicao(p, 9, 'feita')
  p = comLicao(p, 2, 'ganhei')
  assert.deepEqual(p.p2.licoes, ['feita', 'pulada', null, null])
  assert.equal(comPagina2(p).p2.completa, false)
  p = comLicao(comLicao(p, 2, 'feita'), 3, 'feita')
  p = comPagina2(p)
  assert.equal(p.p2.completa, true)
  assert.ok(progressoValido(p))
})

test('retomar e índice', () => {
  assert.equal(paginaParaRetomar(null), 1)
  assert.equal(paginaParaRetomar(comPagina1(null)), 2)
  const tudo = comPagina2(['feita', 'feita', 'pulada', 'feita'].reduce((p, r, i) => comLicao(p, i, r), comPagina1(null)))
  assert.equal(paginaParaRetomar(tudo), null)
  const r = resumoDoIndice(tudo)
  assert.deepEqual(r.map((x) => [x.pagina, x.completa, x.adesivos, x.total]), [[1, true, 1, 1], [2, true, 3, 4]])
  assert.deepEqual(r.map((x) => x.cena), PAGINAS.map((x) => x.cena))
  const meio = resumoDoIndice(comLicao(null, 0, 'feita'))
  assert.equal(meio[1].comecada, true)
  assert.equal(meio[1].completa, false)
})

test('preferencias.js guarda o progresso validado (chave "manual") e ignora lixo salvo', async () => {
  const guardado = new Map()
  globalThis.localStorage = { getItem: (k) => guardado.get(k) ?? null, setItem: (k, v) => guardado.set(k, String(v)) }
  guardado.set('dodge-preferencias', JSON.stringify({ manual: { p1: 'quebrado' } }))
  const a = await import('../../preferencias.js?manual=1')
  assert.equal(a.pref('manual'), null, 'lixo salvo vira o padrão')
  const bom = comLicao(comPagina1(null), 1, 'feita')
  a.definirPref('manual', bom)
  a.definirPref('manual', { p1: 1 }) // inválido: não muda nada
  assert.deepEqual(JSON.parse(guardado.get('dodge-preferencias')).manual, bom)
  const b = await import('../../preferencias.js?manual=2')
  assert.deepEqual(b.pref('manual'), bom, 'relido do navegador')
})
