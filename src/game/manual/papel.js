import { criarRng, aleatorio } from '../pvp/baralho.js'

// Textura de papel gerada por código (sem arquivo): creme quentinho com grão, fibras compridas, manchas
// suaves e uma vinheta macia. Devolve os pixels RGBA (Uint8ClampedArray) de uma imagem largura x altura;
// manual/paginaBase.js joga isto num canvas e desenha por cima as pautas, a espiral e a dobrinha do canto.
// Determinístico: a mesma semente dá o mesmo papel (testado em __tests__/papel.test.js).
//
//   gerarPapel(largura, altura, semente)   os pixels
//   vinheta(x, y, largura, altura)          0 no meio da folha .. 1 nos cantos (quanto escurece)
//   fibrasDoPapel(semente, n, largura, altura)  fiapos soltos [{ x, y, angulo, comprimento, claro }]
//   furosDaEspiral(altura, op)              os y dos furos da espiral (lombada à esquerda)
export const PAPEL_BASE = [247, 236, 211]

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

// 0 no meio, sobe devagar até 1 nos cantos (elipse: as laterais escurecem antes do meio de cima)
export function vinheta(x, y, largura, altura) {
  const dx = (x / largura - 0.5) * 2
  const dy = (y / altura - 0.5) * 2
  const d = Math.min(1, Math.hypot(dx * 0.92, dy * 0.8) / 1.25)
  return d * d * d
}

export function gerarPapel(largura, altura, semente = 'papel') {
  const rng = criarRng(`papel:${semente}`)
  const grande = manchas(rng, largura, altura, 110)
  const media = manchas(rng, largura, altura, 24)
  // fibras: ruído esticado na horizontal (o papel tem "direção")
  const fibra = manchas(rng, largura * 0.12, altura, 3)
  const dados = new Uint8ClampedArray(largura * altura * 4)
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const bx = Math.min(x, largura - 1 - x) / (largura * 0.5)
      const by = Math.min(y, altura - 1 - y) / (altura * 0.5)
      const borda = Math.min(1, Math.min(bx, by) * 9) // escurece só bem rente à beirada
      const sombra = (1 - borda) * 10 + vinheta(x, y, largura, altura) * 20
      const f = fibra(x * 0.12, y)
      const ruido = grande(x, y) * 4 + media(x, y) * 2.4 + f * 2.6 + (aleatorio(rng) * 2 - 1) * 3.6
      const i = (y * largura + x) * 4
      dados[i] = PAPEL_BASE[0] + ruido - sombra * 0.9
      dados[i + 1] = PAPEL_BASE[1] + ruido - sombra * 1.1
      dados[i + 2] = PAPEL_BASE[2] + ruido * 1.2 - sombra * 1.5
      dados[i + 3] = 255
    }
  }
  return dados
}

export function fibrasDoPapel(semente, n, largura, altura) {
  const rng = criarRng(`fibras:${semente}`)
  return Array.from({ length: n }, () => ({
    x: aleatorio(rng) * largura,
    y: aleatorio(rng) * altura,
    angulo: (aleatorio(rng) - 0.5) * 0.9, // quase sempre na horizontal
    comprimento: 4 + aleatorio(rng) * 10,
    claro: aleatorio(rng) < 0.35,
  }))
}

export function furosDaEspiral(altura, { topo = 26, passo = 30, base = 20 } = {}) {
  const ys = []
  for (let y = topo; y <= altura - base; y += passo) ys.push(y)
  return ys
}
