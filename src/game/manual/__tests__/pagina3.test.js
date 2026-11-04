// node --test src/game/manual/__tests__/pagina3.test.js
// Página 3 ("Sua primeira carta") e a máquina das páginas de cartas (manual/licaoDeCartas.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarPagina3, PASSOS3, FALAS_INTRO3, SOBRE_A_CARTA, TEXTOS3 } from '../pagina3.js'
import { MAO_P3, CHUVA_P3 } from '../cartasDoManual.js'
import { TOTAL_PASSOS } from '../progresso.js'
import { VIVA_MS, VITRINE_MS, PULAR_VITRINE_MS, ERROU_MS, ACERTOU_MS, ERROS_PARA_AJUDA, DEMO_FIM_MS, DEMO_PASSO_MS, FALA_AJUDA, FALA_VOLTA, OPCOES_AJUDA, ETAPAS_CARTAS, expressaoDasCartas } from '../licaoDeCartas.js'
import { EXPRESSOES } from '../ralsei.js'
import { dicasDeBotoes, teclasDoEixo } from '../botoes.js'
import { TECLAS_PADRAO } from '../../teclas.js'

const rodar = (p, ms) => {
  for (let t = 0; t < ms; t += 16) p.tick(16)
}
const passarIntro = (p) => {
  while (p.etapa === 'intro') p.avancar()
}
const irAte = (p, slot) => {
  while (p.cursor < slot) p.mover('direita')
  while (p.cursor > slot) p.mover('esquerda')
}
const eventos = (p, tipo) => p.drenar().filter((e) => e.tipo === tipo)
// confirma a carta do slot e espera o ataque acabar
function jogar(p, slot) {
  irAte(p, slot)
  assert.equal(p.etapa, 'escolher')
  p.avancar()
  assert.equal(p.etapa, 'atacando')
  rodar(p, VIVA_MS + VITRINE_MS + 20)
}

test('fluxo completo: intro -> conhecer (qualquer carta) -> chuva (a certa) -> concluida -> virando -> fim', () => {
  const p = criarPagina3()
  assert.equal(p.etapa, 'intro')
  assert.equal(p.fala, FALAS_INTRO3[0])
  passarIntro(p)
  assert.equal(p.etapa, 'escolher')
  assert.equal(p.fala, PASSOS3[0].instrucao)
  p.drenar()
  jogar(p, 2)
  assert.equal(p.etapa, 'acertou')
  assert.equal(p.fala, PASSOS3[0].acertou)
  assert.deepEqual(eventos(p, 'passo').map((e) => [e.indice, e.resultado]), [[0, 'feita']])
  rodar(p, ACERTOU_MS + 20)
  assert.equal(p.etapa, 'escolher')
  assert.equal(p.passo, 1)
  assert.match(p.fala, /CHOVER/)
  jogar(p, MAO_P3.indexOf(CHUVA_P3))
  assert.equal(p.etapa, 'acertou')
  p.avancar()
  assert.equal(p.etapa, 'concluida')
  assert.equal(p.fala, TEXTOS3.concluida)
  assert.deepEqual(p.resultados, ['feita', 'feita'])
  assert.equal(p.adesivos, 2)
  p.avancar()
  assert.equal(p.etapa, 'virando')
  p.terminouDeVirar()
  assert.equal(p.etapa, 'fim')
  assert.equal(TOTAL_PASSOS[3], PASSOS3.length, 'progresso.js sabe quantos passos a página tem')
})

test('a carta jogada vira a jogada real (evento "jogou" com a caixa da arena) e o ataque roda VITRINE_MS', () => {
  const p = criarPagina3()
  passarIntro(p)
  p.drenar()
  irAte(p, 1)
  p.avancar()
  const [j] = eventos(p, 'jogou')
  assert.equal(j.slot, 1)
  assert.equal(j.carta.id, MAO_P3[1])
  assert.equal(j.caixa.carta.id, MAO_P3[1])
  assert.ok(j.caixa.dano > 0)
  assert.equal(p.fala, SOBRE_A_CARTA[MAO_P3[1]].viva)
  // A não pula o ataque logo de cara (dá tempo de ver), só depois de PULAR_VITRINE_MS
  assert.equal(p.avancar(), false)
  rodar(p, PULAR_VITRINE_MS + 20)
  assert.ok(p.vivaFase === 1)
  assert.equal(p.avancar(), true)
  assert.equal(p.etapa, 'acertou')
  // a mesa da página 3 não gasta energia de verdade (energia ainda não é o assunto)
  assert.equal(p.mesa.energia, 10)
})

test('←/→ andam pela mão sem dar a volta; fora do "escolher" nada mexe', () => {
  const p = criarPagina3()
  assert.equal(p.mover('direita'), false, 'na intro a mão não mexe')
  passarIntro(p)
  assert.equal(p.mover('esquerda'), false)
  assert.equal(p.mover('direita'), true)
  assert.equal(p.mover('direita'), true)
  assert.equal(p.mover('direita'), false)
  assert.equal(p.cursor, 2)
  assert.equal(p.mover('cima'), false)
  assert.equal(p.slotAtual, MAO_P3[2])
})

