// O CENÁRIO da campanha (puro: sem Phaser; quem desenha é campanha/desenharCenario.js). "Mundo sombrio
// estilizado" (docs/campanha.md, guia de estilo): lugares conhecidos que ficaram vazios e tortos,
// feitos de geometria simples sobre o preto — chão xadrez fugindo para o escuro, vitrais, portas
// soltas no ar, escadas que não levam a lugar nenhum, feixes finos de luz e poeira parada no ar.
// Cores fortes e poucas (azul-petróleo, carmim, dourado, violeta) sempre sobre o preto.
//
//   const c = gerarCenario('sala', { largura, altura, semente })   determinístico (mesma semente, mesmo cenário)
//   c.fundo            a cor do fundo (quase preto)
//   c.formas           [{ tipo: 'poligono', pontos: [x, y, ...], cor, alpha, luz? }
//                       | { tipo: 'linha', x1, y1, x2, y2, cor, alpha, largura, luz? }]
//                      em ordem de desenho; luz: true = somado (feixes e brilhos)
//   c.particulas       [{ x, y, vx, vy, tam, alto, cor, alpha, fase }]  (px/s)
//   moverParticula(p, dt, largura, altura)   anda e dá a volta pelas bordas (devolve p)
//
// Temas: 'mapa' (a escada que desce), e um por fase do Mundo 1: 'sala', 'corredor', 'ginasio', 'rua',
// 'chuva' e 'quarto' (o chefe). Um tema desconhecido cai no 'mapa'.
import { criarRng, aleatorio } from '../pvp/baralho.js'

export const COR = {
  preto: 0x030208,
  petroleo: 0x1f8a8a,
  petroleoEscuro: 0x0a2a2e,
  carmim: 0xb3162d,
  carmimEscuro: 0x3a0812,
  dourado: 0xe0b84a,
  ouroPalido: 0xf2e2b0,
  violeta: 0x6a3ab0,
  violetaEscuro: 0x1c0f33,
  cinza: 0x9a96b0,
  osso: 0xd8d2e8,
}

const VITRAL = [COR.petroleo, COR.carmim, COR.dourado, COR.violeta]

export const TEMAS = {
  mapa: { fundo: 0x020107, chao: [0x07060f, 0x120c22], acento: COR.violeta, luz: COR.ouroPalido },
  sala: { fundo: 0x020407, chao: [0x05090c, 0x0d2228], acento: COR.petroleo, luz: COR.ouroPalido },
  corredor: { fundo: 0x030306, chao: [0x07070c, 0x16122a], acento: COR.violeta, luz: COR.dourado },
  ginasio: { fundo: 0x040205, chao: [0x080306, 0x2a0a12], acento: COR.carmim, luz: COR.ouroPalido },
  rua: { fundo: 0x020206, chao: [0x050509, 0x0e0e18], acento: COR.dourado, luz: COR.dourado },
  chuva: { fundo: 0x030209, chao: [0x060410, 0x1a0f33], acento: COR.violeta, luz: 0xa8c8e8 },
  quarto: { fundo: 0x050204, chao: [0x070305, 0x2a1408], acento: COR.dourado, luz: COR.ouroPalido },
}

// ---------- primitivas (cada uma devolve formas) ----------

const poli = (pontos, cor, alpha = 1, luz = false) => ({ tipo: 'poligono', pontos: pontos.map((v) => Math.round(v * 10) / 10), cor, alpha, ...(luz ? { luz: true } : {}) })
const linha = (x1, y1, x2, y2, cor, alpha = 1, largura = 1, luz = false) => ({ tipo: 'linha', x1, y1, x2, y2, cor, alpha, largura, ...(luz ? { luz: true } : {}) })
const ret = (x, y, w, h, cor, alpha = 1, luz = false) => poli([x, y, x + w, y, x + w, y + h, x, y + h], cor, alpha, luz)
const contorno = (x, y, w, h, cor, alpha = 1, largura = 1) => [linha(x, y, x + w, y, cor, alpha, largura), linha(x + w, y, x + w, y + h, cor, alpha, largura), linha(x + w, y + h, x, y + h, cor, alpha, largura), linha(x, y + h, x, y, cor, alpha, largura)]
// um retângulo girado (cadeiras e portas soltas no ar)
function girado(cx, cy, w, h, ang) {
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].flatMap(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c])
}

