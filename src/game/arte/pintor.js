// Pintor de pixel art "de pincel" (lógica pura, sem canvas): em vez de escrever o mapa letra por letra, o desenho
// é feito com formas (retângulo, elipse, polígono, linha) numa grade de cores, e cada forma pode ser SOMBREADA com
// uma rampa de 4 tons (do mais escuro ao brilho). No fim, `contorno` passa a linha escura em volta da silhueta.
// Usado pelos chefões do CO-OP (arte/chefoes.js), que são desenhados em densidade dobrada.
//
//   const p = pintor(48, 64)
//   p.forma(p.elipse(24, 20, 9, 7), RAMPA)         sombreia em bisel (luz de cima à esquerda)
//   p.forma(p.elipse(24, 20, 9, 7), RAMPA, 'bola') sombreia como esfera
//   p.preencher(mascara, '#ff0000')                cor chapada
//   p.contorno('#120a1e')                          linha de fora (só onde a vizinha é transparente)
//   p.grade                                        linhas de cores ('#rrggbb' ou null)
// pintor(l, a, { dx, dy }) desloca todas as coordenadas (para dar folga ao contorno sem refazer o desenho)

export function pintor(largura, altura, { dx: ox = 0, dy: oy = 0 } = {}) {
  const grade = Array.from({ length: altura }, () => Array(largura).fill(null))
  const dentro = (x, y) => x >= 0 && y >= 0 && x < largura && y < altura
  const nova = () => new Uint8Array(largura * altura)
  const tem = (m, x, y) => dentro(x, y) && m[y * largura + x] === 1

  // ---------- máscaras (Uint8Array largura x altura) ----------
  const porPixel = (teste) => {
    const m = nova()
    for (let y = 0; y < altura; y++) for (let x = 0; x < largura; x++) if (teste(x + 0.5 - ox, y + 0.5 - oy)) m[y * largura + x] = 1
    return m
  }
  const ret = (x, y, w, h) => porPixel((px, py) => px > x && px < x + w && py > y && py < y + h)
  const elipse = (cx, cy, rx, ry) => porPixel((px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1)
  // polígono por pares [x, y] (vértices nas quinas dos pixels)
  const poli = (...pts) =>
    porPixel((px, py) => {
      let d = false
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]
        const [xj, yj] = pts[j]
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) d = !d
      }
      return d
    })
  // tubo: círculos ao longo de uma linha quebrada, com o raio indo de r0 a r1 (chifres, braços, pernas)
  const tubo = (pts, r0, r1 = r0) => {
    const seg = pts.slice(1).map((b, i) => Math.hypot(b[0] - pts[i][0], b[1] - pts[i][1]))
    const total = seg.reduce((a, b) => a + b, 0) || 1
    return porPixel((px, py) => {
      let andado = 0
      for (let i = 0; i < seg.length; i++) {
        const [ax, ay] = pts[i]
        const [bx, by] = pts[i + 1]
        const l2 = seg[i] ** 2 || 1
        const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2))
        const r = r0 + (r1 - r0) * ((andado + t * seg[i]) / total)
        if (Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay))) <= r) return true
        andado += seg[i]
      }
      return false
    })
  }
  const uniao = (...ms) => {
    const m = nova()
    for (const o of ms) for (let i = 0; i < m.length; i++) m[i] |= o[i]
    return m
  }
  const menos = (a, ...bs) => {
    const m = Uint8Array.from(a)
    for (const b of bs) for (let i = 0; i < m.length; i++) if (b[i]) m[i] = 0
    return m
  }
  const e = (a, b) => a.map((v, i) => v & b[i])

  // ---------- pintura ----------
  const px = (x, y, cor) => {
    x = Math.round(x) + ox
    y = Math.round(y) + oy
    if (cor && dentro(x, y)) grade[y][x] = cor
  }
  const preencher = (m, cor) => {
    for (let i = 0; i < m.length; i++) if (m[i]) grade[Math.floor(i / largura)][i % largura] = cor
  }
  // distância (1..3) até sair da máscara andando (dx, dy)
  const ate = (m, x, y, dx, dy) => {
    for (let k = 1; k <= 3; k++) if (!tem(m, x + dx * k, y + dy * k)) return k
    return 4
  }
  // rampa [sombra funda, sombra, base, luz]; modo 'bisel' (formas retas e panos) ou 'bola' (volumes redondos).
  // A rampa pode ser uma função (x, y) => rampa: o sombreado é o da forma inteira e só a cor muda (xadrez de arlequim)
  const forma = (m, rampa, modo = 'bisel', opcoes = {}) => {
    const { luz = true, funda = true } = opcoes
    let x0 = largura
    let y0 = altura
    let x1 = 0
    let y1 = 0
    for (let i = 0; i < m.length; i++) {
      if (!m[i]) continue
      const x = i % largura
      const y = Math.floor(i / largura)
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
    }
    const cx = (x0 + x1 + 1) / 2
    const cy = (y0 + y1 + 1) / 2
    const rx = (x1 - x0 + 1) / 2
    const ry = (y1 - y0 + 1) / 2
    for (let i = 0; i < m.length; i++) {
      if (!m[i]) continue
      const x = i % largura
      const y = Math.floor(i / largura)
      let k
      if (modo === 'bola') {
        const nx = (x + 0.5 - cx) / rx
        const ny = (y + 0.5 - cy) / ry
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
        const l = -0.5 * nx - 0.6 * ny + 0.62 * nz
        k = l > 0.62 ? 3 : l > 0.2 ? 2 : l > -0.15 ? 1 : 0
      } else {
        const dR = ate(m, x, y, 1, 0)
        const dB = ate(m, x, y, 0, 1)
        const dL = ate(m, x, y, -1, 0)
        const dT = ate(m, x, y, 0, -1)
        if (funda && (dR === 1 || dB === 1)) k = 0
        else if (dR <= 2 || dB <= 2) k = 1
        else if (luz && (dL === 1 || dT === 1)) k = 3
        else k = 2
      }
      grade[y][x] = (typeof rampa === 'function' ? rampa(x - ox, y - oy) : rampa)[k]
    }
  }
  // linha de Bresenham
  const linha = (x0, y0, x1, y1, cor) => {
    x0 = Math.round(x0)
    y0 = Math.round(y0)
    x1 = Math.round(x1)
    y1 = Math.round(y1)
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      px(x0, y0, cor)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) {
        err += dy
        x0 += sx
      }
      if (e2 <= dx) {
        err += dx
        y0 += sy
      }
    }
  }
  // desenho miúdo por mapa de letras ('.' = nada) a partir de (x0, y0)
  const carimbo = (x0, y0, linhas, paleta) => linhas.forEach((l, y) => [...l].forEach((ch, x) => px(x0 + x, y0 + y, paleta[ch])))
  // máscara do que já está pintado (para contornos e brilhos depois)
  const pintado = () => porPixel((x, y) => grade[Math.floor(y + oy)][Math.floor(x + ox)] !== null)
  // linha de fora: todo pixel vazio encostado (4 vizinhos) na silhueta vira `cor`
  const contorno = (cor, diagonais = false) => {
    const viz = diagonais ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]]
    const marcar = []
    for (let y = 0; y < altura; y++)
      for (let x = 0; x < largura; x++) {
        if (grade[y][x] !== null) continue
        if (viz.some(([dx, dy]) => dentro(x + dx, y + dy) && grade[y + dy][x + dx] !== null && grade[y + dy][x + dx] !== cor)) marcar.push([x, y])
      }
    for (const [x, y] of marcar) grade[y][x] = cor
  }
  // linha interna entre duas regiões: pinta `cor` onde a máscara `a` encosta (por baixo/direita) em `b`
  const vinco = (a, b, cor) => {
    for (let y = 0; y < altura; y++)
      for (let x = 0; x < largura; x++) if (tem(a, x, y) && (tem(b, x + 1, y) || tem(b, x, y + 1) || tem(b, x - 1, y) || tem(b, x, y - 1))) grade[y][x] = cor
  }

  return { largura, altura, grade, ret, elipse, poli, tubo, uniao, menos, e, px, preencher, forma, linha, carimbo, pintado, contorno, vinco }
}

// grade -> canvas (só no navegador)
export function gradeEmCanvas(grade) {
  const c = document.createElement('canvas')
  c.width = grade[0].length
  c.height = grade.length
  const g = c.getContext('2d')
  g.imageSmoothingEnabled = false
  grade.forEach((linha, y) =>
    linha.forEach((cor, x) => {
      if (!cor) return
      g.fillStyle = cor
      g.fillRect(x, y, 1, 1)
    }),
  )
  return c
}
