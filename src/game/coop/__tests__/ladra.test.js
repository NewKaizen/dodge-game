// BOSS SEMANAL · LADRA DE CARTAS: roubo, jogo da roubada e devolução (coop/semanal/ladra.js pelas regras).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarPartidaCoop, iniciarRodadaCoop, resolverRodadaCoop, fimDaRodadaCoop, GRUPO } from '../regras.js'
import { LADRA, roubavel } from '../semanal/ladra.js'
import { ataqueDaCartaChefe, suporteDoChefe, ritmoDaCartaChefe, danoDaCartaChefe, inverteControles } from '../cartasChefe.js'
import { CHEFES, SEMANAIS, ORDEM_CHEFES } from '../chefes/index.js'
import { ehSuper } from '../../pvp/cartas.js'

const PARTY = ['kris', 'susie', 'ralsei', 'dess']
const nova = (n = 2) => criarPartidaCoop({ party: PARTY.slice(0, n), chefe: 'ladra', semente: 'ladra' })
const passarTodos = (e) => resolverRodadaCoop(e, ...e.jogadores.map(() => null))
const rodada = (e, jogadas) => {
  const ev = iniciarRodadaCoop(e)
  const r = resolverRodadaCoop(e, ...(jogadas ? jogadas(e) : e.jogadores.map(() => null)))
  fimDaRodadaCoop(e)
  return { ev, r }
}

test('os semanais ficam fora da seleção e da votação; têm sprite, fundo e música', () => {
  assert.deepEqual(SEMANAIS.sort(), ['escuridao', 'ladra'])
  for (const id of SEMANAIS) {
    assert.ok(!ORDEM_CHEFES.includes(id))
    assert.ok(CHEFES[id].semanal && CHEFES[id].sprite === id && CHEFES[id].fundo === id && CHEFES[id].musica)
  }
})

test('rouba uma carta por rodada (2 a K, nunca Ás/SUPER), o alvo gira entre quem está de pé', () => {
  const e = nova(3)
  const alvos = []
  for (let i = 0; i < 3; i++) {
    const antes = e.jogadores.map((j) => j.baralho.mao.length)
    const ev = iniciarRodadaCoop(e)
    const roubo = ev.find((x) => x.tipo === 'roubo')
    assert.ok(roubo, `rodada ${e.rodada}`)
    alvos.push(roubo.j)
    const c = e.chefe.roubadas.at(-1)
    assert.equal(c.dono, roubo.j)
    assert.ok(roubavel(c.carta) && !ehSuper(c.carta) && c.carta.valor !== 1)
    assert.ok(!e.jogadores[roubo.j].baralho.mao.some((x) => x.id === c.carta.id), 'saiu da mão do dono')
    assert.ok(e.jogadores[roubo.j].baralho.mao.length < Math.max(...antes.map((n) => Math.max(n, 5))))
    passarTodos(e)
    fimDaRodadaCoop(e)
  }
  assert.deepEqual(alvos, [0, 1, 2])
  // caído não é alvo
  e.jogadores[0].caido = true
  e.jogadores[0].voltaEm = 99
  const ev = iniciarRodadaCoop(e)
  assert.notEqual(ev.find((x) => x.tipo === 'roubo')?.j, 0)
})

