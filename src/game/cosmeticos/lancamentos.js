// EFEITOS DE LANÇAMENTO: o floreio de quando uma carta é jogada/lançada (≤ 900 ms).
//
//   animarLancamento(scene, { x, y, alvoX, alvoY, cor }, id) -> Promise<void>
//
// A promessa sempre resolve (ao terminar, ao fechar a cena ou se der erro): nunca trava a jogada.
// Cada animação é uma função (ctx) -> quadro(k, ms), k de 0 a 1 ao longo da duração `dur`.
// ctx = { scene, c, g, ga, x, y, ax, ay, dx, dy, dist, ang, cor, img(textura, blend) }
import { fatores } from '../acessibilidade.js'
import { ADD, MAX_PARTICULAS, TAU, aleatorio, garantirTexturas, hsl, ligarAtualizacao, mistura, misturar, quantasParticulas, reduzido } from './util.js'

const suave = (k) => k * k * (3 - 2 * k)
const saida = (k) => 1 - (1 - k) ** 3
const entrada = (k) => k * k
const lim = (k) => Math.min(1, Math.max(0, k))
const faixaK = (k, a, b) => lim((k - a) / (b - a))
const clarao = () => {
  try {
    return fatores().clarao
  } catch {
    return 1
  }
}

// n imagens (limitadas) com um estado por partícula
function bando(ctx, n, textura, blend, init) {
  const total = Math.min(MAX_PARTICULAS, quantasParticulas(n))
  const lista = []
  for (let i = 0; i < total; i++) {
    const p = { s: ctx.img(textura, blend), i, n: total }
    init(p, i, total)
    lista.push(p)
  }
  return lista
}