test('chuva: a carta errada também ataca (de verdade), e o Ralsei diz o que ela faz; volta a escolher', () => {
  const p = criarPagina3({ passos: ['feita', null] })
  passarIntro(p)
  assert.equal(p.passo, 1)
  const errada = MAO_P3.findIndex((id) => id !== CHUVA_P3)
  p.drenar()
  jogar(p, errada)
  assert.equal(p.etapa, 'errou')
  assert.equal(p.fala, SOBRE_A_CARTA[MAO_P3[errada]].errou)
  assert.equal(eventos(p, 'jogou').length, 1)
  assert.equal(p.falhas[1], 1)
  rodar(p, ERROU_MS + 20)
  assert.equal(p.etapa, 'escolher')
  assert.equal(p.cursor, errada, 'o cursor fica onde estava')
})

test('3 erros: ajuda (tentar de novo | ver o Ralsei mostrar | pular esta parte), com ↑/↓', () => {
  const p = criarPagina3({ passos: ['feita', null] })
  passarIntro(p)
  const errada = MAO_P3.findIndex((id) => id !== CHUVA_P3)
  for (let k = 0; k < ERROS_PARA_AJUDA; k++) {
    jogar(p, errada)
    if (k < ERROS_PARA_AJUDA - 1) p.avancar() // errou -> escolher (A)
  }
  assert.equal(p.etapa, 'ajuda')
  assert.equal(p.fala, FALA_AJUDA)
  assert.equal(OPCOES_AJUDA.length, 3)
  assert.equal(p.mover('cima'), false)
  assert.equal(p.mover('baixo'), true)
  assert.equal(p.opcao, 1)
  // a demonstração: o coraçãozinho do Ralsei anda do cursor até a carta certa e volta a escolher
  p.avancar()
  assert.equal(p.etapa, 'demo')
  assert.equal(p.fala, PASSOS3[1].demo)
  const alvo = MAO_P3.indexOf(CHUVA_P3)
  rodar(p, Math.abs(alvo - errada) * DEMO_PASSO_MS + 20)
  assert.equal(p.demoCursor, alvo)
  rodar(p, DEMO_FIM_MS)
  assert.equal(p.etapa, 'escolher')
  assert.equal(p.demoCursor, null)
  assert.equal(p.cursor, errada, 'a demonstração não escolhe pelo jogador')
  // mais um erro: ajuda de novo; agora pular
  jogar(p, errada)
  assert.equal(p.etapa, 'ajuda')
  p.mover('baixo')
  p.mover('baixo')
  p.drenar()
  p.avancar()
  assert.deepEqual(eventos(p, 'passo').map((e) => [e.indice, e.resultado]), [[1, 'pulada']])
  assert.equal(p.etapa, 'concluida')
  assert.equal(p.fala, TEXTOS3.concluidaPulou)
  assert.equal(p.completa, true)
  assert.equal(p.adesivos, 1)
})

test('ajuda: "tentar de novo" volta a escolher; A pula a demonstração', () => {
  const p = criarPagina3({ passos: ['feita', null] })
  passarIntro(p)
  for (let k = 0; k < ERROS_PARA_AJUDA; k++) {
    jogar(p, 1)
    if (p.etapa === 'errou') p.avancar()
  }
  assert.equal(p.etapa, 'ajuda')
  p.avancar()
  assert.equal(p.etapa, 'escolher')
  jogar(p, 1)
  p.mover('baixo')
  p.avancar()
  assert.equal(p.etapa, 'demo')
  p.avancar()
  assert.equal(p.etapa, 'escolher')
})

test('retomar: começa no primeiro passo que falta, com a fala de volta; completa recomeça do zero', () => {
  const p = criarPagina3({ passos: ['feita', null] })
  assert.deepEqual(p.falas, [FALA_VOLTA])
  passarIntro(p)
  assert.equal(p.passo, 1)
  assert.equal(criarPagina3({ passos: ['feita', 'feita'] }).passo, 0)
  assert.equal(criarPagina3({ passos: 'lixo' }).passo, 0)
})

test('a cara do Ralsei e as dicas por controle', () => {
  for (const e of ETAPAS_CARTAS) assert.ok(EXPRESSOES.includes(expressaoDasCartas(e)), e)
  assert.equal(expressaoDasCartas('errou'), 'incentivo')
  assert.equal(expressaoDasCartas('ajuda'), 'incentivo')
  assert.equal(expressaoDasCartas('atacando'), 'animado')
  assert.equal(expressaoDasCartas('escolher', { tipo: 'marca', ha: 100 }), 'animado')
  const teclado = dicasDeBotoes('teclado', TECLAS_PADRAO)
  assert.equal(teclasDoEixo(teclado), `${teclado.mover[1]} ${teclado.mover[3]}`)
  assert.equal(teclasDoEixo(teclado, 'vertical'), `${teclado.mover[0]} ${teclado.mover[2]}`)
  assert.equal(teclasDoEixo(dicasDeBotoes('gamepad')), '← →')
  assert.equal(teclasDoEixo(dicasDeBotoes('serial'), 'vertical'), '↑ ↓')
})
