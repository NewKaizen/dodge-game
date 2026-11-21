#!/usr/bin/env node
// MEDIDOR DE DESEMPENHO (docs/desempenho.md): abre cada cena da lista (cenas.mjs) num
// Chromium headless, com a partida andando sozinha no pior caso estável (piloto.mjs), e mede
// por frame o passo do Phaser (update/render), draw calls, comandos de Graphics, clears,
// re-render de texto, alocação e GC, em cada taxa de CPU (o throttle do DevTools).
// Sobe um vite próprio numa porta livre e derruba no fim.
//
//   npm run perf                                   todas as cenas, 1x/4x/8x, modo JS (viewport 300x300)
//   npm run perf -- --rapido                       6 cenas, janelas de 3 s, sem origens
//   npm run perf -- --cenas=pvp-cafe,coop --taxas=4,8
//   npm run perf -- --cheio                        resolução cheia (1280x800): mede raster (SwiftShader)
//   npm run perf -- --renderer=canvas              força o renderer Canvas (?renderer=canvas)
//
// Opções: --cenas=lista|rapido|todas  --taxas=1,4,8  --janela=7000 (ms por taxa)  --repeticoes=1
//         --musica=on|off  --sem-origens  --perfil=4 (perfil de CPU nessa taxa)  --viewport=LxA
//         --saida=arquivo.json (a tabela .md vai ao lado)  --log (saída do vite)
// Sem --saida, grava perf-resultados/medir-<data>.json + .md (a pasta não vai para o git).
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { subirVite, RAIZ } from './servidor.mjs'
import { abrirNavegador, abrirJogo } from './navegador.mjs'
import { CENAS, RAPIDO, escolherCenas } from './cenas.mjs'
import { pilotar } from './piloto.mjs'
import { resumir, tabela, tabelaOrigens, r1 } from './estatistica.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const SONDAS = fs.readFileSync(path.join(AQUI, 'sondas.js'), 'utf8')

export function lerOpcoes(argv) {
  const tem = (k) => argv.includes(`--${k}`)
  const val = (k, padrao) => {
    const a = argv.findLast((x) => x.startsWith(`--${k}=`)) // a última vence (npm run x -- --ref=outro)
    return a ? a.slice(k.length + 3) : padrao
  }
  const rapido = tem('rapido')
  const cheio = tem('cheio')
  const vp = val('viewport', cheio ? '1280x800' : '300x300').split('x').map(Number)
  return {
    cenas: escolherCenas(val('cenas', rapido ? 'rapido' : 'todas')),
    taxas: val('taxas', '1,4,8').split(',').map(Number),
    janelaMs: Number(val('janela', rapido ? 3000 : 7000)),
    repeticoes: Number(val('repeticoes', 1)),
    musica: val('musica', 'on'),
    origens: !rapido && !tem('sem-origens'),
    perfil: Number(val('perfil', 0)),
    viewport: vp,
    modo: cheio ? 'cheio' : vp[0] <= 400 ? 'js' : 'personalizado',
    renderer: val('renderer', 'webgl'),
    saida: val('saida', null),
    log: tem('log'),
    rapido,
  }
}

const commitAtual = () => {
  try {
    const h = execSync('git rev-parse --short HEAD', { cwd: RAIZ }).toString().trim()
    const sujo = execSync('git status --porcelain --untracked-files=no', { cwd: RAIZ }).toString().trim()
    return sujo ? `${h}+mudanças` : h
  } catch {
    return '?'
  }
}

const faseAgora = (pagina) => pagina.evaluate(() => (window.pvpArena || window.coopArena)?.fase ?? null)
const esperarFase = (pagina, fase, timeout) =>
  pagina
    .waitForFunction((f) => (window.pvpArena || window.coopArena)?.fase === f, fase, { timeout, polling: 200 })
    .then(() => true)
    .catch(() => false)

