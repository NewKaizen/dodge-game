// node --test src/game/manual/__tests__/exercicio.test.js
// A máquina genérica das páginas extras (manual/exercicio.js) com passos de brinquedo: o fluxo, o tempo esgotado,
// a ajuda, o pular, o retomar e que nada depende do Phaser.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarExercicio, coracaoNovo, ETAPAS_EXERCICIO, ERROS_PARA_AJUDA, PREPARO_MS, RETRY_MS, ACERTOU_MS, FALA_VOLTA, OPCOES_AJUDA, expressaoDoExercicio } from '../exercicio.js'
import { CORACAO } from '../../constants.js'

const CAIXA = { esquerda: 440, direita: 780, topo: 148, base: 348 }

// um desafio de brinquedo: levar o coração para a direita (x >= 700); ficar parado estoura o tempo
const IR_PARA_A_DIREITA = {
  id: 'direita',
  tipo: 'desafio',
  duracao: 3000,
  explicar: 'vá para a direita',
  tentar: 'vá!',
  errou: ['de novo A', 'de novo B'],
  errouTempo: 'o tempo acabou',
  acertou: ({ t }) => `chegou aos ${Math.round(t.tempo)} ms`,
  iniciar: () => ({ alvos: [coracaoNovo(0, 500, 248, { humano: 0 })], roteiro: null, hud: { contador: '0' } }),
  aoPassar: (t) => (t.alvos[0].x >= 700 ? 'vitoria' : undefined),
}
const ESCOLHER_B = {
  id: 'b',
  tipo: 'escolha',
  slots: ['a', 'b', 'c'],
  explicar: 'olhe',
  instrucao: 'escolha b',
  errou: ['não é essa'],
  avaliar: (id) => (id === 'b' ? { certo: true, fala: 'isso!' } : { certo: false, fala: `${id} não` }),
}
const TEXTOS = { concluida: 'tudo!', concluidaPulou: 'quase tudo', fim: 'fim' }
const nova = (op = {}) => criarExercicio({ caixa: CAIXA, passos: [IR_PARA_A_DIREITA, ESCOLHER_B], falasIntro: ['oi', 'tchau'], textos: TEXTOS, ...op })
const rodar = (p, ms, joy = { x: 0, y: 0 }) => {
  for (let t = 0; t < ms; t += 16) p.tick(16, [joy])
}

test('as etapas existem e a expressão do Ralsei nunca quebra', () => {
  for (const e of ETAPAS_EXERCICIO) assert.ok(['feliz', 'concentrado', 'surpreso', 'incentivo', 'animado'].includes(expressaoDoExercicio(e)), e)
  assert.equal(expressaoDoExercicio('errou'), 'incentivo')
  assert.equal(expressaoDoExercicio('tentar'), 'concentrado')
  assert.equal(expressaoDoExercicio('acertou'), 'animado')
})

test('fluxo: intro -> explicar -> preparar -> tentar -> acertou -> (escolha) -> concluida -> virando -> fim', () => {
  const p = nova()
  assert.equal(p.fala, 'oi')
  p.avancar()
  assert.equal(p.fala, 'tchau')
  p.avancar()
  assert.equal(p.etapa, 'explicar')
  assert.equal(p.fala, 'vá para a direita')
  assert.equal(p.alvos.length, 1, 'o desafio já mostra o coração enquanto explica')
  p.avancar()
  assert.equal(p.etapa, 'preparar')
  rodar(p, PREPARO_MS + 16)
  assert.equal(p.etapa, 'tentar')
  rodar(p, 2000, { x: 100, y: 0 })
  assert.equal(p.etapa, 'acertou')
  assert.match(p.fala, /chegou aos \d+ ms/)
  assert.equal(p.progressoDaTentativa, 1)
  rodar(p, ACERTOU_MS + 16)
  assert.equal(p.passoAtual.id, 'b')
  assert.equal(p.etapa, 'explicar')
  assert.equal(p.alvos.length, 0, 'sem desafio, sem corações')
  p.avancar()
  assert.equal(p.etapa, 'escolher')
  p.avancar() // o slot 0 ('a') está errado
  assert.equal(p.etapa, 'errou')
  p.avancar()
  p.mover('direita')
  p.avancar()
  assert.equal(p.etapa, 'acertou')
  p.avancar()
  assert.equal(p.etapa, 'concluida')
  assert.equal(p.fala, 'tudo!')
  p.avancar()
  p.terminouDeVirar()
  assert.equal(p.etapa, 'fim')
  assert.equal(p.fala, 'fim')
})

test('tempo esgotado sem a meta conta como erro (com a fala do tempo) e recomeça igual', () => {
  const p = nova()
  while (p.etapa !== 'explicar') p.avancar()
  p.avancar()
  rodar(p, PREPARO_MS + 3000 + 200)
  assert.equal(p.etapa, 'errou')
  assert.equal(p.fala, 'o tempo acabou')
  assert.equal(p.falhas[0], 1)
  rodar(p, RETRY_MS + 16)
  assert.equal(p.etapa, 'preparar', 'recomeça sozinho depois de um instante')
})

test(`${ERROS_PARA_AJUDA} erros: ajuda com ↑/↓; "tentar de novo" volta, "pular" resolve o passo como pulada`, () => {
  const p = nova()
  while (p.etapa !== 'explicar') p.avancar()
  p.avancar()
  for (let k = 0; k < ERROS_PARA_AJUDA; k++) {
    rodar(p, PREPARO_MS + 3100)
    if (k < ERROS_PARA_AJUDA - 1) {
      assert.equal(p.etapa, 'errou')
      p.avancar()
    }
  }
  assert.equal(p.etapa, 'ajuda')
  assert.equal(p.opcao, 0)
  assert.equal(p.mover('cima'), false)
  assert.equal(p.mover('baixo'), true)
  assert.equal(OPCOES_AJUDA[p.opcao], 'pular esta parte')
  p.drenar()
  p.avancar()
  assert.equal(p.resultados[0], 'pulada')
  assert.deepEqual(p.drenar().find((e) => e.tipo === 'passo'), { tipo: 'passo', indice: 0, resultado: 'pulada' })
  assert.equal(p.passoAtual.id, 'b')
})

test('retomar: o salvo pela metade recomeça no passo que falta (boas-vindas); tudo resolvido não retoma', () => {
  const p = nova({ salvos: ['feita', null] })
  assert.equal(p.fala, FALA_VOLTA)
  p.avancar()
  assert.equal(p.passoAtual.id, 'b')
  assert.equal(p.adesivos, 1)
  const t = nova({ salvos: ['feita', 'pulada'] })
  assert.equal(t.passo, 0, 'completa: recomeça do zero (a cena zera o salvo de uma página completa)')
  assert.equal(t.fala, 'oi')
  const lixo = nova({ salvos: ['x', 3] })
  assert.deepEqual(lixo.resultados, [null, null])
})

test('dt grande não pula o jogo (o quadro é limitado) e o coração é o do jogo (hitbox e graze)', () => {
  const p = nova()
  while (p.etapa !== 'explicar') p.avancar()
  const a = p.alvos[0]
  assert.equal(a.hitbox, CORACAO.hitbox)
  assert.equal(a.graze, CORACAO.graze)
  p.avancar()
  p.tick(5000, [{ x: 100, y: 0 }])
  assert.equal(p.etapa, 'preparar', 'um quadro de 5 s vale 50 ms')
  assert.ok(a.x < 520)
})
