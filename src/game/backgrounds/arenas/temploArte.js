// Arte do fundo do TEMPLO (templo.js), desenhada por código uma vez só e
// guardada como textura (scene.textures.addCanvas). Tudo em pixel art na
// METADE da resolução do jogo (320x240, cada pixel da arte vira 2x2 na tela).
//
// Salão em perspectiva de um ponto (ponto de fuga no meio, atrás das cartas
// reveladas): teto com um buraco por onde entra o sol, paredes de blocos,
// colunas sumindo no escuro, chão de lajotas, o ídolo no nicho da parede do
// fundo e os degraus do altar. Na frente (outra camada, para o parallax): as
// duas colunas das bordas e a viga de pedra quebrada com hieróglifos.
//
//   gerarArteTemplo(scene)  cria as texturas (se ainda não existem)
//   TEMPLO                  onde fica cada coisa (tochas, glifos, olhos...) em pixels da arte

export const P = 2 // pixels do jogo por pixel da arte
const L = 320
const A = 240
const VP = { x: 160, y: 96 } // ponto de fuga
const S = 0.325 // escala da parede do fundo (quanto ela é menor que a "boca" do salão)
const FUNDO = { esq: VP.x - 160 * S, dir: VP.x + 160 * S, topo: VP.y - 96 * S, base: VP.y + 144 * S }
const VIGA = { topo: 34, base: 52, quebraEsq: 138, quebraDir: 182 } // viga da frente (com a quebra no meio)
const NICHO = { esq: 143, dir: 177, topo: 70 }

const COR = {
  breu: 0x0b0705,
  sombra: 0x170f09,
  pedra0: 0x261b12,
  pedra1: 0x34261a,
  pedra2: 0x47341f,
  pedra3: 0x5e4528,
  pedra4: 0x7a5c35,
  pedra5: 0x9c7a48,
  junta: 0x120b07,
  ouro0: 0x7a5418,
  ouro1: 0xb8862a,
  ouro2: 0xf0c050,
  ouro3: 0xffe49a,
  folha0: 0x142218,
  folha1: 0x1f4022,
  folha2: 0x33622a,
  folha3: 0x58903a,
  ceuAlto: 0x6a5430,
  ceuBaixo: 0xb89858,
  madeira: 0x4a2c16,
  ferro: 0x2c2622,
}

// Hieróglifos 5x7 ('#' = entalhe)
const GLIFOS = [
  ['.###.', '#...#', '.###.', '..#..', '#####', '..#..', '..#..'], // ankh
  ['.....', '.###.', '#.#.#', '.###.', '..#..', '.#.#.', '#....'], // olho
  ['..##.', '.###.', '..#..', '.###.', '####.', '.##..', '.#.#.'], // pássaro
  ['.....', '#.#.#', '.#.#.', '.....', '#.#.#', '.#.#.', '.....'], // água
  ['..#..', '.###.', '##.##', '.###.', '..#..', '.....', '#####'], // sol
  ['.##..', '#..#.', '...#.', '..#..', '.#...', '#....', '.####'], // serpente
  ['..#..', '.##..', '.##..', '.###.', '.##..', '.##..', '..#..'], // pena
  ['#.#.#', '#.#.#', '#####', '.###.', '..#..', '..#..', '..#..'], // junco
  ['.....', '..#..', '.#.#.', '#...#', '#####', '.....', '#.#.#'], // pirâmide
  ['.#.#.', '..#..', '.###.', '#####', '.###.', '#.#.#', '.....'], // escaravelho
]

// ---------- onde fica cada coisa (pixels da arte) ----------

const glifosViga = (() => {
  const lista = []
  let n = 0
  for (let x = 7; x + 5 <= VIGA.quebraEsq - 6; x += 10) {
    lista.push({ x, y: 39, forma: (n * 7 + 3) % GLIFOS.length })
    lista.push({ x: L - x - 5, y: 39, forma: (n * 3 + 5) % GLIFOS.length })
    n++
  }
  return lista
})()
const glifosColunas = [0, 1, 2, 3].flatMap((k) => [
  { x: 12, y: 126 + k * 10, forma: (k * 4 + 1) % GLIFOS.length, coluna: true },
  { x: L - 17, y: 126 + k * 10, forma: (k * 5 + 2) % GLIFOS.length, coluna: true },
])

export const TEMPLO = {
  VP,
  // ordem da onda dourada: 0 no meio da viga, 1 nas pontas, >1 descendo as colunas
  glifos: [
    ...glifosViga.map((g) => ({ ...g, ordem: Math.abs(g.x + 2.5 - VP.x) / 160, frente: true })),
    ...glifosColunas.map((g) => ({ ...g, ordem: 1.05 + ((g.y - 126) / 10) * 0.08, frente: true })),
  ],
  tochas: [
    { x: 14, y: 95, frente: true },
    { x: L - 14, y: 95, frente: true },
    { x: NICHO.esq - 4, y: 101, frente: false },
    { x: NICHO.dir + 4, y: 101, frente: false },
  ],
  idolo: { x: 160, y: 77 }, // meio, alto da cabeça
  olhos: [
    { x: 156, y: 87 },
    { x: 161, y: 87 },
  ],
  disco: { x: 160, y: 85, r: 15 },
  buraco: { x: 160, y: 20 },
  quebra: { esq: VIGA.quebraEsq, dir: VIGA.quebraDir, y: VIGA.base },
  altar: { x: 160, y: FUNDO.base + 3 },
  nGlifos: GLIFOS.length,
}