// Uma janela de medida. Com `fase`, só os quadros dessa fase contam, e a janela cresce
// (até maxMs) até juntar `alvo` quadros dela: a 8x a esquiva é curta e o FPS é baixo.
async function janela(pagina, cdp, { ms, fase, alvo, maxMs }) {
  const metrica = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]))
  const m0 = await metrica()
  await pagina.evaluate(() => window.__P.gravar(true))
  const t0 = Date.now()
  for (;;) {
    await pagina.waitForTimeout(500)
    const passou = Date.now() - t0
    if (passou < ms) continue
    if (!fase || passou >= maxMs) break
    const n = await pagina.evaluate((f) => window.__P.quadros.filter((q) => q.ph === f).length, fase)
    if (n >= alvo) break
  }
  const quadros = await pagina.evaluate(() => window.__P.gravar(false))
  const m1 = await metrica()
  const seg = m1.Timestamp - m0.Timestamp || (Date.now() - t0) / 1000
  const porS = (k) => r1(((m1[k] - m0[k]) / seg) * 1000)
  const fases = {}
  for (const q of quadros) fases[q.ph || '-'] = (fases[q.ph || '-'] || 0) + 1
  const daFase = fase ? quadros.filter((q) => q.ph === fase) : quadros
  return {
    resumo: resumir(daFase),
    todos: fase ? resumir(quadros) : undefined,
    fases,
    duracaoMs: Date.now() - t0,
    threadPrincipal: { scriptMsPorS: porS('ScriptDuration'), tarefaMsPorS: porS('TaskDuration'), layoutMsPorS: porS('LayoutDuration'), estiloMsPorS: porS('RecalcStyleDuration') },
  }
}

function topoDoPerfil(perfil, n = 15) {
  const dt = {}
  perfil.samples.forEach((id, i) => (dt[id] = (dt[id] || 0) + (perfil.timeDeltas[i] || 0)))
  const total = {}
  let tudo = 0
  for (const nd of perfil.nodes) {
    const t = (dt[nd.id] || 0) / 1000
    if (!t) continue
    const cf = nd.callFrame
    const arq = (cf.url || '').replace(/^.*?\/(src|node_modules)\//, '$1/').replace(/\?.*$/, '').replace('node_modules/.vite/deps/', 'deps/')
    const k = `${cf.functionName || '(anônima)'} ${arq ? `${arq}:${cf.lineNumber + 1}` : ''}`.trim()
    total[k] = (total[k] || 0) + t
    tudo += t
  }
  return {
    totalMs: r1(tudo),
    funcoes: Object.entries(total)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => ({ funcao: k, ms: r1(v), pct: r1((v / tudo) * 100) })),
  }
}

async function medirCena(nav, url, id, op, avisar) {
  const def = CENAS[id]
  const res = { id, nome: def.nome, grupo: def.grupo, fase: def.espera ?? null, taxas: {}, notas: [] }
  const query = op.renderer && op.renderer !== 'webgl' ? `renderer=${op.renderer}` : ''
  const { pagina, erros } = await abrirJogo(nav, url, { largura: op.viewport[0], altura: op.viewport[1], query })
  let pararPiloto = () => {}
  try {
    const cdp = await pagina.context().newCDPSession(pagina)
    await cdp.send('Performance.enable')
    await pagina.evaluate(SONDAS)
    if (op.musica === 'off') await pagina.evaluate(async () => (await import('/src/game/audio.js')).setSomLigado(false))
    await pagina.evaluate(() => window.debugJogo.set({ invencivel: true }))
    // as origens dos objetos da abertura da cena (o Menu abre de novo para ganhar as etiquetas)
    if (op.origens) await pagina.evaluate(() => window.__P.marcar(true))
    await pagina.evaluate(`(async () => { const s = debugJogo.jogo.scene.getScenes(true)[0]; ${def.inicio ?? 's.scene.restart()'} })()`)
    if (def.piloto) pararPiloto = pilotar(pagina, def.piloto)
    if (def.espera) {
      if (!(await esperarFase(pagina, def.espera, 90_000))) res.notas.push(`não chegou na fase ${def.espera}`)
    } else await pagina.waitForTimeout(4000) // a entrada da tela termina
    if (op.origens) await pagina.evaluate(() => (window.__P.tag = false))
    res.canvas = await pagina.evaluate(() => [window.debugJogo.jogo.canvas.width, window.debugJogo.jogo.canvas.height])
    res.renderer = await pagina.evaluate(() => (window.debugJogo.jogo.renderer.gl ? 'webgl' : 'canvas'))

    for (const taxa of op.taxas) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: taxa })
      await pagina.waitForTimeout(800)
      if (def.espera && !(await esperarFase(pagina, def.espera, 30_000))) res.notas.push(`${taxa}x: fora da fase ${def.espera} (${await faseAgora(pagina)})`)
      const reps = []
      for (let k = 0; k < op.repeticoes; k++) {
        if (k && def.espera) await esperarFase(pagina, def.espera, 30_000)
        reps.push(await janela(pagina, cdp, { ms: op.janelaMs, fase: def.espera, alvo: Math.max(40, (op.janelaMs / 1000) * 12), maxMs: op.janelaMs * 4 }))
      }
      const foto = await pagina.evaluate(() => window.__P.foto())
      res.taxas[taxa] = { ...reps[0], foto, repeticoes: op.repeticoes > 1 ? reps.map((r) => r.resumo) : undefined }
      const s = reps[0].resumo
      avisar(`${id} ${taxa}x: ${s.fps ?? '-'} fps, passo ${s.passo ?? '-'} ms (${s.update ?? '-'}/${s.render ?? '-'}), p95 ${s.passoP95 ?? '-'}, dc ${s.drawCalls ?? '-'}, gcmd ${foto.gcmd}, aloc ${s.alocMBs ?? '-'} MB/s, ${s.n} quadros [${Object.entries(reps[0].fases).map(([f, n]) => `${f}:${n}`).join(' ')}]`)
    }

    if (op.perfil) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: op.perfil })
      await cdp.send('Profiler.enable')
      await cdp.send('Profiler.setSamplingInterval', { interval: 250 })
      await cdp.send('Profiler.start')
      await pagina.waitForTimeout(5000)
      const { profile } = await cdp.send('Profiler.stop')
      res.perfil = { taxa: op.perfil, ...topoDoPerfil(profile) }
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    // as origens: 4 s a 1x com a etiqueta ligada (as pilhas custam; fora das janelas medidas)
    if (op.origens) {
      await pagina.evaluate(() => window.__P.marcar(true))
      await pagina.waitForTimeout(4000)
      res.origens = await pagina.evaluate(() => {
        const o = window.__P.origens(4)
        window.__P.tag = false
        return o
      })
    }
  } finally {
    pararPiloto()
    res.erros = erros.slice(0, 5)
    await pagina.close().catch(() => {})
  }
  return res
}

