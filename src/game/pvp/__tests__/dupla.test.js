// Regras do 2x2 (pvp/dupla.js): node --test src/game/pvp/__tests__/dupla.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DUPLA, criarPartidaDupla, iniciarRodadaDupla, duelosDaRodada, podeJogarDupla, resolverRodadaDupla, fimDaRodadaDupla, parceiroDe, alvosDeApoio, classificacaoDupla, timeZerado } from '../dupla.js'
import { aplicarDanoFfa, eliminarFfa, FFA } from '../ffa.js'
import { ARRANJOS, timesDoArranjo, proximoArranjo } from '../../../lib/times2x2.js'

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

function partida(times = [0, 1, 0, 1]) {
  const e = criarPartidaDupla({ personagens: QUATRO, times, semente: 'dupla-teste' })
  iniciarRodadaDupla(e)
  e.jogadores.forEach((j) => (j.energia = 10))
  return e
}

// uma carta de ataque comum (não ♥, não SUPER) de j, posta na mão
const ataque = (e, j) => {
  const b = e.jogadores[j].baralho
  const c = [...b.mao, ...b.monte, ...b.descarte].find((x) => x.naipe !== 'copas' && x.valor > 1 && x.valor < 14)
  return naMao(e, j, c.id).id
}

const cair = (e, j) => {
  e.jogadores[j].hp = 0
  e.jogadores[j].caido = { rodada: e.rodada - 1, ordem: 1 }
}

test('arranjos: a vaga 0 é sempre do time A, cada time com 2, o TROCAR TIME passa pelos 3', () => {
  for (const t of ARRANJOS) {
    assert.equal(t[0], 0)
    assert.equal(t.filter((x) => x === 0).length, 2)
  }
  assert.deepEqual(timesDoArranjo(0), [0, 1, 0, 1])
  assert.deepEqual(timesDoArranjo(99), [0, 1, 0, 1])
  assert.deepEqual([0, 1, 2].map(proximoArranjo), [1, 2, 0])
  assert.throws(() => criarPartidaDupla({ personagens: QUATRO, times: [0, 0, 0, 1] }))
  assert.throws(() => criarPartidaDupla({ personagens: QUATRO.slice(0, 3) }))
})

test('duelos cruzados: ímpar A1×B1 e A2×B2, par A1×B2 e A2×B1 (todos mútuos)', () => {
  const t = [0, 1, 0, 1]
  assert.deepEqual(duelosDaRodada(t, [0, 1, 2, 3], 1), { alvos: [1, 0, 3, 2], semAlvo: [] })
  assert.deepEqual(duelosDaRodada(t, [0, 1, 2, 3], 2), { alvos: [3, 2, 1, 0], semAlvo: [] })
  assert.deepEqual(duelosDaRodada(t, [0, 1, 2, 3], 3).alvos, [1, 0, 3, 2])
  // outro arranjo: A = 0 e 1, B = 2 e 3
  assert.deepEqual(duelosDaRodada([0, 0, 1, 1], [0, 1, 2, 3], 1).alvos, [2, 3, 0, 1])
  assert.deepEqual(duelosDaRodada([0, 0, 1, 1], [0, 1, 2, 3], 2).alvos, [3, 2, 1, 0])
})

test('anti-foco: o que está sozinho enfrenta UM (alternando); o outro fica SEM ALVO', () => {
  const t = [0, 1, 0, 1]
  // vaga 2 (time A) caída: 0 sozinho contra 1 e 3
  const r1 = duelosDaRodada(t, [0, 1, 3], 1)
  assert.deepEqual(r1.alvos, [1, 0, null, null])
  assert.deepEqual(r1.semAlvo, [3])
  const r2 = duelosDaRodada(t, [0, 1, 3], 2)
  assert.deepEqual(r2.alvos, [3, null, null, 0])
  assert.deepEqual(r2.semAlvo, [1])
  // cada um recebe no máximo um ataque
  for (const r of [r1, r2]) for (let j = 0; j < 4; j++) assert.ok(r.alvos.filter((a) => a === j).length <= 1)
  // 1 contra 1
  assert.deepEqual(duelosDaRodada(t, [0, 3], 5), { alvos: [3, null, null, 0], semAlvo: [] })
  // um time zerado: ninguém duela
  assert.deepEqual(duelosDaRodada(t, [1, 3], 1).alvos, [null, null, null, null])
})

