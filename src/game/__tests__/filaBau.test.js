// node --test src/game/__tests__/filaBau.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarFilaBau, podeMostrarPopup, ESTAVEL_MS } from '../conta/filaBau.js'

test('o pop-up só vale em menu e tela de resultado, nunca em partida', () => {
  for (const k of ['Menu', 'PvpResultado', 'PvpResultadoN', 'Vitoria', 'GameOver', 'CampanhaFim', 'DesafioDiario', 'Lan']) assert.equal(podeMostrarPopup([k]), true, k)
  for (const k of ['PvpArena', 'PvpArenaN', 'CoopArena', 'CampanhaArena', 'Pausa', 'Religando', 'PvpVoto', 'Colecao', 'Carregando']) assert.equal(podeMostrarPopup([k]), false, k)
  assert.equal(podeMostrarPopup(['Menu', 'PvpArena']), false, 'uma cena de partida junto bloqueia')
  assert.equal(podeMostrarPopup([]), false)
})

test('chegou no meio da partida: espera e aparece depois, no resultado', () => {
  const f = criarFilaBau()
  f.chegou({ fontes: ['nivel'], fechados: 4 })
  assert.equal(f.atualizar(0, ['PvpArena']), null)
  assert.equal(f.atualizar(5000, ['PvpArena']), null, 'a partida continua: nada')
  assert.equal(f.atualizar(6000, ['PvpResultado']), null, 'acabou de chegar ao resultado: espera estabilizar')
  assert.equal(f.atualizar(6000 + ESTAVEL_MS - 1, ['PvpResultado']), null)
  assert.deepEqual(f.atualizar(6000 + ESTAVEL_MS, ['PvpResultado']), { fontes: ['nivel'], fechados: 4 })
  assert.equal(f.mostrando(), true)
  assert.equal(f.atualizar(9000, ['PvpResultado']), null, 'já está na tela: não repete')
})

test('trocar de cena no meio da espera zera o relógio de estabilidade', () => {
  const f = criarFilaBau()
  f.chegou({ fontes: ['dia'], fechados: 1 })
  assert.equal(f.atualizar(0, ['Menu']), null)
  assert.equal(f.atualizar(500, ['Menu']), null)
  assert.equal(f.atualizar(600, ['PvpArena']), null)
  assert.equal(f.atualizar(700, ['Menu']), null, 'recomeça a contar')
  assert.ok(f.atualizar(700 + ESTAVEL_MS, ['Menu']))
})

test('DEPOIS gasta o aviso mas mantém a contagem; aviso novo mostra de novo', () => {
  const f = criarFilaBau()
  f.chegou({ fontes: ['nivel'], fechados: 3 })
  assert.equal(f.atualizar(0, ['Menu']), null)
  assert.ok(f.atualizar(ESTAVEL_MS, ['Menu']))
  f.depois()
  assert.equal(f.pendente(), null)
  assert.equal(f.fechados(), 3, 'o baú continua na conta (aba BAÚS e o selo do menu)')
  assert.equal(f.atualizar(10_000, ['Menu']), null)
  assert.equal(f.atualizar(20_000, ['Menu']), null)
  f.chegou({ fontes: ['dia'], fechados: 4 })
  assert.equal(f.atualizar(30_000, ['Menu']), null)
  assert.deepEqual(f.atualizar(30_000 + ESTAVEL_MS, ['Menu']), { fontes: ['dia'], fechados: 4 })
})

test('dois avisos seguidos viram um pop-up só, com as duas fontes', () => {
  const f = criarFilaBau()
  f.chegou({ fontes: ['nivel'], fechados: 4 })
  f.chegou({ fontes: ['dia', 'conquista'], fechados: 6 })
  f.atualizar(0, ['Vitoria'])
  assert.deepEqual(f.atualizar(ESTAVEL_MS, ['Vitoria']), { fontes: ['nivel', 'dia', 'conquista'], fechados: 6 })
})

test('partida começou com o pop-up aberto: interromper devolve o aviso, nada se perde', () => {
  const f = criarFilaBau()
  f.chegou({ fontes: ['semanal'], fechados: 2 })
  f.atualizar(0, ['Menu'])
  assert.ok(f.atualizar(ESTAVEL_MS, ['Menu']))
  f.interromper()
  assert.equal(f.mostrando(), false)
  assert.ok(f.pendente())
  assert.equal(f.atualizar(5000, ['PvpArena']), null)
  f.atualizar(6000, ['PvpResultado'])
  assert.ok(f.atualizar(6000 + ESTAVEL_MS, ['PvpResultado']))
})

test('ABRIR AGORA gasta o aviso e a contagem acompanha o servidor', () => {
  const f = criarFilaBau()
  f.chegou({ fontes: ['nivel'], fechados: 2 })
  f.atualizar(0, ['Menu'])
  f.atualizar(ESTAVEL_MS, ['Menu'])
  f.abriu()
  f.contar(1)
  assert.equal(f.pendente(), null)
  assert.equal(f.fechados(), 1)
  assert.equal(f.atualizar(9999, ['Menu']), null)
})
