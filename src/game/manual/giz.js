import { aleatorio } from '../pvp/baralho.js'

// Traço de giz de cera gerado por código (O Manual Interativo do Ralsei, docs/manual-ralsei.md).
// Lógica PURA, sem Phaser: tudo que sai daqui são TRAÇOS, listas de pontos, e o mesmo `rng`
// (criarRng de pvp/baralho.js) sempre dá os mesmos traços (testado em __tests__/giz.test.js).
// O desenho em si fica em desenharTracos(), que só chama métodos de um Graphics.
//
//   traço  = [{ x, y }, ...]           uma passada de giz
//   tracos = [traço, ...]              um desenho (uma linha com 2 passadas, um coração, uma seta...)
//
//   linhaGiz(rng, x0, y0, x1, y1, op)             linha tremida, 2 passadas, passando um pouco do fim
//   retanguloGiz(rng, x, y, largura, altura, op)  borda de caixa (cantos que se cruzam)
//   poligonoGiz(rng, pontos, op)                  contorno de um polígono qualquer (um risco por lado)
//   circuloGiz(rng, cx, cy, r, op)                círculo que não fecha direito (volta e meia)
//   coracaoGiz(rng, cx, cy, largura, op)          contorno do coração
//   estrelaGiz(rng, cx, cy, r, op)                estrela de 5 pontas num traço só
//   xGiz(rng, cx, cy, r, op)                      um "X" marcado
//   setaGiz(rng, x0, y0, x1, y1, op)              seta torta (curva leve + ponta de 2 riscos)
//   preencherGiz(rng, poligono, op)               hachura inclinada dentro de um polígono
//   contornoDoCoracao(cx, cy, largura)            o polígono exato do coração (sem tremor)
//   cortarTracos(tracos, t)                       os primeiros `t` (0..1) do comprimento: o traço sendo desenhado
//   comprimentoTotal(tracos)                      soma dos comprimentos
//   caixaDosTracos(tracos)                        { minX, minY, maxX, maxY }
//   margemDeTremor(tremor)                        o quanto um traço com esse `tremor` pode sair da forma base
//   desenharTracos(g, tracos, estilo)             pinta num Graphics do Phaser
//
// O tremor é só VISUAL: a colisão do jogo nunca lê estes pontos (a bala acerta pelo x/y/raio dela e o
// coração pelo miolo CORACAO.hitbox; ver manual/pagina1.js). Por isso "reduzir animações" pode congelar
// o tremor (variante única) sem mudar nada da jogabilidade.

const TAU = Math.PI * 2
const entre = (rng, a, b) => a + (b - a) * aleatorio(rng)

// quanto um ponto pode ficar longe da forma base (ver perturbar: 0,6+0,4 de seno + 0,3 de sorteio)
export const margemDeTremor = (tremor) => tremor * 1.3 + 0.5

// Uma passada: percorre a forma base f(t), t em [t0, t1], com n+1 pontos, empurrando cada um para o lado
// (na normal) por um ruído suave (dois senos de fase sorteada) mais um tremidinho por ponto.
function perturbar(rng, f, t0, t1, n, tremor) {
  const fase1 = entre(rng, 0, TAU)
  const fase2 = entre(rng, 0, TAU)
  const freq1 = entre(rng, 1, 1.8)
  const freq2 = entre(rng, 2.6, 3.6)
  const pontos = []
  for (let i = 0; i <= n; i++) {
    const u = i / n
    const t = t0 + (t1 - t0) * u
    const p = f(t)
    const a = f(t - 0.0005)
    const b = f(t + 0.0005)
    let tx = b.x - a.x
    let ty = b.y - a.y
    const m = Math.hypot(tx, ty) || 1
    tx /= m
    ty /= m
    const ruido = 0.6 * Math.sin(TAU * freq1 * u + fase1) + 0.4 * Math.sin(TAU * freq2 * u + fase2)
    const d = tremor * ruido + tremor * 0.3 * (aleatorio(rng) * 2 - 1)
    pontos.push({ x: p.x - ty * d, y: p.y + tx * d })
  }
  return pontos
}

