// node --test src/game/grimorio/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { definirAtaque, juntos, sequencia, comCaixa } from '../../attacks/definir.js'
import { PAGINAS, cartasDaPagina, gruposDaPagina, tituloDaPagina, fichaDaCarta, previaDaCarta } from '../fichas.js'
import { CARTAS, PERSONAGENS_PVP, ehSuper } from '../../pvp/cartas.js'
import { CARTAS_CHEFES } from '../../coop/cartasChefe.js'
import { ORDEM_CHEFES } from '../../coop/chefes/index.js'

// biblioteca falsa com a forma de attacks/index.js (como em pvp/__tests__/cartas.test.js)
const falso = (nome) => {
  const padrao = definirAtaque({ nome, padrao: {}, iniciar() {} })
  return (cfg = {}) => padrao(cfg)
}
const A = new Proxy({ juntos, sequencia, comCaixa }, { get: (alvo, nome) => (nome in alvo || typeof nome !== 'string' ? alvo[nome] : (alvo[nome] = falso(nome))) })

test('as páginas são os personagens do PvP e os chefes do CO-OP, nessa ordem', () => {
  assert.deepEqual(
    PAGINAS.map((p) => p.id),
    [...PERSONAGENS_PVP, ...ORDEM_CHEFES],
  )
  for (const p of PAGINAS) assert.ok(tituloDaPagina(p).nome)
})

test('cada página traz todas as cartas, uma vez só, com o SUPER no fim', () => {
  for (const p of PAGINAS) {
    const cartas = cartasDaPagina(p)
    const esperadas = p.tipo === 'chefe' ? CARTAS_CHEFES[p.id].fases.flat().length + 1 : CARTAS[p.id].length
    assert.equal(cartas.length, esperadas, p.id)
    assert.equal(new Set(cartas.map((c) => c.id)).size, cartas.length, `${p.id}: id repetido`)
    assert.ok(ehSuper(cartas[cartas.length - 1]), `${p.id}: SUPER no fim`)
    // grupos cobrem tudo, em sequência
    const grupos = gruposDaPagina(p)
    assert.equal(grupos[0].inicio, 0)
    assert.equal(grupos[grupos.length - 1].fim, cartas.length - 1)
    for (let k = 1; k < grupos.length; k++) assert.equal(grupos[k].inicio, grupos[k - 1].fim + 1)
  }
})

test('toda carta tem ficha com textos e uma prévia montável (ou o motivo de não ter)', () => {
  for (const p of PAGINAS) {
    for (const carta of cartasDaPagina(p)) {
      const ficha = fichaDaCarta(carta)
      assert.ok(ficha.tipo, carta.id)
      assert.ok(ficha.numeros.length >= 1, carta.id)
      assert.equal(ficha.textos.length, 2, carta.id)
      for (const t of ficha.textos) assert.ok(t.texto.length > 10, `${carta.id}: ${t.titulo}`)
      const previa = previaDaCarta(carta, A)
      if (previa.semAtaque) {
        assert.equal(carta.valor, 1, `${carta.id}: só o Ás de copas fica sem ataque`)
        assert.equal(carta.naipe, 'copas')
        continue
      }
      const ataque = previa.criar()
      assert.ok(ataque.duracao > 0, carta.id)
      assert.ok(previa.dano > 0, carta.id)
      assert.ok(previa.velocidadeMax > 0 && previa.ritmo.velocidade > 0, carta.id)
      assert.ok(previa.rotulo, carta.id)
    }
  }
})

test('as cartas do chefe dizem o ataque por extenso (sem nome de código)', () => {
  for (const p of PAGINAS.filter((x) => x.tipo === 'chefe')) {
    for (const carta of cartasDaPagina(p)) {
      const texto = fichaDaCarta(carta).textos[0].texto
      assert.doesNotMatch(texto, /\b[a-z]+[A-Z]\w*\b|\b(rain|sides|aimed|spiral)\b/, `${carta.id}: ${texto}`)
    }
  }
})

test('a prévia exige a biblioteca de ataques', () => {
  assert.throws(() => previaDaCarta(CARTAS.kris[1]), /ataques/)
})
