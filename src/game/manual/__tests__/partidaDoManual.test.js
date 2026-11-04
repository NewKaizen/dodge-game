// node --test src/game/manual/__tests__/partidaDoManual.test.js
// A partida da página 5: uma partida de verdade (as regras de pvp/regras.js), só mais curta e mansa.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PARTIDA_DO_MANUAL, NIVEL_MAIS_FACIL, ajustarPartida, hpDaPartida, dadosDaPartida, configValida } from '../partidaDoManual.js'
import { criarPartida, iniciarRodada, motivoBloqueio, hpInicial } from '../../pvp/regras.js'
import { escolherJogada, NIVEIS_BOT } from '../../pvp/bot.js'
import { criarRng } from '../../pvp/baralho.js'
import { CHUVA_P3 } from '../cartasDoManual.js'

const partida = () => {
  const c = PARTIDA_DO_MANUAL
  return ajustarPartida(criarPartida({ p1: c.p1, p2: c.p2, semente: c.semente }))
}

test('a CPU mais fácil, contra o Ralsei, sem relógio, sem bônus e sem morte súbita', () => {
  const c = PARTIDA_DO_MANUAL
  assert.ok(configValida())
  assert.equal(c.nivel, NIVEL_MAIS_FACIL)
  assert.equal(NIVEL_MAIS_FACIL, 'facil')
  assert.ok(NIVEIS_BOT.facil.ruido >= Math.max(...Object.values(NIVEIS_BOT).map((n) => n.ruido)), 'o nível que mais erra')
  assert.equal(c.p2, 'ralsei')
  assert.equal(c.tempo, 0)
  assert.equal(c.bonus, false)
  assert.equal(c.aceleracao, false)
  assert.deepEqual(dadosDaPartida({ cortina: true }), { p1: c.p1, p2: c.p2, arena: c.arena, semente: c.semente, tempo: 0, cortina: true })
  assert.equal(configValida({ ...c, nivel: 'nenhum' }), false)
})

test('partida curta: as duas vidas menores, cheias, pelas regras de sempre', () => {
  const e = partida()
  for (const [j, jog] of e.jogadores.entries()) {
    const base = hpInicial([PARTIDA_DO_MANUAL.p1, PARTIDA_DO_MANUAL.p2][j])
    assert.equal(jog.hpMax, hpDaPartida(base))
    assert.equal(jog.hp, jog.hpMax)
    assert.ok(jog.hpMax < base && jog.hpMax >= base * 0.3, `${jog.personagem}: ${jog.hpMax} de ${base}`)
  }
  assert.equal(hpDaPartida(1, 0.1), 1, 'nunca zero')
})

test('a semente fixa dá às dicas onde aparecer: na 1ª rodada a CPU joga a Estrela Gentil e você tem carta cara', () => {
  const c = PARTIDA_DO_MANUAL
  const e = partida()
  iniciarRodada(e)
  // a mesma conta da arena: decidirJogadaCpu com o rngBot `${semente}:cpu`
  const id = escolherJogada(e, 1, { nivel: c.nivel, rng: criarRng(`${c.semente}:cpu`) })
  assert.equal(id, CHUVA_P3, 'a chuva de estrelas cai na sua caixa')
  const caras = e.jogadores[0].baralho.mao.filter((carta) => motivoBloqueio(e, 0, carta.id)?.codigo === 'sem-energia')
  assert.ok(caras.length >= 1, 'há uma carta que ainda não cabe (falta energia)')
  assert.ok(e.jogadores[0].baralho.mao.some((carta) => !motivoBloqueio(e, 0, carta.id)), 'e uma que cabe')
})
