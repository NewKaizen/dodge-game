// node --test src/game/party/__tests__/regras.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarRng } from '../../pvp/baralho.js'
import { opcoesDeModo, partySegue, sortearTres, novaVotacao, votar, todosVotaram, votacaoAcabou, apurar, novoFim, marcarFim, fimDecidido, VOTO_MS, FIM_MS } from '../regras.js'

test('opções de modo pelo número de membros: 2x2 só com 4', () => {
  assert.deepEqual(opcoesDeModo(4), ['2x2', 'ffa', 'coop4'])
  assert.deepEqual(opcoesDeModo(3), ['ffa', 'coop4'])
  assert.deepEqual(opcoesDeModo(2), [])
  assert.deepEqual(opcoesDeModo(5), [])
  assert.equal(partySegue(2), false)
  assert.equal(partySegue(3), true)
})

test('sorteio de 3: distintas, sem a anterior quando o pool deixa, determinístico pela semente', () => {
  const pool = ['castelo', 'jardim', 'informatica', 'palco', 'templo', 'coliseu']
  for (let k = 0; k < 50; k++) {
    const tres = sortearTres(pool, 'palco', criarRng(`s${k}`))
    assert.equal(tres.length, 3)
    assert.equal(new Set(tres).size, 3)
    assert.ok(!tres.includes('palco'))
  }
  assert.deepEqual(sortearTres(pool, null, 'x'), sortearTres(pool, null, 'x'))
  // pool de 4 (chefes): sem o anterior sobram 3, exatamente esses
  assert.deepEqual(sortearTres(['king', 'queen', 'jevil', 'coronel'], 'queen', 'y').sort(), ['coronel', 'jevil', 'king'])
  // pool pequeno: a anterior volta (melhor repetir do que mostrar menos de 3)
  assert.deepEqual(sortearTres(['a', 'b', 'c'], 'a', 'z').sort(), ['a', 'b', 'c'])
})

const opcoes = ['2x2', 'ffa', 'coop4']

test('votação: votar, trocar o voto, só eleitores e opções válidas, nada depois do tempo', () => {
  let v = novaVotacao({ opcoes, eleitores: [0, 1, 2, 3], agora: 0 })
  assert.equal(v.ate, VOTO_MS)
  v = votar(v, 0, 'ffa', 100)
  v = votar(v, 0, 'coop4', 200) // trocou
  assert.equal(v.votos[0], 'coop4')
  assert.equal(votar(v, 9, 'ffa', 300), v, 'quem não é eleitor')
  assert.equal(votar(v, 1, 'pvp', 300), v, 'opção que não existe')
  assert.equal(votar(v, 1, 'ffa', VOTO_MS), v, 'acabou o tempo')
})

test('acaba antes quando todos votaram; quem saiu não segura', () => {
  let v = novaVotacao({ opcoes, eleitores: [0, 1, 2], agora: 0 })
  v = votar(v, 0, 'ffa', 1)
  v = votar(v, 1, 'ffa', 1)
  assert.equal(todosVotaram(v, [0, 1, 2]), false)
  assert.equal(votacaoAcabou(v, [0, 1, 2], 5000), false)
  assert.equal(votacaoAcabou(v, [0, 1], 5000), true, 'a vaga 2 saiu da sala')
  v = votar(v, 2, 'coop4', 2)
  assert.equal(votacaoAcabou(v, [0, 1, 2], 5000), true)
  assert.equal(votacaoAcabou(novaVotacao({ opcoes, eleitores: [0], agora: 0 }), [0], VOTO_MS), true, 'tempo')
})

test('apuração: maioria, quem não votou não conta, quem saiu não conta', () => {
  let v = novaVotacao({ opcoes, eleitores: [0, 1, 2, 3], agora: 0 })
  v = votar(v, 0, 'coop4', 1)
  v = votar(v, 1, 'coop4', 1)
  v = votar(v, 2, 'ffa', 1)
  const r = apurar(v, [0, 1, 2, 3], 'a')
  assert.equal(r.vencedora, 'coop4')
  assert.deepEqual(r.empatadas, ['coop4'])
  assert.equal(r.voltas, 0)
  // as duas do coop4 saíram: sobra o ffa
  assert.equal(apurar(v, [2, 3], 'a').vencedora, 'ffa')
})

test('empate: roleta entre as empatadas, a mesma com a mesma semente', () => {
  let v = novaVotacao({ opcoes, eleitores: [0, 1, 2, 3], agora: 0 })
  v = votar(v, 0, 'coop4', 1)
  v = votar(v, 1, 'ffa', 1)
  const a = apurar(v, [0, 1, 2, 3], criarRng('semente'))
  const b = apurar(v, [0, 1, 2, 3], criarRng('semente'))
  assert.deepEqual(a, b)
  assert.deepEqual(a.empatadas, ['ffa', 'coop4'])
  assert.ok(a.empatadas.includes(a.vencedora))
  assert.ok(a.voltas >= 4)
  assert.equal(a.voltas % a.empatadas.length, a.empatadas.indexOf(a.vencedora), 'a roleta para na vencedora')
  // as duas aparecem com sementes diferentes
  const vencedoras = new Set(Array.from({ length: 40 }, (_, k) => apurar(v, [0, 1, 2, 3], `k${k}`).vencedora))
  assert.equal(vencedoras.size, 2)
  // ninguém votou: todas empatadas
  assert.deepEqual(apurar(novaVotacao({ opcoes, eleitores: [0, 1, 2], agora: 0 }), [0, 1, 2], 'n').empatadas, opcoes)
})

test('fim: CONTINUAR de todos acaba antes; o tempo acaba com quem não apertou continuando; SAIR é definitivo', () => {
  let f = novoFim(0)
  assert.equal(f.ate, FIM_MS)
  f = marcarFim(f, 0, 'continuar', 10)
  f = marcarFim(f, 1, 'continuar', 10)
  assert.equal(fimDecidido(f, [0, 1, 2], 100), false)
  f = marcarFim(f, 2, 'sair', 20)
  assert.equal(marcarFim(f, 2, 'continuar', 30), f, 'sair não volta atrás')
  assert.equal(fimDecidido(f, [0, 1], 100), true, 'quem saiu não está mais na sala')
  assert.equal(fimDecidido(f, [0, 1, 2], 100), true, 'quem apertou SAIR não segura os outros')
  const g = marcarFim(novoFim(0), 0, 'continuar', 1)
  assert.equal(fimDecidido(g, [0, 1, 2], FIM_MS - 1), false)
  assert.equal(fimDecidido(g, [0, 1, 2], FIM_MS), true, 'o tempo acabou: 1 e 2 continuam sem apertar')
  assert.equal(marcarFim(g, 1, 'continuar', FIM_MS), g, 'depois do tempo não muda')
})