// o chão xadrez em perspectiva, do horizonte até a base; as casas somem perto do horizonte
//   fuga: x do ponto de fuga · base: a largura do chão na borda de baixo · faixa: [x0, x1] limita em cima
export function tabuleiro({ horizonte, altura, fuga, base, linhas = 10, colunas = 14, cores }) {
  const formas = []
  const yDe = (i) => horizonte + (altura - horizonte) * Math.pow(i / linhas, 1.9)
  const xDe = (k, y) => {
    const xb = fuga + (k / colunas - 0.5) * base
    const t = (y - horizonte) / (altura - horizonte)
    return fuga + (xb - fuga) * t
  }
  formas.push(poli([xDe(0, horizonte), horizonte, xDe(colunas, horizonte), horizonte, xDe(colunas, altura), altura, xDe(0, altura), altura], cores[0], 1))
  for (let i = 0; i < linhas; i++) {
    const y0 = yDe(i)
    const y1 = yDe(i + 1)
    const perto = (i + 1) / linhas
    for (let k = 0; k < colunas; k++) {
      if ((i + k) % 2 === 0) continue
      formas.push(poli([xDe(k, y0), y0, xDe(k + 1, y0), y0, xDe(k + 1, y1), y1, xDe(k, y1), y1], cores[1], 0.25 + 0.75 * perto))
    }
  }
  return formas
}

// um vitral em arco: painéis coloridos com o chumbo preto; e o feixe de luz que desce dele
export function vitral(rng, { cx, topo, largura, altura, cores = VITRAL, alpha = 0.7, feixe = null }) {
  const formas = []
  const r = largura / 2
  const yArco = topo + r
  const base = topo + altura
  // moldura
  formas.push(ret(cx - r - 4, yArco, largura + 8, base - yArco + 4, 0x000000, 1))
  const passos = 10
  const arco = []
  for (let k = 0; k <= passos; k++) {
    const a = Math.PI + (Math.PI * k) / passos
    arco.push(cx + Math.cos(a) * (r + 4), yArco + Math.sin(a) * (r + 4))
  }
  formas.push(poli([...arco, cx + r + 4, yArco, cx - r - 4, yArco], 0x000000, 1))
  // painéis retos (3 colunas × n linhas)
  const cols = 3
  const lins = Math.max(2, Math.round((base - yArco) / 34))
  const pw = largura / cols
  const ph = (base - yArco) / lins
  for (let i = 0; i < lins; i++)
    for (let k = 0; k < cols; k++) {
      const cor = cores[Math.floor(aleatorio(rng) * cores.length)]
      formas.push(ret(cx - r + k * pw + 1.5, yArco + i * ph + 1.5, pw - 3, ph - 3, cor, alpha * (0.55 + 0.45 * aleatorio(rng))))
    }
  // o arco em fatias
  const fatias = 4
  for (let k = 0; k < fatias; k++) {
    const a0 = Math.PI + (Math.PI * k) / fatias + 0.04
    const a1 = Math.PI + (Math.PI * (k + 1)) / fatias - 0.04
    const pts = [cx, yArco - 1]
    for (let j = 0; j <= 4; j++) {
      const a = a0 + ((a1 - a0) * j) / 4
      pts.push(cx + Math.cos(a) * (r - 2), yArco - 1 + Math.sin(a) * (r - 2))
    }
    formas.push(poli(pts, cores[(k + Math.floor(aleatorio(rng) * 4)) % cores.length], alpha * 0.9))
  }
  // a rosácea no meio do arco
  formas.push(poli(circulo(cx, yArco - r * 0.45, r * 0.22, 10), COR.dourado, alpha))
  if (feixe) formas.push(poli([cx - r, base, cx + r, base, feixe.x + feixe.largura / 2, feixe.y, feixe.x - feixe.largura / 2, feixe.y], feixe.cor ?? COR.ouroPalido, feixe.alpha ?? 0.07, true))
  return formas
}

export function circulo(cx, cy, r, n = 12) {
  const pts = []
  for (let k = 0; k < n; k++) pts.push(cx + Math.cos((Math.PI * 2 * k) / n) * r, cy + Math.sin((Math.PI * 2 * k) / n) * r)
  return pts
}

