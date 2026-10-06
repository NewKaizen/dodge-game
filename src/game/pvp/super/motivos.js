import Phaser from 'phaser'
import { ALTURA, LARGURA } from '../../constants.js'

// O "motivo" de cada personagem no anúncio do SUPER (pvp/super/anuncio.js):
// a parte da animação que muda de um para outro. Tudo desenhado com formas
// (Graphics) e a textura 'coracao', sem depender de glifos da fonte.
//
//   MOTIVOS[personagem](arena, m)
//     m.novo(obj)       registra o objeto (fora das caixas, some no fim); profundidade
//                       97 = na frente da faixa e atrás do texto, 99 = na frente de tudo
//     m.cor             cor do personagem
//     m.lado            -1 (P1, entra pela esquerda) ou 1 (P2, pela direita)
//     m.cy              altura do meio da faixa
//     m.vivo()          false se a cena saiu (não crie mais nada)
//     m.depois(ms, fn)  timer que só dispara com a cena viva
//     m.faiscas(x, y, cor, quantidade)
// O motivo roda por ~1,9 s e não precisa limpar nada: o anúncio destrói tudo
// que passou por m.novo no fim.

const FUNDO = 97 // na frente da faixa (96), atrás do texto (98)
const FRENTE = 99

const TAU = Math.PI * 2
const ARCO_IRIS = [0xff4a5a, 0xffa23a, 0xffe14a, 0x5ae06a, 0x4ab8ff, 0xa66bff]
const sorte = (a, b) => a + Math.random() * (b - a)

function estrela(g, x, y, r, pontas = 5, interno = 0.45) {
  const pts = Array.from({ length: pontas * 2 }, (_, i) => {
    const raio = i % 2 ? r * interno : r
    const a = -Math.PI / 2 + (i * Math.PI) / pontas
    return { x: x + Math.cos(a) * raio, y: y + Math.sin(a) * raio }
  })
  g.fillPoints(pts, true)
}

