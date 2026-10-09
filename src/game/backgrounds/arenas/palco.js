import Phaser from 'phaser'
import { LARGURA, ALTURA } from '../../constants.js'

// PALCO: show de rock à noite, visto da plateia. De trás para a frente:
//   1. cenário de fundo (canvas desenhado UMA vez): parede do palco com tubos de
//      neon, bambolina vermelha no alto, treliça com refletores, telão no meio,
//      piso de madeira em perspectiva;
//   2. o que anima atrás do equipamento: o telão (equalizador / coração batendo)
//      com as lâmpadas do letreiro correndo em volta, os feixes de holofote
//      varrendo DEVAGAR (com poeira brilhando dentro), a mancha de luz no piso;
//   3. cenário da frente (outro canvas, transparente): bateria no praticável,
//      amplificadores, caixas de som, retornos, pedestal do microfone, a beira do
//      palco e as cortinas de veludo com franja e abraçadeira douradas;
//   4. ribalta acesa, fumaça rasteira e a PLATEIA em silhueta embaixo, pulando
//      na batida, com celulares e isqueiros acesos.
// Tudo segue a mesma batida (BATIDA_MS): plateia, ribalta, telão e lentes.
// Legibilidade: as caixas de esquiva são opacas, mas em volta delas (e atrás das
// mãos de cartas) tudo é escuro e de pouco contraste; os feixes são fracos e
// lentos. O que mais brilha (telão, refletores) fica na coluna do meio e no alto.

const BATIDA_MS = 60000 / 124 // andamento do show
const CENARIO_FUNDO = 'arena-palco-fundo'
const CENARIO_FRENTE = 'arena-palco-frente'
const FEIXE = 'arena-palco-feixe'
const BRILHO = 'arena-palco-brilho'
const NEBLINA = 'arena-palco-neblina'
const PONTO = 'arena-palco-ponto' // pixel branco (poeira, telinhas)
const PESSOA = 'arena-palco-pessoa' // -0 .. -5
const PISO_Y = 318 // começo do piso do palco
const BEIRA_Y = 392 // beira do palco (daqui para baixo é a plateia)
const TELAO = { x: 278, y: 70, w: 84, h: 58 }

const ROSA = 0xff4fa8
const VIOLETA = 0x9a6aff
const CIANO = 0x4fd8ff
const AMBAR = 0xffc04f

// refletores pendurados na treliça: x da lente, cor, e o feixe (ângulo base,
// amplitude e período da varredura, em rad / ms). Os das pontas varrem para
// dentro; os do meio balançam pouco sobre a coluna do meio
const REFLETORES = [
  { x: 34, cor: AMBAR },
  { x: 92, cor: ROSA, feixe: { base: -0.42, amp: 0.2, periodo: 9100, fase: 0.4 } },
  { x: 150, cor: CIANO },
  { x: 214, cor: VIOLETA, feixe: { base: -0.16, amp: 0.2, periodo: 7300, fase: 2.1 } },
  { x: 270, cor: ROSA, feixe: { base: 0.05, amp: 0.13, periodo: 6100, fase: 1.2 } },
  { x: 370, cor: CIANO, feixe: { base: -0.05, amp: 0.13, periodo: 6700, fase: 3.6 } },
  { x: 426, cor: AMBAR, feixe: { base: 0.16, amp: 0.2, periodo: 7900, fase: 5.0 } },
  { x: 490, cor: VIOLETA },
  { x: 548, cor: ROSA, feixe: { base: 0.42, amp: 0.2, periodo: 8600, fase: 4.4 } },
  { x: 606, cor: CIANO },
]
const LENTE_Y = 57

// fileiras da plateia (de trás para a frente): mais escuras e maiores na frente
const FILEIRAS = [
  { base: 438, escala: 0.72, cor: 0x230b28, n: 26, pulo: 3, deriva: 3 },
  { base: 463, escala: 0.95, cor: 0x15071b, n: 19, pulo: 4, deriva: 5 },
  { base: 497, escala: 1.28, cor: 0x070309, n: 13, pulo: 6, deriva: 8 },
]

const hex = (c) => '#' + c.toString(16).padStart(6, '0')

