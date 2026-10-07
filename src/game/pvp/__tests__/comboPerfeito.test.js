// node --test src/game/pvp/__tests__/
// Combo de perfeitos: rodadas seguidas com desvio perfeito multiplicam a energia
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ENERGIA,
  COMBO_PERFEITO,
  criarPartida,
  iniciarRodada,
  aplicarDano,
  energiaPerfeito,
  multiplicadorPerfeito,
  registrarPerfeito,
  registrarPerfeitoCombo,
  quebrarSequencia,
} from '../regras.js'

const carta = (naipe, valor) => ({ id: `kris-${naipe}-${valor}`, personagem: 'kris', naipe, valor })
const SETE = carta('espadas', 7) // +1 de base
const DEZ = carta('paus', 10) // +2 de base
const REI = carta('ouros', 13) // +3 de base

function partida(energia = 0) {
  const e = criarPartida({ p1: 'kris', p2: 'susie', semente: 'combo' })
  iniciarRodada(e)
  e.jogadores.forEach((j) => (j.energia = energia))
  return e
}

test('combo: começa zerado e o teto é x4', () => {
  const e = partida()
  assert.equal(e.jogadores[0].sequencia, 0)
  assert.equal(e.jogadores[1].sequencia, 0)
  assert.equal(COMBO_PERFEITO.teto, 4)
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map(multiplicadorPerfeito), [1, 1, 2, 3, 4, 4, 4])
})

test('combo: x1, x2, x3 multiplicam a energia do perfeito', () => {
  const e = partida()
  assert.deepEqual(registrarPerfeitoCombo(e, 0, SETE), { ganho: 1, base: 1, multiplicador: 1, sequencia: 1 })
  assert.deepEqual(registrarPerfeitoCombo(e, 0, SETE), { ganho: 2, base: 1, multiplicador: 2, sequencia: 2 })
  assert.deepEqual(registrarPerfeitoCombo(e, 0, DEZ), { ganho: 6, base: 2, multiplicador: 3, sequencia: 3 })
  assert.equal(e.jogadores[0].energia, 9)
  assert.equal(e.jogadores[1].energia, 0) // o outro jogador não ganha nada
  assert.equal(e.jogadores[1].sequencia, 0)
})

test('combo: passa do teto contando, mas o multiplicador para em x4', () => {
  const e = partida()
  for (let i = 0; i < 6; i++) {
    e.jogadores[0].energia = 0
    const r = registrarPerfeitoCombo(e, 0, SETE)
    assert.equal(r.sequencia, i + 1)
    assert.equal(r.multiplicador, Math.min(i + 1, COMBO_PERFEITO.teto))
    assert.equal(r.ganho, Math.min(i + 1, COMBO_PERFEITO.teto) * energiaPerfeito(SETE))
  }
  assert.equal(e.jogadores[0].maiorSequencia, 6)
})

test('combo: respeita o teto de energia', () => {
  const e = partida(ENERGIA.maxima - 4)
  registrarPerfeito(e, 0, SETE) // x1: +1 -> 7
  assert.equal(e.jogadores[0].energia, 7)
  // x2 de um Rei seria +6: só cabe +3
  const r = registrarPerfeitoCombo(e, 0, REI)
  assert.equal(r.multiplicador, 2)
  assert.equal(r.ganho, 3)
  assert.equal(e.jogadores[0].energia, ENERGIA.maxima)
  // energia cheia: o perfeito ainda conta para o combo (ganho 0)
  const cheio = registrarPerfeitoCombo(e, 0, REI)
  assert.equal(cheio.ganho, 0)
  assert.equal(cheio.sequencia, 3)
  assert.equal(e.jogadores[0].energia, ENERGIA.maxima)
})

test('combo: levar dano quebra a sequência (mesmo dano zerado)', () => {
  const e = partida()
  registrarPerfeito(e, 0, SETE)
  registrarPerfeito(e, 0, SETE)
  assert.equal(e.jogadores[0].sequencia, 2)
  aplicarDano(e, 0, 5)
  assert.equal(e.jogadores[0].sequencia, 0)
  assert.equal(e.jogadores[0].maiorSequencia, 2) // o recorde fica
  // recomeça do x1
  assert.equal(registrarPerfeitoCombo(e, 0, SETE).multiplicador, 1)
  // acerto que não tira HP (2ª chance segurando em 1) também quebra
  registrarPerfeito(e, 0, SETE)
  e.jogadores[0].hp = 1
  e.jogadores[0].protegido = true
  assert.equal(aplicarDano(e, 0, 10), 0)
  assert.equal(e.jogadores[0].sequencia, 0)
  // o dano no P1 não mexe no combo do P2
  registrarPerfeito(e, 1, SETE)
  aplicarDano(e, 0, 1)
  assert.equal(e.jogadores[1].sequencia, 1)
})

test('combo: rodada sem caixa (ou com carta que não dá perfeito) não conta e não quebra', () => {
  const e = partida()
  registrarPerfeito(e, 0, SETE)
  registrarPerfeito(e, 0, SETE)
  for (const nada of [null, carta('copas', 10), carta('copas', 1)]) {
    const r = registrarPerfeitoCombo(e, 0, nada)
    assert.equal(r.ganho, 0)
    assert.equal(r.base, 0)
    assert.equal(r.sequencia, 2)
  }
  assert.equal(e.jogadores[0].sequencia, 2)
  // na rodada seguinte com ataque: x3
  assert.equal(registrarPerfeitoCombo(e, 0, SETE).multiplicador, 3)
})

test('quebrarSequencia devolve o que havia', () => {
  const e = partida()
  assert.equal(quebrarSequencia(e, 0), 0)
  registrarPerfeito(e, 0, DEZ)
  registrarPerfeito(e, 0, DEZ)
  registrarPerfeito(e, 0, DEZ)
  assert.equal(quebrarSequencia(e, 0), 3)
  assert.equal(quebrarSequencia(e, 0), 0)
})

test('combo: estado antigo sem o campo sequencia funciona (conta do zero)', () => {
  const e = partida()
  delete e.jogadores[0].sequencia
  delete e.jogadores[0].maiorSequencia
  assert.equal(registrarPerfeitoCombo(e, 0, SETE).sequencia, 1)
  assert.equal(e.jogadores[0].maiorSequencia, 1)
})
