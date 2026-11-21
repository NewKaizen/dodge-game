#!/usr/bin/env node
// PARIDADE VISUAL (docs/desempenho.md): as mesmas cenas de medir.mjs, no modo determinístico
// (deterministico.mjs), fotografadas em frames fixos e comparadas pixel a pixel com uma base.
// Serve para provar que uma otimização não mudou o que aparece na tela.
//
//   npm run paridade:base                 fotos do `main` em perf-resultados/paridade/base
//   npm run paridade                      fotos da árvore de trabalho e a comparação com a base
//   node scripts/perf/paridade.mjs autoteste   a árvore de trabalho duas vezes: tem que dar 0 de diferença
//
// Comandos:
//   capturar [--ref=main] --saida=pasta    fotos (de um ref do git, ou da árvore de trabalho sem --ref)
//   comparar --base=pasta [--saida=pasta]  fotos da árvore de trabalho e o relatório contra a base
//   autoteste [--saida=pasta]              duas capturas da árvore de trabalho e a comparação entre elas
// Opções: --cenas=lista|rapido|todas  --quadros=30,120,600,1200  --viewport=960x600  --semente=paridade
//         --tolerancia=0.0001 (fração de pixels diferentes aceita por foto)  --limiar=0.1 (pixelmatch)
//         --log (saída do vite)
// Saída: <pasta>/<cena>-f<frame>.png e manifesto.json; a comparação grava relatorio.md,
// relatorio.json e diff/<cena>-f<frame>.png (os pixels diferentes em vermelho).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import { subirVite, RAIZ } from './servidor.mjs'
import { abrirNavegador, abrirJogo } from './navegador.mjs'
import { CENAS, escolherCenas } from './cenas.mjs'
import { decidir } from './piloto.mjs'
import { prepararPagina, congelar, DELTA } from './deterministico.mjs'

const PASTA = path.join(RAIZ, 'perf-resultados', 'paridade')

function lerOpcoes(argv) {
  const val = (k, padrao) => {
    const a = argv.findLast((x) => x.startsWith(`--${k}=`)) // a última vence (npm run x -- --ref=outro)
    return a ? a.slice(k.length + 3) : padrao
  }
  return {
    comando: argv.find((x) => !x.startsWith('--')) ?? 'ajuda',
    cenas: escolherCenas(val('cenas', 'todas')),
    quadros: val('quadros', '30,120,600,1200').split(',').map(Number).sort((a, b) => a - b),
    viewport: val('viewport', '960x600').split('x').map(Number),
    semente: val('semente', 'paridade'),
    tolerancia: Number(val('tolerancia', 0.0001)),
    limiar: Number(val('limiar', 0.1)),
    ref: val('ref', null),
    base: val('base', null),
    saida: val('saida', null),
    log: argv.includes('--log'),
  }
}

// Uma cena: abre, congela, anda até o último frame pedido e fotografa os da lista
async function capturarCena(nav, url, id, op, pasta) {
  const def = CENAS[id]
  const { pagina, erros } = await abrirJogo(nav, url, {
    largura: op.viewport[0],
    altura: op.viewport[1],
    antes: (p) => prepararPagina(p, op.semente),
  })
  const fotos = []
  const notas = []
  try {
    // o Menu termina de entrar (o relógio falso ainda corre normal)
    await pagina.waitForTimeout(1500)
    await congelar(pagina, op.semente)
    await pagina.evaluate(() => window.debugJogo.set({ invencivel: true }))
    await pagina.evaluate(`(async () => { const s = debugJogo.jogo.scene.getScenes(true)[0]; ${def.inicio ?? 's.scene.restart()'} })()`)
    const ultimo = op.quadros.at(-1)
    let segurada = null // a direção que o coração está seguindo
    let ms = 0
    for (let k = 1; k <= ultimo; k++) {
      // o relógio falso anda o mesmo que o frame (em ms inteiros: 17, 17, 16, ...)
      const alvo = Math.round(k * DELTA)
      await pagina.clock.runFor(alvo - ms)
      ms = alvo
      const foto = op.quadros.includes(k)
      let r = null
      for (let tentativa = 0; tentativa < 400 && !r; tentativa++) {
        r = await pagina.evaluate((f) => window.__det.passo(f), foto)
        if (!r) await new Promise((ok) => setTimeout(ok, 25)) // uma cena carregando: espera de verdade
      }
      if (!r) throw new Error(`a cena não terminou de carregar (frame ${k})`)
      if (foto) {
        const arq = `${id}-f${k}.png`
        fs.writeFileSync(path.join(pasta, arq), Buffer.from(r.png.split(',')[1], 'base64'))
        fotos.push({ frame: k, arquivo: arq, fase: await pagina.evaluate(() => (window.pvpArena || window.coopArena)?.fase ?? null) })
      }
      // o piloto: a cada 10 frames, a mesma decisão nos mesmos frames
      if (def.piloto && k % 10 === 0) {
        const tecla = await pagina.evaluate(decidir, { modo: def.piloto, aleatorio: false, passo: k })
        if (tecla === 'Space') await pagina.keyboard.press('Space')
        else if (tecla && tecla !== segurada) {
          if (segurada) await pagina.keyboard.up(segurada)
          await pagina.keyboard.down(tecla)
          segurada = tecla
        } else if (!tecla && segurada) {
          await pagina.keyboard.up(segurada)
          segurada = null
        }
      }
    }
  } catch (e) {
    notas.push(String(e).slice(0, 300))
  } finally {
    await pagina.close().catch(() => {})
  }
  return { id, nome: def.nome, fotos, erros: erros.slice(0, 5), notas }
}