export default function palco(scene, objetos) {
  const add = (o) => {
    objetos.push(o)
    return o.setDepth(-10)
  }
  gerarTexturas(scene)

  add(scene.add.image(0, 0, CENARIO_FUNDO).setOrigin(0))

  // ---------- telão + letreiro (redesenhados todo frame: poucas formas) ----------
  const telao = add(scene.add.graphics())

  // ---------- feixes de holofote ----------
  // (tudo o que é ADD fica junto na ordem de desenho: menos trocas de modo de mistura)
  const feixes = REFLETORES.filter((r) => r.feixe).map((r) => ({
    ...r.feixe,
    x: r.x,
    img: add(scene.add.image(r.x, LENTE_Y + 2, FEIXE).setOrigin(0.5, 0).setTint(r.cor).setBlendMode(Phaser.BlendModes.ADD)),
    mancha: add(scene.add.image(r.x, PISO_Y + 30, BRILHO).setTint(r.cor).setBlendMode(Phaser.BlendModes.ADD)),
  }))
  // poeira dançando dentro de cada feixe: posição ao longo dele (0..1) e de lado (-0.5..0.5)
  for (const f of feixes) {
    f.poeira = Array.from({ length: 11 }, (_, k) => ({
      obj: add(scene.add.image(0, 0, PONTO).setScale(0.75).setBlendMode(Phaser.BlendModes.ADD)),
      s: ((k * 0.37) % 1) * 0.9 + 0.08,
      l: ((k * 0.61) % 1) - 0.5,
      v: 0.012 + ((k * 7) % 5) * 0.004,
      fase: k * 1.9,
    }))
  }

  // ---------- cenário da frente ----------
  // só os pedaços com desenho (o canvas é quase todo transparente: menos pixels para pintar)
  for (const nome of Object.keys(PEDACOS_FRENTE)) {
    const [x, y] = PEDACOS_FRENTE[nome]
    add(scene.add.image(x, y, CENARIO_FRENTE, nome).setOrigin(0))
  }

  // lentes dos refletores (brilho que pulsa na batida)
  const lentes = REFLETORES.map((r, k) => ({
    img: add(scene.add.image(r.x, LENTE_Y, BRILHO).setTint(r.cor).setBlendMode(Phaser.BlendModes.ADD).setScale(0.22)),
    fase: k % 2,
    forte: Boolean(r.feixe),
  }))

  // ribalta: luzinhas na beira do palco, brilho subindo
  const ribalta = Array.from({ length: 9 }, (_, k) => {
    const x = 48 + k * 68
    return add(scene.add.image(x, BEIRA_Y + 1, BRILHO).setTint(k % 2 ? ROSA : AMBAR).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5, 0.28))
  })

  // fumaça rasteira no piso do palco e uma névoa alta, bem fracas
  const nevoas = [
    ...Array.from({ length: 5 }, (_, k) => ({ y: PISO_Y + 26 + (k % 3) * 14, escala: 1.6 + (k % 2) * 0.5, v: 5 + k * 2, x: k * 150, alpha: 0.09, cor: 0xd8a8ff })),
    ...Array.from({ length: 3 }, (_, k) => ({ y: 84 + k * 18, escala: 2.2, v: -3 - k * 2, x: k * 230, alpha: 0.05, cor: 0xff9ad0 })),
  ].map((n) => ({ ...n, obj: add(scene.add.image(n.x, n.y, NEBLINA).setTint(n.cor).setAlpha(n.alpha).setScale(n.escala, n.escala * 0.6)) }))

  // ---------- plateia ----------
  // fundo da plateia (o "fosso" escuro na frente do palco), desenhado uma vez
  const fosso = add(scene.add.graphics())
  fosso.fillGradientStyle(0x4a1440, 0x4a1440, 0x0a040e, 0x0a040e, 1)
  fosso.fillRect(0, BEIRA_Y + 8, LARGURA, ALTURA - BEIRA_Y - 8)

  let semente = 7
  const sorte = () => {
    semente = (semente * 16807) % 2147483647
    return semente / 2147483647
  }
  const pessoas = []
  const luzes = [] // celulares e isqueiros nas mãos levantadas
  FILEIRAS.forEach((f, fila) => {
    const daFila = []
    for (let k = 0; k < f.n; k++) {
      const variante = Math.floor(sorte() * 6)
      const x = ((k + 0.5) / f.n) * (LARGURA + 40) - 20 + (sorte() - 0.5) * 14
      const escala = f.escala * (0.9 + sorte() * 0.2)
      const img = add(scene.add.image(x, f.base, `${PESSOA}-${variante}`).setOrigin(0.5, 1).setScale(escala).setTint(f.cor))
      const p = { img, x, fila, f, escala, atraso: (sorte() - 0.5) * 0.18, balanco: sorte() < 0.4 ? 0.06 + sorte() * 0.06 : 0, faseBalanco: sorte() * 6 }
      pessoas.push(p)
      if (MAOS[variante]) daFila.push({ p, mao: MAOS[variante], isqueiro: variante === 5, fase: sorte() * 10 })
    }
    // as luzes da fila vêm logo depois dela (a fila da frente tampa as de trás)
    for (const l of daFila) l.brilho = add(scene.add.image(0, 0, BRILHO).setTint(l.isqueiro ? 0xffb040 : 0xbfe4ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.09 + fila * 0.03))
    for (const l of daFila) {
      l.tela = add(scene.add.image(0, 0, PONTO).setTint(l.isqueiro ? 0xffd070 : 0xe8f6ff))
      l.tela.setDisplaySize(l.isqueiro ? 2 : 2 + fila, 3 + fila)
      luzes.push(l)
    }
  })

  return {
    atualizar(dt, estado) {
      const t = estado.tempo
      const batida = t / BATIDA_MS
      const fracao = batida - Math.floor(batida)
      const pancada = Math.pow(1 - fracao, 3) // 1 no instante da batida, cai rápido

      desenharTelao(telao, t, batida, pancada)

      for (const f of feixes) {
        const a = f.base + Math.sin((t / f.periodo) * Math.PI * 2 + f.fase) * f.amp
        const comprimento = (PISO_Y + 34 - LENTE_Y) / Math.cos(a)
        f.img.setRotation(-a).setScale(1, comprimento / 256).setAlpha(0.15 + pancada * 0.03)
        const fx = f.x + Math.sin(a) * comprimento
        const fy = LENTE_Y + Math.cos(a) * comprimento
        f.mancha.setPosition(fx, fy).setScale(0.95, 0.3).setAlpha(0.2 + pancada * 0.05)
        const sen = Math.sin(a)
        const cos = Math.cos(a)
        for (const d of f.poeira) {
          d.s += (d.v * dt) / 1000
          if (d.s > 0.97) d.s = 0.08
          const ao = d.s * comprimento
          const lado = (d.l + Math.sin(t / 1300 + d.fase) * 0.08) * (6 + d.s * 54)
          d.obj.setPosition(f.x + sen * ao + cos * lado, LENTE_Y + cos * ao - sen * lado)
          d.obj.setAlpha((0.25 + 0.35 * Math.max(0, Math.sin(t / 420 + d.fase))) * Math.sin(d.s * Math.PI))
        }
      }

      for (const l of lentes) {
        const pulso = l.fase === Math.floor(batida) % 2 ? pancada : 0
        l.img.setAlpha((l.forte ? 0.75 : 0.45) + pulso * 0.25)
      }
      ribalta.forEach((r, k) => r.setAlpha(0.32 + 0.12 * Math.pow(1 - ((batida + k * 0.125) % 1), 2)))

      for (const n of nevoas) {
        n.x += (n.v * dt) / 1000
        const largura = 128 * n.escala
        if (n.x > LARGURA + largura / 2) n.x = -largura / 2
        if (n.x < -largura / 2) n.x = LARGURA + largura / 2
        n.obj.setPosition(n.x, n.y + Math.sin(t / 2400 + n.x / 90) * 3)
      }

      // plateia: pula na batida (cada um com um tiquinho de atraso), as fileiras
      // derivam devagar de lado com amplitudes diferentes (parallax)
      const derivas = FILEIRAS.map((f, k) => Math.sin(t / 3100 + k * 1.3) * f.deriva)
      for (const p of pessoas) {
        const fb = batida + p.atraso
        const pulo = Math.pow(Math.max(0, Math.cos((fb - Math.floor(fb)) * Math.PI)), 2) * p.f.pulo
        p.img.setPosition(p.x + derivas[p.fila], p.f.base - pulo)
        if (p.balanco) p.img.setRotation(Math.sin((batida / 2) * Math.PI + p.faseBalanco) * p.balanco)
      }
      for (const l of luzes) {
        const img = l.p.img
        const lx = (l.mao.x - 16) * img.scaleX
        const ly = (l.mao.y - 56) * img.scaleY
        const r = img.rotation
        const x = img.x + lx * Math.cos(r) - ly * Math.sin(r)
        const y = img.y + lx * Math.sin(r) + ly * Math.cos(r)
        const tremor = l.isqueiro ? 0.75 + 0.25 * Math.sin(t / 60 + l.fase) * Math.sin(t / 97 + l.fase) : 0.85 + 0.15 * Math.sin(t / 900 + l.fase)
        l.tela.setPosition(x, y).setAlpha(tremor)
        l.brilho.setPosition(x, y).setAlpha(0.55 * tremor)
      }
    },
  }
}

