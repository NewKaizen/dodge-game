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
  comPasso,
  comPagina,
  comPagina5,
  essencialCompleto,
  TOTAL_PASSOS,
  paginaParaRetomar,
  resumoDoIndice,
  PAGINAS,
  ESSENCIAIS,
  EXTRAS,
  extraParaRetomar,
  extrasCompletos,
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
  assert.deepEqual(n, { ...progressoVazio(), p1: { completa: true }, p2: { completa: false, licoes: ['feita', null, 'pulada', null] } }, 'completa sem todas resolvidas não vale')
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
  const ate2 = comPagina2(['feita', 'feita', 'pulada', 'feita'].reduce((p, r, i) => comLicao(p, i, r), comPagina1(null)))
  assert.equal(paginaParaRetomar(ate2), 3)
  const ate3 = comPagina(comPasso(comPasso(ate2, 3, 0, 'feita'), 3, 1, 'pulada'), 3)
  assert.equal(paginaParaRetomar(ate3), 4)
  const ate4 = comPagina(['feita', 'feita', 'feita'].reduce((p, r, i) => comPasso(p, 4, i, r), ate3), 4)
  assert.equal(paginaParaRetomar(ate4), 5)
  const tudo = comPagina5(ate4)
  assert.equal(paginaParaRetomar(tudo), null)
  const r = resumoDoIndice(tudo)
  assert.deepEqual(r.slice(0, 5).map((x) => [x.pagina, x.completa, x.adesivos, x.total]), [[1, true, 1, 1], [2, true, 3, 4], [3, true, 1, 2], [4, true, 3, 3], [5, true, 1, 1]])
  assert.deepEqual(r.map((x) => x.cena), PAGINAS.map((x) => x.cena))
  assert.deepEqual(r.slice(5).map((x) => [x.pagina, x.extra, x.completa]), [[6, true, false], [7, true, false], [8, true, false], [9, true, false]], 'os extras vêm depois, marcados, e não entram no essencial')
  const meio = resumoDoIndice(comLicao(null, 0, 'feita'))
  assert.equal(meio[1].comecada, true)
  assert.equal(meio[1].completa, false)
})

test('páginas 3 e 4: passos salvos, validados e o progresso antigo (sem p3/p4) continua valendo', () => {
  const antigo = { p1: { completa: true }, p2: { completa: true, licoes: ['feita', 'feita', 'feita', 'feita'] } }
  assert.equal(progressoValido(antigo), true, 'o salvo de antes das páginas 3 e 4 não vira lixo')
  assert.deepEqual(normalizarProgresso(antigo).p3, { completa: false, passos: [null, null] })
  assert.deepEqual(TOTAL_PASSOS, { 3: 2, 4: 3, 6: 5, 7: 2, 8: 2, 9: 3 })
  for (const ruim of [
    { ...antigo, p3: { completa: false, passos: [null] } },
    { ...antigo, p3: { completa: 'sim', passos: [null, null] } },
    { ...antigo, p4: { completa: false, passos: ['ok', null, null] } },
    { ...antigo, p4: [] },
  ])
    assert.equal(progressoValido(ruim), false, JSON.stringify(ruim))
  let p = comPasso(antigo, 4, 0, 'feita')
  p = comPasso(p, 4, 0, 'pulada')
  assert.equal(p.p4.passos[0], 'feita', 'pular não apaga o adesivo')
  p = comPasso(p, 4, 7, 'feita')
  p = comPasso(p, 5, 0, 'feita')
  p = comPasso(p, 4, 1, 'ganhei')
  assert.deepEqual(p.p4.passos, ['feita', null, null])
  assert.equal(comPagina(p, 4).p4.completa, false, 'só completa com tudo resolvido')
  assert.equal(normalizarProgresso({ ...antigo, p3: { completa: true, passos: ['feita', null] } }).p3.completa, false)
  assert.ok(progressoValido(p))
  const meio = resumoDoIndice(comPasso(null, 3, 1, 'feita'))
  assert.deepEqual([meio[2].comecada, meio[2].adesivos, meio[3].comecada], [true, 1, false])
})

