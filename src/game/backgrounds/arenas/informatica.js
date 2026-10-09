import Phaser from 'phaser'
import { LARGURA, ALTURA } from '../../constants.js'

// SALA DE INFORMÁTICA: o laboratório da escola à noite, visto do fundo da sala.
// Fileiras de mesas com monitores de tubo (CRT) em perspectiva, um corredor no
// meio (bem na costura do tabuleiro) que leva até a janela com a lua, gabinetes
// embaixo das mesas com LEDs piscando, cadeiras, cabos no chão e a luz fria
// das telas batendo nas mesas. Cada tela roda um protetor de tela diferente
// (estrelas, labirinto, logo quicando, canos, código verde subindo, prompt).
//
// Tudo em pixel art: a sala parada é desenhada UMA vez num canvas de 320x240
// (um pixel da arte = 2 px do jogo), sem antialias (polígonos preenchidos
// linha a linha), e vira a textura 'arena-informatica-sala'. Por cima, uma
// Graphics redesenha só o que mexe (telas, LEDs, estrelas, nuvem) a ~15 FPS
// (cara de monitor velho e quase nada de custo), e brilhos suaves (ADD) das
// telas respiram com o tremor do tubo.
// O que fica atrás das caixas (y 56-141 da arte) é parede e mesa escura;
// o que aparece de verdade é a faixa de cima, o corredor com a janela e as
// fileiras de baixo. Nada de brilho forte: telas em tons médios.

const P = 2 // px do jogo por pixel da arte
const W = LARGURA / P
const H = ALTURA / P
const FUGA = { x: 160, y: 96 } // ponto de fuga (altura do olho)
const PAREDE = { x0: 64, x1: 256, y0: 18, y1: 116 } // parede do fundo
const JANELA = { x0: 134, x1: 186, y0: 34, y1: 92 }
const LUA = { x: 171, y: 50, r: 7 }
const QUADRO_MS = 1000 / 15 // as telas atualizam a 15 FPS

// Fileiras (de trás para a frente): y do tampo da mesa (borda da frente) e os
// protetores de tela de cada monitor, do corredor para fora
const FILEIRAS = [
  { y: 122, esq: ['off', 'estrelas', 'off', 'logo'], dir: ['prompt', 'off', 'estrelas', 'off'] },
  { y: 168, esq: ['labirinto', 'estrelas', 'codigo', 'off'], dir: ['logo', 'canos', 'off', 'estrelas'] },
  { y: 236, esq: ['codigo', 'logo', 'canos'], dir: ['estrelas', 'labirinto', 'prompt'] },
]

// Paleta (noite, tudo puxado para o azul; as telas é que dão cor)
const C = {
  teto: '#070b14',
  tetoLinha: '#0c1424',
  paredeAlto: '#0c1626',
  paredeBaixo: '#122036',
  rodape: '#0a1220',
  lateral: '#09111e',
  lateralClara: '#0e192b',
  piso1: '#0b1421',
  piso2: '#0e1929',
  pisoLinha: '#0a111c',
  ceu1: '#0a1630',
  ceu2: '#14284a',
  ceu3: '#1f3a5e',
  moldura: '#3a4e6a',
  molduraClara: '#56708f',
  cidade: '#070e1c',
  cidade2: '#0b1528',
  janelinha: '#c8a048',
  lua: '#e4ecf6',
  luaSombra: '#b4c4d8',
  luaCratera: '#c6d2e2',
  tampo: '#26344a',
  tampoClaro: '#33445e',
  tampoBorda: '#46597a',
  embaixo: '#060a12',
  perna: '#1a2434',
  caixa: '#364254',
  caixaClara: '#465469',
  caixaTopo: '#3d4a5e',
  caixaEscura: '#262f3e',
  caixaLado: '#1f2836',
  moldTela: '#1b222e',
  telaOff: '#0c1418',
  teclado: '#3e4c60',
  tecladoClaro: '#56667e',
  gabinete: '#323c4c',
  gabineteClaro: '#46536a',
  gabineteEscuro: '#1e2632',
  cadeira: '#141c2a',
  cadeiraClara: '#24324a',
  cabo: '#05080e',
  caboAzul: '#1c3c66',
  quadro: '#c8d2dc',
  quadroBorda: '#5a6878',
  relogio: '#d8dee6',
  saida: '#3cff7a',
  ar: '#2c3a4e',
  cartaz: '#c86a3a',
}

// fonte 3x5 para os letreiros da sala
const LETRAS = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  I: '111010010010111', L: '100100100100111', N: '101111111111101', O: '010101101101010', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', X: '101101010101101', 3: '111001011001111',
  ':': '000010000010000', '>': '100010001010100', '\\': '100100010001001', ' ': '000000000000000', _: '000000000000111',
}

// ---------- canvas da arte (pixels inteiros, sem antialias) ----------

function tela(largura, altura) {
  const c = document.createElement('canvas')
  c.width = largura
  c.height = altura
  const g = c.getContext('2d')
  g.imageSmoothingEnabled = false
  return [c, g]
}

const ret = (g, x, y, w, h, cor) => {
  g.fillStyle = cor
  g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
}