// comprimento aproximado de uma forma base (para decidir quantos pontos usar)
function comprimentoDe(f, t0, t1) {
  let c = 0
  let ant = f(t0)
  for (let i = 1; i <= 24; i++) {
    const p = f(t0 + ((t1 - t0) * i) / 24)
    c += Math.hypot(p.x - ant.x, p.y - ant.y)
    ant = p
  }
  return c
}

const pontosPara = (comprimento, passo) => Math.max(3, Math.ceil(comprimento / passo))

export function linhaGiz(rng, x0, y0, x1, y1, { tracos = 2, tremor = 1.1, passo = 6, excesso = 3 } = {}) {
  const dx = x1 - x0
  const dy = y1 - y0
  const comp = Math.hypot(dx, dy) || 1
  const ux = dx / comp
  const uy = dy / comp
  const saida = []
  for (let k = 0; k < tracos; k++) {
    const antes = entre(rng, -0.4, 1) * excesso // começa um pouco antes ou depois
    const depois = entre(rng, 0.2, 1) * excesso // e passa um pouco do fim
    const ax = x0 - ux * antes
    const ay = y0 - uy * antes
    const bx = x1 + ux * depois
    const by = y1 + uy * depois
    const f = (t) => ({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t })
    saida.push(perturbar(rng, f, 0, 1, pontosPara(comp + antes + depois, passo), tremor))
  }
  return saida
}

export const margemDeLinha = (tremor = 1.1, excesso = 3) => excesso + margemDeTremor(tremor) + 0.1

export function retanguloGiz(rng, x, y, largura, altura, op = {}) {
  const { excesso = 4 } = op
  return [
    ...linhaGiz(rng, x, y, x + largura, y, { ...op, excesso }),
    ...linhaGiz(rng, x + largura, y, x + largura, y + altura, { ...op, excesso }),
    ...linhaGiz(rng, x + largura, y + altura, x, y + altura, { ...op, excesso }),
    ...linhaGiz(rng, x, y + altura, x, y, { ...op, excesso }),
  ]
}

export function poligonoGiz(rng, pontos, op = {}) {
  const saida = []
  for (let i = 0; i < pontos.length; i++) {
    const a = pontos[i]
    const b = pontos[(i + 1) % pontos.length]
    saida.push(...linhaGiz(rng, a.x, a.y, b.x, b.y, { tracos: 1, excesso: 1.5, ...op }))
  }
  return saida
}

// Forma fechada por uma função f(u), u em [0,1): cada passada começa num ponto e termina um pouco depois
// de fechar (o "rabinho" do giz), com raio/tamanho ligeiramente diferente em cada volta
function fechada(rng, f, comprimento, { tracos = 2, tremor = 1, passo = 5, rabo = 0.08 } = {}) {
  const saida = []
  for (let k = 0; k < tracos; k++) {
    const inicio = entre(rng, 0, 1)
    const fim = inicio + 1 + entre(rng, 0.02, rabo)
    saida.push(perturbar(rng, (t) => f(t - Math.floor(t)), inicio, fim, pontosPara(comprimento, passo), tremor))
  }
  return saida
}

export function circuloGiz(rng, cx, cy, r, op = {}) {
  const f = (u) => ({ x: cx + Math.cos(u * TAU) * r, y: cy + Math.sin(u * TAU) * r })
  return fechada(rng, f, TAU * r, op)
}

// o coração clássico (paramétrico), centrado em (cx, cy): `largura` é o tamanho de ponta a ponta
export function contornoDoCoracao(cx, cy, largura, n = 40) {
  const k = largura / 32
  const pts = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU
    const x = 16 * Math.sin(t) ** 3
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    pts.push({ x: cx + x * k, y: cy - (y + 2.5) * k })
  }
  return pts
}

