import Phaser from 'phaser'
import { LARGURA, ALTURA, CENTRO_X, FONTE } from '../../constants.js'
import { texturasPraiaCafe } from '../../arte/praiaCafe.js'
import { ignorarNasCaixas } from '../../recorte.js'
import { semLigaduras } from '../../campanha/texto.js'

// CAFÉ FRANCÊS: o terraço de um café de Paris ao entardecer. De trás para a frente:
//   céu em faixas do azul-noite ao rosa e ao âmbar, estrelinhas e uma lua crescente;
//   telhados de mansarda ao longe e, no meio, uma torre de ferro em treliça (genérica) com
//   a luz do alto piscando e pontinhos dourados brilhando;
//   dois prédios de pedra com janelas acesas, sacadas de ferro, a vitrine do CAFÉ e da
//   PÂTISSERIE e as MARQUISES listradas (a bainha ondula);
//   as luzinhas (varal de lâmpadas com halo) cruzando a rua e dois postes de luz antigos;
//   o calçamento de pedras e o terraço: mesinhas redondas com xícaras soltando vapor e
//   croissants, cadeiras de bistrô, um GATO dormindo numa cadeira (rabo balançando, pisca),
//   POMBOS ciscando (às vezes voam) e um ACORDEONISTA (silhueta de boina) com notinhas.
// Nada forte atrás das caixas e das cartas: os brilhos ficam no alto, no vão do meio e nas
// laterais (a arena ainda põe o véu da moldura por cima).

const CEU = [0x161638, 0x211f4c, 0x30266a, 0x4a2e78, 0x6e3a80, 0x984a82, 0xc25e82, 0xe07a7e, 0xf09a78, 0xf8b878]
const HORIZONTE = 268
const RUA = 270 // onde começa o calçamento
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

