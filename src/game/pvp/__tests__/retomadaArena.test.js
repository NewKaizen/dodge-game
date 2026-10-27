import { test } from 'node:test'
import assert from 'node:assert/strict'
import ArenaRede from '../rede/ArenaRede.js'
import { criarCanal } from '../../../lib/lan/canal.js'
import { criarPartida, iniciarRodada, resolverRodada, fimDaRodada } from '../regras.js'

// Retomada da 2D: o host guarda o começo da rodada e, na volta, os dois PCs
// reconstroem a MESMA rodada (mesma mão: o RNG está no estado).

// uma arena de mentira: só o que a ponte usa na retomada
function arenaFalsa(estado, dados = {}) {
  return {
    estado,
    estatisticas: [{ danoCausado: 0 }, { danoCausado: 0 }],
    bonusAnterior: null,
    saindo: false,
    sys: { settings: { data: dados } },
    comecarRodada() {
      iniciarRodada(this.estado)
    },
    extrasRetomada() {
      return { estatisticas: this.estatisticas, bonusAnterior: this.bonusAnterior }
    },
  }
}

const canal = () => criarCanal({ enviarBruto: () => {}, meuId: () => 'H' })

test('o host guarda o ponto no começo da rodada e a arena nova volta para ele (mesma mão)', async () => {
  const dados = { p1: 'kris', p2: 'susie', semente: 'rede:1', arena: 'campo' }
  const host = arenaFalsa(criarPartida({ p1: 'kris', p2: 'susie', semente: 'rede:1' }), dados)
  const rede = new ArenaRede(host, { canal: canal(), meuLado: 0, souHost: true })
  assert.deepEqual(rede.dadosRetomada(), dados, 'sem ponto: a partida do começo')
  // rodada 1 inteira
  await rede.iniciarRodada()
  resolverRodada(host.estado, null, null)
  fimDaRodada(host.estado)
  host.estatisticas[0].danoCausado = 7
  // rodada 2 começa (o ponto é o estado ANTES de iniciá-la) e alguém cai no meio dela
  await rede.iniciarRodada()
  const maoRodada2 = structuredClone(host.estado.jogadores.map((j) => j.mao))
  assert.equal(host.estado.rodada, 2)
  host.estatisticas[0].danoCausado = 99 // aconteceu depois do começo da rodada: não vale
  const volta = rede.dadosRetomada()
  assert.equal(volta.semente, 'rede:1')
  assert.equal(volta.retomada.estado.rodada, 1, 'o estado de antes de iniciar a rodada 2')
  // os dois PCs abrem a arena de novo com isto
  for (const souHost of [true, false]) {
    const nova = arenaFalsa(criarPartida({ p1: 'kris', p2: 'susie', semente: 'rede:1' }), structuredClone(volta))
    const r = new ArenaRede(nova, { canal: canal(), meuLado: souHost ? 0 : 1, souHost })
    assert.equal(r.aplicarRetomada(nova.sys.settings.data.retomada), true)
    assert.equal(nova.estatisticas[0].danoCausado, 7)
    iniciarRodada(nova.estado)
    assert.equal(nova.estado.rodada, 2)
    assert.deepEqual(
      nova.estado.jogadores.map((j) => j.mao),
      maoRodada2,
      'a mesma mão da rodada 2',
    )
    if (souHost) assert.equal(r.dadosRetomada().retomada.estado.rodada, 1, 'cair de novo antes da rodada andar volta para o mesmo ponto')
  }
  // os dados de uma retomada não se acumulam
  const dadosDeNovo = new ArenaRede(arenaFalsa(host.estado, volta), { canal: canal(), meuLado: 0, souHost: true }).dadosRetomada()
  assert.equal(dadosDeNovo.retomada, undefined)
})

test('sem retomada nos dados: aplicarRetomada não mexe na arena', () => {
  const a = arenaFalsa(criarPartida({ p1: 'kris', p2: 'susie', semente: 'x' }))
  const r = new ArenaRede(a, { canal: canal(), meuLado: 0, souHost: true })
  const antes = a.estado
  assert.equal(r.aplicarRetomada(undefined), false)
  assert.equal(a.estado, antes)
})
