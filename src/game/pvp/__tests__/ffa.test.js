// Regras do TODOS CONTRA TODOS (pvp/ffa.js): node --test src/game/pvp/__tests__/ffa.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  FFA,
  criarPartidaFfa,
  iniciarRodadaFfa,
  resolverRodadaFfa,
  alvosDoRodizio,
  atacanteDe,
  aplicarDanoFfa,
  aplicarAusente,
  danoAusente,
  eliminarFfa,
  fimDaRodadaFfa,
  classificacao,
  colocacoes,
  vivos,
  textoDosAlvos,
} from '../ffa.js'

const QUATRO = ['kris', 'susie', 'ralsei', 'dess']

function naMao(estado, j, id) {
  const b = estado.jogadores[j].baralho
  for (const pilha of ['monte', 'descarte', 'mao']) {
    const i = b[pilha].findIndex((c) => c.id === id)
    if (i >= 0) {
      const [c] = b[pilha].splice(i, 1)
      b.mao.push(c)
      return c
    }
  }
  throw new Error(`carta ${id} não existe`)
}

function partida(personagens = QUATRO, energia = 10) {
  const e = criarPartidaFfa({ personagens, semente: 'ffa-teste' })
  iniciarRodadaFfa(e)
  e.jogadores.forEach((j) => (j.energia = energia))
  return e
}

const ehPermutacaoSemPontoFixo = (alvos, lista) => {
  const recebidos = lista.map((j) => alvos[j])
  return lista.every((j) => alvos[j] != null && alvos[j] !== j && lista.includes(alvos[j])) && new Set(recebidos).size === lista.length
}

test('rodízio com 3: sempre um ciclo, alternando o sentido; ninguém ataca a si mesmo nem recebe dois', () => {
  const vistos = new Set()
  for (let r = 1; r <= 12; r++) {
    const alvos = alvosDoRodizio([0, 1, 2], r, 3)
    assert.ok(ehPermutacaoSemPontoFixo(alvos, [0, 1, 2]), `rodada ${r}: ${alvos}`)
    vistos.add(alvos.join(','))
  }
  assert.deepEqual([...vistos].sort(), ['1,2,0', '2,0,1'])
  assert.deepEqual(alvosDoRodizio([0, 1, 2], 1, 3), [1, 2, 0])
  assert.deepEqual(alvosDoRodizio([0, 1, 2], 2, 3), [2, 0, 1])
})

test('rodízio com 4: passos 1, 2, 3 (o 2 faz duplas); sempre um ataque recebido por pessoa', () => {
  assert.deepEqual(alvosDoRodizio([0, 1, 2, 3], 1, 4), [1, 2, 3, 0])
  assert.deepEqual(alvosDoRodizio([0, 1, 2, 3], 2, 4), [2, 3, 0, 1])
  assert.deepEqual(alvosDoRodizio([0, 1, 2, 3], 3, 4), [3, 0, 1, 2])
  for (let r = 1; r <= 30; r++) assert.ok(ehPermutacaoSemPontoFixo(alvosDoRodizio([0, 1, 2, 3], r, 4), [0, 1, 2, 3]))
})

test('rodízio depois das eliminações: só os vivos, ainda sem ponto fixo (3 vivos de 4, 2 vivos = 1x1)', () => {
  for (let r = 1; r <= 10; r++) {
    const a = alvosDoRodizio([0, 2, 3], r, 4)
    assert.equal(a[1], null, 'a vaga eliminada não ataca')
    assert.ok(!a.includes(1), 'nem é atacada')
    assert.ok(ehPermutacaoSemPontoFixo(a, [0, 2, 3]))
    assert.deepEqual(alvosDoRodizio([1, 3], r, 4), [null, 3, null, 1])
  }
  assert.deepEqual(alvosDoRodizio([2], 5, 4), [null, null, null, null])
})