// ---------- telão ----------

// Telão no meio do fundo: 8 batidas de equalizador, 4 de coração batendo. As
// lâmpadas do letreiro em volta correm (chase) uma casa por meia batida.
function desenharTelao(g, t, batida, pancada) {
  const { x, y, w, h } = TELAO
  g.clear()
  const ciclo = Math.floor(batida) % 12
  if (ciclo < 8) {
    // equalizador: barras de segmentos de LED (rosa embaixo, violeta, ciano no topo)
    const barras = 10
    const lb = 6
    const vao = (w - 8 - barras * lb) / (barras - 1)
    for (let k = 0; k < barras; k++) {
      const ruido = 0.5 + 0.5 * Math.sin(t / (170 + k * 23) + k * 1.7) * Math.sin(t / (260 + k * 11) + k)
      const nivel = Math.min(1, 0.2 + ruido * 0.6 + pancada * (k % 3 === 0 ? 0.45 : 0.25))
      const segmentos = Math.round(nivel * 11)
      const bx = x + 4 + k * (lb + vao)
      for (let s = 0; s < segmentos; s++) {
        const cor = s < 5 ? ROSA : s < 9 ? VIOLETA : CIANO
        g.fillStyle(cor, 0.85)
        g.fillRect(Math.round(bx), y + h - 6 - s * 4, lb, 3)
      }
    }
  } else {
    // coração de pixels batendo no meio do telão
    const escala = 3 + (pancada > 0.5 ? 1 : 0)
    const cx = x + w / 2
    const cy = y + h / 2 + 1
    g.fillStyle(ROSA, 0.9)
    CORACAO_PIXEL.forEach((linha, ly) => {
      for (let lx = 0; lx < linha.length; lx++) if (linha[lx] === '#') g.fillRect(Math.round(cx + (lx - 3.5) * escala), Math.round(cy + (ly - 3) * escala), escala, escala)
    })
  }
  // lâmpadas do letreiro em volta do telão (chase)
  const passo = 6
  const lampadas = []
  for (let lx = x - 4; lx <= x + w + 4; lx += passo) lampadas.push([lx, y - 5])
  for (let ly = y + 1; ly <= y + h - 1; ly += passo) lampadas.push([x + w + 4, ly])
  for (let lx = x + w + 4; lx >= x - 4; lx -= passo) lampadas.push([lx, y + h + 5])
  for (let ly = y + h - 1; ly >= y + 1; ly -= passo) lampadas.push([x - 4, ly])
  const casa = Math.floor(batida * 2)
  lampadas.forEach(([lx, ly], k) => {
    const acesa = (k + casa) % 3 === 0
    g.fillStyle(acesa ? 0xffe9a0 : 0x6a4a20, acesa ? 0.95 : 0.8)
    g.fillRect(Math.round(lx) - 1, Math.round(ly) - 1, 2, 2)
  })
}

