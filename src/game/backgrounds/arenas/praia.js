import Phaser from 'phaser'
import { LARGURA, ALTURA, CENTRO_X } from '../../constants.js'
import { texturasPraiaCafe } from '../../arte/praiaCafe.js'
import { ignorarNasCaixas } from '../../recorte.js'

// PRAIA: uma enseada ao pôr do sol. De trás para a frente:
//   céu em faixas do azul ao dourado, o SOL baixo no meio (halo e raios girando devagar) com o
//   caminho de brilhos na água, nuvens passando, uma ilha longe, veleiros no horizonte;
//   o MAR com três ondas grandes rolando do horizonte até a praia (seguem a curva da areia) e
//   fileiras de ondinhas com espuma, que vêm e vão;
//   a AREIA em forma de enseada (sobe nas laterais): faixa de areia molhada com a espuma
//   chegando e voltando, conchas e estrelas-do-mar;
//   COQUEIROS nas duas laterais (as folhas balançam com a brisa), guarda-sóis listrados,
//   toalhas e baldinhos, um CARANGUEJO andando de lado pela areia da frente e GAIVOTAS
//   voando no céu.
// O que tem brilho e movimento fica no alto, no vão do meio e nas laterais; atrás das caixas e
// das cartas o mar e a areia são calmos (a arena ainda põe o véu da moldura por cima).

const HORIZONTE = 98
const CEU = [0x23408f, 0x2d52a6, 0x3d68b8, 0x5a82c8, 0x82a0d4, 0xb0b4d8, 0xe0b4c4, 0xf8b8a0, 0xffc890, 0xffd88c, 0xffe4a0]
const MAR = [0x59dce0, 0x48cfdc, 0x38bfd6, 0x2aaad0, 0x1f94c4, 0x187fb4, 0x1368a4] // do horizonte para a praia
const SOL = { x: CENTRO_X, y: 90, r: 24 }
const ONDAS_GRANDES = 3
const PERIODO_ONDA = 11000 // ms que uma onda leva do horizonte à areia
const FILEIRAS = 9

// a linha da praia (y) em cada x: uma enseada, mais alta nas laterais
const praiaY = (x) => 348 - 176 * (Math.abs(x - CENTRO_X) / CENTRO_X) ** 2
const sorteador = (semente) => {
  let s = semente >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
const misturar = (a, b, p) => {
  const c = (d) => Math.round(((a >> d) & 255) + (((b >> d) & 255) - ((a >> d) & 255)) * p) << d
  return c(16) | c(8) | c(0)
}

// uma folha de coqueiro: curva do ponto (bx, by) na direção `ang`, caindo com o peso (queda)
function fronda(g, bx, by, ang, comp, queda, cor, corClara) {
  const n = 9
  const pts = []
  for (let i = 0; i <= n; i++) {
    const p = i / n
    pts.push({ x: bx + Math.cos(ang) * comp * p, y: by + Math.sin(ang) * comp * p + queda * comp * p * p, p })
  }
  const lado1 = []
  const lado2 = []
  pts.forEach((pt, i) => {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(n, i + 1)]
    const tx = b.x - a.x
    const ty = b.y - a.y
    const len = Math.hypot(tx, ty) || 1
    const w = 7.5 * Math.sin(Math.PI * Math.min(1, pt.p * 1.05)) ** 0.7 + 0.6
    lado1.push({ x: pt.x - (ty / len) * w, y: pt.y + (tx / len) * w })
    lado2.push({ x: pt.x + (ty / len) * w, y: pt.y - (tx / len) * w })
  })
  g.fillStyle(cor, 1)
  g.fillPoints([...lado1, ...lado2.reverse()], true)
  g.lineStyle(1.5, corClara, 0.9)
  g.strokePoints(pts)
  // recortes nas folhas (dentes)
  g.lineStyle(1, misturar(cor, 0x000000, 0.35), 0.8)
  for (let i = 2; i < n; i += 1) {
    const a = lado1[i]
    const b = pts[i]
    g.lineBetween(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2)
  }
}

