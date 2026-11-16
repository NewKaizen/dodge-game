// TABULEIRO REAL (Chaos King): a lógica PURA do tabuleiro de xadrez que vira o quadro (sem Phaser; os
// testes em coop/__tests__/kingTabuleiro.test.js). Quem desenha é kingAtaques.js; a regra do chefe
// (XEQUE, ROQUE) está em kingRegra.js.
//
// O quadro vira uma grade (8 x 4 casas no chefão; 4 x 4 no Cavaleiro). Cada PEÇA mostra as casas que vai
// golpear (aviso vermelho) antes de golpear. O que este arquivo garante, para ser justo e legível:
//   - cada peça golpeia só o que o xadrez dela diz (casasDaPeca);
//   - sempre sobra um REFÚGIO (um bloco livre de 2 x 2 casas) ao alcance de cada coração durante o aviso;
//   - nada cai nas casas PROTEGIDAS (a gaiola do XEQUE, a casa da peça a capturar);
//   - tudo sai de um `sorteio` injetado (determinístico) e das posições dos corações.
import { CORACAO } from '../../constants.js'

export const TABULEIRO = { colunas: 8, linhas: 4 }
export const TABULEIRO_MINI = { colunas: 4, linhas: 4 }

export const chave = (c, r) => `${c},${r}`
const dentro = (tab, c, r) => c >= 0 && c < tab.colunas && r >= 0 && r < tab.linhas
const limitar = (v, min, max) => Math.max(min, Math.min(max, v))

// ---------- a grade em pixels ----------

// limites: { x|left, y|top, width, height } (a caixa do quadro)
export function criarGrade(limites, tab = TABULEIRO) {
  const left = limites.left ?? limites.x
  const top = limites.top ?? limites.y
  return { ...tab, left, top, width: limites.width, height: limites.height, cw: limites.width / tab.colunas, ch: limites.height / tab.linhas }
}

// a casa (c, r): canto e centro em pixels
export function retanguloDe(g, c, r) {
  const x = g.left + c * g.cw
  const y = g.top + r * g.ch
  return { x, y, largura: g.cw, altura: g.ch, cx: x + g.cw / 2, cy: y + g.ch / 2 }
}

// a casa que contém o ponto (preso dentro do tabuleiro)
export function celulaEm(g, px, py) {
  return { c: limitar(Math.floor((px - g.left) / g.cw), 0, g.colunas - 1), r: limitar(Math.floor((py - g.top) / g.ch), 0, g.linhas - 1) }
}

// onde o coração j nasce quando o quadro abre (a mesma conta da Pista: lado a lado, embaixo)
export function inicioDoCoracaoNaGrade(g, j, n) {
  return { x: g.left + (g.width * (j + 1)) / (n + 1), y: g.top + g.height - 30 }
}

// ---------- o que cada peça golpeia ----------

const L = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]

// peca: { tipo: 'peao' | 'torre' | 'bispo' | 'cavalo' | 'rainha', c, r, modo? }
//   peao    as duas casas na diagonal da frente (para baixo; a de frente é livre)
//   torre   modo 'linha' (a linha toda, a casa dela inclusive) ou 'coluna'
//   bispo   as duas diagonais que saem da casa dela (para baixo se r = 0, para cima se r é a última)
//   cavalo  as casas em L (a dele fica livre)
//   rainha  linha + coluna + as diagonais nos dois sentidos
export function casasDaPeca(peca, tab = TABULEIRO) {
  const { tipo, c, r } = peca
  const saida = new Map()
  const por = (cc, rr) => dentro(tab, cc, rr) && saida.set(chave(cc, rr), { c: cc, r: rr })
  const linha = () => {
    for (let cc = 0; cc < tab.colunas; cc++) por(cc, r)
  }
  const coluna = () => {
    for (let rr = 0; rr < tab.linhas; rr++) por(c, rr)
  }
  const diagonais = (sentidos) => {
    for (const dr of sentidos) {
      for (let k = 0; k < Math.max(tab.colunas, tab.linhas); k++) {
        por(c + k, r + dr * k)
        por(c - k, r + dr * k)
      }
    }
  }
  if (tipo === 'peao') {
    por(c - 1, r + 1)
    por(c + 1, r + 1)
  } else if (tipo === 'torre') {
    if (peca.modo === 'coluna') coluna()
    else linha()
  } else if (tipo === 'bispo') diagonais([r === 0 ? 1 : -1])
  else if (tipo === 'cavalo') for (const [dc, dr] of L) por(c + dc, r + dr)
  else if (tipo === 'rainha') {
    linha()
    coluna()
    diagonais([1, -1])
  }
  return [...saida.values()]
}