export function coracaoGiz(rng, cx, cy, largura, op = {}) {
  const k = largura / 32
  const f = (u) => {
    const t = u * TAU
    const x = 16 * Math.sin(t) ** 3
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    return { x: cx + x * k, y: cy - (y + 2.5) * k }
  }
  return fechada(rng, f, largura * 3.4, op)
}

export function estrelaGiz(rng, cx, cy, r, { tremor = 0.9, passo = 4 } = {}) {
  const giro = entre(rng, -0.25, 0.25)
  const v = []
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + giro + ((i * 2) % 5) * (TAU / 5) // 0,2,4,1,3,0: o pentagrama de um traço só
    v.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
  }
  const saida = []
  for (let i = 0; i < 5; i++) {
    const [a, b] = [v[i], v[i + 1]]
    const f = (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    saida.push(perturbar(rng, f, 0, 1, pontosPara(Math.hypot(b.x - a.x, b.y - a.y), passo), tremor))
  }
  return [saida.flat()]
}

export function xGiz(rng, cx, cy, r, op = {}) {
  const c = r * 0.72
  return [
    ...linhaGiz(rng, cx - c, cy - c, cx + c, cy + c, { tracos: 1, excesso: 2, ...op }),
    ...linhaGiz(rng, cx + c, cy - c, cx - c, cy + c, { tracos: 1, excesso: 2, ...op }),
  ]
}

// Seta torta: uma curva leve (a barriga vai para um lado sorteado) e a ponta com 2 riscos
export function setaGiz(rng, x0, y0, x1, y1, { tremor = 1, barriga = 0.14, ponta = 11 } = {}) {
  const dx = x1 - x0
  const dy = y1 - y0
  const comp = Math.hypot(dx, dy) || 1
  const lado = aleatorio(rng) < 0.5 ? -1 : 1
  const cx = (x0 + x1) / 2 - (dy / comp) * comp * barriga * lado
  const cy = (y0 + y1) / 2 + (dx / comp) * comp * barriga * lado
  const curva = (t) => ({
    x: (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1,
    y: (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1,
  })
  const corpo = perturbar(rng, curva, 0, 1, pontosPara(comp * 1.05, 6), tremor)
  const fim = curva(1)
  const antes = curva(0.94)
  const ang = Math.atan2(fim.y - antes.y, fim.x - antes.x)
  const asa = (da) => {
    const a = ang + Math.PI + da
    return linhaGiz(rng, fim.x, fim.y, fim.x + Math.cos(a) * ponta, fim.y + Math.sin(a) * ponta, { tracos: 1, excesso: 1, tremor: tremor * 0.8 })[0]
  }
  return [corpo, asa(0.5), asa(-0.5)]
}

// Hachura inclinada dentro de um polígono (pontos {x,y}): o "preencher com giz". Cada risco vira um
// traço; nunca sai da caixa do polígono além do tremor.
export function preencherGiz(rng, poligono, { espaco = 4, angulo = -0.6, tremor = 0.6, folga = 1.5 } = {}) {
  const c = Math.cos(-angulo)
  const s = Math.sin(-angulo)
  const gira = (p, sc) => ({ x: p.x * c - p.y * sc, y: p.x * sc + p.y * c })
  const rot = poligono.map((p) => gira(p, s))
  let minY = Infinity
  let maxY = -Infinity
  for (const p of rot) {
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  const volta = (p) => ({ x: p.x * c + p.y * s, y: -p.x * s + p.y * c })
  const saida = []
  let i = 0
  for (let y = minY + espaco / 2; y < maxY; y += espaco + entre(rng, -0.6, 0.6)) {
    const xs = []
    for (let k = 0; k < rot.length; k++) {
      const a = rot[k]
      const b = rot[(k + 1) % rot.length]
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x))
    }
    xs.sort((m, n) => m - n)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      let xa = xs[k] + folga
      let xb = xs[k + 1] - folga
      if (xb - xa < 1.5) continue
      if (i++ % 2) [xa, xb] = [xb, xa]
      const reta = perturbar(rng, (t) => ({ x: xa + (xb - xa) * t, y }), 0, 1, pontosPara(Math.abs(xb - xa), 7), tremor)
      saida.push(reta.map(volta))
    }
  }
  return saida
}

