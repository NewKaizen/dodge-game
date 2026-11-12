// node --test src/game/manual/__tests__/pagina9.test.js
// Página 9 (extra), "Ases, SUPER e perfeitos": carregar energia (perfeitos em combo + graze), jogar o ★ e conhecer os Ases,
// tudo com as regras reais (pvp/regras.js e pvp/cartas.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ENERGIA, energiaPerfeito, multiplicadorPerfeito } from '../../pvp/regras.js'
import { SUPER } from '../../pvp/cartas.js'
import { criarPagina9, PASSOS9, ENERGIA_INICIAL_P9, ONDA_MS, ONDAS, CARTA_DO_ATAQUE, AS_ESPADAS, AS_COPAS, AS_OUROS, AS_PAUS, SUPER_ID, SLOTS_SUPER, SLOTS_ASES, TEXTOS9 } from '../pagina9.js'
import { cartaDoManual } from '../cartasDoManual.js'
import { CAIXA, rodar, ate, desviando, parado } from './apoio/pilotos.mjs'

const nova = (op = {}) => criarPagina9({ caixa: CAIXA, ...op })
const noPasso = (passos) => {
  const p = nova({ passos })
  ate(p, 'explicar')
  p.drenar()
  return p
}

test('as regras do passo vêm do jogo: o ataque vale +2 (J), o combo é x1 e x2, o SUPER custa 10 e os Ases custam 3', () => {
  assert.equal(energiaPerfeito(cartaDoManual(CARTA_DO_ATAQUE)), 2)
  assert.deepEqual([1, 2, 3, 4, 5].map(multiplicadorPerfeito), [1, 2, 3, 4, 4])
  assert.equal(cartaDoManual(SUPER_ID).custo, SUPER.custo)
  assert.equal(SUPER.custo, ENERGIA.maxima)
  for (const id of SLOTS_ASES) assert.equal(cartaDoManual(id).custo, 3)
  assert.equal(cartaDoManual(AS_OUROS).descricao.includes('cancela'), true, 'o texto do jogo diz que o Ás de ouros cancela')
  // 6 + 2 (x1) + 4 (x2) passa de 10: o teto é a regra
  assert.ok(ENERGIA_INICIAL_P9 + 2 + 4 >= ENERGIA.maxima)
  assert.deepEqual(PASSOS9.map((x) => [x.id, x.tipo]), [['carregar', 'desafio'], ['super', 'escolha'], ['ases', 'escolha']])
})

test('carregar: dois ataques sem acerto = PERFEITO x1 e x2, e as gemas chegam a 10', () => {
  const p = noPasso(null)
  assert.equal(p.energiaNaTela, ENERGIA_INICIAL_P9)
  p.avancar()
  const ev = rodar(p, 40000, (q) => [desviando(0)(q)], (q) => q.etapa === 'acertou')
  assert.equal(p.etapa, 'acertou', `${p.etapa} aos ${p.tent?.tempo}`)
  const perf = ev.filter((e) => e.tipo === 'perfeito')
  assert.deepEqual(perf.map((e) => [e.multiplicador, e.sequencia]), [[1, 1], [2, 2]])
  assert.equal(perf[0].ganho, 2)
  assert.ok(perf[1].ganho >= 2, 'o segundo vale mais (x2), até o teto')
  assert.equal(p.energiaNaTela, ENERGIA.maxima)
  assert.ok(ONDA_MS * ONDAS > 10000)
  assert.equal(p.resultados[0], 'feita')
})

test('carregar: um acerto quebra o combo e recomeça o passo do começo (energia de volta ao inicial)', () => {
  const p = noPasso(null)
  p.avancar()
  const ev = rodar(p, 40000, parado, (q) => q.etapa === 'errou')
  assert.equal(p.etapa, 'errou')
  assert.ok(ev.some((e) => e.tipo === 'quebrou'))
  assert.equal(p.falhas[0], 1)
  p.avancar()
  assert.equal(p.etapa, 'preparar')
  assert.equal(p.energiaNaTela, ENERGIA_INICIAL_P9, 'recomeça com a mesa nova')
  assert.equal(p.hud.combo, '')
})