test('página 5 e o manual essencial: 5 páginas essenciais (mais 4 extras), a flag vem só com a página 5, e o salvo antigo continua valendo', () => {
  assert.equal(ESSENCIAIS.length, 5)
  assert.equal(PAGINAS.length, 9)
  assert.deepEqual(PAGINAS[4], { pagina: 5, titulo: 'Uma partida de verdade', cena: 'ManualRalsei5' })
  const antigo = { p1: { completa: true }, p2: { completa: true, licoes: ['feita', 'feita', 'feita', 'feita'] }, p3: { completa: true, passos: ['feita', 'feita'] }, p4: { completa: true, passos: ['feita', 'feita', 'feita'] } }
  assert.equal(progressoValido(antigo), true, 'o salvo de antes da página 5 não vira lixo')
  assert.deepEqual(normalizarProgresso(antigo).p5, { completa: false })
  assert.equal(essencialCompleto(antigo), false)
  for (const ruim of [{ ...antigo, p5: { completa: 'sim' } }, { ...antigo, p5: [] }, { ...antigo, essencial: 1 }]) assert.equal(progressoValido(ruim), false, JSON.stringify(ruim))
  // a flag sozinha (sem a página 5) não vale
  assert.equal(normalizarProgresso({ ...antigo, essencial: true }).essencial, false)
  const p = comPagina5(antigo)
  assert.equal(p.p5.completa, true)
  assert.equal(p.essencial, true)
  assert.equal(essencialCompleto(p), true)
  assert.ok(progressoValido(p))
  assert.deepEqual(comPagina(antigo, 5), p, 'comPagina(5) = comPagina5')
  // a página 5 conta mesmo sem as outras completas (o adesivo é de quem jogou a partida)
  assert.equal(essencialCompleto(comPagina5(null)), true)
  assert.equal(paginaParaRetomar(comPagina5(null)), 1)
  assert.equal(resumoDoIndice(antigo)[4].completa, false)
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

test('extras (6 a 9): marcados, passos salvos e validados, e nunca puxam o CONTINUAR do essencial', () => {
  assert.deepEqual(EXTRAS.map((e) => e.pagina), [6, 7, 8, 9])
  assert.ok(EXTRAS.every((e) => e.extra && /^ManualRalsei[6-9]$/.test(e.cena)))
  assert.ok(ESSENCIAIS.every((e) => !e.extra))
  // o salvo de antes dos extras continua valendo e ganha os extras vazios
  const antigo = { p1: { completa: true }, p2: { completa: true, licoes: ['feita', 'feita', 'feita', 'feita'] } }
  assert.equal(progressoValido(antigo), true)
  assert.deepEqual(normalizarProgresso(antigo).p6, { completa: false, passos: [null, null, null, null, null] })
  assert.deepEqual(normalizarProgresso(antigo).p9, { completa: false, passos: [null, null, null] })
  for (const ruim of [{ ...antigo, p6: { completa: false, passos: [null, null] } }, { ...antigo, p7: { completa: 'sim', passos: [null, null] } }, { ...antigo, p9: [] }, { ...antigo, p8: { completa: false, passos: ['ok', null] } }])
    assert.equal(progressoValido(ruim), false, JSON.stringify(ruim))
  // marcar: pular não apaga adesivo; passo fora do intervalo é ignorado; completa só com tudo resolvido
  let p = comPasso(null, 7, 0, 'feita')
  p = comPasso(p, 7, 0, 'pulada')
  p = comPasso(p, 7, 5, 'feita')
  assert.deepEqual(p.p7.passos, ['feita', null])
  assert.equal(comPagina(p, 7).p7.completa, false)
  p = comPagina(comPasso(p, 7, 1, 'pulada'), 7)
  assert.equal(p.p7.completa, true)
  assert.ok(progressoValido(p))
  // o CONTINUAR é do essencial: ninguém é puxado para um extra sem querer
  assert.equal(paginaParaRetomar(p), 1, 'um extra feito não conta como essencial')
  assert.equal(extraParaRetomar(null), null)
  assert.equal(extraParaRetomar(comPasso(null, 8, 0, 'feita')), 8, 'só retoma um extra já começado')
  assert.equal(extraParaRetomar(p), null, 'completo não retoma')
  assert.equal(extrasCompletos(p), 1)
  assert.equal(paginaParaRetomar(comPagina5(comPasso(null, 6, 0, 'feita'))), 1)
  // o selo do essencial não depende dos extras
  assert.equal(essencialCompleto(comPagina5(null)), true)
  assert.equal(resumoDoIndice(comPasso(null, 6, 1, 'feita'))[5].comecada, true)
})