// Polígono convexo preenchido linha a linha (borda dura, cara de pixel art)
function poligono(g, pts, cor) {
  g.fillStyle = cor
  const ys = pts.map((p) => p.y)
  const y0 = Math.max(0, Math.floor(Math.min(...ys)))
  const y1 = Math.min(H * 4, Math.ceil(Math.max(...ys)))
  for (let y = y0; y < y1; y++) {
    const yc = y + 0.5
    let a = Infinity
    let b = -Infinity
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const q = pts[(i + 1) % pts.length]
      if ((p.y <= yc && q.y > yc) || (q.y <= yc && p.y > yc)) {
        const x = p.x + ((yc - p.y) / (q.y - p.y)) * (q.x - p.x)
        a = Math.min(a, x)
        b = Math.max(b, x)
      }
    }
    if (b > a) g.fillRect(Math.round(a), y, Math.max(1, Math.round(b) - Math.round(a)), 1)
  }
}

// Linha de pixels (Bresenham simples)
function linha(g, x0, y0, x1, y1, cor) {
  g.fillStyle = cor
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1)
}

// Curva (Bézier quadrática) de pixels, com espessura
function curva(g, a, b, c, cor, grossura = 1) {
  g.fillStyle = cor
  const n = Math.ceil(Math.hypot(c.x - a.x, c.y - a.y) * 1.5) + 4
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * b.x + t ** 2 * c.x
    const y = (1 - t) ** 2 * a.y + 2 * (1 - t) * t * b.y + t ** 2 * c.y
    g.fillRect(Math.round(x), Math.round(y), grossura, grossura)
  }
}

function escrever(g, texto, x, y, cor) {
  g.fillStyle = cor
  ;[...texto].forEach((ch, i) => {
    const mapa = LETRAS[ch] ?? LETRAS[' ']
    for (let k = 0; k < 15; k++) if (mapa[k] === '1') g.fillRect(x + i * 4 + (k % 3), y + Math.floor(k / 3), 1, 1)
  })
}

// ponto (x, y) levado `k` do caminho até o ponto de fuga (k = 0: fica; 1: vira o ponto de fuga)
const fugir = (x, y, k) => ({ x: x + (FUGA.x - x) * k, y: y + (FUGA.y - y) * k })

// escala de uma fileira pela altura do tampo (1 = fileira do meio)
const escalaEm = (y) => (y - FUGA.y) / 58
// meia largura do corredor do meio na altura y
const corredor = (y) => 5 + (y - FUGA.y) * 0.3

// Monitores (posição na arte) de uma fileira, do corredor para fora
function monitoresDa(fileira) {
  const s = escalaEm(fileira.y)
  const lista = []
  for (const lado of ['esq', 'dir']) {
    const sinal = lado === 'esq' ? -1 : 1
    fileira[lado].forEach((tipo, k) => {
      const cx = FUGA.x + sinal * (corredor(fileira.y) + 5 * s + 14 * s + k * 36 * s)
      const w = Math.round(26 * s)
      const h = Math.round(22 * s)
      const x = Math.round(cx - w / 2)
      const y = Math.round(fileira.y - 5 * s - h)
      const m = Math.max(2, Math.round(3 * s)) // moldura em volta do vidro
      lista.push({ tipo, s, lado, x, y, w, h, tela: { x: x + m, y: y + m, w: w - m * 2, h: h - m * 2 - Math.round(s) } })
    })
  }
  return lista
}

// ---------- a sala parada ----------

