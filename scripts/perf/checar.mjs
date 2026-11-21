#!/usr/bin/env node
// O PORTÃO DE DESEMPENHO (npm run perf:check; docs/desempenho.md): mede as cenas do orçamento
// (docs/perf-budget.json) N vezes (cada vez é uma sessão nova do navegador por cena), tira a
// MEDIANA do passo do Phaser (update + render, ms por frame) na taxa do orçamento (4x) e falha
// se alguma cena passar do orçamento + tolerância (±15 %). Os números headless variam: o
// portão é só o passo a 4x, que é o mais estável.
//
//   npm run perf:check
//   npm run perf:check -- --cenas=pvp-castelo,menu --rodadas=1
//   npm run perf:check -- --atualizar        grava as medianas medidas como o orçamento novo
//
// Opções: --cenas=lista (padrão: as do orçamento)  --rodadas=3  --janela=ms  --orcamento=arquivo
//         --atualizar  --log
// Sai com 1 se alguma cena estourou, 0 se tudo dentro.
import fs from 'node:fs'
import path from 'node:path'
import { RAIZ } from './servidor.mjs'
import { medir, lerOpcoes as opcoesDoMedidor } from './medir.mjs'
import { escolherCenas, CENAS } from './cenas.mjs'
import { mediana, r1 } from './estatistica.mjs'

const argv = process.argv.slice(2)
const val = (k, padrao) => {
  const a = argv.find((x) => x.startsWith(`--${k}=`))
  return a ? a.slice(k.length + 3) : padrao
}
const arqOrcamento = path.resolve(val('orcamento', path.join(RAIZ, 'docs', 'perf-budget.json')))
const orcamento = JSON.parse(fs.readFileSync(arqOrcamento, 'utf8'))
const atualizar = argv.includes('--atualizar')
const rodadas = Number(val('rodadas', orcamento.rodadas ?? 3))
const taxa = orcamento.taxa ?? 4
const tolerancia = orcamento.tolerancia ?? 0.15
const cenas = argv.some((x) => x.startsWith('--cenas=')) ? escolherCenas(val('cenas')) : Object.keys(orcamento.cenas).filter((id) => CENAS[id])

const op = {
  ...opcoesDoMedidor([`--viewport=${(orcamento.viewport ?? [300, 300]).join('x')}`, '--sem-origens', ...(argv.includes('--log') ? ['--log'] : [])]),
  cenas,
  taxas: [taxa],
  janelaMs: Number(val('janela', orcamento.janelaMs ?? 4000)),
  musica: orcamento.musica ?? 'on',
}

console.log(`perf:check: ${cenas.length} cena(s), ${rodadas} rodada(s) a ${taxa}x, janela ${op.janelaMs} ms, tolerância ${tolerancia * 100}% (${path.relative(RAIZ, arqOrcamento)})`)
const passos = Object.fromEntries(cenas.map((id) => [id, []]))
const fpss = Object.fromEntries(cenas.map((id) => [id, []]))
const rodadasRes = []
for (let k = 0; k < rodadas; k++) {
  console.log(`\nrodada ${k + 1} de ${rodadas}`)
  const res = await medir(op, (l) => console.log(`  ${l}`))
  rodadasRes.push(res)
  for (const c of res.cenas) {
    const s = c.taxas?.[taxa]?.resumo
    if (s?.n >= 10) {
      passos[c.id].push(s.passo)
      fpss[c.id].push(s.fps)
    }
  }
}

const linhas = []
let estouros = 0
for (const id of cenas) {
  const med = mediana(passos[id])
  const lim = orcamento.cenas[id]?.passoMs
  let status
  if (med === null) {
    status = 'SEM MEDIDA'
    estouros++
  } else if (lim == null) status = 'fora do orçamento'
  else if (med > lim * (1 + tolerancia)) {
    status = 'ESTOUROU'
    estouros++
  } else if (med < lim * (1 - tolerancia)) status = 'melhorou (dá para apertar)'
  else status = 'ok'
  linhas.push({ id, nome: CENAS[id].nome, medidas: passos[id], mediana: med === null ? null : r1(med), fps: mediana(fpss[id]), orcamento: lim ?? null, limite: lim == null ? null : r1(lim * (1 + tolerancia)), status })
}

const md = [
  `# perf:check (${new Date().toISOString()})`,
  '',
  `Passo do Phaser (update + render) a ${taxa}x, mediana de ${rodadas} rodada(s), modo JS (viewport ${op.viewport.join('x')}). Limite = orçamento + ${tolerancia * 100}%.`,
  '',
  '| Cena | Medidas (ms) | Mediana | FPS | Orçamento | Limite | Status |',
  '|---|---|---|---|---|---|---|',
  ...linhas.map((l) => `| ${l.nome} | ${l.medidas.join(' / ')} | ${l.mediana ?? '-'} | ${l.fps ?? '-'} | ${l.orcamento ?? '-'} | ${l.limite ?? '-'} | ${l.status} |`),
].join('\n')
console.log(`\n${md}`)
const pasta = path.join(RAIZ, 'perf-resultados')
fs.mkdirSync(pasta, { recursive: true })
const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
fs.writeFileSync(path.join(pasta, `check-${carimbo}.json`), JSON.stringify({ linhas, rodadas: rodadasRes }, null, 1))
fs.writeFileSync(path.join(pasta, `check-${carimbo}.md`), md)

if (atualizar) {
  for (const l of linhas) if (l.mediana !== null) orcamento.cenas[l.id] = { ...orcamento.cenas[l.id], passoMs: l.mediana, fps: l.fps }
  orcamento.medidoEm = new Date().toISOString().slice(0, 10)
  orcamento.commit = rodadasRes[0]?.commit
  fs.writeFileSync(arqOrcamento, JSON.stringify(orcamento, null, 2) + '\n')
  console.log(`\norçamento atualizado: ${path.relative(RAIZ, arqOrcamento)}`)
  process.exit(0)
}
console.log(estouros ? `\n${estouros} cena(s) fora do orçamento` : '\ntudo dentro do orçamento')
process.exit(estouros ? 1 : 0)