test('a rodada anuncia os alvos antes da escolha (estado.alvos) e o texto lista cada par', () => {
  const e = criarPartidaFfa({ personagens: QUATRO, semente: 's' })
  iniciarRodadaFfa(e)
  assert.deepEqual(e.alvos, [1, 2, 3, 0])
  assert.equal(atacanteDe(e, 0), 3)
  const nomes = ['ANA', 'BETO', 'CAIO', 'DUDA']
  assert.equal(textoDosAlvos(e.alvos, (j) => nomes[j]), 'ANA → BETO · BETO → CAIO · CAIO → DUDA · DUDA → ANA')
  assert.equal(e.jogadores[0].energia, 3)
  assert.ok(e.jogadores.every((j) => j.baralho.mao.length === 5))
})

test('cada carta de ataque vai para a caixa do alvo do dono; cada caixa recebe no máximo um ataque', () => {
  const e = partida()
  const espada = (j) => {
    const b = e.jogadores[j].baralho
    return [...b.mao, ...b.monte, ...b.descarte].find((c) => c.naipe === 'espadas' && c.valor > 1 && c.valor < 14).id
  }
  const jogadas = e.jogadores.map((_, j) => naMao(e, j, espada(j)).id)
  const r = resolverRodadaFfa(e, jogadas)
  r.caixas.forEach((caixa, j) => {
    assert.ok(caixa, `caixa ${j}`)
    assert.equal(e.alvos[caixa.de], j, 'a caixa de j veio de quem ataca j')
  })
  assert.equal(new Set(r.caixas.map((c) => c.de)).size, 4)
})

test('passar dá +1 de energia; caixa sem atacante fica calma', () => {
  const e = partida(['kris', 'susie', 'ralsei'], 4)
  const r = resolverRodadaFfa(e, [null, null, null])
  assert.ok(r.caixas.every((c) => c === null))
  assert.ok(e.jogadores.every((j) => j.energia === 5))
})

test('♦ Anular de X cancela a carta de quem ataca X (e manda o ataque leve para o alvo de X)', () => {
  const e = partida(['kris', 'susie', 'ralsei'])
  // alvos [1, 2, 0]: o 2 ataca o 0; o 0 anula
  const anular = naMao(e, 0, 'kris-ouros-1').id
  const b2 = e.jogadores[2].baralho
  const ataque2 = naMao(e, 2, [...b2.mao, ...b2.monte, ...b2.descarte].find((c) => c.naipe === 'espadas' && c.valor > 1 && c.valor < 14).id)
  const r = resolverRodadaFfa(e, [anular, null, ataque2.id])
  assert.equal(r.jogadas[2].anulada, true)
  assert.equal(r.caixas[0], null, 'nada chega no 0')
  assert.equal(r.caixas[1]?.de, 0, 'o ataque leve do Anular vai para o alvo do 0')
})

test('♠ Espelho passa adiante o ataque que vinha: vai para o alvo de quem espelhou, no lugar do eco', () => {
  const e = partida(['kris', 'susie', 'ralsei'])
  // alvos [1, 2, 0]: 0 ataca 1, 1 espelha -> o ataque do 0 vai para o 2 (alvo do 1); o 1 não recebe nada
  const ataque0 = naMao(e, 0, 'kris-espadas-9').id
  const espelho = naMao(e, 1, 'susie-espadas-1').id
  const r = resolverRodadaFfa(e, [ataque0, espelho, null])
  assert.equal(r.caixas[1], null)
  assert.equal(r.caixas[2].carta.id, ataque0)
  assert.equal(r.caixas[2].de, 1, 'quem manda agora é o espelho')
  assert.equal(r.caixas[2].dono, 0)
  assert.equal(r.caixas[2].refletida, true)
  // sem nada para passar: eco no alvo
  const e2 = partida(['kris', 'susie', 'ralsei'])
  const r2 = resolverRodadaFfa(e2, [null, naMao(e2, 1, 'susie-espadas-1').id, null])
  assert.equal(r2.caixas[2].carta.id, 'susie-espadas-1')
})