// ---------- utilidades de cor e de desenho ----------

const canal = (c, d) => (c >> d) & 255
const tom = (c, f) => {
  const k = (d) => Math.max(0, Math.min(255, Math.round(canal(c, d) * f))) << d
  return k(16) | k(8) | k(0)
}
const misturar = (a, b, p) => {
  const k = (d) => Math.round(canal(a, d) + (canal(b, d) - canal(a, d)) * p) << d
  return k(16) | k(8) | k(0)
}
const css = (c, a = 1) => `rgba(${canal(c, 16)},${canal(c, 8)},${canal(c, 0)},${a})`
// quanto de luz tem a profundidade s (1 = boca do salão, S = parede do fundo): o fundo some no escuro
const luzProf = (s) => 0.42 + 0.58 * ((s - S) / (1 - S))

function rngSemente(semente) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function tela(largura, altura) {
  const c = document.createElement('canvas')
  c.width = largura
  c.height = altura
  const g = c.getContext('2d')
  g.imageSmoothingEnabled = false
  return [c, g]
}

// pincel de pixel art: só retângulos inteiros (nada de borda borrada)
function pintor(g) {
  const ret = (x, y, w, h, c, a = 1) => {
    g.fillStyle = css(c, a)
    const x0 = Math.round(x)
    const y0 = Math.round(y)
    g.fillRect(x0, y0, Math.round(x + w) - x0, Math.round(y + h) - y0)
  }
  const pix = (x, y, c, a = 1) => {
    g.fillStyle = css(c, a)
    g.fillRect(Math.round(x), Math.round(y), 1, 1)
  }
  // polígono preenchido linha a linha
  const poli = (pts, c, a = 1) => {
    const ys = pts.map((p) => p[1])
    const y0 = Math.floor(Math.min(...ys))
    const y1 = Math.ceil(Math.max(...ys))
    g.fillStyle = css(c, a)
    for (let y = y0; y < y1; y++) {
      const yc = y + 0.5
      const xs = []
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i]
        const [bx, by] = pts[(i + 1) % pts.length]
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) * (bx - ax)) / (by - ay))
      }
      xs.sort((m, n) => m - n)
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.round(xs[k])
        const xb = Math.round(xs[k + 1])
        if (xb > xa) g.fillRect(xa, y, xb - xa, 1)
      }
    }
  }
  const linha = (x0, y0, x1, y1, c, a = 1) => {
    g.fillStyle = css(c, a)
    x0 = Math.round(x0)
    y0 = Math.round(y0)
    x1 = Math.round(x1)
    y1 = Math.round(y1)
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let erro = dx + dy
    for (;;) {
      g.fillRect(x0, y0, 1, 1)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * erro
      if (e2 >= dy) {
        erro += dy
        x0 += sx
      }
      if (e2 <= dx) {
        erro += dx
        y0 += sy
      }
    }
  }
  const circulo = (cx, cy, r, c, a = 1) => {
    g.fillStyle = css(c, a)
    for (let dy = -r; dy <= r; dy++) {
      const meia = Math.floor(Math.sqrt(r * r - dy * dy))
      g.fillRect(Math.round(cx - meia), Math.round(cy + dy), meia * 2 + 1, 1)
    }
  }
  return { ret, pix, poli, linha, circulo }
}

// rachadura: passeio aleatório para baixo
function rachadura(p, rnd, x, y, passos, cor) {
  for (let i = 0; i < passos; i++) {
    p.pix(x, y, cor)
    y += 1
    x += rnd() < 0.35 ? -1 : rnd() < 0.55 ? 1 : 0
    if (rnd() < 0.12) rachadura(p, rnd, x, y, Math.floor(passos / 3), cor)
  }
}

// trepadeira subindo (ou descendo) em zigue-zague, com folhinhas
function trepadeira(p, rnd, x, y, comprimento, { dir = -1, largura = 3, escala = 1 } = {}) {
  const fase = rnd() * 6
  for (let i = 0; i < comprimento; i++) {
    const xx = x + Math.round(Math.sin(fase + i / (3.2 * escala)) * largura)
    const yy = y + i * dir
    p.pix(xx, yy, COR.folha1)
    if (i % 3 === 0) p.pix(xx + 1, yy, COR.folha0)
    if (rnd() < 0.32) {
      const lado = rnd() < 0.5 ? -1 : 1
      p.pix(xx + lado, yy, COR.folha2)
      p.pix(xx + lado * 2, yy, rnd() < 0.5 ? COR.folha3 : COR.folha2)
      if (rnd() < 0.4) p.pix(xx + lado, yy - dir, COR.folha2)
    }
  }
}

function desenharGlifo(p, forma, x, y, fundo, luz) {
  GLIFOS[forma].forEach((linha, dy) => {
    ;[...linha].forEach((ch, dx) => {
      if (ch !== '#') return
      p.pix(x + dx, y + dy, fundo)
      // borda de baixo/direita mais clara: parece entalhado na pedra
      const abaixo = GLIFOS[forma][dy + 1]?.[dx] === '#'
      if (!abaixo) p.pix(x + dx, y + dy + 1, luz)
    })
  })
}

// ---------- camada do fundo (opaca) ----------

