import Phaser from 'phaser'
import { LARGURA } from '../constants.js'
import { BATIDA, TURMA } from './layout.js'
import { COSTAS, chaveCostas, criarTexturasCostas } from './costas.js'
import { fatores } from '../acessibilidade.js'

// A sala do menu (um quarto aconchegante de noite): parede, chão, a luz que o telão joga no chão e as
// sete lutadores sentados de costas assistindo a tela (contornados pela luz dela).
//
//   const sala = criarSala(cena, { tela })   tela = TELA de layout.js
//   sala.iluminar(cor)    cor atual do telão: a luz no chão e o contorno seguem ela
//   sala.batida(n)        pulso da música (n = nº da batida): a luz pulsa, as silhuetas balançam
//   sala.atualizar(delta)
//
// Profundidades 0-9:
//   0 a sala · 1 luz na parede · 1.5 luzinhas · 2 cone de luz no chão · 5 a turma
//   (sentada de costas) · 7 poeira na luz · 8 o que fica na frente dela · 9 vinheta
//
// A arte (scripts/menu/sala.py) vem em camadas: o fundo é o quarto só com a luz
// ambiente; as camadas de luz são cinza e somam por cima (ADD) pintadas com a
// cor do telão. A turma usa os sprites de costas (costas.js), cortados em
// cabeça e corpo para a cabeça balançar sozinha, com uma cópia chapada na cor
// da luz um pouco deslocada para cima/para o telão por trás (o contorno de luz).
//
// Preferências (acessibilidade.js), lidas a cada quadro: no gráfico mínimo a
// poeira some e a turma para de dançar (só a luz muda de cor); com
// "reduzir animações" a luz quase não pulsa nem tremula.

const ESCALA = 3 // a mesma dos personagens na luta
const TOM = 0xd6c2dc // multiplica a textura: a cor do personagem na meia-luz quente da sala

// quem senta onde (TURMA de layout.js, na ordem) e o jeito de curtir a música
const JEITO = {
  berdly: 'pulo',
  ralsei: 'balanco',
  kris: 'cabeca',
  noelle: 'timida',
  susie: 'headbang',
  dess: 'roqueira',
  asriel: 'saltinho',
}

// pose de cada jeito: t = fração da batida desde o pulso (0..1), n = nº da batida.
// Devolve deslocamentos em pixels de tela, sempre em degraus de P (1 pixel da
// arte: 3 aqui, 2 na mesa de cartas, que usa só o "cabeca", para baixo).
export const jeitos = (P) => ({
  cabeca: (t) => ({ cabeca: t < 0.3 ? P : 0 }),
  headbang: (t) => ({ cabeca: t < 0.18 ? 2 * P : t < 0.36 ? P : 0, corpo: t < 0.18 ? P : 0 }),
  balanco: (t, n) => ({ x: n % 2 ? P : -P, cabeca: n % 2 === 0 && t < 0.3 ? P : 0 }),
  timida: (t, n) => ({ cabeca: n % 2 === 0 && t < 0.4 ? P : 0 }),
  pulo: (t, n) => ({ y: n % 2 === 0 ? (t < 0.14 ? -2 * P : t < 0.28 ? -P : 0) : 0, cabeca: n % 2 && t < 0.25 ? P : 0 }),
  roqueira: (t, n) => ({ cabeca: t < 0.25 ? P : 0, y: n % 4 === 0 && t < 0.2 ? -P : 0 }),
  saltinho: (t) => ({ y: t < 0.22 ? -P : 0 }),
})
const JEITOS = jeitos(ESCALA)

const POEIRA = 16
const AREA_POEIRA = { x0: 420, x1: 830, y0: 270, y1: 446 }

