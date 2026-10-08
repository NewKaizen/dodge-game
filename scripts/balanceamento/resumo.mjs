// Resumo das medições de medir.mjs:
//   node scripts/balanceamento/resumo.mjs depois.json [antes.json]
//   DETALHE=all (ou um personagem) lista carta por carta
// rel = acertos da carta / média de acertos das cartas do mesmo valor (todos os personagens)
import fs from 'node:fs'
const [arq, cmp] = process.argv.slice(2)
const d = JSON.parse(fs.readFileSync(arq, 'utf8'))
const c = cmp ? JSON.parse(fs.readFileSync(cmp, 'utf8')) : null
const porId = c ? Object.fromEntries(c.resultado.map((r) => [r.id, r])) : {}
const f = (x) => x.toFixed(1).padStart(6)
const supers = d.resultado.filter((r) => r.valor === 14)
if (supers.length) {
  console.log('SUPER       difícil(dano acertos 0hit)   normal(dano acertos)')
  for (const r of supers) {
    const o = porId[r.id]
    console.log(r.personagem.padEnd(8), f(r.dificil.dano), r.dificil.acertos.toFixed(2), r.dificil.zero.toFixed(2), '|', f(r.normal.dano), r.normal.acertos.toFixed(2), o ? `  antes: ${f(o.dificil.dano)} ${f(o.normal.dano)}` : '', r.avisos.length ? r.avisos : '')
  }
}
const cartas = d.resultado.filter((r) => r.valor !== 14)
if (cartas.length) {
  // média de acertos por valor (todas as personagens), para normalizar
  const porValor = {}
  for (const r of cartas) (porValor[r.valor] ??= []).push(r)
  const media = (l, k) => l.reduce((a, r) => a + k(r), 0) / l.length
  const ref = Object.fromEntries(Object.entries(porValor).map(([v, l]) => [v, { d: media(l, (r) => r.dificil.acertos), n: media(l, (r) => r.normal.acertos) }]))
  const pers = [...new Set(cartas.map((r) => r.personagem))]
  console.log('\nPersonagem  n  dano/carta(dif) acertos(dif)  dano/carta(nor) acertos(nor)  rel(dif) rel(nor)')
  for (const p of pers) {
    const l = cartas.filter((r) => r.personagem === p)
    console.log(
      p.padEnd(8),
      String(l.length).padStart(3),
      f(media(l, (r) => r.dificil.dano)),
      media(l, (r) => r.dificil.acertos).toFixed(2).padStart(8),
      f(media(l, (r) => r.normal.dano)),
      media(l, (r) => r.normal.acertos).toFixed(2).padStart(8),
      media(l, (r) => r.dificil.acertos / Math.max(0.1, ref[r.valor].d)).toFixed(2).padStart(8),
      media(l, (r) => r.normal.acertos / Math.max(0.1, ref[r.valor].n)).toFixed(2).padStart(8),
    )
  }
  if (process.env.DETALHE) {
    for (const r of cartas.filter((r) => !process.env.DETALHE.length || process.env.DETALHE === 'all' || r.personagem === process.env.DETALHE)) {
      const o = porId[r.id]
      console.log(r.id.padEnd(20), r.nome.padEnd(22), f(r.dificil.dano), r.dificil.acertos.toFixed(2), '|', f(r.normal.dano), r.normal.acertos.toFixed(2), o ? ` antes ${o.dificil.acertos.toFixed(2)} ${o.normal.acertos.toFixed(2)}` : '', r.avisos.length ? r.avisos : '')
    }
  }
  const comAviso = cartas.filter((r) => r.avisos.length)
  console.log('\ncartas com aviso:', comAviso.map((r) => `${r.id}: ${r.avisos.join(' | ')}`))
}
console.log('outros avisos:', d.avisos)