// pedaços do cenário da frente que têm desenho: [x, y, largura, altura]
const PEDACOS_FRENTE = {
  bambolina: [0, 0, LARGURA, 37],
  cortinaEsquerda: [0, 37, 72, BEIRA_Y + 8 - 37],
  cortinaDireita: [LARGURA - 72, 37, 72, BEIRA_Y + 8 - 37],
  palco: [72, 240, LARGURA - 144, BEIRA_Y + 8 - 240],
}

const CORACAO_PIXEL = ['.##..##.', '########', '########', '.######.', '..####..', '...##...']

// onde fica a mão levantada de cada variante (px na textura 32x56), se tiver
const MAOS = { 2: { x: 5, y: 4 }, 5: { x: 27, y: 4 } }

// ---------- texturas (geradas uma vez por jogo) ----------

function gerarTexturas(scene) {
  if (!scene.textures.exists(CENARIO_FUNDO)) pintar(scene, CENARIO_FUNDO, LARGURA, ALTURA, desenharFundo)
  if (!scene.textures.exists(CENARIO_FRENTE)) {
    pintar(scene, CENARIO_FRENTE, LARGURA, ALTURA, desenharFrente)
    const tex = scene.textures.get(CENARIO_FRENTE)
    for (const [nome, [x, y, w, h]] of Object.entries(PEDACOS_FRENTE)) tex.add(nome, 0, x, y, w, h)
  }
  if (!scene.textures.exists(FEIXE)) pintar(scene, FEIXE, 64, 256, desenharFeixe)
  if (!scene.textures.exists(BRILHO)) pintar(scene, BRILHO, 64, 64, desenharBrilho)
  if (!scene.textures.exists(NEBLINA)) pintar(scene, NEBLINA, 128, 64, desenharNeblina)
  if (!scene.textures.exists(PONTO)) pintar(scene, PONTO, 2, 2, (ctx) => ret(ctx, '#ffffff', 0, 0, 2, 2))
  for (let k = 0; k < 6; k++) if (!scene.textures.exists(`${PESSOA}-${k}`)) pintar(scene, `${PESSOA}-${k}`, 32, 56, (ctx) => desenharPessoa(ctx, k))
}

function pintar(scene, chave, w, h, desenhar) {
  const tex = scene.textures.createCanvas(chave, w, h)
  const ctx = tex.getContext()
  ctx.imageSmoothingEnabled = false
  desenhar(ctx, w, h)
  tex.refresh()
}