test('jogar o ★: só com 10 de energia; o Ás ensina a esperar; o ★ paga tudo e conclui o passo', () => {
  const p = noPasso(['feita', null, null])
  assert.equal(p.passoAtual.id, 'super')
  assert.deepEqual(p.slots, SLOTS_SUPER)
  assert.equal(p.energiaNaTela, ENERGIA.maxima)
  p.avancar() // explicar -> escolher
  assert.equal(p.etapa, 'escolher')
  p.avancar() // o primeiro slot é o Ás de espadas
  const ev = p.drenar()
  assert.equal(p.etapa, 'errou')
  assert.ok(ev.some((e) => e.tipo === 'escolheu' && !e.certo))
  assert.equal(p.energiaNaTela, ENERGIA.maxima, 'errar não gasta nada')
  p.avancar() // errou -> escolher
  assert.equal(p.mover('direita'), true)
  assert.equal(p.mover('direita'), false)
  p.avancar()
  assert.equal(p.etapa, 'disparando')
  assert.equal(p.energiaNaTela, 0, 'o ★ pagou as 10 gemas')
  assert.equal(p.jogada.gasto, SUPER.custo)
  rodar(p, 5000, parado, (q) => q.etapa === 'acertou')
  assert.equal(p.etapa, 'acertou')
  assert.equal(p.resultados[1], 'feita')
  assert.ok(p.fala.includes('SUPER'))
})

test('os quatro Ases: só o de ouros (Anular) cancela; cada erro diz o que aquele Ás faz', () => {
  const p = noPasso(['feita', 'feita', null])
  assert.equal(p.passoAtual.id, 'ases')
  assert.deepEqual(p.slots, [AS_ESPADAS, AS_COPAS, AS_OUROS, AS_PAUS])
  p.avancar()
  const fala = {}
  for (const [k, id] of p.slots.entries()) {
    if (id === AS_OUROS) continue
    while (p.cursor < k) p.mover('direita')
    while (p.cursor > k) p.mover('esquerda')
    p.avancar()
    fala[id] = p.fala
    if (p.etapa === 'errou') p.avancar()
    else if (p.etapa === 'ajuda') break
  }
  assert.ok(fala[AS_ESPADAS].includes('Espelho') && fala[AS_ESPADAS].includes('DEVOLVE'))
  assert.ok(fala[AS_COPAS].includes('Segunda chance'))
  assert.ok(fala[AS_PAUS].includes('Tudo bem errar'), 'no 3º erro entra a ajuda')
  assert.equal(p.etapa, 'ajuda', '3 erros: a ajuda')
  p.avancar() // tentar de novo
  assert.equal(p.etapa, 'escolher')
  while (p.cursor < 2) p.mover('direita')
  p.avancar()
  assert.equal(p.etapa, 'acertou')
  assert.ok(p.fala.includes('Anular') && p.fala.includes('Espelho') && p.fala.includes('Roubo') && p.fala.includes('Segunda chance'))
  p.avancar()
  assert.equal(p.etapa, 'concluida')
  assert.equal(p.fala, TEXTOS9.concluida)
})

test('pular a ajuda dos Ases conta como pulada e a página ainda fecha (convida a voltar)', () => {
  const p = noPasso(['feita', 'feita', null])
  p.avancar()
  for (let i = 0; i < 3; i++) {
    p.avancar() // a carta sob o cursor (Ás de espadas) está errada
    if (p.etapa === 'errou') p.avancar()
  }
  assert.equal(p.etapa, 'ajuda')
  p.mover('baixo')
  p.avancar()
  assert.equal(p.resultados[2], 'pulada')
  assert.equal(p.etapa, 'concluida')
  assert.equal(p.fala, TEXTOS9.concluidaPulou)
  assert.equal(p.completa, true)
})

test('a última página não tem próxima: depois de virar vem o fim com a despedida', () => {
  const p = noPasso(['feita', 'feita', null])
  p.avancar()
  while (p.cursor < 2) p.mover('direita')
  p.avancar()
  p.avancar()
  assert.equal(p.etapa, 'concluida')
  p.avancar()
  assert.equal(p.etapa, 'virando')
  p.terminouDeVirar()
  assert.equal(p.etapa, 'fim')
  assert.equal(p.fala, TEXTOS9.fim)
})
