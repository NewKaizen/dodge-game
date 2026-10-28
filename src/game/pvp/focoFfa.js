// O FOCO do todos contra todos (Fase 5D, docs/pvp-regras.md "Todos contra todos"): em vez das 4 caixas
// ao mesmo tempo, a esquiva mostra o MEU par: a minha caixa grande no meio (eu desvio do ataque que vem
// para mim) e a do meu alvo menor ao lado (eu vejo o meu ataque chegar); os outros viram cartões
// pequenos no canto. Lógica pura (sem Phaser), testada em __tests__/focoFfa.test.js. É SÓ apresentação:
// as caixas continuam no mesmo lugar do mundo e rodando como antes (cada PC simula o próprio coração; as
// outras são espelho), só aparecem em outro lugar/tamanho (BattleBox.setVista) ou não aparecem
// (BattleBox.setOculta).
//
//   quemEmFoco({ alvos, eu, eliminados, seguindo })   -> { foco, alvo, atacante, outros, espectador }
//   estadoDoCartao({ eliminado, fora, caido, comAtaque })  -> 'eliminado' | 'semConexao' | 'caido' | 'desviando' | 'livre'
//   vistasDaGrade(n) / vistasDoFoco(selecao, n)      -> [{ x, y, escala, visivel }] por vaga
//   criarTransicao(de, para, { ms, reduzir })  e  avancarTransicao(t, dt) -> { vistas, k, fim }
//   parametrosSopro(tipo, { reduzir })          o "whoosh" da transição (audio.js 'sopro')
//
// Uma rodada: anúncio (a grade, "ANA → BETO") → escolha → revelação → as caixas abrem na grade →
// TRANSIÇÃO (TRANSICAO.ms, ease) para o foco → esquiva → TRANSIÇÃO de volta à grade (o dano da rodada de
// todo mundo) → próxima rodada. "Reduzir animações" (acessibilidade): CORTE seco no lugar do zoom.

import { LARGURA, ALTURA } from '../constants.js'

export const TRANSICAO = { ms: 700, msSeguir: 320 }

// A grade 2x2 (a mesma da PvpArenaN): o centro de cada célula, debaixo do topo dos cartões
export const TOPO_GRADE = 66
const CELULA = { largura: LARGURA / 2, altura: (ALTURA - TOPO_GRADE) / 2 }
export const centroDaCelula = (k) => ({ x: (k % 2) * CELULA.largura + CELULA.largura / 2, y: TOPO_GRADE + Math.floor(k / 2) * CELULA.altura + CELULA.altura / 2 })

// O foco na tela (854x480; a caixa padrão é 220x170 e pode crescer até o campo dela, ~235x199):
//   foco    a minha caixa (ou a de quem o espectador segue): escala 1.42 ≈ 312x241 no meio-esquerda
//   alvo    a caixa do meu alvo: escala 0.62 ≈ 136x105, em cima à direita
//   cartoes os outros, empilhados embaixo à direita (só o cartão: nenhuma caixa desenhada)
export const FOCO = {
  foco: { x: 300, y: 286, escala: 1.42 },
  alvo: { x: 692, y: 196, escala: 0.62 },
  cartoes: { x: 600, y: 318, largura: 244, altura: 46, passo: 54 },
}

// Quem fica em foco nesta rodada. alvos[vaga] = a vaga que ela ataca (pvp/ffa.js). Vivo: eu. Eliminado
// (espectador): quem eu sigo (←/→), se está vivo; senão o primeiro vivo
export function quemEmFoco({ alvos, eu, eliminados = [], seguindo = null }) {
  const n = alvos.length
  const vivo = (j) => j != null && j >= 0 && j < n && !eliminados[j]
  const espectador = !vivo(eu)
  let foco = espectador ? (vivo(seguindo) ? seguindo : null) : eu
  if (foco == null) foco = Array.from({ length: n }, (_, j) => j).find(vivo) ?? null
  const alvo = foco != null && alvos[foco] != null && alvos[foco] !== foco ? alvos[foco] : null
  const quem = foco == null ? -1 : alvos.indexOf(foco)
  const atacante = quem >= 0 ? quem : null
  const outros = Array.from({ length: n }, (_, j) => j).filter((j) => j !== foco && j !== alvo)
  return { foco, alvo, atacante, outros, espectador }
}