const ret = (ctx, cor, x, y, w, h) => {
  ctx.fillStyle = cor
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

// degradê em faixas com uma costura pontilhada entre elas (dither de pixel art)
function degrade(ctx, x, y, w, h, cores) {
  const faixa = h / cores.length
  cores.forEach((cor, k) => {
    const y0 = Math.round(y + k * faixa)
    const y1 = Math.round(y + (k + 1) * faixa)
    ret(ctx, cor, x, y0, w, y1 - y0)
    if (k === cores.length - 1) return
    ctx.fillStyle = cores[k + 1]
    for (let px = x + (y1 % 2); px < x + w; px += 2) ctx.fillRect(px, y1 - 1, 1, 1)
    ctx.fillStyle = cor
    for (let px = x + ((y1 + 1) % 2); px < x + w; px += 2) ctx.fillRect(px, y1, 1, 1)
  })
}

// linha de pixels (Bresenham)
function linha(ctx, cor, x0, y0, x1, y1) {
  ctx.fillStyle = cor
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
    ctx.fillRect(x0, y0, 1, 1)
    if (x0 === x1 && y0 === y1) return
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

function circulo(ctx, cor, cx, cy, r) {
  ctx.fillStyle = cor
  for (let y = -r; y <= r; y++) {
    const meia = Math.round(Math.sqrt(r * r - y * y))
    ctx.fillRect(Math.round(cx - meia), Math.round(cy + y), meia * 2 + 1, 1)
  }
}

function elipse(ctx, cor, cx, cy, rx, ry) {
  ctx.fillStyle = cor
  for (let y = -ry; y <= ry; y++) {
    const meia = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)))
    ctx.fillRect(Math.round(cx - meia), Math.round(cy + y), meia * 2 + 1, 1)
  }
}

// ----- cenário de fundo: parede, neon, treliça, refletores, telão, piso -----

function desenharFundo(ctx) {
  // parede do fundo do palco
  degrade(ctx, 0, 0, LARGURA, PISO_Y, ['#07030b', '#0b0512', '#100618', '#14081d', '#180a21', '#1c0b24'])
  // painéis do fundo (costuras verticais) e grade de LEDs apagados
  for (let x = 20; x < LARGURA; x += 40) ret(ctx, '#1f0d28', x, 60, 1, PISO_Y - 60)
  for (let y = 66; y < PISO_Y - 10; y += 8) for (let x = 24 + ((y / 8) % 2) * 4; x < LARGURA; x += 8) ret(ctx, '#211029', x, y, 1, 1)
  // tubos de neon na parede (apagadinhos, só um contorno colorido)
  const neons = [
    [96, '#5a1c48', '#8a2a6e'],
    [176, '#2c2060', '#4a3a9a'],
    [464, '#2c2060', '#4a3a9a'],
    [544, '#5a1c48', '#8a2a6e'],
  ]
  for (const [x, escuro, claro] of neons) {
    ret(ctx, escuro, x - 1, 74, 3, 210)
    ret(ctx, claro, x, 76, 1, 206)
  }
  // céu estrelado no alto (o show é ao ar livre), atrás da bambolina
  for (let k = 0; k < 40; k++) {
    const x = (k * 151) % LARGURA
    const y = 2 + ((k * 37) % 30)
    ret(ctx, k % 5 === 0 ? '#9a88c8' : '#4a3e6a', x, y, 1, 1)
  }

  // treliça (duas barras com zigue-zague) e as correntes
  const ty = 38
  for (let x = 40; x < LARGURA; x += 140) ret(ctx, '#3a3a50', x, 30, 1, 8)
  ret(ctx, '#3c3c54', 0, ty, LARGURA, 2)
  ret(ctx, '#7a7a98', 0, ty, LARGURA, 1)
  ret(ctx, '#3c3c54', 0, ty + 9, LARGURA, 2)
  ret(ctx, '#6a6a88', 0, ty + 9, LARGURA, 1)
  for (let x = 0; x < LARGURA; x += 10) {
    linha(ctx, '#4e4e6a', x, ty + 2, x + 5, ty + 8)
    linha(ctx, '#4e4e6a', x + 5, ty + 8, x + 10, ty + 2)
  }

  // refletores pendurados (lata, garfo, aba) com a lente apagada
  for (const r of REFLETORES) {
    const x = r.x
    ret(ctx, '#2a2a3a', x - 1, ty + 11, 2, 3)
    ret(ctx, '#3a3a50', x - 6, ty + 13, 12, 2)
    ret(ctx, '#3a3a50', x - 6, ty + 13, 2, 7)
    ret(ctx, '#3a3a50', x + 4, ty + 13, 2, 7)
    ret(ctx, '#15151f', x - 4, ty + 14, 8, 9)
    ret(ctx, '#26263a', x - 4, ty + 14, 2, 9)
    ret(ctx, '#0c0c14', x - 5, ty + 22, 10, 2)
    ret(ctx, hex(r.cor), x - 3, ty + 18, 6, 2)
  }

  // telão: moldura e tela escura com linhas de varredura
  const { x, y, w, h } = TELAO
  ret(ctx, '#2a2436', x - 8, y - 9, w + 16, h + 18)
  ret(ctx, '#16121e', x - 7, y - 8, w + 14, h + 16)
  ret(ctx, '#3a3048', x - 2, y - 2, w + 4, h + 4)
  ret(ctx, '#05040a', x, y, w, h)
  for (let ly = y + 1; ly < y + h; ly += 2) ret(ctx, '#0a0814', x, ly, w, 1)
  // cabos do telão subindo até a treliça
  ret(ctx, '#2a2a3a', x + 10, ty + 11, 1, y - 9 - ty - 11)
  ret(ctx, '#2a2a3a', x + w - 11, ty + 11, 1, y - 9 - ty - 11)

  // piso de madeira em perspectiva
  degrade(ctx, 0, PISO_Y, LARGURA, BEIRA_Y - PISO_Y, ['#1e0e0a', '#26120c', '#2e170e', '#361b10', '#3e2012'])
  const fuga = { x: LARGURA / 2, y: 150 }
  for (let k = -14; k <= 14; k++) {
    const xb = LARGURA / 2 + k * 46
    const kTopo = (PISO_Y - fuga.y) / (BEIRA_Y - fuga.y)
    linha(ctx, '#170a06', fuga.x + (xb - fuga.x) * kTopo, PISO_Y, xb, BEIRA_Y - 1)
  }
  let yy = PISO_Y + 4
  let passo = 5
  while (yy < BEIRA_Y) {
    ret(ctx, '#170a06', 0, yy, LARGURA, 1)
    ret(ctx, '#4a2a18', 0, yy + 1, LARGURA, 1)
    passo += 2
    yy += passo
  }
}

