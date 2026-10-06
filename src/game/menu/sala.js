import Phaser from 'phaser'
import { LARGURA, ALTURA } from '../constants.js'
import { BATIDA, CHAO, PES } from './layout.js'

// O quarto escuro do menu: parede, chão, a luz que o telão joga no chão e as
// silhuetas dos sete lutadores assistindo a tela (contornadas pela luz dela).
//
//   const sala = criarSala(cena, { tela })   tela = TELA de layout.js
//   sala.iluminar(cor)    cor atual do telão: a luz no chão e o contorno seguem ela
//   sala.batida(n)        pulso da música (n = nº da batida): a luz pulsa, as silhuetas balançam
//   sala.atualizar(delta)
//
// Profundidades 0-9:
//   0 o quarto na penumbra · 1 luz na parede · 2 cone de luz no chão · 3 sombras
//   das silhuetas · 4 fileira de trás · 6 fileira da frente · 7 poeira na luz · 9 vinheta
//
// A arte (scripts/menu/sala.py) vem em camadas: o fundo é o quarto só com a luz
// ambiente; as camadas de luz são cinza e somam por cima (ADD) pintadas com a
// cor do telão, então os detalhes (tapete, machado, varal...) só aparecem com
// a luz. As silhuetas são as texturas dos personagens escurecidas, cortadas em
// cabeça e corpo para a cabeça balançar sozinha, com uma cópia chapada na cor
// da luz um pouco deslocada para cima/para o telão por trás (o contorno de luz).

const ESCALA = 3 // a mesma dos personagens na luta
const SILHUETA = 0x11141e // multiplica a textura: quase preto, só um fio do volume
const TRAS = 20 // a fileira de trás pisa um pouco mais para dentro (mais perto do telão)
const CABECA = 9 // linhas da textura (a partir do topo do desenho) que formam a cabeça

// quem fica onde (x = centro dos pés) e o jeito de curtir a música.
// Fileira de trás um pouco mais perto do telão; ninguém à esquerda de x≈320
// para não cobrir as opções.
const ELENCO = [
  { id: 'ralsei', x: 382, tras: true, jeito: 'balanco' },
  { id: 'noelle', x: 470, tras: true, jeito: 'timida', virar: true },
  { id: 'dess', x: 562, tras: true, jeito: 'roqueira' },
  { id: 'berdly', x: 334, jeito: 'pulo' },
  { id: 'kris', x: 426, jeito: 'cabeca' },
  { id: 'susie', x: 516, jeito: 'headbang', virar: true },
  { id: 'asriel', x: 604, jeito: 'saltinho' },
]

// pose de cada jeito: t = fração da batida desde o pulso (0..1), n = nº da batida.
// Devolve deslocamentos em pixels de tela, sempre em degraus de 3 (1 pixel da arte).
const P = ESCALA
const JEITOS = {
  cabeca: (t) => ({ cabeca: t < 0.3 ? P : 0 }),
  headbang: (t) => ({ cabeca: t < 0.18 ? 2 * P : t < 0.36 ? P : 0, corpo: t < 0.18 ? P : 0 }),
  balanco: (t, n) => ({ x: n % 2 ? P : -P, cabeca: n % 2 === 0 && t < 0.3 ? P : 0 }),
  timida: (t, n) => ({ cabeca: n % 2 === 0 && t < 0.4 ? P : 0 }),
  pulo: (t, n) => ({ y: n % 2 === 0 ? (t < 0.14 ? -2 * P : t < 0.28 ? -P : 0) : 0, cabeca: n % 2 && t < 0.25 ? P : 0 }),
  roqueira: (t, n) => ({ cabeca: t < 0.25 ? P : 0, y: n % 4 === 0 && t < 0.2 ? -P : 0 }),
  saltinho: (t) => ({ y: t < 0.22 ? -P : 0 }),
}

const POEIRA = 16
const AREA_POEIRA = { x0: 300, x1: 630, y0: 250, y1: 446 }

