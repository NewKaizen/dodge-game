// node --test src/game/coop/__tests__/
// Combo de perfeitos no CO-OP: mesma regra do PvP (energia), o CRÍTICO não muda
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  COOP,
  GOLPE,
  COMBO_PERFEITO,
  criarPartidaCoop,
  iniciarRodadaCoop,
  aplicarDanoCoop,
  calcularGolpes,
  registrarPerfeitoCombo,
  quebrarSequencia,
} from '../regras.js'
import { CARTAS_CHEFES } from '../cartasChefe.js'
import { CARTAS } from '../../pvp/cartas.js'

const nova = () => {
  const e = criarPartidaCoop({ party: ['kris', 'susie'], chefe: 'king', semente: 'combo' })
  iniciarRodadaCoop(e)
  e.jogadores.forEach((j) => (j.energia = 0))
  return e
}
// carta do chefe (a que vai para a caixa do jogador)
const doChefe = (naipe, valor) => ({ ...(CARTAS_CHEFES.king.fases[0].find((c) => c.naipe === naipe) ?? CARTAS_CHEFES.king.fases[0][0]), naipe, valor })

test('coop: os jogadores começam com o combo zerado', () => {
  const e = nova()
  assert.deepEqual(
    e.jogadores.map((j) => j.sequencia),
    [0, 0],
  )
})

test('coop: perfeitos seguidos multiplicam a energia, cada um com o seu combo', () => {
  const e = nova()
  const ataque = doChefe('espadas', 7) // +1 de base
  assert.equal(registrarPerfeitoCombo(e, 0, ataque).ganho, 1)
  assert.equal(registrarPerfeitoCombo(e, 0, ataque).ganho, 2)
  assert.equal(registrarPerfeitoCombo(e, 0, ataque).ganho, 3)
  assert.equal(registrarPerfeitoCombo(e, 1, ataque).ganho, 1) // o parceiro tem a sequência dele
  assert.equal(e.jogadores[0].sequencia, 3)
  assert.equal(e.jogadores[1].sequencia, 1)
  for (let i = 0; i < 3; i++) registrarPerfeitoCombo(e, 0, ataque)
  assert.equal(registrarPerfeitoCombo(e, 0, doChefe('espadas', 9)).multiplicador, COMBO_PERFEITO.teto)
})

test('coop: acerto do chefe quebra; caído perde o combo', () => {
  const e = nova()
  const ataque = doChefe('paus', 10)
  registrarPerfeitoCombo(e, 0, ataque)
  registrarPerfeitoCombo(e, 0, ataque)
  aplicarDanoCoop(e, 0, 1)
  assert.equal(e.jogadores[0].sequencia, 0)
  registrarPerfeitoCombo(e, 1, ataque)
  registrarPerfeitoCombo(e, 1, ataque)
  aplicarDanoCoop(e, 1, 9999)
  assert.equal(e.jogadores[1].caido, true)
  assert.equal(e.jogadores[1].sequencia, 0)
  assert.equal(quebrarSequencia(e, 1), 0)
})

test('coop: carta de copas do chefe não conta nem quebra o combo', () => {
  const e = nova()
  registrarPerfeitoCombo(e, 0, doChefe('espadas', 5))
  const r = registrarPerfeitoCombo(e, 0, doChefe('copas', 5))
  assert.equal(r.ganho, 0)
  assert.equal(e.jogadores[0].sequencia, 1)
})

test('coop: o CRÍTICO do contra-ataque continua fixo, com ou sem combo', () => {
  const e = nova()
  const c = { ...CARTAS.kris.find((x) => x.id === 'kris-espadas-9') }
  const golpe = { carta: c, tipo: 'espadas', base: GOLPE.espadas(9) }
  const semCombo = calcularGolpes(e, [golpe, null], [{ perfeito: true }])[0].dano
  for (let i = 0; i < 5; i++) registrarPerfeitoCombo(e, 0, doChefe('espadas', 9))
  const comCombo = calcularGolpes(e, [golpe, null], [{ perfeito: true }])[0].dano
  assert.equal(semCombo, Math.round(GOLPE.espadas(9) * COOP.critico))
  assert.equal(comCombo, semCombo)
})
