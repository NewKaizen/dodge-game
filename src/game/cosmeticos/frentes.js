// ESTILOS DA FRENTE DA CARTA (cosmético, 0016; docs/cosmeticos.md): como a face das SUAS cartas é desenhada.
// Sem Phaser (os testes rodam com uma cena de mentira). A Carta (entities/Carta.js) chama, pela ponte
// (cosmeticosSlots.js frenteNaCarta), desenharFrente(scene, carta, id); o estilo devolve o TEMA para
// carta.montarFrente(tema), que mantém a disposição de sempre: valor e naipe nos cantos (o de baixo invertido),
// miolo, faixa do nome, gema de custo, o "×" de bloqueada e a moldura arco-íris do SUPER. Assim valor, naipe,
// cor (vermelho: copas e ouros; escuro: espadas e paus) e o formato de cada naipe continuam legíveis.
//
//   ESTILOS_FRENTE                       [{ id, nome, raridade }] (o 0 é a clássica, de graça)
//   desenharFrente(scene, carta, id)     true = desenhou; erro sobe (a ponte pega e a Carta faz a clássica)
//   texturaFundo(scene, id)              a textura do fundo do estilo (uma por jogo) -> chave | null
//   miniaturaFrente(scene, id)           textura parada de uma carta de amostra (Coleção, roleta) -> chave | null
//   previaFrente(scene, id, x, y, tam)   duas cartas de verdade no estilo (Coleção, galeria) -> { destroy() }
//   temRenderizadorFrente(id)
//
// Desempenho: o fundo de cada estilo é pintado UMA vez por jogo numa textura de canvas (pintura.js) e cada
// carta só põe uma imagem dele; os desenhos por carta (naipes, faixa) são Graphics parados. Só a Sakura (pétalas
// caindo) e a Holográfica (o brilho que passa) animam, por um ouvinte de 'update' que some com a carta e com a
// cena (util.ligarAtualizacao); com "reduzir animações" ficam paradas.
import { TAU, cartao, estrela, florSakura, folhaBordo, grao, naipeCanvas, semente, textura, hex } from './pintura.js'
import { garantirTexturas, ligarAtualizacao, reduzido } from './util.js'
import { classeCarta } from '../cosmeticosSlots.js'
import { semLigaduras } from '../campanha/texto.js'

export const ESTILOS_FRENTE = [
  { id: 'frente-classica', nome: 'Clássica', raridade: 'comum' },
  { id: 'frente-mal-desenhada', nome: 'Mal Desenhada', raridade: 'comum' },
  { id: 'frente-jornal', nome: 'Jornal', raridade: 'comum' },
  { id: 'frente-pixel', nome: 'Pixel 8-bit', raridade: 'raro' },
  { id: 'frente-sakura', nome: 'Sakura', raridade: 'raro' },
  { id: 'frente-cervos-nara', nome: 'Cervos de Nara', raridade: 'raro' },
  { id: 'frente-dark', nome: 'Dark Mode', raridade: 'raro' },
  { id: 'frente-aquarela', nome: 'Aquarela', raridade: 'epico' },
  { id: 'frente-origami', nome: 'Origami', raridade: 'epico' },
  { id: 'frente-holografica', nome: 'Holográfica', raridade: 'epico' },
  { id: 'frente-tarot', nome: 'Tarot', raridade: 'lendario' },
]

// a textura do fundo: 3 px por unidade da carta de referência (70 x 100); as cartas grandes (ampliadas)
// continuam nítidas
const TW = 210
const TH = 300
const ROMANOS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII']

// pinta em unidades da carta (-35..35 x -50..50)
const emUnidades = (pintar) => (c, w, h) => {
  c.save()
  c.translate(w / 2, h / 2)
  c.scale(w / 70, h / 100)
  pintar(c)
  c.restore()
}

// ---------- formas dos naipes (as da Carta, em polígonos de raio 1) ----------

function poligonos(formas, naipe) {
  return (formas?.[naipe] ?? []).map((f) =>
    f.tipo === 'circulo'
      ? Array.from({ length: 14 }, (_, i) => ({ x: f.x + Math.cos((i * TAU) / 14) * f.r, y: f.y + Math.sin((i * TAU) / 14) * f.r }))
      : f.pontos.map((p) => ({ x: p.x, y: p.y })),
  )
}

function dentro(polis, x, y) {
  for (const p of polis) {
    let ok = false
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      if (p[i].y > y !== p[j].y > y && x < ((p[j].x - p[i].x) * (y - p[i].y)) / (p[j].y - p[i].y) + p[i].x) ok = !ok
    }
    if (ok) return true
  }
  return false
}

// preenche os polígonos do naipe em (x, y), raio r (s = -1: de cabeça para baixo), deslocado (dx, dy)
function encher(g, polis, x, y, r, s, dx = 0, dy = 0, mapa = null) {
  for (const p of polis) g.fillPoints(p.map((q) => (mapa ? mapa(q) : q)).map((q) => ({ x: x + q.x * r * s + dx, y: y + q.y * r * s + dy })), true)
}

const hashDe = (x, y, k = 0) => Math.abs(Math.round(x * 131 + y * 977 + k * 7919)) + 1

// ---------- os naipes de cada estilo ----------

// rabisco de giz de cera: miolo riscado, contorno tremido duas vezes
function naipeRabisco(g, naipe, x, y, r, cor, alpha, inv, ctx) {
  const s = inv ? -1 : 1
  const polis = poligonos(ctx.formas, naipe)
  const rnd = semente(hashDe(x, y, naipe.length))
  g.fillStyle(cor, 0.22 * alpha)
  encher(g, polis, x, y, r * 1.02, s)
  // o miolo riscado (diagonais só dentro do naipe)
  g.lineStyle(Math.max(0.5, r * 0.11), cor, 0.75 * alpha)
  const passo = r > 6 ? 0.26 : 0.4
  for (let k = -2; k <= 2; k += passo) {
    let ant = null
    for (let i = 0; i <= 14; i++) {
      const ux = -1.1 + (i * 2.2) / 14
      const uy = ux + k
      const ok = dentro(polis, ux, uy)
      const p = { x: x + (ux * r + (rnd() - 0.5) * r * 0.08) * s, y: y + (uy * r + (rnd() - 0.5) * r * 0.08) * s }
      if (ok && ant) g.lineBetween(ant.x, ant.y, p.x, p.y)
      ant = ok ? p : null
    }
  }
  // contorno tremido
  for (let vez = 0; vez < 2; vez++) {
    g.lineStyle(Math.max(0.6, r * (vez ? 0.09 : 0.14)), cor, alpha * (vez ? 0.7 : 1))
    for (const p of polis) {
      g.strokePoints(p.map((q) => ({ x: x + (q.x * r + (rnd() - 0.5) * r * 0.12) * s, y: y + (q.y * r + (rnd() - 0.5) * r * 0.12) * s })), true)
    }
  }
}

// 8-bit: o naipe numa grade de pixels (9 x 9), com um pixel de brilho
const MASCARAS = new Map()
function mascara(formas, naipe) {
  if (MASCARAS.has(naipe)) return MASCARAS.get(naipe)
  const polis = poligonos(formas, naipe)
  const N = 9
  const k = naipe === 'ouros' ? 0.82 : 0.92 // amostra um tiquinho para dentro: o losango não vira cruz
  const m = []
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (dentro(polis, (-1 + ((i + 0.5) * 2) / N) * k, (-1 + ((j + 0.5) * 2) / N) * k)) m.push([i, j])
  MASCARAS.set(naipe, m)
  return m
}
function naipePixel(g, naipe, x, y, r, cor, alpha, inv, ctx) {
  const N = 9
  const c = (r * 2) / N
  const s = inv ? -1 : 1
  const m = mascara(ctx.formas, naipe)
  g.fillStyle(cor, alpha)
  for (const [i, j] of m) {
    const px = x + (-1 + (i * 2) / N) * r * s
    const py = y + (-1 + (j * 2) / N) * r * s
    g.fillRect(s > 0 ? px : px - c, s > 0 ? py : py - c, c + 0.02, c + 0.02)
  }
  // brilho: o pixel de cima à esquerda de cada linha de cima
  const topo = Math.min(...m.map(([, j]) => j))
  const brilho = m.filter(([, j]) => j === topo + 1)[0]
  if (brilho && r > 3) {
    const [i, j] = brilho
    const px = x + (-1 + ((i + 0.5) * 2) / N) * r * s
    const py = y + (-1 + ((j + 0.5) * 2) / N) * r * s
    g.fillStyle(0xffffff, 0.3 * alpha)
    g.fillRect(px - c / 2, py - c / 2, c, c)
  }
}

