// node --test src/game/pvp/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COPIA, EVENTO, quantiaCopiada, resolverCopia, copiarEnergia } from '../bonus.js'
import { BotCopia, NIVEIS_COPIA } from '../bonus/botCopia.js'
import { criarPartida, iniciarRodada, ENERGIA } from '../regras.js'
import { criarRng, aleatorio } from '../baralho.js'
import { eventosDaArena } from '../arenas.js'

const partida = (semente = 'copia') => {
  const estado = criarPartida({ p1: 'kris', p2: 'susie', semente })
  iniciarRodada(estado)
  return estado
}

test('ctrl+c ctrl+v: é o minigame de cópia (não esquiva) e está na sala de informática', () => {
  assert.equal(EVENTO.copia.cartas, 'copia')
  assert.equal(EVENTO.copia.nome, 'CTRL+C CTRL+V')
  assert.equal(EVENTO.clone, undefined, 'o clone espelhado saiu')
  assert.ok(eventosDaArena('informatica').some((e) => e.id === 'copia'))
})

test('ctrl+c ctrl+v: quanto mais longe o marcador, mais energia copia', () => {
  assert.equal(quantiaCopiada(0), 0)
  assert.equal(quantiaCopiada(-0.5), 0)
  assert.equal(quantiaCopiada(1 / COPIA.cheio), 1, 'um aperto de vantagem já copia 1')
  assert.equal(quantiaCopiada(COPIA.faixas[0] - 0.01), 1)
  assert.equal(quantiaCopiada(COPIA.faixas[0]), 2)
  assert.equal(quantiaCopiada(COPIA.faixas[1]), 3)
  assert.equal(quantiaCopiada(1), 3)
  for (let k = 1; k < 100; k++) assert.ok(quantiaCopiada(k / 100) >= quantiaCopiada((k - 1) / 100))
})

test('ctrl+c ctrl+v: a carta vai para o descarte sem gastar energia', () => {
  const estado = partida()
  estado.jogadores.forEach((jog) => (jog.energia = 0))
  const carta = estado.jogadores[0].baralho.mao.reduce((m, c) => (c.custo > m.custo ? c : m))
  const r = resolverCopia(estado, carta.id, null)
  assert.equal(r.copia, true)
  assert.equal(r.jogadas[0].carta.id, carta.id)
  assert.equal(r.jogadas[1].passou, true)
  estado.jogadores.forEach((jog) => assert.equal(jog.energia, 0))
  assert.ok(estado.jogadores[0].baralho.descarte.some((c) => c.id === carta.id))
  assert.equal(estado.historico.at(-1).copia, true)
  assert.throws(() => resolverCopia(estado, carta.id, null), /não está na mão/)
})

test('ctrl+c ctrl+v: a energia copiada respeita 0 e o máximo', () => {
  const estado = partida('limites')
  resolverCopia(estado, null, null)
  const [a, b] = estado.jogadores
  a.energia = 5
  b.energia = 4
  assert.deepEqual(copiarEnergia(estado, 0, 1, 3), { perdeu: 3, ganhou: 3 })
  assert.equal(a.energia, 2)
  assert.equal(b.energia, 7)
  assert.equal(estado.historico.at(-1).ganhou, 3)
  // quem perde não fica negativo
  assert.deepEqual(copiarEnergia(estado, 0, 1, 3), { perdeu: 2, ganhou: 2 })
  assert.equal(a.energia, 0)
  assert.deepEqual(copiarEnergia(estado, 0, 1, 3), { perdeu: 0, ganhou: 0 })
  // quem copia não passa do máximo (o resto se perde)
  a.energia = 6
  b.energia = ENERGIA.maxima - 1
  assert.deepEqual(copiarEnergia(estado, 0, 1, 3), { perdeu: 3, ganhou: 1 })
  assert.equal(b.energia, ENERGIA.maxima)
  assert.equal(a.energia, 3)
})

// apertos de um bot em uma disputa inteira (frames de 16 ms)
const apertosDoBot = (nivel, semente) => {
  const rng = criarRng(semente)
  const bot = new BotCopia({ nivel, rng: () => aleatorio(rng), duracaoMs: COPIA.duracaoMs })
  let n = 0
  for (let t = 0; t < COPIA.duracaoMs; t += 16) n += bot.atualizar(16)
  return n
}

test('ctrl+c ctrl+v: a CPU aperta com ritmo de gente (5 a 8 por segundo) e repete com a mesma semente', () => {
  assert.equal(apertosDoBot('normal', 's1'), apertosDoBot('normal', 's1'))
  const media = (nivel) => {
    let soma = 0
    for (let s = 0; s < 40; s++) soma += apertosDoBot(nivel, `${nivel}:${s}`)
    return soma / 40 / (COPIA.duracaoMs / 1000)
  }
  const [facil, normal, dificil] = ['facil', 'normal', 'dificil'].map(media)
  assert.ok(facil < normal && normal < dificil, `${facil} ${normal} ${dificil}`)
  assert.ok(facil > 3 && dificil < 8, `ritmo de gente: ${facil.toFixed(2)} .. ${dificil.toFixed(2)} por segundo`)
  assert.deepEqual(Object.keys(NIVEIS_COPIA), ['facil', 'normal', 'dificil', 'imbativel'])
  // o IMBATÍVEL passa do difícil (é a dificuldade extra, não um "ritmo de gente")
  assert.ok(media('imbativel') > dificil)
})

test('ctrl+c ctrl+v: nem o difícil é imbatível (9 apertos/s ganham dele)', () => {
  for (let s = 0; s < 30; s++) {
    const humano = Math.floor(9 * (COPIA.duracaoMs - 250) / 1000)
    assert.ok(humano > apertosDoBot('dificil', `imbativel:${s}`), `semente ${s}`)
  }
})