test('sem alvo: +1 de energia no começo da rodada e só ♥ ou passar', () => {
  const e = partida()
  cair(e, 2)
  e.jogadores.forEach((j) => (j.energia = 4))
  iniciarRodadaDupla(e)
  assert.equal(e.rodada, 2)
  assert.deepEqual(e.semAlvo, [1])
  assert.equal(e.jogadores[1].energia, 4 + 2 + DUPLA.cargaSemAlvo)
  assert.equal(e.jogadores[3].energia, 6)
  assert.equal(e.jogadores[2].energia, 4, 'o caído não ganha energia')
  e.jogadores[1].energia = 10
  const espada = ataque(e, 1)
  const copas = e.jogadores[1].baralho.mao.find((c) => c.naipe === 'copas') ?? naMao(e, 1, 'susie-copas-5')
  assert.equal(podeJogarDupla(e, 1, espada).ok, false)
  assert.equal(podeJogarDupla(e, 1, espada).bloqueio.curto, 'SEM ALVO: só ♥')
  assert.equal(podeJogarDupla(e, 1, copas.id).ok, true)
  assert.equal(podeJogarDupla(e, 1, null).ok, true)
  // o caído só passa
  assert.equal(podeJogarDupla(e, 2, e.jogadores[2].baralho.mao[0].id).ok, false)
})

test('♥ no parceiro: a cura e o escudo vão nele; a energia e a compra ficam comigo', () => {
  const e = partida()
  assert.equal(parceiroDe(e, 0), 2)
  assert.deepEqual(alvosDeApoio(e, 0), [0, 2])
  e.jogadores[2].hp = 40
  const copas = naMao(e, 0, 'kris-copas-7')
  assert.equal(podeJogarDupla(e, 0, { carta: copas.id, apoio: 1 }).ok, false, 'no adversário não')
  const antes0 = e.jogadores[0].hp
  const r = resolverRodadaDupla(e, [{ carta: copas.id, apoio: 2 }, null, null, null])
  assert.equal(r.efeitos[0].apoiou, 2)
  assert.ok(e.jogadores[2].hp > 40 || e.jogadores[2].escudo != null, 'o parceiro recebeu o apoio')
  assert.equal(e.jogadores[0].hp, antes0)
  assert.deepEqual(r.apoio, [2, null, null, null])
})

test('♥ no parceiro caído levanta ele (pelo menos 25% do HP) e ele volta na rodada seguinte', () => {
  const e = partida()
  cair(e, 2)
  iniciarRodadaDupla(e)
  e.jogadores.forEach((j) => (j.energia = 10))
  assert.equal(e.alvos[2], null)
  const copas = naMao(e, 0, 'kris-copas-7')
  const r = resolverRodadaDupla(e, [{ carta: copas.id, apoio: 2 }, null, null, null])
  assert.deepEqual(r.levantados, [{ j: 2, por: 0 }])
  assert.equal(e.jogadores[2].caido, null)
  assert.ok(e.jogadores[2].hp >= Math.ceil(e.jogadores[2].hpMax * DUPLA.levantar))
  fimDaRodadaDupla(e)
  iniciarRodadaDupla(e)
  assert.notEqual(e.alvos[2], null, 'de volta aos duelos')
})

test('resgate por rodada limpa: o parceiro desviou sem levar acerto -> o caído volta com 30%', () => {
  const e = partida()
  cair(e, 2)
  iniciarRodadaDupla(e)
  resolverRodadaDupla(e, [null, null, null, null])
  const f = fimDaRodadaDupla(e, { limpas: [true, false, false, false] })
  assert.deepEqual(f.resgatados, [{ j: 2, por: 0 }])
  assert.equal(e.jogadores[2].hp, Math.ceil(e.jogadores[2].hpMax * DUPLA.resgate))
  assert.equal(f.fim, null)
  // sem rodada limpa, continua caído
  const e2 = partida()
  cair(e2, 2)
  iniciarRodadaDupla(e2)
  resolverRodadaDupla(e2, [null, null, null, null])
  assert.deepEqual(fimDaRodadaDupla(e2, { limpas: [false, true, false, true] }).resgatados, [])
  assert.ok(e2.jogadores[2].caido)
})

test('quem zera cai (não sai); o time com os dois caídos perde', () => {
  const e = partida()
  resolverRodadaDupla(e, [null, null, null, null])
  aplicarDanoFfa(e, 1, 999, 0)
  let f = fimDaRodadaDupla(e)
  assert.deepEqual(f.caidos, [1])
  assert.equal(f.fim, null)
  assert.ok(e.jogadores[1].caido && !e.jogadores[1].eliminado)
  iniciarRodadaDupla(e)
  resolverRodadaDupla(e, [null, null, null, null])
  aplicarDanoFfa(e, 3, 999, 2)
  f = fimDaRodadaDupla(e)
  assert.equal(f.fim, 'ko')
  assert.equal(f.vencedorTime, 0)
  assert.equal(e.vencedorTime, 0)
  assert.ok(timeZerado(e, 1))
  assert.deepEqual(classificacaoDupla(e).slice(0, 2).sort(), [0, 2])
})