function desenharTeto(p, rnd) {
  for (let y = 0; y < FUNDO.topo; y++) {
    const s = (VP.y - y) / 96
    const x0 = VP.x - 160 * s
    p.ret(x0, y, 320 * s, 1, tom(COR.pedra1, luzProf(s) * 0.75))
  }
  // vigas do teto convergindo para o fundo e traves atravessadas
  for (let xf = -160; xf <= 160; xf += 40) p.linha(VP.x + xf, 0, VP.x + xf * S, FUNDO.topo, COR.junta)
  for (const z of [1.25, 1.6, 2.05, 2.6]) {
    const s = 1 / z
    const y = VP.y - 96 * s
    p.ret(VP.x - 160 * s, y, 320 * s, 1, COR.junta)
    p.ret(VP.x - 160 * s, y + 1, 320 * s, 1, tom(COR.pedra3, luzProf(s) * 0.7))
  }
  // o buraco: um pedaço do teto caiu (e quebrou a viga da frente) e o sol entra por ele
  const buraco = [
    [126, 0], [194, 0], [192, 7], [187, 12], [189, 19], [184, 26], [180, 33], [176, 40],
    [168, 43], [160, 41], [152, 44], [145, 39], [140, 32], [134, 25], [136, 17], [130, 10],
  ]
  // céu em degradê, linha a linha, recortado pelo polígono
  const ys = buraco.map((q) => q[1])
  for (let y = 0; y < Math.max(...ys); y++) {
    const yc = y + 0.5
    const xs = []
    for (let i = 0; i < buraco.length; i++) {
      const [ax, ay] = buraco[i]
      const [bx, by] = buraco[(i + 1) % buraco.length]
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) * (bx - ax)) / (by - ay))
    }
    xs.sort((m, n) => m - n)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      // pontilhado de duas cores na faixa de transição (degradê de pixel art)
      const t = y / 44
      for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) {
        const passo = Math.floor(t * 5)
        const fra = t * 5 - passo
        const usar = fra > 0.5 && (x + y) % 2 === 0 ? passo + 1 : passo
        p.pix(x, y, misturar(COR.ceuAlto, COR.ceuBaixo, Math.min(1, usar / 5)))
      }
      // borda quebrada da pedra em volta
      p.pix(Math.round(xs[k]) - 1, y, COR.pedra4)
      p.pix(Math.round(xs[k + 1]), y, COR.pedra3)
    }
  }
  // raízes e cipós pendurados na borda do buraco (silhueta contra o céu)
  for (const [x, y0, n] of [
    [137, 14, 16], [143, 30, 18], [152, 0, 12], [171, 0, 9], [183, 20, 15], [189, 8, 10], [164, 0, 6],
  ]) {
    let xx = x
    for (let i = 0; i < n; i++) {
      p.pix(xx, y0 + i, i % 4 === 0 ? COR.folha1 : COR.folha0)
      if (rnd() < 0.3) xx += rnd() < 0.5 ? -1 : 1
      if (rnd() < 0.25) p.pix(xx + (rnd() < 0.5 ? -1 : 1), y0 + i, COR.folha2)
    }
  }
  // tufos de folhas na borda
  for (let k = 0; k < 30; k++) {
    const q = buraco[Math.floor(rnd() * buraco.length)]
    p.pix(q[0] + Math.round(rnd() * 4 - 2), q[1] + Math.round(rnd() * 3 - 1), rnd() < 0.5 ? COR.folha2 : COR.folha3)
  }
}

function desenharParedeLateral(p, rnd, lado) {
  const xDe = (s) => (lado < 0 ? VP.x - 160 * s : VP.x + 160 * s)
  const larg = Math.round(160 - 160 * S)
  for (let i = 0; i < larg; i++) {
    const s = (160 - i - 0.5) / 160
    const x = lado < 0 ? i : L - 1 - i
    const yt = VP.y - 96 * s
    const yb = VP.y + 144 * s
    p.ret(x, yt, 1, yb - yt, tom(COR.pedra2, luzProf(s)))
  }
  // fiadas de blocos (linhas convergindo) e juntas verticais desencontradas
  const N = 13
  const dys = Array.from({ length: N + 1 }, (_, k) => -96 + (k * 240) / N)
  for (let k = 1; k < N; k++) {
    p.linha(xDe(1), VP.y + dys[k], xDe(S), VP.y + dys[k] * S, COR.junta)
    p.linha(xDe(1), VP.y + dys[k] + 1, xDe(S), VP.y + dys[k] * S + 1, tom(COR.pedra3, 0.75))
  }
  for (let k = 0; k < N; k++) {
    for (let j = 0; ; j++) {
      const z = 1 + (j + (k % 2) * 0.5) * 0.32
      const s = 1 / z
      if (s <= S + 0.01) break
      const x = xDe(s)
      p.linha(x, VP.y + dys[k] * s + 1, x, VP.y + dys[k + 1] * s - 1, COR.junta)
    }
  }
  // textura: pontinhos mais claros e mais escuros
  for (let k = 0; k < 520; k++) {
    const i = Math.floor(rnd() * larg)
    const s = (160 - i) / 160
    const y = VP.y - 96 * s + rnd() * 240 * s
    p.pix(lado < 0 ? i : L - 1 - i, y, tom(rnd() < 0.5 ? COR.pedra1 : COR.pedra3, luzProf(s)))
  }
  // rachaduras e musgo descendo do teto / subindo do chão
  for (let k = 0; k < 6; k++) {
    const i = 6 + Math.floor(rnd() * (larg - 12))
    const s = (160 - i) / 160
    rachadura(p, rnd, lado < 0 ? i : L - 1 - i, VP.y - 96 * s + rnd() * 120 * s, 6 + Math.floor(rnd() * 14), COR.junta)
  }
  for (let k = 0; k < 9; k++) {
    const i = Math.floor(rnd() * (larg - 4))
    const s = (160 - i) / 160
    const x = lado < 0 ? i : L - 1 - i
    trepadeira(p, rnd, x, VP.y + 144 * s - 1, Math.floor((10 + rnd() * 30) * s), { largura: 1, escala: s })
  }
}

