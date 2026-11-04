// node --test src/game/manual/__tests__/pagina4.test.js
// Página 4 ("Nem toda rodada pede ataque"): energia, custo e PASSAR com as regras reais.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarPagina4, PASSOS4, FALAS_INTRO4, TEXTOS4, SLOTS4 } from '../pagina4.js'
import { MAO_P4, CARA_P4, ENERGIA_P4, cartaDoManual } from '../cartasDoManual.js'
import { PASSAR, VIVA_MS, VITRINE_MS, ENCHER_MS, ENCHE_PASSAR_MS, ENCHE_RODADA_MS, ERROS_PARA_AJUDA } from '../licaoDeCartas.js'
import { TOTAL_PASSOS } from '../progresso.js'
import { ENERGIA } from '../../pvp/regras.js'

const rodar = (p, ms) => {
  for (let t = 0; t < ms; t += 16) p.tick(16)
}
const passarIntro = (p) => {
  while (p.etapa === 'intro') p.avancar()
}
const irAte = (p, id) => {
  const slot = SLOTS4.indexOf(id)
  while (p.cursor < slot) p.mover('direita')
  while (p.cursor > slot) p.mover('esquerda')
}
const eventos = (p, tipo) => p.drenar().filter((e) => e.tipo === tipo)
const confirmar = (p, id) => {
  irAte(p, id)
  assert.equal(p.etapa, 'escolher')
  p.avancar()
}
const CARA = cartaDoManual(CARA_P4)
const SUPER = MAO_P4[2]
const BARATA = MAO_P4[0]

test('fluxo completo: caro (bloqueada) -> passar (gemas enchem) -> jogar (paga e ataca) -> concluida', () => {
  const p = criarPagina4()
  assert.equal(p.fala, FALAS_INTRO4[0])
  assert.equal(p.slots.at(-1), PASSAR, 'PASSAR fica no fim da mão, como na arena')
  assert.equal(TOTAL_PASSOS[4], PASSOS4.length)
  passarIntro(p)
  assert.equal(p.energiaNaTela, ENERGIA_P4)
  // 1. a carta cara: bloqueada pela regra real, com a pílula
  assert.deepEqual(p.bloqueioDe(SLOTS4.indexOf(CARA_P4))?.curto, `falta energia (${ENERGIA_P4}/${CARA.custo})`)
  assert.equal(p.bloqueioDe(SLOTS4.indexOf(BARATA)), null)
  assert.equal(p.bloqueioDe(SLOTS4.indexOf(PASSAR)), null, 'passar sempre pode')
  p.drenar()
  confirmar(p, CARA_P4)
  const [n] = eventos(p, 'negada')
  assert.equal(n.bloqueio.codigo, 'sem-energia')
  assert.equal(p.etapa, 'acertou')
  assert.equal(p.bloqueio.curto, 'falta energia (2/3)')
  assert.match(p.fala, /custa 3 e você só tem 2/)
  assert.equal(p.mesa.energia, ENERGIA_P4, 'tentar não gasta nada')
  p.avancar()
  // 2. passar: +ENERGIA.passar na hora e +ENERGIA.porRodada na rodada nova
  assert.equal(p.passo, 1)
  confirmar(p, PASSAR)
  assert.equal(p.etapa, 'enchendo')
  const [ps] = eventos(p, 'passou')
  assert.deepEqual([ps.passe.antes, ps.passe.depoisDePassar, ps.passe.depois], [2, 2 + ENERGIA.passar, 2 + ENERGIA.passar + ENERGIA.porRodada])
  assert.equal(p.energiaNaTela, 2, 'as gemas acendem aos poucos')
  rodar(p, ENCHE_PASSAR_MS + 16)
  assert.equal(p.energiaNaTela, 3)
  rodar(p, ENCHE_RODADA_MS - ENCHE_PASSAR_MS)
  assert.equal(p.energiaNaTela, 5)
  rodar(p, ENCHER_MS)
  assert.equal(p.etapa, 'acertou')
  assert.equal(p.fala, 'Agora você tem 5! Passar também é uma jogada.')
  p.avancar()
  // 3. agora o Coro cabe; o SUPER continua bloqueado
  assert.equal(p.passo, 2)
  assert.match(p.fala, /Agora você tem 5/)
  assert.equal(p.bloqueioDe(SLOTS4.indexOf(CARA_P4)), null)
  assert.equal(p.bloqueioDe(SLOTS4.indexOf(SUPER)).curto, 'falta energia (5/10)')
  confirmar(p, CARA_P4)
  assert.equal(p.etapa, 'atacando')
  const [j] = eventos(p, 'jogou')
  assert.equal(j.carta.id, CARA_P4)
  assert.equal(j.gasto, CARA.custo)
  assert.equal(p.mesa.energia, 5 - CARA.custo)
  assert.equal(p.energiaNaTela, 5, 'a gema só apaga quando a carta ganha vida')
  rodar(p, VIVA_MS)
  assert.equal(p.energiaNaTela, 2)
  rodar(p, VITRINE_MS + 20)
  assert.equal(p.etapa, 'acertou')
  p.avancar()
  assert.equal(p.etapa, 'concluida')
  assert.equal(p.fala, TEXTOS4.concluida)
  assert.deepEqual(p.resultados, ['feita', 'feita', 'feita'])
})

