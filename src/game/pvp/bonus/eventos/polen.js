import Phaser from 'phaser'
import { FONTE } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { particulas } from '../../../effects/particulas.js'

// ESPIRRO DE PÓLEN (arena JARDIM): o ar das caixas está cheio de pólen e ele
// vai se juntando em volta do coração (os pontinhos amarelos chegam cada vez
// mais perto). Aí vem o aviso: "a..." ... "a... a..." (uma seta pisca em
// volta do coração mostrando para ONDE o espirro vai jogar) ... "ATCHIM!": o
// coração dá um TRANCO naquela direção (por um instante anda bem mais rápido
// e não obedece o direcional) e o pólen voa para o outro lado.
// A direção é sorteada a cada espirro (a mesma nas duas caixas) e aparece
// antes: dá para se posicionar com espaço livre para o lado da seta.
// A CPU espirra igual (o tranco passa pelo joystick dela também).

const CICLO = { min: 2700, max: 3500 } // ms entre espirros
const PRIMEIRO = 1900
const AVISO1_MS = 1300 // "a..." (antes do espirro)
const AVISO2_MS = 750 // "a... a..." + seta (a direção já está valendo)
const TRANCO = { ms: 230, fator: 2.6 } // duração e multiplicador da velocidade do coração
const POLEN = 16 // pontinhos por caixa
const AMARELO = 0xffe680
const DIRECOES = Array.from({ length: 8 }, (_, k) => ({ x: Math.round(Math.cos((k * Math.PI) / 4) * 1000) / 1000, y: Math.round(Math.sin((k * Math.PI) / 4) * 1000) / 1000, k }))

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + sorte() * (b - a)
  let ativo = false
  let t = 0
  let espirroEm = 0
  let aviso = 0 // 0 nada, 1 "a...", 2 "a... a..."
  let dir = DIRECOES[0]
  let tranco = null // { ate, bases: [fatorCoracao de cada pista] }
  let caixas = [] // por pista: { pista, polen: [{ obj, ... }], seta, fala }
  let textos = []

  const criarCaixa = (pista) => {
    const l = pista.caixa.limites
    const polen = Array.from({ length: POLEN }, () => {
      const obj = arena.add.rectangle(0, 0, 2, 2, AMARELO).setDepth(4).setAlpha(0.8)
      pista.caixa.recortar(obj)
      return { obj, x: l.left + sorte() * l.width, y: l.top + sorte() * l.height, fase: entre(0, 6.3), r: entre(20, 70), giro: entre(1.2, 2.4) * (sorte() < 0.5 ? -1 : 1) }
    })
    const seta = arena.add.graphics().setDepth(11)
    const fala = arena.add
      .text(0, 0, '', { fontFamily: FONTE, fontSize: '12px', color: '#fff3b0', stroke: '#000000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(14)
    pista.caixa.recortar(seta, fala)
    return { pista, polen, seta, fala }
  }

  // quanto o pólen já se juntou em volta do coração (0 logo depois do espirro, 1 na hora do espirro)
  const acumulo = (inicio) => Phaser.Math.Clamp((t - inicio) / Math.max(1, espirroEm - inicio), 0, 1)
  let inicioCiclo = 0

  const moverPolen = (cx, delta) => {
    const l = cx.pista.caixa.limites
    const c = cx.pista.coracoes[0]
    const k = acumulo(inicioCiclo)
    const s = t / 1000
    for (const p of cx.polen) {
      let alvoX
      let alvoY
      if (c?.ativo && !tranco) {
        // girando em volta do coração, cada vez mais perto
        const r = p.r * (1 - k * 0.7) + 6
        const a = s * p.giro + p.fase
        alvoX = c.x + Math.cos(a) * r
        alvoY = c.y + Math.sin(a) * r
      } else {
        alvoX = p.x + Math.sin(s + p.fase) * 10
        alvoY = p.y + Math.cos(s * 1.3 + p.fase) * 10
      }
      const kk = Math.min(1, delta / (tranco ? 1200 : 380 - k * 200))
      p.x += (alvoX - p.x) * kk
      p.y += (alvoY - p.y) * kk
      p.x = Phaser.Math.Clamp(p.x, l.left + 2, l.right - 2)
      p.y = Phaser.Math.Clamp(p.y, l.top + 2, l.bottom - 2)
      p.obj.setPosition(p.x, p.y).setAlpha(0.45 + k * 0.5).setScale(1 + k * 0.6)
    }
  }

  const desenharAviso = (cx) => {
    const c = cx.pista.coracoes[0]
    const l = cx.pista.caixa.limites
    cx.seta.clear()
    if (!c?.ativo || !aviso || tranco) {
      cx.fala.setText('')
      return
    }
    const treme = aviso === 2 ? Math.sin(t / 25) * 1.2 : 0
    cx.fala
      .setText(aviso === 1 ? 'a...' : 'a... a...')
      // a fala fica do lado contrário da seta quando a seta aponta para cima
      .setPosition(Phaser.Math.Clamp(c.x, l.left + 34, l.right - 34) + treme, aviso === 2 && dir.y < -0.5 ? Math.min(l.bottom - 10, c.y + 22) : Math.max(l.top + 10, c.y - 22))
      .setScale(aviso === 2 ? 1.15 : 1)
    if (aviso !== 2) return
    // seta piscando em volta do coração: para onde o espirro vai jogar
    const pisca = Math.sin(t / 60) > 0 ? 1 : 0.4
    const a = Math.atan2(dir.y, dir.x)
    const p = (dx, dy) => ({ x: c.x + Math.cos(a) * dx - Math.sin(a) * dy, y: c.y + Math.sin(a) * dx + Math.cos(a) * dy })
    const forma = [p(14, -4), p(28, -4), p(28, -10), p(42, 0), p(28, 10), p(28, 4), p(14, 4)]
    cx.seta.fillStyle(AMARELO, pisca).fillPoints(forma, true)
    cx.seta.lineStyle(1.5, 0x5a3a00, pisca).strokePoints(forma, true)
  }

  const espirrar = () => {
    tocar(arena, 'atchim')
    shake(arena, 180, 0.006)
    tranco = { ate: t + TRANCO.ms, bases: arena.pistas.map((p) => p.fatorCoracao) }
    arena.pistas.forEach((p) => (p.fatorCoracao = p.fatorCoracao * TRANCO.fator))
    for (const cx of caixas) {
      const c = cx.pista.coracoes[0]
      const l = cx.pista.caixa.limites
      // o pólen voa para o lado contrário do tranco
      for (const p of cx.polen) {
        p.x -= dir.x * entre(20, 60) + entre(-15, 15)
        p.y -= dir.y * entre(20, 60) + entre(-15, 15)
      }
      if (c?.ativo) particulas(arena, c.x - dir.x * 8, c.y - dir.y * 8, { cor: AMARELO, quantidade: 14, velocidade: 140 })
      const tamanho = Math.round(Math.min(48, l.width / 4.6))
      const txt = arena.add
        .text(l.centerX, l.centerY, 'ATCHIM!', { fontFamily: FONTE, fontSize: `${tamanho}px`, color: '#ffe680', stroke: '#5a3a00', strokeThickness: Math.round(tamanho / 8) })
        .setOrigin(0.5)
        .setDepth(4) // por baixo das balas: o carimbo não esconde nada
        .setAngle(entre(-8, 8))
      cx.pista.caixa.recortar(txt)
      textos.push(txt)
      arena.tweens.add({ targets: txt, scale: { from: 2.2, to: 1 }, alpha: { from: 0.4, to: 0.75 }, duration: 160, ease: 'Back.easeOut' })
      arena.tweens.add({ targets: txt, alpha: 0, scale: 1.1, delay: 550, duration: 350, onComplete: () => txt.destroy() })
    }
  }

  const fimTranco = () => {
    if (!tranco) return
    arena.pistas.forEach((p, j) => (p.fatorCoracao = tranco.bases[j]))
    tranco = null
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      inicioCiclo = 0
      espirroEm = PRIMEIRO
      aviso = 0
      caixas = arena.pistas.map(criarCaixa)
    },

    // no tranco o espirro manda: o coração vai na direção da seta, rápido
    joy(j, joy) {
      if (!ativo || !tranco || arena.ko?.[j]) return joy
      return { x: dir.x * 100, y: dir.y * 100 }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      if (tranco && t >= tranco.ate) fimTranco()
      if (aviso === 0 && t >= espirroEm - AVISO1_MS) {
        aviso = 1
        tocar(arena, 'inspirar', { altura: 0 })
      }
      if (aviso === 1 && t >= espirroEm - AVISO2_MS) {
        aviso = 2
        const opcoes = DIRECOES.filter((d) => d.k !== dir.k)
        dir = opcoes[Math.floor(sorte() * opcoes.length)]
        tocar(arena, 'inspirar', { altura: 1 })
      }
      if (t >= espirroEm) {
        aviso = 0
        espirrar()
        inicioCiclo = t
        espirroEm = t + entre(CICLO.min, CICLO.max)
      }
      for (const cx of caixas) {
        moverPolen(cx, delta)
        desenharAviso(cx)
      }
    },

    estadoDebug() {
      return { aviso, tranco: Boolean(tranco), dir: { x: dir.x, y: dir.y }, faltaMs: Math.round(espirroEm - t), fator: arena.pistas.map((p) => p.fatorCoracao) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      fimTranco()
      for (const cx of caixas) {
        cx.polen.forEach((p) => p.obj.destroy())
        cx.seta.destroy()
        cx.fala.destroy()
      }
      caixas = []
      textos.forEach((x) => {
        arena.tweens.killTweensOf(x)
        if (x.scene) x.destroy()
      })
      textos = []
    },
  }
}