export default function praia(scene, objetos) {
  texturasPraiaCafe(scene)
  const sorte = sorteador(11)
  const add = (o) => {
    objetos.push(o)
    return o.setDepth(-10)
  }

  // ---------- céu ----------
  const ceu = add(scene.add.graphics())
  const faixa = HORIZONTE / CEU.length
  CEU.forEach((cor, i) => ceu.fillStyle(cor, 1).fillRect(0, Math.floor(i * faixa), LARGURA, Math.ceil(faixa) + 1))

  // ---------- sol ----------
  const halo = add(scene.add.image(SOL.x, SOL.y, 'arte-brilho').setTint(0xffd070).setBlendMode(Phaser.BlendModes.ADD).setScale(5.2).setAlpha(0.55))
  const halo2 = add(scene.add.image(SOL.x, SOL.y, 'arte-brilho').setTint(0xff8a50).setBlendMode(Phaser.BlendModes.ADD).setScale(9).setAlpha(0.25))
  const raios = add(scene.add.graphics({ x: SOL.x, y: SOL.y }))
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2
    const comp = SOL.r * (k % 2 ? 1.7 : 2.3)
    raios.fillStyle(0xfff0b0, k % 2 ? 0.35 : 0.5)
    raios.fillTriangle(Math.cos(a - 0.1) * SOL.r, Math.sin(a - 0.1) * SOL.r, Math.cos(a + 0.1) * SOL.r, Math.sin(a + 0.1) * SOL.r, Math.cos(a) * comp, Math.sin(a) * comp)
  }
  const disco = add(scene.add.graphics({ x: SOL.x, y: SOL.y }))
  disco.fillStyle(0xffb04a, 1).fillCircle(0, 0, SOL.r)
  disco.fillStyle(0xffd86a, 1).fillCircle(0, 0, SOL.r - 2.5)
  disco.fillStyle(0xfff4b8, 1).fillCircle(-3, -3, SOL.r - 9)

  // ---------- nuvens ----------
  const nuvens = Array.from({ length: 6 }, (_, i) => {
    const g = add(scene.add.graphics())
    const larg = 46 + sorte() * 50
    for (const [cor, dy, alpha] of [[0xc07a9a, 3, 0.55], [0xffb8a0, 0, 0.7], [0xfff0d0, -3, 0.55]]) {
      g.fillStyle(cor, alpha)
      for (let k = 0; k < 5; k++) {
        const fx = k / 4 - 0.5
        g.fillEllipse(fx * larg, dy - Math.cos(fx * Math.PI) * 5, larg * 0.42, 12 - Math.abs(fx) * 6)
      }
    }
    return { g, x: ((i * 160 + sorte() * 80) % (LARGURA + 140)) - 70, y: 22 + sorte() * 62, v: 2 + sorte() * 3, larg }
  })

  // ---------- mar (base) ----------
  const mar = add(scene.add.graphics())
  const nMar = MAR.length
  const alturaMar = 320 - HORIZONTE
  MAR.forEach((cor, i) => {
    const y0 = HORIZONTE + Math.floor((i / nMar) ** 1.4 * alturaMar)
    const y1 = HORIZONTE + Math.floor(((i + 1) / nMar) ** 1.4 * alturaMar)
    mar.fillStyle(cor, 1).fillRect(0, y0, LARGURA, y1 - y0 + 1)
  })
  mar.fillStyle(MAR[nMar - 1], 1).fillRect(0, 320, LARGURA, ALTURA - 320)
  mar.fillStyle(0xfff4d0, 0.9).fillRect(0, HORIZONTE, LARGURA, 1) // a linha do horizonte, luminosa

  // ilha ao longe (lado direito, fora da caixa)
  const ilha = add(scene.add.graphics())
  ilha.fillStyle(0x4f6aa8, 1).fillTriangle(764, HORIZONTE, 790, HORIZONTE - 13, 818, HORIZONTE)
  ilha.fillStyle(0x4f6aa8, 1).fillTriangle(800, HORIZONTE, 826, HORIZONTE - 9, 852, HORIZONTE)
  ilha.fillStyle(0x6a82bc, 1).fillTriangle(776, HORIZONTE, 790, HORIZONTE - 13, 794, HORIZONTE)
  ilha.fillStyle(0x38604e, 1).fillRect(788, HORIZONTE - 16, 1, 4)

  // brilhos do sol na água (um caminho de pontinhos que piscam)
  const brilhos = Array.from({ length: 46 }, () => {
    const p = sorte()
    const y = HORIZONTE + 3 + p ** 1.5 * 190
    const largura = 4 + p * 26
    const r = add(scene.add.rectangle(SOL.x + (sorte() - 0.5) * (30 + p * 120), y, largura, 1.6 + p, 0xfff0b8))
    return { r, fase: sorte() * 10, v: 1.5 + sorte() * 3, x0: r.x, y0: y }
  })

  // ---------- veleiros (um grande e um pequeno ao longe) ----------
  const veleiro = (escala, vela) => {
    const g = add(scene.add.graphics())
    // casco
    g.fillStyle(0x6a3a22, 1).fillTriangle(-16, -2, 16, -2, 10, 5)
    g.fillRect(-16, -4, 32, 3)
    g.fillStyle(0xd8d0c0, 1).fillRect(-16, -4, 32, 1)
    // mastro e velas
    g.fillStyle(0x5a3a22, 1).fillRect(-1, -34, 2, 31)
    g.fillStyle(vela, 1).fillTriangle(1, -33, 1, -6, 17, -6)
    g.fillStyle(misturar(vela, 0xffffff, 0.45), 1).fillTriangle(-1, -30, -1, -6, -12, -6)
    g.fillStyle(0xff5a4a, 1).fillTriangle(0, -35, 0, -31, 6, -33)
    g.setScale(escala)
    return g
  }
  const barcos = [
    { g: veleiro(1, 0xfff4e4), x: 220, y: HORIZONTE + 5, v: 3.2 },
    { g: veleiro(0.55, 0xffd0c0), x: 640, y: HORIZONTE + 2, v: -1.8 },
  ]

  // ---------- ondas (redesenhadas todo quadro) ----------
  const ondas = add(scene.add.graphics())
  const espuma = add(scene.add.graphics())

  // ---------- praia ----------
  const areia = add(scene.add.graphics())
  const topo = []
  for (let x = 0; x <= LARGURA; x += 6) topo.push({ x, y: praiaY(x) })
  areia.fillStyle(0xe6c98a, 1)
  areia.fillPoints([...topo, { x: LARGURA, y: ALTURA }, { x: 0, y: ALTURA }], true)
  // areia molhada (faixa escura junto da água) e areia seca clara mais abaixo
  areia.fillStyle(0xc9a86a, 1)
  areia.fillPoints([...topo, ...topo.map((p) => ({ x: p.x, y: p.y + 16 })).reverse()], true)
  areia.fillStyle(0xf2d9a0, 1)
  areia.fillPoints([...topo.map((p) => ({ x: p.x, y: p.y + 44 })), { x: LARGURA, y: ALTURA }, { x: 0, y: ALTURA }], true)
  // grãos, conchas e estrelas-do-mar
  for (let i = 0; i < 260; i++) {
    const x = sorte() * LARGURA
    const y = praiaY(x) + 20 + sorte() * (ALTURA - praiaY(x) - 20)
    areia.fillStyle(sorte() < 0.5 ? 0xc8aa72 : 0xfff0c8, 0.8).fillRect(x, y, 2, 1.2)
  }
  const concha = (x, y, cor) => {
    areia.fillStyle(cor, 1).fillEllipse(x, y, 7, 5)
    areia.lineStyle(1, 0x9a6a4a, 0.8)
    for (let k = -1; k <= 1; k++) areia.lineBetween(x, y + 2, x + k * 2.5, y - 2)
  }
  concha(70, 352, 0xffc8b0)
  concha(790, 340, 0xfff0e0)
  concha(360, 358, 0xffd8c0)
  concha(500, 362, 0xffe8d0)
  const estrela = (x, y, cor) => {
    areia.fillStyle(cor, 1)
    const pts = []
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2
      const r = k % 2 ? 2.8 : 7
      pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r })
    }
    areia.fillPoints(pts, true)
  }
  estrela(30, 300, 0xff8a5a)
  estrela(830, 280, 0xffb05a)
  estrela(430, 370, 0xff7a6a)

  // ---------- guarda-sóis, toalhas, baldinho ----------
  const cena = add(scene.add.graphics())
  const toalha = (x, y, w, h, c1, c2) => {
    cena.fillStyle(0x000000, 0.18).fillRect(x + 2, y + 2, w, h)
    for (let k = 0; k < w; k += 6) cena.fillStyle(k % 12 ? c1 : c2, 1).fillRect(x + k, y, 6, h)
  }
  const guardaSol = (x, y, r, c1, c2, inclina) => {
    // sombra no chão, haste e a copa de gomos
    cena.fillStyle(0x000000, 0.2).fillEllipse(x + 8, y + 22, r * 1.8, 8)
    cena.lineStyle(3, 0xf0f0f0, 1).lineBetween(x - inclina * 8, y + 22, x + inclina * 3, y - r * 0.55)
    const gomos = 6
    for (let k = 0; k < gomos; k++) {
      const a0 = Math.PI + (k / gomos) * Math.PI
      const a1 = Math.PI + ((k + 1) / gomos) * Math.PI
      cena.fillStyle(k % 2 ? c1 : c2, 1)
      cena.beginPath()
      cena.moveTo(x + inclina * 3, y - r * 0.55 - 5)
      cena.arc(x + inclina * 3, y - r * 0.55 + 2, r, a0, a1)
      cena.closePath()
      cena.fillPath()
    }
    cena.fillStyle(0xfff4e0, 1).fillCircle(x + inclina * 3, y - r * 0.55 - 5, 2)
    cena.lineStyle(1, 0x000000, 0.2).strokeCircle(x + inclina * 3, y - r * 0.55 + 2, r)
  }
  toalha(14, 376, 38, 14, 0xff6a8a, 0xfff0f0)
  toalha(796, 360, 40, 14, 0x4ab8ff, 0xfff0f0)
  guardaSol(40, 318, 30, 0xff4a4a, 0xfff0e8, -0.6)
  guardaSol(104, 300, 22, 0xffd23a, 0x3a9aff, 0.5)
  guardaSol(812, 308, 30, 0x3a9aff, 0xfff0e8, 0.6)
  guardaSol(748, 330, 22, 0xff7ac0, 0xfff0e8, -0.5)
  // baldinho com pazinha e castelo de areia
  cena.fillStyle(0xff5a4a, 1).fillTriangle(842, 338, 854, 338, 850, 351)
  cena.fillStyle(0xff5a4a, 1).fillTriangle(844, 338, 840, 351, 852, 351)
  cena.fillStyle(0xe8c070, 1).fillRect(62, 346, 16, 8)
  cena.fillStyle(0xe8c070, 1).fillRect(66, 340, 8, 7)
  cena.fillStyle(0xff4a4a, 1).fillRect(69, 330, 1.5, 10)
  cena.fillStyle(0xffe040, 1).fillTriangle(70, 330, 78, 333, 70, 336)
  // prancha de surfe espetada na areia (no vão do meio)
  cena.fillStyle(0xfff4e8, 1).fillEllipse(528, 330, 11, 44)
  cena.fillStyle(0x38c8e0, 1).fillRect(526, 316, 4, 28)
  cena.fillStyle(0xff7a5a, 1).fillRect(523, 331, 10, 3)

  // ---------- coqueiros (laterais) ----------
  const palmeiras = [
    { x0: 28, y0: 262, cx: 74, cy: 176, tx: 62, ty: 104, escala: 1, lado: 1 },
    { x0: 826, y0: 270, cx: 786, cy: 178, tx: 794, ty: 110, escala: 0.95, lado: -1 },
  ].map((p) => {
    const tronco = add(scene.add.graphics())
    // tronco curvo (quadrática), mais grosso embaixo, com anéis
    const pts = []
    for (let i = 0; i <= 14; i++) {
      const u = i / 14
      const x = (1 - u) ** 2 * p.x0 + 2 * (1 - u) * u * p.cx + u * u * p.tx
      const y = (1 - u) ** 2 * p.y0 + 2 * (1 - u) * u * p.cy + u * u * p.ty
      pts.push({ x, y, w: 5.5 - u * 2 })
    }
    pts.forEach((pt, i) => {
      if (!i) return
      const a = pts[i - 1]
      tronco.lineStyle((a.w + pt.w) * 1.05, i % 2 ? 0x8a5a38 : 0x7a4c30, 1).lineBetween(a.x, a.y, pt.x, pt.y)
    })
    tronco.lineStyle(1, 0x4a2c18, 0.7)
    pts.forEach((pt, i) => i % 2 && tronco.lineBetween(pt.x - pt.w, pt.y, pt.x + pt.w, pt.y + 1))
    // sombra e cocos
    tronco.fillStyle(0x000000, 0.2).fillEllipse(p.x0 + 6 * p.lado, p.y0 + 4, 60, 10)
    tronco.fillStyle(0x5a3a1a, 1)
    for (const [dx, dy] of [[-4, 4], [3, 6], [6, 2]]) tronco.fillCircle(p.tx + dx, p.ty + dy, 3.4)
    const folhas = add(scene.add.graphics())
    return { ...p, folhas }
  })
  const FOLHAS = [
    { ang: -2.7, comp: 62, queda: 1.0 },
    { ang: -2.1, comp: 66, queda: 0.7 },
    { ang: -1.5, comp: 58, queda: 0.25 },
    { ang: -0.95, comp: 66, queda: 0.7 },
    { ang: -0.4, comp: 62, queda: 1.0 },
    { ang: 0.2, comp: 52, queda: 1.3 },
    { ang: 2.95, comp: 52, queda: 1.3 },
  ]

  // ---------- caranguejo (andando de lado pela areia da frente) ----------
  const caranguejo = add(scene.add.sprite(-30, 362, 'praia-caranguejo', 'c0').setScale(2.2))
  caranguejo.setDepth(-10)
  const estadoCaranguejo = { x: -30, dir: 1, pausa: 0, velocidade: 24, pinca: 0 }

  // ---------- gaivotas ----------
  const gaivotas = Array.from({ length: 5 }, (_, i) => ({
    g: add(scene.add.graphics()),
    x: sorte() * LARGURA,
    y: 30 + sorte() * 70,
    v: (i % 2 ? -1 : 1) * (14 + sorte() * 12),
    fase: sorte() * 10,
    escala: 0.8 + sorte() * 0.6,
  }))
  const desenharGaivota = (gv, t) => {
    const g = gv.g
    g.clear()
    const bate = Math.sin(t * 5 + gv.fase)
    const e = gv.escala
    const dir = Math.sign(gv.v)
    const x = gv.x
    const y = gv.y + Math.sin(t * 0.9 + gv.fase) * 5
    // asas em "M" batendo; corpo branco e bico amarelo
    g.lineStyle(2.2 * e, 0xfdfdff, 1)
    for (const lado of [-1, 1]) {
      const pontaY = y - 6 * e - bate * 5 * e
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + lado * 7 * e, y - 5 * e - bate * 3 * e)
      g.lineTo(x + lado * 15 * e, pontaY + 3 * e)
      g.strokePath()
    }
    g.fillStyle(0xffffff, 1).fillEllipse(x, y + 1, 7 * e, 3.6 * e)
    g.fillStyle(0xf0a830, 1).fillTriangle(x + dir * 3.4 * e, y, x + dir * 6.4 * e, y + 0.6 * e, x + dir * 3.4 * e, y + 1.6 * e)
  }

  let ignorado = false
  return {
    atualizar(dt, estado) {
      if (!ignorado && scene.caixasDeRecorte?.length) {
        ignorado = true
        ignorarNasCaixas(scene, objetos)
      }
      const ms = estado.tempo
      const t = ms / 1000
      const seg = dt / 1000

      // sol
      const p = Math.sin(t * 0.8)
      halo.setScale(5.2 + p * 0.25).setAlpha(0.5 + p * 0.06)
      halo2.setScale(9 + p * 0.3)
      raios.setRotation(t * 0.07).setScale(1 + p * 0.05)
      for (const n of nuvens) {
        n.x += n.v * seg
        if (n.x - n.larg > LARGURA + 20) n.x = -n.larg - 20
        n.g.setPosition(n.x, n.y)
      }
      for (const b of brilhos) {
        const a = Math.max(0, Math.sin(t * b.v + b.fase)) ** 2
        b.r.setAlpha(0.15 + a * 0.75).setX(b.x0 + Math.sin(t * 0.6 + b.fase) * 2)
      }
      for (const b of barcos) {
        b.x += b.v * seg
        if (b.v > 0 && b.x > LARGURA + 40) b.x = -40
        if (b.v < 0 && b.x < -40) b.x = LARGURA + 40
        b.g.setPosition(b.x, b.y + Math.sin(t * 0.9 + b.x * 0.01) * 1.2).setRotation(Math.sin(t * 0.8 + b.x * 0.02) * 0.04).setScale(b.v < 0 ? -Math.abs(b.g.scaleX) : Math.abs(b.g.scaleX), b.g.scaleY)
      }

      // ---------- ondas ----------
      ondas.clear()
      espuma.clear()
      // fileiras de ondinhas (cristas curtas que sobem e descem devagar)
      for (let r = 0; r < FILEIRAS; r++) {
        const u = (r + 0.5) / FILEIRAS
        const yBase = HORIZONTE + 8 + u ** 1.6 * 218
        const largura = 1 + u * 1.4
        ondas.lineStyle(largura, 0xe8fbff, 0.18 + u * 0.22)
        const fase = t * (0.5 + u * 0.35) + r * 1.7
        let pen = false
        for (let x = 0; x <= LARGURA; x += 8) {
          const y = yBase + Math.sin(x * 0.03 + fase) * (1.2 + u * 2.5) + Math.sin(t * 0.7 + r) * 1.5
          const visivel = Math.sin(x * 0.011 + r * 2.3 + t * 0.15) > -0.15 && y < praiaY(x) - 6
          if (visivel) {
            if (!pen) ondas.beginPath().moveTo(x, y)
            else ondas.lineTo(x, y)
            pen = true
          } else if (pen) {
            ondas.strokePath()
            pen = false
          }
        }
        if (pen) ondas.strokePath()
      }
      // ondas grandes: do horizonte até a areia, seguindo a curva da praia
      for (let w = 0; w < ONDAS_GRANDES; w++) {
        const prog = ((ms / PERIODO_ONDA + w / ONDAS_GRANDES) % 1 + 1) % 1
        const q = prog ** 1.9
        const alturaOnda = 3 + prog * 15
        const pontos = []
        for (let x = -10; x <= LARGURA + 10; x += 6) {
          const base = HORIZONTE + 10 + q * (praiaY(Math.max(0, Math.min(LARGURA, x))) - 12 - (HORIZONTE + 10))
          pontos.push({ x, y: base + Math.sin(x * 0.02 + t * 0.9 + w * 2) * (1 + prog * 3) })
        }
        if (pontos.every((pt) => pt.y > ALTURA)) continue
        const alfa = Math.min(1, prog * 5) * Math.min(1, (1 - prog) * 5)
        // o corpo da onda: faixa azul-clara (a face) e a crista branca em cima
        ondas.fillStyle(0x7ae8f0, 0.22 * alfa)
        ondas.fillPoints([...pontos, ...pontos.map((pt) => ({ x: pt.x, y: pt.y + alturaOnda })).reverse()], true)
        ondas.lineStyle(1.5 + prog * 2.5, 0xffffff, 0.75 * alfa)
        ondas.strokePoints(pontos)
        ondas.lineStyle(1, 0xffffff, 0.35 * alfa)
        ondas.strokePoints(pontos.map((pt) => ({ x: pt.x, y: pt.y + alturaOnda * 0.55 })))
        // espuma quebrando (bolinhas) quando perto da praia
        if (prog > 0.62) {
          const k = (prog - 0.62) / 0.38
          for (let i = 0; i < pontos.length; i += 2) {
            const pt = pontos[i]
            if (Math.sin(i * 1.7 + w * 3) > 0.1) espuma.fillStyle(0xffffff, 0.55 * k * alfa).fillCircle(pt.x, pt.y + Math.sin(t * 3 + i) * 1.2, 1.5 + k * 2)
          }
        }
      }
      // a água chegando e voltando sobre a areia molhada: linha de espuma que pulsa
      const mare = Math.sin(t * 0.55) * 0.5 + 0.5
      const espumaPts = []
      for (let x = 0; x <= LARGURA; x += 6) espumaPts.push({ x, y: praiaY(x) + mare * 9 + Math.sin(x * 0.045 + t * 1.3) * 1.8 })
      espuma.fillStyle(0xbdf4f6, 0.4).fillPoints([...espumaPts.map((pt) => ({ x: pt.x, y: pt.y - 8 })), ...espumaPts.slice().reverse()], true)
      espuma.lineStyle(2, 0xffffff, 0.85).strokePoints(espumaPts)
      espuma.lineStyle(1, 0xffffff, 0.45).strokePoints(espumaPts.map((pt) => ({ x: pt.x, y: pt.y + 5 + Math.sin(pt.x * 0.08 + t) * 1.2 })))
      // bolhinhas de espuma na areia molhada
      for (let i = 0; i < 40; i++) {
        const x = (i * 97.3 + 13) % LARGURA
        const y = praiaY(x) + 4 + mare * 8 + ((i * 7) % 9)
        espuma.fillStyle(0xffffff, 0.3 + 0.2 * Math.sin(t * 2 + i)).fillCircle(x, y, 1)
      }

      // ---------- coqueiros ----------
      for (const pm of palmeiras) {
        const g = pm.folhas
        g.clear()
        const brisa = Math.sin(t * 1.2 + pm.x0 * 0.01) * 0.07 + Math.sin(t * 2.3 + pm.x0) * 0.025
        FOLHAS.forEach((f, i) => {
          const ang = (pm.lado < 0 ? Math.PI - f.ang : f.ang) + brisa * (pm.lado < 0 ? -1 : 1) * (1 + (i % 3) * 0.3)
          fronda(g, pm.tx, pm.ty, ang, f.comp * pm.escala, f.queda + brisa * 2, i % 2 ? 0x2f8a3a : 0x3aa046, 0x8ae070)
        })
      }

      // ---------- caranguejo ----------
      const c = estadoCaranguejo
      if (c.pausa > 0) {
        c.pausa -= dt
        c.pinca += dt
        caranguejo.setFrame(Math.floor(c.pinca / 220) % 2 ? 'c1' : 'c0')
      } else {
        c.x += c.dir * c.velocidade * seg
        caranguejo.setFrame('c0')
        if (Math.random() < 0.004) c.pausa = 1200 + Math.random() * 1200
        if (c.x > LARGURA + 40) c.dir = -1
        if (c.x < -40) c.dir = 1
      }
      caranguejo.setPosition(c.x, 362 + Math.sin(t * 9) * (c.pausa > 0 ? 0 : 0.8))

      // ---------- gaivotas ----------
      for (const gv of gaivotas) {
        gv.x += gv.v * seg
        if (gv.v > 0 && gv.x > LARGURA + 30) gv.x = -30
        if (gv.v < 0 && gv.x < -30) gv.x = LARGURA + 30
        desenharGaivota(gv, t)
      }
    },
  }
}