// ---------- Kris: cortes de espada cruzando a tela + a alma vermelha pulsando ----------
function kris(arena, m) {
  const alma = m.novo(arena.add.image(LARGURA / 2, m.cy, 'coracao').setTint(0xff2030).setDepth(FUNDO).setScale(0).setAlpha(0.9))
  arena.tweens.add({ targets: alma, scale: 7, duration: 320, ease: 'Back.easeOut' })
  arena.tweens.add({ targets: alma, scale: 6.2, delay: 340, duration: 260, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' })
  // cortes em X, um atrás do outro, pela animação toda
  const cortes = Array.from({ length: 12 }, (_, i) => [(i % 2 ? 1 : -1) * sorte(0.25, 1.0), i * 135])
  for (const [ang, atraso] of cortes) {
    m.depois(atraso, () => {
      const x = LARGURA / 2 + sorte(-120, 120)
      const y = m.cy + sorte(-60, 60)
      const g = m.novo(arena.add.graphics().setDepth(FRENTE).setPosition(x, y).setRotation(ang))
      g.fillStyle(0x9fd0ff, 1)
      g.fillTriangle(-260, 0, 260, -3, 260, 3)
      g.fillStyle(0xffffff, 1)
      g.fillTriangle(-240, 0, 240, -1.2, 240, 1.2)
      g.setScale(0, 1)
      arena.tweens.add({ targets: g, scaleX: 1, duration: 90, ease: 'Quad.easeOut' })
      arena.tweens.add({ targets: g, alpha: 0, scaleY: 3, delay: 160, duration: 260 })
      m.faiscas(x, y, 0x9fd0ff, 10)
    })
  }
}

// ---------- Susie: machado gigante girando que racha a tela ----------
function susie(arena, m) {
  const machado = m.novo(arena.add.graphics().setDepth(FUNDO).setPosition(LARGURA / 2, m.cy))
  machado.fillStyle(0x5a3a22, 1)
  machado.fillRect(-7, -10, 14, 150) // cabo
  machado.fillStyle(0x3a2414, 1)
  machado.fillRect(-9, 120, 18, 16)
  const lamina = []
  for (let i = 0; i <= 14; i++) {
    const a = -1.2 + (2.4 * i) / 14
    lamina.push({ x: 18 + Math.cos(a) * 85, y: -40 + Math.sin(a) * 85 })
  }
  machado.fillStyle(0xc890ff, 1)
  machado.fillPoints([{ x: 6, y: -70 }, ...lamina, { x: 6, y: -10 }], true)
  machado.fillStyle(0xf0dcff, 1)
  machado.fillPoints(lamina.concat([...lamina].reverse().map((p) => ({ x: 18 + (p.x - 18) * 0.86, y: -40 + (p.y + 40) * 0.86 }))), true)
  machado.setScale(0.2).setAlpha(0.95)
  arena.tweens.add({ targets: machado, scale: 1.25, rotation: m.lado * -TAU * 1.5, duration: 700, ease: 'Cubic.easeIn' })
  m.depois(700, () => {
    arena.cameras.main.shake(260, 0.02)
    // rachaduras em ziguezague saindo do ponto do golpe
    for (let k = 0; k < 7; k++) {
      const g = m.novo(arena.add.graphics().setDepth(FUNDO))
      let x = LARGURA / 2
      let y = m.cy + 60
      let a = (k / 7) * TAU + sorte(-0.2, 0.2)
      g.lineStyle(3, 0xffffff, 0.9)
      g.beginPath()
      g.moveTo(x, y)
      for (let s = 0; s < 7; s++) {
        a += sorte(-0.6, 0.6)
        x += Math.cos(a) * sorte(25, 45)
        y += Math.sin(a) * sorte(25, 45)
        g.lineTo(x, y)
      }
      g.strokePath()
      arena.tweens.add({ targets: g, alpha: 0, delay: 600, duration: 500 })
    }
    m.faiscas(LARGURA / 2, m.cy + 60, 0xc890ff, 30)
  })
}

// ---------- Ralsei: corações e estrelinhas verdes subindo em espiral ----------
function ralsei(arena, m) {
  for (let i = 0; i < 26; i++) {
    m.depois(i * 55, () => {
      const x0 = sorte(60, LARGURA - 60)
      const fase = sorte(0, TAU)
      const coracao = i % 3 !== 2
      const obj = coracao
        ? m.novo(arena.add.image(x0, ALTURA + 20, 'coracao').setTint(i % 2 ? 0x6be08a : 0xc8ffd8).setDepth(FUNDO).setScale(sorte(1.2, 2.4)))
        : m.novo(arena.add.graphics().setDepth(FUNDO).setPosition(x0, ALTURA + 20))
      if (!coracao) {
        obj.fillStyle(0xfff0a8, 1)
        estrela(obj, 0, 0, 9, 4, 0.3)
      }
      arena.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 1500,
        ease: 'Sine.easeOut',
        onUpdate: (tw) => {
          if (!obj.scene) return
          const p = tw.getValue()
          obj.setPosition(x0 + Math.sin(fase + p * TAU * 1.5) * 40, ALTURA + 20 - p * (ALTURA + 60)).setAngle(p * 180).setAlpha(1 - p * 0.6)
        },
      })
    })
  }
  // anel de luz verde em volta do texto
  const anel = m.novo(arena.add.circle(LARGURA / 2, m.cy, 40).setStrokeStyle(4, 0x6be08a).setDepth(FUNDO).setAlpha(0.8))
  arena.tweens.add({ targets: anel, scale: 5, alpha: 0, duration: 1100, ease: 'Quad.easeOut', repeat: 1 })
}

