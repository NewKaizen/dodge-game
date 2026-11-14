// Arte (texturas de canvas, geradas em código) e utilidades dos bônus das arenas ESTAÇÃO
// ESPACIAL, CHINATOWN e CIDADE GRANDE (planosArenas.js tem a parte sem Phaser).
//   texturaMeteoro · texturaLanterna · texturaVeiculo · texturaViga
//   rotulo(arena, x, y, texto, opcoes)     texto com contorno e sem ligadura ("fi" vira "A" na fonte)
//   faixaListrada(g, x, y, w, h, ...)      faixa de perigo amarela e preta (OBRA)
// Sempre teste `arena.textures.exists(chave)` (as funções já fazem isso).

import { FONTE } from '../../../constants.js'
import { ignorarNasCaixas } from '../../../recorte.js'
import { semLigaduras } from '../../../campanha/texto.js'

function desenhar(arena, chave, largura, altura, fn) {
  if (arena.textures.exists(chave)) return chave
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  fn(canvas.getContext('2d'), largura, altura)
  arena.textures.addCanvas(chave, canvas)
  return chave
}

const arredondado = (g, x, y, w, h, r) => {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

// pedra do espaço: cinza-marrom, cheia de crateras, luz de cima à esquerda
export function texturaMeteoro(arena) {
  return desenhar(arena, 'estacao-meteoro', 64, 64, (g, w, h) => {
    const pontos = []
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2
      const r = 27 + Math.sin(k * 2.3) * 3 + (k % 3) * 1.2
      pontos.push([w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r])
    }
    g.beginPath()
    pontos.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)))
    g.closePath()
    const grad = g.createRadialGradient(24, 22, 4, 32, 32, 34)
    grad.addColorStop(0, '#b8a898')
    grad.addColorStop(0.55, '#7c6c60')
    grad.addColorStop(1, '#3a302c')
    g.fillStyle = grad
    g.fill()
    g.lineWidth = 2
    g.strokeStyle = '#1e1816'
    g.stroke()
    for (const [x, y, r] of [[22, 24, 7], [40, 20, 5], [36, 40, 8], [18, 42, 4], [46, 34, 3.5]]) {
      g.fillStyle = '#4a3e38'
      g.beginPath()
      g.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#a89888'
      g.beginPath()
      g.ellipse(x - r * 0.25, y - r * 0.3, r * 0.6, r * 0.4, 0, 0, Math.PI * 2)
      g.fill()
    }
  })
}