// Mede as cenas pedidas. avisar(linha) recebe o progresso.
export async function medir(op, avisar = (l) => console.log(l)) {
  const srv = await subirVite({ log: op.log })
  const nav = await abrirNavegador()
  const res = {
    ferramenta: 'scripts/perf/medir.mjs',
    commit: commitAtual(),
    quando: new Date().toISOString(),
    modo: op.modo,
    viewport: op.viewport,
    renderer: op.renderer,
    musica: op.musica,
    taxas: op.taxas,
    janelaMs: op.janelaMs,
    repeticoes: op.repeticoes,
    cenas: [],
  }
  try {
    for (const id of op.cenas) {
      const t0 = Date.now()
      let c
      // uma cena travada não derruba a medida inteira
      const limite = 120_000 + op.taxas.length * op.repeticoes * op.janelaMs * 5
      let timer
      try {
        c = await Promise.race([
          medirCena(nav, srv.url, id, op, avisar),
          new Promise((_, falha) => (timer = setTimeout(() => falha(new Error(`passou de ${Math.round(limite / 1000)} s`)), limite))),
        ])
      } catch (e) {
        c = { id, nome: CENAS[id].nome, grupo: CENAS[id].grupo, taxas: {}, notas: [], erro: String(e).slice(0, 300) }
        avisar(`${id}: ERRO ${c.erro}`)
      } finally {
        clearTimeout(timer)
      }
      c.duracaoS = Math.round((Date.now() - t0) / 1000)
      if (!res.canvas && c.canvas) res.canvas = c.canvas
      res.cenas.push(c)
    }
  } finally {
    await nav.close().catch(() => {})
    await srv.parar()
  }
  return res
}

export function gravar(res, saida) {
  const arq = saida ?? path.join(RAIZ, 'perf-resultados', `medir-${res.quando.replace(/[:.]/g, '-').slice(0, 19)}.json`)
  fs.mkdirSync(path.dirname(arq), { recursive: true })
  fs.writeFileSync(arq, JSON.stringify(res, null, 1))
  const md = arq.replace(/\.json$/, '') + '.md'
  const origens = tabelaOrigens(res)
  fs.writeFileSync(md, `# Medida de desempenho\n\n${tabela(res)}\n${origens ? `\n## Origens mais caras (1x)\n\n${origens}` : ''}`)
  return { json: arq, md }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const op = lerOpcoes(process.argv.slice(2))
  if (process.argv.includes('--ajuda') || process.argv.includes('-h')) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 19).join('\n'))
    console.log(`\ncenas: ${Object.keys(CENAS).join(', ')}\nrápido: ${RAPIDO.join(', ')}`)
    process.exit(0)
  }
  console.log(`medindo ${op.cenas.length} cena(s) em ${op.taxas.join('/')}x, modo ${op.modo} (${op.viewport.join('x')}), janela ${op.janelaMs} ms`)
  const res = await medir(op)
  const { json, md } = gravar(res, op.saida)
  console.log(`\n${tabela(res)}\n\ngravado: ${json}\n         ${md}`)
  process.exit(0)
}