// uma porta (de pé, base em y): a folha escura, o batente fino e, se tiver, a luz que escapa
//   luz: 0 (nenhuma) .. 1 (porta entreaberta, a fresta acesa)
export function porta({ x, y, w, h, cor = 0x0c0a14, batente = COR.cinza, luz = 0, corLuz = COR.dourado, ang = 0 }) {
  const formas = []
  if (ang) {
    formas.push(poli(girado(x, y - h / 2, w + 4, h + 4, ang), batente, 0.5))
    formas.push(poli(girado(x, y - h / 2, w, h, ang), cor, 1))
    if (luz > 0) formas.push(poli(girado(x + Math.cos(ang) * (w / 2 - 2), y - h / 2 + Math.sin(ang) * (w / 2 - 2), 2, h - 4, ang), corLuz, 0.4 + 0.5 * luz, true))
    return formas
  }
  const x0 = x - w / 2
  const y0 = y - h
  if (luz > 0) formas.push(poli([x0 - 6, y0 - 6, x0 + w + 6, y0 - 6, x0 + w + 6, y, x0 - 6, y], corLuz, 0.05 + 0.07 * luz, true))
  formas.push(ret(x0, y0, w, h, cor, 1))
  formas.push(...contorno(x0, y0, w, h, batente, 0.8, 1.5))
  // os painéis da folha
  formas.push(...contorno(x0 + w * 0.2, y0 + h * 0.1, w * 0.6, h * 0.32, batente, 0.25, 1))
  formas.push(...contorno(x0 + w * 0.2, y0 + h * 0.5, w * 0.6, h * 0.38, batente, 0.25, 1))
  formas.push(ret(x0 + w * 0.78, y0 + h * 0.52, 2.5, 2.5, COR.dourado, 0.8))
  if (luz > 0) {
    // a fresta embaixo e do lado (entreaberta)
    formas.push(ret(x0 + 1, y - 2, w - 2, 2, corLuz, 0.4 + 0.45 * luz, true))
    formas.push(ret(x0 + w - 3, y0 + 2, 2, h - 4, corLuz, 0.25 + 0.6 * luz, true))
    // a luz no chão, saindo pela fresta
    formas.push(poli([x0, y, x0 + w, y, x0 + w + w * 0.6, y + 14, x0 - w * 0.6, y + 14], corLuz, 0.06 + 0.1 * luz, true))
  }
  return formas
}

// uma escada (degraus vistos de lado, com o espelho e a quina acesa)
//   de (x, y) andando dx por degrau e subindo -dy (dy > 0 desce)
export function escada({ x, y, degraus, dx, dy, espessura = 10, cor = 0x0e0b18, quina = COR.cinza, alphaQuina = 0.5 }) {
  const formas = []
  for (let k = 0; k < degraus; k++) {
    const px = x + k * dx
    const py = y + k * dy
    const w = Math.abs(dx) + 1
    const x0 = dx >= 0 ? px : px + dx
    formas.push(ret(x0, py, w, espessura, cor, 1))
    formas.push(linha(x0, py, x0 + w, py, quina, alphaQuina * (0.5 + (0.5 * (k + 1)) / degraus), 1))
  }
  return formas
}

// um feixe de luz fino caindo na diagonal
export const feixe = (x, y, largura, comprimento, inclinacao, cor, alpha = 0.06) => poli([x, y, x + largura, y, x + largura + inclinacao * comprimento, y + comprimento, x + inclinacao * comprimento, y + comprimento], cor, alpha, true)

// a vinheta: o escuro fechando pelas bordas
function vinheta(largura, altura, cor = 0x000000) {
  const formas = []
  for (let k = 0; k < 6; k++) {
    const m = 4 + k * 10
    const a = 0.16
    formas.push(ret(0, 0, largura, m, cor, a), ret(0, altura - m, largura, m, cor, a), ret(0, m, m, altura - 2 * m, cor, a), ret(largura - m, m, m, altura - 2 * m, cor, a))
  }
  return formas
}

// ---------- partículas ----------

