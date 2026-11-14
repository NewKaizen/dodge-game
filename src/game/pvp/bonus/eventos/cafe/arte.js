import { texturaCanvas, rgba } from '../../../../arte/pixelCanvas.js'

// Texturas dos eventos da arena CAFÉ FRANCÊS, pintadas por código UMA vez por jogo
// (texturaCanvas confere se já existe).
//
//   cafe-prato-croissant | -baguete | -queijo | -sopa | -macaron   32x32, coloridos (MENU DO DIA)
//   cafe-xicara                                                    20x20, xícara de expresso (EXPRESSO)

const T = 32

function elipse(ctx, x, y, rx, ry, cor, rot = 0) {
  ctx.fillStyle = rgba(cor)
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2)
  ctx.fill()
}

function contorno(ctx, cor = 0x3a2010, largura = 1.6) {
  ctx.strokeStyle = rgba(cor)
  ctx.lineWidth = largura
  ctx.stroke()
}

function croissant(ctx) {
  // seis gomos em arco, os do meio maiores
  const gomos = [
    [6, 23, 4, 2.6, -1.0],
    [10, 17, 5.2, 3.6, -0.8],
    [16, 13, 6.2, 4.4, 0],
    [22, 17, 5.2, 3.6, 0.8],
    [26, 23, 4, 2.6, 1.0],
  ]
  for (const [x, y, rx, ry, rot] of gomos) {
    elipse(ctx, x, y + 1, rx, ry, 0x8a4a14, rot)
    elipse(ctx, x, y, rx, ry, 0xe0a030, rot)
    elipse(ctx, x - 0.8, y - 1, rx * 0.55, ry * 0.45, 0xffd070, rot)
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2)
    contorno(ctx, 0x6a3410, 1.2)
  }
}

function baguete(ctx) {
  ctx.save()
  ctx.translate(16, 16)
  ctx.rotate(-0.6)
  ctx.fillStyle = rgba(0x7a4210)
  ctx.beginPath()
  ctx.roundRect(-15, -5, 30, 11, 5)
  ctx.fill()
  ctx.fillStyle = rgba(0xdca040)
  ctx.beginPath()
  ctx.roundRect(-15, -6, 30, 10, 5)
  ctx.fill()
  ctx.fillStyle = rgba(0xf5c870)
  ctx.beginPath()
  ctx.roundRect(-13, -5, 26, 4, 2)
  ctx.fill()
  // cortes
  ctx.strokeStyle = rgba(0x8a4a14)
  ctx.lineWidth = 1.6
  for (const x of [-9, -2.5, 4, 10]) {
    ctx.beginPath()
    ctx.moveTo(x - 1.5, -4)
    ctx.lineTo(x + 1.5, 2)
    ctx.stroke()
  }
  ctx.restore()
}

function queijo(ctx) {
  ctx.fillStyle = rgba(0xb8800c)
  ctx.beginPath()
  ctx.moveTo(3, 24)
  ctx.lineTo(29, 24)
  ctx.lineTo(29, 14)
  ctx.lineTo(3, 6)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = rgba(0xf8d040)
  ctx.beginPath()
  ctx.moveTo(3, 22)
  ctx.lineTo(29, 22)
  ctx.lineTo(29, 13)
  ctx.lineTo(3, 5)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = rgba(0xfff0a0)
  ctx.beginPath()
  ctx.moveTo(3, 5)
  ctx.lineTo(29, 13)
  ctx.lineTo(29, 15)
  ctx.lineTo(3, 8)
  ctx.closePath()
  ctx.fill()
  for (const [x, y, r] of [[10, 16, 2.6], [20, 18, 2], [24, 15, 1.6], [15, 12, 1.4]]) elipse(ctx, x, y, r, r, 0xc89a10)
  ctx.beginPath()
  ctx.moveTo(3, 22)
  ctx.lineTo(29, 22)
  ctx.lineTo(29, 13)
  ctx.lineTo(3, 5)
  ctx.closePath()
  contorno(ctx, 0x6a4a08, 1.4)
}

