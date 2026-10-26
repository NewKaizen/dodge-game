// node --test src/game/pvp/__tests__/telaResultado.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { estadoInicialDaTela, deveDestravar, LIMITE_MS } from '../telaResultado.js'

const fonte = readFileSync(new URL('../../scenes/PvpResultado.js', import.meta.url), 'utf8')

// o que o create() define de novo a cada abertura (não precisa estar no estado inicial)
const DO_CREATE = new Set(['p1', 'p2', 'arena', 'vencedor', 'empate', 'rodadas', 'contraCpu', 'stats', 'corTitulo', 'corNumero', 'etapas', 'controles', 'rede', 'naSala', 'casual', 'xp', 'fundo', 'veu', 'raios', 'halo'])

test('resultado: todo campo que a cena guarda volta ao estado inicial na próxima partida', () => {
  const campos = new Set([...fonte.matchAll(/this\.([a-zA-Z]\w*)\s*=(?!=)/g)].map((m) => m[1]))
  const inicial = estadoInicialDaTela()
  const faltando = [...campos].filter((c) => !DO_CREATE.has(c) && !(c in inicial))
  assert.deepEqual(faltando, [], 'campos guardados de uma partida para a outra (a instância da cena é reaproveitada)')
  // e o create começa por ele, antes de montar qualquer coisa
  const create = fonte.slice(fonte.indexOf('  create('), fonte.indexOf('this.criarCenario()'))
  assert.match(create, /Object\.assign\(this, estadoInicialDaTela\(\)\)/)
})

test('resultado: a 2ª abertura não herda os textos da partida rápida anterior', () => {
  // a mesma instância (o Phaser reaproveita a cena)
  const cena = { linhasCasual: [{ destruido: true }], cursorCasual: {}, avisoCasual: {}, dicaPular: {}, entrada: [], liberou: true, liberado: true, saindo: true, revanche: { estado: 'aceita' } }
  Object.assign(cena, estadoInicialDaTela())
  for (const k of ['linhasCasual', 'cursorCasual', 'avisoCasual', 'dicaPular', 'entrada', 'revanche']) assert.equal(cena[k], null, k)
  assert.equal(cena.liberou, false)
  assert.equal(cena.liberado, false)
  assert.equal(cena.saindo, false)
  // listas novas a cada vez (não a mesma de antes)
  assert.notEqual(estadoInicialDaTela().contadores, estadoInicialDaTela().contadores)
})

test('resultado: destrava as opções depois do limite, uma vez só', () => {
  assert.equal(deveDestravar({ relogio: 0, liberou: false, saindo: false }), false)
  assert.equal(deveDestravar({ relogio: LIMITE_MS - 1, liberou: false, saindo: false }), false)
  assert.equal(deveDestravar({ relogio: LIMITE_MS, liberou: false, saindo: false }), true)
  assert.equal(deveDestravar({ relogio: LIMITE_MS * 3, liberou: true, saindo: false }), false)
  assert.equal(deveDestravar({ relogio: LIMITE_MS * 3, liberou: false, saindo: true }), false)
  // o limite cobre a linha do tempo inteira (entrada + estatísticas ~6,5 s) e a espera do XP (5 s)
  assert.ok(LIMITE_MS >= 15000)
})
