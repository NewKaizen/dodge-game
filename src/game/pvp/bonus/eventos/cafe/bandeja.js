import { tocar } from '../../../../audio.js'
import { shake } from '../../../../effects/shake.js'
import { contextoDoCafe } from './util.js'
import { BANDEJA, novoBalanco, atualizarBalanco, suavizarJoy } from './planos.js'

// BANDEJA: o coração carrega uma bandeja com uma xícara de café cheia. Giro brusco, arrancada
// e freada fazem o café BALANÇAR (o medidor ao lado da caixa e a xícara que inclina mostram o
// quanto); balançou demais, DERRAMOU: dano pequeno (3% do HP máximo, mínimo 2), uma poça e um
// respiro de 1,5 s antes de poder derramar de novo. Andar liso (curvas abertas, sem tranco)
// deixa o balanço baixar sozinho. Para compensar, as balas andam um pouco mais devagar.
// A CPU suaviza o joystick (ela decide a cada ~100 ms e chacoalharia sem parar).
// terminar() devolve a velocidade do coração e apaga a xícara, os medidores e as poças.

const CAFE = 0x6a3a1e
const PORCELANA = 0xf6f4fa

export default function criar(arena) {
  const ctx = contextoDoCafe(arena)
  let ativo = false
  let t = 0
  let dt = 16
  let fatores = []
  // por pista: { pista, g, medidor, rotulo, est, ultimo, liso, pocas, gotas }
  let lados = []

  const derramar = (s, j, c) => {
    const machucou = ctx.ehMeu(j) && ctx.machucar(j, BANDEJA.dano, c)
    s.pocas.push({ x: c.x, y: c.y + 4, t0: t, r: 11 + Math.random() * 4 })
    for (let k = 0; k < 9; k++) s.gotas.push({ x: c.x, y: c.y - 14, vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 70, t0: t })
    tocar(arena, 'splat')
    if (machucou) shake(arena, 120, 0.004)
  }

  const desenhar = (s, c) => {
    const g = s.g
    g.clear()
    // poças de café (por baixo)
    s.pocas = s.pocas.filter((p) => t - p.t0 < 1500)
    for (const p of s.pocas) {
      const k = (t - p.t0) / 1500
      g.fillStyle(CAFE, 0.55 * (1 - k * k)).fillEllipse(p.x, p.y, p.r * 2 * (0.6 + 0.4 * Math.min(1, k * 6)), p.r * 1.1)
    }
    s.gotas = s.gotas.filter((p) => t - p.t0 < 600)
    for (const p of s.gotas) {
      const k = (t - p.t0) / 1000
      g.fillStyle(CAFE, 1 - k).fillCircle(p.x + p.vx * k, p.y + p.vy * k + 260 * k * k, 2)
    }
    if (!c) return
    const w = s.est.w
    const balanco = Math.sin(t / 55) * w * 0.55 + Math.sin(t / 23) * w * 0.15
    // bandeja de prata embaixo do coração
    g.fillStyle(0x000000, 0.28).fillEllipse(c.x, c.y + 9, 30, 8)
    g.fillStyle(0xaab4c4, 1).fillEllipse(c.x, c.y + 7, 30, 8)
    g.fillStyle(0xe8eef8, 1).fillEllipse(c.x, c.y + 6, 26, 6)
    g.lineStyle(1, 0x6a7488, 1).strokeEllipse(c.x, c.y + 7, 30, 8)
    // xícara em cima, inclinando com o balanço
    const cx = c.x
    const cy = c.y - 13
    const sen = Math.sin(balanco)
    const cos = Math.cos(balanco)
    const pt = (px, py) => ({ x: cx + px * cos - py * sen, y: cy + px * sen + py * cos })
    const corpo = [pt(-7, -6), pt(7, -6), pt(5.5, 5), pt(-5.5, 5)]
    g.fillStyle(PORCELANA, 1).fillPoints(corpo, true)
    g.lineStyle(1, 0x8a90a8, 1).strokePoints(corpo, true)
    const a = pt(7, -2)
    g.lineStyle(2, PORCELANA, 1).strokeCircle(a.x + 2.2, a.y + 1, 2.6)
    // café: a superfície inclina para o lado contrário e sobe com o balanço
    const nivel = -5.4 - Math.min(2.5, w * 3)
    const l1 = pt(-6.4, nivel + w * 3.2)
    const l2 = pt(6.4, nivel - w * 3.2)
    g.fillStyle(CAFE, 1).fillPoints([l1, l2, pt(6.4, -5.4), pt(-6.4, -5.4)], true)
    g.fillStyle(0xa8683a, 1).fillCircle(cx + sen * 3, cy - 5.8, 1.4)
    // gotinhas sobem quando está quase derramando
    if (w > 0.7 && Math.sin(t / 40) > 0.2) g.fillStyle(CAFE, 1).fillCircle(cx + (Math.random() - 0.5) * 10, cy - 8 - Math.random() * 4, 1.4)
  }

  const desenharMedidor = (s) => {
    const l = s.pista.caixa.limites
    const w = s.est.w
    const perigo = w > 0.7
    const pisca = perigo && Math.sin(t / 60) > 0
    const g = s.medidor
    const x = l.centerX - 55
    const y = l.bottom + 9
    g.clear()
    g.fillStyle(0x000000, 0.75).fillRoundedRect(x - 3, y - 3, 116, 14, 4)
    g.fillStyle(0x2a2030, 1).fillRoundedRect(x, y, 110, 8, 3)
    const cor = w < 0.5 ? 0x7fe08a : w < 0.75 ? 0xffd040 : pisca ? 0xffffff : 0xff4a3a
    g.fillStyle(cor, 1).fillRoundedRect(x, y, Math.max(2, 110 * Math.min(1, w)), 8, 3)
    g.lineStyle(1, 0xffffff, 0.5).lineBetween(x + 110 * 0.75, y, x + 110 * 0.75, y + 8)
    s.rotulo.setPosition(l.centerX, y + 19).setText(perigo ? 'VAI DERRAMAR! ANDE LISO' : 'BALANÇO DO CAFÉ').setColor(perigo ? '#ff9a80' : '#ffe9c8')
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      fatores = arena.pistas.map((p) => p.fatorCoracao)
      arena.pistas.forEach((p) => (p.fatorCoracao /= BANDEJA.relogioDasBalas)) // as balas ficam mais lentas; o coração não
      lados = arena.pistas.map((pista) => ({
        pista,
        g: ctx.naCaixa(pista, arena.add.graphics().setDepth(11)),
        medidor: ctx.naTela(arena.add.graphics().setDepth(70)),
        rotulo: ctx.texto(0, 0, 'BALANÇO DO CAFÉ', { cor: '#ffe9c8', tamanho: 9, profundidade: 70 }),
        est: novoBalanco(),
        ultimo: null,
        liso: { x: 0, y: 0 },
        pocas: [],
        gotas: [],
      }))
      ctx.instrucao('ANDE LISO: A XÍCARA DERRAMA!', { cor: '#ffe9c8' })
    },

    passo(j, delta) {
      return ativo ? delta * BANDEJA.relogioDasBalas : delta
    },

    // CPU: joystick suavizado (ela troca de direção a cada decisão)
    joy(j, joy) {
      if (!ativo || ctx.dono(j) !== arena.cpu) return joy
      const s = lados[j]
      if (!s) return joy
      s.liso = suavizarJoy(s.liso, joy, dt, 6)
      return s.liso
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      dt = delta
      lados.forEach((s, j) => {
        const c = ctx.coracao(j)
        const valendo = Boolean(c) && ctx.pistaViva(j)
        if (valendo) {
          if (s.ultimo) {
            const { derramou } = atualizarBalanco(s.est, { dx: c.x - s.ultimo.x, dy: c.y - s.ultimo.y, dtMs: delta, t, velMax: s.pista.velocidadeCoracao })
            if (derramou) derramar(s, j, c)
          }
          s.ultimo = { x: c.x, y: c.y }
        } else {
          s.ultimo = null
          s.est.w = Math.max(0, s.est.w - (BANDEJA.decaiPorS * delta) / 1000)
        }
        desenhar(s, valendo ? c : null)
        desenharMedidor(s)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), balanco: lados.map((s) => Math.round(s.est.w * 100) / 100) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      arena.pistas.forEach((p, j) => (p.fatorCoracao = fatores[j] ?? 1))
      lados = []
      ctx.limpar()
    },
  }
}