export function criarSala(cena, { tela } = {}) {
  if (!cena.textures.exists('menu-sala-fundo')) return provisoria(cena)
  const centroTela = tela ? tela.x + tela.largura / 2 : LARGURA * 0.7

  cena.add.image(0, 0, 'menu-sala-fundo').setOrigin(0).setDepth(0)
  const luzParede = cena.add.image(0, 0, 'menu-sala-luz-parede').setOrigin(0).setDepth(1).setBlendMode(Phaser.BlendModes.ADD)
  const luzChao = cena.add.image(0, 0, 'menu-sala-luz-chao').setOrigin(0).setDepth(2).setBlendMode(Phaser.BlendModes.ADD)
  cena.add.image(0, 0, 'menu-sala-vinheta').setOrigin(0).setDepth(9)

  const figuras = ELENCO.filter((d) => cena.textures.exists(d.id)).map((d) => figura(cena, d, centroTela))

  const poeira = Array.from({ length: POEIRA }, (_, i) => {
    const img = cena.add.image(0, 0, 'menu-sala-poeira').setDepth(7).setBlendMode(Phaser.BlendModes.ADD)
    const grao = { img, x: 0, y: 0, vx: 0, vy: 0, fase: i * 1.7, brilho: 0 }
    soltar(grao, true)
    return grao
  })

  // cor da luz (suavizada: o telão pisca, a sala respira) e intensidade
  const alvo = { r: 0, g: 0, b: 0 }
  const atual = { r: 0, g: 0, b: 0 }
  let pulso = 0
  let tremor = 0
  let tremorAlvo = 0
  let n = 0
  let desde = Infinity // ms desde a última batida (antes da música: parados)
  let relogio = 0

  function iluminar(cor) {
    alvo.r = (cor >> 16) & 0xff
    alvo.g = (cor >> 8) & 0xff
    alvo.b = cor & 0xff
  }

  function batida(num) {
    n = num
    desde = 0
    pulso = num % 4 === 1 ? 1 : 0.6 // o primeiro tempo do compasso bate mais forte
  }

  function atualizar(delta) {
    const dt = Math.min(delta, 100)
    relogio += dt
    desde += dt
    // cor: chega na do telão em ~1/8 s
    const k = 1 - Math.exp(-dt / 120)
    atual.r += (alvo.r - atual.r) * k
    atual.g += (alvo.g - atual.g) * k
    atual.b += (alvo.b - atual.b) * k
    const cor = (Math.round(atual.r) << 16) | (Math.round(atual.g) << 8) | Math.round(atual.b)
    // pulso da batida decai rápido; a tela "tremula" de leve o tempo todo
    pulso *= Math.exp(-dt / 170)
    if (Math.random() < dt / 90) tremorAlvo = Phaser.Math.FloatBetween(-1, 1)
    tremor += (tremorAlvo - tremor) * (1 - Math.exp(-dt / 60))
    const forca = 0.86 + 0.22 * pulso + 0.035 * tremor

    luzParede.setTint(cor).setAlpha(Math.min(1, forca + 0.06 * pulso))
    luzChao.setTint(cor).setAlpha(Math.min(1, forca * 0.95))

    const t = desde / BATIDA
    const corSilhueta = misturar(SILHUETA, cor, 0.07)
    for (const f of figuras) posar(f, t, n, cor, corSilhueta, forca)

    for (const g of poeira) {
      g.x += (g.vx * dt) / 1000
      g.y += (g.vy * dt) / 1000
      if (g.y < AREA_POEIRA.y0 || g.x < AREA_POEIRA.x0 || g.x > AREA_POEIRA.x1) soltar(g, false)
      const brilho = g.brilho * (0.5 + 0.5 * Math.sin(relogio / 700 + g.fase))
      g.img.setPosition(Math.round(g.x), Math.round(g.y)).setTint(cor).setAlpha(Math.max(0, brilho) * forca)
    }
  }

  return { iluminar, batida, atualizar }
}