function desenharSala(g, leds) {
  // teto e parede lateral (o fundo inteiro, por baixo de tudo)
  ret(g, 0, 0, W, H, C.lateral)
  poligono(g, [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: PAREDE.x1, y: PAREDE.y0 }, { x: PAREDE.x0, y: PAREDE.y0 }], C.teto)
  // luminárias apagadas no teto (em perspectiva)
  for (const [k, larg] of [[0.25, 30], [0.55, 44]]) {
    for (const lado of [-1, 1]) {
      const cx = FUGA.x + lado * (40 + (1 - k) * 30)
      ret(g, cx - larg / 2, Math.round(PAREDE.y0 - 6 - k * 10), larg, 2 + Math.round(k * 2), C.tetoLinha)
      ret(g, cx - larg / 2 + 1, Math.round(PAREDE.y0 - 6 - k * 10), larg - 2, 1, '#121c2e')
    }
  }
  // paredes laterais (um tom acima, com rodapé seguindo a perspectiva)
  poligono(g, [{ x: 0, y: -40 }, { x: PAREDE.x0, y: PAREDE.y0 }, { x: PAREDE.x0, y: PAREDE.y1 }, { x: 0, y: PAREDE.y1 + 14 }], C.lateralClara)
  poligono(g, [{ x: W, y: -40 }, { x: PAREDE.x1, y: PAREDE.y0 }, { x: PAREDE.x1, y: PAREDE.y1 }, { x: W, y: PAREDE.y1 + 14 }], C.lateralClara)
  // ar-condicionado na lateral esquerda e porta + SAÍDA na direita
  poligono(g, [{ x: 16, y: 38 }, { x: 46, y: 41 }, { x: 46, y: 50 }, { x: 16, y: 50 }], C.ar)
  linha(g, 18, 47, 44, 48, '#1c2636')
  ret(g, 42, 43, 2, 1, '#3cff7a')
  poligono(g, [{ x: 280, y: 50 }, { x: 300, y: 47 }, { x: 300, y: 124 }, { x: 280, y: 121 }], '#0a1424')
  poligono(g, [{ x: 282, y: 52 }, { x: 298, y: 50 }, { x: 298, y: 122 }, { x: 282, y: 119 }], '#14223a')
  ret(g, 284, 88, 2, 3, '#56708f')
  ret(g, 279, 37, 23, 9, '#0c2a18')
  escrever(g, 'SAIDA', 280, 39, C.saida)

  // parede do fundo: degradê em faixas + rodapé
  for (let y = PAREDE.y0; y < PAREDE.y1; y++) {
    const k = (y - PAREDE.y0) / (PAREDE.y1 - PAREDE.y0)
    ret(g, PAREDE.x0, y, PAREDE.x1 - PAREDE.x0, 1, k < 0.5 ? C.paredeAlto : C.paredeBaixo)
  }
  ret(g, PAREDE.x0, PAREDE.y1 - 3, PAREDE.x1 - PAREDE.x0, 3, C.rodape)
  // quadro branco à esquerda (com rabiscos) e relógio à direita da janela
  ret(g, 76, 38, 52, 34, C.quadroBorda)
  ret(g, 77, 39, 50, 32, '#8e9aa8')
  ret(g, 77, 39, 50, 1, '#a8b4c0')
  linha(g, 81, 44, 97, 44, '#3a6aa8')
  linha(g, 81, 48, 104, 48, '#3a6aa8')
  linha(g, 81, 52, 92, 52, '#a83a3a')
  escrever(g, 'LAB 3', 100, 42, '#2a3a5a')
  ret(g, 76, 72, 52, 2, '#3a4656')
  ret(g, 214, 38, 15, 15, '#1a2434')
  ret(g, 215, 39, 13, 13, C.relogio)
  ret(g, 221, 41, 1, 5, '#202838')
  ret(g, 221, 45, 4, 1, '#202838')
  ret(g, 238, 44, 12, 16, C.cartaz)
  ret(g, 239, 45, 10, 6, '#e8c890')
  ret(g, 240, 53, 8, 1, '#5a2a18')
  ret(g, 240, 56, 6, 1, '#5a2a18')

  // janela: céu em faixas, estrelas fixas, lua, cidade e moldura
  const jw = JANELA.x1 - JANELA.x0
  const jh = JANELA.y1 - JANELA.y0
  for (let y = 0; y < jh; y++) {
    const k = y / jh
    ret(g, JANELA.x0, JANELA.y0 + y, jw, 1, k < 0.45 ? C.ceu1 : k < 0.78 ? C.ceu2 : C.ceu3)
  }
  // halo da lua (anéis duros em tons do céu)
  for (const [r, cor] of [[16, '#16294a'], [12, '#1d3558'], [9, '#2a4670']]) {
    for (let dy = -r; dy <= r; dy++) {
      const dx = Math.floor(Math.sqrt(r * r - dy * dy))
      const y = LUA.y + dy
      if (y < JANELA.y0 || y >= JANELA.y1) continue
      const a = Math.max(JANELA.x0, LUA.x - dx)
      const b = Math.min(JANELA.x1, LUA.x + dx + 1)
      if (b > a) ret(g, a, y, b - a, 1, cor)
    }
  }
  for (let dy = -LUA.r; dy <= LUA.r; dy++) {
    const dx = Math.floor(Math.sqrt(LUA.r * LUA.r - dy * dy))
    ret(g, LUA.x - dx, LUA.y + dy, dx * 2 + 1, 1, C.lua)
    if (dx > 1) ret(g, LUA.x + dx - 2, LUA.y + dy, 2, 1, C.luaSombra)
  }
  ret(g, LUA.x - 3, LUA.y - 2, 2, 2, C.luaCratera)
  ret(g, LUA.x + 1, LUA.y + 2, 3, 2, C.luaCratera)
  ret(g, LUA.x - 1, LUA.y + 4, 1, 1, C.luaCratera)
  // cidade lá fora: prédios em duas camadas, janelinhas acesas
  const predios = [[134, 80], [140, 74], [147, 78], [152, 70], [158, 76], [165, 72], [171, 79], [177, 68], [182, 75]]
  predios.forEach(([x, topo]) => ret(g, x, topo + 4, 7, JANELA.y1 - topo - 4, C.cidade2))
  const perto = [[134, 84], [143, 82], [151, 86], [160, 81], [168, 85], [176, 83], [183, 86]]
  perto.forEach(([x, topo]) => ret(g, x, topo, 9, JANELA.y1 - topo, C.cidade))
  for (const [x, y] of [[142, 80], [155, 75], [156, 79], [179, 72], [184, 79], [167, 76], [145, 86], [162, 84]]) ret(g, x, y, 1, 1, C.janelinha)
  // moldura: borda, cruzeta, peitoril com um cacto
  ret(g, JANELA.x0 - 2, JANELA.y0 - 2, jw + 4, 2, C.molduraClara)
  ret(g, JANELA.x0 - 2, JANELA.y0, 2, jh, C.moldura)
  ret(g, JANELA.x1, JANELA.y0, 2, jh, C.moldura)
  ret(g, JANELA.x0 + jw / 2 - 1, JANELA.y0, 2, jh, C.moldura)
  ret(g, JANELA.x0, JANELA.y0 + 30, jw, 2, C.moldura)
  ret(g, JANELA.x0 - 4, JANELA.y1, jw + 8, 2, C.molduraClara)
  ret(g, JANELA.x0 - 3, JANELA.y1 + 2, jw + 6, 1, '#24324a')
  ret(g, 140, JANELA.y1 - 4, 4, 4, '#7a4a30')
  ret(g, 141, JANELA.y1 - 9, 2, 5, '#2f6a3e')
  ret(g, 140, JANELA.y1 - 7, 1, 2, '#2f6a3e')
  // persiana meio abaixada (lâminas)
  for (let y = JANELA.y0; y < JANELA.y0 + 9; y += 2) ret(g, JANELA.x0, y, jw, 1, '#3e5272')
  ret(g, JANELA.x0, JANELA.y0 + 9, jw, 1, '#56708f')

  // piso: lajotas em perspectiva (faixas cada vez mais largas + linhas até o fundo)
  const topoPiso = PAREDE.y1
  poligono(g, [{ x: PAREDE.x0, y: topoPiso }, { x: PAREDE.x1, y: topoPiso }, { x: W + 400, y: H }, { x: -400, y: H }], C.piso1)
  let par = false
  for (let y = topoPiso, passo = 2; y < H; y += passo, passo = Math.min(18, passo * 1.32)) {
    if (par) ret(g, 0, Math.round(y), W, Math.round(passo), C.piso2)
    ret(g, 0, Math.round(y), W, 1, C.pisoLinha)
    par = !par
  }
  for (let k = -12; k <= 12; k++) linha(g, FUGA.x + k * 9, topoPiso, FUGA.x + k * 52, H, C.pisoLinha)
  // as laterais cobrem o piso fora da parede do fundo
  poligono(g, [{ x: 0, y: PAREDE.y1 + 14 }, { x: PAREDE.x0, y: PAREDE.y1 }, { x: 0, y: PAREDE.y1 }], C.lateralClara)
  poligono(g, [{ x: W, y: PAREDE.y1 + 14 }, { x: PAREDE.x1, y: PAREDE.y1 }, { x: W, y: PAREDE.y1 }], C.lateralClara)
  linha(g, 0, PAREDE.y1 + 14, PAREDE.x0, PAREDE.y1, C.rodape)
  linha(g, W, PAREDE.y1 + 14, PAREDE.x1, PAREDE.y1, C.rodape)

  // luar entrando pela janela e caindo no corredor (bem fraquinho)
  poligono(g, [{ x: JANELA.x0, y: JANELA.y1 + 3 }, { x: JANELA.x1, y: JANELA.y1 + 3 }, { x: 214, y: 150 }, { x: 118, y: 150 }], '#101e32')

  // fileiras de mesas (de trás para a frente: as da frente cobrem as de trás)
  const monitores = []
  FILEIRAS.forEach((f, i) => {
    // cabos atravessando o chão logo atrás da fileira da frente
    if (i === 2) {
      curva(g, { x: 40, y: 192 }, { x: 110, y: 214 }, { x: 150, y: 200 }, C.cabo, 2)
      curva(g, { x: 150, y: 200 }, { x: 175, y: 192 }, { x: 214, y: 198 }, C.cabo, 2)
      curva(g, { x: 190, y: 186 }, { x: 240, y: 206 }, { x: 300, y: 194 }, C.caboAzul, 1)
      curva(g, { x: 92, y: 188 }, { x: 128, y: 196 }, { x: 140, y: 214 }, C.caboAzul, 1)
      ret(g, 148, 198, 4, 3, '#2a3444') // filtro de linha no meio do caminho
      ret(g, 149, 199, 1, 1, '#ff5040')
    }
    desenharFileira(g, f, monitores, leds)
  })
  return monitores
}

