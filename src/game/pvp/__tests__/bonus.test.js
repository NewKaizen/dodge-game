// node --test src/game/pvp/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BONUS, EVENTOS, EVENTO, ehRodadaBonus, adiarBonus, sortearEvento, transformarMalucas, desfazerMalucas, ARMAS, armaDaCarta, podeJogarDuelo, resolverDuelo } from '../bonus.js'
import { criarPartida, iniciarRodada, resolverRodada, podeJogar } from '../regras.js'
import { criarRng, totalDeCartas } from '../baralho.js'

const partida = (semente = 'bonus') => {
  const estado = criarPartida({ p1: 'kris', p2: 'susie', semente })
  iniciarRodada(estado)
  return estado
}

test('bonus: a cada 3 rodadas (3ª, 6ª, 9ª...)', () => {
  assert.equal(BONUS.aCadaRodadas, 3)
  for (const r of [0, 1, 2, 4, 5, 7]) assert.equal(ehRodadaBonus(r), false, `rodada ${r}`)
  for (const r of [3, 6, 9, 30]) assert.equal(ehRodadaBonus(r), true, `rodada ${r}`)
  assert.equal(ehRodadaBonus(-3), false)
})

test('bonus: SUPER na mesa adia o bonus round', () => {
  const estado = partida('adiar')
  const naMao = (j) => estado.jogadores[j].baralho.mao
  const comum = (j) => naMao(j).find((c) => c.valor !== 14).id
  // coloca o SUPER do P2 na mão (troca pela primeira carta)
  const b = estado.jogadores[1].baralho
  const i = b.monte.findIndex((c) => c.valor === 14)
  if (i >= 0) b.mao[0] = b.monte.splice(i, 1, b.mao[0])[0]
  const superP2 = naMao(1).find((c) => c.valor === 14).id

  assert.equal(adiarBonus(estado, [comum(0), comum(1)]), false)
  assert.equal(adiarBonus(estado, [null, null]), false)
  assert.equal(adiarBonus(estado, [null, superP2]), true)
  assert.equal(adiarBonus(estado, [comum(0), superP2]), true)
})

test('bonus: eventos têm o formato que a arena espera', () => {
  const ids = new Set()
  for (const ev of EVENTOS) {
    assert.ok(ev.id && ev.nome && ev.descricao, ev.id)
    assert.ok(['normal', 'malucas', 'duelo'].includes(ev.cartas), ev.id)
    assert.equal(typeof ev.cor, 'number')
    assert.ok(!ids.has(ev.id), `id repetido ${ev.id}`)
    ids.add(ev.id)
    assert.equal(EVENTO[ev.id], ev)
  }
  for (const id of ['explosoes', 'festa', 'pontaCabeca', 'malucas', 'duelo']) assert.ok(EVENTO[id], `falta o evento ${id}`)
})

test('bonus: sorteio repetível, não repete o anterior e respeita os disponíveis', () => {
  const sequencia = (rng) => [1, 2, 3, 4, 5].map(() => sortearEvento(rng).id)
  assert.deepEqual(sequencia(criarRng('s')), sequencia(criarRng('s')))
  const rng = criarRng('x')
  let anterior = null
  const vistos = new Set()
  for (let k = 0; k < 200; k++) {
    const ev = sortearEvento(rng, { anterior })
    assert.notEqual(ev.id, anterior)
    vistos.add(ev.id)
    anterior = ev.id
  }
  assert.equal(vistos.size, EVENTOS.length, 'todos saem algum dia')
  assert.equal(sortearEvento(rng, { disponiveis: ['duelo'], anterior: 'duelo' }).id, 'duelo')
  assert.throws(() => sortearEvento(rng, { disponiveis: ['nada'] }))
})

test('cartas malucas: a carta vira outra com o mesmo custo e o baralho volta ao normal', () => {
  const estado = partida('malucas')
  const antes = estado.jogadores.map((jog) => totalDeCartas(jog.baralho))
  const escolha = estado.jogadores.map((jog) => jog.baralho.mao.find((c) => podeJogar(estado, estado.jogadores.indexOf(jog), c.id).ok))
  const { jogadas, trocas } = transformarMalucas(estado, [escolha[0].id, null], criarRng('m'))
  assert.equal(jogadas[1], null)
  assert.equal(trocas[1], null)
  assert.equal(jogadas[0], `${escolha[0].id}~maluca`)
  assert.equal(trocas[0].de.id, escolha[0].id)
  assert.equal(trocas[0].para.custo, escolha[0].custo)
  assert.ok(estado.jogadores[0].baralho.mao.some((c) => c.id === jogadas[0]))
  // a rodada resolve com a carta nova
  const r = resolverRodada(estado, jogadas[0], jogadas[1])
  assert.equal(r.jogadas[0].carta.id, jogadas[0])
  desfazerMalucas(estado, trocas)
  estado.jogadores.forEach((jog, j) => assert.equal(totalDeCartas(jog.baralho), antes[j]))
  const todas = [...estado.jogadores[0].baralho.descarte, ...estado.jogadores[0].baralho.mao, ...estado.jogadores[0].baralho.monte]
  assert.ok(!todas.some((c) => c.maluca), 'nenhuma carta maluca sobra no baralho')
  assert.ok(todas.some((c) => c.id === escolha[0].id), 'a original voltou')
})

test('duelo: naipe vira arma, força escala o dano e passar sorteia', () => {
  assert.deepEqual(ARMAS, { copas: 'tiro', espadas: 'espada', ouros: 'bumerangue', paus: 'explosao' })
  const carta = (naipe, valor) => ({ id: `x-${naipe}-${valor}`, personagem: 'kris', naipe, valor })
  assert.equal(armaDaCarta(carta('copas', 5)).arma, 'tiro')
  assert.equal(armaDaCarta(carta('paus', 5)).arma, 'explosao')
  const fraca = armaDaCarta(carta('espadas', 2))
  const forte = armaDaCarta(carta('espadas', 13))
  assert.ok(forte.dano > fraca.dano)
  assert.equal(armaDaCarta(carta('espadas', 1)).dano, forte.dano, 'Ás = carta mais forte')
  const passou = armaDaCarta(null, criarRng('p'))
  assert.ok(['tiro', 'espada', 'bumerangue', 'explosao'].includes(passou.arma))
  assert.equal(passou.carta, null)
})

test('duelo: qualquer carta da mão vale (sem energia) e vai para o descarte', () => {
  const estado = partida('duelo')
  estado.jogadores.forEach((jog) => (jog.energia = 0))
  const [a, b] = estado.jogadores.map((jog) => jog.baralho.mao.reduce((m, c) => (c.custo > m.custo ? c : m)))
  assert.equal(podeJogarDuelo(estado, 0, a.id).ok, true)
  assert.equal(podeJogarDuelo(estado, 0, 'nao-existe').ok, false)
  const r = resolverDuelo(estado, a.id, b.id, criarRng('d'))
  assert.equal(r.duelo, true)
  assert.equal(r.armas[0].arma, ARMAS[a.naipe])
  assert.equal(r.armas[1].arma, ARMAS[b.naipe])
  estado.jogadores.forEach((jog) => assert.equal(jog.energia, 0))
  assert.ok(estado.jogadores[0].baralho.descarte.some((c) => c.id === a.id))
  assert.equal(estado.historico.at(-1).duelo, true)
  assert.throws(() => resolverDuelo(estado, a.id, null, criarRng('d')), /não está na mão/)
})