function particulas(rng, n, { largura, altura, tipo = 'poeira', cor, alpha = 0.35 }) {
  return Array.from({ length: n }, () => {
    const p = { x: aleatorio(rng) * largura, y: aleatorio(rng) * altura, tam: 1 + Math.floor(aleatorio(rng) * 2), alto: 0, cor, alpha: alpha * (0.4 + 0.6 * aleatorio(rng)), fase: aleatorio(rng) * Math.PI * 2, vx: 0, vy: 0 }
    if (tipo === 'poeira') Object.assign(p, { vx: (aleatorio(rng) - 0.5) * 4, vy: -(2 + aleatorio(rng) * 5) })
    else if (tipo === 'cinza') Object.assign(p, { vx: (aleatorio(rng) - 0.3) * 6, vy: 8 + aleatorio(rng) * 10 })
    else if (tipo === 'gota') Object.assign(p, { vx: 0, vy: 26 + aleatorio(rng) * 18, tam: 1, alto: 6 + Math.floor(aleatorio(rng) * 6) })
    return p
  })
}

export function moverParticula(p, dt, largura, altura) {
  const s = dt / 1000
  p.x += p.vx * s
  p.y += p.vy * s
  if (p.y < -12) p.y += altura + 24
  if (p.y > altura + 12) p.y -= altura + 24
  if (p.x < -12) p.x += largura + 24
  if (p.x > largura + 12) p.x -= largura + 24
  return p
}

// ---------- os lugares ----------

function mapa(rng, L, A, t) {
  const f = []
  // um vitral enorme e distante, quase apagado, e os feixes descendo na diagonal
  f.push(...vitral(rng, { cx: L * 0.5, topo: 18, largura: 150, altura: 230, alpha: 0.22, feixe: { x: L * 0.62, y: A, largura: 380, alpha: 0.035 } }))
  for (let k = 0; k < 4; k++) f.push(feixe(80 + k * 190 + aleatorio(rng) * 40, 0, 6 + aleatorio(rng) * 6, A, 0.35, t.luz, 0.03 + aleatorio(rng) * 0.025))
  // portas soltas no escuro, longe (pequenas, tortas, apagadas)
  for (let k = 0; k < 7; k++) {
    const x = 30 + aleatorio(rng) * (L - 60)
    const y = 40 + aleatorio(rng) * 120
    const s = 0.35 + aleatorio(rng) * 0.35
    f.push(...porta({ x, y, w: 26 * s, h: 44 * s, ang: (aleatorio(rng) - 0.5) * 0.9, batente: k % 3 ? 0x3a3550 : COR.violeta, luz: k === 2 ? 0.6 : 0 }))
  }
  // uma escada impossível ao fundo, subindo para fora da tela
  f.push(...escada({ x: L * 0.08, y: A * 0.36, degraus: 9, dx: 12, dy: -9, espessura: 7, cor: 0x0a0814, quina: COR.violeta, alphaQuina: 0.35 }))
  f.push(...escada({ x: L * 0.86, y: A * 0.2, degraus: 7, dx: -11, dy: 8, espessura: 7, cor: 0x0a0814, quina: COR.petroleo, alphaQuina: 0.3 }))
  return { formas: f, particulas: particulas(rng, 34, { largura: L, altura: A, cor: t.luz, alpha: 0.35 }) }
}

function sala(rng, L, A, t) {
  const f = []
  const h = 258
  f.push(...tabuleiro({ horizonte: h, altura: A, fuga: L * 0.5, base: L * 1.9, cores: t.chao }))
  // o quadro-negro com a lição pela metade
  f.push(ret(L * 0.3, 84, L * 0.4, 92, 0x08140f, 1), ...contorno(L * 0.3, 84, L * 0.4, 92, 0x3a3550, 0.9, 2))
  for (let k = 0; k < 4; k++) f.push(linha(L * 0.33, 104 + k * 16, L * 0.33 + (k === 3 ? 40 : 90 + aleatorio(rng) * 140), 104 + k * 16, COR.osso, 0.28, 1))
  // as cadeiras perto do teto (soltas, girando devagar no ar parado)
  for (let k = 0; k < 7; k++) {
    const x = 40 + k * 120 + (aleatorio(rng) - 0.5) * 40
    const y = 30 + aleatorio(rng) * 40
    const a = (aleatorio(rng) - 0.5) * 2.4
    f.push(poli(girado(x, y, 22, 4, a), 0x1a1a2a, 1), poli(girado(x - Math.sin(a) * 10, y + Math.cos(a) * 10 - 6, 4, 18, a), 0x1a1a2a, 1))
  }
  // a janela-vitral e o feixe que cai na mesa
  f.push(...vitral(rng, { cx: L * 0.86, topo: 70, largura: 70, altura: 150, alpha: 0.55, feixe: { x: L * 0.55, y: A, largura: 160, alpha: 0.06 } }))
  // a mesa do professor
  f.push(ret(L * 0.42, h + 16, L * 0.16, 8, 0x14121e, 1), ret(L * 0.43, h + 24, 4, 26, 0x14121e, 1), ret(L * 0.57 - 4, h + 24, 4, 26, 0x14121e, 1))
  f.push(ret(L * 0.48, h + 12, 12, 4, COR.osso, 0.6)) // o bilhete dobrado
  return { formas: f, particulas: particulas(rng, 28, { largura: L, altura: A, cor: t.luz, alpha: 0.3 }) }
}

