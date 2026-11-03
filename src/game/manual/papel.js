import { criarRng, aleatorio } from '../pvp/baralho.js'

// Textura de papel gerada por código (sem arquivo): creme com grão, manchas suaves e escurecimento
// nas bordas. Devolve os pixels RGBA (Uint8ClampedArray) de uma imagem largura x altura; a cena
// (scenes/ManualRalsei.js) joga isto numa CanvasTexture e desenha por cima as pautas e as fibras.
// Determinístico: a mesma semente dá o mesmo papel (testado em __tests__/papel.test.js).
export const PAPEL_BASE = [244, 235, 212]

// ruído de valor suave em grade (celula px), interpolado
function manchas(rng, largura, altura, celula) {
  const gw = Math.ceil(largura / celula) + 2
  const gh = Math.ceil(altura / celula) + 2
  const grade = Array.from({ length: gw * gh }, () => aleatorio(rng) * 2 - 1)
  return (x, y) => {
    const gx = x / celula
    const gy = y / celula
    const ix = Math.floor(gx)
    const iy = Math.floor(gy)
    const fx = gx - ix
    const fy = gy - iy
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const v = (i, j) => grade[(iy + j) * gw + ix + i]
    const a = v(0, 0) + (v(1, 0) - v(0, 0)) * sx
    const b = v(0, 1) + (v(1, 1) - v(0, 1)) * sx
    return a + (b - a) * sy
  }
}

export function gerarPapel(largura, altura, semente = 'papel') {
  const rng = criarRng(`papel:${semente}`)
  const grande = manchas(rng, largura, altura, 90)
  const media = manchas(rng, largura, altura, 22)
  const dados = new Uint8ClampedArray(largura * altura * 4)
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const bx = Math.min(x, largura - 1 - x) / (largura * 0.5)
      const by = Math.min(y, altura - 1 - y) / (altura * 0.5)
      const borda = Math.min(1, Math.min(bx, by) * 5) // 0 na borda, 1 a ~10% dela
      const sombra = (1 - borda) * 16 // as bordas escurecem
      const ruido = grande(x, y) * 4 + media(x, y) * 3 + (aleatorio(rng) * 2 - 1) * 4.5
      const i = (y * largura + x) * 4
      dados[i] = PAPEL_BASE[0] + ruido - sombra
      dados[i + 1] = PAPEL_BASE[1] + ruido - sombra * 1.1
      dados[i + 2] = PAPEL_BASE[2] + ruido * 1.2 - sombra * 1.4
      dados[i + 3] = 255
    }
  }
  return dados
}
