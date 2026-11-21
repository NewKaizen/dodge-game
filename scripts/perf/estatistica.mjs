// Contas e tabelas das medidas (medir.mjs, checar.mjs)

export const r1 = (x) => Math.round(x * 10) / 10
export const media = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
export function percentil(a, q) {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]
}
export function mediana(a) {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// quadros: [{ t, u, r, s, dc, tex, buf, gclr, txt, des, mem, ph }], na ordem.
// O FPS sai só dos intervalos entre quadros SEGUIDOS (a fase pode ter buracos), e a
// alocação dos degraus positivos do heap; um degrau para baixo de mais de 256 kB conta como GC.
export function resumir(quadros) {
  if (quadros.length < 3) return { n: quadros.length }
  const intervalos = []
  let gcs = 0
  let alocado = 0
  let duracao = 0
  for (let i = 1; i < quadros.length; i++) {
    const a = quadros[i - 1]
    const b = quadros[i]
    if (b.seq !== a.seq + 1) continue
    const dt = b.t - a.t
    intervalos.push(dt)
    duracao += dt
    const d = b.mem - a.mem
    if (d < -262144) gcs++
    else if (d > 0) alocado += d
  }
  const m = (k) => r1(media(quadros.map((f) => f[k] || 0)))
  const seg = duracao / 1000 || 1
  return {
    n: quadros.length,
    fps: intervalos.length ? r1(1000 / media(intervalos)) : 0,
    intervaloP95: r1(percentil(intervalos, 0.95)),
    passo: m('s'),
    passoP95: r1(percentil(quadros.map((f) => f.s), 0.95)),
    update: m('u'),
    render: m('r'),
    drawCalls: m('dc'),
    texturas: m('tex'),
    bufferKB: r1(media(quadros.map((f) => f.buf)) / 1024),
    clears: m('gclr'),
    textos: m('txt'),
    destroys: m('des'),
    gcPorS: r1(gcs / seg),
    alocMBs: r1(alocado / seg / 1048576),
    heapMB: r1(quadros.at(-1).mem / 1048576),
  }
}

const celula = (r) => (r && r.n >= 3 ? `${r.fps} fps, ${r.passo} ms (${r.update}/${r.render}), p95 ${r.passoP95}` : 'sem dados')

// A tabela markdown de uma medida inteira (o JSON de medir.mjs)
export function tabela(res) {
  const taxas = res.taxas
  const linhas = []
  linhas.push(`Modo: ${res.modo} (viewport ${res.viewport.join('x')}, canvas ${res.canvas?.join('x') ?? '?'}), renderer ${res.renderer}, música ${res.musica}, janela ${res.janelaMs} ms. Commit ${res.commit}, ${res.quando}.`)
  linhas.push('')
  linhas.push(`| Cena | ${taxas.map((t) => `${t}x: fps, passo ms (upd/rnd), p95`).join(' | ')} | dc | gcmd | clears/f | texto/f | aloc MB/s | GC/s |`)
  linhas.push(`|---|${taxas.map(() => '---').join('|')}|---|---|---|---|---|---|`)
  for (const c of res.cenas) {
    if (c.erro && !Object.keys(c.taxas ?? {}).length) {
      linhas.push(`| ${c.nome} | ${taxas.map(() => 'erro').join(' | ')} | | | | | | |`)
      continue
    }
    const base = c.taxas?.[taxas[0]]?.resumo ?? {}
    const foto = c.taxas?.[taxas[0]]?.foto ?? {}
    const nota = c.notas?.length ? ` (${c.notas.join('; ')})` : ''
    linhas.push(
      `| ${c.nome}${nota} | ${taxas.map((t) => celula(c.taxas?.[t]?.resumo)).join(' | ')} | ${base.drawCalls ?? ''} | ${foto.gcmd ?? ''} | ${base.clears ?? ''} | ${base.textos ?? ''} | ${base.alocMBs ?? ''} | ${base.gcPorS ?? ''} |`,
    )
  }
  linhas.push('')
  linhas.push(`dc, gcmd, clears, texto, aloc e GC: na taxa ${taxas[0]}x. Cenas de arena: só os quadros da fase pedida (esquiva/escolha).`)
  return linhas.join('\n')
}

// As origens (a linha que criou) mais caras de cada cena
export function tabelaOrigens(res, n = 5) {
  const out = []
  for (const c of res.cenas) {
    if (!c.origens) continue
    out.push(`### ${c.nome}`)
    out.push('')
    out.push('| Graphics (origem) | n | comandos | clears/f |')
    out.push('|---|---|---|---|')
    for (const g of c.origens.graphics.slice(0, n)) out.push(`| \`${g.origem}\` | ${g.n} | ${g.cmd} | ${g.clearsPorFrame} |`)
    if (c.origens.rerenderTexto.length) {
      out.push('')
      out.push('| Text re-render (origem) | por frame |')
      out.push('|---|---|')
      for (const t of c.origens.rerenderTexto.slice(0, n)) out.push(`| \`${t.origem}\` | ${t.porFrame} |`)
    }
    if (c.origens.criadosPorSegundo.length) {
      out.push('')
      out.push('| Criados (tipo origem) | por segundo |')
      out.push('|---|---|')
      for (const t of c.origens.criadosPorSegundo.slice(0, n)) out.push(`| \`${t.origem}\` | ${t.porSegundo} |`)
    }
    out.push('')
  }
  return out.join('\n')
}