function desenharFileira(g, f, monitores, leds) {
  const s = escalaEm(f.y)
  const fundo = Math.round(9 * s) // profundidade visível do tampo
  const altura = Math.round(17 * s) // da borda do tampo até o chão
  const lista = monitoresDa(f)
  for (const lado of ['esq', 'dir']) {
    const meus = lista.filter((m) => m.lado === lado)
    const sinal = lado === 'esq' ? -1 : 1
    const dentro = FUGA.x + sinal * corredor(f.y) // ponta da mesa no corredor
    const fora = sinal < 0 ? -60 : W + 60
    const [a, b] = sinal < 0 ? [fora, dentro] : [dentro, fora]
    // embaixo da mesa (escuro), pernas e o tampo com a borda clara
    ret(g, a, f.y, b - a, altura, C.embaixo)
    const tras = fugir(dentro, f.y, fundo / (f.y - FUGA.y))
    poligono(g, [{ x: a, y: f.y - fundo }, { x: b, y: f.y - fundo }, { x: b, y: f.y }, { x: a, y: f.y }], C.tampo)
    // ponta do tampo no corredor (em perspectiva)
    poligono(g, sinal < 0 ? [{ x: tras.x, y: tras.y }, { x: dentro, y: f.y }, { x: dentro - 1, y: f.y }, { x: tras.x - 1, y: tras.y }] : [{ x: tras.x, y: tras.y }, { x: tras.x + 1, y: tras.y }, { x: dentro + 1, y: f.y }, { x: dentro, y: f.y }], C.tampoBorda)
    ret(g, a, f.y - fundo, b - a, 1, C.tampoClaro)
    ret(g, a, f.y, b - a, Math.max(1, Math.round(1.5 * s)), C.tampoBorda)
    ret(g, sinal < 0 ? dentro - Math.round(2 * s) : dentro, f.y, Math.round(2 * s), altura, C.perna)
    // de fora para dentro: o monitor do corredor cobre a lateral do vizinho
    for (const m of [...meus].reverse()) {
      // gabinete embaixo da mesa, com os LEDs virados para nós
      const gw = Math.round(9 * s)
      const gh = Math.round(13 * s)
      const gx = Math.round(m.x + m.w / 2 + sinal * -1 * (m.w / 2 - gw) - gw / 2 + sinal * 4 * s)
      const gy = f.y + altura - gh
      ret(g, gx, gy, gw, gh, C.gabinete)
      ret(g, gx, gy, gw, 1, C.gabineteClaro)
      ret(g, gx + 1, gy + Math.round(2 * s), gw - 2, Math.max(1, Math.round(s)), C.gabineteEscuro)
      ret(g, gx + 1, gy + Math.round(4 * s), gw - 2, Math.max(1, Math.round(s)), C.gabineteEscuro)
      leds.push({ x: gx + gw - 2, y: gy + gh - Math.round(3 * s), s, fase: (gx * 7 + gy * 3) % 11 })
      // cabo descendo do tampo até o gabinete
      linha(g, gx + gw / 2, f.y + 2, gx + gw / 2 + sinal * 2, gy, C.cabo)
      desenharMonitor(g, m, sinal)
      // teclado na frente do monitor (em cima do tampo)
      const tw = Math.round(m.w * 0.7)
      const ty = f.y - Math.round(3.5 * s)
      ret(g, m.x + (m.w - tw) / 2, ty, tw, Math.max(1, Math.round(2.2 * s)), C.teclado)
      ret(g, m.x + (m.w - tw) / 2, ty, tw, 1, C.tecladoClaro)
      // mouse ao lado
      ret(g, m.x + (m.w + tw) / 2 + Math.round(2 * s), ty, Math.max(1, Math.round(2 * s)), Math.max(1, Math.round(2 * s)), C.tecladoClaro)
      monitores.push(m)
    }
    // cadeiras na frente (de costas para nós) em alguns lugares, meio fora do lugar
    meus.forEach((m, k) => {
      if ((k + (lado === 'esq' ? 0 : 1)) % 2) return
      const cw = Math.round(15 * s)
      const ch = Math.round(11 * s)
      const cx = m.x + m.w / 2 - cw / 2 + (k % 3 - 1) * 3 * s
      const cy = f.y + Math.round(4 * s)
      ret(g, cx + cw / 2 - s, cy + ch, Math.max(1, 2 * s), Math.round(4 * s), C.cadeira)
      ret(g, cx, cy, cw, ch, C.cadeira)
      ret(g, cx + 1, cy, cw - 2, 1, C.cadeiraClara)
      ret(g, cx, cy + 1, 1, ch - 2, C.cadeiraClara)
    })
  }
}

