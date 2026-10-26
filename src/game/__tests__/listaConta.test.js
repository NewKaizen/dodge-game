// node --test src/game/__tests__/listaConta.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { janela, escondidas, abaVizinha, moverNaGrade, abreviar, ordenarAmigos, motivoSemConvite, novosIds, segundosRestantes } from '../conta/lista.js'

test('janela: lista curta não rola; a seleção fica à vista nas longas', () => {
  assert.equal(janela(5, 4, 8), 0)
  assert.equal(janela(20, 0, 8), 0)
  assert.equal(janela(20, 10, 8), 6)
  assert.equal(janela(20, 19, 8), 12, 'no fim, a última linha encosta embaixo')
  for (let sel = 0; sel < 20; sel++) {
    const i = janela(20, sel, 8)
    assert.ok(sel >= i && sel < i + 8, `sel ${sel} dentro da janela ${i}`)
  }
})

test('escondidas: quantos itens sobraram em cima e embaixo', () => {
  assert.deepEqual(escondidas(20, 6, 8), { acima: 6, abaixo: 6 })
  assert.deepEqual(escondidas(5, 0, 8), { acima: 0, abaixo: 0 })
})

test('abaVizinha: dá a volta nos dois sentidos', () => {
  assert.equal(abaVizinha(3, 2, 1), 0)
  assert.equal(abaVizinha(3, 0, -1), 2)
  assert.equal(abaVizinha(3, 1, 1), 2)
})

test('moverNaGrade: limites, última linha curta e saída para cima', () => {
  // 7 itens em 4 colunas: linha 0 = 0..3, linha 1 = 4..6
  assert.deepEqual(moverNaGrade(0, 7, 4, 'direita'), { indice: 1, sair: null })
  assert.deepEqual(moverNaGrade(3, 7, 4, 'direita'), { indice: 3, sair: null }, 'não pula de linha')
  assert.deepEqual(moverNaGrade(6, 7, 4, 'direita'), { indice: 6, sair: null }, 'nem passa do último')
  assert.deepEqual(moverNaGrade(0, 7, 4, 'esquerda'), { indice: 0, sair: null })
  assert.deepEqual(moverNaGrade(3, 7, 4, 'baixo'), { indice: 6, sair: null }, 'desce para o último da linha curta')
  assert.deepEqual(moverNaGrade(5, 7, 4, 'baixo'), { indice: 5, sair: null })
  assert.deepEqual(moverNaGrade(5, 7, 4, 'cima'), { indice: 1, sair: null })
  assert.deepEqual(moverNaGrade(2, 7, 4, 'cima'), { indice: 2, sair: 'cima' })
  assert.deepEqual(moverNaGrade(0, 0, 4, 'cima'), { indice: 0, sair: 'cima' }, 'grade vazia')
})

test('abreviar: corta com reticências sem quebrar acentos', () => {
  assert.equal(abreviar('Ana', 16), 'Ana')
  assert.equal(abreviar('Maximiliano da Conceição', 16), 'Maximiliano da…')
  assert.equal(abreviar('Ação Ação Ação', 5), 'Ação…')
  assert.equal([...abreviar('x'.repeat(40), 16)].length, 16)
})

test('ordenarAmigos: online primeiro, depois alfabético', () => {
  const lista = [
    { id: '1', nome: 'Zeca' },
    { id: '2', nome: 'Ana' },
    { id: '3', nome: 'Bia' },
    { id: '4', nome: 'Caio' },
  ]
  const status = (id) => ({ 1: 'disponivel', 3: 'em_partida' })[id] ?? 'offline'
  assert.deepEqual(ordenarAmigos(lista, status).map((a) => a.nome), ['Bia', 'Zeca', 'Ana', 'Caio'])
})

test('motivoSemConvite: cada motivo na ordem, vazio quando pode', () => {
  const base = { conectado: true, status: 'disponivel' }
  assert.equal(motivoSemConvite(base), '')
  assert.match(motivoSemConvite({ ...base, conectado: false }), /conexão/)
  assert.match(motivoSemConvite({ ...base, status: 'offline' }), /offline/)
  assert.match(motivoSemConvite({ ...base, status: 'em_partida' }), /partida/)
  assert.match(motivoSemConvite({ ...base, pendenteAte: 10, agora: 5 }), /espere/)
  assert.equal(motivoSemConvite({ ...base, pendenteAte: 5, agora: 5 }), '', 'convite vencido não trava')
  const sala = { emPartida: false, membros: [1], max: 2 }
  assert.match(motivoSemConvite({ ...base, sala }), /host/)
  assert.equal(motivoSemConvite({ ...base, sala, souHost: true }), '')
  assert.match(motivoSemConvite({ ...base, sala: { ...sala, emPartida: true }, souHost: true }), /numa partida/)
  assert.match(motivoSemConvite({ ...base, sala: { ...sala, membros: [1, 2] }, souHost: true }), /cheia/)
})

test('novosIds: a primeira leitura não conta; depois só os que chegaram', () => {
  assert.deepEqual(novosIds(null, ['a', 'b']), [])
  assert.deepEqual(novosIds(new Set(['a']), ['a', 'b', 'c']), ['b', 'c'])
  assert.deepEqual(novosIds(new Set(['a']), []), [])
})

test('segundosRestantes: arredonda para cima e não fica negativo', () => {
  assert.equal(segundosRestantes(10_001, 0), 11)
  assert.equal(segundosRestantes(0, 5), 0)
})