// Um lutador de costas: sombra no chão, contorno de luz (atrás) e a silhueta,
// cada um cortado em corpo + cabeça.
function figura(cena, def, centroTela) {
  const frame = cena.textures.getFrame(def.id)
  const w = frame.width
  const h = frame.height
  const topo = primeiraLinha(cena, def.id, w, h)
  const corte = Math.min(h - 1, topo + CABECA)
  const y = PES - (def.tras ? TRAS : 0)
  const prof = def.tras ? 4 : 6
  // o contorno sai para o lado do telão (e para cima): quem está à esquerda da
  // tela ganha luz na direita, e vice-versa; quem está no meio, só em cima
  const lado = Phaser.Math.Clamp((centroTela - def.x) / 70, -1, 1)
  const rim = { x: Math.round(lado * 2), y: -2 }

  const peca = (ini, alt, d) =>
    cena.add.image(def.x, y, def.id).setOrigin(0.5, 1).setScale(ESCALA).setFlipX(Boolean(def.virar)).setCrop(0, ini, w, alt).setDepth(d)
  const rimCorpo = peca(corte, h - corte, prof).setTintMode(Phaser.TintModes.FILL)
  const rimCabeca = peca(0, corte, prof).setTintMode(Phaser.TintModes.FILL)
  const corpo = peca(corte, h - corte, prof + 0.1)
  const cabeca = peca(0, corte, prof + 0.1)
  const sombra = cena.add
    .image(def.x, y, def.id)
    .setOrigin(0.5, 1)
    .setScale(ESCALA, -ESCALA * 0.42) // achatada e virada para nós (a luz vem de trás)
    .setFlipX(Boolean(def.virar))
    .setTint(0x000000)
    .setTintMode(Phaser.TintModes.FILL)
    .setDepth(3)
  return { def, y, rim, rimCorpo, rimCabeca, corpo, cabeca, sombra, jeito: JEITOS[def.jeito] ?? JEITOS.cabeca }
}

function posar(f, t, n, cor, corSilhueta, forca) {
  const pose = t <= 1 ? f.jeito(t, n) : {}
  const x = f.def.x + (pose.x ?? 0)
  const yCorpo = f.y + (pose.y ?? 0) + (pose.corpo ?? 0)
  const yCabeca = f.y + (pose.y ?? 0) + (pose.cabeca ?? 0)
  f.corpo.setPosition(x, yCorpo).setTint(corSilhueta)
  f.cabeca.setPosition(x, yCabeca).setTint(corSilhueta)
  f.rimCorpo.setPosition(x + f.rim.x, yCorpo + f.rim.y).setTint(cor).setAlpha(Math.min(1, 0.8 * forca))
  f.rimCabeca.setPosition(x + f.rim.x, yCabeca + f.rim.y).setTint(cor).setAlpha(Math.min(1, 0.9 * forca))
  // a sombra fica no chão (quem pula se afasta dela) e some quando a luz cai
  f.sombra.setX(x).setAlpha(0.42 * Math.min(1, forca) * brilhoDe(cor))
}

// primeira linha com desenho na textura (para saber onde a cabeça termina)
function primeiraLinha(cena, chave, w, h) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) if (cena.textures.getPixelAlpha(x, y, chave) > 0) return y
  }
  return 0
}

function soltar(g, espalhar) {
  const a = AREA_POEIRA
  g.x = Phaser.Math.FloatBetween(a.x0 + 10, a.x1 - 10)
  g.y = espalhar ? Phaser.Math.FloatBetween(a.y0, a.y1) : a.y1
  g.vx = Phaser.Math.FloatBetween(-4, 4)
  g.vy = Phaser.Math.FloatBetween(-9, -3)
  g.brilho = Phaser.Math.FloatBetween(0.15, 0.5)
}

function misturar(a, b, t) {
  const c = (s) => {
    const x = (a >> s) & 0xff
    const y = (b >> s) & 0xff
    return Math.round(x + (y - x) * t) << s
  }
  return c(16) | c(8) | c(0)
}

function brilhoDe(cor) {
  return Math.max((cor >> 16) & 0xff, (cor >> 8) & 0xff, cor & 0xff) / 255
}

// sem a arte carregada: parede e chão lisos (não deixa o menu quebrar)
function provisoria(cena) {
  cena.add.rectangle(0, 0, LARGURA, CHAO, 0x12142a).setOrigin(0).setDepth(0)
  cena.add.rectangle(0, CHAO, LARGURA, ALTURA - CHAO, 0x0a0b14).setOrigin(0).setDepth(0)
  return { iluminar() {}, batida() {}, atualizar() {} }
}
