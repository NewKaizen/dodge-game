// O progresso do Manual do Ralsei (lógica pura; fica salvo em preferencias.js, chave 'manual').
// Valida tudo o que vem do navegador: um valor estranho vira o progresso vazio, nunca um erro.
//
//   { p1: { completa: bool }, p2: { completa: bool, licoes: [null | 'feita' | 'pulada' x4] } }
//
//   progressoValido(v)             o valor pode ser salvo? (null também: "nada ainda")
//   normalizarProgresso(v)         sempre um progresso completo e limpo
//   comPagina1(prog) / comLicao(prog, i, resultado) / comPagina2(prog)   cópias atualizadas
//   paginaParaRetomar(prog)        1 ou 2: a primeira página que falta (ou null: tudo pronto)
//   resumoDoIndice(prog)           as linhas do índice: [{ pagina, titulo, completa, adesivos, total }]

export const TOTAL_LICOES_P2 = 4
export const PAGINAS = [
  { pagina: 1, titulo: 'Este é o seu coração', cena: 'ManualRalsei' },
  { pagina: 2, titulo: 'Vamos desviar?', cena: 'ManualRalsei2' },
]
const RESULTADOS = [null, 'feita', 'pulada']

export const progressoVazio = () => ({ p1: { completa: false }, p2: { completa: false, licoes: Array(TOTAL_LICOES_P2).fill(null) } })

const objeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

export function progressoValido(v) {
  if (v === null) return true
  if (!objeto(v) || !objeto(v.p1) || !objeto(v.p2)) return false
  if (typeof v.p1.completa !== 'boolean' || typeof v.p2.completa !== 'boolean') return false
  const l = v.p2.licoes
  return Array.isArray(l) && l.length === TOTAL_LICOES_P2 && l.every((x) => RESULTADOS.includes(x))
}

// aproveita o que dá de um valor meio estragado (cada campo é conferido sozinho)
export function normalizarProgresso(v) {
  const p = progressoVazio()
  if (!objeto(v)) return p
  if (objeto(v.p1) && v.p1.completa === true) p.p1.completa = true
  if (objeto(v.p2)) {
    if (Array.isArray(v.p2.licoes)) p.p2.licoes = p.p2.licoes.map((_, i) => (RESULTADOS.includes(v.p2.licoes[i]) ? v.p2.licoes[i] : null))
    // completa só vale com todas as mini-lições resolvidas (feita ou pulada)
    p.p2.completa = v.p2.completa === true && p.p2.licoes.every(Boolean)
  }
  return p
}

export function comPagina1(prog) {
  const p = normalizarProgresso(prog)
  p.p1.completa = true
  return p
}

export function comLicao(prog, i, resultado) {
  const p = normalizarProgresso(prog)
  if (!Number.isInteger(i) || i < 0 || i >= TOTAL_LICOES_P2 || !RESULTADOS.includes(resultado) || !resultado) return p
  if (p.p2.licoes[i] !== 'feita') p.p2.licoes[i] = resultado // pular não apaga um adesivo já ganho
  return p
}

export function comPagina2(prog) {
  const p = normalizarProgresso(prog)
  if (p.p2.licoes.every(Boolean)) p.p2.completa = true
  return p
}

export function paginaParaRetomar(prog) {
  const p = normalizarProgresso(prog)
  if (!p.p1.completa) return 1
  if (!p.p2.completa) return 2
  return null
}

export function resumoDoIndice(prog) {
  const p = normalizarProgresso(prog)
  return [
    { ...PAGINAS[0], completa: p.p1.completa, adesivos: p.p1.completa ? 1 : 0, total: 1 },
    { ...PAGINAS[1], completa: p.p2.completa, adesivos: p.p2.licoes.filter((x) => x === 'feita').length, total: TOTAL_LICOES_P2, comecada: p.p2.licoes.some(Boolean) },
  ]
}
