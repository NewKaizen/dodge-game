// Mede as TAXAS DE VITÓRIA do jogador contra os bots do JOGAR RÁPIDO (server/bots/), sem navegador:
// as regras e as caixas de verdade (server/bots/simulacao.js), o "jogador" é o mesmo modelo de esquiva e de
// cartas com o nível de jogo dele (q). Duas medidas:
//   1. por faixa: um jogador do MESMO q da faixa contra ela (a partida "parelha")
//   2. o caminho de verdade: jogadores de vários níveis jogam N partidas seguidas; a cada uma o servidor
//      estima o jogador (habilidade.js: o nível da conta + os resultados recentes) e escolhe o bot mais perto
//      (um pouco abaixo), como server/bots/index.js faz. Sai a taxa por faixa do bot enfrentado.
//
//   node scripts/balanceamento/simularBots.mjs [partidasPorFaixa=40] [jogadoresPorNivel=4] [seguidas=12]
import { simularPartida } from '../../server/bots/simulacao.js'
import { FAIXAS, ORDEM_FAIXAS, estimarJogador, ajustarRecentes, FOLGA_ALVO } from '../../server/bots/habilidade.js'

const [porFaixa = 40, jogadores = 4, seguidas = 12] = process.argv.slice(2).map(Number)
const pct = (v, n) => (n ? `${Math.round((100 * v) / n)}%` : '-')

console.log(`\n1) o jogador do mesmo nível da faixa (${porFaixa} partidas cada)`)
for (const f of ORDEM_FAIXAS) {
  let v = 0
  for (let i = 0; i < porFaixa; i++) if (simularPartida({ qJogador: FAIXAS[f], qBot: FAIXAS[f], semente: `faixa:${f}:${i}` }).vencedor === 0) v++
  console.log(`   ${f.padEnd(10)} q=${FAIXAS[f].toFixed(2)}  jogador vence ${pct(v, porFaixa)}`)
}

// o grupo de bots: as faixas com a variação de cada bot (como perfil.js sorteia)
const grupo = ORDEM_FAIXAS.flatMap((f) => [-0.06, -0.02, 0.02, 0.06].map((d) => ({ faixa: f, q: Math.max(0.01, FAIXAS[f] + d) })))
const porFaixaBot = Object.fromEntries(ORDEM_FAIXAS.map((f) => [f, { v: 0, n: 0 }]))
const porNivel = []
console.log(`\n2) o caminho de verdade (${jogadores} jogadores por nível, ${seguidas} partidas seguidas cada)`)
for (const qVerdade of [0.1, 0.22, 0.35, 0.5, 0.62, 0.75, 0.88, 0.95]) {
  let v = 0
  let n = 0
  for (let j = 0; j < jogadores; j++) {
    // a conta: quem joga melhor costuma ter mais nível (mas nem sempre)
    const nivel = Math.max(1, Math.round(1 + qVerdade * 35 + (j - jogadores / 2) * 4))
    let recentes = []
    let ultimo = null
    for (let k = 0; k < seguidas; k++) {
      const q = estimarJogador({ nivel, recentes })
      const bot = grupo.filter((b) => b !== ultimo).sort((a, b) => Math.abs(a.q - (q - FOLGA_ALVO)) - Math.abs(b.q - (q - FOLGA_ALVO)))[0]
      ultimo = bot
      const r = simularPartida({ qJogador: qVerdade, qBot: bot.q, semente: `caminho:${qVerdade}:${j}:${k}` })
      const venceu = r.vencedor === 0
      if (r.vencedor !== null) recentes = ajustarRecentes(recentes, venceu)
      porFaixaBot[bot.faixa].n++
      if (venceu) porFaixaBot[bot.faixa].v++
      n++
      if (venceu) v++
    }
  }
  porNivel.push({ qVerdade, v, n })
  console.log(`   jogador q=${qVerdade.toFixed(2)}: vence ${pct(v, n)} (${v}/${n})`)
}
console.log('\n   por faixa do bot enfrentado:')
for (const f of ORDEM_FAIXAS) console.log(`   ${f.padEnd(10)} ${pct(porFaixaBot[f].v, porFaixaBot[f].n)} (${porFaixaBot[f].v}/${porFaixaBot[f].n})`)
const total = porNivel.reduce((s, x) => ({ v: s.v + x.v, n: s.n + x.n }), { v: 0, n: 0 })
console.log(`\n   no total: ${pct(total.v, total.n)} (${total.v}/${total.n})\n`)
