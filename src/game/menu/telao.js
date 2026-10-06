import Phaser from 'phaser'
import { CORES, LARGURA, ALTURA } from '../constants.js'
import { tocar } from '../audio.js'
import { RAIO_BALA } from '../arte/texturas.js'

// O telão na parede do menu: é ONDE o caos mora. Dentro dele roda uma luta de
// balas (os dois corações desviando), e a cor dele ilumina a sala.
//
//   const telao = criarTelao(cena, tela)   tela = TELA de layout.js (área de dentro)
//   await telao.ligar({ rapido })    liga a TV (rapido: sem a animação, ao voltar de outra tela)
//   telao.batida(n)                  pulso da música
//   telao.cor()                      cor dominante agora (a sala usa para iluminar)
//   await telao.explodir()           JOGAR: a luz da tela engole a tela inteira
//   telao.atualizar(delta)
//
// Profundidades 10-19. Sprites em sprites/telao.js (gerados por scripts/menu/telao.py).
//
// Por dentro: uma batalha em miniatura (caixa branca, as duas almas desviando
// sozinhas) com ondas de padrões que trocam a cada ONDA_BATIDAS batidas:
// chuva, espiral, anéis, lasers, paredes e um final caótico. As balas saem de
// um conjunto fixo de MAX_BALAS imagens (reaproveitadas) e morrem ao sair da
// tela; o que passa um pouco da borda fica escondido debaixo da moldura.

const MAX_BALAS = 80
const ONDA_BATIDAS = 8
const MOLDURA = { x: -16, y: -14 } // canto da moldura em relação à TELA (bate com telao.py)
const LED = { x: 315, y: 219 } // posição do LED dentro da moldura
const MARGEM = 6 // quanto a bala pode passar da borda (escondida pelo bisel) antes de sumir
const VEL_ALMA = 105
const P = {
  halo: 10,
  fundo: 11,
  caixa: 12,
  bala: 14,
  laser: 14.5,
  alma: 15,
  tampa: 15.5,
  chiado: 15.8,
  vidro: 16,
  moldura: 18,
  reflexo: 18.5,
  led: 19,
  luz: 19.5,
}

const sorte = Phaser.Math.FloatBetween
const escolher = (lista) => lista[Math.floor(Math.random() * lista.length)]

// mistura duas cores 0xRRGGBB (t = 0 -> a, 1 -> b)
function misturar(a, b, t) {
  const c = (s) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t)
  return (c(16) << 16) | (c(8) << 8) | c(0)
}

// ---------- ondas ----------
// Cada onda: cor (luz do quarto), caixa [largura, altura], cores das balas e
//   iniciar(o, c)        o = estado da onda, c = contexto (ver criarTelao)
//   tique(o, c, dt)      todo quadro
//   batida(o, c, k)      k = batida dentro da onda (0..ONDA_BATIDAS-1)