test('a cada 2 rodadas joga a roubada mais antiga; depois ela volta ao descarte do dono', () => {
  const e = nova(2)
  const { ev: ev1 } = rodada(e) // rodada 1: rouba do P1
  const primeira = e.chefe.roubadas[0]
  assert.equal(ev1.find((x) => x.tipo === 'roubo').j, 0)
  const ev2 = iniciarRodadaCoop(e) // rodada 2: joga a mais antiga e rouba do P2
  const joga = ev2.find((x) => x.tipo === 'ladraJoga')
  assert.ok(joga)
  assert.equal(joga.carta, primeira.carta.id)
  const intencao = e.chefe.intencao
  assert.equal(intencao.roubada.dono, 0)
  assert.equal(intencao.naipe, primeira.carta.naipe)
  assert.equal(e.chefe.roubadas.length, 1, 'jogou uma, roubou outra')
  // o efeito da carta é o da roubada, virado contra o time
  assert.equal(inverteControles(intencao), false)
  assert.ok(danoDaCartaChefe(intencao) >= 1)
  if (intencao.naipe === 'copas') assert.equal(suporteDoChefe(intencao).cura, 4 * intencao.valor)
  const A = new Proxy({}, { get: (_, nome) => (cfg) => ({ nome, cfg }) })
  assert.ok(ataqueDaCartaChefe(intencao, { ataques: A }).nome)
  const r = passarTodos(e)
  assert.equal(r.destino, 'quadro')
  fimDaRodadaCoop(e)
  assert.ok(e.jogadores[0].baralho.descarte.some((c) => c.id === primeira.carta.id), 'voltou ao descarte do dono')
  assert.ok(!e.chefe.descarte.some((c) => c.id === intencao.id), 'não fica no baralho dela')
})

test('♦ roubado adianta as balas (o do jogador atrasa)', () => {
  const carta = { id: 'ladra-roubo-x', chefe: 'ladra', naipe: 'ouros', valor: 13, roubada: { carta: { id: 'x' }, dono: 0 } }
  assert.ok(ritmoDaCartaChefe(carta).velocidade > ritmoDaCartaChefe({ ...carta, roubada: undefined }).velocidade)
})

test('♣ de jogador devolve a ÚLTIMA roubada para a mão do dono; SUPER devolve todas', () => {
  const e = nova(2)
  rodada(e) // rouba do P1
  rodada(e) // joga a do P1, rouba do P2
  iniciarRodadaCoop(e) // rodada 3: rouba do P1 de novo
  assert.equal(e.chefe.roubadas.length, 2)
  const ultima = e.chefe.roubadas.at(-1)
  const outra = e.chefe.roubadas[0]
  // P2 joga um ♣ que ele pode pagar
  const jog = e.jogadores[1]
  jog.energia = 10
  let paus = jog.baralho.mao.find((c) => c.naipe === 'paus' && c.valor > 1 && c.valor < 14)
  if (!paus) {
    paus = { ...jog.baralho.monte.find((c) => c.naipe === 'paus' && c.valor > 1 && c.valor < 14) }
    jog.baralho.mao.push(paus)
  }
  const r = resolverRodadaCoop(e, null, paus.id)
  assert.deepEqual(r.efeitos[1].devolveu, [{ dono: ultima.dono, carta: ultima.carta.id }])
  assert.ok(e.jogadores[ultima.dono].baralho.mao.some((c) => c.id === ultima.carta.id))
  assert.deepEqual(e.chefe.roubadas, [outra])
  fimDaRodadaCoop(e)
  // SUPER: todas de volta
  iniciarRodadaCoop(e)
  const quantas = e.chefe.roubadas.length
  assert.ok(quantas >= 1)
  const j0 = e.jogadores[0]
  j0.energia = 10
  let sup = j0.baralho.mao.find(ehSuper)
  if (!sup) {
    sup = j0.baralho.monte.find(ehSuper) ?? j0.baralho.descarte.find(ehSuper)
    j0.baralho.mao.push(sup)
  }
  const r2 = resolverRodadaCoop(e, sup.id, null)
  assert.equal(r2.efeitos[0].devolveu.length, quantas)
  assert.equal(e.chefe.roubadas.length, 0)
})

test('nunca passa de LADRA.maxMao roubadas; a partida simulada termina', () => {
  const e = nova(4)
  for (let i = 0; i < 12 && !e.vencedor; i++) {
    iniciarRodadaCoop(e)
    assert.ok(e.chefe.roubadas.length <= LADRA.maxMao)
    passarTodos(e)
    fimDaRodadaCoop(e)
  }
  // o tamanho do grupo escala a vida dela como nos outros chefes (GRUPO[n])
  assert.equal(nova(4).chefe.hpMax, Math.round(CHEFES.ladra.hp * GRUPO[4].hpChefe))
  assert.equal(nova(3).chefe.hpMax, Math.round(CHEFES.ladra.hp * GRUPO[3].hpChefe))
})
