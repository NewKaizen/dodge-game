// node --test src/game/coop/__tests__/votacao.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { VOTO_MS, novaVotacao, votar, sair, placar, votacaoAcabou, apurarVotacao, passosDaRoleta, sementeDaVotacao, restanteVoto } from '../votacao.js'

const opcoes = ['king', 'queen', 'jevil', 'coronel', 'sorteada']
const nova = (eleitores = [0, 1, 2, 3], tela = 'chefe') => novaVotacao({ tela, opcoes, eleitores, agora: 0 })

test('o relógio é de 20 s e a votação sabe a tela', () => {
  assert.equal(VOTO_MS, 20_000)
  const v = nova()
  assert.equal(v.ate, 20_000)
  assert.equal(v.tela, 'chefe')
  assert.equal(restanteVoto(v, 5000), 15_000)
})

test('contagem: o mais votado vence, sem sorteio', () => {
  let v = nova()
  v = votar(v, 0, 'queen', 1)
  v = votar(v, 1, 'queen', 1)
  v = votar(v, 2, 'king', 1)
  const r = apurarVotacao(v, [0, 1, 2, 3], 's')
  assert.equal(r.vencedora, 'queen')
  assert.deepEqual(r.empatadas, ['queen'])
  assert.equal(r.voltas, 0)
  assert.equal(r.contagem.queen, 2)
})

test('o voto dá para trocar até o tempo; depois, nada', () => {
  let v = nova([0, 1])
  v = votar(v, 0, 'king', 10)
  v = votar(v, 0, 'jevil', 20)
  assert.equal(v.votos[0], 'jevil')
  assert.equal(votar(v, 0, 'king', VOTO_MS), v)
  assert.equal(votar(v, 5, 'king', 30), v, 'não é eleitor')
  assert.equal(votar(v, 1, 'nada', 30), v, 'opção que não existe')
})

test('empate: sorteio entre as empatadas, o mesmo em qualquer PC (mesma semente)', () => {
  let v = nova([0, 1, 2, 3])
  v = votar(v, 0, 'king', 1)
  v = votar(v, 1, 'king', 1)
  v = votar(v, 2, 'jevil', 1)
  v = votar(v, 3, 'jevil', 1)
  const a = apurarVotacao(v, [0, 1, 2, 3], 'rede:123')
  const b = apurarVotacao(v, [0, 1, 2, 3], 'rede:123')
  assert.deepEqual(a, b)
  assert.deepEqual(a.empatadas, ['king', 'jevil'])
  assert.ok(['king', 'jevil'].includes(a.vencedora))
  // a roleta acaba na vencedora
  const passos = passosDaRoleta(a.empatadas, a.voltas)
  assert.equal(passos.at(-1), a.vencedora)
  assert.ok(passos.length > a.empatadas.length, 'dá pelo menos uma volta')
})

test('empate: com sementes diferentes os dois lados aparecem (o sorteio não é fixo) e nunca sai quem não empatou', () => {
  let v = nova([0, 1])
  v = votar(v, 0, 'queen', 1)
  v = votar(v, 1, 'coronel', 1)
  const vistos = new Set()
  for (let k = 0; k < 60; k++) vistos.add(apurarVotacao(v, [0, 1], `s${k}`).vencedora)
  assert.deepEqual([...vistos].sort(), ['coronel', 'queen'])
})

test('a semente de cada tela é própria (o sorteio do chefe não repete o do nível)', () => {
  assert.notEqual(sementeDaVotacao('rede:1', 'chefe'), sementeDaVotacao('rede:1', 'nivel'))
  assert.equal(sementeDaVotacao(undefined, 'modo'), 'coop:voto:modo')
})

