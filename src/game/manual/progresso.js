// O progresso do Manual do Ralsei (lógica pura; fica salvo em preferencias.js, chave 'manual').
// Valida tudo o que vem do navegador: um valor estranho vira o progresso vazio, nunca um erro.
//
//   { p1: { completa: bool },
//     p2: { completa: bool, licoes: [null | 'feita' | 'pulada' x4] },
//     p3: { completa: bool, passos: [null | 'feita' | 'pulada' x2] },
//     p4: { completa: bool, passos: [null | 'feita' | 'pulada' x3] },
//     p5: { completa: bool },          a partida de verdade (página 5) chegou ao fim
//     essencial: bool,                 o MANUAL ESSENCIAL: o adesivo de quem terminou a página 5
//     p6..p9: { completa: bool, passos: [null | 'feita' | 'pulada' x TOTAL_PASSOS[n]] } }   as páginas EXTRAS (3D)
//
//   p3, p4, p5, essencial e p6..p9 podem faltar (progresso salvo antes delas existirem): valem como "nada ainda".
//   As páginas 1 a 5 são o manual ESSENCIAL; as 6 a 9 são extras: oferecidas no índice, nunca forçadas
//   (não entram no CONTINUAR do essencial nem no selo; `extraParaRetomar` só retoma um extra já começado).
//
//   progressoValido(v)             o valor pode ser salvo? (null também: "nada ainda")
//   normalizarProgresso(v)         sempre um progresso completo e limpo
//   comPagina1(prog) / comLicao(prog, i, resultado) / comPagina2(prog)   cópias atualizadas
//   comPasso(prog, pagina, i, resultado) / comPagina(prog, pagina)        idem, para as páginas 3 e 4
//   comPagina5(prog)               a página 5 completa e o manual essencial ganho
//   paginaParaRetomar(prog)        1 a 5: a primeira página que falta (ou null: tudo pronto)
//   extraParaRetomar(prog)         6 a 9: o primeiro extra já começado e não completo (ou null)
//   extrasCompletos(prog)          quantos extras (de 4) estão completos
//   essencialCompleto(prog)        o manual essencial já foi ganho?
//   resumoDoIndice(prog)           as linhas do índice: [{ pagina, titulo, completa, adesivos, total }]

export const TOTAL_LICOES_P2 = 4
export const TOTAL_PASSOS = { 3: 2, 4: 3, 6: 5, 7: 2, 8: 2, 9: 3 } // passos (adesivos) das páginas de cartas e dos extras
export const PAGINAS = [
  { pagina: 1, titulo: 'Este é o seu coração', cena: 'ManualRalsei' },
  { pagina: 2, titulo: 'Vamos desviar?', cena: 'ManualRalsei2' },
  { pagina: 3, titulo: 'Sua primeira carta', cena: 'ManualRalsei3' },
  { pagina: 4, titulo: 'Nem toda rodada pede ataque', cena: 'ManualRalsei4' },
  { pagina: 5, titulo: 'Uma partida de verdade', cena: 'ManualRalsei5' },
  // extras (3D): oferecidos, nunca forçados
  { pagina: 6, titulo: 'Os quatro naipes', cena: 'ManualRalsei6', extra: true },
  { pagina: 7, titulo: 'Graze: raspando', cena: 'ManualRalsei7', extra: true },
  { pagina: 8, titulo: 'Jogando em dupla', cena: 'ManualRalsei8', extra: true },
  { pagina: 9, titulo: 'Ases, SUPER e perfeitos', cena: 'ManualRalsei9', extra: true },
]
export const ESSENCIAIS = PAGINAS.filter((x) => !x.extra) // páginas 1 a 5
export const EXTRAS = PAGINAS.filter((x) => x.extra) // páginas 6 a 9
const RESULTADOS = [null, 'feita', 'pulada']
const PAGINAS_DE_PASSOS = [3, 4, 6, 7, 8, 9]

const vazioDePassos = (n) => ({ completa: false, passos: Array(TOTAL_PASSOS[n]).fill(null) })
export const progressoVazio = () => ({
  p1: { completa: false },
  p2: { completa: false, licoes: Array(TOTAL_LICOES_P2).fill(null) },
  p3: vazioDePassos(3),
  p4: vazioDePassos(4),
  p5: { completa: false },
  p6: vazioDePassos(6),
  p7: vazioDePassos(7),
  p8: vazioDePassos(8),
  p9: vazioDePassos(9),
  essencial: false,
})

const objeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const listaValida = (l, n) => Array.isArray(l) && l.length === n && l.every((x) => RESULTADOS.includes(x))

export function progressoValido(v) {
  if (v === null) return true
  if (!objeto(v) || !objeto(v.p1) || !objeto(v.p2)) return false
  if (typeof v.p1.completa !== 'boolean' || typeof v.p2.completa !== 'boolean') return false
  if (!listaValida(v.p2.licoes, TOTAL_LICOES_P2)) return false
  for (const n of PAGINAS_DE_PASSOS) {
    const p = v[`p${n}`]
    if (p === undefined) continue
    if (!objeto(p) || typeof p.completa !== 'boolean' || !listaValida(p.passos, TOTAL_PASSOS[n])) return false
  }
  if (v.p5 !== undefined && (!objeto(v.p5) || typeof v.p5.completa !== 'boolean')) return false
  if (v.essencial !== undefined && typeof v.essencial !== 'boolean') return false
  return true
}

