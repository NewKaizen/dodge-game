import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eixoDoAdc, porcentagemVida, ADC_CENTRO, ZONA_MORTA } from '../conversao.js'

// ---------- eixos do joystick (0–1023 -> -100..100) ----------

test('centro e a folga em volta dele ficam parados', () => {
  assert.equal(eixoDoAdc(ADC_CENTRO), 0)
  assert.equal(eixoDoAdc(ADC_CENTRO + ZONA_MORTA), 0)
  assert.equal(eixoDoAdc(ADC_CENTRO - ZONA_MORTA), 0)
  assert.equal(eixoDoAdc(500), 0) // analógico parado que não lê 512 certinho
})

test('pontas viram -100 e 100', () => {
  assert.equal(eixoDoAdc(0), -100)
  assert.equal(eixoDoAdc(1023), 100)
})

test('passou da folga, cresce aos poucos e sem pular', () => {
  const logo = eixoDoAdc(ADC_CENTRO + ZONA_MORTA + 5)
  assert.ok(logo > 0 && logo <= 2)
  const meio = eixoDoAdc(700)
  assert.ok(meio > 30 && meio < 50, `700 deu ${meio}`)
  for (let v = 0; v < 1023; v++) assert.ok(eixoDoAdc(v) <= eixoDoAdc(v + 1), `cai entre ${v} e ${v + 1}`)
})

test('menus: inclinar bem passa do limiar de 50', () => {
  assert.ok(eixoDoAdc(900) >= 50)
  assert.ok(eixoDoAdc(100) <= -50)
})

test('fora da faixa ou lixo', () => {
  assert.equal(eixoDoAdc(5000), 100)
  assert.equal(eixoDoAdc(-20), -100)
  assert.equal(eixoDoAdc('abc'), 0)
  assert.equal(eixoDoAdc(undefined), 0)
})

test('invertido troca o sinal', () => {
  assert.equal(eixoDoAdc(0, true), 100)
  assert.equal(eixoDoAdc(1023, true), -100)
  assert.equal(eixoDoAdc(ADC_CENTRO, true), 0)
})

// ---------- VIDA (% da vida máxima) ----------

test('exemplos do protocolo', () => {
  assert.equal(porcentagemVida(75, 100), 75)
  assert.equal(porcentagemVida(40, 80), 50)
  assert.equal(porcentagemVida(150, 200), 75)
  assert.equal(porcentagemVida(25, 50), 50)
})

test('limites: 0 a 100, inteiro', () => {
  assert.equal(porcentagemVida(0, 80), 0)
  assert.equal(porcentagemVida(-5, 80), 0)
  assert.equal(porcentagemVida(120, 100), 100)
  assert.ok(Number.isInteger(porcentagemVida(1, 3)))
})

test('vivo nunca mostra barra vazia', () => {
  assert.equal(porcentagemVida(1, 300), 1)
})

test('vida máxima inválida não quebra', () => {
  assert.equal(porcentagemVida(10, 0), 0)
  assert.equal(porcentagemVida(10, undefined), 0)
  assert.equal(porcentagemVida(NaN, 100), 0)
})
