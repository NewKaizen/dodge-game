// Os mundos da campanha (docs/campanha.md "Como acrescentar um mundo"). Regras em mundoN.js,
// textos em mundoN.textos.js. O servidor e o navegador leem daqui.
import { MUNDO1 } from './mundo1.js'
import { TEXTOS_MUNDO1 } from './mundo1.textos.js'

export const MUNDOS = [MUNDO1]
export const TEXTOS = { 1: TEXTOS_MUNDO1 }

export const mundoDe = (id) => MUNDOS.find((m) => m.id === Number(id)) ?? null
export const faseDe = (mundo, n) => mundoDe(mundo)?.fases.find((f) => f.n === Number(n)) ?? null
export const textosDaFase = (mundo, n) => {
  const f = faseDe(mundo, n)
  return f ? TEXTOS[mundo]?.fases?.[f.id] ?? null : null
}
// todos os cosméticos exclusivos da campanha (o catálogo do navegador e do banco)
export const ITENS_CAMPANHA = MUNDOS.flatMap((m) => m.recompensas.map((r) => ({ ...r, mundo: m.id, campanha: `mundo${m.id}` })))

// a fase n está liberada? (a 1 sempre; as outras depois de vencer a anterior)
//   progresso: [{ mundo, fase, estrelas, concluida }]
export function faseLiberada(progresso, mundo, n) {
  if (!faseDe(mundo, n)) return false
  if (Number(n) === 1) return true
  return (progresso ?? []).some((p) => p.mundo === Number(mundo) && p.fase === Number(n) - 1 && p.concluida)
}