function corredor(rng, L, A, t) {
  const f = []
  const h = 220
  const vx = L * 0.5
  f.push(...tabuleiro({ horizonte: h, altura: A, fuga: vx, base: L * 1.2, colunas: 8, linhas: 12, cores: t.chao }))
  // as paredes que fecham, com os armários
  const porta0 = { w: 34, h: 56 }
  const xe = vx - porta0.w * 1.2
  const xd = vx + porta0.w * 1.2
  const topoFundo = h - porta0.h - 20
  f.push(poli([0, 0, xe, topoFundo, xe, h, 0, A], 0x08070f, 1), poli([L, 0, xd, topoFundo, xd, h, L, A], 0x08070f, 1))
  for (let k = 1; k <= 9; k++) {
    const s = Math.pow(k / 10, 1.6)
    const xa = xe * (1 - s)
    const xb = L - (L - xd) * (1 - s)
    const yTopo = topoFundo * s
    const yBase = h + (A - h) * (1 - s)
    f.push(linha(xa, yTopo + (h - yTopo) * 0.12, xa, yBase - (yBase - h) * 0.1, t.acento, 0.18 + 0.25 * (1 - s), 1))
    f.push(linha(xb, yTopo + (h - yTopo) * 0.12, xb, yBase - (yBase - h) * 0.1, t.acento, 0.18 + 0.25 * (1 - s), 1))
  }
  f.push(linha(0, 0, xe, topoFundo, COR.violeta, 0.45, 1.5), linha(L, 0, xd, topoFundo, COR.violeta, 0.45, 1.5), linha(0, A, xe, h, COR.violeta, 0.3, 1), linha(L, A, xd, h, COR.violeta, 0.3, 1))
  // a porta lá no fim, acesa
  f.push(...porta({ x: vx, y: h, w: porta0.w, h: porta0.h, luz: 0.8 }))
  f.push(feixe(vx - 12, h, 24, A - h, 0, t.luz, 0.04))
  // luzes do teto: uma acesa, as outras não
  for (let k = 0; k < 4; k++) {
    const s = 0.2 + k * 0.2
    f.push(ret(vx - 30 * (1 - s) - 10, topoFundo * s + 10, 60 * (1 - s) + 20, 3, k === 1 ? t.luz : 0x2a2838, k === 1 ? 0.8 : 0.6, k === 1))
  }
  return { formas: f, particulas: particulas(rng, 26, { largura: L, altura: A, cor: t.luz, alpha: 0.3 }) }
}

function ginasio(rng, L, A, t) {
  const f = []
  const h = 238
  // a arquibancada vazia ao fundo
  for (let k = 0; k < 6; k++) f.push(ret(0, h - 18 - k * 18, L, 10, 0x0e0610, 1), linha(0, h - 18 - k * 18, L, h - 18 - k * 18, COR.carmim, 0.18, 1))
  f.push(...tabuleiro({ horizonte: h, altura: A, fuga: L * 0.5, base: L * 2.2, linhas: 9, colunas: 12, cores: t.chao }))
  // as lâmpadas penduradas, os cones de luz (só duas acesas)
  for (let k = 0; k < 5; k++) {
    const x = 90 + k * 170
    const acesa = k === 1 || k === 3
    f.push(linha(x, 0, x, 56, 0x3a3550, 0.9, 1), poli([x - 14, 66, x + 14, 66, x + 7, 56, x - 7, 56], acesa ? 0x2a2210 : 0x151320, 1))
    if (acesa) f.push(poli([x - 14, 66, x + 14, 66, x + 70, A, x - 70, A], t.luz, 0.05, true), ret(x - 12, 65, 24, 2, t.luz, 0.9, true))
  }
  // a tabela e o aro, tortos
  f.push(poli(girado(L * 0.5, 112, 86, 56, 0.06), 0x0c0a14, 1), ...contorno(L * 0.5 - 22, 112, 44, 26, COR.osso, 0.4, 1))
  f.push(linha(L * 0.5 - 14, 146, L * 0.5 + 14, 148, COR.carmim, 0.8, 2))
  // o troféu esquecido no chão
  f.push(poli([L * 0.78 - 8, h + 40, L * 0.78 + 8, h + 40, L * 0.78 + 4, h + 28, L * 0.78 - 4, h + 28], COR.dourado, 0.7), ret(L * 0.78 - 2, h + 40, 4, 8, COR.dourado, 0.6))
  return { formas: f, particulas: particulas(rng, 30, { largura: L, altura: A, cor: t.luz, alpha: 0.32 }) }
}