function sopa(ctx) {
  // tigela com sopa de cebola gratinada e vapor
  ctx.fillStyle = rgba(0xe8e4f0)
  ctx.beginPath()
  ctx.moveTo(4, 14)
  ctx.lineTo(28, 14)
  ctx.quadraticCurveTo(26, 28, 16, 28)
  ctx.quadraticCurveTo(6, 28, 4, 14)
  ctx.fill()
  ctx.fillStyle = rgba(0xb8b4c8)
  ctx.beginPath()
  ctx.moveTo(5, 22)
  ctx.quadraticCurveTo(10, 28, 16, 28)
  ctx.quadraticCurveTo(24, 28, 27, 20)
  ctx.quadraticCurveTo(22, 26, 16, 26)
  ctx.quadraticCurveTo(9, 26, 5, 22)
  ctx.fill()
  elipse(ctx, 16, 14, 12.4, 4.2, 0xd8d4e4)
  elipse(ctx, 16, 14, 10.6, 3.2, 0xd88a28)
  elipse(ctx, 14, 13.4, 5, 1.6, 0xf8d070)
  elipse(ctx, 21, 14.4, 3, 1.1, 0xa85a14)
  ctx.strokeStyle = rgba(0xffffff, 0.85)
  ctx.lineWidth = 1.6
  for (const x of [11, 17, 22]) {
    ctx.beginPath()
    ctx.moveTo(x, 10)
    ctx.quadraticCurveTo(x - 3, 7, x, 4)
    ctx.quadraticCurveTo(x + 3, 1.5, x, 0.5)
    ctx.stroke()
  }
}

function macaron(ctx) {
  elipse(ctx, 16, 10, 11.4, 5.6, 0xd0508a)
  elipse(ctx, 16, 9, 11, 5.2, 0xff8ab8)
  elipse(ctx, 13, 7.6, 5, 1.8, 0xffc8dc)
  ctx.fillStyle = rgba(0xfff4e8)
  ctx.beginPath()
  ctx.roundRect(5.5, 13, 21, 5.5, 2.5)
  ctx.fill()
  elipse(ctx, 16, 24, 11.4, 5.6, 0xd0508a)
  elipse(ctx, 16, 22.4, 11, 5.4, 0xff8ab8)
  ctx.fillStyle = rgba(0xffffff, 0.35)
  ctx.beginPath()
  ctx.ellipse(12, 21.2, 4, 1.4, 0, 0, Math.PI * 2)
  ctx.fill()
}

const PRATOS = { croissant, baguete, queijo, sopa, macaron }

export function texturasDoMenu(scene) {
  for (const [id, pintar] of Object.entries(PRATOS)) texturaCanvas(scene, `cafe-prato-${id}`, T, T, (ctx) => pintar(ctx))
  texturaCanvas(scene, 'cafe-xicara', 20, 20, (ctx) => {
    elipse(ctx, 10, 16, 9, 3, 0xe8e8f4) // pires
    elipse(ctx, 10, 15, 7.6, 2.2, 0xfafafa)
    ctx.fillStyle = rgba(0xf2f2fa)
    ctx.beginPath()
    ctx.moveTo(4, 6)
    ctx.lineTo(16, 6)
    ctx.quadraticCurveTo(16, 15, 10, 15)
    ctx.quadraticCurveTo(4, 15, 4, 6)
    ctx.fill()
    ctx.strokeStyle = rgba(0xd8d8e8)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(16.4, 9, 2.6, -1.4, 1.4)
    ctx.stroke()
    elipse(ctx, 10, 6.2, 6, 1.7, 0x5a2e14)
    elipse(ctx, 8.6, 5.9, 2.4, 0.7, 0xa8683a)
    ctx.fillStyle = rgba(0x3a78e0)
    ctx.fillRect(4, 9, 12, 1.6)
  })
}