// Junta casas vizinhas em retângulos (em casas): [{ c0, r0, c1, r1 }] (c1/r1 inclusive). Poucas balas
// grandes em vez de uma por casa: a linha da torre vira UMA barra
export function mesclar(casas) {
  const set = new Set(casas.map((x) => chave(x.c, x.r)))
  const usadas = new Set()
  const saida = []
  const ordenadas = [...casas].sort((p, q) => p.r - q.r || p.c - q.c)
  for (const { c, r } of ordenadas) {
    if (usadas.has(chave(c, r))) continue
    let c1 = c
    while (set.has(chave(c1 + 1, r)) && !usadas.has(chave(c1 + 1, r))) c1++
    let r1 = r
    const linhaInteira = (rr) => {
      for (let cc = c; cc <= c1; cc++) if (!set.has(chave(cc, rr)) || usadas.has(chave(cc, rr))) return false
      return true
    }
    while (linhaInteira(r1 + 1)) r1++
    for (let rr = r; rr <= r1; rr++) for (let cc = c; cc <= c1; cc++) usadas.add(chave(cc, rr))
    saida.push({ c0: c, r0: r, c1, r1 })
  }
  return saida
}

// ---------- refúgio (a rota de fuga do tabuleiro) ----------

// os blocos livres de 2 x 2 casas ({ c, r } = o canto de cima à esquerda)
export function refugios(tab, ocupadas) {
  const lista = []
  for (let r = 0; r + 1 < tab.linhas; r++) {
    for (let c = 0; c + 1 < tab.colunas; c++) {
      if (!ocupadas.has(chave(c, r)) && !ocupadas.has(chave(c + 1, r)) && !ocupadas.has(chave(c, r + 1)) && !ocupadas.has(chave(c + 1, r + 1))) lista.push({ c, r })
    }
  }
  return lista
}

export const temRefugio = (tab, ocupadas) => refugios(tab, ocupadas).length > 0

// algum refúgio chega antes do golpe? (distância do ponto até o bloco, em pixels, <= alcance)
export function refugioAlcancavel(g, ocupadas, ponto, alcance) {
  for (const { c, r } of refugios(g, ocupadas)) {
    const x0 = g.left + c * g.cw
    const y0 = g.top + r * g.ch
    const dx = Math.max(x0 - ponto.x, 0, ponto.x - (x0 + 2 * g.cw))
    const dy = Math.max(y0 - ponto.y, 0, ponto.y - (y0 + 2 * g.ch))
    if (Math.hypot(dx, dy) <= alcance) return true
  }
  return false
}

// quanto o coração anda durante o aviso (com folga): o refúgio tem de estar dentro disto
export const alcanceDoAviso = (avisoMs, velocidade = CORACAO.velocidadePadrao) => (velocidade * avisoMs * 0.7) / 1000

// ---------- a jogada: as peças, a mira e o relógio ----------

export const TEMPOS_PADRAO = { aviso: 900, golpe: 320, passo: 160 }

// Eventos de UMA peça, em ms desde o início dela:
//   { t, tipo: 'golpe', casas, aviso }   mostra as casas por `aviso` ms e golpeia (dura `golpe`)
//   { t, tipo: 'mover', para: { c, r } } o peão anda uma casa (o ícone)
//   { t, tipo: 'promover', para: 'rainha' } o peão chegou ao fim: vira rainha
// Devolve { eventos, duracao }
export function eventosDaPeca(peca, tab, tempos = TEMPOS_PADRAO) {
  const { aviso, golpe, passo } = { ...TEMPOS_PADRAO, ...tempos }
  const eventos = []
  if (peca.tipo !== 'peao') {
    const casas = casasDaPeca(peca, tab)
    eventos.push({ t: 0, tipo: 'golpe', casas, aviso })
    return { eventos, duracao: aviso + golpe }
  }
  // peão: golpeia as diagonais da frente e anda; chegando na última linha, promove (se pedido)
  let t = 0
  let r = peca.r
  while (r < tab.linhas - 1) {
    eventos.push({ t, tipo: 'golpe', casas: casasDaPeca({ ...peca, r }, tab), aviso })
    t += aviso + golpe
    r++
    eventos.push({ t, tipo: 'mover', para: { c: peca.c, r } })
    t += passo
  }
  if (peca.promove) {
    const rainha = { tipo: 'rainha', c: peca.c, r }
    eventos.push({ t, tipo: 'promover', para: 'rainha' })
    const avisoRainha = Math.round(aviso * 1.35)
    eventos.push({ t: t + 350, tipo: 'golpe', casas: casasDaPeca(rainha, tab), aviso: avisoRainha })
    t += 350 + avisoRainha + golpe
  }
  return { eventos, duracao: t }
}

