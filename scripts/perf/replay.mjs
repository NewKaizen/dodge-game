#!/usr/bin/env node
// FUMAÇA DO REPLAY EM DADOS (docs/desempenho.md "Fase 4"): abre uma PvpArena contra a CPU, deixa o P1 com
// 1 de vida e parado na esquiva, espera o K.O. e fotografa a TV do replay (refeito dos dados: gravador.js +
// ressimulacao.js) em vários momentos. Com --duelo, o K.O. acontece no DUELO (bônus).
//   node scripts/perf/replay.mjs [--arena=castelo] [--duelo | --bonus=evento] [--saida=pasta] [--log]
// Saída: <pasta>/replay-<n>.png e o resumo (fases vistas, erros da página) no terminal. Sai com 1 se
// a página teve erro ou se o replay não apareceu.
import fs from 'node:fs'
import path from 'node:path'
import { RAIZ, subirVite } from './servidor.mjs'
import { abrirNavegador, abrirJogo } from './navegador.mjs'

const arg = (k, padrao) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3) ?? padrao
const arena = arg('arena', 'castelo')
const duelo = process.argv.includes('--duelo')
const bonus = duelo ? 'duelo' : arg('bonus', null) // um evento de bônus na rodada (o ambiente da caixa entra na foto)
const saida = path.resolve(arg('saida', path.join(RAIZ, 'perf-resultados', 'replay')))
fs.mkdirSync(saida, { recursive: true })

const vite = await subirVite({ log: process.argv.includes('--log') })
const nav = await abrirNavegador()
let falhou = false
try {
  const { pagina, erros } = await abrirJogo(nav, vite.url, { largura: 960, altura: 600 })
  pagina.on('console', (m) => m.type() === 'error' && erros.push(`console: ${m.text().slice(0, 300)}`))
  await pagina.evaluate(
    ({ arena }) => {
      window.debugJogo.set({ invencivel: false })
      const s = window.debugJogo.jogo.scene.getScenes(true)[0]
      s.scene.start('PvpArena', { p1: 'kris', p2: 'susie', arena, tempo: 2500, semente: 'replay-fumaca' })
    },
    { arena },
  )
  await pagina.waitForFunction(() => window.pvpArena?.estado, null, { timeout: 30_000 })
  const fases = new Set()
  const fotos = []
  const inicio = Date.now()
  let n = 0
  while (Date.now() - inicio < 150_000) {
    const e = await pagina.evaluate(
      ({ duelo, bonus }) => {
        const a = window.pvpArena
        if (!a) return { fim: true }
        const fim = a.fimDePartida
        if (a.fase === 'escolha' && a.__rodadaFumaca !== a.estado.rodada) {
          a.__rodadaFumaca = a.estado.rodada
          if (bonus) a.forcarBonus?.(bonus)
        }
        // P1 com 1 de vida (o primeiro acerto derruba); a CPU com vida cheia
        if (a.fase === 'escolha' || a.fase === 'esquiva' || a.fase === 'duelo') {
          const pronto = !bonus || (duelo ? a.fase === 'duelo' : a.fase === 'esquiva' && Boolean(a.efeitoBonus))
          if (a.estado.jogadores[0].hp > 1 && pronto) a.setHp(0, 1)
          if (a.estado.jogadores[1].hp < a.estado.jogadores[1].hpMax) a.setHp(1, a.estado.jogadores[1].hpMax)
        }
        return { fase: a.fase, fim: fim?.estado, tv: fim?.tv?.fase ?? null, quadros: fim?.tv?.quadros?.length ?? 0 }
      },
      { duelo, bonus },
    )
    if (!e || e.fim === true) break
    fases.add(`${e.fase}/${e.fim}${e.tv ? `/${e.tv}` : ''}`)
    if (e.fase === 'escolha') await pagina.keyboard.press('Space')
    if (e.tv && e.tv !== 'entrada' && n < 14) {
      const arquivo = path.join(saida, `replay-${String(++n).padStart(2, '0')}-${e.tv}.png`)
      await pagina.screenshot({ path: arquivo })
      fotos.push(`${arquivo} (${e.quadros} quadros)`)
    }
    if (e.fim === 'fim' && n > 0) break
    await pagina.waitForTimeout(e.tv ? 350 : 120)
  }
  console.log('fases vistas:', [...fases].join(', '))
  console.log('fotos:\n  ' + fotos.join('\n  '))
  if (erros.length) {
    falhou = true
    console.log('ERROS da página:\n  ' + erros.join('\n  '))
  }
  if (!fotos.length) {
    falhou = true
    console.log('o replay não apareceu')
  }
} finally {
  await nav.close()
  await vite.parar()
}
process.exit(falhou ? 1 : 0)