// neon: halo em duas camadas e um miolo quente
function naipeNeon(g, naipe, x, y, r, cor, alpha, inv, ctx) {
  const s = inv ? -1 : 1
  const polis = poligonos(ctx.formas, naipe)
  g.fillStyle(cor, 0.12 * alpha)
  encher(g, polis, x, y, r * 1.38, s)
  g.fillStyle(cor, 0.22 * alpha)
  encher(g, polis, x, y, r * 1.16, s)
  g.fillStyle(cor, alpha)
  encher(g, polis, x, y, r, s)
  g.fillStyle(0xffffff, 0.28 * alpha)
  encher(g, polis, x, y, r * 0.5, s)
}

// aquarela: a tinta escorre (duas manchas claras deslocadas) e seca mais escura no meio
function naipeAquarela(g, naipe, x, y, r, cor, alpha, inv, ctx) {
  const s = inv ? -1 : 1
  const polis = poligonos(ctx.formas, naipe)
  g.fillStyle(cor, 0.16 * alpha)
  encher(g, polis, x, y, r * 1.2, s, r * 0.1, r * 0.08)
  g.fillStyle(cor, 0.2 * alpha)
  encher(g, polis, x, y, r * 1.08, s, -r * 0.07, r * 0.05)
  g.fillStyle(cor, 0.82 * alpha)
  encher(g, polis, x, y, r * 0.96, s)
  g.fillStyle(0xffffff, 0.22 * alpha)
  g.fillEllipse(x - r * 0.3 * s, y - r * 0.25 * s, r * 0.5, r * 0.36)
}

// origami: a metade da direita na sombra da dobra
function naipeOrigami(g, naipe, x, y, r, cor, alpha, inv, ctx) {
  const s = inv ? -1 : 1
  const polis = poligonos(ctx.formas, naipe)
  g.fillStyle(cor, alpha)
  encher(g, polis, x, y, r, s)
  g.fillStyle(0x000000, 0.22 * alpha)
  encher(g, polis, x, y, r, s, 0, 0, (q) => ({ x: Math.max(q.x, 0), y: q.y }))
  g.fillStyle(0xffffff, 0.18 * alpha)
  encher(g, polis, x, y, r, s, 0, 0, (q) => ({ x: Math.min(q.x, 0), y: Math.min(q.y, -0.2) }))
}

const radial = (c, x, y, r, paradas) => {
  const g = c.createRadialGradient(x, y, 0, x, y, r)
  for (const [k, cor] of paradas) g.addColorStop(k, cor)
  return g
}

// ---------- os fundos (canvas, uma textura por estilo) ----------

// contorno tremido de um retângulo arredondado (giz de cera)
function bordaTremida(c, rnd, inset, amp, largura, cor) {
  const x0 = -35 + inset
  const y0 = -50 + inset
  const w = 70 - inset * 2
  const h = 100 - inset * 2
  const pts = []
  const passo = 1.6
  for (let x = x0 + 4; x <= x0 + w - 4; x += passo) pts.push([x, y0])
  for (let y = y0 + 4; y <= y0 + h - 4; y += passo) pts.push([x0 + w, y])
  for (let x = x0 + w - 4; x >= x0 + 4; x -= passo) pts.push([x, y0 + h])
  for (let y = y0 + h - 4; y >= y0 + 4; y -= passo) pts.push([x0, y])
  c.strokeStyle = cor
  c.lineWidth = largura
  c.lineJoin = 'round'
  c.lineCap = 'round'
  c.beginPath()
  pts.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](x + (rnd() - 0.5) * amp, y + (rnd() - 0.5) * amp))
  c.closePath()
  c.stroke()
}

