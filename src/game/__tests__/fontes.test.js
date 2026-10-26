// node --test src/game/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarAtribuidor, resumirFontes, teclaAtiva } from '../fontes.js'
import { TECLAS_PADRAO } from '../teclas.js'

test('resumir: nenhuma fonte = desconectado; serial > controle > teclado', () => {
  assert.deepEqual(resumirFontes({}), { conectado: false, fonte: null })
  assert.deepEqual(resumirFontes({ teclado: false, gamepad: false, serial: false }), { conectado: false, fonte: null })
  assert.deepEqual(resumirFontes({ teclado: true }), { conectado: true, fonte: 'teclado' })
  assert.deepEqual(resumirFontes({ teclado: true, gamepad: true }), { conectado: true, fonte: 'gamepad' })
  assert.deepEqual(resumirFontes({ teclado: true, gamepad: true, serial: true }), { conectado: true, fonte: 'serial' })
  assert.deepEqual(resumirFontes({ gamepad: true, serial: true }), { conectado: true, fonte: 'serial' })
})

test('auto-ativação: só as teclas do jogo ligam o teclado', () => {
  for (const code of ['KeyW', 'KeyS', 'Space', 'ArrowUp', 'Enter', 'KeyP', 'Escape', 'ShiftRight']) assert.equal(teclaAtiva(code, TECLAS_PADRAO), true, code)
  for (const code of ['KeyF', 'KeyM', 'Tab', 'F5', 'ControlLeft', 'Digit1', '']) assert.equal(teclaAtiva(code, TECLAS_PADRAO), false, code)
  assert.equal(teclaAtiva(undefined, TECLAS_PADRAO), false)
  assert.equal(teclaAtiva('KeyW', null), false)
})

test('auto-ativação segue o mapa remapeado', () => {
  const mapa = structuredClone(TECLAS_PADRAO)
  mapa.p1.A = ['KeyM']
  assert.equal(teclaAtiva('KeyM', mapa), true)
  assert.equal(teclaAtiva('Space', mapa), false) // saiu do mapa
})

test('vagas: o primeiro a apertar é o jogador 1, o segundo é o 2', () => {
  const a = criarAtribuidor({ vagas: 2 })
  assert.deepEqual(a.vagaDe('pad-a#0'), { vaga: 0, novo: true })
  assert.deepEqual(a.vagaDe('pad-b#1'), { vaga: 1, novo: true })
  // de novo o mesmo: mesma vaga, não é novo
  assert.deepEqual(a.vagaDe('pad-a#0'), { vaga: 0, novo: false })
})

test('vagas: um terceiro controle ajuda o jogador 1', () => {
  const a = criarAtribuidor({ vagas: 2 })
  a.vagaDe('a')
  a.vagaDe('b')
  assert.equal(a.vagaDe('c').vaga, 0)
})

test('vagas: quem some e volta continua o mesmo jogador', () => {
  const a = criarAtribuidor({ vagas: 2 })
  a.vagaDe('a')
  a.vagaDe('b')
  a.desligou('a')
  assert.equal(a.estaPresente('a'), false)
  assert.equal(a.vagaConhecida('a'), 0)
  assert.deepEqual(a.vagaDe('a'), { vaga: 0, novo: false })
  assert.equal(a.estaPresente('a'), true)
})

test('vagas: a vaga de quem saiu fica guardada; só um controle novo a usa se não houver outra', () => {
  const a = criarAtribuidor({ vagas: 2 })
  a.vagaDe('a') // 0
  a.desligou('a')
  // sozinho, o controle novo pega a vaga 1 (a 0 está guardada para o 'a')
  assert.equal(a.vagaDe('b').vaga, 1)
  // chegou um terceiro: não tem vaga livre nem guardada além da do 'a' -> ocupa a guardada
  assert.equal(a.vagaDe('c').vaga, 0)
  assert.equal(a.vagaConhecida('zzz'), -1)
})

test('vagas: esquecer zera tudo', () => {
  const a = criarAtribuidor()
  a.vagaDe('a')
  a.esquecer()
  assert.equal(a.vagaConhecida('a'), -1)
  assert.deepEqual(a.vagaDe('b'), { vaga: 0, novo: true })
})