test('os dois times zerados no mesmo fim de rodada: EMPATE', () => {
  const e = partida()
  cair(e, 2)
  cair(e, 3)
  iniciarRodadaDupla(e)
  resolverRodadaDupla(e, [null, null, null, null])
  aplicarDanoFfa(e, 0, 999, 1)
  aplicarDanoFfa(e, 1, 999, 0)
  const f = fimDaRodadaDupla(e)
  assert.equal(f.fim, 'ko')
  assert.equal(f.vencedorTime, null)
})

test('o resgate vem antes da queda: o caído que se levanta salva o time', () => {
  const e = partida()
  cair(e, 2)
  iniciarRodadaDupla(e)
  resolverRodadaDupla(e, [null, null, null, null])
  // 0 passou limpo (resgata 2); ninguém do time A zerou
  const f = fimDaRodadaDupla(e, { limpas: [true] })
  assert.equal(f.resgatados.length, 1)
  assert.equal(f.fim, null)
})

test('SUPER em dupla: os dois do time jogam SUPER -> +25% de dano nas duas caixas', () => {
  const sozinho = partida()
  const s0 = naMao(sozinho, 0, 'kris-espadas-14').id
  const r0 = resolverRodadaDupla(sozinho, [s0, null, null, null])
  assert.deepEqual(r0.superDupla, [])
  const base = r0.caixas[1].dano
  const e = partida()
  const a = naMao(e, 0, 'kris-espadas-14').id
  const b = naMao(e, 2, 'ralsei-espadas-14').id
  const r = resolverRodadaDupla(e, [a, null, b, null])
  assert.deepEqual(r.superDupla, [0])
  assert.equal(r.caixas[1].dano, Math.ceil(base * DUPLA.superDupla))
  assert.ok(r.caixas[3].dano > 0)
})

test('quem saiu (20 s) fica FORA: não volta nem é resgatado, e conta como caído para a vitória', () => {
  const e = partida()
  eliminarFfa(e, 2, 'saiu')
  resolverRodadaDupla(e, [null, null, null, null])
  let f = fimDaRodadaDupla(e, { limpas: [true, true, true, true] })
  assert.deepEqual(f.resgatados, [])
  assert.equal(f.fim, null)
  iniciarRodadaDupla(e)
  assert.equal(e.alvos[2], null)
  assert.equal(e.semAlvo.length, 1, 'o time de um só: anti-foco')
  assert.deepEqual(alvosDeApoio(e, 0), [0])
  resolverRodadaDupla(e, [null, null, null, null])
  aplicarDanoFfa(e, 0, 999, e.alvos[0])
  f = fimDaRodadaDupla(e)
  assert.equal(f.vencedorTime, 1)
})

test('sem conexão: não joga nem ganha energia (como no ffa)', () => {
  const e = partida()
  e.jogadores.forEach((j) => (j.energia = 2))
  fimDaRodadaDupla(e)
  iniciarRodadaDupla(e, { ausentes: [1] })
  assert.equal(e.jogadores[1].energia, 2)
  assert.equal(e.jogadores[0].energia, 4)
  const espada = ataque(e, 1)
  const r = resolverRodadaDupla(e, [null, espada, null, null])
  assert.equal(r.jogadas[1].fora, true)
  assert.equal(r.caixas[0], null)
})

test('limite de rodadas: vence o time com mais HP somado (igual: empate)', () => {
  const e = partida()
  e.rodada = FFA.limiteRodadas
  e.jogadores.forEach((j) => (j.hp = 50))
  resolverRodadaDupla(e, [null, null, null, null])
  aplicarDanoFfa(e, 1, 10, 0)
  const f = fimDaRodadaDupla(e)
  assert.equal(f.fim, 'limite')
  assert.equal(f.vencedorTime, 0)
  const e2 = partida()
  e2.rodada = FFA.limiteRodadas
  e2.jogadores.forEach((j) => (j.hp = 50))
  resolverRodadaDupla(e2, [null, null, null, null])
  assert.equal(fimDaRodadaDupla(e2).vencedorTime, null)
})