// lanterna de festival: corpo vermelho com gomos, tampas douradas e franja
export function texturaLanterna(arena) {
  return desenhar(arena, 'china-lanterna', 64, 88, (g, w) => {
    const cx = w / 2
    g.strokeStyle = '#e8c040'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(cx, 2)
    g.lineTo(cx, 12)
    g.stroke()
    // franja
    g.strokeStyle = '#f0c850'
    g.lineWidth = 2.5
    for (let k = -2; k <= 2; k++) {
      g.beginPath()
      g.moveTo(cx + k * 4, 70)
      g.lineTo(cx + k * 5.5, 86)
      g.stroke()
    }
    // corpo
    const grad = g.createRadialGradient(cx, 40, 4, cx, 40, 30)
    grad.addColorStop(0, '#ff8a58')
    grad.addColorStop(0.5, '#e82418')
    grad.addColorStop(1, '#8a0c10')
    g.fillStyle = grad
    g.beginPath()
    g.ellipse(cx, 41, 26, 28, 0, 0, Math.PI * 2)
    g.fill()
    // gomos
    g.strokeStyle = 'rgba(80,0,0,0.55)'
    g.lineWidth = 1.6
    for (const k of [-0.62, -0.3, 0, 0.3, 0.62]) {
      g.beginPath()
      g.ellipse(cx, 41, 26 * Math.abs(k) || 0.5, 28, 0, -Math.PI / 2, Math.PI / 2)
      g.stroke()
    }
    // tampas
    g.fillStyle = '#e8b830'
    arredondado(g, cx - 13, 11, 26, 8, 3)
    g.fill()
    arredondado(g, cx - 13, 63, 26, 8, 3)
    g.fill()
    g.strokeStyle = '#6a4a10'
    g.lineWidth = 1.5
    arredondado(g, cx - 13, 11, 26, 8, 3)
    g.stroke()
    arredondado(g, cx - 13, 63, 26, 8, 3)
    g.stroke()
    // o enfeite dourado no meio (um selo redondo com cruz, original)
    g.strokeStyle = '#ffd860'
    g.lineWidth = 2.4
    g.beginPath()
    g.arc(cx, 41, 9, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.moveTo(cx - 9, 41)
    g.lineTo(cx + 9, 41)
    g.moveTo(cx, 32)
    g.lineTo(cx, 50)
    g.stroke()
  })
}

// veículo visto de lado, virado para a DIREITA (flipX para a esquerda)
//   tipo 'carro' (4 cores: 0..3), 'onibus', 'moto'
const CORES_CARRO = ['#f2c218', '#d83030', '#2f7fe0', '#e8e8f0']
export function texturaVeiculo(arena, tipo, variante = 0) {
  if (tipo === 'carro') {
    const cor = CORES_CARRO[variante % CORES_CARRO.length]
    return desenhar(arena, `cidade-carro-${variante % CORES_CARRO.length}`, 120, 48, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.35)'
      g.beginPath()
      g.ellipse(60, 44, 54, 4, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = cor
      arredondado(g, 6, 18, 108, 20, 7)
      g.fill()
      arredondado(g, 30, 5, 58, 20, 9)
      g.fill()
      g.fillStyle = '#16303f'
      arredondado(g, 35, 9, 22, 14, 4)
      g.fill()
      arredondado(g, 61, 9, 22, 14, 4)
      g.fill()
      g.fillStyle = 'rgba(255,255,255,0.35)'
      g.fillRect(8, 22, 100, 2)
      g.fillStyle = '#fff6c0'
      g.fillRect(106, 22, 7, 6) // farol
      g.fillStyle = '#d02020'
      g.fillRect(6, 22, 4, 6) // lanterna
      for (const x of [28, 90]) {
        g.fillStyle = '#101018'
        g.beginPath()
        g.arc(x, 38, 8, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = '#9098a8'
        g.beginPath()
        g.arc(x, 38, 3.4, 0, Math.PI * 2)
        g.fill()
      }
    })
  }
  if (tipo === 'onibus') {
    return desenhar(arena, 'cidade-onibus', 224, 52, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.35)'
      g.beginPath()
      g.ellipse(112, 48, 104, 4, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#e04a1c'
      arredondado(g, 4, 5, 216, 38, 8)
      g.fill()
      g.fillStyle = '#f2f0e8'
      g.fillRect(4, 26, 216, 5)
      g.fillStyle = '#16303f'
      for (let k = 0; k < 8; k++) {
        arredondado(g, 14 + k * 24, 10, 19, 14, 3)
        g.fill()
      }
      arredondado(g, 196, 10, 20, 24, 3)
      g.fill()
      g.fillStyle = '#fff6c0'
      g.fillRect(214, 30, 7, 6)
      for (const x of [36, 176]) {
        g.fillStyle = '#101018'
        g.beginPath()
        g.arc(x, 43, 8, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = '#9098a8'
        g.beginPath()
        g.arc(x, 43, 3.4, 0, Math.PI * 2)
        g.fill()
      }
    })
  }
  // moto com piloto
  return desenhar(arena, 'cidade-moto', 80, 52, (g) => {
    g.fillStyle = 'rgba(0,0,0,0.35)'
    g.beginPath()
    g.ellipse(40, 49, 30, 3, 0, 0, Math.PI * 2)
    g.fill()
    for (const x of [16, 62]) {
      g.strokeStyle = '#14141c'
      g.lineWidth = 6
      g.beginPath()
      g.arc(x, 38, 9, 0, Math.PI * 2)
      g.stroke()
    }
    g.fillStyle = '#c02aa8'
    arredondado(g, 20, 24, 40, 10, 5)
    g.fill()
    g.fillRect(52, 18, 6, 14)
    g.fillStyle = '#fff6c0'
    g.fillRect(60, 22, 6, 5)
    g.fillStyle = '#2a2a38'
    arredondado(g, 24, 8, 14, 20, 5)
    g.fill()
    g.fillStyle = '#e8c0a0'
    g.beginPath()
    g.arc(35, 6, 6, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#d8d8e0'
    g.beginPath()
    g.arc(35, 5, 6.5, Math.PI, Math.PI * 2)
    g.fill()
  })
}

// viga de aço (perfil I visto de lado) com as pontas listradas de amarelo e preto
export function texturaViga(arena) {
  return desenhar(arena, 'cidade-viga', 160, 28, (g, w, h) => {
    g.fillStyle = '#6a7482'
    g.fillRect(0, 0, w, 7)
    g.fillRect(0, h - 7, w, 7)
    g.fillStyle = '#8a94a4'
    g.fillRect(0, 7, w, h - 14)
    g.fillStyle = '#b8c2d0'
    g.fillRect(0, 0, w, 2)
    g.fillStyle = '#4a525e'
    g.fillRect(0, h - 2, w, 2)
    for (let x = 12; x < w - 8; x += 18) {
      g.fillStyle = '#3a424e'
      g.beginPath()
      g.arc(x, h / 2, 2.2, 0, Math.PI * 2)
      g.fill()
    }
    for (const x0 of [0, w - 20]) {
      for (let k = 0; k < 4; k++) {
        g.fillStyle = k % 2 ? '#181818' : '#f4c61a'
        g.fillRect(x0 + k * 5, 7, 5, h - 14)
      }
    }
  })
}

// ---------- utilidades ----------

// Texto com contorno (fonte do jogo), sem a ligadura "fi"/"fl". pista: recorta na caixa
export function rotulo(arena, x, y, conteudo, { cor = '#ffffff', tamanho = 14, pista = null, profundidade = 14 } = {}) {
  const txt = arena.add
    .text(x, y, semLigaduras(conteudo), { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: Math.max(3, Math.round(tamanho / 4)) })
    .setOrigin(0.5)
    .setDepth(pista ? profundidade : 95)
  if (pista) pista.caixa.recortar(txt)
  else ignorarNasCaixas(arena, txt)
  return txt
}

// Faixa de perigo (listras amarelas e pretas na diagonal) num Graphics, recortada ao retângulo
export function faixaListrada(g, x, y, largura, altura, { alpha = 0.3, passo = 14, deslocamento = 0 } = {}) {
  g.fillStyle(0xf4c61a, alpha)
  g.fillRect(x, y, largura, altura)
  g.fillStyle(0x111111, alpha * 1.3)
  for (let s = -altura + (deslocamento % (passo * 2)); s < largura; s += passo * 2) {
    const x0 = Math.max(0, s)
    const x1 = Math.min(largura, s + passo)
    // paralelogramo da listra: o corte pelos lados mantém dentro do retângulo
    const pts = [
      { x: s, y: altura },
      { x: s + altura, y: 0 },
      { x: s + altura + passo, y: 0 },
      { x: s + passo, y: altura },
    ].map((p) => ({ x: Math.min(largura, Math.max(0, p.x)) + x, y: p.y + y }))
    if (x1 > x0 || s + altura + passo > 0) g.fillPoints(pts, true)
  }
}