test('o SUPER não é anulado nem passado adiante', () => {
  const e = partida(['kris', 'susie', 'ralsei'])
  const sup = naMao(e, 0, 'kris-espadas-14').id
  const espelho = naMao(e, 1, 'susie-espadas-1').id
  const r = resolverRodadaFfa(e, [sup, espelho, null])
  assert.equal(r.caixas[1].carta.id, sup, 'o SUPER chega no 1')
  assert.equal(r.caixas[2].carta.id, espelho, 'o espelho manda o eco')
  const e2 = partida(['kris', 'susie', 'ralsei'])
  const r2 = resolverRodadaFfa(e2, [naMao(e2, 0, 'kris-espadas-14').id, naMao(e2, 1, 'susie-ouros-1').id, null])
  assert.equal(r2.jogadas[0].anulada, false)
  assert.equal(r2.caixas[1].carta.id, 'kris-espadas-14')
})

test('♣ Roubo pega uma carta do alvo', () => {
  const e = partida(['kris', 'susie', 'ralsei'])
  const antes = e.jogadores[1].baralho.mao.length
  const r = resolverRodadaFfa(e, [naMao(e, 0, 'kris-paus-1').id, null, null])
  assert.ok(r.efeitos[0].roubou)
  assert.equal(r.efeitos[1].perdeu, r.efeitos[0].roubou)
  assert.equal(e.jogadores[1].baralho.mao.length, antes - 1)
})

test('eliminado e sem conexão não jogam (passam sem o bônus) nem ganham energia', () => {
  const e = criarPartidaFfa({ personagens: QUATRO, semente: 'x' })
  iniciarRodadaFfa(e)
  eliminarFfa(e, 3, 'ko')
  iniciarRodadaFfa(e, { ausentes: [1] })
  assert.equal(e.jogadores[1].energia, 3, 'o ausente não ganhou os +2')
  assert.equal(e.jogadores[0].energia, 5)
  assert.equal(e.alvos[3], null)
  assert.ok(e.alvos.includes(1), 'o ausente continua no rodízio (recebe o ataque)')
  const id1 = e.jogadores[1].baralho.mao[0].id
  const r = resolverRodadaFfa(e, [null, id1, null, null])
  assert.equal(r.jogadas[1].passou, true, 'a jogada do ausente não vale')
  assert.equal(e.jogadores[1].energia, 3, 'e não ganha o +1 de passar')
  assert.equal(r.jogadas[1].fora, true)
})

test('quem cai não leva vantagem: o ataque que vinha vale como acertos cheios (menos o que já levou)', () => {
  const e = partida(['kris', 'susie', 'ralsei'])
  const id = naMao(e, 0, 'kris-espadas-9').id
  const r = resolverRodadaFfa(e, [id, null, null])
  const caixa = r.caixas[1]
  const hp = e.jogadores[1].hp
  assert.equal(danoAusente(caixa), caixa.dano * FFA.acertosAusente)
  const efetivo = aplicarAusente(e, 1, caixa, caixa.dano)
  assert.equal(efetivo, caixa.dano * (FFA.acertosAusente - 1))
  assert.equal(e.jogadores[1].hp, hp - efetivo)
  assert.equal(e.jogadores[0].danoCausado, efetivo, 'conta como dano de quem atacou')
  assert.equal(aplicarAusente(e, 2, null), 0, 'sem caixa: nada')
})

test('morte súbita: a partir da rodada FFA.morteSubita o dano por bala sobe', () => {
  const e = partida(['kris', 'susie', 'ralsei'])
  const normal = resolverRodadaFfa(e, [naMao(e, 0, 'kris-espadas-9').id, null, null]).caixas[1].dano
  const e2 = partida(['kris', 'susie', 'ralsei'])
  e2.rodada = FFA.morteSubita
  const r2 = resolverRodadaFfa(e2, [naMao(e2, 0, 'kris-espadas-9').id, null, null])
  assert.equal(r2.morteSubita, true)
  assert.equal(r2.caixas[1].dano, Math.ceil(normal * FFA.fatorMorteSubita))
})