// ---------- Noelle: flocos de neve caindo e geada nas bordas ----------
function noelle(arena, m) {
  // geada: camadas brancas-azuladas nas bordas
  for (let k = 0; k < 4; k++) {
    const e = 26 + k * 18
    const g = m.novo(arena.add.graphics().setDepth(FUNDO).setAlpha(0))
    g.fillStyle(0xd8f6ff, 0.16)
    g.fillRect(0, 0, LARGURA, e)
    g.fillRect(0, ALTURA - e, LARGURA, e)
    g.fillRect(0, 0, e, ALTURA)
    g.fillRect(LARGURA - e, 0, e, ALTURA)
    arena.tweens.add({ targets: g, alpha: 1, delay: k * 90, duration: 300 })
  }
  for (let i = 0; i < 38; i++) {
    m.depois(i * 40, () => {
      const r = sorte(5, 13)
      const g = m.novo(arena.add.graphics().setDepth(i % 4 ? FUNDO : FRENTE).setPosition(sorte(0, LARGURA), -20))
      g.lineStyle(Math.max(1.5, r / 5), 0xe8faff, 1)
      for (let b = 0; b < 6; b++) {
        const a = (b * TAU) / 6
        const ex = Math.cos(a) * r
        const ey = Math.sin(a) * r
        g.lineBetween(0, 0, ex, ey)
        // ramos
        const mx = ex * 0.6
        const my = ey * 0.6
        g.lineBetween(mx, my, mx + Math.cos(a + 0.7) * r * 0.35, my + Math.sin(a + 0.7) * r * 0.35)
        g.lineBetween(mx, my, mx + Math.cos(a - 0.7) * r * 0.35, my + Math.sin(a - 0.7) * r * 0.35)
      }
      arena.tweens.add({ targets: g, y: ALTURA + 30, x: g.x + sorte(-60, 60), angle: sorte(-200, 200), duration: sorte(1300, 1900), ease: 'Linear' })
    })
  }
}