function desenharChao(p, rnd) {
  // lajotas em perspectiva: colunas que convergem e fileiras que se apertam
  const xfs = Array.from({ length: 13 }, (_, i) => -160 + (i * 320) / 12)
  const zs = [1, 1.18, 1.4, 1.66, 1.98, 2.36, 2.78, 1 / S]
  for (let j = 0; j + 1 < zs.length; j++) {
    const s0 = 1 / zs[j]
    const s1 = 1 / zs[j + 1]
    for (let i = 0; i + 1 < xfs.length; i++) {
      const base = (i + j) % 2 ? COR.pedra2 : tom(COR.pedra2, 0.86)
      const varia = 0.9 + rnd() * 0.18
      const c = tom(base, luzProf((s0 + s1) / 2) * varia)
      p.poli(
        [
          [VP.x + xfs[i] * s0, VP.y + 144 * s0],
          [VP.x + xfs[i + 1] * s0, VP.y + 144 * s0],
          [VP.x + xfs[i + 1] * s1, VP.y + 144 * s1],
          [VP.x + xfs[i] * s1, VP.y + 144 * s1],
        ],
        c,
      )
    }
  }
  for (const xf of xfs) p.linha(VP.x + xf, A, VP.x + xf * S, FUNDO.base, COR.junta)
  for (const z of zs) {
    const s = 1 / z
    p.ret(VP.x - 160 * s, VP.y + 144 * s, 320 * s, 1, COR.junta)
  }
  // rachaduras, cascalho e moedinhas perdidas perto do altar
  for (let k = 0; k < 10; k++) {
    const s = S + rnd() * (1 - S)
    const x = VP.x + (rnd() * 2 - 1) * 150 * s
    const y = VP.y + 144 * s
    let xx = x
    for (let i = 0; i < 4 + rnd() * 10; i++) {
      p.pix(xx, y - i * 0.4, COR.junta)
      xx += rnd() < 0.5 ? -1 : 1
    }
  }
  for (let k = 0; k < 60; k++) {
    const s = S + rnd() * (1 - S)
    p.pix(VP.x + (rnd() * 2 - 1) * 158 * s, VP.y + 144 * s - rnd() * 6, tom(rnd() < 0.5 ? COR.pedra4 : COR.pedra1, luzProf(s)))
  }
  for (const [x, y] of [[136, 158], [140, 160], [185, 157], [189, 161], [178, 166], [130, 170]]) {
    p.pix(x, y, COR.ouro1)
    p.pix(x + 1, y, COR.ouro0)
  }
}

function desenharColuna(p, rnd, lado, s) {
  // coluna encostada na parede lateral, na profundidade s
  const parede = lado < 0 ? VP.x - 160 * s : VP.x + 160 * s
  const w = Math.max(4, Math.round(20 * s))
  const x0 = lado < 0 ? parede + 3 * s : parede - 3 * s - w
  const yt = VP.y - 96 * s
  const yb = VP.y + 144 * s
  const luz = luzProf(s)
  const capH = Math.max(2, Math.round(7 * s))
  const baseH = Math.max(2, Math.round(7 * s))
  // face lateral (virada para o meio do salão), recuando para o ponto de fuga
  const k = 0.94
  const xl = lado < 0 ? x0 + w : x0
  const q = (x, y) => [VP.x + (x - VP.x) * k, VP.y + (y - VP.y) * k]
  p.poli([[xl, yt], q(xl, yt), q(xl, yb), [xl, yb]], tom(COR.pedra1, luz))
  // fuste com caneluras
  p.ret(x0, yt, w, yb - yt, tom(COR.pedra3, luz))
  for (let x = x0 + 1; x < x0 + w - 1; x += Math.max(2, Math.round(4 * s))) p.ret(x, yt + capH, 1, yb - yt - capH - baseH, tom(COR.pedra2, luz))
  p.ret(lado < 0 ? x0 : x0 + w - 1, yt, 1, yb - yt, tom(COR.pedra4, luz)) // quina iluminada
  // capitel e base mais largos
  const sobra = Math.max(1, Math.round(3 * s))
  p.ret(x0 - sobra, yt, w + sobra * 2, capH, tom(COR.pedra4, luz))
  p.ret(x0 - sobra, yt + capH - 1, w + sobra * 2, 1, tom(COR.pedra1, luz))
  p.ret(x0 - sobra, yb - baseH, w + sobra * 2, baseH, tom(COR.pedra4, luz))
  p.ret(x0 - sobra, yb - baseH, w + sobra * 2, 1, tom(COR.pedra5, luz))
  // rachaduras e trepadeira subindo pelo fuste
  for (let i = 0; i < 2 + Math.floor(rnd() * 2); i++) rachadura(p, rnd, x0 + 1 + rnd() * (w - 2), yt + capH + rnd() * (yb - yt) * 0.7, Math.floor((8 + rnd() * 14) * s + 3), tom(COR.junta, 1))
  trepadeira(p, rnd, x0 + w / 2, yb - baseH, Math.floor((yb - yt) * (0.35 + rnd() * 0.45)), { largura: Math.max(1, Math.round(w / 3)), escala: s })
}