// O estado no cartão pequeno de quem está fora do foco (na ordem: o mais forte vale)
export function estadoDoCartao({ eliminado = false, fora = false, caido = false, comAtaque = false } = {}) {
  if (eliminado) return 'eliminado'
  if (fora) return 'semConexao'
  if (caido) return 'caido'
  return comAtaque ? 'desviando' : 'livre'
}
export const TEXTO_CARTAO = { eliminado: 'ELIMINADO', semConexao: 'SEM CONEXÃO', caido: 'CAÍDO', desviando: 'DESVIANDO', livre: 'SEM ATAQUE' }

// onde fica o cartão i (0, 1, ...) dos de fora do foco
export const posicaoDoCartao = (i) => ({ x: FOCO.cartoes.x, y: FOCO.cartoes.y + i * FOCO.cartoes.passo })

// a vista de cada vaga na grade: a caixa no centro da célula, tamanho normal
export const vistasDaGrade = (n) => Array.from({ length: n }, (_, k) => ({ ...centroDaCelula(k), escala: 1, visivel: true }))

// a vista de cada vaga no foco: os de fora encolhem até o cartão deles e somem
const ESCALA_CARTAO = 0.16
export function vistasDoFoco(selecao, n) {
  return Array.from({ length: n }, (_, k) => {
    if (k === selecao.foco) return { ...FOCO.foco, visivel: true }
    if (k === selecao.alvo) return { ...FOCO.alvo, visivel: true }
    const i = Math.max(0, selecao.outros.indexOf(k))
    const c = posicaoDoCartao(i)
    return { x: c.x + 24, y: c.y + FOCO.cartoes.altura / 2, escala: ESCALA_CARTAO, visivel: false }
  })
}

// ---------- transição ----------

// suave nas duas pontas (Cubic.easeInOut)
export const suavizar = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2)

// Uma transição entre duas listas de vistas. `reduzir` (preferência "reduzir animações"): ms = 0, o corte
export function criarTransicao(de, para, { ms = TRANSICAO.ms, reduzir = false } = {}) {
  return { de: de.map((v) => ({ ...v })), para: para.map((v) => ({ ...v })), ms: reduzir ? 0 : Math.max(0, ms), t: 0, corte: reduzir || ms <= 0, fim: false }
}

// Avança dt ms. As caixas que vão sumir ficam visíveis até o fim (encolhendo); as que vão aparecer
// aparecem já no começo (crescendo do cartão). Devolve { vistas, k (0..1 já suavizado), fim }
export function avancarTransicao(t, dt = 0) {
  t.t = Math.min(t.ms, t.t + Math.max(0, dt))
  const bruto = t.ms > 0 ? t.t / t.ms : 1
  const k = suavizar(bruto)
  t.fim = bruto >= 1
  const lerp = (a, b) => a + (b - a) * k
  const vistas = t.para.map((p, i) => {
    const d = t.de[i] ?? p
    if (t.fim) return { x: p.x, y: p.y, escala: p.escala, visivel: p.visivel }
    return { x: lerp(d.x, p.x), y: lerp(d.y, p.y), escala: lerp(d.escala, p.escala), visivel: t.fim ? p.visivel : d.visivel || p.visivel }
  })
  return { vistas, k, fim: t.fim }
}

// ---------- som ----------

// O "whoosh" da transição (audio.js SINTESE.sopro: ruído num passa-faixa que varre de `de` a `para` Hz):
// entrar = sobe (aproxima), sair = desce (afasta). Com "reduzir animações" (o corte) é mais curto e baixo
export const SOPRO = {
  entrar: { dur: 0.42, vol: 0.16, de: 380, para: 2600, q: 1.1, pico: 0.55 },
  sair: { dur: 0.38, vol: 0.13, de: 2300, para: 320, q: 1.1, pico: 0.3 },
}
export function parametrosSopro(tipo, { reduzir = false } = {}) {
  const base = SOPRO[tipo] ?? SOPRO.entrar
  if (!reduzir) return { ...base }
  return { ...base, dur: Math.round(base.dur * 0.45 * 100) / 100, vol: Math.round(base.vol * 0.5 * 1000) / 1000 }
}