// todas as casas que a peça pode golpear em algum momento (o que o refúgio conta)
export function casasDasPecas(pecas) {
  const todas = new Map()
  for (const p of pecas) for (const e of p.eventos) if (e.tipo === 'golpe') for (const x of e.casas) todas.set(chave(x.c, x.r), x)
  return todas
}

// Monta uma peça de `tipo` mirando (ou não) a casa `alvo` ({ c, r }). `sorteio()` -> [0, 1).
// Devolve a peça ({ tipo, c, r, ... }) ou null
function colocar(tipo, { tab, alvo, modo, mirar, sorteio, promove }) {
  const pick = (lista) => lista[Math.floor(sorteio() * lista.length) % lista.length]
  const aleatoria = () => ({ c: Math.floor(sorteio() * tab.colunas), r: Math.floor(sorteio() * tab.linhas) })
  const ref = mirar && alvo ? alvo : aleatoria()
  if (tipo === 'torre') {
    const m = modo ?? (sorteio() < 0.5 ? 'linha' : 'coluna')
    if (m === 'coluna') return { tipo, modo: m, c: ref.c, r: 0 }
    return { tipo, modo: m, c: sorteio() < 0.5 ? 0 : tab.colunas - 1, r: ref.r }
  }
  if (tipo === 'bispo') {
    const r0 = sorteio() < 0.5 ? 0 : tab.linhas - 1
    const d = Math.abs(ref.r - r0)
    const opcoes = [ref.c - d, ref.c + d].filter((c) => c >= 0 && c < tab.colunas)
    if (!opcoes.length) return null
    return { tipo, c: pick(opcoes), r: r0 }
  }
  if (tipo === 'cavalo') {
    const opcoes = L.map(([dc, dr]) => ({ c: ref.c - dc, r: ref.r - dr })).filter((p) => dentro(tab, p.c, p.r))
    if (!opcoes.length) return null
    return { tipo, ...pick(opcoes) }
  }
  if (tipo === 'peao') {
    const opcoes = [ref.c - 1, ref.c + 1].filter((c) => c >= 0 && c < tab.colunas)
    return { tipo, c: pick(opcoes), r: promove || sorteio() < 0.6 ? 0 : 1, promove: Boolean(promove) }
  }
  return null
}

// Planeja uma JOGADA (as peças que jogam juntas). Devolve { pecas, duracao }: cada peça já com `eventos`
//   jogada     [{ tipo, modo?, mirar? (padrão true), promove? }]
//   alvos      [{ x, y }] os corações no quadro (em pixels)
//   protegidas Set de chaves de casas onde nada cai (a gaiola, a casa da captura)
//   sorteio    () => [0, 1)
//   tempos     { aviso, golpe, passo }
//   velocidade px/s do coração (para o alcance do refúgio)
// Cada peça é tentada em até 10 posições: a que deixar um refúgio ao alcance de TODOS os corações entra;
// se nenhuma deixar, a peça fica de fora (a jogada nunca fecha o tabuleiro)
export function planejarJogada({ grade, jogada, alvos = [], protegidas = new Set(), sorteio, tempos = TEMPOS_PADRAO, velocidade }) {
  const tab = grade
  const t = { ...TEMPOS_PADRAO, ...tempos }
  const alcance = alcanceDoAviso(t.aviso, velocidade)
  const celulasAlvo = alvos.map((p) => celulaEm(grade, p.x, p.y))
  const pecas = []
  const ocupadas = new Map()
  let mira = 0
  for (const entrada of jogada) {
    const mirar = entrada.mirar ?? true
    const alvo = celulasAlvo.length ? celulasAlvo[mira++ % celulasAlvo.length] : null
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      const base = colocar(entrada.tipo, { tab, alvo, modo: entrada.modo, mirar, sorteio, promove: entrada.promove })
      if (!base) continue
      const { eventos, duracao } = eventosDaPeca(base, tab, t)
      const peca = { ...base, eventos, duracao }
      const novas = casasDasPecas([peca])
      if ([...novas.keys()].some((k) => protegidas.has(k))) continue
      const uniao = new Map([...ocupadas, ...novas])
      const chaves = new Set(uniao.keys())
      if (!temRefugio(tab, chaves)) continue
      if (alvos.length && !alvos.every((p) => refugioAlcancavel(grade, chaves, p, alcance))) continue
      pecas.push(peca)
      for (const [k, v] of novas) ocupadas.set(k, v)
      break
    }
  }
  return { pecas, duracao: Math.max(0, ...pecas.map((p) => p.duracao)), ocupadas }
}