test('eliminação por K.O. no fim da rodada; quem cai na mesma rodada fica no mesmo lote; a classificação desempata pelo dano causado', () => {
  const e = partida()
  aplicarDanoFfa(e, 0, 30, 1)
  aplicarDanoFfa(e, 3, 5, 0)
  e.jogadores[3].hp = 0
  let f = fimDaRodadaFfa(e)
  assert.deepEqual(f.eliminados, [3])
  assert.equal(f.fim, null)
  assert.equal(e.jogadores[3].eliminado.rodada, 1)
  iniciarRodadaFfa(e)
  assert.equal(e.alvos[3], null)
  e.jogadores[1].hp = 0
  e.jogadores[2].hp = 0
  e.jogadores[1].danoCausado = 50
  f = fimDaRodadaFfa(e)
  assert.deepEqual(f.eliminados, [1, 2])
  assert.equal(e.jogadores[1].eliminado.ordem, e.jogadores[2].eliminado.ordem)
  assert.equal(f.fim, 'ko')
  assert.equal(e.vencedor, 0)
  assert.deepEqual(classificacao(e), [0, 1, 2, 3], 'o 1 causou mais dano que o 2 (mesmo lote)')
  assert.deepEqual(colocacoes(e), [1, 2, 3, 4])
  assert.equal(e.fim, 'ko')
  assert.throws(() => resolverRodadaFfa(e, [null, null, null, null]))
})

test('os dois últimos caem juntos: o desempate decide o 1º (HP 0 nos dois, dano causado)', () => {
  const e = partida(['kris', 'susie', 'ralsei'])
  eliminarFfa(e, 2, 'saiu')
  e.jogadores[0].hp = 0
  e.jogadores[1].hp = 0
  e.jogadores[0].danoCausado = 10
  e.jogadores[1].danoCausado = 20
  const f = fimDaRodadaFfa(e)
  assert.equal(f.fim, 'ko')
  assert.deepEqual(classificacao(e), [1, 0, 2])
})

test('quem esgota os 20 s é eliminado NA HORA: fica atrás de quem cai depois na mesma rodada', () => {
  const e = partida()
  eliminarFfa(e, 2, 'saiu') // caiu e não voltou no meio da rodada 1
  e.jogadores[3].hp = 0
  fimDaRodadaFfa(e) // o 3 cai depois, no fim da mesma rodada
  assert.equal(e.jogadores[2].eliminado.motivo, 'saiu')
  const c = classificacao(e)
  assert.ok(c.indexOf(3) < c.indexOf(2), 'o K.O. depois da saída fica na frente')
  assert.deepEqual(vivos(e), [0, 1])
  assert.equal(eliminarFfa(e, 2, 'saiu'), false, 'não elimina duas vezes')
})

test('limite de rodadas: acaba com mais de um vivo e classifica pelo HP', () => {
  const e = partida(['kris', 'susie', 'ralsei'])
  e.rodada = FFA.limiteRodadas
  e.jogadores[0].hp = 10
  e.jogadores[1].hp = 40
  e.jogadores[2].hp = 25
  const f = fimDaRodadaFfa(e)
  assert.equal(f.fim, 'limite')
  assert.deepEqual(classificacao(e), [1, 2, 0])
})

test('o estado é JSON puro e a mesma semente dá a mesma partida', () => {
  const a = criarPartidaFfa({ personagens: QUATRO, semente: 'igual' })
  const b = criarPartidaFfa({ personagens: QUATRO, semente: 'igual' })
  iniciarRodadaFfa(a)
  iniciarRodadaFfa(b)
  assert.deepEqual(JSON.parse(JSON.stringify(a)), b)
  assert.deepEqual(structuredClone(a), a)
})