// a árvore de um ref do git numa pasta temporária (git archive), com o node_modules daqui
function extrairRef(ref) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'dodge-paridade-'))
  const sha = execSync(`git rev-parse --short ${JSON.stringify(ref)}`, { cwd: RAIZ }).toString().trim()
  const r = spawnSync('sh', ['-c', `git archive --format=tar ${sha} | tar -x -C ${JSON.stringify(pasta)}`], { cwd: RAIZ, stdio: 'inherit' })
  if (r.status !== 0) throw new Error(`git archive de ${ref} falhou`)
  fs.symlinkSync(path.join(RAIZ, 'node_modules'), path.join(pasta, 'node_modules'), 'dir')
  return { pasta, sha }
}

const commitAtual = () => {
  try {
    const h = execSync('git rev-parse --short HEAD', { cwd: RAIZ }).toString().trim()
    return execSync('git status --porcelain --untracked-files=no', { cwd: RAIZ }).toString().trim() ? `${h}+mudanças` : h
  } catch {
    return '?'
  }
}

export async function capturar(op, pasta, { ref = null } = {}) {
  let arvore = null
  let origem = `árvore de trabalho (${commitAtual()})`
  if (ref) {
    arvore = extrairRef(ref)
    origem = `${ref} (${arvore.sha})`
  }
  fs.rmSync(pasta, { recursive: true, force: true })
  fs.mkdirSync(pasta, { recursive: true })
  const srv = await subirVite({ raiz: arvore?.pasta, log: op.log })
  const nav = await abrirNavegador()
  const manifesto = { origem, quando: new Date().toISOString(), viewport: op.viewport, semente: op.semente, quadros: op.quadros, cenas: [] }
  try {
    for (const id of op.cenas) {
      const t0 = Date.now()
      const c = await capturarCena(nav, srv.url, id, op, pasta)
      c.duracaoS = Math.round((Date.now() - t0) / 1000)
      console.log(`${id}: ${c.fotos.map((f) => `f${f.frame}${f.fase ? `(${f.fase})` : ''}`).join(' ')} em ${c.duracaoS} s${c.notas.length ? ` · ${c.notas.join('; ')}` : ''}${c.erros.length ? ` · erros da página: ${c.erros.length}` : ''}`)
      manifesto.cenas.push(c)
    }
  } finally {
    await nav.close().catch(() => {})
    await srv.parar()
    if (arvore) fs.rmSync(arvore.pasta, { recursive: true, force: true })
  }
  fs.writeFileSync(path.join(pasta, 'manifesto.json'), JSON.stringify(manifesto, null, 1))
  return manifesto
}

const lerPng = (arq) => PNG.sync.read(fs.readFileSync(arq))