export function criarSala(cena, { tela } = {}) {
  const centroTela = tela ? tela.x + tela.largura / 2 : LARGURA * 0.7

  cena.add.image(0, 0, 'menu-sala-fundo').setOrigin(0).setDepth(0)
  const luzParede = cena.add.image(0, 0, 'menu-sala-luz-parede').setOrigin(0).setDepth(1).setBlendMode(Phaser.BlendModes.ADD)
  const luzChao = cena.add.image(0, 0, 'menu-sala-luz-chao').setOrigin(0).setDepth(2).setBlendMode(Phaser.BlendModes.ADD)
  // lâmpadas do varal e abajur: brilho que cintila (cada uma a seu tempo)
  const luzinhas = cena.add.image(0, 0, 'menu-sala-luzinhas').setOrigin(0).setDepth(1.5).setBlendMode(Phaser.BlendModes.ADD)
  // o que fica na frente da turma: almofadas, controle e as folhas no canto
  cena.add.image(0, 0, 'menu-sala-frente').setOrigin(0).setDepth(8)
  cena.add.image(0, 0, 'menu-sala-vinheta').setOrigin(0).setDepth(9)

  criarTexturasCostas(cena)
  const figuras = TURMA.map((d, i) => figura(cena, d, i, centroTela))

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
    const { nivel, piscar } = fatores()
    const forca = piscar ? 0.86 + 0.22 * pulso + 0.035 * tremor : 0.9 + 0.05 * pulso

    luzinhas.setAlpha(nivel === 0 ? 0.6 : 0.62 + 0.14 * Math.sin(relogio / 380) + 0.08 * Math.sin(relogio / 137 + 1.3) + 0.1 * pulso)
    luzParede.setTint(cor).setAlpha(Math.min(1, forca + 0.06 * pulso))
    luzChao.setTint(cor).setAlpha(Math.min(1, forca * 0.95))

    const t = nivel === 0 ? Infinity : desde / BATIDA // mínimo: ninguém dança (pose de descanso)
    const tom = misturar(TOM, cor, 0.12)
    for (const f of figuras) posar(f, t, n, cor, tom, forca)

    for (const g of poeira) {
      g.img.setVisible(nivel > 0)
      if (nivel === 0) continue
      g.x += (g.vx * dt) / 1000
      g.y += (g.vy * dt) / 1000
      if (g.y < AREA_POEIRA.y0 || g.x < AREA_POEIRA.x0 || g.x > AREA_POEIRA.x1) soltar(g, false)
      const brilho = g.brilho * (0.5 + 0.5 * Math.sin(relogio / 700 + g.fase))
      g.img.setPosition(Math.round(g.x), Math.round(g.y)).setTint(cor).setAlpha(Math.max(0, brilho) * forca)
    }
  }

  return { iluminar, batida, atualizar }
}

// Um lutador sentado de costas: contorno de luz (atrás) e o corpo, cada um
// cortado em costas + cabeça para a cabeça balançar sozinha
function figura(cena, def, i, centroTela) {
  const chave = chaveCostas(def.id)
  const frame = cena.textures.getFrame(chave)
  const w = frame.width
  const h = frame.height
  const corte = COSTAS[def.id].cabeca
  const prof = 5 + (i % 2 ? 0 : 0.5) // quem está mais na frente fica por cima
  // o contorno sai para o lado do telão (e para cima): quem está à esquerda da
  // tela ganha luz na direita, e vice-versa; quem está no meio, só em cima
  const lado = Phaser.Math.Clamp((centroTela - def.x) / 90, -1, 1)
  const rim = { x: Math.round(lado * 2), y: -2 }

  const peca = (ini, alt, d) => cena.add.image(def.x, def.y, chave).setOrigin(0.5, 1).setScale(ESCALA).setCrop(0, ini, w, alt).setDepth(d)
  const rimCorpo = peca(corte, h - corte, prof).setTintMode(Phaser.TintModes.FILL)
  const rimCabeca = peca(0, corte, prof).setTintMode(Phaser.TintModes.FILL)
  const corpo = peca(corte, h - corte, prof + 0.1)
  const cabeca = peca(0, corte, prof + 0.1)
  return { def, y: def.y, rim, rimCorpo, rimCabeca, corpo, cabeca, jeito: JEITOS[JEITO[def.id]] ?? JEITOS.cabeca }
}

function posar(f, t, n, cor, tom, forca) {
  const pose = t <= 1 ? f.jeito(t, n) : {}
  const x = f.def.x + (pose.x ?? 0)
  const yCorpo = f.y + (pose.y ?? 0) + (pose.corpo ?? 0)
  const yCabeca = f.y + (pose.y ?? 0) + (pose.cabeca ?? 0)
  f.corpo.setPosition(x, yCorpo).setTint(tom)
  f.cabeca.setPosition(x, yCabeca).setTint(tom)
  f.rimCorpo.setPosition(x + f.rim.x, yCorpo + f.rim.y).setTint(cor).setAlpha(Math.min(1, 0.55 * forca))
  f.rimCabeca.setPosition(x + f.rim.x, yCabeca + f.rim.y).setTint(cor).setAlpha(Math.min(1, 0.7 * forca))
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
