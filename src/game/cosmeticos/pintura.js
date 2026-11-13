// PINTURA em canvas para os estilos de carta (frentes.js) e os versos ilustrados (versos.js). Sem Phaser: só a
// API 2D do canvas (os testes passam um contexto de mentira). Cada desenho vira UMA textura por jogo
// (scene.textures, chave fixa): as cartas só põem uma imagem dela, sem redesenhar nada a cada quadro.
//
//   textura(scene, chave, w, h, pintar, { pixel })   cria a textura (se ainda não existe) -> chave | null
//   semente(n)                                      gerador pseudoaleatório fixo (o desenho sai sempre igual)
//   cartao(c, x, y, w, h, r)                        caminho de retângulo arredondado
//   naipeCanvas(c, naipe, x, y, r)                  caminho de um naipe (raio 1 = o das balas e da Carta)
//   estrela(c, x, y, r, pontas, miolo)              caminho de estrela
//   rgba(cor, a) / hex(cor)                          0xRRGGBB -> texto do canvas
export const TAU = Math.PI * 2

// a textura de uma vez por jogo. Um desenho que lança erro não deixa textura pela metade (e o erro sobe:
// quem chamou cai no padrão)
export function textura(scene, chave, w, h, pintar, { pixel = false } = {}) {
  const T = scene?.textures
  if (!T) return null
  if (T.exists?.(chave)) return chave
  const t = T.createCanvas?.(chave, w, h)
  const c = t?.context ?? t?.getContext?.()
  if (!c) {
    if (t) T.remove?.(chave)
    return null
  }
  try {
    pintar(c, w, h)
  } catch (e) {
    T.remove?.(chave)
    throw e
  }
  t.refresh?.()
  t.setFilter?.(pixel ? 1 : 0) // 0 = LINEAR, 1 = NEAREST (Phaser.Textures.FilterMode)
  return chave
}

export function semente(n = 1) {
  let a = n >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const hex = (cor) => '#' + (cor >>> 0).toString(16).padStart(6, '0').slice(-6)
export const rgba = (cor, a = 1) => `rgba(${(cor >> 16) & 255},${(cor >> 8) & 255},${cor & 255},${a})`

export function cartao(c, x, y, w, h, r) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.lineTo(x + w - r, y)
  c.quadraticCurveTo(x + w, y, x + w, y + r)
  c.lineTo(x + w, y + h - r)
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  c.lineTo(x + r, y + h)
  c.quadraticCurveTo(x, y + h, x, y + h - r)
  c.lineTo(x, y + r)
  c.quadraticCurveTo(x, y, x + r, y)
  c.closePath()
}

export function estrela(c, x, y, r, pontas = 5, miolo = 0.45, giro = -Math.PI / 2) {
  c.beginPath()
  for (let i = 0; i < pontas * 2; i++) {
    const raio = i % 2 ? r * miolo : r
    const a = giro + (i * Math.PI) / pontas
    c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * raio, y + Math.sin(a) * raio)
  }
  c.closePath()
}