function rua(rng, L, A, t) {
  const f = []
  const h = 210
  const vx = L * 0.46
  // as casas do bairro, recortadas no escuro, cada uma com uma janela só
  let x = -10
  while (x < L) {
    const w = 60 + aleatorio(rng) * 70
    const alt = 40 + aleatorio(rng) * 60
    f.push(ret(x, h - alt, w - 6, alt, 0x07070d, 1), poli([x - 4, h - alt, x + w / 2 - 3, h - alt - 22, x + w - 2, h - alt], 0x07070d, 1))
    if (aleatorio(rng) < 0.55) f.push(ret(x + w * 0.35, h - alt + 14, 9, 9, aleatorio(rng) < 0.3 ? t.luz : 0x1a1826, aleatorio(rng) < 0.3 ? 0.7 : 1))
    x += w
  }
  // a rua que não termina
  f.push(poli([0, h, L, h, L, A, 0, A], 0x040408, 1))
  f.push(poli([vx - 2, h, vx + 2, h, vx + L * 0.55, A, vx - L * 0.55, A], 0x0b0b14, 1))
  for (let k = 0; k < 10; k++) {
    const s0 = Math.pow(k / 10, 2)
    const s1 = Math.pow((k + 0.45) / 10, 2)
    f.push(poli([vx - 1 - 3 * s0, h + (A - h) * s0, vx + 1 + 3 * s0, h + (A - h) * s0, vx + 1 + 3 * s1, h + (A - h) * s1, vx - 1 - 3 * s1, h + (A - h) * s1], t.acento, 0.15 + 0.3 * s0))
  }
  // os postes (os de perto acesos, os de longe apagados)
  for (let k = 0; k < 5; k++) {
    const s = Math.pow((k + 1) / 5, 1.4)
    for (const lado of [-1, 1]) {
      const px = vx + lado * (12 + L * 0.5 * s)
      const base = h + (A - h) * s
      const alto = 30 + 150 * s
      const acesa = k >= 3 && lado === -1
      f.push(linha(px, base, px, base - alto, 0x22202e, 1, Math.max(1, 3 * s)), linha(px, base - alto, px - lado * 14 * s, base - alto, 0x22202e, 1, Math.max(1, 2 * s)))
      if (acesa) f.push(poli([px - lado * 14 * s - 3, base - alto + 2, px - lado * 14 * s + 3, base - alto + 2, px - lado * 14 * s + 50 * s, base, px - lado * 14 * s - 50 * s, base], t.luz, 0.07, true), ret(px - lado * 14 * s - 4, base - alto, 8, 3, t.luz, 0.9, true))
    }
  }
  return { formas: f, particulas: particulas(rng, 22, { largura: L, altura: A, tipo: 'cinza', cor: COR.cinza, alpha: 0.3 }) }
}

