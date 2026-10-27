import { test } from 'node:test'
import assert from 'node:assert/strict'
import { elegerHost, pontuar, ligacao, lerDiretos, MARGEM_MS, RELE_EXTRA_MS, QUEDA_MS } from '../eleicao.js'

// O placar da eleição do host da partida (Fase 5A)

const m = (id, vaga, ping, quedas = 0) => ({ id, vaga, ping, quedas })

test('ligação: o direto vale (o menor relato); sem ele, o caminho pelo servidor', () => {
  const a = m('a', 0, 40)
  const b = m('b', 1, 60)
  assert.deepEqual(ligacao(a, b, {}), { ms: 40 + 60 + RELE_EXTRA_MS, direto: false })
  assert.deepEqual(ligacao(a, b, { a: { b: 30 }, b: { a: 25 } }), { ms: 25, direto: true })
  assert.deepEqual(ligacao(a, b, { b: { a: 12 } }), { ms: 12, direto: true })
  assert.equal(ligacao(a, m('c', 2, null), {}), null)
  assert.deepEqual(ligacao(a, m('c', 2, null), { c: { a: 50 } }), { ms: 50, direto: true }, 'sem ping, mas com direto')
})

test('2 jogadores: a ligação é a mesma nos dois sentidos, empata e fica o dono', () => {
  const r = elegerHost({ membros: [m('dono', 0, 120), m('b', 1, 20)], dono: 'dono' })
  assert.equal(r.host, 'dono')
  assert.equal(r.pontos.dono, r.pontos.b)
  // ... a não ser que o dono tenha caído nesta sala
  const r2 = elegerHost({ membros: [m('dono', 0, 120, 1), m('b', 1, 20)], dono: 'dono' })
  assert.equal(r2.host, 'b')
  assert.equal(r2.pontos.dono - r2.pontos.b, QUEDA_MS)
})

test('4 jogadores: o centro com as melhores ligações ganha', () => {
  // o dono tem internet ruim (200 ms até o servidor); c está perto de todos
  const membros = [m('dono', 0, 200), m('b', 1, 40), m('c', 2, 20), m('d', 3, 40)]
  const r = elegerHost({ membros, dono: 'dono' })
  assert.equal(r.host, 'c')
  assert.equal(r.motivo, 'melhor_conexao')
  assert.ok(r.pontos.c < r.pontos.b && r.pontos.b < r.pontos.dono)
})

test('dentro da margem fica o dono (troca à toa custa a estrela)', () => {
  const membros = [m('dono', 0, 50), m('b', 1, 30), m('c', 2, 50)]
  const r = elegerHost({ membros, dono: 'dono' })
  assert.ok(r.pontos.dono - r.pontos.b <= MARGEM_MS)
  assert.equal(r.host, 'dono')
  assert.equal(r.motivo, 'margem')
  // com margem 0 o melhor ganha
  assert.equal(elegerHost({ membros, dono: 'dono', margemMs: 0 }).host, 'b')
})

test('empate entre dois que não são o dono: a menor vaga', () => {
  const membros = [m('dono', 0, 300), m('b', 1, 20), m('c', 2, 20), m('d', 3, 20)]
  const r = elegerHost({ membros, dono: 'dono' })
  assert.equal(r.pontos.b, r.pontos.c)
  assert.equal(r.host, 'b')
})

test('quem tem ligações diretas é preferido: direto rápido ganha do caminho pelo servidor', () => {
  // todo mundo com ping parecido, mas o dono tem direto com todos (a estrela de antes)
  const membros = [m('dono', 0, 60), m('b', 1, 40), m('c', 2, 40), m('d', 3, 40)]
  const diretos = { dono: { b: 20, c: 25, d: 22 } }
  const r = elegerHost({ membros, diretos, dono: 'dono' })
  assert.equal(r.host, 'dono')
  assert.equal(r.motivo, 'melhor_conexao')
  // um membro sem nenhum direto ainda concorre pelo servidor (e perde)
  assert.ok(pontuar(membros[1], membros, diretos) > pontuar(membros[0], membros, diretos))
})

test('medidas faltando: quem não dá para medir não concorre; sem medida do dono, fica o dono', () => {
  const sem = [m('dono', 0, null), m('b', 1, 20), m('c', 2, 20)]
  assert.deepEqual(elegerHost({ membros: sem, dono: 'dono' }).motivo, 'sem_medidas')
  assert.equal(elegerHost({ membros: sem, dono: 'dono' }).host, 'dono')
  // c sem ping e sem direto: não concorre, e ninguém consegue medir a ligação com ele
  const semC = [m('dono', 0, 200), m('b', 1, 20), m('c', 2, null)]
  const r = elegerHost({ membros: semC, dono: 'dono' })
  assert.equal(r.host, 'dono')
  assert.equal(r.pontos.c, null)
  // sala sozinha / dono fora da lista
  assert.equal(elegerHost({ membros: [m('dono', 0, 10)], dono: 'dono' }).motivo, 'sem_sala')
  assert.equal(elegerHost({ membros: [m('b', 1, 10), m('c', 2, 10)], dono: 'dono' }).host, 'dono')
})

test('lerDiretos: só ids da sala e números válidos', () => {
  assert.deepEqual(lerDiretos({ a: 20, b: -1, c: 'x', z: 10, d: 9000 }, ['a', 'b', 'c', 'd']), { a: 20 })
  assert.deepEqual(lerDiretos(null, ['a']), {})
  assert.deepEqual(lerDiretos({ __proto__: { a: 1 } }, ['a']), {})
})
