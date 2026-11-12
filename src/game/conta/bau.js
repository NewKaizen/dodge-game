// O BAÚ na tela (docs/baus.md): o desenho do baú e os ícones dos slots novos. A abertura (a ROLETA) está em
// roletaBau.js.
//
//   desenharBau(g, x, y, escala, { aberto })        o baú (Graphics), centrado em (x, y)
//   iconeDoTipo(g, tipo, x, y, tam, cor)            ícone simples do slot (som, efeito, lançamento, moldura, título, xp)

const MADEIRA = 0x7a4a22
const MADEIRA_ESCURA = 0x4e2c12
const OURO = 0xffd23a

export function desenharBau(g, x, y, escala = 1, { aberto = false } = {}) {
  const w = 96 * escala
  const h = 58 * escala
  const t = 22 * escala // a tampa
  const x0 = x - w / 2
  const y0 = y - h / 2 + t / 2
  // corpo
  g.fillStyle(MADEIRA_ESCURA, 1).fillRect(x0 - 3 * escala, y0 - 3 * escala, w + 6 * escala, h + 6 * escala)
  g.fillStyle(MADEIRA, 1).fillRect(x0, y0, w, h)
  for (let k = 1; k < 4; k++) g.fillStyle(MADEIRA_ESCURA, 0.5).fillRect(x0, y0 + (h * k) / 4, w, 2 * escala)
  g.fillStyle(OURO, 1).fillRect(x0 + 10 * escala, y0, 8 * escala, h).fillRect(x0 + w - 18 * escala, y0, 8 * escala, h)
  // tampa (fechada: em cima do corpo; aberta: inclinada para trás)
  const ty = aberto ? y0 - t - 14 * escala : y0 - t
  g.fillStyle(MADEIRA_ESCURA, 1).fillRect(x0 - 3 * escala, ty - 3 * escala, w + 6 * escala, t + 3 * escala)
  g.fillStyle(aberto ? 0x8a5a2a : MADEIRA, 1).fillRect(x0, ty, w, t)
  g.fillStyle(OURO, 1).fillRect(x0 + 10 * escala, ty, 8 * escala, t).fillRect(x0 + w - 18 * escala, ty, 8 * escala, t)
  if (aberto) g.fillStyle(0xfff2b0, 0.85).fillRect(x0 + 6 * escala, y0 - 4 * escala, w - 12 * escala, 8 * escala)
  else {
    // fechadura
    g.fillStyle(OURO, 1).fillRect(x - 9 * escala, y0 - 7 * escala, 18 * escala, 16 * escala)
    g.fillStyle(0x2a1a08, 1).fillRect(x - 2 * escala, y0 - 2 * escala, 4 * escala, 7 * escala)
  }
}

export function iconeDoTipo(g, tipo, x, y, tam = 24, cor = 0xffffff) {
  const s = tam / 24
  g.fillStyle(cor, 1).lineStyle(2 * s, cor, 1)
  if (tipo === 'som') {
    g.fillRect(x - 10 * s, y - 4 * s, 6 * s, 8 * s).fillTriangle(x - 4 * s, y - 4 * s, x + 4 * s, y - 10 * s, x + 4 * s, y + 10 * s)
    g.fillTriangle(x - 4 * s, y + 4 * s, x + 4 * s, y + 10 * s, x - 4 * s, y - 4 * s)
    g.beginPath().arc(x + 4 * s, y, 7 * s, -0.8, 0.8).strokePath()
    g.beginPath().arc(x + 4 * s, y, 11 * s, -0.8, 0.8).strokePath()
  } else if (tipo === 'efeito') {
    g.strokeRect(x - 7 * s, y - 10 * s, 14 * s, 20 * s)
    for (const [dx, dy] of [[-11, -10], [11, -4], [-10, 9], [10, 11]]) g.fillRect(x + dx * s - 1.5 * s, y + dy * s - 1.5 * s, 3 * s, 3 * s)
  } else if (tipo === 'lancamento') {
    g.strokeRect(x - 11 * s, y - 2 * s, 9 * s, 13 * s)
    g.lineBetween(x - 2 * s, y + 2 * s, x + 10 * s, y - 10 * s)
    g.fillTriangle(x + 12 * s, y - 12 * s, x + 4 * s, y - 10 * s, x + 10 * s, y - 4 * s)
  } else if (tipo === 'moldura') {
    g.strokeRect(x - 10 * s, y - 10 * s, 20 * s, 20 * s)
    g.strokeRect(x - 6 * s, y - 6 * s, 12 * s, 12 * s)
  } else if (tipo === 'xp') {
    g.fillTriangle(x, y - 11 * s, x - 10 * s, y + 7 * s, x + 10 * s, y + 7 * s)
  } else {
    // título: uma faixa
    g.fillRect(x - 11 * s, y - 5 * s, 22 * s, 10 * s)
    g.fillTriangle(x - 11 * s, y - 5 * s, x - 15 * s, y, x - 11 * s, y + 5 * s).fillTriangle(x + 11 * s, y - 5 * s, x + 15 * s, y, x + 11 * s, y + 5 * s)
  }
}
