// node --test src/game/pvp/__tests__/nomes.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nomeDoJogador, encurtar, NOME_MAX_HUD } from '../nomes.js'

const sala = [
  { nome: 'Ana', papel: 'host' },
  { nome: 'Beto Silva', papel: 'convidado' },
]

test('nomes: no mesmo PC o P1 é JOGADOR 1 e o P2 é JOGADOR 2', () => {
  assert.equal(nomeDoJogador(0), 'JOGADOR 1')
  assert.equal(nomeDoJogador(1), 'JOGADOR 2')
})

test('nomes: com conta logada o P1 usa o nome da conta (o P2 continua JOGADOR 2)', () => {
  assert.equal(nomeDoJogador(0, { contaNome: 'Carla' }), 'CARLA')
  assert.equal(nomeDoJogador(1, { contaNome: 'Carla' }), 'JOGADOR 2')
})

test('nomes: contra a CPU o lado dela é CPU, o outro segue a regra de sempre', () => {
  assert.equal(nomeDoJogador(1, { cpu: 1, contaNome: 'Carla' }), 'CPU')
  assert.equal(nomeDoJogador(0, { cpu: 1, contaNome: 'Carla' }), 'CARLA')
  assert.equal(nomeDoJogador(0, { cpu: 0 }), 'CPU') // CO-OP com CPU aliada no P1 não ocorre, mas vale
})

test('nomes: em rede cada lado usa o nome do membro da sala (host = lado 0)', () => {
  assert.equal(nomeDoJogador(0, { rede: true, membros: sala }), 'ANA')
  assert.equal(nomeDoJogador(1, { rede: true, membros: sala }), 'BETO SILVA')
  // a conta deste PC não mexe nos nomes da sala
  assert.equal(nomeDoJogador(1, { rede: true, membros: sala, contaNome: 'Carla' }), 'BETO SILVA')
})

test('nomes: em rede sem o membro ainda, cai em JOGADOR n', () => {
  assert.equal(nomeDoJogador(1, { rede: true, membros: [sala[0]] }), 'JOGADOR 2')
  assert.equal(nomeDoJogador(0, { rede: true, membros: [] }), 'JOGADOR 1')
  assert.equal(nomeDoJogador(0, { rede: true, membros: [{ nome: '   ', papel: 'host' }] }), 'JOGADOR 1')
})

test('nomes: nome comprido é cortado com reticências e não passa do limite', () => {
  const longo = 'Maximiliano Figueiredo de Albuquerque'
  const n = nomeDoJogador(0, { contaNome: longo })
  assert.ok([...n].length <= NOME_MAX_HUD, n)
  assert.ok(n.endsWith('…'))
  assert.equal(nomeDoJogador(0, { contaNome: longo, max: 8 }).length <= 8, true)
  assert.equal(encurtar('Ana', 12), 'Ana')
  assert.equal(encurtar('  muito   espaço  ', 20), 'muito espaço')
  assert.equal(encurtar('abcdefghij', 5), 'abcd…')
  assert.equal(encurtar(null), '')
})

test('nomes: nome ofensivo passa pelo filtro do jogo e vira JOGADOR', () => {
  assert.equal(nomeDoJogador(1, { rede: true, membros: [sala[0], { nome: 'Bosta', papel: 'convidado' }] }), 'JOGADOR')
})

test('nomes: o tamanho da fonte encolhe para o nome caber e respeita os limites', async () => {
  const { tamanhoQueCabe } = await import('../nomes.js')
  assert.equal(tamanhoQueCabe('ANA', { max: 76, larguraPx: 500 }), 76)
  assert.equal(tamanhoQueCabe('MAXIMILIANO…', { max: 76, larguraPx: 500 }), 69)
  assert.equal(tamanhoQueCabe('X'.repeat(60), { max: 76, larguraPx: 500 }), 13)
  assert.equal(tamanhoQueCabe('X'.repeat(200), { max: 76, larguraPx: 500 }), 12)
  assert.equal(tamanhoQueCabe('', { max: 30, larguraPx: 100 }), 30)
})