function desenharMonitor(g, m, sinal) {
  const { x, y, w, h, s, tela } = m
  // laterais/topo do tubo indo para o fundo (dão a profundidade)
  const k = 0.16
  const t0 = fugir(x, y, k)
  const t1 = fugir(x + w, y, k)
  poligono(g, [t0, t1, { x: x + w, y }, { x, y }], C.caixaTopo)
  const borda = sinal < 0 ? x + w : x
  const b0 = fugir(borda, y, k)
  const b1 = fugir(borda, y + h, k)
  poligono(g, sinal < 0 ? [{ x: borda, y }, b0, b1, { x: borda, y: y + h }] : [b0, { x: borda, y }, { x: borda, y: y + h }, b1], C.caixaLado)
  // frente: corpo bege-azulado (é noite), sombra embaixo, moldura funda do vidro
  ret(g, x, y, w, h, C.caixa)
  ret(g, x, y, w, 1, C.caixaClara)
  ret(g, x, y + h - Math.max(1, Math.round(2 * s)), w, Math.max(1, Math.round(2 * s)), C.caixaEscura)
  ret(g, tela.x - 1, tela.y - 1, tela.w + 2, tela.h + 2, C.moldTela)
  ret(g, tela.x, tela.y, tela.w, tela.h, C.telaOff)
  // botão de ligar + LED na moldura de baixo
  ret(g, x + w - Math.round(4 * s), y + h - Math.max(2, Math.round(2.5 * s)), Math.max(1, Math.round(1.5 * s)), 1, C.caixaEscura)
  // pé
  const pw = Math.round(w * 0.45)
  ret(g, x + (w - pw) / 2, y + h, pw, Math.max(1, Math.round(2 * s)), C.caixaEscura)
}