function desenharTocha(p, x, y) {
  // suporte de ferro com cabo de madeira (a chama é animada em templo.js)
  p.ret(x - 1, y + 2, 3, 7, COR.madeira)
  p.ret(x - 1, y + 2, 1, 7, tom(COR.madeira, 1.4))
  p.ret(x - 2, y + 1, 5, 2, COR.ferro)
  p.ret(x - 2, y + 4, 5, 1, COR.ouro0)
  p.ret(x - 1, y + 9, 3, 2, COR.ferro)
}

function desenharFundoSalao(p, rnd) {
  const { esq, dir, topo, base } = FUNDO
  p.ret(esq, topo, dir - esq, base - topo, tom(COR.pedra2, 0.62))
  // blocos
  for (let y = topo, k = 0; y < base; y += 6, k++) {
    p.ret(esq, y, dir - esq, 1, COR.junta)
    for (let x = esq + (k % 2) * 6; x < dir; x += 12) p.ret(x, y, 1, 6, COR.junta)
  }
  for (let k = 0; k < 140; k++) p.pix(esq + rnd() * (dir - esq), topo + rnd() * (base - topo), tom(rnd() < 0.5 ? COR.pedra1 : COR.pedra3, 0.62))
  // luz quente das tochas do fundo (assada; o tremor de luz é animado)
  for (const t of TEMPLO.tochas.filter((q) => !q.frente)) {
    for (const [r, a] of [[16, 0.05], [11, 0.06], [7, 0.08]]) p.circulo(t.x, t.y + 2, r, COR.ouro1, a)
    desenharTocha(p, t.x, t.y)
  }
  // nicho em arco (fundo escuro) com moldura dourada
  const { esq: ne, dir: nd, topo: nt } = NICHO
  const cx = (ne + nd) / 2
  const r = (nd - ne) / 2
  p.ret(ne - 2, nt + r, nd - ne + 4, base - nt - r, COR.pedra4)
  p.circulo(cx, nt + r, r + 2, COR.pedra4)
  p.circulo(cx, nt + r, r + 2, COR.ouro0, 0.35)
  p.ret(ne, nt + r, nd - ne, base - nt - r, COR.pedra0)
  p.circulo(cx, nt + r, r, COR.pedra0)
  // luz do sol caindo no nicho (mais claro no meio)
  for (const [w, a] of [[24, 0.1], [16, 0.12], [8, 0.12]]) p.ret(cx - w / 2, nt + 4, w, base - nt - 4, COR.ouro2, a)
  // friso de hieróglifos miúdos dos dois lados do nicho
  for (let y = topo + 4; y < base - 6; y += 9) {
    p.ret(esq + 4, y + 7, ne - esq - 18, 1, tom(COR.pedra1, 0.8))
    p.ret(nd + 14, y + 7, dir - nd - 18, 1, tom(COR.pedra1, 0.8))
  }
}

// contorno escuro de 1 px em volta de tudo o que foi desenhado no canvas
function contornar(c, cor) {
  const g = c.getContext('2d')
  const { width: w, height: h } = c
  const dados = g.getImageData(0, 0, w, h).data
  const cheio = (x, y) => x >= 0 && y >= 0 && x < w && y < h && dados[(y * w + x) * 4 + 3] > 0
  g.fillStyle = css(cor)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!cheio(x, y) && (cheio(x - 1, y) || cheio(x + 1, y) || cheio(x, y - 1) || cheio(x, y + 1))) g.fillRect(x, y, 1, 1)
    }
  }
}