// ----- cenário da frente: equipamento, beira do palco, cortinas -----

function desenharFrente(ctx) {
  desenharBateria(ctx)
  desenharAmplificador(ctx, 66, 258)
  desenharAmplificador(ctx, 526, 258)
  desenharRetorno(ctx, 176, 374, 1)
  desenharRetorno(ctx, 424, 374, -1)
  // pedestal do microfone na frente
  ret(ctx, '#2a2a36', 319, 336, 2, 52)
  ret(ctx, '#3a3a4a', 314, 388, 12, 2)
  ret(ctx, '#4a4a5c', 317, 332, 6, 5)
  ret(ctx, '#8a8aa0', 318, 332, 2, 2)

  // beira do palco com as caixinhas da ribalta
  ret(ctx, '#0e0605', 0, BEIRA_Y, LARGURA, 8)
  ret(ctx, '#5a3420', 0, BEIRA_Y, LARGURA, 1)
  ret(ctx, '#2a160c', 0, BEIRA_Y + 1, LARGURA, 1)
  for (let k = 0; k < 9; k++) {
    const x = 48 + k * 68
    ret(ctx, '#1a1a24', x - 6, BEIRA_Y - 3, 12, 5)
    ret(ctx, '#3a3a4a', x - 6, BEIRA_Y - 3, 12, 1)
    ret(ctx, k % 2 ? '#ff8ac8' : '#ffd890', x - 3, BEIRA_Y - 1, 6, 1)
  }

  desenharCortina(ctx, 0)
  desenharCortina(ctx, 1)
  desenharBambolina(ctx)
}

function desenharBateria(ctx) {
  // praticável com faixa de LED rosa
  ret(ctx, '#120a12', 262, 306, 116, 16)
  ret(ctx, '#2a1a26', 262, 306, 116, 2)
  for (let x = 266; x < 376; x += 4) ret(ctx, x % 8 ? '#6a1c4a' : '#a02a6c', x, 314, 2, 2)
  // pratos (dourados, em pé) e estantes
  for (const [cx, cy, r] of [
    [286, 254, 12],
    [356, 250, 13],
    [372, 270, 9],
  ]) {
    ret(ctx, '#3a3a48', cx, cy, 1, 306 - cy)
    elipse(ctx, '#6a5018', cx, cy, r, 2)
    elipse(ctx, '#b08a2a', cx, cy - 1, r - 2, 1)
  }
  // tons
  for (const [cx, cy] of [
    [304, 272],
    [336, 272],
  ]) {
    elipse(ctx, '#3a0e22', cx, cy + 4, 10, 6)
    elipse(ctx, '#5a1a36', cx, cy, 10, 4)
    elipse(ctx, '#c8b8c0', cx, cy - 1, 8, 2)
  }
  // bumbo de frente com o logo (coração)
  circulo(ctx, '#2a0a1a', 320, 288, 17)
  circulo(ctx, '#d8ccd4', 320, 288, 15)
  circulo(ctx, '#1a0812', 320, 288, 13)
  CORACAO_PIXEL.forEach((l, ly) => {
    for (let lx = 0; lx < l.length; lx++) if (l[lx] === '#') ret(ctx, '#ff4fa8', 320 + (lx - 4) * 2, 283 + ly * 2, 2, 2)
  })
}