export function comparar(pastaBase, pastaAtual, op) {
  const base = JSON.parse(fs.readFileSync(path.join(pastaBase, 'manifesto.json'), 'utf8'))
  const atual = JSON.parse(fs.readFileSync(path.join(pastaAtual, 'manifesto.json'), 'utf8'))
  const pastaDiff = path.join(pastaAtual, 'diff')
  fs.rmSync(pastaDiff, { recursive: true, force: true })
  fs.mkdirSync(pastaDiff, { recursive: true })
  const linhas = []
  for (const c of atual.cenas) {
    for (const f of c.fotos) {
      const a = path.join(pastaBase, f.arquivo)
      const linha = { cena: c.id, frame: f.frame, arquivo: f.arquivo }
      if (!fs.existsSync(a)) {
        linhas.push({ ...linha, status: 'sem base' })
        continue
      }
      const ib = lerPng(a)
      const ia = lerPng(path.join(pastaAtual, f.arquivo))
      if (ib.width !== ia.width || ib.height !== ia.height) {
        linhas.push({ ...linha, status: 'tamanho diferente', detalhe: `${ib.width}x${ib.height} vs ${ia.width}x${ia.height}` })
        continue
      }
      const diff = new PNG({ width: ia.width, height: ia.height })
      const n = pixelmatch(ib.data, ia.data, diff.data, ia.width, ia.height, { threshold: op.limiar })
      const frac = n / (ia.width * ia.height)
      if (n) fs.writeFileSync(path.join(pastaDiff, f.arquivo), PNG.sync.write(diff))
      linhas.push({ ...linha, pixels: n, fracao: frac, status: frac <= op.tolerancia ? (n ? 'ok (na tolerância)' : 'ok') : 'DIFERENTE' })
    }
  }
  // fotos que a base tem e a atual não (cena que travou antes do frame, por exemplo)
  for (const c of base.cenas) for (const f of c.fotos) if (!linhas.some((l) => l.arquivo === f.arquivo) && op.cenas.includes(c.id)) linhas.push({ cena: c.id, frame: f.frame, arquivo: f.arquivo, status: 'faltou na atual' })
  const falhas = linhas.filter((l) => !l.status.startsWith('ok'))
  const rel = { base: base.origem, atual: atual.origem, tolerancia: op.tolerancia, limiar: op.limiar, fotos: linhas.length, falhas: falhas.length, linhas }
  fs.writeFileSync(path.join(pastaAtual, 'relatorio.json'), JSON.stringify(rel, null, 1))
  const md = [
    '# Paridade visual',
    '',
    `Base: ${base.origem}. Atual: ${atual.origem}. Tolerância ${op.tolerancia * 100}% dos pixels por foto, limiar do pixelmatch ${op.limiar}.`,
    '',
    `**${falhas.length ? `${falhas.length} de ${linhas.length} fotos diferentes` : `${linhas.length} fotos, 0 diferenças`}**`,
    '',
    '| Cena | Frame | Pixels diferentes | % | Status |',
    '|---|---|---|---|---|',
    ...linhas.map((l) => `| ${l.cena} | ${l.frame} | ${l.pixels ?? ''} | ${l.fracao !== undefined ? (l.fracao * 100).toFixed(4) : ''} | ${l.status}${l.detalhe ? ` (${l.detalhe})` : ''} |`),
    '',
    falhas.length ? `As imagens de diferença estão em \`${path.relative(RAIZ, pastaDiff)}/\`.` : '',
  ].join('\n')
  fs.writeFileSync(path.join(pastaAtual, 'relatorio.md'), md)
  return { ...rel, md }
}

async function principal() {
  const op = lerOpcoes(process.argv.slice(2))
  if (op.comando === 'capturar') {
    const pasta = path.resolve(op.saida ?? path.join(PASTA, op.ref ? 'base' : 'atual'))
    await capturar(op, pasta, { ref: op.ref })
    console.log(`fotos em ${pasta}`)
    return 0
  }
  if (op.comando === 'comparar') {
    const base = path.resolve(op.base ?? path.join(PASTA, 'base'))
    if (!fs.existsSync(path.join(base, 'manifesto.json'))) throw new Error(`sem base em ${base}: rode antes \`npm run paridade:base\``)
    // as mesmas cenas, frames, viewport e semente da base
    const mb = JSON.parse(fs.readFileSync(path.join(base, 'manifesto.json'), 'utf8'))
    const argv = process.argv.slice(2)
    if (!argv.some((x) => x.startsWith('--cenas='))) op.cenas = mb.cenas.map((c) => c.id)
    if (!argv.some((x) => x.startsWith('--quadros='))) op.quadros = mb.quadros
    op.viewport = mb.viewport
    op.semente = mb.semente
    const pasta = path.resolve(op.saida ?? path.join(PASTA, 'atual'))
    await capturar(op, pasta)
    const r = comparar(base, pasta, op)
    console.log(`\n${r.md}\n\nrelatório: ${path.join(pasta, 'relatorio.md')}`)
    return r.falhas ? 1 : 0
  }
  if (op.comando === 'autoteste') {
    const raiz = path.resolve(op.saida ?? path.join(PASTA, 'autoteste'))
    await capturar(op, path.join(raiz, 'a'))
    await capturar(op, path.join(raiz, 'b'))
    const r = comparar(path.join(raiz, 'a'), path.join(raiz, 'b'), { ...op, tolerancia: 0 })
    console.log(`\n${r.md}\n\nrelatório: ${path.join(raiz, 'b', 'relatorio.md')}`)
    return r.falhas ? 1 : 0
  }
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 20).join('\n'))
  return 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal()
    .then((codigo) => process.exit(codigo))
    .catch((e) => {
      console.error(e)
      process.exit(2)
    })
}
