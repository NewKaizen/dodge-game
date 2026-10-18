// node --test src/game/coop/__tests__/
// SUPER no chefe: forte, mas sem acabar a luta num golpe só. O SUPER sozinho
// tira COOP.superGolpe do HP máximo; o SUPER COMBO (os dois juntos) tira
// COOP.superCombo[nivel]; o chefe com mais da metade do HP aguenta e nenhum
// SUPER pula uma fase inteira (limiteDoSuper)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COOP, criarPartidaCoop, iniciarRodadaCoop, resolverRodadaCoop, calcularGolpes, aplicarGolpe, fimDaRodadaCoop, danoDoSuper, fracaoDoCombo, limiteDoSuper, descricaoCoop } from '../regras.js'
import { faseDoChefe } from '../cartasChefe.js'
import { CHEFES } from '../chefes/index.js'
import { ORDEM_NIVEIS } from '../../constants.js'
import { CARTAS } from '../../pvp/cartas.js'

const LUTAS = Object.keys(CHEFES).flatMap((chefe) => ORDEM_NIVEIS.map((nivel) => ({ chefe, nivel })))
const SUPER = { ...CARTAS.kris.find((c) => c.valor === 14) }
const golpeSuper = (e) => ({ carta: SUPER, tipo: 'super', base: danoDoSuper(e.chefe) })
const total = (lista) => lista.reduce((t, g) => t + g.dano, 0)
const CRITICO = [{ perfeito: true }, { perfeito: true }]

// partida com o chefe em hp (e na fase que esse HP dá, como depois de fimDaRodadaCoop)
function luta({ chefe, nivel }, fracao = 1) {
  const e = criarPartidaCoop({ party: ['kris', 'susie'], chefe, nivel, semente: 'super' })
  const c = e.chefe
  c.hp = Math.max(1, Math.round(c.hpMax * fracao))
  c.fase = faseDoChefe(chefe, c.hp / c.hpMax)
  return e
}

test('SUPER COMBO com o chefe de HP cheio: forte, mas não mata (com CRÍTICO também), em todo chefe e nível', () => {
  for (const l of LUTAS) {
    for (const desempenho of [[], CRITICO]) {
      const e = luta(l)
      const c = e.chefe
      const g = golpeSuper(e)
      const dano = total(calcularGolpes(e, [g, { ...g }], desempenho))
      const nome = `${l.chefe}/${l.nivel}`
      assert.ok(dano < c.hp, `${nome}: o combo matou de HP cheio (${dano} >= ${c.hp})`)
      assert.ok(dano >= c.hpMax * 0.35, `${nome}: combo fraco (${dano} de ${c.hpMax})`)
      assert.ok(dano <= Math.round(c.hpMax * fracaoDoCombo(l.nivel)), `${nome}: combo passou do teto`)
      aplicarGolpe(e, dano)
      assert.ok(c.hp >= c.hpMax * 0.5 - 1, `${nome}: sobrou menos da metade (${c.hp})`)
      assert.ok(faseDoChefe(l.chefe, c.hp / c.hpMax) <= 1, `${nome}: pulou fase`)
    }
  }
})

test('o combo escala com o nível e vale mais que um SUPER sozinho', () => {
  const fr = ORDEM_NIVEIS.map(fracaoDoCombo)
  assert.ok(fr.every((f, i) => i === 0 || f >= fr[i - 1]))
  assert.ok(fr.every((f) => f >= 0.35 && f <= 0.5))
  for (const l of LUTAS) {
    const e = luta(l)
    const g = golpeSuper(e)
    const sozinho = total(calcularGolpes(e, [g, null]))
    const combo = total(calcularGolpes(e, [g, { ...g }]))
    assert.ok(combo > sozinho * 1.15, `${l.chefe}/${l.nivel}: combo ${combo} x sozinho ${sozinho}`)
  }
})

test('SUPER sozinho: um terço do HP máximo (com piso), não mata nem pula fase a partir do HP cheio', () => {
  assert.equal(danoDoSuper({ hpMax: 100 }), COOP.superPiso) // chefe com pouco HP: o piso segura
  for (const l of LUTAS) {
    const e = luta(l)
    const c = e.chefe
    assert.equal(danoDoSuper(c), Math.max(COOP.superPiso, Math.round(c.hpMax * COOP.superGolpe)))
    for (const desempenho of [[], CRITICO]) {
      const dano = total(calcularGolpes(e, [golpeSuper(e), null], desempenho))
      assert.ok(dano >= c.hpMax * 0.3 && dano <= Math.round(c.hpMax * fracaoDoCombo(l.nivel)), `${l.chefe}/${l.nivel}: SUPER ${dano}`)
      assert.ok(faseDoChefe(l.chefe, (c.hp - dano) / c.hpMax) <= 1)
    }
  }
})

