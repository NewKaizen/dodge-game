// node --test src/game/manual/__tests__/indice.test.js
// O índice do manual (manual/indice.js): as 5 páginas essenciais e os 4 EXTRAS, oferecidos e nunca forçados.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { opcoesDoIndice, DICAS_PAGINA, COR_EXTRA } from '../indice.js'
import { comPagina1, comPagina5, comPasso, comPagina, PAGINAS } from '../progresso.js'

test('sem progresso: 9 linhas, sem CONTINUAR, os extras (6 a 9) marcados "EXTRA" e em outra cor', () => {
  const l = opcoesDoIndice(null)
  assert.equal(l.length, 9)
  assert.ok(!l.some((x) => x.rotulo.startsWith('CONTINUAR')))
  assert.deepEqual(l.map((x) => x.cena), PAGINAS.map((x) => x.cena))
  const extras = l.slice(5)
  assert.ok(extras.every((x) => x.extra && x.rotulo.startsWith('EXTRA · PÁGINA') && x.cor === COR_EXTRA))
  assert.ok(l.slice(0, 5).every((x) => !x.extra && !x.rotulo.startsWith('EXTRA') && x.cor !== COR_EXTRA))
  assert.deepEqual(extras.map((x) => x.rotulo), ['EXTRA · PÁGINA 6 · OS QUATRO NAIPES', 'EXTRA · PÁGINA 7 · GRAZE: RASPANDO', 'EXTRA · PÁGINA 8 · JOGANDO EM DUPLA', 'EXTRA · PÁGINA 9 · ASES, SUPER E PERFEITOS'])
  assert.ok(extras.every((x) => x.dica.startsWith('extra:')))
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) assert.ok(DICAS_PAGINA[n], `dica da página ${n}`)
})

test('CONTINUAR é do essencial: aponta a 1ª página essencial que falta, nunca um extra', () => {
  const l = opcoesDoIndice(comPagina1(null))
  assert.equal(l[0].rotulo, 'CONTINUAR · PÁGINA 2')
  assert.equal(l[0].cena, 'ManualRalsei2')
  // fez um extra sem terminar o essencial: o CONTINUAR segue no essencial
  const extraFeito = comPasso(null, 7, 0, 'feita')
  assert.equal(opcoesDoIndice(extraFeito)[0].rotulo, 'CONTINUAR · PÁGINA 1')
})

// o essencial 100% (páginas 1 a 5 completas)
function essencialPronto() {
  const p = comPagina1(null)
  p.p2 = { completa: true, licoes: ['feita', 'feita', 'feita', 'feita'] }
  p.p3 = { completa: true, passos: ['feita', 'feita'] }
  p.p4 = { completa: true, passos: ['feita', 'feita', 'feita'] }
  return comPagina5(p)
}

test('com o essencial completo não há CONTINUAR, a não ser para um extra que a pessoa já começou', () => {
  const l = opcoesDoIndice(essencialPronto())
  assert.equal(l.length, 9)
  assert.ok(!l.some((x) => x.rotulo.startsWith('CONTINUAR')))
  assert.ok(l.slice(0, 5).every((x) => x.completa))
  assert.ok(l.slice(5).every((x) => !x.completa && x.extra), 'os extras seguem oferecidos, nada obrigatório')
})

test('extra começado e completo: adesivos, "jogar de novo" (recomeça) e o CONTINUAR de extra', () => {
  let p = comPasso(essencialPronto(), 8, 0, 'feita')
  const comeco = opcoesDoIndice(p)
  assert.equal(comeco[0].rotulo, 'CONTINUAR · EXTRA 8')
  assert.equal(comeco[0].cena, 'ManualRalsei8')
  const e8 = comeco.find((x) => x.rotulo.startsWith('EXTRA') && x.cena === 'ManualRalsei8')
  assert.match(e8.dica, /adesivos: 1 de 2/)
  assert.equal(e8.completa, false)
  p = comPagina(comPasso(p, 8, 1, 'feita'), 8)
  const fim = opcoesDoIndice(p)
  const e8b = fim.find((x) => x.cena === 'ManualRalsei8')
  assert.equal(e8b.completa, true)
  assert.equal(e8b.recomecar, true)
  assert.match(e8b.dica, /jogar de novo/)
  assert.ok(!fim.some((x) => x.rotulo.startsWith('CONTINUAR')), 'extra completo não retoma')
})
