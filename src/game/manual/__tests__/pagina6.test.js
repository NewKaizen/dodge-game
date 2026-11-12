// node --test src/game/manual/__tests__/pagina6.test.js
// Página 6 (extra), "Os quatro naipes": uma carta de cada naipe do baralho do Ralsei, cada uma com o ataque REAL dela,
// e a pergunta do CO-OP. Mesma máquina das páginas 3 e 4 (manual/licaoDeCartas.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarPagina6, PASSOS6, FALAS_INTRO6, TEXTOS6 } from '../pagina6.js'
import { MAO_P6, ESPADAS_P6, COPAS_P6, OUROS_P6, PAUS_P6, cartaDoManual, DESENHO_DA_CARTA, planoDaVitrine } from '../cartasDoManual.js'
import { VIVA_MS, VITRINE_MS, ERROS_PARA_AJUDA } from '../licaoDeCartas.js'
import { TOTAL_PASSOS } from '../progresso.js'
import { ataques } from '../../attacks/index.js'

const rodar = (p, ms) => {
  for (let t = 0; t < ms; t += 16) p.tick(16)
}
const ir = (p, id) => {
  const slot = p.slots.indexOf(id)
  while (p.cursor < slot) p.mover('direita')
  while (p.cursor > slot) p.mover('esquerda')
}
const jogar = (p, id) => {
  ir(p, id)
  assert.equal(p.etapa, 'escolher')
  p.avancar()
}
const tudo = (p) => {
  rodar(p, VIVA_MS + VITRINE_MS + 100)
  return p.drenar()
}

test('uma carta de cada naipe do baralho do Ralsei (de verdade), e cada passo tem o seu adesivo', () => {
  assert.deepEqual(MAO_P6.map((id) => cartaDoManual(id).naipe), ['espadas', 'copas', 'ouros', 'paus'])
  assert.equal(TOTAL_PASSOS[6], PASSOS6.length)
  assert.deepEqual(PASSOS6.map((x) => x.id), ['espadas', 'ouros', 'paus', 'copas', 'coop'])
  for (const id of MAO_P6) assert.ok(DESENHO_DA_CARTA[id], `desenho de ${id}`)
  assert.equal(cartaDoManual(COPAS_P6).descricao.includes('cura 7 HP'), true, 'a fala do chá (cura 7) vem do texto do jogo')
})

test('fluxo: 5 passos (os 4 naipes no PVP e o CO-OP), cada acerto ataca de verdade e vira adesivo', () => {
  const p = criarPagina6()
  assert.equal(p.fala, FALAS_INTRO6[0])
  while (p.etapa === 'intro') p.avancar()
  assert.equal(p.etapa, 'escolher')
  for (const [k, id] of [ESPADAS_P6, OUROS_P6, PAUS_P6, COPAS_P6, OUROS_P6].entries()) {
    assert.equal(p.passo, k)
    jogar(p, id)
    assert.equal(p.etapa, 'atacando', `passo ${k}: a carta ganha vida`)
    const ev = tudo(p)
    assert.ok(ev.some((e) => e.tipo === 'passo' && e.resultado === 'feita'))
    assert.equal(p.etapa, 'acertou')
    p.avancar()
  }
  assert.equal(p.etapa, 'concluida')
  assert.equal(p.adesivos, 5)
  assert.equal(p.fala, TEXTOS6.concluida)
  p.avancar()
  assert.equal(p.etapa, 'virando')
  p.terminouDeVirar()
  assert.equal(p.fala, TEXTOS6.fim)
})

test('carta de outro naipe: só a fala (diz qual procurar), nada é gasto e 3 erros abrem a ajuda', () => {
  const p = criarPagina6()
  while (p.etapa === 'intro') p.avancar()
  const energia = p.mesa.energia
  jogar(p, OUROS_P6)
  assert.equal(p.etapa, 'errou')
  assert.match(p.fala, /ESPADAS/)
  assert.equal(p.mesa.energia, energia)
  p.avancar()
  jogar(p, COPAS_P6)
  p.avancar()
  jogar(p, PAUS_P6)
  assert.equal(p.etapa, 'ajuda')
  assert.equal(p.falhas[0], ERROS_PARA_AJUDA)
  p.mover('baixo')
  p.mover('baixo')
  p.avancar()
  assert.equal(p.resultados[0], 'pulada')
  assert.equal(p.passo, 1)
})

test('CO-OP: cada naipe errado explica o que ele faz no CO-OP; ♦ acerta (atrasa o ataque do chefe)', () => {
  const p = criarPagina6()
  p.passo = 4
  p.avancar()
  while (p.etapa === 'intro') p.avancar()
  assert.equal(p.passoAtual.id, 'coop')
  jogar(p, ESPADAS_P6)
  assert.match(p.fala, /golpe forte/)
  p.avancar()
  jogar(p, COPAS_P6)
  assert.match(p.fala, /DOIS/)
  p.avancar()
  jogar(p, OUROS_P6)
  assert.equal(p.etapa, 'atacando')
  assert.match(p.fala, /15% mais lento/)
})

test('o ataque de cada carta é o real (ataqueDaCarta) e o ♠ cai de cima (a Estrela Gentil)', () => {
  for (const id of MAO_P6) {
    const c = cartaDoManual(id)
    const plano = planoDaVitrine({ carta: c, dano: 5, ritmo: 1 }, ataques)
    assert.equal(plano.carta.id, id)
    assert.ok(plano.ataque !== undefined)
  }
})

test('retomar: pelo meio do caderno volta ao passo que falta', () => {
  const p = criarPagina6({ passos: ['feita', 'feita', null, null, null] })
  assert.equal(p.passo, 2)
  assert.equal(p.adesivos, 2)
  assert.match(p.fala, /voltou/)
})
