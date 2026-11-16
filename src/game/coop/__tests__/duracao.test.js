// node --test src/game/coop/__tests__/duracao.test.js
// A DURAÇÃO das lutas do CO-OP 2.0 (coop/duracao.js): o alvo é ~4 a 6 minutos no MÉDIO com dois jogadores
// médios (docs/coop-cartas.md "Lutas mais curtas"). Aqui: a conta dos minutos e uma simulação grossa de
// partidas inteiras (as regras e a CPU aliada de verdade; os acertos de cada coração sorteados de uma
// distribuição de jogador médio, sem o navegador). A medição fina é scripts/balanceamento/simularCoop.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TEMPO, estimarDuracaoLuta, minutos } from '../duracao.js'
import { criarPartidaCoop, iniciarRodadaCoop, resolverRodadaCoop, aplicarDanoCoop, resolverContraCoop, aplicarGolpe, fimDaRodadaCoop, resgatarNaHora } from '../regras.js'
import { escolherJogadaCoop } from '../bot.js'
import { criarRng, aleatorio } from '../../pvp/baralho.js'
import { ORDEM_CHEFES } from '../chefes/index.js'

test('a conta: cada parte da rodada soma, a rodada sem esquiva é bem mais curta', () => {
  const r8 = estimarDuracaoLuta({ rodadas: 8 })
  assert.equal(r8, Math.round(TEMPO.abertura + 8 * (TEMPO.rodada + TEMPO.escolha + TEMPO.esquiva)))
  assert.ok(estimarDuracaoLuta({ rodadas: 8, semQuadro: 2 }) < r8)
  assert.ok(estimarDuracaoLuta({ rodadas: 8, finalizacoes: 1 }) > r8)
  assert.ok(estimarDuracaoLuta({ rodadas: 8, escolha: 3 }) < r8, 'com a CPU (que escolhe rápido) a luta é mais curta')
  assert.equal(minutos(240), 4)
})

// acertos por coração por esquiva de um jogador MÉDIO (a medição do bot 'normal' em medirChefes.mjs dá
// ~1 por ataque no MÉDIO, com bastante zero)
const ACERTOS = [0, 0, 0, 1, 1, 1, 2, 2, 3, 4]

function lutar(chefe, nivel, i) {
  const rng = criarRng(`duracao:${chefe}:${nivel}:${i}`)
  const sorteio = () => aleatorio(rng)
  const e = criarPartidaCoop({ party: ['kris', 'susie'], chefe, nivel, semente: `d${i}` })
  const conta = { semQuadro: 0, finalizacoes: 0, fases: 0 }
  let r = 0
  let fim = null
  for (; r < 40 && !fim; r++) {
    iniciarRodadaCoop(e)
    const res = resolverRodadaCoop(e, ...[0, 1].map((j) => escolherJogadaCoop(e, j, { rng })))
    const q = res.quadro
    if (!q) conta.semQuadro++
    const caiu = [false, false]
    const desempenho = [0, 1].map((j) => {
      if (!q?.jogadores[j]) return { perfeito: false, grazes: 0 }
      const k = ACERTOS[Math.floor(sorteio() * ACERTOS.length)]
      for (let h = 0; h < k; h++) aplicarDanoCoop(e, j, q.danos[j])
      caiu[j] = e.jogadores[j].caido
      return { perfeito: k === 0 && !caiu[j], grazes: 2 }
    })
    for (const j of [0, 1]) if (caiu[j] && q?.jogadores[1 - j] && !e.jogadores[1 - j].caido && sorteio() < 0.5) resgatarNaHora(e, j, 1 - j)
    const contra = resolverContraCoop(e, res.golpes, desempenho)
    contra.golpes.forEach((g) => aplicarGolpe(e, g.dano))
    if (contra.finalizacao && e.chefe.hp > 0) {
      aplicarGolpe(e, contra.finalizacao.dano)
      conta.finalizacoes++
    }
    const f = fimDaRodadaCoop(e)
    if (f.novaFase != null) conta.fases++
    fim = f.vencedor
  }
  return { vitoria: fim === 'vitoria', segundos: estimarDuracaoLuta({ rodadas: r, ...conta }), ...conta }
}

const media = (lista, campo) => lista.reduce((t, x) => t + x[campo], 0) / lista.length

// (dificuldade do CO-OP, docs/coop-cartas.md "Dificuldade do CO-OP"): o MÉDIO é um desafio de verdade (a dupla
// média às vezes perde), o FÁCIL continua acessível e o DIFÍCIL derruba mais que o MÉDIO
test('MÉDIO com dois jogadores médios: ~4 minutos por chefe (entre 3 e 6), às vezes ganha e às vezes perde', () => {
  for (const chefe of ORDEM_CHEFES) {
    const lutas = Array.from({ length: 40 }, (_, i) => lutar(chefe, 'medio', i))
    const min = minutos(media(lutas, 'segundos'))
    assert.ok(min >= 3 && min <= 6, `${chefe}: ${min} min`)
    const vitorias = lutas.filter((l) => l.vitoria).length
    assert.ok(vitorias >= 8 && vitorias <= 36, `${chefe}: a dupla média ganhou ${vitorias} de 40 no MÉDIO`)
    assert.ok(media(lutas.filter((l) => l.vitoria), 'finalizacoes') >= 0.5, `${chefe}: a luta vencida costuma ter uma rodada ATORDOADO`)
  }
})

test('o FÁCIL é acessível e mais curto que o MÉDIO; o DIFÍCIL derruba mais que o MÉDIO; nenhum passa de 6 minutos', () => {
  for (const chefe of ORDEM_CHEFES) {
    const facil = Array.from({ length: 30 }, (_, i) => lutar(chefe, 'facil', i))
    const medio = Array.from({ length: 30 }, (_, i) => lutar(chefe, 'medio', i))
    const dificil = Array.from({ length: 30 }, (_, i) => lutar(chefe, 'dificil', i))
    const vitorias = (lista) => lista.filter((l) => l.vitoria)
    assert.ok(vitorias(facil).length >= 24, `${chefe}: o FÁCIL ganhou ${vitorias(facil).length} de 30`)
    assert.ok(vitorias(dificil).length < vitorias(medio).length, `${chefe}: o DIFÍCIL tem de derrubar mais que o MÉDIO`)
    // (as lutas perdidas acabam cedo: a duração compara as vencidas)
    const fs = media(vitorias(facil), 'segundos')
    const ms = media(vitorias(medio), 'segundos')
    assert.ok(fs < ms, `${chefe}: fácil ${minutos(fs)} min, médio ${minutos(ms)} min`)
    assert.ok(minutos(media(medio, 'segundos')) <= 6)
  }
})
