// Contraste de cor (WCAG 2.x), para conferir se o texto do HUD se lê sobre o
// fundo. Lógica pura, sem Phaser (testada em __tests__/contraste.test.js).
//
//   luminancia('#ff8a1a' | 0xff8a1a)      luminância relativa, 0 (preto) a 1 (branco)
//   razaoContraste(frente, fundo)         1 a 21 (cores iguais = 1, preto no branco = 21)
//   passaWcag(razao, { grande })          AA: 4.5:1 (3:1 para texto grande: 24px, ou 19px em negrito)
//   misturarSobre(frente, fundo, alpha)   cor de uma camada com alpha sobre um fundo opaco
//
// Aceita número (0xrrggbb) ou string '#rrggbb' / '#rgb'.
export const MINIMO_TEXTO = 4.5
export const MINIMO_TEXTO_GRANDE = 3

export function rgb(cor) {
  if (typeof cor === 'number') return [(cor >> 16) & 255, (cor >> 8) & 255, cor & 255]
  let h = String(cor).trim().replace(/^#/, '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`cor inválida: ${cor}`)
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const linear = (c) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

export function luminancia(cor) {
  const [r, g, b] = rgb(cor).map(linear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function razaoContraste(frente, fundo) {
  const a = luminancia(frente)
  const b = luminancia(fundo)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

export const passaWcag = (razao, { grande = false } = {}) => razao >= (grande ? MINIMO_TEXTO_GRANDE : MINIMO_TEXTO)

export function misturarSobre(frente, fundo, alpha) {
  const f = rgb(frente)
  const b = rgb(fundo)
  const [r, g, bl] = f.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)))
  return (r << 16) | (g << 8) | bl
}