function desenharAmplificador(ctx, x, y) {
  // cabeçote
  ret(ctx, '#0c0a0e', x, y, 48, 12)
  ret(ctx, '#2a2630', x, y, 48, 1)
  ret(ctx, '#c8a040', x + 4, y + 4, 10, 2)
  for (let k = 0; k < 5; k++) ret(ctx, '#8a8a9a', x + 22 + k * 5, y + 5, 2, 2)
  // gabinete com tela de tecido
  ret(ctx, '#0c0a0e', x, y + 13, 48, 50)
  ret(ctx, '#2a2630', x, y + 13, 48, 1)
  ret(ctx, '#1a171e', x + 3, y + 16, 42, 44)
  for (let ly = y + 17; ly < y + 60; ly += 2) for (let lx = x + 4 + (ly % 4 ? 1 : 0); lx < x + 44; lx += 2) ret(ctx, '#221e28', lx, ly, 1, 1)
  ret(ctx, '#c8a040', x + 20, y + 54, 8, 2)
}

function desenharRetorno(ctx, x, y, lado) {
  // caixa de retorno (cunha) no chão, virada para o músico
  ctx.fillStyle = '#0c0a0e'
  for (let k = 0; k < 18; k++) ctx.fillRect(lado > 0 ? x : x - 38, y + k, 38, 1)
  for (let k = 0; k < 12; k++) {
    const w = 38 - Math.round(k * 0.6)
    ret(ctx, '#1e1a24', lado > 0 ? x + 2 : x - 36, y + 3 + k, w - 4, 1)
  }
  ret(ctx, '#2e2a36', lado > 0 ? x : x - 38, y, 38, 1)
}

// Cortina de veludo amarrada: larga no alto, presa pela abraçadeira dourada
// (y 250) e abrindo de novo até o chão. As dobras são "cilindros" com luz de
// um lado; elas se juntam na abraçadeira (a coordenada da dobra é relativa à
// largura de cada linha).
function desenharCortina(ctx, lado) {
  const TONS = ['#24030c', '#3e0716', '#5e0c20', '#821430', '#a82242', '#c8405a']
  const AMARRA = 250
  const largura = (y) =>
    y < AMARRA ? 24 + 44 * Math.pow(Math.cos(((y / AMARRA) * Math.PI) / 2), 0.9) : 24 + 30 * Math.pow((y - AMARRA) / (BEIRA_Y - AMARRA), 0.75)
  const DOBRAS = 5
  for (let y = 0; y < BEIRA_Y + 4; y++) {
    const w = Math.round(largura(y))
    for (let i = 0; i < w; i++) {
      const u = (i / w) * DOBRAS
      const f = u - Math.floor(u)
      // luz da dobra: sobe rápido, passa do pico e cai devagar até a sombra da próxima
      let luz = f < 0.3 ? f / 0.3 : 1 - (f - 0.3) / 0.7
      luz = luz * 0.85 + (1 - i / w) * 0.15 // mais escuro na parte de dentro
      let tom = luz * 4.6
      tom += ((i + y) % 2 ? 0.25 : -0.25) // dither do veludo
      const k = Math.max(0, Math.min(TONS.length - 1, Math.floor(tom)))
      ctx.fillStyle = TONS[k]
      ctx.fillRect(lado ? LARGURA - 1 - i : i, y, 1, 1)
    }
    // barra dourada na beirada de dentro
    const xb = lado ? LARGURA - w : w - 2
    ret(ctx, '#7a5410', xb, y, 2, 1)
    ret(ctx, '#e0b040', lado ? xb : xb + 1, y, 1, 1)
  }
  // abraçadeira (corda dourada enrolada) e a borla pendurada
  const w = Math.round(largura(AMARRA))
  const xa = lado ? LARGURA - w - 3 : 0
  for (let k = 0; k < w + 3; k += 2) {
    ret(ctx, '#e0b040', xa + k, AMARRA - 3 + (k % 4 === 0 ? 0 : 1), 2, 2)
    ret(ctx, '#8a6014', xa + k, AMARRA - 1 + (k % 4 === 0 ? 0 : 1), 2, 2)
  }
  const xt = lado ? LARGURA - w - 2 : w - 1
  ret(ctx, '#c08a20', xt - 1, AMARRA, 3, 6)
  ret(ctx, '#e0b040', xt - 3, AMARRA + 6, 7, 3)
  for (let k = 0; k < 7; k++) ret(ctx, k % 2 ? '#8a6014' : '#e0b040', xt - 3 + k, AMARRA + 9, 1, 9 + (k % 3))
}