const ONDAS = [
  {
    nome: 'chuva',
    cor: 0x3fd6c8,
    caixa: [150, 92],
    balas: [0x3fd6c8, 0x9ff7ee, 0xffffff],
    iniciar(o) {
      o.vento = escolher([-28, -14, 14, 28])
      o.acc = 0
    },
    tique(o, c, dt) {
      o.acc += dt
      while (o.acc > 0.09) {
        o.acc -= 0.09
        const { x, largura } = c.tela
        c.soltar({ x: sorte(x - 10, x + largura + 10), y: c.tela.y - 4, vx: o.vento, vy: sorte(72, 104), textura: escolher(['bala-espadas', 'bala-paus']), cor: escolher(this.balas) })
      }
    },
    batida(o, c, k) {
      if (k % 2) return
      // cortina: uma fileira rápida com um buraco
      const n = 9
      const buraco = Phaser.Math.Between(1, n - 3)
      const { esq, larg } = c.caixaAgora()
      for (let i = 0; i < n; i++) {
        if (i === buraco || i === buraco + 1) continue
        c.soltar({ x: esq - 8 + (i * (larg + 16)) / (n - 1), y: c.tela.y - 4, vx: 0, vy: 128, textura: 'bala-espadas', cor: 0xffffff })
      }
    },
  },
  {
    nome: 'espiral',
    cor: 0xa86bff,
    caixa: [112, 104],
    balas: [0xa86bff, 0xd9b8ff, 0xffffff],
    iniciar(o) {
      o.ang = 0
      o.giro = escolher([-1, 1])
      o.acc = 0
    },
    tique(o, c, dt) {
      o.ang += dt * 2.7 * o.giro
      o.acc += dt
      while (o.acc > 0.12) {
        o.acc -= 0.12
        c.emissores.forEach((e, i) => {
          const a = o.ang * (i ? -1 : 1) + i * Math.PI
          c.soltar({ x: e.x, y: e.y, vx: Math.cos(a) * 64, vy: Math.sin(a) * 64, textura: i ? 'bala-ouros' : 'bala-losango', cor: this.balas[i], giro: 5 })
        })
      }
    },
    batida(o, c, k) {
      if (k % 2 === 1) o.giro *= -1
      const e = c.emissores[k % 2]
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + k
        c.soltar({ x: e.x, y: e.y, vx: Math.cos(a) * 46, vy: Math.sin(a) * 46, textura: 'bala-bola', cor: 0xffffff, r: 3.8 })
      }
    },
  },
  {
    nome: 'aneis',
    cor: 0xff3d6e,
    caixa: [128, 100],
    balas: [0xff3d6e, 0xff9ab2, 0xffffff],
    iniciar(o) {
      o.vez = Phaser.Math.Between(0, 3)
    },
    tique() {},
    batida(o, c, k) {
      const { esq, topo, larg, alt } = c.caixaAgora()
      const pontos = [
        [esq - 26, topo - 12],
        [esq + larg + 26, topo - 12],
        [esq + larg + 26, topo + alt + 12],
        [esq - 26, topo + alt + 12],
      ]
      const [x, y] = pontos[o.vez++ % 4]
      const giro = sorte(0, Math.PI)
      const aneis = k % 4 === 3 ? [44, 66] : [54]
      aneis.forEach((v, j) => {
        for (let i = 0; i < 12; i++) {
          const a = giro + (i / 12) * Math.PI * 2 + j * 0.26
          c.soltar({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, textura: j ? 'bala-bola' : 'bala-copas', cor: this.balas[(i + j) % 3] })
        }
      })
      c.clarao(x, y, this.cor)
    },
  },
  {
    nome: 'lasers',
    cor: 0xffd23a,
    caixa: [164, 96],
    balas: [0xffd23a, 0xfff0a8],
    iniciar(o) {
      o.acc = 0
      o.lado = 0
    },
    tique(o, c, dt) {
      o.acc += dt
      if (o.acc < 0.32) return
      o.acc = 0
      const esquerda = o.lado++ % 2 === 0
      const { x, y, largura, altura } = c.tela
      c.soltar({ x: esquerda ? x - 4 : x + largura + 4, y: sorte(y + 8, y + altura - 8), vx: esquerda ? 50 : -50, vy: sorte(-8, 8), textura: 'bala-hex', cor: escolher(this.balas), giro: 3, r: 3.8 })
    },
    batida(o, c, k) {
      const alma = c.almas[k % 2]
      const horizontal = k % 2 === 0
      c.laser(horizontal ? 'h' : 'v', (horizontal ? alma.y : alma.x) + sorte(-5, 5), this.cor)
      if (k % 4 === 3) {
        const outra = c.almas[(k + 1) % 2]
        c.laser(horizontal ? 'v' : 'h', (horizontal ? outra.x : outra.y) + sorte(-5, 5), this.cor)
      }
    },
  },
  {
    nome: 'paredes',
    cor: 0x52e08a,
    caixa: [124, 92],
    balas: [0x52e08a, 0xb6ffc9, 0xffffff],
    iniciar(o) {
      o.lado = escolher([0, 1])
      o.acc = 0
      o.fase = 0
    },
    tique(o, c, dt) {
      // chamas em onda (seno) cruzando por cima e por baixo da caixa
      o.acc += dt
      if (o.acc < 0.42) return
      o.acc = 0
      const { topo, alt } = c.caixaAgora()
      const y0 = o.fase++ % 2 ? topo - 14 : topo + alt + 14
      const daEsquerda = o.fase % 4 < 2
      c.soltar({ x: daEsquerda ? c.tela.x - 4 : c.tela.x + c.tela.largura + 4, y: y0, vx: daEsquerda ? 58 : -58, vy: 0, textura: 'bala-chama', cor: 0xb6ffc9, onda: { base: y0, amp: 9, freq: 5 } })
    },
    batida(o, c, k) {
      if (k % 2) return
      const daEsquerda = o.lado++ % 2 === 0
      const { topo, alt } = c.caixaAgora()
      const n = 10
      const passo = (alt + 20) / (n - 1)
      const buraco = Phaser.Math.Between(1, n - 4)
      for (let i = 0; i < n; i++) {
        if (i >= buraco && i < buraco + 3) continue
        c.soltar({ x: daEsquerda ? c.tela.x - 4 : c.tela.x + c.tela.largura + 4, y: topo - 10 + i * passo, vx: daEsquerda ? 88 : -88, vy: 0, textura: 'bala-paus', cor: escolher(this.balas) })
      }
    },
  },
  {
    nome: 'caos',
    cor: 0xff5ce1,
    caixa: [140, 104],
    balas: [0xff3d6e, 0x3fd6c8, 0xffd23a, 0xa86bff, 0x52e08a, 0xffffff],
    paleta: [0xff5ce1, 0x3fd6c8, 0xffd23a, 0xff3d6e],
    iniciar(o) {
      o.acc = 0
    },
    tique(o, c, dt) {
      o.acc += dt
      while (o.acc > 0.15) {
        o.acc -= 0.15
        const { x, largura } = c.tela
        c.soltar({ x: sorte(x, x + largura), y: c.tela.y - 4, vx: sorte(-20, 20), vy: sorte(70, 100), textura: escolher(['bala-espadas', 'bala-copas', 'bala-ouros', 'bala-paus']), cor: escolher(this.balas) })
      }
    },
    batida(o, c, k) {
      c.mudarCor(this.paleta[k % this.paleta.length])
      if (k % 4 === 2) {
        const alma = escolher(c.almas)
        c.laser(escolher(['h', 'v']), 0, c.corAlvo(), alma)
      }
      if (k % 2) return
      const { esq, topo, larg, alt } = c.caixaAgora()
      const x = escolher([esq - 24, esq + larg + 24])
      const y = sorte(topo, topo + alt)
      const giro = sorte(0, 1)
      for (let i = 0; i < 10; i++) {
        const a = giro + (i / 10) * Math.PI * 2
        c.soltar({ x, y, vx: Math.cos(a) * 58, vy: Math.sin(a) * 58, textura: escolher(['bala-coroa', 'bala-bola', 'bala-losango']), cor: escolher(this.balas), giro: 4 })
      }
      c.clarao(x, y, c.corAlvo())
    },
  },
]

