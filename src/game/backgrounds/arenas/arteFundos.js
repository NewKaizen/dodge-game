// Utilidades dos fundos das arenas ESTAÇÃO ESPACIAL, CHINATOWN e CIDADE GRANDE
// (estacao.js, chinatown.js, cidade.js): texturas de canvas desenhadas uma vez só, gerador
// de números com semente (o cenário é sempre o mesmo) e ruído suave.

// Gerador com semente (mulberry32): () => 0..1
export function criarSorte(semente) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Cria (uma vez) a textura `chave` desenhando com o contexto 2D de um canvas largura x altura
export function criarTextura(scene, chave, largura, altura, desenhar) {
  if (scene.textures.exists(chave)) return chave
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  desenhar(canvas.getContext('2d'), largura, altura)
  scene.textures.addCanvas(chave, canvas)
  return chave
}

// cor entre a e b (p de 0 a 1), inteiros 0xRRGGBB
export const misturar = (a, b, p) => {
  const c = (d) => Math.round(((a >> d) & 255) + (((b >> d) & 255) - ((a >> d) & 255)) * p) << d
  return c(16) | c(8) | c(0)
}

export const css = (cor, alpha = 1) => `rgba(${(cor >> 16) & 255},${(cor >> 8) & 255},${cor & 255},${alpha})`

export const limitar = (v, a, b) => Math.max(a, Math.min(b, v))

// Ruído de valor 3D (determinístico) com fBm: bom para planetas (a esfera não tem emenda)
const hash3 = (x, y, z) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const suave = (t) => t * t * (3 - 2 * t)
export function ruido3(x, y, z) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const u = suave(x - xi)
  const v = suave(y - yi)
  const w = suave(z - zi)
  const l = (a, b, t) => a + (b - a) * t
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
    w,
  )
}
export function fbm3(x, y, z, oitavas = 4) {
  let soma = 0
  let amp = 0.5
  let f = 1
  for (let i = 0; i < oitavas; i++) {
    soma += ruido3(x * f, y * f, z * f) * amp
    amp *= 0.5
    f *= 2.03
  }
  return soma
}

// Retângulo de cantos arredondados no contexto 2D
export function retArredondado(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}