// ---------- utilidades de traço ----------

const compDoTraco = (t) => {
  let c = 0
  for (let i = 1; i < t.length; i++) c += Math.hypot(t[i].x - t[i - 1].x, t[i].y - t[i - 1].y)
  return c
}

export const comprimentoTotal = (tracos) => tracos.reduce((s, t) => s + compDoTraco(t), 0)

// Os primeiros `t` (0..1) do comprimento total, traço após traço (o giz indo pelo papel).
// O último traço é cortado no meio de um segmento (ponto interpolado).
export function cortarTracos(tracos, t) {
  if (t >= 1) return tracos
  if (t <= 0) return []
  let falta = comprimentoTotal(tracos) * t
  const saida = []
  for (const traco of tracos) {
    const c = compDoTraco(traco)
    if (c <= falta) {
      saida.push(traco)
      falta -= c
      continue
    }
    const parte = [traco[0]]
    for (let i = 1; i < traco.length && falta > 0; i++) {
      const seg = Math.hypot(traco[i].x - traco[i - 1].x, traco[i].y - traco[i - 1].y)
      if (seg <= falta) {
        parte.push(traco[i])
        falta -= seg
      } else {
        const f = falta / seg
        parte.push({ x: traco[i - 1].x + (traco[i].x - traco[i - 1].x) * f, y: traco[i - 1].y + (traco[i].y - traco[i - 1].y) * f })
        falta = 0
      }
    }
    saida.push(parte)
    break
  }
  return saida
}

export function caixaDosTracos(tracos) {
  const c = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const t of tracos)
    for (const p of t) {
      c.minX = Math.min(c.minX, p.x)
      c.minY = Math.min(c.minY, p.y)
      c.maxX = Math.max(c.maxX, p.x)
      c.maxY = Math.max(c.maxY, p.y)
    }
  return c
}

// ---------- pintura ----------

// Alpha de cada segmento: o giz não cobre por igual. Determinístico (índice -> 0..1), sem sorteio.
export const falhaDoGiz = (i, j = 0) => (Math.imul(i + 1 + j * 977, 2654435761) >>> 20) / 4096

// Pinta os traços num Graphics (Phaser). `estilo`: cor, largura, alpha, progresso (0..1 = o traço sendo
// desenhado), grao (0..1: quanto o giz "falha"; 0 = traço liso). A passada larga e fraca por baixo dá o
// corpo do giz; a fina por cima dá a pressão. Nada aqui altera os pontos.
export function desenharTracos(g, tracos, { cor = 0x333333, largura = 3, alpha = 0.92, progresso = 1, grao = 0.35 } = {}) {
  const visivel = cortarTracos(tracos, progresso)
  let n = 0
  for (const t of visivel) {
    if (t.length < 2) continue
    // corpo largo e translúcido, numa passada só
    g.lineStyle(largura * 1.9, cor, alpha * 0.28)
    g.beginPath()
    g.moveTo(t[0].x, t[0].y)
    for (let i = 1; i < t.length; i++) g.lineTo(t[i].x, t[i].y)
    g.strokePath()
    // a pressão do giz: segmentos com alpha e espessura diferentes
    for (let i = 1; i < t.length; i++, n++) {
      const f = falhaDoGiz(n)
      g.lineStyle(largura * (0.75 + f * 0.5), cor, alpha * (1 - grao + grao * f))
      g.beginPath()
      g.moveTo(t[i - 1].x, t[i - 1].y)
      g.lineTo(t[i].x, t[i].y)
      g.strokePath()
    }
  }
}