// O ídolo: um faraó de pedra sentado no trono, com o lenço listrado de ouro e
// lápis-lazúli, o colar largo e os braços cruzados segurando o cajado e o mangual
function desenharIdolo(g) {
  const [c, gi] = tela(36, 68)
  const p = pintor(gi)
  const cx = 18 // meio do ídolo neste canvas
  const pedra = COR.pedra4
  const claro = COR.pedra5
  const escuro = COR.pedra3
  const lapis = 0x2c4c86
  const turquesa = 0x3a8a8a
  // trono (atrás): encosto e base com friso dourado
  p.ret(cx - 15, 28, 4, 32, escuro)
  p.ret(cx + 11, 28, 4, 32, escuro)
  p.ret(cx - 15, 28, 4, 1, claro)
  p.ret(cx + 11, 28, 4, 1, claro)
  p.ret(cx - 16, 58, 32, 9, COR.pedra3)
  p.ret(cx - 16, 58, 32, 1, COR.ouro1)
  p.ret(cx - 16, 61, 32, 1, COR.ouro0)
  for (let x = cx - 14; x < cx + 14; x += 4) p.ret(x, 63, 2, 3, COR.pedra2)
  // pernas, pés, saiote plissado
  p.ret(cx - 9, 42, 6, 13, pedra)
  p.ret(cx + 3, 42, 6, 13, pedra)
  p.ret(cx - 9, 42, 1, 13, claro)
  p.ret(cx + 3, 42, 1, 13, claro)
  p.ret(cx - 10, 54, 8, 4, claro)
  p.ret(cx + 2, 54, 8, 4, claro)
  p.ret(cx - 10, 57, 8, 1, escuro)
  p.ret(cx + 2, 57, 8, 1, escuro)
  p.ret(cx - 10, 35, 20, 8, COR.ouro1)
  for (let x = cx - 9; x < cx + 10; x += 2) p.ret(x, 36, 1, 7, COR.ouro0)
  p.ret(cx - 10, 35, 20, 1, COR.ouro2)
  // tronco e braços
  p.ret(cx - 7, 21, 14, 14, pedra)
  p.ret(cx - 10, 21, 4, 12, pedra)
  p.ret(cx + 6, 21, 4, 12, pedra)
  p.ret(cx - 10, 21, 1, 12, claro)
  p.ret(cx - 7, 27, 14, 3, claro) // antebraços cruzados
  p.ret(cx - 7, 30, 14, 1, escuro)
  // cajado (ouro) e mangual (lápis) cruzados no peito
  p.linha(cx - 5, 23, cx + 3, 33, COR.ouro2)
  p.pix(cx - 6, 22, COR.ouro2)
  p.pix(cx - 6, 21, COR.ouro1)
  p.linha(cx + 5, 23, cx - 3, 33, lapis)
  p.pix(cx + 6, 22, COR.ouro1)
  p.pix(cx + 7, 23, COR.ouro1)
  // colar largo (wesekh)
  p.ret(cx - 9, 18, 18, 4, COR.ouro1)
  p.ret(cx - 8, 19, 16, 1, turquesa)
  p.ret(cx - 7, 21, 14, 1, lapis)
  for (let x = cx - 8; x < cx + 8; x += 2) p.pix(x, 18, COR.ouro2)
  // lenço listrado (nemes): coroa e abas caindo dos lados do rosto
  p.poli([[cx - 7, 2], [cx + 7, 2], [cx + 10, 13], [cx - 10, 13]], COR.ouro1)
  p.ret(cx - 10, 12, 4, 9, COR.ouro1)
  p.ret(cx + 6, 12, 4, 9, COR.ouro1)
  for (let y = 4; y < 21; y += 2) {
    p.ret(cx - 10, y, 4, 1, lapis)
    p.ret(cx + 6, y, 4, 1, lapis)
  }
  p.ret(cx - 6, 3, 12, 1, lapis)
  // rosto
  p.ret(cx - 5, 6, 10, 11, claro)
  p.ret(cx - 5, 6, 10, 1, COR.ouro1) // faixa da testa
  p.ret(cx + 3, 7, 2, 10, pedra) // sombra do lado do rosto
  p.ret(cx - 4, 10, 3, 1, COR.breu) // olhos (contorno kohl)
  p.ret(cx + 1, 10, 3, 1, COR.breu)
  p.pix(cx - 4, 9, escuro)
  p.pix(cx + 3, 9, escuro)
  p.ret(cx - 1, 11, 1, 3, pedra) // nariz
  p.ret(cx - 2, 15, 4, 1, escuro) // boca
  p.ret(cx - 1, 17, 2, 4, COR.ouro0) // barba cerimonial
  p.ret(cx - 1, 17, 1, 4, COR.ouro1)
  // serpente na testa
  p.pix(cx, 4, COR.ouro2)
  p.pix(cx, 5, COR.ouro2)
  p.pix(cx - 1, 3, COR.ouro1)
  // rachadura antiga atravessando o rosto e o peito
  p.linha(cx + 2, 6, cx + 3, 11, escuro)
  p.linha(cx + 3, 11, cx + 1, 15, escuro)
  p.linha(cx - 4, 24, cx - 6, 32, escuro)
  contornar(c, COR.junta)
  g.drawImage(c, TEMPLO.idolo.x - cx, TEMPLO.idolo.y)
}

function desenharAltar(p) {
  // três degraus do altar, alargando para a frente
  for (let k = 0; k < 3; k++) {
    const w = 34 + k * 10
    const y = FUNDO.base - 2 + k * 3
    p.ret(VP.x - w / 2, y, w, 3, tom(COR.pedra4, 0.8 + k * 0.05))
    p.ret(VP.x - w / 2, y, w, 1, tom(COR.pedra5, 0.85))
    p.ret(VP.x - w / 2, y + 2, w, 1, tom(COR.pedra2, 0.8))
  }
  // a poça de sol nos degraus
  p.ret(VP.x - 12, FUNDO.base - 2, 24, 9, COR.ouro2, 0.14)
  p.ret(VP.x - 7, FUNDO.base - 2, 14, 9, COR.ouro3, 0.1)
}

function gerarFundo() {
  const [c, g] = tela(L, A)
  const p = pintor(g)
  const rnd = rngSemente(1931)
  p.ret(0, 0, L, A, COR.breu)
  desenharTeto(p, rnd)
  desenharParedeLateral(p, rnd, -1)
  desenharParedeLateral(p, rnd, 1)
  desenharChao(p, rnd)
  desenharFundoSalao(p, rnd)
  for (const s of [0.4, 0.52, 0.68, 0.84]) {
    desenharColuna(p, rnd, -1, s)
    desenharColuna(p, rnd, 1, s)
  }
  // disco solar atrás da cabeça do ídolo (a onda dourada acende por cima)
  const { x, y, r } = TEMPLO.disco
  p.circulo(x, y, r, COR.ouro1)
  p.circulo(x, y, r - 1, COR.ouro0)
  p.circulo(x, y, r - 3, tom(COR.ouro0, 0.55))
  desenharIdolo(g)
  desenharAltar(p)
  return c
}

// ---------- camada da frente (transparente, anda um pouco no parallax) ----------