function chuva(rng, L, A, t) {
  const f = []
  const h = 250
  f.push(...tabuleiro({ horizonte: h, altura: A, fuga: L * 0.52, base: L * 1.8, cores: t.chao }))
  // a janela grande da sala, um vitral frio
  f.push(...vitral(rng, { cx: L * 0.5, topo: 40, largura: 110, altura: 190, cores: [COR.violeta, COR.petroleo, 0x2a4a8a, COR.carmim], alpha: 0.5, feixe: { x: L * 0.5, y: A, largura: 260, cor: t.luz, alpha: 0.045 } }))
  // quadros vazios na parede
  for (const [qx, qy, qw, qh] of [[L * 0.14, 80, 56, 40], [L * 0.24, 140, 34, 46], [L * 0.75, 90, 46, 60], [L * 0.86, 150, 40, 30]]) f.push(...contorno(qx, qy, qw, qh, COR.dourado, 0.35, 1.5))
  // o sofá e o violão encostado
  f.push(ret(L * 0.66, h + 6, 150, 34, 0x120a22, 1), ret(L * 0.66, h - 10, 150, 18, 0x0e081a, 1), ret(L * 0.66 - 8, h - 2, 12, 42, 0x0e081a, 1), ret(L * 0.66 + 146, h - 2, 12, 42, 0x0e081a, 1))
  f.push(poli(circulo(L * 0.66 + 40, h + 10, 11, 10), 0x2a1408, 1), linha(L * 0.66 + 40, h, L * 0.66 + 52, h - 40, 0x2a1408, 1, 3))
  return { formas: f, particulas: [...particulas(rng, 60, { largura: L, altura: A, tipo: 'gota', cor: 0x8ab0e0, alpha: 0.35 }), ...particulas(rng, 12, { largura: L, altura: A, cor: t.luz, alpha: 0.25 })] }
}

function quarto(rng, L, A, t) {
  const f = []
  const h = 236
  const vx = L * 0.5
  // a rosácea lá em cima
  f.push(poli(circulo(vx, 70, 58, 24), 0x000000, 1))
  for (let k = 0; k < 12; k++) {
    const a0 = (Math.PI * 2 * k) / 12
    const a1 = (Math.PI * 2 * (k + 1)) / 12 - 0.06
    f.push(poli([vx, 70, vx + Math.cos(a0) * 54, 70 + Math.sin(a0) * 54, vx + Math.cos(a1) * 54, 70 + Math.sin(a1) * 54], VITRAL[k % 4], 0.5))
  }
  f.push(poli(circulo(vx, 70, 16, 12), COR.dourado, 0.8))
  f.push(...tabuleiro({ horizonte: h, altura: A, fuga: vx, base: L * 1.6, linhas: 11, colunas: 10, cores: t.chao }))
  // as escadas impossíveis dos dois lados
  f.push(...escada({ x: 40, y: h - 4, degraus: 12, dx: 14, dy: -11, espessura: 9, cor: 0x0e0810, quina: COR.dourado, alphaQuina: 0.4 }))
  f.push(...escada({ x: L - 54, y: 80, degraus: 12, dx: -14, dy: 13, espessura: 9, cor: 0x0e0810, quina: COR.carmim, alphaQuina: 0.4 }))
  // portas soltas no ar
  for (let k = 0; k < 8; k++) {
    const x = 60 + aleatorio(rng) * (L - 120)
    const y = 40 + aleatorio(rng) * 140
    if (Math.abs(x - vx) < 80 && y < 130) continue
    const s = 0.3 + aleatorio(rng) * 0.4
    f.push(...porta({ x, y, w: 30 * s, h: 50 * s, ang: (aleatorio(rng) - 0.5) * 1.2, batente: k % 2 ? COR.carmim : 0x3a3550, luz: k % 3 === 0 ? 0.5 : 0 }))
  }
  // a porta do quarto, acesa por trás, e a luz que se derrama no chão
  f.push(poli([vx - 24, h, vx + 24, h, vx + 150, A, vx - 150, A], t.luz, 0.05, true))
  f.push(...porta({ x: vx, y: h, w: 44, h: 72, luz: 1, batente: COR.dourado }))
  return { formas: f, particulas: particulas(rng, 36, { largura: L, altura: A, cor: t.luz, alpha: 0.35 }) }
}

const LUGARES = { mapa, sala, corredor, ginasio, rua, chuva, quarto }

export function gerarCenario(tema, { largura = 854, altura = 480, semente = null } = {}) {
  const nome = LUGARES[tema] ? tema : 'mapa'
  const t = TEMAS[nome]
  const rng = criarRng(`campanha:cenario:${semente ?? nome}`)
  const { formas, particulas: ps } = LUGARES[nome](rng, largura, altura, t)
  return { tema: nome, fundo: t.fundo, acento: t.acento, luz: t.luz, formas: [...formas, ...vinheta(largura, altura)], particulas: ps }
}