const LANCAMENTOS_DEF = {
  'lancamento-padrao': {
    dur: 380,
    criar(ctx) {
      const anel = ctx.img('cosm-anel')
      return (k) => {
        const { x, y, ax, ay, ga, cor } = ctx
        anel.setPosition(x, y).setScale(0.15 + saida(k) * 0.7).setAlpha((1 - k) * 0.9).setTint(cor)
        const cab = saida(faixaK(k, 0, 0.8))
        ga.lineStyle(3, cor, (1 - k) * 0.8)
        ga.beginPath()
        ga.moveTo(x + (ax - x) * Math.max(0, cab - 0.35), y + (ay - y) * Math.max(0, cab - 0.35))
        ga.lineTo(x + (ax - x) * cab, y + (ay - y) * cab)
        ga.strokePath()
      }
    },
  },

  'lancamento-explosao': {
    dur: 800,
    criar(ctx) {
      const flash = ctx.img('cosm-glow')
      const onda = ctx.img('cosm-anel')
      const onda2 = ctx.img('cosm-anel')
      const impacto = ctx.img('cosm-anel')
      const centelhas = bando(ctx, 30, 'cosm-ponto', ADD, (p) => {
        const a = aleatorio(0, TAU)
        Object.assign(p, { a, v: aleatorio(90, 330), tam: aleatorio(0.4, 1), cor: Math.random() < 0.5 ? 0xffd34d : 0xff7a2a })
      })
      const cl = clarao()
      return (k) => {
        const { x, y, ax, ay, ga } = ctx
        flash.setPosition(x, y).setScale(0.5 + saida(faixaK(k, 0, 0.35)) * 5).setAlpha((1 - faixaK(k, 0, 0.35)) * cl).setTint(0xfff0b0)
        onda.setPosition(x, y).setScale(0.2 + saida(k) * 3.6).setAlpha((1 - k) * 0.95).setTint(0xffa030)
        onda2.setPosition(x, y).setScale(0.1 + saida(faixaK(k, 0.05, 1)) * 2.2).setAlpha((1 - k) * 0.8).setTint(0xffffff)
        for (const p of centelhas) {
          const d = p.v * saida(k) * 0.8
          p.s.setPosition(x + Math.cos(p.a) * d, y + Math.sin(p.a) * d + 60 * k * k)
          p.s.setScale(p.tam * (1 - k) * 1.1).setAlpha(1 - k * 0.8).setTint(p.cor)
        }
        // faísca viaja até o alvo e estoura lá, menor
        const cab = faixaK(k, 0.05, 0.5)
        ga.lineStyle(5, 0xffb040, (1 - k) * 0.9)
        ga.beginPath()
        ga.moveTo(x + (ax - x) * Math.max(0, cab - 0.3), y + (ay - y) * Math.max(0, cab - 0.3))
        ga.lineTo(x + (ax - x) * cab, y + (ay - y) * cab)
        ga.strokePath()
        const ki = faixaK(k, 0.45, 1)
        impacto.setPosition(ax, ay).setScale(0.1 + saida(ki) * 1.6).setAlpha(ki > 0 ? (1 - ki) * 0.9 : 0).setTint(0xffe080)
      }
    },
  },

  'lancamento-arco-iris-borboletas': {
    dur: 900,
    criar(ctx) {
      const borboletas = bando(ctx, 9, 'cosm-borboleta', 'NORMAL', (p, i, n) => {
        Object.assign(p, { nasce: 0.05 + (i / n) * 0.45, ang: aleatorio(-Math.PI, 0), voo: aleatorio(50, 120), hue: (i / n) * 360, fase: aleatorio(0, TAU), tam: aleatorio(0.9, 1.4) })
      })
      const pos = (k) => {
        const e = suave(lim(k))
        return { x: ctx.x + ctx.dx * e, y: ctx.y + ctx.dy * e - Math.sin(e * Math.PI) * 30 }
      }
      return (k) => {
        const { g, ga } = ctx
        const cab = faixaK(k, 0, 0.55)
        const N = 22
        const ponta = lim(cab)
        for (let i = 0; i < N; i++) {
          const k1 = ponta * (1 - i / N) - 0.0
          const k2 = ponta * (1 - (i + 1) / N)
          if (k1 <= 0) continue
          const a = pos(k1)
          const b = pos(Math.max(0, k2))
          const fade = (1 - i / N) * (1 - faixaK(k, 0.6, 1))
          const larg = 3 + 10 * (1 - i / N)
          for (const [l, al, alvo] of [[larg * 2, 0.22, ga], [larg, 1, g]]) {
            alvo.lineStyle(l, hsl(k1 * 540 + k * 200, 1, 0.58), al * fade)
            alvo.beginPath()
            alvo.moveTo(a.x, a.y)
            alvo.lineTo(b.x, b.y)
            alvo.strokePath()
          }
        }
        for (const p of borboletas) {
          const kk = k - p.nasce
          if (kk <= 0) {
            p.s.setAlpha(0)
            continue
          }
          const base = pos(p.nasce)
          const d = p.voo * saida(kk / 0.5)
          p.s.setPosition(base.x + Math.cos(p.ang) * d + Math.sin(kk * 14 + p.fase) * 8, base.y + Math.sin(p.ang) * d - kk * 40)
          p.s.setScale(p.tam * (0.35 + 0.65 * Math.abs(Math.cos(kk * 38 + p.fase))), p.tam)
          p.s.setAlpha(Math.min(1, kk * 8) * (1 - faixaK(k, 0.78, 1)))
          p.s.setTint(hsl(p.hue + k * 120, 1, 0.65))
          p.s.setRotation(Math.sin(kk * 9 + p.fase) * 0.4)
        }
      }
    },
  },

  'lancamento-tsunami': {
    dur: 880,
    criar(ctx) {
      // o container gira: +x = rumo ao alvo (visto de cima: cristas em forma de lua crescente)
      ctx.c.setPosition(ctx.x, ctx.y).setRotation(ctx.ang)
      const espuma = bando(ctx, 24, 'cosm-ponto', 'NORMAL', (p, i, n) => {
        Object.assign(p, { ang: (i / n - 0.5) * 2.1, fase: aleatorio(0, TAU), tam: aleatorio(0.4, 0.9), solta: aleatorio(0, 1) })
      })
      const cresc = (g, cx, r, esp, cor, alfa, a) => {
        const pts = []
        for (let i = 0; i <= 14; i++) {
          const t = -a + (2 * a * i) / 14
          pts.push({ x: cx + Math.cos(t) * r, y: Math.sin(t) * r })
        }
        for (let i = 14; i >= 0; i--) {
          const t = -a + (2 * a * i) / 14
          pts.push({ x: cx - esp + Math.cos(t) * (r - 6), y: Math.sin(t) * (r - 6) })
        }
        g.fillStyle(cor, alfa)
        g.fillPoints(pts, true)
      }
      return (k, t) => {
        const { g } = ctx
        const dist = Math.max(80, ctx.dist)
        const frente = 20 + (dist + 60) * saida(faixaK(k, 0, 0.88))
        const alfa = 1 - faixaK(k, 0.8, 1)
        const R = 96
        const camadas = [[0x0d3f9a, 62], [0x1768d0, 46], [0x2e92f0, 32], [0x7ccaff, 20], [0xe6f7ff, 9]]
        // da mais funda (atrás) à espuma branca (na frente)
        camadas.forEach(([cor, esp], j) => {
          const ond = Math.sin(t / 110 + j) * 3
          cresc(g, frente - 48 - (camadas.length - 1 - j) * 15 + ond, R - j * 2, esp, cor, 0.92 * alfa, 1.12 - j * 0.04)
        })
        for (const p of espuma) {
          const a = p.ang * 0.98
          const px = frente - 48 + Math.cos(a) * (R + 4 + Math.sin(t / 70 + p.fase) * 4) + 3
          const py = Math.sin(a) * (R + 4)
          p.s.setPosition(px - p.solta * 18 * Math.abs(Math.sin(t / 200 + p.fase)), py + Math.cos(t / 80 + p.fase) * 3)
          p.s.setScale(p.tam * 1.3).setAlpha(alfa).setTint(0xffffff)
        }
      }
    },
  },

  'lancamento-confete': {
    dur: 900,
    criar(ctx) {
      const cores = [0xff4f6d, 0xffd34d, 0x4fd8ff, 0x7be04f, 0xc86bff, 0xffffff]
      const peca = (p, i, n, seg) => {
        Object.assign(p, {
          seg,
          a: ctx.ang + aleatorio(-0.55, 0.55),
          v: aleatorio(300, 760) * (seg ? 0.55 : 1),
          giro: aleatorio(-14, 14),
          fase: aleatorio(0, TAU),
          cor: cores[i % cores.length],
          tam: aleatorio(1.8, 3.2),
        })
        p.s.setTint(p.cor)
      }
      const A = bando(ctx, 26, 'cosm-quad', 'NORMAL', (p, i, n) => peca(p, i, n, 0))
      const B = bando(ctx, 12, 'cosm-quad', 'NORMAL', (p, i, n) => peca(p, i, n, 1))
      const estouro = ctx.img('cosm-glow')
      const estrela = ctx.img('cosm-estrela')
      return (k) => {
        const { x, y, ax, ay } = ctx
        const cl = clarao()
        estouro.setPosition(x, y).setScale(0.4 + saida(faixaK(k, 0, 0.2)) * 2).setAlpha((1 - faixaK(k, 0, 0.2)) * 0.9 * cl).setTint(0xfff3a0)
        estrela.setPosition(x, y).setScale(0.6 + faixaK(k, 0, 0.25) * 1.8).setAlpha(1 - faixaK(k, 0, 0.3)).setRotation(k * 3)
        const mover = (lista, k0, ox, oy) => {
          for (const p of lista) {
            const kk = k - k0
            if (kk < 0) {
              p.s.setAlpha(0)
              continue
            }
            const t = kk * 0.9
            const arrasto = 1 - Math.exp(-3.2 * t)
            p.s.setPosition(ox + (Math.cos(p.a) * p.v * arrasto) / 3.2, oy + (Math.sin(p.a) * p.v * arrasto) / 3.2 + 520 * t * t * 0.5)
            p.s.setRotation(p.fase + t * p.giro)
            p.s.setScale(p.tam * (0.25 + 0.75 * Math.abs(Math.cos(p.fase + t * 11))) * 1.7, p.tam * 1.7)
            p.s.setAlpha(1 - faixaK(k, 0.78, 1))
          }
        }
        mover(A, 0, x, y)
        mover(B, 0.5, ax, ay)
      }
    },
  },

  'lancamento-raio': {
    dur: 650,
    criar(ctx) {
      const caminho = () => {
        const topo = ctx.ay - 330
        const pts = [{ x: ctx.ax + aleatorio(-40, 40), y: topo }]
        const n = 11
        for (let i = 1; i < n; i++) {
          const f = i / n
          pts.push({ x: ctx.ax + aleatorio(-26, 26) * (1 - f), y: topo + (ctx.ay - topo) * f })
        }
        pts.push({ x: ctx.ax, y: ctx.ay })
        return pts
      }
      let bolt = caminho()
      let troca = 0
      const flash = ctx.img('cosm-glow')
      const solo = ctx.img('cosm-glow')
      const onda = ctx.img('cosm-anel')
      const fagulhas = bando(ctx, 16, 'cosm-ponto', ADD, (p) => Object.assign(p, { a: aleatorio(-Math.PI, 0.3), v: aleatorio(60, 230), tam: aleatorio(0.4, 0.9) }))
      return (k, t) => {
        const { g, ga, ax, ay, x, y } = ctx
        const cl = clarao()
        if (k < 0.18) {
          // carga: crepitar do ponto de partida até o alvo
          ga.lineStyle(2, 0x9be8ff, 0.8)
          ga.beginPath()
          ga.moveTo(x, y)
          for (let i = 1; i <= 6; i++) ga.lineTo(x + (ax - x) * (i / 6) + aleatorio(-8, 8), y + (ay - y) * (i / 6) + aleatorio(-8, 8))
          ga.strokePath()
        }
        const golpe = faixaK(k, 0.16, 0.2)
        const vive = k > 0.16 && k < 0.7
        if (t > troca) {
          troca = t + 55
          if (vive) bolt = bolt.map((p, i) => (i === 0 || i === bolt.length - 1 ? p : { x: p.x + aleatorio(-6, 6), y: p.y }))
        }
        if (vive) {
          const al = 1 - faixaK(k, 0.45, 0.7)
          const linha = (larg, cor, a, alvo, desvio = 0) => {
            alvo.lineStyle(larg, cor, a * al)
            alvo.beginPath()
            bolt.forEach((p, i) => (i ? alvo.lineTo(p.x + desvio, p.y) : alvo.moveTo(p.x + desvio, p.y)))
            alvo.strokePath()
          }
          linha(30, 0x3aa0ff, 0.3, ga)
          linha(14, 0x9be8ff, 0.65, ga)
          linha(6, 0xffffff, 1, g)
          // galho
          const b0 = bolt[5]
          ga.lineStyle(3, 0xbfeaff, 0.8 * al)
          ga.beginPath()
          ga.moveTo(b0.x, b0.y)
          ga.lineTo(b0.x + 34, b0.y + 26)
          ga.lineTo(b0.x + 24, b0.y + 54)
          ga.lineTo(b0.x + 50, b0.y + 80)
          ga.strokePath()
        }
        flash.setPosition(ax, ay - 40).setScale(2 + golpe * 4).setAlpha(vive ? (1 - faixaK(k, 0.2, 0.7)) * 0.9 * cl : 0).setTint(0xcfeaff)
        solo.setPosition(ax, ay).setScale(1.4).setAlpha(vive ? 0.9 * (1 - faixaK(k, 0.3, 0.7)) : 0).setTint(0x6ac0ff)
        const ko = faixaK(k, 0.18, 1)
        onda.setPosition(ax, ay).setScale(0.1 + saida(ko) * 2.2).setAlpha(k > 0.18 ? (1 - ko) * 0.9 : 0).setTint(0xaee0ff)
        for (const p of fagulhas) {
          if (k < 0.18) {
            p.s.setAlpha(0)
            continue
          }
          const d = p.v * saida(ko)
          p.s.setPosition(ax + Math.cos(p.a) * d, ay + Math.sin(p.a) * d + 90 * ko * ko)
          p.s.setScale(p.tam * (1 - ko)).setAlpha(1 - ko).setTint(0xcfeaff)
        }
      }
    },
  },

  'lancamento-buraco-negro': {
    dur: 900,
    criar(ctx) {
      const aneis = [ctx.img('cosm-anel'), ctx.img('cosm-anel')]
      const miolo = ctx.img('cosm-glow')
      const poeira = bando(ctx, 30, 'cosm-ponto', ADD, (p, i, n) => {
        Object.assign(p, { a0: (i / n) * TAU * 2, r0: aleatorio(70, 150), atraso: (i % 10) * 0.035, cor: i % 3 ? 0xb06bff : 0xff9a3a, tam: aleatorio(0.5, 1) })
      })
      return (k) => {
        const { g, ga, ax, ay } = ctx
        const cresce = saida(faixaK(k, 0, 0.35))
        const implode = faixaK(k, 0.7, 0.92)
        const raio = 34 * cresce * (1 - suave(implode)) + 4 * implode
        // disco de acreção (elipses giratórias)
        for (let i = 0; i < 3; i++) {
          const rr = (raio + 12 + i * 9) * (1 + 0.1 * Math.sin(k * 20 + i))
          ga.lineStyle(4 - i, i % 2 ? 0xff9a3a : 0xb06bff, (0.85 - i * 0.2) * (1 - faixaK(k, 0.88, 1)))
          ga.strokeEllipse(ax, ay, rr * 2.4, rr * 0.9)
        }
        g.fillStyle(0x000000, 1 - faixaK(k, 0.9, 1))
        g.fillCircle(ax, ay, raio)
        ga.lineStyle(2, 0xffffff, 0.7 * (1 - faixaK(k, 0.88, 1)))
        ga.strokeCircle(ax, ay, raio + 1)
        // anéis que encolhem (sucção) e depois o estouro de luz
        aneis[0].setPosition(ax, ay).setScale(2.6 * (1 - saida(faixaK(k, 0.05, 0.85))) + 0.1).setAlpha(k < 0.85 ? 0.7 * Math.min(1, k * 5) : 0).setTint(0xb06bff)
        aneis[1].setPosition(ax, ay).setScale(0.2 + saida(faixaK(k, 0.88, 1)) * 2.6).setAlpha(k > 0.88 ? (1 - faixaK(k, 0.88, 1)) * 0.9 * clarao() : 0).setTint(0xffffff)
        miolo.setPosition(ax, ay).setScale(1.2 + implode * 2).setAlpha(implode * (1 - faixaK(k, 0.9, 1)) * 0.9 * clarao()).setTint(0xe0c8ff)
        for (const p of poeira) {
          const kk = lim((k - p.atraso) / 0.75)
          const r = p.r0 * (1 - suave(kk)) + 2
          const a = p.a0 + kk * 7
          p.s.setPosition(ax + Math.cos(a) * r * 1.2, ay + Math.sin(a) * r * 0.55)
          p.s.setScale(p.tam * (0.4 + (1 - kk) * 0.8)).setAlpha(k - p.atraso < 0 ? 0 : (1 - faixaK(kk, 0.85, 1))).setTint(p.cor)
        }
      }
    },
  },

  'lancamento-sakura': {
    dur: 900,
    criar(ctx) {
      const rosas = [0xffc2d9, 0xff9ec4, 0xffd9e6, 0xff7fb0]
      const petalas = bando(ctx, 34, 'cosm-petala', 'NORMAL', (p, i) => {
        Object.assign(p, { a: aleatorio(0, TAU), v: aleatorio(40, 140), fase: aleatorio(0, TAU), giro: aleatorio(-6, 6), tam: aleatorio(0.7, 1.3), cor: rosas[i % rosas.length], atraso: aleatorio(0, 0.2) })
      })
      const luz = ctx.img('cosm-glow')
      return (k) => {
        const { x, y, dx, dy } = ctx
        luz.setPosition(x, y).setScale(1 + saida(faixaK(k, 0, 0.3)) * 2).setAlpha((1 - faixaK(k, 0, 0.35)) * 0.8 * clarao()).setTint(0xffb8d8)
        for (const p of petalas) {
          const kk = lim((k - p.atraso) / (1 - p.atraso))
          const exp = saida(faixaK(kk, 0, 0.4))
          const vento = suave(faixaK(kk, 0.15, 1))
          const px = x + Math.cos(p.a) * p.v * exp + dx * vento * 0.85 + Math.sin(kk * 9 + p.fase) * 12
          const py = y + Math.sin(p.a) * p.v * exp + dy * vento * 0.85 + Math.cos(kk * 7 + p.fase) * 9 + kk * 30
          p.s.setPosition(px, py)
          p.s.setRotation(p.fase + kk * p.giro)
          p.s.setScale(p.tam * (0.45 + 0.55 * Math.abs(Math.cos(kk * 8 + p.fase))), p.tam)
          p.s.setAlpha(Math.min(1, kk * 10) * (1 - faixaK(kk, 0.78, 1)))
          p.s.setTint(p.cor)
        }
      }
    },
  },

  'lancamento-meteoro': {
    dur: 880,
    criar(ctx) {
      const sx = ctx.ax - 240
      const sy = ctx.ay - 340
      const pos = (k) => ({ x: mistura(sx, ctx.ax, entrada(k)), y: mistura(sy, ctx.ay, entrada(k)) })
      const rastro = bando(ctx, 12, 'cosm-glow', ADD, () => {})
      const fogo = ctx.img('cosm-glow')
      const rocha = ctx.img('cosm-lua', 'NORMAL')
      const onda = ctx.img('cosm-anel')
      const flash = ctx.img('cosm-glow')
      const detritos = bando(ctx, 18, 'cosm-ponto', ADD, (p) => Object.assign(p, { a: aleatorio(-Math.PI, 0), v: aleatorio(80, 300), tam: aleatorio(0.5, 1.1), cor: Math.random() < 0.5 ? 0xffc040 : 0xff6a2a }))
      return (k) => {
        const queda = faixaK(k, 0, 0.55)
        const bate = faixaK(k, 0.55, 1)
        const m = pos(queda)
        const antes = k < 0.55
        rastro.forEach((p, i) => {
          const q = pos(Math.max(0, queda - (i + 1) * 0.035))
          p.s.setPosition(q.x, q.y).setScale((1.5 - i * 0.1) * (antes ? 1 : 0)).setAlpha(antes ? 0.8 - i * 0.06 : 0).setTint(misturar(0xffd060, 0xe0301a, i / 12))
        })
        fogo.setPosition(m.x, m.y).setScale(antes ? 2.4 : 1.5 + bate * 3).setAlpha(antes ? 1 : (1 - bate) * 0.9).setTint(antes ? 0xffa030 : 0xff7a2a)
        rocha.setPosition(m.x, m.y).setScale(antes ? 0.9 : 0).setTint(0x3a2a30).setAlpha(1)
        onda.setPosition(ctx.ax, ctx.ay).setScale(0.1 + saida(bate) * 3.2).setAlpha(k > 0.55 ? (1 - bate) * 0.95 : 0).setTint(0xff9a3a)
        flash.setPosition(ctx.ax, ctx.ay).setScale(1 + bate * 2).setAlpha(k > 0.55 ? (1 - faixaK(bate, 0, 0.5)) * clarao() : 0).setTint(0xfff0c0)
        for (const p of detritos) {
          if (k < 0.55) {
            p.s.setAlpha(0)
            continue
          }
          const d = p.v * saida(bate)
          p.s.setPosition(ctx.ax + Math.cos(p.a) * d, ctx.ay + Math.sin(p.a) * d + 170 * bate * bate)
          p.s.setScale(p.tam * (1 - bate)).setAlpha(1 - bate).setTint(p.cor)
        }
      }
    },
  },
}

