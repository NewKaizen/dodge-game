// node --test src/game/pvp/__tests__/limiarReplay.test.js
// Quando o replay do K.O. grava (pvp/fimDePartida/limiar.js): só com K.O. possível nesta rodada
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LIMIAR, maiorDano, podeNocautear, umGolpe, perigoNaPista } from '../fimDePartida/limiar.js'

test('grava com a vida até 2x o dano por acerto, e não acima', () => {
  assert.equal(LIMIAR.fator, 2)
  assert.equal(podeNocautear({ hp: 20, hpMax: 90, dano: 10 }), true)
  assert.equal(podeNocautear({ hp: 21, hpMax: 90, dano: 10 }), false)
  assert.equal(podeNocautear({ hp: 90, hpMax: 90, dano: 10 }), false)
  assert.equal(podeNocautear({ hp: 1, hpMax: 90, dano: 10 }), true)
})

test('caixa sem carta e sem bônus: nada derruba, não grava', () => {
  assert.equal(podeNocautear({ hp: 1, hpMax: 90, dano: 0 }), false)
  assert.equal(umGolpe({ hp: 1, hpMax: 90, dano: 0 }), false)
})

test('quem já caiu (ou sem vida informada) não liga a gravação', () => {
  assert.equal(podeNocautear({ hp: 0, hpMax: 90, dano: 10 }), false)
  assert.equal(podeNocautear({ hpMax: 90, dano: 10 }), false)
  assert.equal(podeNocautear({ hp: 0, hpMax: 90, dano: 10, morteSubita: true }), false)
})

test('morte súbita: grava sempre', () => {
  assert.equal(podeNocautear({ hp: 90, hpMax: 90, dano: 4, morteSubita: true }), true)
  assert.equal(podeNocautear({ hp: 90, hpMax: 90, dano: 0, morteSubita: true }), true)
})

test('evento de bônus: vale o maior dano de evento (30 % da vida máxima, no mínimo 6)', () => {
  assert.equal(maiorDano({ hpMax: 100, dano: 4, bonus: true }), 30)
  assert.equal(maiorDano({ hpMax: 10, dano: 0, bonus: true }), 6)
  assert.equal(maiorDano({ hpMax: 100, dano: 40, bonus: true }), 40)
  assert.equal(podeNocautear({ hp: 60, hpMax: 100, dano: 0, bonus: true }), true)
  assert.equal(podeNocautear({ hp: 61, hpMax: 100, dano: 0, bonus: true }), false)
  // a caixa livre do bônus (só o caos do evento) também grava perto do fim
  assert.equal(podeNocautear({ hp: 5, hpMax: 100, dano: 0, bonus: true }), true)
})

test('ritmo cheio (30 fotos/s) só a um golpe do K.O.', () => {
  assert.equal(umGolpe({ hp: 10, hpMax: 90, dano: 10 }), true)
  assert.equal(umGolpe({ hp: 11, hpMax: 90, dano: 10 }), false)
  assert.equal(podeNocautear({ hp: 11, hpMax: 90, dano: 10 }), true) // grava, mas a 15 fotos/s
  assert.equal(umGolpe({ hp: 20, hpMax: 90, dano: 10, morteSubita: true }), true)
})

test('perigoNaPista: os donos dos corações da caixa, o dano do ataque dela', () => {
  const arena = (hps, extra = {}) => ({ estado: { jogadores: hps.map((hp) => ({ hp, hpMax: 90 })) }, aceleracao: 1, ...extra })
  const pista = (dano, jogadores = [0]) => ({ coracoes: jogadores.map((jogador) => ({ jogador })), ataque: dano == null ? null : { ctx: { dano } } })
  assert.equal(perigoNaPista(arena([90, 90]), pista(10)), 0)
  assert.equal(perigoNaPista(arena([15, 90]), pista(10)), 1)
  assert.equal(perigoNaPista(arena([8, 90]), pista(10)), 2)
  // o coração do outro jogador nesta caixa (CORAÇÃO TROCADO, CO-OP): conta a vida dele
  assert.equal(perigoNaPista(arena([90, 8]), pista(10, [1])), 2)
  assert.equal(perigoNaPista(arena([90, 8]), pista(10, [0, 1])), 2)
  // a arena diz quem é o dono da pista (donoDaPista)
  const a = { ...arena([90, 15]), pistas: [], donoDaPista: () => 1 }
  const p = pista(10)
  a.pistas.push(p)
  assert.equal(perigoNaPista(a, p), 1)
  // morte súbita e bônus
  assert.equal(perigoNaPista(arena([90, 90], { aceleracao: 1.3 }), pista(10)), 1)
  assert.equal(perigoNaPista(arena([50, 90], { efeitoBonus: {} }), pista(0)), 1)
  // sem estado de partida (outra cena): grava sempre, como antes
  assert.equal(perigoNaPista({}, pista(10)), 2)
})
