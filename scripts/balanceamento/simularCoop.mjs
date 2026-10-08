// Simula partidas inteiras do CO-OP de cartas (regras de verdade, CPU aliada
// jogando as cartas dos dois lados) usando os acertos MEDIDOS de cada carta
// do chefe (medirChefes.mjs): a cada caixa, sorteia uma das amostras daquela
// carta, naquele nível, para aquele tipo de jogador.
//
//   node scripts/balanceamento/simularCoop.mjs chefes.json [partidas] [jogadores]
//     jogadores: 'dificil' (os dois jogam como o bot perfeito), 'normal'
//     (os dois como o bot médio) ou 'misto' (um de cada). Padrão: os três.
//
// Saída: por chefe e nível, % de vitória e rodadas (médias).

import fs from 'node:fs'
import { criarPartidaCoop, iniciarRodadaCoop, resolverRodadaCoop, aplicarDanoCoop, calcularGolpes, aplicarGolpe, fimDaRodadaCoop, registrarPerfeitoCombo } from '../../src/game/coop/regras.js'
import { escolherJogadaCoop } from '../../src/game/coop/bot.js'
import { criarRng, aleatorio } from '../../src/game/pvp/baralho.js'

const [arquivo = 'chefes.json', nPartidas = '300', tipos = 'dificil,misto,normal'] = process.argv.slice(2)
const medida = JSON.parse(fs.readFileSync(arquivo, 'utf8')).resultado
const amostras = Object.fromEntries(medida.map((l) => [l.id, l]))
const PERSONAGENS = ['kris', 'susie', 'ralsei', 'noelle', 'berdly', 'dess', 'asriel']
const GRAZES = { dificil: 3, normal: 2 }

function simular(chefe, nivel, jogadores, i) {
  const rng = criarRng(`sim:${chefe}:${nivel}:${jogadores}:${i}`)
  const sorteio = () => aleatorio(rng)
  const party = [PERSONAGENS[i % 7], PERSONAGENS[(i * 3 + 1) % 7]]
  const bots = jogadores === 'misto' ? ['dificil', 'normal'] : [jogadores, jogadores]
  const e = criarPartidaCoop({ party, chefe, nivel, semente: `sim${i}` })
  let fim = null
  let r = 0
  for (; r < 60 && !fim; r++) {
    iniciarRodadaCoop(e)
    const res = resolverRodadaCoop(e, ...[0, 1].map((j) => escolherJogadaCoop(e, j, { rng })))
    const desempenho = [0, 1].map((j) => {
      const cx = res.caixas[j]
      if (!cx) return { perfeito: false, grazes: 0 }
      const lista = amostras[cx.carta.id]?.[nivel]?.[bots[j]]?.acertos ?? [1]
      const k = lista[Math.floor(sorteio() * lista.length)]
      for (let h = 0; h < k; h++) aplicarDanoCoop(e, j, cx.dano)
      const perfeito = k === 0 && !e.jogadores[j].caido
      if (perfeito) registrarPerfeitoCombo(e, j, cx.carta)
      return { perfeito, grazes: GRAZES[bots[j]] }
    })
    calcularGolpes(e, res.golpes, desempenho).forEach((g) => aplicarGolpe(e, g.dano))
    fim = fimDaRodadaCoop(e).vencedor
  }
  return { vitoria: fim === 'vitoria', rodadas: r, hpParty: e.jogadores.reduce((t, j) => t + j.hp, 0) / e.jogadores.reduce((t, j) => t + j.hpMax, 0) }
}

const chefes = [...new Set(medida.map((l) => l.chefe))]
const niveis = ['facil', 'medio', 'dificil'].filter((n) => medida[0][n])
const N = Number(nPartidas)
for (const jogadores of tipos.split(',')) {
  console.log(`\n=== jogadores: ${jogadores} (${N} partidas por linha)`)
  console.log('chefe     ' + niveis.map((n) => n.padEnd(26)).join(''))
  for (const chefe of chefes) {
    const colunas = niveis.map((nivel) => {
      const rs = Array.from({ length: N }, (_, i) => simular(chefe, nivel, jogadores, i))
      const vit = rs.filter((x) => x.vitoria)
      const pct = Math.round((100 * vit.length) / N)
      const rod = (rs.reduce((t, x) => t + x.rodadas, 0) / N).toFixed(1)
      const hp = vit.length ? Math.round((100 * vit.reduce((t, x) => t + x.hpParty, 0)) / vit.length) : 0
      return `${String(pct).padStart(3)}% ${rod.padStart(4)} rod hp${String(hp).padStart(3)}%`.padEnd(26)
    })
    console.log(chefe.padEnd(10) + colunas.join(''))
  }
}
