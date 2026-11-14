// Texturas das arenas PRAIA e CAFÉ FRANCÊS (fundos em backgrounds/arenas/praia.js e
// cafe.js; bônus em pvp/bonus/eventos/): pixel art pintada em código, UMA vez por jogo
// (texturaCanvas confere scene.textures.exists).
//
//   praia-caranguejo   spritesheet: quadros 'c0' (pinças baixas) e 'c1' (pinças erguidas), 13x8
//   praia-bola         bola de praia listrada, 28x28 (colorida)
//   cafe-croissant     croissant dourado, 26x14 (colorido; origem no centro)
//   cafe-pombo         spritesheet: 'p0' (asa baixa) e 'p1' (asa erguida), 16x10, olhando para a DIREITA
//   arte-brilho        círculo branco com borda suave (luz, vapor; pintar com setTint)
//   arte-vazio         2x2 transparente (bala invisível: o visual é do evento)

import { texturaCanvas, rgba } from './pixelCanvas.js'

// pinta um mapa de caracteres (cada um uma cor da paleta) a partir de (ox, oy)
function mapa(px, linhas, paleta, ox = 0, oy = 0) {
  linhas.forEach((linha, y) => {
    ;[...linha].forEach((ch, x) => {
      const cor = paleta[ch]
      if (cor !== undefined) px(ox + x, oy + y, 1, 1, cor)
    })
  })
}

const CARANGUEJO_PALETA = { r: 0xe8503a, R: 0xa82a22, c: 0xf06a48, C: 0xb83426, e: 0xffffff, k: 0x1a1020, l: 0xc8402e }
const CARANGUEJO_0 = [
  '.............',
  '.....e.e.....',
  '.....k.k.....',
  '..rrrrrrrrr..',
  'cCrrRrrrRrrCc',
  'ccrrrrrrrrrcc',
  '.l.lrRrRrl.l.',
  'l.l.l...l.l.l',
]
const CARANGUEJO_1 = [
  'cc.........cc',
  'cCc.e...e.cCc',
  '.cc.k...k.cc.',
  '..rrrrrrrrr..',
  '.rrRrrrrrRrr.',
  '..rrrrrrrrr..',
  '.l.lrRrRrl.l.',
  'l.l.l...l.l.l',
]

const POMBO_PALETA = { g: 0x8e98a8, G: 0x6a7488, w: 0xb0bac8, W: 0x4e586c, s: 0x6a8a7a, t: 0x5a6478, k: 0x101018, y: 0xe8a040, o: 0xd88060 }
const POMBO_0 = [
  '..........sss...',
  '.........sGGGs..',
  '.........sGkGsyy',
  '.....ggg.sGGGs..',
  '..tggggggggggg..',
  '.ttgwwwwwwgggg..',
  '.tt.gWWWWWggg...',
  '....gggggggg....',
  '.....o....o.....',
  '.....o....o.....',
]
const POMBO_1 = [
  '..........sss...',
  '.....W...sGGGs..',
  '....WWW..sGkGsyy',
  '...WWWWW.sGGGs..',
  '..tgWWWWWgggg...',
  '.ttggggggggggg..',
  '.tt.gggggggg....',
  '....gggggggg....',
  '.....o....o.....',
  '.....o....o.....',
]

function bolaDePraia(ctx) {
  const r = 13
  const gomos = [0xff4a4a, 0xfff2e0, 0x3a9aff, 0xffd23a, 0xfff2e0, 0xff4a4a]
  gomos.forEach((cor, k) => {
    const a0 = (k / gomos.length) * Math.PI * 2 - Math.PI / 2
    const a1 = ((k + 1) / gomos.length) * Math.PI * 2 - Math.PI / 2
    ctx.fillStyle = rgba(cor)
    ctx.beginPath()
    ctx.moveTo(14, 14)
    ctx.arc(14, 14, r, a0, a1)
    ctx.closePath()
    ctx.fill()
  })
  ctx.fillStyle = rgba(0xffffff, 0.9)
  ctx.beginPath()
  ctx.arc(14, 14, 2.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = rgba(0x000000, 0.35)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(14, 14, r - 0.5, 0, Math.PI * 2)
  ctx.stroke()
  // brilho
  ctx.fillStyle = rgba(0xffffff, 0.45)
  ctx.beginPath()
  ctx.ellipse(9, 8, 4, 2.4, -0.6, 0, Math.PI * 2)
  ctx.fill()
}

function croissant(ctx) {
  // 7 gomos num arco (as pontas finas, o meio gordo), com sombra embaixo
  const gomos = [
    { a: 200, rx: 3.2, ry: 2.4 },
    { a: 222, rx: 4.2, ry: 3.4 },
    { a: 248, rx: 5.2, ry: 4.4 },
    { a: 270, rx: 5.8, ry: 4.9 },
    { a: 292, rx: 5.2, ry: 4.4 },
    { a: 318, rx: 4.2, ry: 3.4 },
    { a: 340, rx: 3.2, ry: 2.4 },
  ]
  const centro = { x: 13, y: 16 }
  const raio = 10.5
  gomos.forEach((g, k) => {
    const a = (g.a * Math.PI) / 180
    const x = centro.x + Math.cos(a) * raio
    const y = centro.y + Math.sin(a) * raio * 0.95
    const rot = a + Math.PI / 2
    ctx.fillStyle = rgba(0x9a5a1a)
    ctx.beginPath()
    ctx.ellipse(x, y + 1.2, g.rx, g.ry, rot, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = rgba(k % 2 ? 0xe8a23a : 0xf2b84a)
    ctx.beginPath()
    ctx.ellipse(x, y, g.rx, g.ry, rot, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = rgba(0xffe090, 0.7)
    ctx.beginPath()
    ctx.ellipse(x - 0.6, y - 1, g.rx * 0.5, g.ry * 0.4, rot, 0, Math.PI * 2)
    ctx.fill()
  })
}

function brilho(ctx) {
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.75)')
  grad.addColorStop(0.7, 'rgba(255,255,255,0.22)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
}

export function texturasPraiaCafe(scene) {
  texturaCanvas(scene, 'praia-caranguejo', 13, 16, (ctx, px, tex) => {
    mapa(px, CARANGUEJO_0, CARANGUEJO_PALETA, 0, 0)
    mapa(px, CARANGUEJO_1, CARANGUEJO_PALETA, 0, 8)
    tex.add('c0', 0, 0, 0, 13, 8)
    tex.add('c1', 0, 0, 8, 13, 8)
  })
  texturaCanvas(scene, 'praia-bola', 28, 28, (ctx) => bolaDePraia(ctx))
  texturaCanvas(scene, 'cafe-croissant', 26, 18, (ctx) => croissant(ctx))
  texturaCanvas(scene, 'cafe-pombo', 16, 20, (ctx, px, tex) => {
    mapa(px, POMBO_0, POMBO_PALETA, 0, 0)
    mapa(px, POMBO_1, POMBO_PALETA, 0, 10)
    tex.add('p0', 0, 0, 0, 16, 10)
    tex.add('p1', 0, 0, 10, 16, 10)
  })
  texturaCanvas(scene, 'arte-brilho', 64, 64, (ctx) => brilho(ctx))
  texturaCanvas(scene, 'arte-vazio', 2, 2, () => {})
}
