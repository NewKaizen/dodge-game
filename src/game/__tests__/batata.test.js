import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarJuiz, vigiarFps } from '../batata.js'
import { medirBatata } from '../resEscala.js'
import { OPCOES, PREFERENCIAS_PADRAO } from '../preferencias.js'

test('BATATA: 3 s seguidos abaixo de 50 FPS ligam; uma amostra boa zera a conta', () => {
  const j = criarJuiz()
  assert.equal(j.amostra(40, 0), false)
  assert.equal(j.amostra(40, 2000), false)
  assert.equal(j.amostra(55, 2500), false) // voltou: começa de novo
  assert.equal(j.amostra(40, 3000), false)
  assert.equal(j.amostra(45, 5999), false)
  assert.equal(j.amostra(45, 6000), true)
  j.zerar()
  assert.equal(j.amostra(10, 7000), false)
  assert.equal(j.amostra(NaN, 9000), false) // FPS ainda sem medida não conta como baixo
  assert.equal(j.amostra(10, 9500), false)
})

test('BATATA: escala 1 e zoom inteiro quando ocupa 85 % do espaço', () => {
  assert.deepEqual(medirBatata(1.4, 1), { zoom: 1.4, dpr: 1, escala: 1, batata: true }) // 1/1,4 = 71 %: zoom livre
  assert.deepEqual(medirBatata(2.1, 1), { zoom: 2, dpr: 1, escala: 1, batata: true }) // 2/2,1 = 95 %
  assert.equal(medirBatata(1, 2).zoom, 1) // 2 pixels do aparelho por pixel do mundo: inteiro
  assert.equal(medirBatata(0.8, 1).zoom, 0.8) // menor que o mundo: zoom livre
})

test('BATATA: preferência desligada por padrão, e a automação nunca liga sozinha', () => {
  assert.equal(PREFERENCIAS_PADRAO.resolucao, 'normal')
  assert.deepEqual(OPCOES.resolucao, ['normal', 'batata'])
  assert.equal(PREFERENCIAS_PADRAO.batataAutomatica, true)
  let ouvindo = false
  const jogo = { events: { on: () => (ouvindo = true), off() {} }, scene: { scenes: [] } }
  vigiarFps(jogo, { nav: { webdriver: true } })
  assert.equal(ouvindo, false)
})