test('acima da metade do HP o chefe aguenta qualquer SUPER; nunca pula uma fase inteira; abaixo, o combo finaliza', () => {
  for (const l of LUTAS) {
    for (let k = 100; k >= 1; k--) {
      const e = luta(l, k / 100)
      const c = e.chefe
      const { hp, fase } = c
      const g = golpeSuper(e)
      const lista = calcularGolpes(e, [g, { ...g }], CRITICO)
      const dano = total(lista)
      const nome = `${l.chefe}/${l.nivel} a ${k}%`
      assert.ok(dano <= limiteDoSuper(e) || dano === lista.length, nome)
      const depois = hp - Math.min(hp, dano)
      if (hp > c.hpMax * COOP.superFinaliza) assert.ok(depois >= c.hpMax * COOP.superSobra, `${nome}: sobrou ${depois}`)
      if (depois > 0) assert.ok(faseDoChefe(l.chefe, depois / c.hpMax) <= fase + 1, `${nome}: pulou fase`)
      // chefe já baixo (até o combo do nível e a metade do HP): o combo acaba a luta
      if (hp <= c.hpMax * Math.min(COOP.superFinaliza, fracaoDoCombo(l.nivel)) - 2) assert.equal(depois, 0, `${nome}: o combo não finalizou`)
      assert.ok(dano >= Math.min(hp, c.hpMax * 0.2) || dano >= hp - c.hpMax * COOP.superSobra, `${nome}: SUPER fraco demais (${dano})`)
    }
  }
})

test('SUPER limitado vem marcado (o chefe AGUENTOU) e o golpe comum da rodada não é cortado', () => {
  const e = luta({ chefe: 'king', nivel: 'facil' }, 0.55)
  const g = golpeSuper(e)
  const lista = calcularGolpes(e, [g, { ...g }], CRITICO)
  assert.ok(lista.every((x) => x.limitado))
  assert.equal(total(lista), limiteDoSuper(e))
  // HP cheio, SUPER sozinho sem CRÍTICO: nada a limitar
  const cheio = luta({ chefe: 'king', nivel: 'facil' })
  const espadas = { carta: CARTAS.kris.find((c) => c.id === 'kris-espadas-13'), tipo: 'espadas', base: 50 }
  const [s, k] = calcularGolpes(cheio, [golpeSuper(cheio), espadas])
  assert.ok(!s.limitado && !k.limitado)
  assert.equal(k.dano, 50)
})

test('pelas regras: os dois SUPER na mesma rodada não acabam a luta de HP cheio em nenhum chefe e nível', () => {
  for (const l of LUTAS) {
    const e = criarPartidaCoop({ party: ['kris', 'susie'], chefe: l.chefe, nivel: l.nivel, semente: 'rodada' })
    iniciarRodadaCoop(e)
    const ids = e.jogadores.map((jog) => {
      const sup = jog.baralho.monte.find((c) => c.valor === 14) ?? jog.baralho.mao.find((c) => c.valor === 14)
      jog.baralho.monte = jog.baralho.monte.filter((c) => c !== sup)
      jog.baralho.mao.push(sup)
      jog.energia = 10
      return sup.id
    })
    const r = resolverRodadaCoop(e, ...ids)
    calcularGolpes(e, r.golpes, CRITICO).forEach((g) => aplicarGolpe(e, g.dano))
    const { vencedor } = fimDaRodadaCoop(e)
    assert.equal(vencedor, null, `${l.chefe}/${l.nivel}`)
    assert.ok(e.chefe.fase <= 1)
  }
})

test('texto do SUPER no CO-OP: dano de verdade na luta; no Guia, as frações', () => {
  const e = luta({ chefe: 'jevil', nivel: 'dificil' })
  const sup = e.jogadores[0].baralho.monte.find((c) => c.valor === 14) ?? e.jogadores[0].baralho.mao.find((c) => c.valor === 14)
  assert.match(sup.descricao, new RegExp(`golpe de ${danoDoSuper(e.chefe)} `))
  assert.match(sup.descricao, new RegExp(`SUPER COMBO de ${Math.round(e.chefe.hpMax * fracaoDoCombo('dificil'))} \\(50%\\)`))
  assert.match(sup.descricao, /metade do HP/)
  const guia = descricaoCoop(SUPER)
  assert.match(guia, /33% do HP/)
  assert.match(guia, /40% a 50%/)
})