// ---------- texturas ----------

// desenhada uma vez por jogo: as listas de monitores e LEDs ficam guardadas junto
let sala = null
function texturaSala(scene) {
  const chave = 'arena-informatica-sala'
  if (!sala || !scene.textures.exists(chave)) {
    const leds = []
    const [c, g] = tela(W, H)
    const monitores = desenharSala(g, leds)
    if (scene.textures.exists(chave)) scene.textures.remove(chave)
    scene.textures.addCanvas(chave, c)
    sala = { chave, monitores, leds }
  }
  return sala
}

// Brilho redondo suave (luz das telas): borda macia, filtro LINEAR
function texturaBrilho(scene) {
  const chave = 'arena-informatica-brilho'
  if (scene.textures.exists(chave)) return chave
  const [c, g] = tela(64, 64)
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.35)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  scene.textures.addCanvas(chave, c)
  scene.textures.get(chave).setFilter(Phaser.Textures.FilterMode.LINEAR)
  return chave
}

// cor de cada protetor de tela (a luz que ele joga na mesa)
const LUZ = { estrelas: 0x6a9cff, labirinto: 0xc86a4a, logo: 0x9a6aff, canos: 0x4ac8a0, codigo: 0x3cff7a, prompt: 0x9ab0c8 }

// pseudo-aleatório repetível (o mesmo fundo todo jogo)
const ruido = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export default function informatica(scene, objetos) {
  const add = (o) => {
    objetos.push(o)
    return o.setDepth(-10)
  }
  const { chave, monitores, leds } = texturaSala(scene)
  add(scene.add.image(0, 0, chave).setOrigin(0).setScale(P))

  // luz fria das telas ligadas batendo no tampo da mesa (respira com o tubo)
  const brilho = texturaBrilho(scene)
  const ligados = monitores.filter((m) => m.tipo !== 'off')
  const luzes = ligados.map((m, i) => {
    const img = add(scene.add.image((m.x + m.w / 2) * P, (m.y + m.h) * P, brilho))
    img.setDisplaySize(m.w * P * 2.2, m.h * P * 1.3).setTint(LUZ[m.tipo]).setBlendMode(Phaser.BlendModes.ADD)
    return { img, base: 0.16, fase: i * 1.7 }
  })
  // luar no corredor (faixa clara bem fraca, respirando devagar)
  // a placa de SAÍDA e a lua acesas de leve
  add(scene.add.image(290 * P, 41 * P, brilho).setDisplaySize(60 * P, 26 * P).setTint(0x3cff7a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.14))
  add(scene.add.image(LUA.x * P, LUA.y * P, brilho).setDisplaySize(44 * P, 44 * P).setTint(0xbcd4ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.12))
  const luar = add(scene.add.image(160 * P, 128 * P, brilho).setDisplaySize(110 * P, 60 * P).setTint(0x8fb4ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.08))

  const g = add(scene.add.graphics())
  // estado de cada protetor de tela
  const telas = monitores.map((m, i) => {
    const t = m.tela
    const est = { m, t, semente: i * 13.7 }
    if (m.tipo === 'estrelas') est.pontos = Array.from({ length: Math.round(6 + t.w * 0.4) }, (_, k) => ({ a: ruido(i * 50 + k) * Math.PI * 2, d: ruido(i * 70 + k), v: 0.3 + ruido(i * 90 + k) * 0.7 }))
    if (m.tipo === 'logo') Object.assign(est, { x: ruido(i) * (t.w - 6), y: ruido(i + 3) * (t.h - 3), vx: 9 + ruido(i + 5) * 5, vy: 6 + ruido(i + 7) * 4, cor: 0 })
    if (m.tipo === 'canos') est.canos = []
    return est
  })
  const CORES_LOGO = [0xff5a8a, 0x5ad8ff, 0xffd84a, 0x7aff6a, 0xb07aff]
  const CORES_CANO = [0x4ac8a0, 0xd8a040, 0x5a8aff, 0xd85a5a]
  const estrelasJanela = Array.from({ length: 10 }, (_, k) => ({
    x: JANELA.x0 + 2 + Math.floor(ruido(k * 3) * (JANELA.x1 - JANELA.x0 - 4)),
    y: JANELA.y0 + 10 + Math.floor(ruido(k * 5 + 1) * 26),
    fase: ruido(k * 7) * 6,
  })).filter((e) => Math.hypot(e.x - LUA.x, e.y - LUA.y) > 13 && Math.abs(e.x - (JANELA.x0 + 25)) > 1)

  // pixel da arte -> retângulo no jogo
  const px = (x, y, w, h, cor, a = 1) => {
    g.fillStyle(cor, a)
    g.fillRect(Math.round(x) * P, Math.round(y) * P, Math.max(1, Math.round(w)) * P, Math.max(1, Math.round(h)) * P)
  }
  // dentro do vidro (recorta na tela do monitor)
  const pxTela = (t, x, y, w, h, cor, a = 1) => {
    const x0 = Math.max(t.x, Math.round(x))
    const y0 = Math.max(t.y, Math.round(y))
    const x1 = Math.min(t.x + t.w, Math.round(x + w))
    const y1 = Math.min(t.y + t.h, Math.round(y + h))
    if (x1 > x0 && y1 > y0) px(x0, y0, x1 - x0, y1 - y0, cor, a)
  }

  const desenharTela = (e, seg, dt) => {
    const { t, m } = e
    switch (m.tipo) {
      case 'off': {
        // desligado: só o LED de espera laranja na moldura
        px(m.x + m.w - Math.round(2.5 * m.s), m.y + m.h - Math.max(2, Math.round(2.5 * m.s)), 1, 1, 0xff9a3a, 0.5 + 0.5 * Math.sin(seg * 2 + e.semente))
        return
      }
      case 'estrelas': {
        px(t.x, t.y, t.w, t.h, 0x02040c)
        const cx = t.x + t.w / 2
        const cy = t.y + t.h / 2
        for (const p of e.pontos) {
          p.d += (p.v * dt) / 2600 * (0.4 + p.d)
          if (p.d > 1) {
            p.d = 0.02
            p.a = ruido(seg * 10 + p.a) * Math.PI * 2
          }
          const x = cx + Math.cos(p.a) * p.d * t.w * 0.6
          const y = cy + Math.sin(p.a) * p.d * t.h * 0.6
          pxTela(t, x, y, 1, 1, p.d > 0.55 ? 0xffffff : 0x8fb4ff)
        }
        return
      }
      case 'labirinto': {
        // corredor de tijolos indo para a frente (o labirinto 3D de sempre)
        px(t.x, t.y, t.w, t.h, 0x1a0c08)
        const cx = t.x + t.w / 2
        const cy = t.y + t.h / 2
        const fase = (seg * 0.6) % 1
        for (let k = 4; k >= 0; k--) {
          const f = Math.min(1, (k + fase) / 4.4) ** 1.6
          const w = Math.max(2, t.w * f)
          const h = Math.max(1, t.h * f)
          const cor = k % 2 ? 0x9a4a2a : 0x6a2e1c
          pxTela(t, cx - w / 2, cy - h / 2, w, h, cor)
          pxTela(t, cx - w / 2 + 1, cy - h / 2 + 1, w - 2, Math.max(1, h * 0.12), 0x24120c)
        }
        pxTela(t, cx - 1, cy - 1, 2, 2, 0x0a0404)
        return
      }
      case 'logo': {
        px(t.x, t.y, t.w, t.h, 0x04020a)
        const lw = Math.max(4, Math.round(t.w * 0.32))
        const lh = Math.max(2, Math.round(t.h * 0.24))
        e.x += (e.vx * dt) / 1000
        e.y += (e.vy * dt) / 1000
        let bateu = false
        if (e.x < 0 || e.x > t.w - lw) {
          e.vx *= -1
          e.x = Phaser.Math.Clamp(e.x, 0, t.w - lw)
          bateu = true
        }
        if (e.y < 0 || e.y > t.h - lh) {
          e.vy *= -1
          e.y = Phaser.Math.Clamp(e.y, 0, t.h - lh)
          bateu = true
        }
        if (bateu) e.cor = (e.cor + 1) % CORES_LOGO.length
        const cor = CORES_LOGO[e.cor]
        pxTela(t, t.x + e.x, t.y + e.y, lw, lh, cor)
        pxTela(t, t.x + e.x + 1, t.y + e.y + lh / 2, lw - 2, 1, 0x04020a, 0.7)
        return
      }
      case 'canos': {
        // canos 3D crescendo em ângulos retos; encheu, limpa e recomeça
        px(t.x, t.y, t.w, t.h, 0x020608)
        e.passo = (e.passo ?? 0) + dt
        while (e.passo > 90) {
          e.passo -= 90
          let cano = e.canos[e.canos.length - 1]
          if (!cano || cano.pontos.length > 14 || ruido(seg * 3 + e.canos.length) < 0.06) {
            if (e.canos.length >= 4) e.canos = []
            cano = { cor: CORES_CANO[e.canos.length % CORES_CANO.length], pontos: [{ x: Math.floor(ruido(seg + e.semente) * t.w), y: Math.floor(ruido(seg * 2 + e.semente) * t.h) }], dir: 0 }
            e.canos.push(cano)
          }
          const ult = cano.pontos[cano.pontos.length - 1]
          if (ruido(seg * 7 + cano.pontos.length + e.semente) < 0.35) cano.dir = (cano.dir + (ruido(seg * 11 + e.semente) < 0.5 ? 1 : 3)) % 4
          const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][cano.dir]
          const novo = { x: Phaser.Math.Clamp(ult.x + dx, 0, t.w - 1), y: Phaser.Math.Clamp(ult.y + dy, 0, t.h - 1) }
          if (novo.x === ult.x && novo.y === ult.y) cano.dir = (cano.dir + 2) % 4
          cano.pontos.push(novo)
        }
        for (const cano of e.canos) for (const p of cano.pontos) pxTela(t, t.x + p.x, t.y + p.y, 1, 1, cano.cor)
        return
      }
      case 'codigo': {
        // código verde subindo (linhas de "letras" de comprimentos variados)
        px(t.x, t.y, t.w, t.h, 0x020a04)
        const linhas = Math.floor(t.h / 2)
        const rolagem = seg * 5
        const base = Math.floor(rolagem)
        for (let k = 0; k <= linhas; k++) {
          const n = base + k
          const y = t.y + (k - (rolagem - base)) * 2
          const recuo = Math.floor(ruido(n * 1.3) * 3) * 2
          const largura = Math.floor(2 + ruido(n * 2.1) * (t.w - 4 - recuo))
          for (let x = 0; x < largura; x += 3) pxTela(t, t.x + 1 + recuo + x, y, Math.min(2, largura - x), 1, k === linhas - 1 ? 0xb0ffc8 : 0x3cff7a, 0.85)
        }
        // cursor piscando na última linha
        if (Math.floor(seg * 2.5) % 2) pxTela(t, t.x + 1, t.y + t.h - 2, 2, 1, 0xb0ffc8)
        return
      }
      case 'prompt': {
        px(t.x, t.y, t.w, t.h, 0x000000)
        if (t.w >= 20) {
          g.fillStyle(0xb8c8d8, 1)
          const texto = 'C:\\>'
          ;[...texto].forEach((ch, i) => {
            const mapa = LETRAS[ch]
            for (let k = 0; k < 15; k++) if (mapa[k] === '1') pxTela(t, t.x + 1 + i * 4 + (k % 3), t.y + 1 + Math.floor(k / 3), 1, 1, 0xb8c8d8)
          })
          if (Math.floor(seg * 2) % 2) pxTela(t, t.x + 17, t.y + 5, 3, 1, 0xb8c8d8)
        } else if (Math.floor(seg * 2) % 2) pxTela(t, t.x + 1, t.y + 1, 2, 1, 0xb8c8d8)
        return
      }
    }
  }

  let acumulado = QUADRO_MS
  return {
    atualizar(dt, estado) {
      const seg = estado.tempo / 1000
      // brilhos e luar: suave, todo frame
      for (const l of luzes) l.img.setAlpha(l.base + 0.035 * Math.sin(seg * 7 + l.fase) + 0.02 * Math.sin(seg * 31 + l.fase))
      luar.setAlpha(0.075 + 0.015 * Math.sin(seg * 0.5))
      acumulado += dt
      if (acumulado < QUADRO_MS) return
      const passo = Math.min(acumulado, 200)
      acumulado = 0
      g.clear()
      for (const e of telas) desenharTela(e, seg, passo)
      // linhas de varredura nas telas grandes (faixas escuras finas, 1 px do jogo)
      for (const e of telas) {
        if (e.m.tipo === 'off' || e.t.h < 18) continue
        g.fillStyle(0x000000, 0.28)
        for (let y = e.t.y * P + 1; y < (e.t.y + e.t.h) * P; y += 2) g.fillRect(e.t.x * P, y, e.t.w * P, 1)
        // reflexo do vidro no canto
        px(e.t.x + 1, e.t.y + 1, Math.round(e.t.w * 0.25), 1, 0xffffff, 0.12)
      }
      // LEDs dos gabinetes: verde fixo (ligado) + laranja do HD piscando quando quer
      for (const l of leds) {
        px(l.x, l.y, 1, 1, 0x3cff7a, 0.85)
        const hd = ruido(Math.floor(seg * 9) + l.fase * 31) < 0.35
        if (hd) px(l.x, l.y + Math.max(1, Math.round(l.s * 1.5)), 1, 1, 0xffa040, 0.9)
      }
      // estrelas da janela piscando
      for (const e of estrelasJanela) {
        const a = 0.35 + 0.65 * Math.max(0, Math.sin(seg * 1.3 + e.fase))
        px(e.x, e.y, 1, 1, 0xdfe8ff, a)
      }
      // nuvem fina passando devagar na frente da lua (recortada na janela)
      const nx = JANELA.x0 - 30 + ((seg * 2.2) % (JANELA.x1 - JANELA.x0 + 60))
      for (const [dx, dy, w] of [[0, 0, 22], [5, -2, 12], [-4, 2, 18]]) {
        const x0 = Math.max(JANELA.x0, Math.round(nx + dx))
        const x1 = Math.min(JANELA.x1, Math.round(nx + dx + w))
        if (x1 > x0) px(x0, LUA.y + 4 + dy, x1 - x0, 1, 0x3a5274, 0.75)
      }
      // ponteiro dos segundos do relógio da parede
      const ang = (seg / 60) * Math.PI * 2 - Math.PI / 2
      px(221 + Math.round(Math.cos(ang) * 4), 45 + Math.round(Math.sin(ang) * 4), 1, 1, 0xd04040)
    },
  }
}