test('erros curtinhos em cada passo (a carta que dá, o SUPER, PASSAR fora de hora) não gastam nada', () => {
  const p = criarPagina4()
  passarIntro(p)
  confirmar(p, BARATA)
  assert.equal(p.etapa, 'errou')
  assert.match(p.fala, /custa 1, então dá/)
  p.avancar()
  confirmar(p, PASSAR)
  assert.equal(p.etapa, 'errou')
  assert.match(p.fala, /Ainda não/)
  assert.equal(p.mesa.energia, ENERGIA_P4, 'PASSAR fora de hora não passa de verdade')
  p.avancar()
  // o SUPER também está bloqueado: vale como "tentou a cara"
  confirmar(p, SUPER)
  assert.equal(p.etapa, 'acertou')
  assert.equal(p.bloqueio.curto, 'falta energia (2/10)')
  p.avancar()
  confirmar(p, CARA_P4)
  assert.equal(p.etapa, 'errou')
  assert.equal(p.bloqueio.curto, 'falta energia (2/3)', 'a pílula aparece também no erro')
  p.avancar()
  assert.equal(p.bloqueio, null)
  confirmar(p, BARATA)
  assert.equal(p.etapa, 'errou')
  assert.match(p.fala, /juntar energia/)
  p.avancar()
  confirmar(p, PASSAR)
  rodar(p, ENCHER_MS + 20)
  p.avancar()
  for (const [id, fala] of [[SUPER, /O ★ custa 10/], [BARATA, /Essa também dá/]]) {
    confirmar(p, id)
    assert.match(p.fala, fala, id)
    assert.equal(p.mesa.energia, 5, `${id}: nada pago`)
    p.avancar()
  }
  assert.match(PASSOS4[2].avaliar(PASSAR, { mesa: p.mesa }).fala, /já dá para jogar/)
  confirmar(p, PASSAR)
  assert.equal(p.mesa.energia, 5)
  assert.equal(p.etapa, 'ajuda', `${ERROS_PARA_AJUDA} erros no mesmo passo`)
})

test('pular o PASSAR: o Ralsei passa por você (a energia do próximo passo continua certa)', () => {
  const p = criarPagina4({ passos: ['feita', null, null] })
  passarIntro(p)
  assert.equal(p.passo, 1)
  for (let k = 0; k < ERROS_PARA_AJUDA; k++) {
    confirmar(p, BARATA)
    if (p.etapa === 'errou') p.avancar()
  }
  assert.equal(p.etapa, 'ajuda')
  p.mover('baixo')
  p.mover('baixo')
  p.avancar()
  assert.equal(p.passo, 2)
  assert.equal(p.mesa.energia, 5)
  assert.equal(p.resultados[1], 'pulada')
})

test('retomar no último passo: a mesa já passou (energia 5)', () => {
  const p = criarPagina4({ passos: ['feita', 'feita', null] })
  assert.equal(p.passo, 2)
  assert.equal(p.mesa.energia, ENERGIA_P4 + ENERGIA.passar + ENERGIA.porRodada)
  passarIntro(p)
  assert.match(p.fala, /Agora você tem 5/)
})

test('a demonstração aponta o PASSAR no fim da mão', () => {
  const p = criarPagina4({ passos: ['feita', null, null] })
  passarIntro(p)
  for (let k = 0; k < ERROS_PARA_AJUDA; k++) {
    confirmar(p, BARATA)
    if (p.etapa === 'errou') p.avancar()
  }
  p.mover('baixo')
  p.avancar()
  assert.equal(p.etapa, 'demo')
  rodar(p, 3000)
  assert.equal(p.etapa, 'escolher')
  assert.equal(PASSOS4[1].certo, PASSAR)
})