export const IDS_LANCAMENTO = Object.keys(LANCAMENTOS_DEF)

// escala (opcional, só para miniaturas): encolhe a animação toda em torno de (x, y), o alvo continua onde está
export function animarLancamento(scene, { x = 0, y = 0, alvoX = x, alvoY = y, cor = 0xffffff, escala = 1 } = {}, id = 'lancamento-padrao') {
  const def = LANCAMENTOS_DEF[id] ?? LANCAMENTOS_DEF['lancamento-padrao']
  return new Promise((resolve) => {
    let c = null
    try {
      if (!scene?.add) return resolve()
      garantirTexturas(scene)
      c = scene.add.container(0, 0)
      c.setDepth(600)
      const g = scene.add.graphics()
      const ga = scene.add.graphics().setBlendMode(ADD)
      c.add([g, ga])
      const esc = Math.min(3, Math.max(0.2, Number(escala) || 1))
      c.setScale(esc).setPosition(x * (1 - esc), y * (1 - esc))
      const dx = (alvoX - x) / esc
      const dy = (alvoY - y) / esc
      const ctx = {
        scene, c, g, ga, x, y, ax: x + dx, ay: y + dy, dx, dy,
        dist: Math.hypot(dx, dy), ang: Math.atan2(dy, dx), cor: typeof cor === 'number' ? cor : 0xffffff,
        img: (tex, blend = ADD) => {
          const s = scene.add.image(0, 0, tex).setBlendMode(blend)
          c.add(s)
          return s
        },
      }
      const dur = Math.min(900, def.dur) * (reduzido() ? 0.8 : 1)
      const quadro = def.criar(ctx)
      ligarAtualizacao(
        scene,
        (t) => {
          g.clear()
          ga.clear()
          quadro(lim(t / dur), t)
          return t < dur
        },
        () => {
          c.destroy()
          resolve()
        },
      )
    } catch {
      c?.destroy()
      resolve()
    }
  })
}
