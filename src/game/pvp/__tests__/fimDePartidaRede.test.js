// node --test src/game/pvp/__tests__/fimDePartidaRede.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { novoAceite, registrar, decidir, expirou, segundosRestantes, linhasDoAceite, dicaDoAceite, opcoesDoFim, ESPERA_MS } from '../fimDePartidaRede.js'

test('fim em rede: opções por tipo de sala (no mesmo PC não tem menu)', () => {
  assert.deepEqual(opcoesDoFim({ rede: false }), [])
  assert.deepEqual(opcoesDoFim({ rede: true }), ['revanche', 'trocar', 'lobby'])
  assert.deepEqual(opcoesDoFim({ rede: true, casual: true }), ['revanche', 'trocar', 'fila', 'voltar'])
})

test('fim em rede: só começa quando os dois escolheram', () => {
  let a = novoAceite()
  assert.equal(decidir(a), null)
  a = registrar(a, 'minha', 'revanche', 1000)
  assert.equal(decidir(a), null)
  a = registrar(a, 'outra', 'revanche', 1500)
  assert.equal(decidir(a), 'revanche')
})

test('fim em rede: um quer trocar, o outro revanche: vale a troca (em qualquer ordem)', () => {
  assert.equal(decidir({ minha: 'trocar', outra: 'revanche' }), 'trocar')
  assert.equal(decidir({ minha: 'revanche', outra: 'trocar' }), 'trocar')
  assert.equal(decidir({ minha: 'trocar', outra: 'trocar' }), 'trocar')
})

test('fim em rede: a espera conta da primeira escolha e expira', () => {
  let a = registrar(novoAceite(), 'outra', 'revanche', 5000)
  assert.equal(a.ate, 5000 + ESPERA_MS)
  a = registrar(a, 'minha', 'trocar', 9000) // a 2ª escolha não reinicia a contagem
  assert.equal(a.ate, 5000 + ESPERA_MS)
  assert.equal(expirou(a, 5000 + ESPERA_MS - 1), false)
  assert.equal(expirou(a, 5000 + ESPERA_MS), true)
  assert.equal(expirou(novoAceite(), 1e12), false)
  assert.equal(segundosRestantes(a, 5000), 15)
  assert.equal(segundosRestantes(a, 1e12), 0)
})

test('fim em rede: escolha inválida é ignorada e o estado antigo não muda', () => {
  const a = novoAceite()
  assert.equal(registrar(a, 'minha', 'lobby', 0), a)
  assert.equal(registrar(a, 'ninguem', 'revanche', 0), a)
  assert.equal(a.minha, null)
})

test('fim em rede: linhas mostram quem escolheu o quê', () => {
  const a = registrar(novoAceite(), 'minha', 'revanche', 0)
  const { linhas, resta, esperando } = linhasDoAceite(a, 3000, 'ANA')
  assert.deepEqual(linhas.map((l) => [l.quem, l.texto, l.pronto]), [['VOCÊ', 'REVANCHE', true], ['ANA', 'escolhendo…', false]])
  assert.equal(resta, 12)
  assert.equal(esperando, true)
  assert.equal(linhasDoAceite(novoAceite(), 0).esperando, false)
})

test('fim em rede: a dica diz o que falta', () => {
  assert.equal(dicaDoAceite(novoAceite(), 0), '')
  assert.match(dicaDoAceite({ minha: 'revanche', outra: null, ate: 15000 }, 0, 'ANA'), /esperando ANA \(15s\)/)
  assert.match(dicaDoAceite({ minha: null, outra: 'revanche', ate: 15000 }, 0), /quer revanche.*aceite em REVANCHE/)
  assert.match(dicaDoAceite({ minha: null, outra: 'trocar', ate: 15000 }, 0), /quer trocar de personagem/)
  assert.match(dicaDoAceite({ minha: 'trocar', outra: 'revanche', ate: 1 }, 0), /trocando/)
})