const FUNDOS = {
  'frente-mal-desenhada': (c) => {
    const rnd = semente(11)
    c.fillStyle = '#fbf8ee'
    cartao(c, -35, -50, 70, 100, 6)
    c.fill()
    c.save()
    cartao(c, -35, -50, 70, 100, 6)
    c.clip()
    // caderno: pautas azuis e a margem vermelha
    c.lineWidth = 0.32
    c.strokeStyle = 'rgba(80,130,220,0.22)'
    for (let y = -42; y < 48; y += 5.5) {
      c.beginPath()
      c.moveTo(-35, y + (rnd() - 0.5) * 0.4)
      c.lineTo(35, y + (rnd() - 0.5) * 0.4)
      c.stroke()
    }
    c.strokeStyle = 'rgba(220,70,90,0.25)'
    c.beginPath()
    c.moveTo(-21.5, -50)
    c.lineTo(-21.2, 50)
    c.stroke()
    // rabisquinhos nas laterais (bem claros)
    c.strokeStyle = 'rgba(60,70,110,0.35)'
    c.lineWidth = 0.55
    estrela(c, -28, 6, 3, 5, 0.45)
    c.stroke()
    c.beginPath()
    for (let a = 0; a < TAU * 2.2; a += 0.25) c.lineTo(28 + Math.cos(a) * a * 0.32, -10 + Math.sin(a) * a * 0.32)
    c.stroke()
    c.beginPath()
    c.arc(28, 12, 3, 0, TAU)
    c.moveTo(26.6, 11)
    c.arc(26.6, 11, 0.25, 0, TAU)
    c.moveTo(29.4, 11)
    c.arc(29.4, 11, 0.25, 0, TAU)
    c.moveTo(26.4, 13)
    c.quadraticCurveTo(28, 14.6, 29.6, 13)
    c.stroke()
    c.restore()
    // a borda feita à mão
    bordaTremida(c, rnd, 0.8, 0.9, 1.3, 'rgba(40,40,58,0.9)')
    bordaTremida(c, rnd, 1.1, 1.1, 0.6, 'rgba(40,40,58,0.55)')
    bordaTremida(c, rnd, 3.4, 0.8, 0.45, 'rgba(90,90,130,0.45)')
  },

  'frente-jornal': (c) => {
    const rnd = semente(23)
    c.fillStyle = '#ece5d3'
    cartao(c, -35, -50, 70, 100, 6)
    c.fill()
    c.save()
    cartao(c, -35, -50, 70, 100, 6)
    c.clip()
    grao(c, 70, 100, { n: 500, tam: 0.35, seed: 3, escuro: 'rgba(60,50,30,0.08)', claro: 'rgba(255,255,255,0.25)' })
    // retícula (pontinhos) bem clara no meio
    c.fillStyle = 'rgba(30,28,24,0.06)'
    for (let y = -34; y <= 18; y += 2.2) {
      for (let x = -24; x <= 24; x += 2.2) {
        const d = Math.hypot(x, (y + 8) * 0.8)
        const r = Math.max(0, 0.75 - d / 34)
        if (r > 0.05) {
          c.beginPath()
          c.arc(x + ((y / 2.2) % 2 ? 1.1 : 0), y, r, 0, TAU)
          c.fill()
        }
      }
    }
    // o cabeçalho do jornal
    c.fillStyle = '#25221c'
    c.font = 'bold 4.4px Georgia, "Times New Roman", serif'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText('DIÁRIO DA MESA', -1, -44.4)
    c.fillRect(-17, -41.4, 33, 0.55)
    c.fillRect(-17, -40.5, 33, 0.22)
    c.font = '2px Georgia, serif'
    c.fillText('EDIÇÃO EXTRA · Nº 7', -1, -38.8)
    // colunas de texto nas laterais e embaixo
    const colunas = (x0, x1, y0, y1) => {
      for (let y = y0; y < y1; y += 1.7) {
        const fim = y + 1.7 >= y1 ? x0 + (x1 - x0) * (0.3 + rnd() * 0.4) : x1 - rnd() * 1.5
        c.fillStyle = 'rgba(40,36,30,0.28)'
        c.fillRect(x0, y, fim - x0, 0.62)
      }
    }
    colunas(-33, -21, -24, 17)
    colunas(21, 33, -26, 17)
    colunas(-17, 17, 39.5, 46)
    c.fillStyle = 'rgba(40,36,30,0.55)'
    c.fillRect(-33, -25.5, 12, 0.5)
    c.fillRect(21, -27.5, 12, 0.5)
    // a dobra do jornal
    c.fillStyle = 'rgba(0,0,0,0.07)'
    c.fillRect(-35, -1, 70, 0.6)
    c.fillStyle = 'rgba(255,255,255,0.35)'
    c.fillRect(-35, -0.4, 70, 0.6)
    c.restore()
    c.strokeStyle = '#25221c'
    c.lineWidth = 1.2
    cartao(c, -34.4, -49.4, 68.8, 98.8, 5.6)
    c.stroke()
    c.lineWidth = 0.3
    cartao(c, -32.2, -47.2, 64.4, 94.4, 3.6)
    c.stroke()
  },

  'frente-pixel': (c) => {
    // tudo em quadradinhos de 1 unidade (1 pixel na carta de 70)
    const deg = (x0, y0, w, h, passo, cor) => {
      c.fillStyle = cor
      c.fillRect(x0 + passo * 2, y0, w - passo * 4, h)
      c.fillRect(x0 + passo, y0 + passo, w - passo * 2, h - passo * 2)
      c.fillRect(x0, y0 + passo * 2, w, h - passo * 4)
    }
    deg(-35, -50, 70, 100, 2, '#1b2a1e')
    deg(-33, -48, 66, 96, 2, '#f2efd8')
    // xadrez bem suave
    c.fillStyle = 'rgba(80,120,60,0.07)'
    for (let y = -46; y < 46; y += 4) for (let x = -31; x < 31; x += 4) if (((x + 31) / 4 + (y + 46) / 4) % 2 === 0) c.fillRect(x, y, 4, 4)
    // cantoneiras verdes
    c.fillStyle = '#3a8a4a'
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = sx < 0 ? -31 : 29
      const y = sy < 0 ? -46 : 44
      c.fillRect(x, y, 2, 2)
      c.fillRect(x - sx * 2, y, 2, 2)
      c.fillRect(x, y - sy * 2, 2, 2)
    }
    // moedinhas e estrelinhas de pixel nas laterais
    const moeda = (x, y) => {
      c.fillStyle = '#e8b020'
      c.fillRect(x - 1, y - 2, 2, 4)
      c.fillRect(x - 2, y - 1, 4, 2)
      c.fillStyle = '#fff0a0'
      c.fillRect(x - 1, y - 1, 1, 1)
    }
    moeda(-28, 4)
    moeda(28, -12)
    moeda(28, 10)
    c.fillStyle = 'rgba(60,140,80,0.5)'
    for (const [x, y] of [[-28, -12], [-27, 15], [27, -1]]) {
      c.fillRect(x, y - 1, 1, 3)
      c.fillRect(x - 1, y, 3, 1)
    }
    // sombra de baixo (o "relevo" dos jogos antigos)
    c.fillStyle = 'rgba(0,0,0,0.1)'
    c.fillRect(-31, 46, 62, 2)
    c.fillRect(31, -44, 2, 90)
  },

  'frente-sakura': (c) => {
    const rnd = semente(5)
    const fundo = c.createLinearGradient(0, -50, 0, 50)
    fundo.addColorStop(0, '#fff8fb')
    fundo.addColorStop(0.6, '#ffeef4')
    fundo.addColorStop(1, '#ffdce8')
    c.fillStyle = fundo
    cartao(c, -35, -50, 70, 100, 6)
    c.fill()
    c.save()
    cartao(c, -35, -50, 70, 100, 6)
    c.clip()
    // o galho entrando pela esquerda
    c.strokeStyle = '#6a4048'
    c.lineCap = 'round'
    const galho = (pts, larg) => {
      c.lineWidth = larg
      c.beginPath()
      c.moveTo(...pts[0])
      c.bezierCurveTo(...pts[1], ...pts[2], ...pts[3])
      c.stroke()
    }
    galho([[-38, 16], [-31, 12], [-26, 2], [-22, -6]], 1.7)
    galho([[-29, 7], [-31, 2], [-32, -6], [-29, -15]], 0.9)
    galho([[-25, 0], [-22, 3], [-20, 6], [-20.5, 9]], 0.6)
    galho([[38, 26], [33, 22], [28, 18], [23, 15]], 1.3)
    for (const [x, y, r, a] of [[-22.5, -7, 3.2, 0.2], [-29, -15.5, 2.8, 0.9], [-31.5, 1, 2.6, 0.4], [-20.5, 9.5, 2.2, 1.3], [-26, -9, 1.8, 2], [24, 14.5, 2.8, 0.6], [29.5, 19.6, 2.3, 1.7]]) {
      florSakura(c, x, y, r, a, '#ffb3cc', '#d64a78')
    }
    // botões
    c.fillStyle = '#ff8fb2'
    for (const [x, y] of [[-33.5, -9], [-24.5, 4.5], [27, 21.5]]) {
      c.beginPath()
      c.ellipse(x, y, 0.9, 1.3, 0.5, 0, TAU)
      c.fill()
    }
    // pétalas caídas
    for (let i = 0; i < 14; i++) {
      const x = -32 + rnd() * 64
      const y = -40 + rnd() * 86
      if (Math.abs(x) < 20 && y > -34 && y < 38) continue
      c.fillStyle = `rgba(255,${150 + Math.round(rnd() * 40)},${180 + Math.round(rnd() * 30)},0.65)`
      c.beginPath()
      c.ellipse(x, y, 1.1, 0.6, rnd() * TAU, 0, TAU)
      c.fill()
    }
    c.restore()
    c.strokeStyle = '#b0587a'
    c.lineWidth = 1.2
    cartao(c, -34.4, -49.4, 68.8, 98.8, 5.6)
    c.stroke()
    c.strokeStyle = 'rgba(232,140,170,0.7)'
    c.lineWidth = 0.45
    cartao(c, -31.8, -46.8, 63.6, 93.6, 3.6)
    c.stroke()
  },

  'frente-cervos-nara': (c) => {
    c.fillStyle = '#f6ecd2'
    cartao(c, -35, -50, 70, 100, 6)
    c.fill()
    c.save()
    cartao(c, -35, -50, 70, 100, 6)
    c.clip()
    grao(c, 70, 100, { n: 600, tam: 0.4, seed: 9, escuro: 'rgba(120,80,30,0.07)', claro: 'rgba(255,255,255,0.4)' })
    // fibras do papel (washi)
    const rnd = semente(19)
    c.strokeStyle = 'rgba(150,110,60,0.08)'
    c.lineWidth = 0.25
    for (let i = 0; i < 26; i++) {
      const x = -35 + rnd() * 70
      const y = -50 + rnd() * 100
      c.beginPath()
      c.moveTo(x, y)
      c.quadraticCurveTo(x + 3, y + rnd() * 2, x + 6 * rnd() + 2, y + rnd() * 3)
      c.stroke()
    }
    // o cervo espiando pela esquerda
    const marrom = '#b9773f'
    c.fillStyle = marrom
    c.beginPath()
    c.ellipse(-33, 20, 7.5, 7, 0, 0, TAU) // corpo
    c.fill()
    c.beginPath()
    c.ellipse(-30.5, 12, 3.2, 6, 0.35, 0, TAU) // pescoço
    c.fill()
    c.fillStyle = '#f3e3c4'
    for (const [x, y] of [[-33, 16], [-30.5, 18.5], [-34.5, 22], [-31, 23]]) {
      c.beginPath()
      c.arc(x, y, 0.75, 0, TAU)
      c.fill()
    }
    // chifrinhos
    c.strokeStyle = '#8a5a2a'
    c.lineWidth = 0.7
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(-28.2, 2.5)
    c.lineTo(-29.4, -2.6)
    c.moveTo(-29, -0.4)
    c.lineTo(-31, -1.6)
    c.moveTo(-26.4, 2.2)
    c.lineTo(-25.6, -2.8)
    c.moveTo(-25.9, -0.6)
    c.lineTo(-24, -1.4)
    c.stroke()
    // orelha
    c.fillStyle = marrom
    c.beginPath()
    c.ellipse(-31.2, 3.2, 2.8, 1.3, -0.45, 0, TAU)
    c.fill()
    c.fillStyle = '#f2b6a8'
    c.beginPath()
    c.ellipse(-31, 3.3, 1.7, 0.6, -0.45, 0, TAU)
    c.fill()
    // cabeça e focinho
    c.fillStyle = marrom
    c.beginPath()
    c.ellipse(-27, 6.4, 4.8, 4.2, 0.1, 0, TAU)
    c.fill()
    c.fillStyle = '#dcae78'
    c.beginPath()
    c.ellipse(-23.4, 8.2, 2.6, 2.1, 0.15, 0, TAU)
    c.fill()
    c.fillStyle = '#3a2418'
    c.beginPath()
    c.ellipse(-21.5, 7.6, 0.85, 0.7, 0, 0, TAU)
    c.fill()
    c.beginPath()
    c.arc(-25.6, 5.3, 0.85, 0, TAU)
    c.fill()
    c.fillStyle = '#ffffff'
    c.beginPath()
    c.arc(-25.35, 5, 0.3, 0, TAU)
    c.fill()
    c.fillStyle = 'rgba(255,140,140,0.45)'
    c.beginPath()
    c.arc(-25, 8.3, 1, 0, TAU)
    c.fill()
    // folhas de bordo (em cima, à direita)
    c.fillStyle = '#d0452a'
    folhaBordo(c, 27.5, -21, 3.6, 0.35)
    c.fillStyle = '#e8862a'
    folhaBordo(c, 23.4, -13, 2.6, -0.5)
    c.fillStyle = '#c8302a'
    folhaBordo(c, 30.2, -11.5, 2.2, 0.9)
    c.fillStyle = '#e8a030'
    folhaBordo(c, -27.8, 34, 1.8, 0.4)
    // o biscoito de cervo (shika senbei), embaixo à direita
    c.fillStyle = '#c99048'
    c.beginPath()
    c.arc(27.2, 9.8, 4.9, 0, TAU)
    c.fill()
    c.fillStyle = '#e2b26a'
    c.beginPath()
    c.arc(27, 9.5, 4.1, 0, TAU)
    c.fill()
    c.strokeStyle = 'rgba(120,70,20,0.6)'
    c.lineWidth = 0.4
    c.strokeRect(25.6, 8.1, 2.8, 2.8)
    c.beginPath()
    c.moveTo(27, 8.1)
    c.lineTo(27, 10.9)
    c.stroke()
    c.fillStyle = 'rgba(120,70,20,0.45)'
    for (const [x, y] of [[24.6, 11.6], [29.2, 7.6], [28.8, 12], [25.2, 7.2]]) c.fillRect(x, y, 0.5, 0.3)
    c.fillStyle = '#d9a35a'
    for (const [x, y] of [[23, 15.6], [24.4, 16.4]]) c.fillRect(x, y, 0.6, 0.6)
    c.restore()
    c.strokeStyle = '#6a4a2a'
    c.lineWidth = 1.2
    cartao(c, -34.4, -49.4, 68.8, 98.8, 5.6)
    c.stroke()
    c.strokeStyle = 'rgba(180,140,90,0.7)'
    c.lineWidth = 0.4
    cartao(c, -32, -47, 64, 94, 3.6)
    c.stroke()
  },

  'frente-dark': (c) => {
    c.fillStyle = '#05060a'
    cartao(c, -35, -50, 70, 100, 6)
    c.fill()
    const fundo = c.createRadialGradient(0, -6, 4, 0, -6, 60)
    fundo.addColorStop(0, '#222736')
    fundo.addColorStop(1, '#101218')
    c.fillStyle = fundo
    cartao(c, -33.8, -48.8, 67.6, 97.6, 5)
    c.fill()
    c.save()
    cartao(c, -33.8, -48.8, 67.6, 97.6, 5)
    c.clip()
    c.strokeStyle = 'rgba(120,200,255,0.05)'
    c.lineWidth = 0.25
    for (let x = -35; x <= 35; x += 5) {
      c.beginPath()
      c.moveTo(x, -50)
      c.lineTo(x, 50)
      c.stroke()
    }
    for (let y = -50; y <= 50; y += 5) {
      c.beginPath()
      c.moveTo(-35, y)
      c.lineTo(35, y)
      c.stroke()
    }
    c.restore()
    // o fio de neon que brilha
    c.save()
    c.shadowColor = '#4ae0ff'
    c.shadowBlur = 7
    c.strokeStyle = '#4ae0ff'
    c.lineWidth = 0.6
    cartao(c, -32.4, -47.4, 64.8, 94.8, 4)
    c.stroke()
    c.restore()
    c.strokeStyle = 'rgba(200,250,255,0.85)'
    c.lineWidth = 0.22
    cartao(c, -32.4, -47.4, 64.8, 94.8, 4)
    c.stroke()
  },

  'frente-aquarela': (c) => {
    c.fillStyle = '#fdfaf2'
    cartao(c, -35, -50, 70, 100, 6)
    c.fill()
    c.save()
    cartao(c, -35, -50, 70, 100, 6)
    c.clip()
    grao(c, 70, 100, { n: 1400, tam: 0.35, seed: 31, escuro: 'rgba(90,80,60,0.06)', claro: 'rgba(255,255,255,0.6)' })
    const rnd = semente(41)
    // manchas de tinta: muitas camadas bem transparentes e a borda que seca mais escura
    const mancha = (x, y, r, [cr, cg, cb], forca = 1) => {
      for (let i = 0; i < 16; i++) {
        const rx = x + (rnd() - 0.5) * r * 0.5
        const ry = y + (rnd() - 0.5) * r * 0.5
        const rr = r * (0.55 + rnd() * 0.45)
        c.fillStyle = `rgba(${cr},${cg},${cb},${0.045 * forca})`
        c.beginPath()
        c.ellipse(rx, ry, rr, rr * (0.8 + rnd() * 0.3), rnd() * TAU, 0, TAU)
        c.fill()
      }
      c.strokeStyle = `rgba(${cr},${cg},${cb},${0.12 * forca})`
      c.lineWidth = 0.35
      c.beginPath()
      c.ellipse(x, y, r * 0.95, r * 0.85, rnd(), 0, TAU)
      c.stroke()
    }
    mancha(-30, -44, 24, [90, 160, 210], 2.2)
    mancha(31, 45, 25, [230, 120, 160], 2.2)
    mancha(-29, 28, 11, [160, 130, 220], 2)
    mancha(28, -20, 9, [240, 190, 80], 2)
    mancha(-27, 6, 7, [110, 200, 160], 1.8)
    mancha(28, 10, 6, [110, 170, 230], 1.6)
    // respingos
    for (let i = 0; i < 18; i++) {
      const x = -33 + rnd() * 66
      const y = -48 + rnd() * 96
      if (Math.abs(x) < 21 && Math.abs(y + 8) < 30) continue
      c.fillStyle = ['rgba(90,160,210,0.35)', 'rgba(230,120,160,0.35)', 'rgba(160,130,220,0.3)'][i % 3]
      c.beginPath()
      c.arc(x, y, 0.3 + rnd() * 0.7, 0, TAU)
      c.fill()
    }
    c.restore()
    // borda pintada (pincel irregular)
    const rb = semente(43)
    bordaTremida(c, rb, 1.2, 0.5, 1.1, 'rgba(70,90,130,0.45)')
    bordaTremida(c, rb, 1.6, 0.6, 0.5, 'rgba(70,90,130,0.3)')
    c.strokeStyle = 'rgba(120,135,165,0.9)'
    c.lineWidth = 0.4
    cartao(c, -34.8, -49.8, 69.6, 99.6, 6)
    c.stroke()
  },

  'frente-origami': (c) => {
    c.fillStyle = '#f7d6a8'
    cartao(c, -35, -50, 70, 100, 6)
    c.fill()
    c.save()
    cartao(c, -35, -50, 70, 100, 6)
    c.clip()
    // as faces dobradas (tons um pouco diferentes) e os vincos
    const faces = [
      [[-35, -50], [0, -50], [0, -8], '#f9dcb2'],
      [[0, -50], [35, -50], [0, -8], '#f2cc96'],
      [[35, -50], [35, 34], [0, -8], '#f5d2a2'],
      [[35, 34], [35, 50], [0, 50], '#efc690'],
      [[35, 34], [0, 50], [0, -8], '#f4cf9c'],
      [[0, 50], [-35, 50], [0, -8], '#f8d8aa'],
      [[-35, 50], [-35, -50], [0, -8], '#fbe0b8'],
    ]
    for (const [a, b, d, cor] of faces) {
      c.fillStyle = cor
      c.beginPath()
      c.moveTo(...a)
      c.lineTo(...b)
      c.lineTo(...d)
      c.closePath()
      c.fill()
    }
    const vinco = (a, b) => {
      c.strokeStyle = 'rgba(150,90,40,0.25)'
      c.lineWidth = 0.35
      c.beginPath()
      c.moveTo(...a)
      c.lineTo(...b)
      c.stroke()
      c.strokeStyle = 'rgba(255,255,255,0.35)'
      c.beginPath()
      c.moveTo(a[0] + 0.4, a[1] + 0.4)
      c.lineTo(b[0] + 0.4, b[1] + 0.4)
      c.stroke()
    }
    for (const p of [[0, -50], [35, -50], [35, 34], [0, 50], [-35, 50], [-35, -50]]) vinco(p, [0, -8])
    vinco([35, 34], [0, 50])
    // um tsuru (garça de papel) à esquerda e um barquinho à direita
    const poli = (cor, ...pts) => {
      c.fillStyle = cor
      c.beginPath()
      pts.forEach((p, i) => c[i ? 'lineTo' : 'moveTo'](...p))
      c.closePath()
      c.fill()
    }
    poli('#c84a3a', [-33, 6], [-27, 2], [-22.5, 9])
    poli('#e05a48', [-27, 2], [-31.5, -6], [-25.5, 4])
    poli('#b43c30', [-27, 2], [-23, -4], [-24.6, 5.2])
    poli('#d85242', [-22.5, 9], [-21, 1.5], [-23.2, 6.5])
    poli('#a83428', [-21, 1.5], [-19.8, 2.4], [-21.6, 3])
    poli('#c84a3a', [-33, 6], [-34.6, 0.5], [-30.5, 4.6])
    poli('#2e8a92', [21.5, 8], [33, 8], [30.5, 12], [24, 12])
    poli('#3aa8b0', [27, 8], [27, 0.5], [31, 8])
    poli('#268088', [27, 8], [27, 2], [23.6, 8])
    c.restore()
    c.strokeStyle = '#9a6a3a'
    c.lineWidth = 1.2
    cartao(c, -34.4, -49.4, 68.8, 98.8, 5.6)
    c.stroke()
  },

  'frente-holografica': (c) => {
    c.fillStyle = '#c8d0e0'
    cartao(c, -35, -50, 70, 100, 6)
    c.fill()
    c.save()
    cartao(c, -35, -50, 70, 100, 6)
    c.clip()
    const arco = c.createLinearGradient(-35, -50, 35, 50)
    for (const [k, cor] of [[0, '#ffa8d4'], [0.2, '#9ed6ff'], [0.4, '#a8f8c4'], [0.6, '#ffe48a'], [0.8, '#c8a8ff'], [1, '#ffa8d4']]) arco.addColorStop(k, cor)
    c.fillStyle = arco
    c.fillRect(-35, -50, 70, 100)
    // o miolo mais claro (os naipes leem bem) e a borda mais colorida
    c.fillStyle = radial(c, 0, -6, 42, [[0, 'rgba(255,255,255,0.55)'], [0.6, 'rgba(255,255,255,0.3)'], [1, 'rgba(255,255,255,0)']])
    c.fillRect(-35, -50, 70, 100)
    // listras finas da película
    c.strokeStyle = 'rgba(255,255,255,0.22)'
    c.lineWidth = 0.5
    for (let d = -140; d < 140; d += 2.4) {
      c.beginPath()
      c.moveTo(d - 50, -50)
      c.lineTo(d + 50, 50)
      c.stroke()
    }
    c.strokeStyle = 'rgba(160,140,220,0.12)'
    for (let d = -140; d < 140; d += 7) {
      c.beginPath()
      c.moveTo(d + 50, -50)
      c.lineTo(d - 50, 50)
      c.stroke()
    }
    // brilhinhos
    const rnd = semente(51)
    c.fillStyle = 'rgba(255,255,255,0.85)'
    for (let i = 0; i < 12; i++) {
      const x = (rnd() < 0.5 ? -1 : 1) * (22 + rnd() * 10)
      const y = -36 + rnd() * 70
      estrela(c, x, y, 0.8 + rnd() * 1.2, 4, 0.25)
      c.fill()
    }
    c.restore()
    c.strokeStyle = '#7a849a'
    c.lineWidth = 1.2
    cartao(c, -34.4, -49.4, 68.8, 98.8, 5.6)
    c.stroke()
    c.strokeStyle = 'rgba(255,255,255,0.8)'
    c.lineWidth = 0.5
    cartao(c, -32.2, -47.2, 64.4, 94.4, 3.8)
    c.stroke()
  },

  'frente-tarot': (c) => {
    const fundo = c.createLinearGradient(0, -50, 0, 50)
    fundo.addColorStop(0, '#2d1c52')
    fundo.addColorStop(1, '#160d2c')
    c.fillStyle = fundo
    cartao(c, -35, -50, 70, 100, 6)
    c.fill()
    c.save()
    cartao(c, -35, -50, 70, 100, 6)
    c.clip()
    // estrelas e uma constelação
    const rnd = semente(61)
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(255,240,200,${0.3 + rnd() * 0.5})`
      c.beginPath()
      c.arc(-35 + rnd() * 70, -50 + rnd() * 100, 0.18 + rnd() * 0.3, 0, TAU)
      c.fill()
    }
    c.strokeStyle = 'rgba(230,200,120,0.3)'
    c.lineWidth = 0.2
    c.beginPath()
    c.moveTo(-31, 12)
    c.lineTo(-28, 16)
    c.lineTo(-30, 20)
    c.lineTo(-26, 22)
    c.stroke()
    c.fillStyle = '#f0d890'
    for (const [x, y] of [[-31, 12], [-28, 16], [-30, 20], [-26, 22]]) {
      estrela(c, x, y, 0.8, 4, 0.3)
      c.fill()
    }
    // a janela (arco) de pergaminho onde ficam os naipes
    const arco = () => {
      c.beginPath()
      c.moveTo(-23.5, 18.5)
      c.lineTo(-23.5, -26)
      c.ellipse(0, -26, 23.5, 12.5, 0, Math.PI, 0)
      c.lineTo(23.5, 18.5)
      c.closePath()
    }
    const perg = c.createLinearGradient(0, -38, 0, 18)
    perg.addColorStop(0, '#f8ecce')
    perg.addColorStop(1, '#ecd9ac')
    c.fillStyle = perg
    arco()
    c.fill()
    c.strokeStyle = '#c89a38'
    c.lineWidth = 0.9
    arco()
    c.stroke()
    c.strokeStyle = 'rgba(160,110,30,0.5)'
    c.lineWidth = 0.3
    c.save()
    c.translate(0, -4)
    c.scale(0.93, 0.93)
    arco()
    c.restore()
    c.stroke()
    // os cartuchos dos cantos (valor e naipe ficam legíveis)
    for (const [x, y] of [[-33.4, -48.4], [20.4, 24.9]]) {
      c.fillStyle = '#f4e6c4'
      cartao(c, x, y, 13, 23.5, 2.6)
      c.fill()
      c.strokeStyle = '#c89a38'
      c.lineWidth = 0.6
      cartao(c, x, y, 13, 23.5, 2.6)
      c.stroke()
    }
    // a lua (esquerda) e o sol (direita)
    c.fillStyle = '#f0d890'
    c.beginPath()
    c.arc(-28.5, -6, 4.2, 0, TAU)
    c.fill()
    c.fillStyle = '#25174a'
    c.beginPath()
    c.arc(-26.6, -7.2, 3.6, 0, TAU)
    c.fill()
    c.fillStyle = '#e8b840'
    c.strokeStyle = '#e8b840'
    c.lineWidth = 0.5
    for (let i = 0; i < 12; i++) {
      const a = (i * TAU) / 12
      c.beginPath()
      c.moveTo(28.6 + Math.cos(a) * 3.4, -6 + Math.sin(a) * 3.4)
      c.lineTo(28.6 + Math.cos(a) * (i % 2 ? 4.6 : 5.6), -6 + Math.sin(a) * (i % 2 ? 4.6 : 5.6))
      c.stroke()
    }
    c.beginPath()
    c.arc(28.6, -6, 2.8, 0, TAU)
    c.fill()
    c.fillStyle = '#fff0b0'
    c.beginPath()
    c.arc(28, -6.6, 1, 0, TAU)
    c.fill()
    // estrelas maiores em volta
    c.fillStyle = '#f0d890'
    for (const [x, y, r] of [[-29, -20, 1.4], [29, -18, 1.1], [29, 6, 1.3], [-17, 44, 1], [-11, -44, 0.8], [13, -43, 0.8]]) {
      estrela(c, x, y, r, 4, 0.3)
      c.fill()
    }
    c.restore()
    // borda dourada dupla com bolinhas nos cantos
    c.strokeStyle = '#d8b048'
    c.lineWidth = 1.1
    cartao(c, -33.6, -48.6, 67.2, 97.2, 5)
    c.stroke()
    c.strokeStyle = '#8a6a20'
    c.lineWidth = 0.4
    cartao(c, -32, -47, 64, 94, 3.8)
    c.stroke()
    c.strokeStyle = '#0e0820'
    c.lineWidth = 1
    cartao(c, -34.5, -49.5, 69, 99, 6)
    c.stroke()
  },
}

// o brilho holográfico que passa (duas texturas com a faixa em lugares diferentes; a animação alterna)
function texturasHolo(scene) {
  const faixa = (pos) => emUnidades((c) => {
    c.save()
    cartao(c, -35, -50, 70, 100, 6)
    c.clip()
    const g = c.createLinearGradient(-35 + pos * 70 - 22, -50, -35 + pos * 70 + 22, 50)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.35, 'rgba(255,200,240,0.35)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.75)')
    g.addColorStop(0.65, 'rgba(180,240,255,0.35)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = g
    c.fillRect(-35, -50, 70, 100)
    c.restore()
  })
  return [textura(scene, 'frente-holo-a', 105, 150, faixa(0.2)), textura(scene, 'frente-holo-b', 105, 150, faixa(0.8))]
}

export function texturaFundo(scene, id) {
  const pintar = FUNDOS[id]
  if (!pintar) return null
  return textura(scene, `frente-fundo-${id}`, TW, TH, emUnidades(pintar), { pixel: id === 'frente-pixel' })
}

// ---------- os temas (o que a Carta usa para montar a face) ----------

function fundoDe(id) {
  return (ctx) => {
    const chave = texturaFundo(ctx.scene, id)
    if (!chave) throw new Error(`sem textura para ${id}`)
    ctx.adicionar(ctx.scene.add.image(0, 0, chave).setDisplaySize(ctx.w, ctx.h))
  }
}

// a faixa do nome de cada estilo (g = ctx.g, unidades u)
const faixaRet = (ctx, fy, fh, { fundo, alpha = 1, borda, larguraBorda = 0.8, raio = 3, linha = null }) => {
  const { g, u } = ctx
  if (fundo != null) {
    g.fillStyle(fundo, alpha)
    g.fillRoundedRect(-21 * u, fy, 42 * u, fh, raio * u)
  }
  if (borda != null) {
    g.lineStyle(larguraBorda * u, borda, 1)
    g.strokeRoundedRect(-21 * u, fy, 42 * u, fh, raio * u)
  }
  if (linha != null) {
    g.fillStyle(linha, 0.9)
    g.fillRect(-15 * u, fy + fh - 1.6 * u, 30 * u, 1.2 * u)
  }
}

const misturar = (a, b, k) => {
  const m = (x, y) => Math.round(x + (y - x) * k)
  return (m((a >> 16) & 255, (b >> 16) & 255) << 16) | (m((a >> 8) & 255, (b >> 8) & 255) << 8) | m(a & 255, b & 255)
}

// Ás e figuras do rabisco: um naipe grande rabiscado com raios (Ás) ou uma coroa tremida (J/Q/K)
function mioloRabisco(ctx, cy) {
  const { g, u, dados, carta, cor } = ctx
  if (dados.valor !== 1 && dados.valor < 11) return false
  const rnd = semente(dados.valor * 31 + dados.naipe.length)
  if (dados.valor === 1) {
    g.lineStyle(0.9 * u, 0xe0a020, 0.8)
    for (let i = 0; i < 14; i++) {
      const a = (i * TAU) / 14 + rnd() * 0.1
      g.lineBetween(Math.cos(a) * 15 * u, cy + Math.sin(a) * 15 * u, Math.cos(a) * (19 + rnd() * 3) * u, cy + Math.sin(a) * (19 + rnd() * 3) * u)
    }
    carta.naipe(g, dados.naipe, 0, cy, 12.5 * u, cor)
    return true
  }
  // coroa (K), tiara (Q) ou chapeuzinho (J), tremidos, e o naipe embaixo
  const pts = dados.valor === 13 ? [[-11, 4], [-11, -6], [-5.5, -1], [0, -10], [5.5, -1], [11, -6], [11, 4]] : dados.valor === 12 ? [[-10, 4], [-9, -3], [-4, -6], [0, -2], [4, -6], [9, -3], [10, 4]] : [[-11, 4], [-8, -3], [-2, -6], [5, -5], [9, -1], [11, 4]]
  const ponto = ([x, y]) => ({ x: (x + (rnd() - 0.5) * 1) * u, y: cy - 13 * u + (y + (rnd() - 0.5) * 1) * u })
  g.fillStyle(0xf0c040, 0.35)
  g.fillPoints(pts.map(ponto), true)
  for (let vez = 0; vez < 2; vez++) {
    g.lineStyle((vez ? 0.6 : 1) * u, 0x7a5010, vez ? 0.7 : 1)
    g.strokePoints(pts.map(ponto), true)
  }
  carta.naipe(g, dados.naipe, 0, cy + 9 * u, 11 * u, cor)
  return true
}

const TEMAS = {
  'frente-mal-desenhada': {
    cores: { vermelho: 0xd4283c, escuro: 0x22223a, borda: 0x28283a, papel: 0xfbf8ee, papelSombra: 0xd8d4c4 },
    naipe: naipeRabisco,
    miolo: mioloRabisco,
    torto: 0.07,
    faixa: (ctx, fy, fh) => {
      const { g, u, carta } = ctx
      const rnd = semente(77)
      const cor = carta.corPersonagem
      g.fillStyle(cor, 0.18)
      g.fillRect(-20 * u, fy + 1 * u, 40 * u, fh - 2 * u)
      for (let vez = 0; vez < 2; vez++) {
        g.lineStyle((vez ? 0.5 : 0.9) * u, cor, vez ? 0.6 : 0.95)
        const p = [[-21, 0], [21, 0.6], [20.6, fh / u], [-20.4, fh / u - 0.4]].map(([x, y]) => ({ x: (x + (rnd() - 0.5) * 1.2) * u, y: fy + (y + (rnd() - 0.5) * 1.2) * u }))
        g.strokePoints(p, true)
      }
    },
  },
  'frente-jornal': {
    cores: { vermelho: 0xc0202a, escuro: 0x1d1b17, borda: 0x25221c, papel: 0xece5d3, papelSombra: 0xcfc6ae, ouro: 0x8c8270, ouroEscuro: 0x2b2822, ouroClaro: 0xd9d1bb },
    nome: { cor: '#1d1b17' },
    faixa: (ctx, fy, fh) => {
      const { g, u, carta } = ctx
      g.fillStyle(carta.corPersonagem, 0.14)
      g.fillRect(-21 * u, fy, 42 * u, fh)
      g.fillStyle(0x1d1b17, 1)
      g.fillRect(-21 * u, fy, 42 * u, 1 * u)
      g.fillRect(-21 * u, fy + fh - 0.5 * u, 42 * u, 0.5 * u)
      g.fillRect(-21 * u, fy + fh - 1.3 * u, 42 * u, 0.25 * u)
    },
  },
  'frente-pixel': {
    cores: { vermelho: 0xd8283c, escuro: 0x1b1b2b, borda: 0x1b2a1e, papel: 0xf2efd8, papelSombra: 0xd8d4b8, ouro: 0xf0c030, ouroEscuro: 0x8a5a14, ouroClaro: 0xfff0a0 },
    naipe: naipePixel,
    faixa: (ctx, fy, fh) => {
      const { g, u, carta } = ctx
      const x0 = -21 * u
      const w = 42 * u
      g.fillStyle(0x1b2a1e, 1)
      g.fillRect(x0 + u, fy, w - 2 * u, fh)
      g.fillRect(x0, fy + u, w, fh - 2 * u)
      g.fillStyle(misturar(carta.corPersonagem, 0xffffff, 0.55), 1)
      g.fillRect(x0 + u, fy + u, w - 2 * u, fh - 2 * u)
      g.fillStyle(carta.corPersonagem, 1)
      g.fillRect(x0 + u, fy + fh - 3 * u, w - 2 * u, 2 * u)
    },
  },
  'frente-sakura': {
    cores: { vermelho: 0xd4204e, escuro: 0x3a2238, borda: 0xa04a6a, papel: 0xfff4f7, papelSombra: 0xf4c4d4 },
    nome: { cor: '#4a2238' },
    faixa: (ctx, fy, fh) => faixaRet(ctx, fy, fh, { fundo: 0xffd0e0, alpha: 0.85, borda: 0xd87a9c, linha: ctx.carta.corPersonagem, raio: 5 }),
    animar: animarPetalas,
  },
  'frente-cervos-nara': {
    cores: { vermelho: 0xc0322a, escuro: 0x2e2218, borda: 0x6a4a2a, papel: 0xf6ecd2, papelSombra: 0xd8c49c },
    nome: { cor: '#3a2a1a' },
    faixa: (ctx, fy, fh) => faixaRet(ctx, fy, fh, { fundo: 0xe8d4a8, alpha: 0.95, borda: 0x8a6a40, linha: ctx.carta.corPersonagem, raio: 2 }),
  },
  'frente-dark': {
    cores: { vermelho: 0xff4d6d, escuro: 0xdfe8ff, borda: 0x05060a, papel: 0x1b1e27, papelSombra: 0x2a2f3c, ouro: 0xffd84a, ouroEscuro: 0x9a7a10, ouroClaro: 0xfff1a0 },
    naipe: naipeNeon,
    nome: { cor: '#eef3ff' },
    rotulo: { espessura: 0.3 },
    faixa: (ctx, fy, fh) => {
      faixaRet(ctx, fy, fh, { fundo: 0x0b0d12, alpha: 0.92, raio: 3 })
      const { g, u, carta } = ctx
      g.lineStyle(1.6 * u, carta.corPersonagem, 0.25)
      g.strokeRoundedRect(-21 * u, fy, 42 * u, fh, 3 * u)
      g.lineStyle(0.6 * u, carta.corPersonagem, 1)
      g.strokeRoundedRect(-21 * u, fy, 42 * u, fh, 3 * u)
    },
  },
  'frente-aquarela': {
    cores: { vermelho: 0xd23a55, escuro: 0x26324e, borda: 0x7a8aa6, papel: 0xfdfaf2, papelSombra: 0xe2dccb },
    naipe: naipeAquarela,
    nome: { cor: '#26324e' },
    faixa: (ctx, fy, fh) => {
      const { g, u, carta } = ctx
      const cor = carta.corPersonagem
      g.fillStyle(cor, 0.12)
      g.fillEllipse(0.6 * u, fy + fh / 2 + 0.4 * u, 46 * u, fh * 1.25)
      g.fillStyle(cor, 0.16)
      g.fillEllipse(-0.6 * u, fy + fh / 2, 41 * u, fh * 0.98)
      g.fillStyle(cor, 0.5)
      g.fillRect(-15 * u, fy + fh - 1.6 * u, 30 * u, 0.8 * u)
    },
  },
  'frente-origami': {
    cores: { vermelho: 0xc4243a, escuro: 0x242434, borda: 0x9a6a3a, papel: 0xf7d6a8, papelSombra: 0xe0b888 },
    naipe: naipeOrigami,
    nome: { cor: '#2a2238' },
    faixa: (ctx, fy, fh) => {
      const { g, u, carta } = ctx
      const cor = carta.corPersonagem
      const escura = misturar(cor, 0x000000, 0.35)
      // as pontas dobradas para trás e a fita
      g.fillStyle(escura, 1)
      g.fillTriangle(-21 * u, fy + 2 * u, -23.2 * u, fy + fh / 2 + 1 * u, -21 * u, fy + fh)
      g.fillTriangle(21 * u, fy + 2 * u, 23.2 * u, fy + fh / 2 + 1 * u, 21 * u, fy + fh)
      g.fillStyle(misturar(cor, 0xffffff, 0.62), 1)
      g.fillRect(-21 * u, fy, 42 * u, fh)
      g.fillStyle(misturar(cor, 0xffffff, 0.45), 1)
      g.fillTriangle(-21 * u, fy + fh, 21 * u, fy + fh, 21 * u, fy)
      g.lineStyle(0.4 * u, escura, 0.6)
      g.lineBetween(-21 * u, fy + fh, 21 * u, fy)
    },
  },
  'frente-holografica': {
    cores: { vermelho: 0xd0103a, escuro: 0x15152b, borda: 0x7a849a, papel: 0xeef0f6, papelSombra: 0xc8cede },
    nome: { cor: '#15152b' },
    faixa: (ctx, fy, fh) => faixaRet(ctx, fy, fh, { fundo: 0xffffff, alpha: 0.62, borda: 0x9aa4ba, linha: ctx.carta.corPersonagem }),
    sobre: (ctx) => {
      const [a, b] = texturasHolo(ctx.scene)
      if (!a || !b) return
      const add = (chave, alpha) => {
        const img = ctx.scene.add.image(0, 0, chave).setDisplaySize(ctx.w, ctx.h).setAlpha(alpha)
        img.setBlendMode?.('ADD')
        ctx.camadaSobre.add(img)
        return img
      }
      ctx.holo = [add(a, 0.2), add(b, 0.05)]
    },
    animar: animarHolo,
  },
  'frente-tarot': {
    cores: { papel: 0xf4e6c4, papelSombra: 0xd8c494, borda: 0x0e0820 },
    nome: { cor: '#3a2410' },
    faixa: (ctx, fy, fh) => {
      const { g, u } = ctx
      // a faixa de título (pontas em "rabo de andorinha")
      g.fillStyle(0xa07a28, 1)
      for (const s of [-1, 1]) {
        g.fillPoints([
          { x: s * 17 * u, y: fy + 2.5 * u },
          { x: s * 24.5 * u, y: fy + 2.5 * u },
          { x: s * 21.5 * u, y: fy + fh / 2 + 2.5 * u },
          { x: s * 24.5 * u, y: fy + fh + 2.5 * u },
          { x: s * 17 * u, y: fy + fh + 2.5 * u },
        ], true)
      }
      g.fillStyle(0xf4e6c4, 1)
      g.fillRect(-19.5 * u, fy, 39 * u, fh)
      g.lineStyle(0.9 * u, 0xc89a38, 1)
      g.strokeRect(-19.5 * u, fy, 39 * u, fh)
      g.lineStyle(0.3 * u, 0x8a6a20, 1)
      g.strokeRect(-18.4 * u, fy + 1.1 * u, 36.8 * u, fh - 2.2 * u)
    },
    decorar: (ctx) => {
      if (ctx.super) return
      const rom = ROMANOS[ctx.dados.valor] ?? ''
      if (!rom) return
      const t = ctx.carta.texto(0, -43.6 * ctx.u, semLigaduras(rom), 8 * ctx.u, '#f4d470', { stroke: '#2a1640', strokeThickness: 1.4 * ctx.u }).setOrigin(0.5)
      ctx.adicionar(t)
    },
  },
}

// ---------- animações (Sakura e Holográfica) ----------

function animarPetalas(ctx) {
  const { scene, carta, u, camadaAnim } = ctx
  if (reduzido()) return null
  garantirTexturas(scene)
  const rnd = semente(hashDe(carta.x ?? 0, carta.y ?? 0, carta.dados?.valor ?? 0))
  const petalas = Array.from({ length: 4 }, (_, i) => {
    const img = scene.add.image(0, 0, 'cosm-petala').setTint(i % 2 ? 0xffb3cc : 0xff94b8).setAlpha(0.8)
    img.setDisplaySize?.(3.4 * u, 3.4 * u)
    camadaAnim.add(img)
    return { img, x: (rnd() - 0.5) * 56, y: -46 + rnd() * 92, v: 4 + rnd() * 3, fase: rnd() * TAU, giro: (rnd() - 0.5) * 2 }
  })
  return ligarAtualizacao(scene, (t, dt) => {
    if (!carta.active) return false
    if (!carta.frente?.visible) return
    for (const p of petalas) {
      p.y += (p.v * dt) / 1000
      if (p.y > 46) {
        p.y = -46
        p.x = (rnd() - 0.5) * 56
      }
      const borda = Math.min(1, (46 - Math.abs(p.y)) / 8)
      p.img.setPosition((p.x + Math.sin(t / 900 + p.fase) * 3) * u, p.y * u)
      p.img.setRotation(t / 1000 * p.giro + p.fase)
      p.img.setAlpha(0.8 * borda)
    }
  }, () => {
    for (const p of petalas) if (p.img.active) p.img.destroy()
  })
}

function animarHolo(ctx) {
  const { scene, carta } = ctx
  const [a, b] = ctx.holo ?? []
  if (!a || !b || reduzido()) return null
  return ligarAtualizacao(scene, (t) => {
    if (!carta.active) return false
    if (!carta.frente?.visible) return
    const k = (Math.sin(t / 900) + 1) / 2
    a.setAlpha(0.04 + 0.22 * k)
    b.setAlpha(0.04 + 0.22 * (1 - k))
  })
}

// ---------- a API ----------

export const temRenderizadorFrente = (id) => id === 'frente-classica' || Boolean(TEMAS[id] && FUNDOS[id])

export function desenharFrente(scene, carta, id) {
  const tema = TEMAS[id]
  if (!tema || typeof carta?.montarFrente !== 'function') return false
  carta.montarFrente({ ...tema, fundo: fundoDe(id) })
  return true
}

// a carta de amostra parada (Coleção, roleta): o fundo do estilo, um naipe grande e um "A"
const AMOSTRA = { 'frente-mal-desenhada': 'copas', 'frente-jornal': 'espadas', 'frente-pixel': 'copas', 'frente-sakura': 'copas', 'frente-cervos-nara': 'ouros', 'frente-dark': 'espadas', 'frente-aquarela': 'copas', 'frente-origami': 'paus', 'frente-holografica': 'ouros', 'frente-tarot': 'espadas' }
export function miniaturaFrente(scene, id) {
  const tema = TEMAS[id]
  const fundo = texturaFundo(scene, id)
  if (!tema || !fundo) return null
  const fonte = scene.textures.get?.(fundo)?.getSourceImage?.()
  const naipe = AMOSTRA[id] ?? 'copas'
  const cor = hex(naipe === 'copas' || naipe === 'ouros' ? tema.cores.vermelho : tema.cores.escuro)
  return textura(scene, `frente-mini-${id}`, TW, TH, (c, w, h) => {
    if (fonte) c.drawImage(fonte, 0, 0, w, h)
    emUnidades((k) => {
      k.fillStyle = cor
      if (id === 'frente-tarot') {
        naipeCanvas(k, naipe, 0, -6, 13)
        k.fill()
      } else {
        naipeCanvas(k, naipe, 0, -6, 15)
        k.fill()
      }
      k.font = 'bold 12px "Pixelify Sans", monospace'
      k.textAlign = 'center'
      k.textBaseline = 'top'
      k.fillText('A', -27, -47)
      naipeCanvas(k, naipe, -27, -30, 4)
      k.fill()
    })(c, w, h)
  })
}

// a prévia: duas cartas de verdade nesse estilo (um Ás e uma figura), balançando de leve
export function previaFrente(scene, id, x, y, tamanho = 96) {
  const Carta = classeCarta()
  const largura = Math.round(tamanho * 0.5)
  if (!Carta) {
    const chave = miniaturaFrente(scene, id)
    if (!chave) return { destroy() {} }
    const img = scene.add.image(x, y, chave).setDisplaySize(largura, Math.round((largura * 10) / 7))
    return { destroy: () => img.active && img.destroy() }
  }
  const dados = [
    { id: 'previa-a', personagem: 'kris', naipe: 'copas', valor: 1, nome: 'Golpe Firme', custo: 2 },
    { id: 'previa-b', personagem: 'susie', naipe: 'espadas', valor: 13, nome: 'Machado Raivoso', custo: 3 },
  ]
  const cartas = dados.map((d, i) => new Carta(scene, x + (i ? 1 : -1) * largura * 0.48, y + 4, d, { largura, frente: id }).setRotation(i ? 0.08 : -0.08))
  const lig = ligarAtualizacao(scene, (t) => {
    if (!cartas.every((c) => c.active)) return false
    if (!reduzido()) cartas.forEach((c, i) => c.setY(y + 4 + Math.sin(t / 700 + i * 1.6) * 2))
  }, () => cartas.forEach((c) => c.active && c.destroy()))
  return { destroy: () => lig.destroy() }
}