function gerarFrente() {
  const [c, g] = tela(L, A)
  const p = pintor(g)
  const rnd = rngSemente(77)
  // colunas das bordas (seguram a viga)
  for (const lado of [-1, 1]) {
    const x0 = lado < 0 ? 4 : L - 24
    const w = 20
    const luz = 1
    p.ret(x0 + (lado < 0 ? w : -3), VIGA.base, 3, A - VIGA.base, COR.pedra0) // face lateral na sombra
    p.ret(x0, VIGA.base, w, A - VIGA.base, tom(COR.pedra3, luz))
    for (let x = x0 + 2; x < x0 + w - 1; x += 4) p.ret(x, VIGA.base + 8, 1, A - VIGA.base - 20, COR.pedra2)
    p.ret(lado < 0 ? x0 : x0 + w - 1, VIGA.base, 1, A - VIGA.base, COR.pedra4)
    p.ret(x0 - 3, VIGA.base, w + 6, 7, COR.pedra4)
    p.ret(x0 - 3, VIGA.base, w + 6, 1, COR.pedra5)
    p.ret(x0 - 3, VIGA.base + 6, w + 6, 1, COR.pedra1)
    p.ret(x0 - 3, A - 10, w + 6, 10, COR.pedra4)
    p.ret(x0 - 3, A - 10, w + 6, 1, COR.pedra5)
    for (let i = 0; i < 4; i++) rachadura(p, rnd, x0 + 2 + rnd() * (w - 4), VIGA.base + 8 + rnd() * 140, 8 + Math.floor(rnd() * 18), COR.junta)
    desenharTocha(p, lado < 0 ? 14 : L - 14, 95)
  }
  // cartelas de hieróglifos nas colunas
  for (const lado of [-1, 1]) {
    const x0 = lado < 0 ? 4 : L - 24
    p.ret(x0 + 4, 122, 12, 44, COR.pedra2)
    p.ret(x0 + 4, 122, 12, 1, COR.ouro0)
    p.ret(x0 + 4, 165, 12, 1, COR.ouro0)
    p.ret(x0 + 4, 122, 1, 44, COR.ouro0)
    p.ret(x0 + 15, 122, 1, 44, COR.ouro0)
  }
  // viga de pedra (com a quebra no meio, onde o sol passa)
  const pontaEsq = [[0, VIGA.topo], [VIGA.quebraEsq - 4, VIGA.topo], [VIGA.quebraEsq, VIGA.topo + 4], [VIGA.quebraEsq - 2, VIGA.topo + 8], [VIGA.quebraEsq + 1, VIGA.topo + 12], [VIGA.quebraEsq - 3, VIGA.base], [0, VIGA.base]]
  const pontaDir = pontaEsq.map(([x, y]) => [L - x, y])
  for (const forma of [pontaEsq, pontaDir]) {
    p.poli(forma, COR.pedra3)
  }
  for (const [x0, x1] of [[0, VIGA.quebraEsq - 3], [VIGA.quebraDir + 3, L]]) {
    p.ret(x0, VIGA.topo, x1 - x0, 3, COR.pedra4)
    p.ret(x0, VIGA.topo, x1 - x0, 1, COR.pedra5)
    p.ret(x0, VIGA.topo + 3, x1 - x0, 1, COR.pedra1)
    p.ret(x0, VIGA.base - 3, x1 - x0, 3, COR.pedra2)
    p.ret(x0, VIGA.base - 3, x1 - x0, 1, COR.ouro0)
    for (let x = x0 + 2; x < x1 - 2; x += 4) p.pix(x, VIGA.base - 2, COR.ouro1)
    p.ret(x0, VIGA.base, x1 - x0, 1, COR.junta)
  }
  // pontas quebradas: lascas mais claras e pedrinhas penduradas
  for (const x of [VIGA.quebraEsq - 2, VIGA.quebraEsq - 1, VIGA.quebraEsq]) {
    for (let y = VIGA.topo + 2; y < VIGA.base; y += 2) if (rnd() < 0.5) p.pix(x - 1, y, COR.pedra5)
  }
  for (const x of [VIGA.quebraDir, VIGA.quebraDir + 1, VIGA.quebraDir + 2]) {
    for (let y = VIGA.topo + 2; y < VIGA.base; y += 2) if (rnd() < 0.5) p.pix(x + 1, y, COR.pedra5)
  }
  // divisórias das cartelas na viga
  for (let x = 4; x < VIGA.quebraEsq - 6; x += 40) {
    p.ret(x, VIGA.topo + 4, 1, 11, COR.pedra1)
    p.ret(L - x - 1, VIGA.topo + 4, 1, 11, COR.pedra1)
  }
  // hieróglifos entalhados (a onda dourada acende por cima deles)
  for (const gl of TEMPLO.glifos) desenharGlifo(p, gl.forma, gl.x, gl.y, COR.pedra0, gl.coluna ? COR.pedra4 : COR.pedra5)
  // rachaduras na viga
  for (let k = 0; k < 7; k++) {
    const x = rnd() < 0.5 ? 6 + rnd() * 120 : L - 6 - rnd() * 120
    rachadura(p, rnd, x, VIGA.topo + 1, 4 + Math.floor(rnd() * 12), COR.junta)
  }
  // trepadeiras escorrendo da viga e subindo pelas colunas
  for (let k = 0; k < 12; k++) {
    const x = rnd() < 0.5 ? 2 + rnd() * 128 : L - 2 - rnd() * 128
    trepadeira(p, rnd, x, VIGA.topo + 1, 4 + Math.floor(rnd() * 14), { dir: 1, largura: 1 })
  }
  for (const x of [8, 20, L - 8, L - 20]) trepadeira(p, rnd, x, A - 10, 60 + Math.floor(rnd() * 70), { largura: 3 })
  for (const x of [10, 18, L - 10, L - 18]) trepadeira(p, rnd, x, VIGA.base + 6, 14 + Math.floor(rnd() * 22), { dir: 1, largura: 2 })
  return c
}