export default function cafe(scene, objetos) {
  texturasPraiaCafe(scene)
  const sorte = sorteador(5)
  const ADD = Phaser.BlendModes.ADD
  const add = (o) => {
    objetos.push(o)
    return o.setDepth(-10)
  }

  // ---------- céu ----------
  const ceu = add(scene.add.graphics())
  const faixa = HORIZONTE / CEU.length
  CEU.forEach((cor, i) => ceu.fillStyle(cor, 1).fillRect(0, Math.floor(i * faixa), LARGURA, Math.ceil(faixa) + 1))
  ceu.fillStyle(CEU[CEU.length - 1], 1).fillRect(0, HORIZONTE, LARGURA, ALTURA - HORIZONTE)
  const estrelas = Array.from({ length: 34 }, () => {
    const e = add(scene.add.rectangle(sorte() * LARGURA, 4 + sorte() * 110, 1.5, 1.5, 0xfff4e0))
    return { e, fase: sorte() * 6.28, v: 0.6 + sorte() * 1.4 }
  })
  const lua = add(scene.add.graphics())
  lua.fillStyle(0xfff0c0, 1).fillCircle(494, 72, 11)
  lua.fillStyle(CEU[2], 1).fillCircle(499, 69, 10)
  const luaHalo = add(scene.add.image(492, 73, 'arte-brilho').setTint(0xffe8a0).setBlendMode(ADD).setScale(1.2).setAlpha(0.3))

  // ---------- telhados ao longe ----------
  const telhados = add(scene.add.graphics())
  const silhueta = (base, cor, altMin, altMax, passoMin, passoMax) => {
    let x = -10
    while (x < LARGURA + 10) {
      const w = passoMin + sorte() * (passoMax - passoMin)
      const h = altMin + sorte() * (altMax - altMin)
      telhados.fillStyle(cor, 1).fillRect(x, base - h, w, h + 40)
      // mansarda: o telhado inclinado em cima
      telhados.fillTriangle(x - 2, base - h, x + w + 2, base - h, x + w / 2, base - h - 9 - sorte() * 5)
      // chaminé
      if (sorte() < 0.55) telhados.fillRect(x + w * (0.2 + sorte() * 0.5), base - h - 12, 4, 10)
      x += w
    }
  }
  silhueta(HORIZONTE + 6, 0x3a2a5e, 28, 70, 26, 46)

  // ---------- torre de ferro (treliça, genérica) ----------
  const torre = add(scene.add.graphics())
  const TOPO = 44
  const BASE = HORIZONTE + 24
  const larg = (y) => 3 + 66 * ((y - TOPO) / (BASE - TOPO)) ** 1.9
  const cor = 0x2c2150
  const corTrelica = 0x7a66b0
  // pernas (esquerda e direita), com o arco no meio embaixo
  const pernas = []
  for (let y = TOPO; y <= BASE; y += 4) pernas.push({ y, w: larg(y) })
  torre.fillStyle(cor, 1)
  torre.fillPoints([...pernas.map((p) => ({ x: CENTRO_X - p.w, y: p.y })), ...pernas.slice().reverse().map((p) => ({ x: CENTRO_X + p.w, y: p.y }))], true)
  // vão do arco entre as pernas (some o miolo embaixo)
  torre.fillStyle(0xd4607c, 1)
  const arcoY = BASE - 54
  torre.fillStyle(CEU[7], 1)
  torre.beginPath()
  torre.moveTo(CENTRO_X - larg(BASE) * 0.52, BASE)
  torre.lineTo(CENTRO_X - larg(BASE) * 0.52, arcoY + 16)
  torre.arc(CENTRO_X, arcoY + 16, larg(BASE) * 0.52, Math.PI, 0)
  torre.lineTo(CENTRO_X + larg(BASE) * 0.52, BASE)
  torre.closePath()
  torre.fillPath()
  // treliça: cruzes entre as bordas
  torre.lineStyle(1, corTrelica, 0.75)
  for (let y = TOPO + 6; y < arcoY - 6; y += 12) {
    const a = larg(y)
    const b = larg(y + 12)
    torre.lineBetween(CENTRO_X - a, y, CENTRO_X + b, y + 12)
    torre.lineBetween(CENTRO_X + a, y, CENTRO_X - b, y + 12)
    torre.lineBetween(CENTRO_X - a, y, CENTRO_X + a, y)
  }
  // bordas claras e plataformas
  torre.lineStyle(2, 0x5a4a90, 0.9)
  torre.lineBetween(CENTRO_X, TOPO, CENTRO_X - larg(BASE), BASE)
  torre.lineBetween(CENTRO_X, TOPO, CENTRO_X + larg(BASE), BASE)
  for (const y of [TOPO + 78, TOPO + 150]) {
    const w = larg(y) + 5
    torre.fillStyle(0x3a2e66, 1).fillRect(CENTRO_X - w, y - 2, w * 2, 4)
    torre.lineStyle(1, corTrelica, 0.8).lineBetween(CENTRO_X - w, y - 2, CENTRO_X + w, y - 2)
  }
  // antena no topo
  torre.lineStyle(2, 0x4a3c80, 1).lineBetween(CENTRO_X, TOPO, CENTRO_X, TOPO - 24)
  torre.lineStyle(1, 0x4a3c80, 1).lineBetween(CENTRO_X - 3, TOPO - 8, CENTRO_X + 3, TOPO - 8)
  const farol = add(scene.add.image(CENTRO_X, TOPO - 25, 'arte-brilho').setTint(0xff6a6a).setBlendMode(ADD).setScale(0.55))
  // pontinhos dourados que brilham na treliça
  const brilhosTorre = Array.from({ length: 30 }, () => {
    const y = TOPO + 8 + sorte() * (arcoY - TOPO - 14)
    const lado = sorte() < 0.5 ? -1 : 1
    const r = add(scene.add.rectangle(CENTRO_X + lado * larg(y) * (0.1 + sorte() * 0.9), y, 2, 2, 0xffe8a0))
    return { r, fase: sorte() * 10, v: 1 + sorte() * 3 }
  })

  // ---------- prédios (laterais) ----------
  const predios = add(scene.add.graphics())
  const predio = (x0, largura, lado) => {
    const g = predios
    // fachada de pedra creme (um tom mais escuro no pé e perto do vão)
    for (let y = 46; y < 268; y += 6) g.fillStyle(misturar(0xe6d6b0, 0x9a7a6a, ((y - 46) / 222) * 0.35), 1).fillRect(x0, y, largura, 6)
    g.fillStyle(0x000000, 0.12).fillRect(lado > 0 ? x0 + largura - 8 : x0, 46, 8, 222)
    // linhas de pedra
    g.lineStyle(1, 0xb09a78, 0.35)
    for (let y = 58; y < 262; y += 18) g.lineBetween(x0, y, x0 + largura, y)
    // telhado de mansarda cinza-azulado com lucarnas
    g.fillStyle(0x4a5878, 1).fillRect(x0, 24, largura, 24)
    g.fillStyle(0x5a6a8c, 1).fillRect(x0, 24, largura, 4)
    g.lineStyle(1, 0x34405a, 0.8)
    for (let x = x0 + 4; x < x0 + largura; x += 8) g.lineBetween(x, 28, x, 48)
    g.fillStyle(0x34405a, 1).fillRect(x0, 46, largura, 3)
    for (const cx of [x0 + largura * 0.28, x0 + largura * 0.72]) {
      g.fillStyle(0xe6d6b0, 1).fillRect(cx - 6, 30, 12, 15)
      g.fillStyle(0x4a5878, 1).fillTriangle(cx - 8, 31, cx + 8, 31, cx, 23)
      g.fillStyle(0xffd890, 1).fillRect(cx - 4, 33, 8, 10)
    }
    // chaminés
    g.fillStyle(0x6a4a3c, 1).fillRect(x0 + largura * (lado > 0 ? 0.12 : 0.8), 12, 7, 14)
    // janelas francesas: duas colunas em cada andar, com sacada de ferro
    for (const y of [64, 120, 176]) {
      for (const cx of [x0 + largura * 0.27, x0 + largura * 0.73]) {
        const acesa = sorte() < 0.72
        g.fillStyle(0x3a2e48, 1).fillRect(cx - 9, y - 1, 18, 40)
        g.fillStyle(acesa ? 0xffcf7a : 0x2c3558, 1).fillRect(cx - 7, y + 1, 14, 36)
        if (acesa) {
          g.fillStyle(0xfff0b8, 0.55).fillRect(cx - 7, y + 1, 14, 12)
          g.fillStyle(0x8a4a3a, 0.7).fillRect(cx - 7, y + 1, 4, 36) // cortina
        }
        g.lineStyle(1, 0x3a2e48, 1).lineBetween(cx, y + 1, cx, y + 37).lineBetween(cx - 7, y + 14, cx + 7, y + 14)
        // sacada de ferro
        g.fillStyle(0x24202e, 1).fillRect(cx - 12, y + 32, 24, 2)
        g.lineStyle(1, 0x24202e, 1)
        for (let bx = cx - 11; bx <= cx + 11; bx += 3) g.lineBetween(bx, y + 25, bx, y + 33)
        g.lineBetween(cx - 12, y + 25, cx + 12, y + 25)
      }
    }
  }
  predio(0, 108, 1)
  predio(LARGURA - 108, 108, -1)

  // vitrines do térreo: CAFÉ (verde e dourado) à esquerda, PÂTISSERIE à direita
  const lojas = add(scene.add.graphics())
  const loja = (x0, w, verde) => {
    lojas.fillStyle(verde, 1).fillRect(x0, 224, w, RUA - 224 + 6)
    lojas.fillStyle(misturar(verde, 0xffffff, 0.15), 1).fillRect(x0, 224, w, 3)
    lojas.fillStyle(0xffd890, 1).fillRect(x0 + 8, 252, w - 16, 20)
    lojas.fillStyle(0xfff0c0, 0.5).fillRect(x0 + 8, 252, w - 16, 7)
    lojas.lineStyle(1, 0xd8b050, 1).strokeRect(x0 + 8, 252, w - 16, 20)
    // bolinhos e pães na vitrine
    for (let x = x0 + 14; x < x0 + w - 18; x += 12) lojas.fillStyle(0xd88a3a, 1).fillEllipse(x, 266, 8, 5)
  }
  loja(0, 108, 0x1f4a3a)
  loja(LARGURA - 108, 108, 0x4a2438)
  const placa = (x, texto, cor) => {
    const t = add(scene.add.text(x, 238, semLigaduras(texto), { fontFamily: FONTE, fontSize: '11px', color: cor, stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5))
    return t
  }
  placa(54, 'CAFÉ', '#ffd870')
  placa(LARGURA - 54, 'PÂTISSERIE', '#ffd0e0')

  // ---------- marquises listradas (a bainha ondula) ----------
  const marquises = [
    { x0: -4, w: 116, c1: 0xc8323a, c2: 0xf6ecd8 },
    { x0: LARGURA - 112, w: 116, c1: 0x2e5aa8, c2: 0xf6ecd8 },
  ].map((m) => ({ ...m, g: add(scene.add.graphics()) }))
  const desenharMarquise = (m, t) => {
    const g = m.g
    g.clear()
    const topo = 192
    const base = 212
    const listras = 10
    const lw = m.w / listras
    // lona inclinada (mais larga embaixo)
    for (let k = 0; k < listras; k++) {
      const x = m.x0 + k * lw
      g.fillStyle(k % 2 ? m.c2 : m.c1, 1)
      g.beginPath()
      g.moveTo(x + 4, topo)
      g.lineTo(x + lw + 4, topo)
      g.lineTo(x + lw, base)
      g.lineTo(x - 0, base)
      g.closePath()
      g.fillPath()
      // bainha ondulada (festonê): meio-círculo que balança
      const bal = Math.sin(t * 1.4 + k * 0.7) * 1.2
      g.fillStyle(k % 2 ? m.c2 : m.c1, 1).fillCircle(x + lw / 2, base + bal, lw / 2)
      g.lineStyle(1, 0x000000, 0.18).strokeCircle(x + lw / 2, base + bal, lw / 2)
    }
    g.fillStyle(0x000000, 0.2).fillRect(m.x0, topo, m.w, 3)
    g.fillStyle(0x000000, 0.12).fillEllipse(m.x0 + m.w / 2, base + 22, m.w * 0.9, 14)
  }

  // ---------- varal de luzinhas (cruza a rua) ----------
  const varais = [
    { y0: 96, y1: 168, bulbos: 21, x0: 100, x1: LARGURA - 100 },
    { y0: 130, y1: 190, bulbos: 17, x0: 104, x1: LARGURA - 104 },
  ]
  const fio = add(scene.add.graphics())
  const luzes = []
  for (const v of varais) {
    const ponto = (u) => ({ x: v.x0 + (v.x1 - v.x0) * u, y: v.y0 + (v.y1 - v.y0) * 4 * u * (1 - u) })
    fio.lineStyle(1.3, 0x1c1a2a, 1)
    fio.beginPath()
    for (let i = 0; i <= 40; i++) {
      const p = ponto(i / 40)
      if (i) fio.lineTo(p.x, p.y)
      else fio.moveTo(p.x, p.y)
    }
    fio.strokePath()
    for (let k = 0; k < v.bulbos; k++) {
      const p = ponto((k + 0.5) / v.bulbos)
      const cor = [0xfff0b0, 0xffd070, 0xffb890][k % 3]
      const halo = add(scene.add.image(p.x, p.y + 4, 'arte-brilho').setTint(cor).setBlendMode(ADD).setScale(0.38).setAlpha(0.55))
      const bulbo = add(scene.add.circle(p.x, p.y + 4, 2.2, cor))
      luzes.push({ halo, bulbo, fase: sorte() * 10, v: 0.8 + sorte() * 1.6 })
    }
  }

  // ---------- postes de luz ----------
  const postes = [352, 504].map((x) => {
    const g = add(scene.add.graphics())
    g.fillStyle(0x1c1a28, 1).fillRect(x - 2, 150, 4, RUA + 36 - 150)
    g.fillRect(x - 6, RUA + 26, 12, 10)
    g.fillRect(x - 4, RUA + 18, 8, 10)
    g.lineStyle(2, 0x1c1a28, 1).lineBetween(x, 160, x - 12, 154).lineBetween(x, 160, x + 12, 154)
    g.fillStyle(0x1c1a28, 1).fillTriangle(x - 8, 148, x + 8, 148, x, 138)
    g.fillStyle(0xffe0a0, 1).fillRect(x - 6, 148, 12, 14)
    g.fillStyle(0xfff4d0, 0.8).fillRect(x - 3, 150, 6, 10)
    g.fillStyle(0x1c1a28, 1).fillRect(x - 8, 162, 16, 3)
    const halo = add(scene.add.image(x, 156, 'arte-brilho').setTint(0xffd890).setBlendMode(ADD).setScale(1.5).setAlpha(0.5))
    return { halo, fase: x }
  })

  // ---------- calçamento ----------
  const chao = add(scene.add.graphics())
  chao.fillStyle(0x4a4058, 1).fillRect(0, RUA, LARGURA, ALTURA - RUA)
  chao.fillStyle(0x6a5a78, 1).fillRect(0, RUA, LARGURA, 5) // meio-fio
  chao.fillStyle(0x000000, 0.25).fillRect(0, RUA + 5, LARGURA, 2)
  let y = RUA + 8
  let linha = 0
  while (y < ALTURA) {
    const h = 7 + (y - RUA) * 0.045
    let x = -((linha * 11) % 26)
    while (x < LARGURA) {
      const w = 16 + (y - RUA) * 0.07 + sorte() * 8
      const tom = sorte()
      const c = misturar(0x5a4e6a, 0x8a7a8a, tom * 0.7)
      chao.fillStyle(misturar(c, 0x241c34, 0.35), 1).fillRoundedRect(x, y, w, h, 2)
      chao.fillStyle(c, 1).fillRoundedRect(x + 0.6, y + 0.6, w - 1.8, h - 1.8, 2)
      chao.fillStyle(0xffffff, 0.05 + tom * 0.05).fillRect(x + 2, y + 1.4, w * 0.5, 1)
      x += w + 1.4
    }
    y += h + 1.4
    linha++
  }
  // poças de luz quente das vitrines e do poste
  const luzChao = add(scene.add.image(54, RUA + 14, 'arte-brilho').setTint(0xffc060).setBlendMode(ADD).setDisplaySize(160, 40).setAlpha(0.32))
  const luzChao2 = add(scene.add.image(LARGURA - 54, RUA + 14, 'arte-brilho').setTint(0xffa0c0).setBlendMode(ADD).setDisplaySize(160, 40).setAlpha(0.28))
  for (const p of postes) add(scene.add.image(p.halo.x, RUA + 30, 'arte-brilho').setTint(0xffd890).setBlendMode(ADD).setDisplaySize(120, 26).setAlpha(0.28))

  // ---------- terraço: mesas, cadeiras, xícaras, croissants ----------
  const mobilia = add(scene.add.graphics())
  const cadeira = (x, y, lado) => {
    mobilia.fillStyle(0x000000, 0.22).fillEllipse(x, y + 17, 20, 6)
    mobilia.lineStyle(2, 0x2c1c18, 1)
    mobilia.lineBetween(x - 7, y + 4, x - 8, y + 16).lineBetween(x + 7, y + 4, x + 8, y + 16)
    mobilia.fillStyle(0x6a3a22, 1).fillEllipse(x, y + 3, 18, 6)
    // encosto curvo (bentwood)
    mobilia.lineStyle(2.4, 0x3a2216, 1)
    mobilia.beginPath().arc(x + lado * 6, y - 6, 8, lado > 0 ? -2.2 : -0.9, lado > 0 ? -0.9 + 0.0 : -2.2 + 0.0, lado < 0).strokePath()
    mobilia.lineBetween(x + lado * 7, y + 2, x + lado * 8, y - 12)
  }
  const mesa = (x, y, escala = 1) => {
    const r = 17 * escala
    mobilia.fillStyle(0x000000, 0.22).fillEllipse(x, y + 24 * escala, r * 2.2, 8 * escala)
    mobilia.lineStyle(3 * escala, 0x2a2430, 1)
    mobilia.lineBetween(x, y + 4, x, y + 22 * escala)
    mobilia.lineBetween(x - 9 * escala, y + 24 * escala, x + 9 * escala, y + 24 * escala)
    // tampo xadrez vermelho e branco
    mobilia.fillStyle(0xf6ecd8, 1).fillEllipse(x, y, r * 2, r * 0.8)
    mobilia.fillStyle(0xc8323a, 1)
    for (let k = -2; k <= 2; k++) {
      const cx = x + k * r * 0.34
      const dy = (k % 2 ? -1 : 1) * r * 0.1
      mobilia.fillRect(cx - r * 0.15, y - r * 0.14 + dy, r * 0.3, r * 0.28)
    }
    mobilia.lineStyle(1.5, 0x4a2c18, 1).strokeEllipse(x, y, r * 2, r * 0.8)
    // xícara, pires e croissant num prato
    mobilia.fillStyle(0xffffff, 1).fillEllipse(x - r * 0.35, y - 1, 10 * escala, 4 * escala)
    mobilia.fillStyle(0xf0f0f8, 1).fillRect(x - r * 0.35 - 3 * escala, y - 6 * escala, 6 * escala, 5 * escala)
    mobilia.fillStyle(0x5a2e1a, 1).fillEllipse(x - r * 0.35, y - 6 * escala, 6 * escala, 2 * escala)
    mobilia.fillStyle(0xf8f4e8, 1).fillEllipse(x + r * 0.35, y, 11 * escala, 4 * escala)
    mobilia.fillStyle(0xe0a040, 1).fillEllipse(x + r * 0.35, y - 1.5 * escala, 8 * escala, 3.4 * escala)
    mobilia.fillStyle(0xf8c860, 1).fillEllipse(x + r * 0.35 - escala, y - 2 * escala, 4 * escala, 1.6 * escala)
    return { x: x - r * 0.35, y: y - 7 * escala, escala }
  }
  const xicaras = []
  // laterais (visíveis ao lado das caixas) e a faixa de baixo
  const posMesas = [
    { x: 52, y: 330, e: 1.1, c: [-1, 1] },
    { x: 134, y: 372, e: 1 },
    { x: 722, y: 318, e: 1 },
    { x: 806, y: 364, e: 1.1, c: [-1, 1] },
    { x: 330, y: 362, e: 0.9 },
    { x: 524, y: 360, e: 0.9 },
  ]
  for (const m of posMesas) {
    cadeira(m.x - 30 * m.e, m.y + 6, 1)
    cadeira(m.x + 30 * m.e, m.y + 6, -1)
    xicaras.push(mesa(m.x, m.y, m.e))
  }
  // vasinho de flores no meio da rua (junto do poste) e jardineiras nas janelas
  const flores = add(scene.add.graphics())
  for (const x of [18, 96, LARGURA - 96, LARGURA - 18]) {
    flores.fillStyle(0x5a3a2a, 1).fillRect(x - 11, 214, 22, 5)
    for (let k = -2; k <= 2; k++) {
      flores.fillStyle(0x3a8a4a, 1).fillCircle(x + k * 4.5, 212, 3.2)
      flores.fillStyle([0xff6a8a, 0xffd23a, 0xff9ad2, 0xffffff, 0xff7a5a][k + 2], 1).fillCircle(x + k * 4.5, 209.5, 2)
    }
  }

  // vapor das xícaras (fumacinhas que sobem)
  const vapor = []
  for (const x of xicaras) {
    for (let k = 0; k < 3; k++) vapor.push({ obj: add(scene.add.circle(0, 0, 2, 0xffffff, 0.3)), x: x.x, y: x.y, k, esc: x.escala })
  }

  // ---------- gato numa cadeira (esquerda) ----------
  const gatoG = add(scene.add.graphics())
  const GATO = { x: 38, y: 292 }
  gatoG.fillStyle(0x000000, 0.22).fillEllipse(GATO.x, GATO.y + 20, 26, 7)
  gatoG.lineStyle(2.4, 0x2c1c18, 1).lineBetween(GATO.x - 10, GATO.y + 9, GATO.x - 11, GATO.y + 19).lineBetween(GATO.x + 10, GATO.y + 9, GATO.x + 11, GATO.y + 19)
  gatoG.fillStyle(0x7a4a2a, 1).fillEllipse(GATO.x, GATO.y + 8, 26, 7)
  gatoG.lineStyle(2.4, 0x3a2216, 1).lineBetween(GATO.x - 12, GATO.y + 7, GATO.x - 13, GATO.y - 14)
  const gato = add(scene.add.graphics())
  const desenharGato = (t) => {
    const g = gato
    g.clear()
    const piscou = Math.sin(t * 0.9) > 0.985 || (t % 6) > 5.82
    // corpo (tigrado laranja) sentado, olhando para a direita
    g.fillStyle(0xe8963a, 1).fillEllipse(GATO.x + 1, GATO.y - 2, 17, 17)
    g.fillStyle(0xc87428, 1)
    for (const k of [-4, 0, 4]) g.fillRect(GATO.x - 3 + k, GATO.y - 8, 1.6, 6)
    g.fillStyle(0xf8d8a8, 1).fillEllipse(GATO.x + 4, GATO.y + 1, 7, 9)
    // cabeça e orelhas
    g.fillStyle(0xe8963a, 1).fillCircle(GATO.x + 5, GATO.y - 12, 7)
    g.fillTriangle(GATO.x - 0.5, GATO.y - 15, GATO.x + 2, GATO.y - 22, GATO.x + 5, GATO.y - 16)
    g.fillTriangle(GATO.x + 6, GATO.y - 16, GATO.x + 10, GATO.y - 22, GATO.x + 11.5, GATO.y - 14)
    g.fillStyle(0xf0a8a8, 1).fillTriangle(GATO.x + 2, GATO.y - 16, GATO.x + 3, GATO.y - 19.5, GATO.x + 4.5, GATO.y - 16)
    // olhos (fechados dormindo; abre de vez em quando) e focinho
    if (piscou) {
      g.lineStyle(1.2, 0x3a2216, 1).lineBetween(GATO.x + 3, GATO.y - 12, GATO.x + 5.5, GATO.y - 12).lineBetween(GATO.x + 7.5, GATO.y - 12, GATO.x + 10, GATO.y - 12)
    } else {
      g.fillStyle(0xb8f060, 1).fillEllipse(GATO.x + 4.5, GATO.y - 12, 3, 3.6).fillEllipse(GATO.x + 9, GATO.y - 12, 3, 3.6)
      g.fillStyle(0x101018, 1).fillRect(GATO.x + 4.2, GATO.y - 13.4, 0.8, 2.8).fillRect(GATO.x + 8.7, GATO.y - 13.4, 0.8, 2.8)
    }
    g.fillStyle(0xf08aa0, 1).fillTriangle(GATO.x + 6.4, GATO.y - 9.4, GATO.x + 8.4, GATO.y - 9.4, GATO.x + 7.4, GATO.y - 8)
    // rabo balançando
    g.lineStyle(3, 0xe8963a, 1)
    g.beginPath()
    g.moveTo(GATO.x - 7, GATO.y + 5)
    g.lineTo(GATO.x - 14 + Math.sin(t * 2.2) * 2.5, GATO.y + 12)
    g.lineTo(GATO.x - 17 + Math.sin(t * 2.2 + 0.8) * 4, GATO.y + 17)
    g.strokePath()
    // zzz
    const z = (t * 0.5) % 1
    g.fillStyle(0xffffff, 0.8 * (1 - z))
  }
  const zzz = add(scene.add.text(GATO.x + 14, GATO.y - 26, 'z', { fontFamily: FONTE, fontSize: '10px', color: '#ffffff' }).setAlpha(0))

  // ---------- acordeonista (silhueta) ----------
  const ACORDEON = { x: 806, y: 296 }
  const musico = add(scene.add.graphics())
  const acordeao = add(scene.add.graphics())
  musico.fillStyle(0x000000, 0.25).fillEllipse(ACORDEON.x, ACORDEON.y + 46, 40, 9)
  musico.fillStyle(0x16121e, 1)
  musico.fillRect(ACORDEON.x - 5, ACORDEON.y + 14, 4, 32).fillRect(ACORDEON.x + 1, ACORDEON.y + 14, 4, 32) // pernas
  musico.fillEllipse(ACORDEON.x, ACORDEON.y + 2, 17, 28) // tronco
  musico.fillCircle(ACORDEON.x, ACORDEON.y - 17, 7) // cabeça
  musico.fillEllipse(ACORDEON.x + 1, ACORDEON.y - 23, 18, 5) // boina
  musico.fillCircle(ACORDEON.x - 2, ACORDEON.y - 26, 2)
  musico.fillStyle(0xc8323a, 1).fillRect(ACORDEON.x - 6, ACORDEON.y - 9, 12, 2) // lenço
  const desenharAcordeao = (t) => {
    const g = acordeao
    g.clear()
    const abre = (Math.sin(t * 3.2) + 1) / 2 // fole abrindo e fechando
    const larg2 = 14 + abre * 16
    const x0 = ACORDEON.x - 18
    const y0 = ACORDEON.y - 3
    // as duas caixas (teclas à esquerda, botões à direita) e o fole entre elas
    g.fillStyle(0x6a1a2a, 1).fillRect(x0 - 5, y0 - 2, 7, 22)
    g.fillStyle(0x6a1a2a, 1).fillRect(x0 + larg2 + 1, y0 - 2, 7, 22)
    g.fillStyle(0xfff0e0, 1).fillRect(x0 - 4, y0 + 2, 2, 14)
    for (let k = 0; k < 6; k++) g.fillStyle(0xf0e0b0, 1).fillRect(x0 + larg2 + 3, y0 + 1 + k * 3, 2, 1.6)
    for (let k = 0; k < 7; k++) {
      const x = x0 + 2 + (larg2 - 2) * (k / 6)
      g.fillStyle(k % 2 ? 0x2a1220 : 0xa83048, 1).fillRect(x - 1.2, y0 - 1, 2.6, 20)
    }
    // braços
    g.lineStyle(3, 0x16121e, 1).lineBetween(ACORDEON.x - 5, ACORDEON.y - 4, x0 + 1, y0 + 8).lineBetween(ACORDEON.x + 5, ACORDEON.y - 4, x0 + larg2 + 6, y0 + 8)
  }
  // notinhas subindo
  const notas = Array.from({ length: 4 }, (_, i) => ({ obj: add(scene.add.text(0, 0, i % 2 ? '♪' : '♫', { fontFamily: 'sans-serif', fontSize: '14px', color: '#ffe8b0' })), fase: i / 4 }))

  // ---------- pombos ----------
  const pombos = Array.from({ length: 3 }, (_, i) => ({
    s: add(scene.add.sprite(0, 0, 'cafe-pombo', 'p0').setScale(1.7)),
    x: 380 + i * 62 + sorte() * 20,
    y: 372 + (i % 2) * 6,
    dir: i % 2 ? -1 : 1,
    pausa: sorte() * 2000,
    voo: null,
    prox: 9000 + i * 5200 + sorte() * 4000,
  }))

  const tem = () => scene.caixasDeRecorte?.length
  let ignorado = false

  return {
    atualizar(dt, estado) {
      if (!ignorado && tem()) {
        ignorado = true
        ignorarNasCaixas(scene, objetos)
      }
      const ms = estado.tempo
      const t = ms / 1000
      const seg = dt / 1000

      for (const e of estrelas) e.e.setAlpha(0.2 + 0.5 * Math.max(0, Math.sin(t * e.v + e.fase)))
      luaHalo.setAlpha(0.26 + Math.sin(t * 0.5) * 0.04)
      farol.setAlpha(Math.sin(t * 2.4) > 0.2 ? 0.95 : 0.15)
      for (const b of brilhosTorre) b.r.setAlpha(Math.max(0, Math.sin(t * b.v + b.fase)) ** 2)
      for (const m of marquises) desenharMarquise(m, t)
      for (const l of luzes) {
        const a = 0.75 + 0.25 * Math.sin(t * l.v + l.fase)
        l.halo.setAlpha(0.35 + 0.3 * a)
        l.bulbo.setAlpha(0.65 + 0.35 * a)
      }
      for (const p of postes) p.halo.setAlpha(0.42 + 0.1 * Math.sin(t * 6 + p.fase) * Math.sin(t * 1.3))
      luzChao.setAlpha(0.28 + Math.sin(t * 0.8) * 0.03)
      luzChao2.setAlpha(0.24 + Math.sin(t * 0.7 + 1) * 0.03)

      // vapor das xícaras
      vapor.forEach((v, i) => {
        const ph = (t * 0.55 + v.k / 3 + i * 0.17) % 1
        v.obj.setPosition(v.x + Math.sin(ph * 7 + v.k * 2) * 3 * v.esc, v.y - ph * 18 * v.esc).setScale((0.6 + ph * 1.5) * v.esc).setAlpha(0.45 * (1 - ph))
      })

      desenharGato(t)
      const z = (t * 0.45) % 1
      zzz.setPosition(GATO.x + 14 + z * 6, GATO.y - 26 - z * 16).setAlpha(0.8 * (1 - z)).setScale(0.8 + z * 0.7)

      desenharAcordeao(t)
      notas.forEach((n) => {
        const ph = (t * 0.28 + n.fase) % 1
        n.obj.setPosition(ACORDEON.x - 12 + Math.sin(ph * 8 + n.fase * 9) * 10, ACORDEON.y - 36 - ph * 56).setAlpha(Math.min(1, ph * 6) * (1 - ph) * 0.9)
      })

      // pombos: andam e ciscam; de vez em quando um voa pelo alto e pousa de novo
      for (const p of pombos) {
        if (p.voo) {
          p.voo.t += dt
          const k = p.voo.t / p.voo.dur
          p.x = p.voo.x0 + (p.voo.x1 - p.voo.x0) * k
          p.s.setY(p.voo.y0 + (p.voo.y1 - p.voo.y0) * k - Math.sin(k * Math.PI) * 190)
          p.s.setFrame(Math.floor(p.voo.t / 90) % 2 ? 'p1' : 'p0').setFlipX(p.voo.x1 < p.voo.x0)
          if (k >= 1) {
            p.voo = null
            p.x = Phaser.Math.Clamp(p.x, 340, 520)
            p.prox = 14000 + sorte() * 12000
          }
        } else {
          p.prox -= dt
          if (p.pausa > 0) {
            p.pausa -= dt
            const bica = Math.floor(t * 3 + p.x) % 3 === 0 ? 2 : 0 // cisca
            p.s.setFrame('p0').setFlipX(p.dir < 0).setY(p.y + bica)
          } else {
            p.x += p.dir * 14 * seg
            if (p.x > 520) p.dir = -1
            if (p.x < 340) p.dir = 1
            if (Math.random() < 0.004) p.pausa = 900 + Math.random() * 1500
            p.s.setFlipX(p.dir < 0)
            p.s.setFrame('p0')
            p.s.setY(p.y + Math.sin(t * 9 + p.x) * 0.8)
          }
          if (p.prox <= 0 && !p.voo) {
            const lado = p.dir
            p.voo = { t: 0, dur: 2600, x0: p.x, y0: p.y, x1: p.x + lado * 140, y1: p.y }
          }
        }
        p.s.setX(p.x)
      }
    },
  }
}
