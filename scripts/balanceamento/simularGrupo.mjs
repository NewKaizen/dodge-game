// Simulação GROSSA do CO-OP de 2, 3 e 4 jogadores (Fase 5B; a 5C faz a medição de verdade, com o
// EsquivaBot nas caixas como em medirChefes.mjs): os bots aliados (coop/bot.js) jogam as cartas e cada
// coração no quadro leva de 0 a 2 acertos por rodada com a probabilidade pHit (quem a mira do rodízio
// escolheu leva pHit; os outros, 35% disso). Serve para ver se a DURAÇÃO da luta e o risco se mantêm quando o
// grupo cresce (GRUPO em coop/regras.js).
//   node scripts/balanceamento/simularGrupo.mjs [facil|medio|dificil] [pHit]
import { criarPartidaCoop, iniciarRodadaCoop, resolverRodadaCoop, aplicarDanoCoop, calcularGolpes, aplicarGolpe, fimDaRodadaCoop, GRUPO } from '../../src/game/coop/regras.js'
import { escolherJogadaCoop } from '../../src/game/coop/bot.js'
import { criarRng, aleatorio } from '../../src/game/pvp/baralho.js'
const PARTY = ['kris', 'susie', 'ralsei', 'dess']
function jogar(n, chefe, nivel, semente, pHit) {
  const e = criarPartidaCoop({ party: PARTY.slice(0, n), chefe, nivel, semente })
  const rng = criarRng('s' + semente)
  const sorteio = criarRng('h' + semente)
  let fim = null
  for (let r = 0; r < 60 && !fim; r++) {
    iniciarRodadaCoop(e)
    const jogadas = e.jogadores.map((_, j) => escolherJogadaCoop(e, j, { rng }))
    const res = resolverRodadaCoop(e, ...jogadas)
    const q = res.quadro
    const acertos = e.jogadores.map(() => 0)
    if (q) e.jogadores.forEach((_, j) => { if (!q.jogadores[j]) return; const mirado = !q.mira || q.mira.includes(j); const p = mirado ? pHit : pHit * 0.35; const h = aleatorio(sorteio) < p ? 1 + (aleatorio(sorteio) < 0.4 ? 1 : 0) : 0; for (let k = 0; k < h; k++) aplicarDanoCoop(e, j, q.danos[j]); acertos[j] = h })
    calcularGolpes(e, res.golpes, e.jogadores.map((_, j) => ({ perfeito: q?.jogadores[j] && !acertos[j], grazes: 2 }))).forEach((g) => aplicarGolpe(e, g.dano))
    fim = fimDaRodadaCoop(e, { quadro: q, acertos }).vencedor
  }
  return { fim, rodadas: e.rodada, caidos: e.jogadores.filter((j) => j.caido).length }
}
const nivel = process.argv[2] || 'facil'
const pHit = Number(process.argv[3] || 0.5)
for (const n of [2, 3, 4]) {
  let v = 0, rod = 0, N = 200
  for (let i = 0; i < N; i++) for (const chefe of ['king', 'queen', 'jevil', 'coronel']) { const r = jogar(n, chefe, nivel, `${n}-${i}-${chefe}`, pHit); if (r.fim === 'vitoria') v++; rod += r.rodadas }
  console.log(`n=${n} hp x${GRUPO[n].hpChefe} ${nivel} pHit ${pHit}: vitórias ${(v / (N * 4) * 100).toFixed(0)}%, rodadas/luta ${(rod / (N * 4)).toFixed(1)}`)
}