// bambolina: as "ondas" de veludo no alto do palco, com franja dourada embaixo
function desenharBambolina(ctx) {
  const TONS = ['#2a040e', '#4a0a1a', '#6a1026', '#8e1a34']
  const ONDA = 64
  for (let x = 0; x < LARGURA; x++) {
    const f = (x % ONDA) / ONDA
    const fundo = Math.round(22 + 9 * Math.sin(f * Math.PI)) // a onda pende no meio
    for (let y = 0; y < fundo; y++) {
      // dobras horizontais em arco (seguem a onda)
      const v = (y / fundo) * 3
      const g = v - Math.floor(v)
      let tom = (g < 0.4 ? g / 0.4 : 1 - (g - 0.4) / 0.6) * 3.4 + ((x + y) % 2 ? 0.2 : -0.2)
      ctx.fillStyle = TONS[Math.max(0, Math.min(3, Math.floor(tom)))]
      ctx.fillRect(x, y, 1, 1)
    }
    // franja: fiozinhos dourados de tamanhos alternados
    ret(ctx, '#e0b040', x, fundo, 1, 1)
    ret(ctx, x % 2 ? '#8a6014' : '#c08a20', x, fundo + 1, 1, x % 3 === 0 ? 4 : 3)
  }
}

// ----- texturas pequenas -----

// cone de luz branco (pintado com setTint): estreito em cima, forte perto da
// lente e sumindo até o chão; bordas suaves
function desenharFeixe(ctx, w, h) {
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    const meia = 2 + (y / h) * (w / 2 - 2)
    const queda = Math.pow(1 - y / h, 0.7) * 0.9 + 0.1
    for (let x = 0; x < w; x++) {
      const d = Math.abs(x + 0.5 - w / 2) / meia
      if (d > 1) continue
      const borda = Math.pow(1 - d, 0.6)
      const i = (y * w + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
      img.data[i + 3] = Math.round(255 * queda * borda)
    }
  }
  ctx.putImageData(img, 0, 0)
}

function desenharBrilho(ctx, w, h) {
  const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
}

function desenharNeblina(ctx, w, h) {
  // três bolhas macias juntas (fumaça)
  for (const [cx, cy, r] of [
    [40, 36, 26],
    [70, 30, 30],
    [96, 38, 22],
  ]) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, 'rgba(255,255,255,0.8)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  }
}

// silhuetas da plateia (brancas, pintadas com setTint): cabeça e ombros,
// cabelo/boné variando, e braços levantados (celular, isqueiro, os dois)
function desenharPessoa(ctx, variante) {
  const cor = '#ffffff'
  // ombros e tronco
  ctx.fillStyle = cor
  for (let y = 30; y < 56; y++) {
    const meia = Math.min(13, 6 + (y - 30) * 1.6)
    ctx.fillRect(Math.round(16 - meia), y, Math.round(meia * 2), 1)
  }
  ret(ctx, cor, 13, 25, 6, 6) // pescoço
  circulo(ctx, cor, 16, 20, 7) // cabeça
  if (variante === 1) {
    circulo(ctx, cor, 16, 12, 4) // coque
  } else if (variante === 4) {
    ret(ctx, cor, 8, 14, 16, 3) // boné
    ret(ctx, cor, 20, 15, 8, 2)
  } else if (variante === 0) {
    ret(ctx, cor, 8, 17, 3, 12) // cabelo comprido
    ret(ctx, cor, 21, 17, 3, 12)
  }
  const braco = (x0, y0, x1, y1) => {
    for (let k = 0; k <= 20; k++) {
      const x = x0 + ((x1 - x0) * k) / 20
      const y = y0 + ((y1 - y0) * k) / 20
      ctx.fillRect(Math.round(x - 1.5), Math.round(y - 1.5), 3, 3)
    }
    circulo(ctx, cor, x1, y1, 2)
  }
  ctx.fillStyle = cor
  if (variante === 2) braco(6, 34, 5, 6)
  if (variante === 5) braco(26, 34, 27, 6)
  if (variante === 3) {
    braco(6, 34, 1, 8)
    ctx.fillStyle = cor
    braco(26, 34, 31, 8)
  }
}