// ---------- peças animadas ----------

const CHAMAS = [
  ['...o...', '...o...', '..ooo..', '..oyo..', '.ooyoo.', '.oyyyo.', '.oywyo.', 'ooywyoo', 'oyywyyo', '.oyyyo.', '..rrr..'],
  ['..o....', '..o....', '.ooo...', '.oyoo..', '.oyyo..', 'ooyyoo.', '.oywyo.', '.oywyyo', 'oyywyyo', '.oyyyo.', '..rrr..'],
  ['....o..', '....o..', '...ooo.', '..ooyo.', '..oyyo.', '.ooyyoo', '.oywyo.', 'oyywyo.', 'oyywyyo', '.oyyyo.', '..rrr..'],
  ['.......', '...o...', '..ooo..', '..oyo..', '..oyo..', '.ooyoo.', '.oywyo.', '.oywyo.', 'oyywyyo', '.oyyyo.', '..rrr..'],
]
const PALETA_CHAMA = { r: '#a8341a', o: '#ff7a1a', y: '#ffc040', w: '#fff3b0' }

const MORCEGO = [
  ['#.......#', '##.....##', '.###.###.', '..#####..', '...#.#...'],
  ['.........', '...###...', '.#######.', '##.#.#.##', '#.......#'],
]

function mapa(linhas, paleta) {
  const [c, g] = tela(linhas[0].length, linhas.length)
  linhas.forEach((linha, y) => {
    ;[...linha].forEach((ch, x) => {
      if (!paleta[ch]) return
      g.fillStyle = paleta[ch]
      g.fillRect(x, y, 1, 1)
    })
  })
  return c
}

// brilho redondo e suave (luz de tocha, poça de sol): branco, pintado com setTint
function gerarBrilho() {
  const n = 64
  const [c, g] = tela(n, n)
  const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, n, n)
  return c
}

// feixe de sol: trapézio claro em cima e sumindo embaixo, com raios mais fortes dentro
function gerarFeixe() {
  const w = 150
  const h = 260
  const [c, g] = tela(w, h)
  for (let y = 0; y < h; y++) {
    const t = y / h
    const meio = w / 2 - 10 + 20 * t
    const larg = 70 + 60 * t
    const alpha = 0.75 * (1 - t) ** 1.3
    for (let x = 0; x < w; x++) {
      const u = (x - meio) / (larg / 2)
      if (Math.abs(u) >= 1) continue
      const borda = 1 - u * u
      const raios = 0.7 + 0.3 * Math.sin(u * 9 + t * 2) * Math.sin(u * 4.3 - 1)
      g.fillStyle = `rgba(255,255,255,${(alpha * borda * raios).toFixed(3)})`
      g.fillRect(x, y, 1, 1)
    }
  }
  return c
}

// glifo aceso: o desenho em ouro claro com um halo em volta
function gerarGlifoAceso(forma) {
  const linhas = GLIFOS[forma]
  const [c, g] = tela(7, 9)
  const p = pintor(g)
  linhas.forEach((linha, y) => {
    ;[...linha].forEach((ch, x) => {
      if (ch !== '#') return
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const vizinho = linhas[y + dy]?.[x + dx] === '#'
        if (!vizinho) p.pix(x + 1 + dx, y + 1 + dy, COR.ouro1, 0.55)
      }
    })
  })
  linhas.forEach((linha, y) => [...linha].forEach((ch, x) => ch === '#' && p.pix(x + 1, y + 1, COR.ouro3)))
  return c
}

function gerarVinheta() {
  const [c, g] = tela(L, A)
  const grad = g.createRadialGradient(L / 2, A * 0.42, A * 0.25, L / 2, A * 0.5, L * 0.72)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(0.6, 'rgba(0,0,0,0.25)')
  grad.addColorStop(1, 'rgba(0,0,0,0.7)')
  g.fillStyle = grad
  g.fillRect(0, 0, L, A)
  return c
}

export function gerarArteTemplo(scene) {
  if (scene.textures.exists('arena-templo-fundo')) return
  const add = (chave, canvas) => scene.textures.addCanvas(chave, canvas)
  add('arena-templo-fundo', gerarFundo())
  add('arena-templo-frente', gerarFrente())
  CHAMAS.forEach((linhas, k) => add(`arena-templo-chama-${k}`, mapa(linhas, PALETA_CHAMA)))
  MORCEGO.forEach((linhas, k) => add(`arena-templo-morcego-${k}`, mapa(linhas, { '#': '#120c10' })))
  GLIFOS.forEach((_, k) => add(`arena-templo-glifo-${k}`, gerarGlifoAceso(k)))
  add('arena-templo-brilho', gerarBrilho())
  add('arena-templo-feixe', gerarFeixe())
  add('arena-templo-vinheta', gerarVinheta())
}

export const N_CHAMAS = CHAMAS.length
export const CORES_TEMPLO = COR