test('ninguém votou: sorteio entre TODAS as opções, determinístico', () => {
  const r = apurarVotacao(nova(), [0, 1, 2, 3], 'x')
  assert.deepEqual(r.empatadas, opcoes)
  assert.deepEqual(r.votos, {})
  assert.ok(opcoes.includes(r.vencedora))
  assert.deepEqual(apurarVotacao(nova(), [0, 1, 2, 3], 'x'), r)
  assert.equal(passosDaRoleta(r.empatadas, r.voltas).at(-1), r.vencedora)
})

test('o tempo: acaba aos 20 s mesmo com gente sem votar; todos votaram acaba antes', () => {
  let v = nova([0, 1, 2])
  v = votar(v, 0, 'king', 1)
  assert.equal(votacaoAcabou(v, [0, 1, 2], 19_999), false)
  assert.equal(votacaoAcabou(v, [0, 1, 2], 20_000), true)
  v = votar(v, 1, 'king', 2)
  assert.equal(votacaoAcabou(v, [0, 1, 2], 5000), false)
  v = votar(v, 2, 'queen', 3)
  assert.equal(votacaoAcabou(v, [0, 1, 2], 5000), true)
  // quem não votou até o fim abstém: só conta quem votou
  let w = nova([0, 1, 2])
  w = votar(w, 2, 'jevil', 1)
  assert.equal(apurarVotacao(w, [0, 1, 2], 's').vencedora, 'jevil')
})

test('queda: o voto de quem saiu é descartado e ele não segura a apuração', () => {
  let v = nova([0, 1, 2])
  v = votar(v, 0, 'king', 1)
  v = votar(v, 1, 'queen', 1)
  v = votar(v, 2, 'queen', 1)
  // a vaga 2 caiu: o voto dela some, e fica empate 1x1 em vez de queen 2x1
  const sem = sair(v, [0, 1])
  assert.deepEqual(sem.eleitores, [0, 1])
  assert.equal(sem.votos[2], undefined)
  assert.deepEqual(apurarVotacao(v, [0, 1], 's').empatadas, ['king', 'queen'])
  assert.deepEqual(placar(v, [0, 1]), { votaram: 2, total: 2 })
  assert.equal(votacaoAcabou(sair(votar(nova([0, 1, 2]), 0, 'king', 1), [0, 1]), [0, 1], 100), false)
  // quem saiu antes de votar não segura os outros
  const so = sair(votar(votar(nova([0, 1, 2]), 0, 'king', 1), 1, 'king', 1), [0, 1])
  assert.equal(votacaoAcabou(so, [0, 1], 100), true)
  // voltar depois não ressuscita o voto
  assert.equal(sair(sem, [0, 1, 2]), sem)
  assert.equal(sair(sem, [0, 1, 2]).votos[2], undefined)
})

test('placar X/Y votaram conta só os presentes', () => {
  let v = nova([0, 1, 2, 3])
  v = votar(v, 0, 'king', 1)
  v = votar(v, 3, 'king', 1)
  assert.deepEqual(placar(v, [0, 1, 2, 3]), { votaram: 2, total: 4 })
  assert.deepEqual(placar(v, [0, 1, 3]), { votaram: 2, total: 3 })
})

test('a mesma votação serve ao modo e ao nível', () => {
  let m = novaVotacao({ tela: 'modo', opcoes: ['rapida', 'expedicao'], eleitores: [0, 1], agora: 0 })
  m = votar(m, 0, 'expedicao', 1)
  m = votar(m, 1, 'expedicao', 1)
  assert.equal(apurarVotacao(m, [0, 1], 'z').vencedora, 'expedicao')
  let n = novaVotacao({ tela: 'nivel', opcoes: ['facil', 'medio', 'dificil'], eleitores: [0, 1, 2], agora: 0 })
  n = votar(n, 0, 'facil', 1)
  n = votar(n, 1, 'medio', 1)
  n = votar(n, 2, 'dificil', 1)
  const r = apurarVotacao(n, [0, 1, 2], 'z')
  assert.equal(r.empatadas.length, 3)
  assert.equal(passosDaRoleta(r.empatadas, r.voltas).at(-1), r.vencedora)
})