// ---------- XEQUE ----------

// O XEQUE: uma torre dá xeque num coração (J): a gaiola 2 x 2 de baixo prende J e, depois do aviso longo, a
// torre golpeia a gaiola toda. O parceiro CAPTURA a torre pisando na casa dela (lá em cima) e salva J.
//   vivos   [bool] quem está de pé (precisa de 2 ou mais)
// Devolve null (sem xeque) ou { j, gaiola: { c0, r0, c1, r1, casas }, captura: { c, r }, parceiros, protegidas }
export function planejarXeque({ grade, vivos, sorteio }) {
  const tab = grade
  const emPe = vivos.map((v, j) => (v ? j : -1)).filter((j) => j >= 0)
  if (emPe.length < 2) return null
  // onde cada um nasce: lado a lado, na ordem de quem está no quadro (a mesma conta da arena)
  const inicioDe = (j) => {
    const p = inicioDoCoracaoNaGrade(grade, emPe.indexOf(j), emPe.length)
    return celulaEm(grade, p.x, p.y)
  }
  const j = emPe[Math.floor(sorteio() * emPe.length) % emPe.length]
  const parceiros = emPe.filter((k) => k !== j)
  const inicio = inicioDe(j)
  const c0 = limitar(inicio.c - (sorteio() < 0.5 ? 0 : 1), 0, tab.colunas - 2)
  const r0 = tab.linhas - 2
  const casas = []
  for (let r = r0; r <= tab.linhas - 1; r++) for (let c = c0; c <= c0 + 1; c++) casas.push({ c, r })
  const gaiola = { c0, r0, c1: c0 + 1, r1: tab.linhas - 1, casas }
  // a peça do xeque fica na parte de cima, perto de um parceiro (ele chega em menos de 1 s)
  const parceiro = parceiros[Math.floor(sorteio() * parceiros.length) % parceiros.length]
  const base = inicioDe(parceiro)
  const coluna = limitar(base.c + Math.floor(sorteio() * 3) - 1, 0, tab.colunas - 1)
  const linha = sorteio() < 0.5 ? 0 : 1
  const captura = { c: coluna, r: linha }
  const protegidas = new Set(casas.map((x) => chave(x.c, x.r)))
  for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (dentro(tab, captura.c + dc, captura.r + dr)) protegidas.add(chave(captura.c + dc, captura.r + dr))
  return { j, gaiola, captura, parceiros, protegidas }
}

// o retângulo da gaiola em pixels (a gaiola prende o coração aqui dentro)
export function retanguloDaGaiola(g, gaiola) {
  const a = retanguloDe(g, gaiola.c0, gaiola.r0)
  const b = retanguloDe(g, gaiola.c1, gaiola.r1)
  return { left: a.x, top: a.y, right: b.x + b.largura, bottom: b.y + b.altura }
}

// Prende (x, y) dentro do retângulo com uma margem (o raio do coração): devolve o quanto empurrar
export function empurraoParaDentro(ret, x, y, margem = 7) {
  const nx = limitar(x, ret.left + margem, ret.right - margem)
  const ny = limitar(y, ret.top + margem, ret.bottom - margem)
  return { dx: nx - x, dy: ny - y }
}

// ---------- ROQUE ----------

// O ROQUE troca os lados: cada coração vai para o ponto espelhado (em x) do tabuleiro. Devolve o
// quanto empurrar o coração que está em x (só depende do próprio coração: vale em qualquer PC)
export function empurraoDoRoque(g, x) {
  const espelhado = 2 * (g.left + g.width / 2) - x
  return { dx: espelhado - x, dy: 0 }
}
