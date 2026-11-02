// node --test src/game/party/__tests__/escolha.test.js
// A escolha de personagem da party feita na espera (party/escolha.js, docs/online.md "Modo Party").
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { iniciarPicks, vizinho, pedir, resolver, montarInicio, padraoDe } from '../escolha.js'

const IDS = ['kris', 'susie', 'ralsei', 'noelle', 'berdly', 'dess', 'asriel']
const fonte = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8')

test('cada vaga tem o seu pick, sem repetir', () => {
  const picks = iniciarPicks({ presentes: [0, 1, 2, 3], ids: IDS })
  assert.deepEqual(picks, { 0: 'kris', 1: 'susie', 2: 'ralsei', 3: 'noelle' })
  assert.equal(new Set(Object.values(picks)).size, 4)
})

test('o pick começa no último usado de cada vaga', () => {
  const picks = iniciarPicks({ presentes: [0, 1, 2], ids: IDS, ultima: ['dess', 'kris', 'asriel'] })
  assert.deepEqual(picks, { 0: 'dess', 1: 'kris', 2: 'asriel' })
  assert.equal(padraoDe(1, IDS, ['x', 'berdly']), 'berdly')
  assert.equal(padraoDe(1, IDS, ['x', 'inexistente']), 'susie')
})

test('último usado repetido: o segundo vai para o mais próximo livre', () => {
  const picks = iniciarPicks({ presentes: [0, 1, 2], ids: IDS, ultima: ['kris', 'kris', 'kris'] })
  assert.deepEqual(picks, { 0: 'kris', 1: 'susie', 2: 'ralsei' })
})

test('picks que já existiam sobrevivem; quem saiu perde o seu; quem entrou ganha o padrão', () => {
  const antes = { 0: 'dess', 1: 'asriel', 2: 'berdly' }
  const picks = iniciarPicks({ presentes: [0, 2, 3], ids: IDS, anteriores: antes, ultima: [] })
  assert.equal(picks[0], 'dess')
  assert.equal(picks[2], 'berdly')
  assert.equal(picks[3], 'noelle')
  assert.equal(picks[1], undefined)
})

test('↑/↓ pula os personagens que outra vaga já tem', () => {
  const picks = { 0: 'kris', 1: 'susie', 2: 'ralsei' }
  assert.equal(vizinho(picks, 0, 1, IDS), 'noelle') // susie e ralsei ocupados
  assert.equal(vizinho(picks, 0, -1, IDS), 'asriel') // volta em círculo
  assert.equal(vizinho({ 0: 'kris' }, 0, 1, IDS), 'susie')
})

test('o host recusa pedido repetido, fora do elenco ou de quem não está na sala', () => {
  const picks = { 0: 'kris', 1: 'susie' }
  assert.equal(pedir(picks, 1, 'kris', IDS, [0, 1]).ok, false)
  assert.equal(pedir(picks, 1, 'nao-existe', IDS, [0, 1]).ok, false)
  assert.equal(pedir(picks, 3, 'dess', IDS, [0, 1]).ok, false)
  const r = pedir(picks, 1, 'dess', IDS, [0, 1])
  assert.equal(r.ok, true)
  assert.deepEqual(r.picks, { 0: 'kris', 1: 'dess' })
  assert.deepEqual(picks, { 0: 'kris', 1: 'susie' }, 'não muda o original')
})

test('resolver: o pick válido fica', () => {
  const lista = resolver({ picks: { 0: 'dess', 1: 'asriel', 2: 'kris' }, presentes: [0, 1, 2], ids: IDS })
  assert.deepEqual(lista.slice(0, 3), ['dess', 'asriel', 'kris'])
})

test('resolver por modo: duplicado ou inválido vira o último válido / o mais próximo livre (PVP e CO-OP)', () => {
  for (const modo of ['2x2', 'ffa', 'coop4']) {
    // vaga 1 repete a 0; vaga 2 pede um personagem que não existe mais (cai no último usado)
    const lista = resolver({ picks: { 0: 'kris', 1: 'kris', 2: 'fantasma' }, presentes: [0, 1, 2], ids: IDS, ultima: [null, null, 'berdly'] })
    assert.equal(lista[0], 'kris', modo)
    assert.equal(lista[1], 'susie', modo)
    assert.equal(lista[2], 'berdly', modo)
    assert.equal(new Set(lista).size, lista.length, modo)
  }
})

test('resolver: vaga ausente fica com um personagem que ninguém pegou (tamanho pelo maior índice)', () => {
  const lista = resolver({ picks: { 0: 'kris', 2: 'susie' }, presentes: [0, 2], ids: IDS })
  assert.equal(lista.length, 3)
  assert.equal(lista[0], 'kris')
  assert.equal(lista[2], 'susie')
  assert.ok(!['kris', 'susie'].includes(lista[1]))
  assert.equal(resolver({ picks: {}, presentes: [0, 1, 2, 3], ids: IDS }).length, 4)
})

test('payload de início PVP leva os picks de todos (todos contra todos e 2x2)', () => {
  const picks = { 0: 'dess', 1: 'asriel', 2: 'kris', 3: 'noelle' }
  const ffa = montarInicio({ modo: 'ffa', vencedora: 'estrada', picks, presentes: [0, 1, 2, 3], ids: IDS, agora: 5 })
  assert.equal(ffa.cena, 'PvpArenaN')
  assert.deepEqual(ffa.dados.personagens, ['dess', 'asriel', 'kris', 'noelle'])
  assert.equal(ffa.dados.arena, 'estrada')
  assert.equal(ffa.dados.modo, undefined)
  const times = [[0, 1], [2, 3]]
  const dupla = montarInicio({ modo: '2x2', vencedora: 'estrada', picks, presentes: [0, 1, 2, 3], ids: IDS, times, agora: 5 })
  assert.equal(dupla.dados.modo, '2x2')
  assert.deepEqual(dupla.dados.times, times)
  assert.deepEqual(dupla.dados.personagens, dupla.lista)
})

test('payload de início CO-OP: Dificuldade com a party e o nível pré-escolhido', () => {
  const picks = { 0: 'susie', 1: 'kris', 2: 'ralsei' }
  const r = montarInicio({ modo: 'coop4', vencedora: 'king', picks, presentes: [0, 1, 2], ids: IDS, nivel: 'medio' })
  assert.equal(r.cena, 'Dificuldade')
  assert.deepEqual(r.dados, { chefe: 'king', party: ['susie', 'kris', 'ralsei'], nivel: 'medio' })
})

test('nenhuma cena de escolha de personagem no ciclo da party', () => {
  const proibidas = ['PvpEscolhaN', 'EscolhaPartyN', 'EscolhaParty', 'PvpEscolha', 'Selecao']
  for (const arquivo of ['scenes/PartyVoto.js', 'scenes/PartyFim.js', 'party/escolha.js']) {
    const src = fonte(arquivo)
    for (const cena of proibidas) assert.ok(!new RegExp(`['"]${cena}['"]`).test(src), `${arquivo} não deve abrir ${cena}`)
  }
  for (const modo of ['2x2', 'ffa', 'coop4']) {
    const { cena } = montarInicio({ modo, vencedora: 'x', picks: {}, presentes: [0, 1, 2], ids: IDS })
    assert.ok(['PvpArenaN', 'Dificuldade'].includes(cena))
  }
})

test('as telas de espera têm o seletor (CONTINUAR e as votações)', () => {
  for (const arquivo of ['scenes/PartyVoto.js', 'scenes/PartyFim.js']) assert.match(fonte(arquivo), /new Seletor\(this/)
})
