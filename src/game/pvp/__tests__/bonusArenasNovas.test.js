// node --test src/game/pvp/__tests__/bonusArenasNovas.test.js
// As 5 arenas novas (Estação, Chinatown, Cidade, Praia, Café): música própria e 10 bônus,
// Duelo + Cartas Malucas + 8 eventos de REGRA NOVA (os detalhes de cada um ficam nos testes
// eventos<Arena>.test.js). Nenhum evento antigo renomeado e nenhum dos eventos descartados.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ARENA, BONUS_POR_ARENA, eventosDaArena } from '../arenas.js'
import { EVENTO } from '../bonus.js'

const NOVAS = ['estacao', 'chinatown', 'cidade', 'praia', 'cafe']
const DESCARTADOS = ['meteoros', 'airlock', 'dragao', 'lanternas', 'transito', 'obra', 'ondaGigante', 'caranguejos', 'bolaDePraia', 'croissants', 'buleQuente', 'pombos']

test('arenas novas: música própria e exatamente Duelo + Cartas Malucas + 8 eventos de regra nova', () => {
  const vistos = new Set()
  for (const id of NOVAS) {
    const a = ARENA[id]
    assert.ok(a, id)
    assert.ok(a.musica === `arena_${id}` && a.tituloMusica, `${id}: música original`)
    const entradas = a.bonus.map((b) => (typeof b === 'string' ? { id: b } : b))
    assert.equal(entradas.length, BONUS_POR_ARENA, `${id}: ${entradas.length} bônus`)
    assert.ok(entradas.every((b) => !b.nome), `${id}: nenhum evento renomeado`)
    const ids = eventosDaArena(id).map((e) => e.id)
    assert.equal(ids.length, BONUS_POR_ARENA, `${id}: todos existem em EVENTOS`)
    assert.ok(ids.includes('duelo') && ids.includes('malucas'), id)
    for (const e of ids.filter((e) => e !== 'duelo' && e !== 'malucas')) {
      assert.ok(!vistos.has(e), `${e} repetido entre arenas`)
      vistos.add(e)
    }
  }
  assert.equal(vistos.size, 40)
})

test('os eventos descartados não existem mais', () => {
  const efeitos = readFileSync(new URL('../bonus/eventos/index.js', import.meta.url), 'utf8')
  for (const id of DESCARTADOS) {
    assert.ok(!EVENTO[id], `${id} ainda em EVENTOS`)
    assert.ok(!new RegExp(`import ${id} from`).test(efeitos), `${id} ainda importado`)
  }
})