const aproveitar = (lista, n) => Array.from({ length: n }, (_, i) => (Array.isArray(lista) && RESULTADOS.includes(lista[i]) ? lista[i] : null))

// aproveita o que dá de um valor meio estragado (cada campo é conferido sozinho)
export function normalizarProgresso(v) {
  const p = progressoVazio()
  if (!objeto(v)) return p
  if (objeto(v.p1) && v.p1.completa === true) p.p1.completa = true
  if (objeto(v.p2)) {
    p.p2.licoes = aproveitar(v.p2.licoes, TOTAL_LICOES_P2)
    // completa só vale com todas as mini-lições resolvidas (feita ou pulada)
    p.p2.completa = v.p2.completa === true && p.p2.licoes.every(Boolean)
  }
  for (const n of PAGINAS_DE_PASSOS) {
    const salvo = v[`p${n}`]
    if (!objeto(salvo)) continue
    const q = p[`p${n}`]
    q.passos = aproveitar(salvo.passos, TOTAL_PASSOS[n])
    q.completa = salvo.completa === true && q.passos.every(Boolean)
  }
  if (objeto(v.p5) && v.p5.completa === true) p.p5.completa = true
  // o manual essencial vem da página 5 (sem ela, não vale)
  p.essencial = v.essencial === true && p.p5.completa
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

// páginas de passos (3, 4 e os extras 6 a 9): um passo resolvido (pular não apaga um adesivo já ganho)
export function comPasso(prog, pagina, i, resultado) {
  const p = normalizarProgresso(prog)
  const q = p[`p${pagina}`]
  if (!PAGINAS_DE_PASSOS.includes(pagina) || !Number.isInteger(i) || i < 0 || i >= TOTAL_PASSOS[pagina] || !RESULTADOS.includes(resultado) || !resultado) return p
  if (q.passos[i] !== 'feita') q.passos[i] = resultado
  return p
}

// páginas de passos: completa só com todos os passos resolvidos
export function comPagina(prog, pagina) {
  if (pagina === 1) return comPagina1(prog)
  if (pagina === 2) return comPagina2(prog)
  if (pagina === 5) return comPagina5(prog)
  const p = normalizarProgresso(prog)
  const q = p[`p${pagina}`]
  if (q && q.passos.every(Boolean)) q.completa = true
  return p
}

// página 5: a partida de verdade acabou (ganhando ou perdendo): o manual essencial está completo
export function comPagina5(prog) {
  const p = normalizarProgresso(prog)
  p.p5.completa = true
  p.essencial = true
  return p
}

export const essencialCompleto = (prog) => normalizarProgresso(prog).essencial

const completaDe = (p, n) => p[`p${n}`].completa

// só o manual ESSENCIAL (1 a 5): os extras nunca entram aqui
export function paginaParaRetomar(prog) {
  const p = normalizarProgresso(prog)
  const falta = ESSENCIAIS.find(({ pagina }) => !completaDe(p, pagina))
  return falta ? falta.pagina : null
}

// um extra que a pessoa já começou e não terminou (nunca puxa para um extra que ela nem abriu)
export function extraParaRetomar(prog) {
  const p = normalizarProgresso(prog)
  const e = EXTRAS.find(({ pagina }) => !p[`p${pagina}`].completa && p[`p${pagina}`].passos.some(Boolean))
  return e ? e.pagina : null
}

export const extrasCompletos = (prog) => {
  const p = normalizarProgresso(prog)
  return EXTRAS.filter(({ pagina }) => p[`p${pagina}`].completa).length
}

// as linhas do índice: as 5 essenciais e depois os 4 extras (`extra: true`)
export function resumoDoIndice(prog) {
  const p = normalizarProgresso(prog)
  const deCartas = (n) => {
    const q = p[`p${n}`]
    return { ...PAGINAS[n - 1], completa: q.completa, adesivos: q.passos.filter((x) => x === 'feita').length, total: TOTAL_PASSOS[n], comecada: q.passos.some(Boolean) }
  }
  return [
    { ...PAGINAS[0], completa: p.p1.completa, adesivos: p.p1.completa ? 1 : 0, total: 1 },
    { ...PAGINAS[1], completa: p.p2.completa, adesivos: p.p2.licoes.filter((x) => x === 'feita').length, total: TOTAL_LICOES_P2, comecada: p.p2.licoes.some(Boolean) },
    deCartas(3),
    deCartas(4),
    { ...PAGINAS[4], completa: p.p5.completa, adesivos: p.p5.completa ? 1 : 0, total: 1 },
    ...EXTRAS.map((e) => deCartas(e.pagina)),
  ]
}
