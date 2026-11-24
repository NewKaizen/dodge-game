// TEMPO DE BOOT E TAMANHO DO PACOTE (docs/desempenho.md, fase 3 do plano de otimização).
//
// Faz um `vite build` numa pasta temporária, serve com `vite preview` numa porta livre e abre o
// jogo num Chromium headless com a CPU freada (o throttle do DevTools), N vezes, medindo o tempo
// da navegação até o Menu pronto (a marca `menu-pronto` do performance, que o Menu põe no create)
// e o que foi baixado até lá. No fim lista os pedaços JS do pacote (minificado e gzip).
//
//   node scripts/perf/boot.mjs                 4x, 3 rodadas
//   node scripts/perf/boot.mjs --taxa=1 --rodadas=5
//   node scripts/perf/boot.mjs --raiz=/outra/arvore     (outra cópia do projeto, ex.: um ref antigo)
//   node scripts/perf/boot.mjs --sem-build --dist=pasta  (reaproveita um build)
//
// Sem a marca (um commit antigo), o fim é o primeiro quadro com a cena Menu ativa (window.__menuPronto
// não existe lá: cai no tempo em que o canvas do jogo aparece + o Menu do Phaser, pela lista de cenas).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { spawn, spawnSync } from 'node:child_process'
import { RAIZ, portaLivre } from './servidor.mjs'
import { abrirNavegador } from './navegador.mjs'

const argv = process.argv.slice(2)
const val = (k, padrao) => {
  const a = argv.findLast((x) => x.startsWith(`--${k}=`))
  return a ? a.slice(k.length + 3) : padrao
}
const raiz = path.resolve(val('raiz', RAIZ))
const taxa = Number(val('taxa', 4))
const rodadas = Number(val('rodadas', 3))
const semBuild = argv.includes('--sem-build')
const dist = path.resolve(val('dist', fs.mkdtempSync(path.join(os.tmpdir(), 'dodge-boot-'))))

const kB = (n) => Math.round(n / 1024)
const mediana = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor((s.length - 1) / 2)] : null
}

if (!semBuild) {
  const vite = path.join(raiz, 'node_modules', 'vite', 'bin', 'vite.js')
  const r = spawnSync(process.execPath, [vite, 'build', '--outDir', dist, '--emptyOutDir'], { cwd: raiz, stdio: ['ignore', 'pipe', 'inherit'] })
  if (r.status !== 0) throw new Error('vite build falhou')
}

// os pedaços JS (o principal é o maior)
const assets = path.join(dist, 'assets')
const pedacos = fs
  .readdirSync(assets)
  .filter((f) => f.endsWith('.js'))
  .map((f) => {
    const b = fs.readFileSync(path.join(assets, f))
    return { arquivo: f, kB: kB(b.length), gzipkB: kB(zlib.gzipSync(b).length) }
  })
  .sort((a, b) => b.kB - a.kB)

async function subirPreview() {
  const porta = await portaLivre()
  const vite = path.join(raiz, 'node_modules', 'vite', 'bin', 'vite.js')
  const filho = spawn(process.execPath, [vite, 'preview', '--outDir', dist, '--port', String(porta), '--strictPort', '--host', '127.0.0.1'], {
    cwd: raiz,
    env: { ...process.env, ONLINE: '', DODGE_CONTAS_FALSAS: '' },
    stdio: 'ignore',
    detached: true,
  })
  const url = `http://127.0.0.1:${porta}/`
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) break
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  return { url, parar: () => process.kill(-filho.pid, 'SIGKILL') }
}

const srv = await subirPreview()
const nav = await abrirNavegador()
const tempos = []
const baixados = []
try {
  for (let k = 0; k < rodadas; k++) {
    const ctx = await nav.newContext({ viewport: { width: 960, height: 600 } }) // sem cache entre rodadas
    const pagina = await ctx.newPage()
    const cdp = await ctx.newCDPSession(pagina)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: taxa })
    let bytes = 0
    pagina.on('response', async (r) => {
      try {
        bytes += Number(r.headers()['content-length'] || 0) || (await r.body()).length
      } catch {
        /* resposta sem corpo */
      }
    })
    await pagina.goto(srv.url)
    const t = await pagina.waitForFunction(() => performance.getEntriesByName('menu-pronto')[0]?.startTime, null, { timeout: 180_000, polling: 100 })
    tempos.push(Math.round(await t.jsonValue()))
    baixados.push(bytes)
    await ctx.close()
  }
} finally {
  await nav.close()
  srv.parar()
}

const res = {
  ferramenta: 'scripts/perf/boot.mjs',
  raiz,
  taxa,
  rodadas: tempos,
  bootMs: mediana(tempos),
  baixadoKB: kB(mediana(baixados)),
  principalKB: pedacos[0]?.kB,
  principalGzipKB: pedacos[0]?.gzipkB,
  pedacos,
}
console.log(JSON.stringify(res, null, 1))
if (!val('dist', null)) fs.rmSync(dist, { recursive: true, force: true })