export function criarTelao(cena, tela) {
  const T = { x: tela.x, y: tela.y, largura: tela.largura, altura: tela.altura }
  const cx = T.x + T.largura / 2
  const cy = T.y + T.altura / 2
  const dir = T.x + T.largura
  const baixo = T.y + T.altura
  const temSprites = cena.textures.exists('menu-telao-moldura')

  // ---------- peças fixas ----------
  const halo = cena.add.image(cx, cy + 6, temSprites ? 'menu-telao-brilho' : '__WHITE').setDepth(P.halo).setBlendMode(Phaser.BlendModes.ADD)
  halo.setDisplaySize(T.largura + 150, T.altura + 130).setAlpha(0)
  cena.add.rectangle(T.x, T.y, T.largura, T.altura, 0x04050b).setOrigin(0).setDepth(P.fundo)
  const grade = temSprites
    ? cena.add.tileSprite(T.x, T.y, T.largura, T.altura, 'menu-telao-grade').setOrigin(0).setDepth(P.fundo).setAlpha(0.1)
    : null
  const gCaixa = cena.add.graphics().setDepth(P.caixa)
  const gLaser = cena.add.graphics().setDepth(P.laser)
  const gTampa = cena.add.graphics().setDepth(P.tampa)
  const gGlitch = cena.add.graphics().setDepth(P.chiado)
  const chiado = temSprites
    ? cena.add.sprite(T.x, T.y, 'menu-telao-chiado', 0).setOrigin(0).setScale(2).setDepth(P.chiado).setAlpha(0).setVisible(false)
    : null
  if (temSprites) {
    cena.add.image(T.x, T.y, 'menu-telao-vidro').setOrigin(0).setDepth(P.vidro)
    cena.add.image(T.x + MOLDURA.x, T.y + MOLDURA.y, 'menu-telao-moldura').setOrigin(0).setDepth(P.moldura)
  } else {
    cena.add.rectangle(T.x, T.y, T.largura, T.altura).setOrigin(0).setDepth(P.moldura).setStrokeStyle(16, 0x10121c)
  }
  const reflexo = temSprites
    ? cena.add.image(T.x + MOLDURA.x, T.y + MOLDURA.y, 'menu-telao-reflexo').setOrigin(0).setDepth(P.reflexo).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0)
    : null
  const led = cena.add.rectangle(T.x + MOLDURA.x + LED.x, T.y + MOLDURA.y + LED.y, 3, 3, 0x6a0c14).setOrigin(0).setDepth(P.led)
  const ledBrilho = cena.add.image(led.x + 1.5, led.y + 1.5, temSprites ? 'menu-telao-brilho' : '__WHITE').setDepth(P.led).setDisplaySize(12, 12).setBlendMode(Phaser.BlendModes.ADD).setTint(0xff2030).setAlpha(0.35)
  const gLuz = cena.add.graphics().setDepth(P.luz)

  // ---------- balas (conjunto fixo, reaproveitado) ----------
  const balas = Array.from({ length: MAX_BALAS }, () => ({ img: cena.add.image(0, 0, 'bala-bola').setDepth(P.bala).setVisible(false), vivo: false }))
  const soltar = ({ x, y, vx = 0, vy = 0, r = 3.6, textura = 'bala-bola', cor = 0xffffff, giro = 0, onda = null }) => {
    const b = balas.find((b) => !b.vivo)
    if (!b) return null
    Object.assign(b, { vivo: true, x, y, vx, vy, r, giro, onda, t: 0, escala: r / RAIO_BALA })
    b.img.setTexture(cena.textures.exists(textura) ? textura : 'bala-bola').setTint(cor).setRotation(0).setPosition(x, y).setScale(0).setAlpha(1).setVisible(true)
    return b
  }
  const matar = (b) => {
    b.vivo = false
    b.img.setVisible(false)
  }

  // ---------- caixa de batalha ----------
  const caixa = { largura: ONDAS[0].caixa[0], altura: ONDAS[0].caixa[1] }
  const caixaAgora = () => ({ esq: cx - caixa.largura / 2, topo: cy - caixa.altura / 2, larg: caixa.largura, alt: caixa.altura })

  // ---------- almas ----------
  const almas = CORES.almas.map((cor, i) => ({
    img: cena.add.image(cx + (i ? 22 : -22), cy, 'coracao').setTint(cor).setScale(0.9).setDepth(P.alma),
    cor,
    x: cx + (i ? 22 : -22),
    y: cy + 8,
    vx: 0,
    vy: 0,
    alvo: { x: cx, y: cy },
    tAlvo: 0,
    inv: 0,
  }))

  // emissores da espiral (só aparecem nessa onda)
  const emissores = [-1, 1].map((lado) => {
    const img = cena.add.image(0, 0, 'bala-coroa').setDepth(P.bala).setScale(0.7).setVisible(false)
    return { lado, img, x: cx, y: cy }
  })

  // ---------- lasers ----------
  const lasers = [] // { eixo, pos, cor, t, alma? }
  const AVISO_LASER = 0.47
  const FOGO_LASER = 0.32
  const laser = (eixo, pos, cor, mirar) => {
    if (lasers.length >= 4) return
    lasers.push({ eixo, pos, cor, t: 0, mirar })
  }

  // ---------- luz / cor ----------
  const estado = {
    ligado: false,
    explodindo: false,
    brancura: 0, // 0..1: tela estourada de branco (ligar)
    pulso: 0,
    corOnda: 0x000000,
    corAlvo: ONDAS[0].cor,
    corAtual: 0x000000,
    luzLigada: 0, // 0 (TV desligada) .. 1
    glitch: 0,
    proxGlitch: sorte(5, 9),
  }

  // clarão curto num ponto (de onde sai um anel)
  const claroes = []
  const clarao = (x, y, cor) => claroes.length < 4 && claroes.push({ x, y, cor, t: 0 })

  // ---------- ondas ----------
  let ondaIdx = 0
  let onda = ONDAS[0]
  let o = {}
  let batidaOnda = 0
  const c = {
    tela: T,
    almas,
    emissores,
    soltar,
    laser,
    clarao,
    caixaAgora,
    mudarCor: (cor) => (estado.corAlvo = cor),
    corAlvo: () => estado.corAlvo,
  }
  const comecarOnda = (i) => {
    ondaIdx = i % ONDAS.length
    onda = ONDAS[ondaIdx]
    o = {}
    batidaOnda = 0
    estado.corAlvo = onda.cor
    onda.iniciar(o, c)
    cena.tweens.add({ targets: caixa, largura: onda.caixa[0], altura: onda.caixa[1], duration: 320, ease: 'Back.easeOut' })
    const espiral = onda.nome === 'espiral'
    emissores.forEach((e) => {
      e.img.setVisible(espiral).setTint(onda.balas?.[1] ?? 0xffffff)
      if (espiral) cena.tweens.add({ targets: e.img, scale: { from: 0, to: 0.7 }, duration: 260, ease: 'Back.easeOut' })
    })
  }
  comecarOnda(0)

  // ---------- IA das almas ----------
  const pensar = (a, outra, dt) => {
    const { esq, topo, larg, alt } = caixaAgora()
    const m = 7
    a.tAlvo -= dt
    if (a.tAlvo <= 0) {
      a.alvo.x = sorte(esq + 14, esq + larg - 14)
      a.alvo.y = sorte(topo + 14, topo + alt - 14)
      a.tAlvo = sorte(0.5, 1.4)
    }
    let fx = (a.alvo.x - a.x) * 2.2
    let fy = (a.alvo.y - a.y) * 2.2
    // balas: foge do trecho que a bala vai percorrer nos próximos instantes
    for (const b of balas) {
      if (!b.vivo) continue
      const px = b.vx * 0.22
      const py = b.vy * 0.22
      const l2 = px * px + py * py || 1
      const s = Phaser.Math.Clamp(((a.x - b.x) * px + (a.y - b.y) * py) / l2, 0, 1)
      const dx = a.x - (b.x + px * s)
      const dy = a.y - (b.y + py * s)
      const d = Math.hypot(dx, dy) || 0.01
      const raio = 24
      if (d < raio) {
        const w = (raio - d) / raio
        fx += (dx / d) * w * w * 900
        fy += (dy / d) * w * w * 900
      }
    }
    // lasers (aviso e fogo): sai da linha, para o lado com mais espaço
    for (const l of lasers) {
      const h = l.eixo === 'h'
      const d = h ? a.y - l.pos : a.x - l.pos
      if (Math.abs(d) > 20) continue
      let s = Math.sign(d) || 1
      const meio = h ? topo + alt / 2 : esq + larg / 2
      if (Math.abs((h ? a.y : a.x) - meio) > (h ? alt : larg) / 2 - 16) s = Math.sign(meio - l.pos) || 1
      const f = (20 - Math.abs(d)) * 48 * s
      if (h) fy += f
      else fx += f
    }
    // a outra alma e as paredes da caixa
    const dx = a.x - outra.x
    const dy = a.y - outra.y
    const d = Math.hypot(dx, dy) || 0.01
    if (d < 20) {
      fx += (dx / d) * (20 - d) * 14
      fy += (dy / d) * (20 - d) * 14
    }
    if (a.x < esq + 14) fx += (esq + 14 - a.x) * 18
    if (a.x > esq + larg - 14) fx -= (a.x - (esq + larg - 14)) * 18
    if (a.y < topo + 14) fy += (topo + 14 - a.y) * 18
    if (a.y > topo + alt - 14) fy -= (a.y - (topo + alt - 14)) * 18
    const f = Math.hypot(fx, fy)
    if (f > VEL_ALMA) {
      fx = (fx / f) * VEL_ALMA
      fy = (fy / f) * VEL_ALMA
    }
    const k = Math.min(1, dt * 14)
    a.vx += (fx - a.vx) * k
    a.vy += (fy - a.vy) * k
    a.x = Phaser.Math.Clamp(a.x + a.vx * dt, esq + m, esq + larg - m)
    a.y = Phaser.Math.Clamp(a.y + a.vy * dt, topo + m, topo + alt - m)
  }

  const ferir = (a) => {
    if (a.inv > 0) return
    a.inv = 1
    a.golpes = (a.golpes ?? 0) + 1 // TMPDEBUG
    a.img.setTintMode(Phaser.TintModes.FILL).setTint(0xffffff)
    cena.time.delayedCall(70, () => a.img.active && a.img.setTintMode(Phaser.TintModes.MULTIPLY).setTint(a.cor))
  }

  // ---------- desenho ----------
  const desenharCaixa = () => {
    const { esq, topo, larg, alt } = caixaAgora()
    gCaixa.clear()
    gCaixa.fillStyle(0x000000, 1).fillRect(Math.round(esq), Math.round(topo), Math.round(larg), Math.round(alt))
    gCaixa.lineStyle(2, 0xffffff, 1).strokeRect(Math.round(esq) - 1, Math.round(topo) - 1, Math.round(larg) + 2, Math.round(alt) + 2)
  }

  const desenharLasers = () => {
    gLaser.clear()
    for (const l of lasers) {
      const h = l.eixo === 'h'
      const faixa = (esp, cor, alfa) => {
        gLaser.fillStyle(cor, alfa)
        if (h) gLaser.fillRect(T.x, Math.round(l.pos - esp / 2), T.largura, Math.max(1, Math.round(esp)))
        else gLaser.fillRect(Math.round(l.pos - esp / 2), T.y, Math.max(1, Math.round(esp)), T.altura)
      }
      if (l.t < AVISO_LASER) {
        // aviso: linha fina piscando
        if (Math.floor(l.t * 18) % 2 === 0) faixa(1, CORES.aviso, 0.9)
        continue
      }
      const tf = l.t - AVISO_LASER
      const abre = Math.min(1, tf / 0.06)
      const fecha = tf > FOGO_LASER ? 1 - (tf - FOGO_LASER) / 0.14 : 1
      const esp = 12 * abre * Math.max(0, fecha)
      faixa(esp + 6, l.cor, 0.35)
      faixa(esp, l.cor, 0.85)
      faixa(esp * 0.5, 0xffffff, 1)
    }
    for (const k of claroes) {
      const p = k.t / 0.25
      const r = 4 + p * 10
      gLaser.fillStyle(k.cor, 0.5 * (1 - p)).fillCircle(k.x, k.y, r)
      gLaser.fillStyle(0xffffff, 0.8 * (1 - p)).fillCircle(k.x, k.y, r * 0.45)
    }
  }

  const desenharGlitch = (dt) => {
    gGlitch.clear()
    if (estado.glitch <= 0 || !chiado) {
      if (chiado?.visible && estado.brancura <= 0 && !estado.chiadoFixo) chiado.setVisible(false)
      return
    }
    estado.glitch -= dt
    chiado.setVisible(true).setFrame(Phaser.Math.Between(0, 3)).setAlpha(0.22)
    for (let i = 0; i < 3; i++) {
      const y = T.y + Phaser.Math.Between(0, T.altura - 6)
      const h = Phaser.Math.Between(1, 5)
      const dx = Phaser.Math.Between(-6, 6)
      gGlitch.fillStyle(i === 0 ? 0xffffff : estado.corAtual, sorte(0.12, 0.35)).fillRect(T.x + Math.max(0, dx), y, T.largura - Math.abs(dx), h)
    }
  }

  // ---------- quadro a quadro ----------
  const atualizar = (delta) => {
    const dt = Math.min(delta, 50) / 1000
    if (estado.ligado && !estado.explodindo) onda.tique(o, c, dt)

    // balas
    for (const b of balas) {
      if (!b.vivo) continue
      b.t += dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      if (b.onda) b.y = b.onda.base + Math.sin(b.t * b.onda.freq) * b.onda.amp
      if (b.x < T.x - MARGEM || b.x > dir + MARGEM || b.y < T.y - MARGEM || b.y > baixo + MARGEM) {
        matar(b)
        continue
      }
      b.img.setPosition(b.x, b.y).setScale(b.t < 0.12 ? (b.escala * b.t) / 0.12 : b.escala)
      if (b.giro) b.img.rotation += b.giro * dt
      for (const a of almas) if (Math.abs(a.x - b.x) < b.r + 3 && Math.abs(a.y - b.y) < b.r + 3) ferir(a)
    }

    // emissores da espiral: giram em volta da caixa
    if (onda.nome === 'espiral') {
      const { larg } = caixaAgora()
      emissores.forEach((e) => {
        e.x = cx + e.lado * (larg / 2 + 34)
        e.y = cy + Math.sin(cena.time.now / 600 + e.lado) * 30
        e.img.setPosition(e.x, e.y).rotation += dt * 3 * e.lado
      })
    }

    // lasers
    for (let i = lasers.length - 1; i >= 0; i--) {
      const l = lasers[i]
      l.t += dt
      if (l.mirar && l.t < AVISO_LASER * 0.6) l.pos = l.eixo === 'h' ? l.mirar.y : l.mirar.x
      if (l.t >= AVISO_LASER && !l.disparou) {
        l.disparou = true
        estado.pulso = Math.max(estado.pulso, 1)
      }
      if (l.t > AVISO_LASER && l.t < AVISO_LASER + FOGO_LASER) {
        for (const a of almas) if (Math.abs((l.eixo === 'h' ? a.y : a.x) - l.pos) < 7) ferir(a)
      }
      if (l.t > AVISO_LASER + FOGO_LASER + 0.14) lasers.splice(i, 1)
    }
    for (let i = claroes.length - 1; i >= 0; i--) if ((claroes[i].t += dt) > 0.25) claroes.splice(i, 1)

    // almas
    almas.forEach((a, i) => {
      if (!estado.explodindo) pensar(a, almas[1 - i], dt)
      a.inv = Math.max(0, a.inv - dt)
      a.img.setPosition(Math.round(a.x), Math.round(a.y)).setAlpha(a.inv > 0 && Math.floor(a.inv * 16) % 2 ? 0.25 : 1)
    })

    desenharCaixa()
    desenharLasers()

    // cor: a da onda, suavizada, + o pulso da batida
    estado.corOnda = misturar(estado.corOnda, estado.corAlvo, Math.min(1, dt * 5))
    estado.pulso = Math.max(0, estado.pulso - dt * 2.6)
    const viva = misturar(estado.corOnda, 0xffffff, Math.min(1, estado.pulso * 0.35 + estado.brancura))
    estado.corAtual = misturar(0x000000, viva, estado.luzLigada)
    if (grade) {
      grade.tilePositionX += dt * 9
      grade.tilePositionY += dt * 6
      grade.setTint(estado.corOnda).setAlpha((0.08 + estado.pulso * 0.06) * estado.luzLigada)
    }
    halo.setTint(estado.corAtual).setAlpha((0.14 + estado.pulso * 0.06) * estado.luzLigada + estado.brancura * 0.25)
    reflexo?.setTint(estado.corAtual).setAlpha((0.5 + estado.pulso * 0.25) * estado.luzLigada + estado.brancura * 0.4)

    // chiado / glitch de vez em quando
    if (estado.ligado && !estado.explodindo) {
      estado.proxGlitch -= dt
      if (estado.proxGlitch <= 0) {
        estado.glitch = sorte(0.07, 0.16)
        estado.proxGlitch = sorte(5, 11)
      }
    }
    if (estado.chiadoFixo) chiado?.setFrame(Phaser.Math.Between(0, 3))
    desenharGlitch(dt)
  }

  const batida = (n) => {
    if (!estado.ligado || estado.explodindo) return
    if (n > 1 && (n - 1) % ONDA_BATIDAS === 0) {
      comecarOnda(ondaIdx + 1)
      estado.glitch = 0.12
    }
    estado.pulso = Math.max(estado.pulso, 0.7)
    onda.batida(o, c, batidaOnda++)
  }

  // ---------- ligar ----------
  const acender = () => {
    estado.ligado = true
    led.setFillStyle(0x3cff6a)
    ledBrilho.setTint(0x3cff6a).setAlpha(0.5)
  }

  const ligar = ({ rapido } = {}) =>
    new Promise((resolver) => {
      if (rapido) {
        acender()
        estado.luzLigada = 1
        estado.corOnda = onda.cor
        estado.glitch = 0.15
        resolver()
        return
      }
      // TV desligada: tela de vidro escuro, LED vermelho de espera
      const fase = { largura: 0, altura: 2, branco: 1 }
      const desenharTampa = (apagada) => {
        gTampa.clear()
        if (apagada) gTampa.fillStyle(0x0b0d16, 1).fillRect(T.x, T.y, T.largura, T.altura)
        const w = Math.round(fase.largura)
        const h = Math.max(1, Math.round(fase.altura))
        if (w > 0) gTampa.fillStyle(0xffffff, fase.branco).fillRect(Math.round(cx - w / 2), Math.round(cy - h / 2), w, h)
      }
      desenharTampa(true)
      cena.time.delayedCall(420, () => {
        tocar(cena, 'menu-telao-ligar')
        acender()
        estado.brancura = 1
        estado.luzLigada = 0.35
        // a linha branca atravessa a tela...
        cena.tweens.add({
          targets: fase,
          largura: T.largura,
          duration: 90,
          ease: 'Cubic.easeOut',
          onUpdate: () => desenharTampa(true),
          onComplete: () => {
            // ...e abre na vertical
            chiado?.setVisible(true).setAlpha(0.45)
            estado.chiadoFixo = true
            cena.tweens.add({
              targets: fase,
              altura: T.altura,
              duration: 170,
              ease: 'Cubic.easeIn',
              onUpdate: () => desenharTampa(false),
              onComplete: () => {
                estado.corOnda = onda.cor
                cena.tweens.add({
                  targets: fase,
                  branco: 0,
                  duration: 280,
                  ease: 'Quad.easeOut',
                  onUpdate: () => {
                    desenharTampa(false)
                    estado.brancura = fase.branco
                    estado.luzLigada = 1
                  },
                  onComplete: () => {
                    gTampa.clear()
                    estado.brancura = 0
                  },
                })
                if (chiado) cena.tweens.add({ targets: chiado, alpha: 0, duration: 420, onComplete: () => (estado.chiadoFixo = false) })
                else estado.chiadoFixo = false
                cena.time.delayedCall(200, resolver)
              },
            })
          },
        })
      })
    })

  // ---------- explodir (JOGAR) ----------
  const explodir = () =>
    new Promise((resolver) => {
      estado.explodindo = true
      estado.glitch = 0
      lasers.length = 0
      const luz = cena.add.image(cx, cy, temSprites ? 'menu-telao-brilho' : '__WHITE').setDepth(P.luz).setBlendMode(Phaser.BlendModes.ADD)
      luz.setDisplaySize(T.largura * 1.2, T.altura * 1.4).setAlpha(0.9)
      const p = { tela: 0, sala: 0 }
      const desenhar = () => {
        gLuz.clear()
        // a tela estoura de branco...
        gLuz.fillStyle(0xffffff, p.tela).fillRect(T.x, T.y, T.largura, T.altura)
        // ...e a luz cresce até engolir tudo
        if (p.sala > 0) {
          const s = p.sala
          const x0 = T.x * (1 - s)
          const y0 = T.y * (1 - s)
          const x1 = dir + (LARGURA - dir) * s
          const y1 = baixo + (ALTURA - baixo) * s
          gLuz.fillStyle(0xffffff, Math.min(1, 0.55 + s)).fillRect(x0, y0, x1 - x0, y1 - y0)
        }
        estado.brancura = Math.max(p.tela, p.sala)
      }
      cena.tweens.add({ targets: p, tela: 1, duration: 130, ease: 'Quad.easeOut', onUpdate: desenhar })
      cena.tweens.add({ targets: p, sala: 1, delay: 110, duration: 480, ease: 'Cubic.easeIn', onUpdate: desenhar })
      cena.tweens.add({ targets: luz, scaleX: luz.scaleX * 6, scaleY: luz.scaleY * 6, alpha: 1, duration: 560, ease: 'Cubic.easeIn' })
      cena.cameras.main.shake(260, 0.004)
      cena.time.delayedCall(480, () => cena.cameras.main.fadeOut(200, 255, 255, 255))
      cena.time.delayedCall(700, resolver)
    })

  return {
    ligar,
    batida,
    cor: () => estado.corAtual,
    explodir,
    atualizar,
    _debug: () => ({ golpes: almas.map((a) => a.golpes ?? 0), onda: onda.nome, vivas: balas.filter((b) => b.vivo).length }), // TMPDEBUG
  }
}
