// node --test src/game/campanha/__tests__/recompensas.test.js
// O XP da campanha: o espelho em JS (recompensas.js) bate com o banco (0011_campanha.sql) e com a doc.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { xpDaCorrida, XP_PRIMEIRA, XP_PRIMEIRA_CHEFE, XP_ESTRELA, XP_REPETICAO, XP_CAMPANHA_DIA, textoMotivoCampanha } from '../recompensas.js'

const sql = readFileSync(new URL('../../../../supabase/migrations/0011_campanha.sql', import.meta.url), 'utf8')
const doc = readFileSync(new URL('../../../../docs/campanha.md', import.meta.url), 'utf8')
const constante = (nome) => Number(new RegExp(`function public\\.${nome}\\(\\) returns integer\\s+language sql immutable set search_path = '' as \\$\\$ select (\\d+) \\$\\$`).exec(sql)?.[1])

test('os números do SQL = os do JS = os da doc', () => {
  assert.equal(constante('campanha_xp_primeira'), XP_PRIMEIRA)
  assert.equal(constante('campanha_xp_primeira_chefe'), XP_PRIMEIRA_CHEFE)
  assert.equal(constante('campanha_xp_estrela'), XP_ESTRELA)
  assert.equal(constante('campanha_xp_repeticao'), XP_REPETICAO)
  assert.equal(constante('campanha_xp_dia'), XP_CAMPANHA_DIA)
  for (const n of [XP_PRIMEIRA, XP_PRIMEIRA_CHEFE, XP_ESTRELA, XP_REPETICAO, XP_CAMPANHA_DIA]) assert.match(doc, new RegExp(`\\*\\*${n} XP\\*\\*`))
})

test('primeira vitória, estrelas novas, repetição e o teto do dia', () => {
  assert.deepEqual(xpDaCorrida({ primeira: true, estrelas: 2 }), { xp: XP_PRIMEIRA + 2 * XP_ESTRELA, motivo: 'primeira' })
  assert.deepEqual(xpDaCorrida({ primeira: true, chefe: true, estrelas: 3 }), { xp: XP_PRIMEIRA_CHEFE + 3 * XP_ESTRELA, motivo: 'primeira' })
  assert.deepEqual(xpDaCorrida({ primeira: false, estrelasAntes: 1, estrelas: 3 }), { xp: 2 * XP_ESTRELA, motivo: 'estrelas' })
  assert.deepEqual(xpDaCorrida({ primeira: false, estrelasAntes: 3, estrelas: 2 }), { xp: XP_REPETICAO, motivo: 'repeticao' })
  assert.deepEqual(xpDaCorrida({ primeira: true, estrelas: 3, xpHoje: XP_CAMPANHA_DIA - 15 }), { xp: 15, motivo: 'teto_dia' })
  assert.deepEqual(xpDaCorrida({ primeira: false, estrelas: 1, estrelasAntes: 3, xpHoje: XP_CAMPANHA_DIA }), { xp: 0, motivo: 'teto_dia' })
  for (const m of ['primeira', 'estrelas', 'repeticao', 'teto_dia', 'suspeita', 'abandono', 'derrota']) assert.ok(textoMotivoCampanha(m))
})