// os naipes com as mesmas curvas da Carta (raio 1), como caminho do canvas
export function naipeCanvas(c, naipe, x, y, r) {
  const P = (px, py) => [x + px * r, y + py * r]
  c.beginPath()
  if (naipe === 'copas') {
    c.moveTo(...P(0, 0.95))
    c.bezierCurveTo(...P(-1.25, 0), ...P(-0.95, -1.05), ...P(0, -0.4))
    c.bezierCurveTo(...P(0.95, -1.05), ...P(1.25, 0), ...P(0, 0.95))
  } else if (naipe === 'ouros') {
    c.moveTo(...P(0, -1))
    c.quadraticCurveTo(...P(0.25, -0.25), ...P(0.8, 0))
    c.quadraticCurveTo(...P(0.25, 0.25), ...P(0, 1))
    c.quadraticCurveTo(...P(-0.25, 0.25), ...P(-0.8, 0))
    c.quadraticCurveTo(...P(-0.25, -0.25), ...P(0, -1))
  } else if (naipe === 'paus') {
    for (const [cx, cy] of [[0, -0.45], [-0.45, 0.12], [0.45, 0.12]]) {
      c.moveTo(...P(cx + 0.4, cy))
      c.arc(...P(cx, cy), 0.4 * r, 0, TAU)
    }
    c.moveTo(...P(0, 0))
    c.lineTo(...P(0.35, 1))
    c.lineTo(...P(-0.35, 1))
  } else {
    c.moveTo(...P(0, -1))
    c.bezierCurveTo(...P(0.4, -0.5), ...P(1.1, -0.1), ...P(0.9, 0.35))
    c.bezierCurveTo(...P(0.7, 0.75), ...P(0.2, 0.7), ...P(0, 0.35))
    c.bezierCurveTo(...P(-0.2, 0.7), ...P(-0.7, 0.75), ...P(-0.9, 0.35))
    c.bezierCurveTo(...P(-1.1, -0.1), ...P(-0.4, -0.5), ...P(0, -1))
    c.moveTo(...P(0, 0.2))
    c.lineTo(...P(0.4, 1))
    c.lineTo(...P(-0.4, 1))
  }
  c.closePath()
}

// ruído de papel: pontinhos claros e escuros espalhados (fixos)
export function grao(c, w, h, { n = 900, claro = 'rgba(255,255,255,0.35)', escuro = 'rgba(0,0,0,0.05)', seed = 7, tam = 1.2 } = {}) {
  const r = semente(seed)
  for (let i = 0; i < n; i++) {
    c.fillStyle = i % 2 ? claro : escuro
    c.fillRect(r() * w, r() * h, tam * (0.5 + r()), tam * (0.5 + r()))
  }
}

// uma folha de bordo (momiji) de 5 pontas, raio r, girada a
export function folhaBordo(c, x, y, r, a = 0) {
  c.save()
  c.translate(x, y)
  c.rotate(a)
  c.beginPath()
  const pontas = [[0, -1], [0.22, -0.5], [0.88, -0.62], [0.5, -0.1], [0.82, 0.32], [0.18, 0.24], [0.05, 0.42], [-0.05, 0.42], [-0.18, 0.24], [-0.82, 0.32], [-0.5, -0.1], [-0.88, -0.62], [-0.22, -0.5]]
  pontas.forEach(([px, py], i) => c[i ? 'lineTo' : 'moveTo'](px * r, py * r))
  c.closePath()
  c.fill()
  c.strokeStyle = 'rgba(0,0,0,0.25)'
  c.lineWidth = Math.max(0.6, r * 0.06)
  c.beginPath()
  c.moveTo(0, 0.95 * r)
  c.lineTo(0, -0.8 * r)
  c.moveTo(0, 0.1 * r)
  c.lineTo(0.75 * r, -0.2 * r)
  c.moveTo(0, 0.1 * r)
  c.lineTo(-0.75 * r, -0.2 * r)
  c.stroke()
  c.restore()
}

// flor de cerejeira de 5 pétalas
export function florSakura(c, x, y, r, a = 0, cor = '#ffb7cf', miolo = '#e0567f') {
  c.save()
  c.translate(x, y)
  c.rotate(a)
  c.fillStyle = cor
  for (let i = 0; i < 5; i++) {
    c.rotate(TAU / 5)
    c.beginPath()
    c.moveTo(0, 0)
    c.bezierCurveTo(-r * 0.55, -r * 0.35, -r * 0.45, -r * 1.05, -r * 0.1, -r)
    c.lineTo(0, -r * 0.82)
    c.lineTo(r * 0.1, -r)
    c.bezierCurveTo(r * 0.45, -r * 1.05, r * 0.55, -r * 0.35, 0, 0)
    c.fill()
  }
  c.fillStyle = miolo
  c.beginPath()
  c.arc(0, 0, r * 0.2, 0, TAU)
  c.fill()
  c.restore()
}