// ---------- Berdly: rajadas de vento e penas ----------
function berdly(arena, m) {
  const de = m.lado < 0 ? -80 : LARGURA + 80
  const para = m.lado < 0 ? LARGURA + 80 : -80
  for (let i = 0; i < 22; i++) {
    m.depois(i * 60, () => {
      const y = sorte(40, ALTURA - 40)
      const comp = sorte(60, 180)
      const g = m.novo(arena.add.graphics().setDepth(i % 3 ? FUNDO : FRENTE).setPosition(de, y))
      g.fillStyle(0xffffff, 0.75)
      g.fillTriangle(0, -1.5, -m.lado * comp, 0, 0, 1.5)
      g.fillStyle(0x8fe0ff, 0.6)
      g.fillRect(-m.lado * comp * 0.2 - 2, -0.5, 4, 1)
      arena.tweens.add({ targets: g, x: para, duration: sorte(320, 520), ease: 'Quad.easeIn' })
    })
  }
  for (let i = 0; i < 12; i++) {
    m.depois(150 + i * 110, () => {
      const g = m.novo(arena.add.graphics().setDepth(FUNDO).setPosition(sorte(40, LARGURA - 40), -20))
      g.fillStyle(i % 2 ? 0xd8f05a : 0x8fe0ff, 1)
      g.fillEllipse(0, 0, 9, 30)
      g.lineStyle(1.5, 0x2a4a6a, 0.8)
      g.lineBetween(0, -16, 0, 18)
      arena.tweens.add({ targets: g, y: ALTURA + 30, duration: sorte(1500, 2100), ease: 'Sine.easeIn' })
      arena.tweens.add({ targets: g, x: g.x + sorte(30, 70) * (i % 2 ? 1 : -1), angle: sorte(40, 80), duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    })
  }
}

// ---------- Dess: holofotes, notas musicais quicando e ondas do amplificador ----------
function dess(arena, m) {
  ;[0xff5070, 0xffb03a, 0xffe14a].forEach((cor, k) => {
    const x = LARGURA * (0.2 + k * 0.3)
    const g = m.novo(arena.add.graphics().setDepth(FUNDO).setPosition(x, -10).setBlendMode(Phaser.BlendModes.ADD))
    g.fillStyle(cor, 0.22)
    g.fillTriangle(0, 0, -90, ALTURA + 40, 90, ALTURA + 40)
    g.setRotation((k - 1) * 0.35)
    arena.tweens.add({ targets: g, rotation: -(k - 1) * 0.35 + (k === 1 ? 0.3 : 0), duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  })
  for (let i = 0; i < 5; i++) {
    m.depois(i * 330, () => {
      const anel = m.novo(arena.add.circle(LARGURA / 2, m.cy, 30).setStrokeStyle(5, 0xff8a4a).setDepth(FUNDO))
      arena.tweens.add({ targets: anel, scale: 9, alpha: 0, duration: 700, ease: 'Quad.easeOut' })
      arena.cameras.main.shake(90, 0.006)
    })
  }
  for (let i = 0; i < 16; i++) {
    m.depois(i * 90, () => {
      const g = m.novo(arena.add.graphics().setDepth(i % 2 ? FRENTE : FUNDO).setPosition(sorte(50, LARGURA - 50), ALTURA + 20))
      const cor = [0xffb03a, 0xff5070, 0xffffff][i % 3]
      g.fillStyle(cor, 1)
      g.fillEllipse(0, 0, 14, 10)
      g.fillRect(5, -26, 3, 26)
      if (i % 2) {
        g.fillEllipse(24, -5, 14, 10)
        g.fillRect(29, -31, 3, 26)
        g.fillRect(5, -28, 27, 5)
      } else {
        g.fillTriangle(8, -26, 18, -16, 8, -18)
      }
      g.setScale(sorte(0.9, 1.5))
      arena.tweens.add({ targets: g, y: sorte(60, ALTURA - 120), duration: 520, ease: 'Back.easeOut' })
      arena.tweens.add({ targets: g, angle: sorte(-25, 25), scale: g.scale * 1.15, delay: 520, duration: 160, yoyo: true, repeat: 3 })
    })
  }
}

// ---------- Asriel: explosão de estrelas arco-íris e anel arco-íris ----------
function asriel(arena, m) {
  ARCO_IRIS.forEach((cor, k) => {
    const anel = m.novo(arena.add.circle(LARGURA / 2, m.cy, 20 + k * 6).setStrokeStyle(6, cor).setDepth(FUNDO).setScale(0.2))
    arena.tweens.add({ targets: anel, scale: 6 - k * 0.4, alpha: 0, delay: 150 + k * 60, duration: 1000, ease: 'Cubic.easeOut' })
  })
  for (let onda = 0; onda < 3; onda++) {
    m.depois(onda * 420, () => {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + onda * 0.2
        const g = m.novo(arena.add.graphics().setDepth(onda === 1 ? FRENTE : FUNDO).setPosition(LARGURA / 2, m.cy))
        g.fillStyle(ARCO_IRIS[(i + onda) % ARCO_IRIS.length], 1)
        estrela(g, 0, 0, sorte(7, 13))
        g.fillStyle(0xffffff, 0.8)
        g.fillCircle(0, 0, 2.5)
        const d = sorte(220, 380)
        arena.tweens.add({ targets: g, x: LARGURA / 2 + Math.cos(a) * d, y: m.cy + Math.sin(a) * d, angle: 360, alpha: 0, duration: 1000, ease: 'Cubic.easeOut' })
      }
      m.faiscas(LARGURA / 2, m.cy, ARCO_IRIS[onda * 2], 20)
    })
  }
}

// Sem motivo próprio: só faíscas na cor do personagem
function padrao(arena, m) {
  for (let i = 0; i < 6; i++) m.depois(i * 220, () => m.faiscas(sorte(80, LARGURA - 80), m.cy + sorte(-80, 80), m.cor, 18))
}

const MOTIVOS = { kris, susie, ralsei, noelle, berdly, dess, asriel }
export const motivoDe = (personagem) => MOTIVOS[personagem] ?? padrao
