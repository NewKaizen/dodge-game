// EFEITOS DE CARTA: enfeites permanentes que ficam grudados numa carta (ou em qualquer objeto com
// x, y e tamanho) e a seguem. Feitos para aparecerem BEM no tamanho de jogo (carta de ~70x100):
// bordas brilhantes, partículas, brilho que varre, arcos elétricos...
//
//   aplicarEfeitoCarta(scene, alvo, id) -> { destroy() }
//
// Cada efeito é uma função (ctx) -> quadro(t, dt), com ctx = { scene, c, w, h, u, g, ga }:
//   c     container que segue o alvo (centrado nele); g (normal) e ga (aditivo) são Graphics já
//         limpos a cada quadro; u = w / 70 (escala em relação à carta de referência)
// Tudo é movido pelo 'update' da cena (util.ligarAtualizacao): destruir o efeito ou fechar a cena
// remove ouvinte e objetos. Máximo de 40 partículas por efeito (util.MAX_PARTICULAS).
import { ADD, TAU, aleatorio, enxame, garantirTexturas, hsl, ligarAtualizacao, medir, misturar, pontoNoPerimetro, reduzido } from './util.js'

const sin01 = (x) => (Math.sin(x) + 1) / 2

function contorno(ctx, cor, alfa, larg, folga = 0, g = ctx.ga) {
  const { w, h, u } = ctx
  g.lineStyle(larg, cor, alfa)
  g.strokeRoundedRect(-w / 2 - folga, -h / 2 - folga, w + 2 * folga, h + 2 * folga, 6 * u + folga)
}

// brilho em camadas em volta da carta (a de dentro mais forte)
function halo(ctx, cor, alfa, espessura = 1) {
  const u = ctx.u
  contorno(ctx, cor, alfa * 0.18, 14 * u * espessura, 3 * u)
  contorno(ctx, cor, alfa * 0.35, 8 * u * espessura, 2 * u)
  contorno(ctx, cor, alfa * 0.85, 3.2 * u * espessura, 1 * u)
  contorno(ctx, 0xffffff, alfa * 0.55, 1.2 * u, 1 * u)
}

// polígono do retângulo (centrado) recortado pelos semiplanos n·p >= a e n·p <= b (Sutherland-Hodgman)
function faixa(w, h, ang, a, b) {
  const nx = Math.cos(ang)
  const ny = Math.sin(ang)
  let poli = [{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }]
  const cortar = (lista, dentro, valor) => {
    const saida = []
    for (let i = 0; i < lista.length; i++) {
      const p = lista[i]
      const q = lista[(i + 1) % lista.length]
      const dp = valor(p)
      const dq = valor(q)
      if (dentro(dp)) saida.push(p)
      if (dentro(dp) !== dentro(dq)) {
        const k = dp / (dp - dq)
        saida.push({ x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k })
      }
    }
    return saida
  }
  poli = cortar(poli, (d) => d >= 0, (p) => p.x * nx + p.y * ny - a)
  if (poli.length) poli = cortar(poli, (d) => d <= 0, (p) => p.x * nx + p.y * ny - b)
  return poli
}

// ponto do "fogo" na parte de baixo e nos lados da carta
function pontoDeFogo(w, h) {
  if (Math.random() < 0.5) return { x: aleatorio(-w / 2, w / 2), y: h / 2 - aleatorio(0, h * 0.12) }
  return { x: (Math.random() < 0.5 ? -1 : 1) * (w / 2 - aleatorio(0, 3)), y: aleatorio(-h * 0.1, h / 2) }
}

export const EFEITOS_DEF = {
  'efeito-chamas': {
    criar(ctx) {
      const { scene, c, u } = ctx
      const e = enxame(scene, c, {
        n: 36,
        textura: 'cosm-chama',
        nascer: (p) => {
          Object.assign(p, pontoDeFogo(ctx.w, ctx.h), { vx: aleatorio(-6, 6) * u, vy: -aleatorio(40, 85) * u, vida: aleatorio(520, 950), fase: Math.random() * TAU, tam: aleatorio(0.5, 0.95) })
        },
        mover: (p, k) => {
          const t = p.idade / 1000
          p.s.setPosition(p.x + p.vx * t + Math.sin(p.fase + t * 9) * 2.5 * u, p.y + p.vy * t)
          p.s.setScale(p.tam * u * (1 - k * 0.75))
          p.s.setAlpha(Math.min(1, (1 - k) * 1.6))
          p.s.setTint(k < 0.3 ? misturar(0xfff2a0, 0xffb02e, k / 0.3) : misturar(0xffb02e, 0xe0301a, (k - 0.3) / 0.7))
        },
      })
      return (t, dt) => {
        e.atualizar(dt)
        halo(ctx, 0xff7a1a, 0.7 + 0.3 * sin01(t / 90))
      }
    },
  },

  'efeito-holografico': {
    criar(ctx) {
      const { scene, c, u } = ctx
      const brilhos = enxame(scene, c, {
        n: 8,
        textura: 'cosm-estrela',
        nascer: (p) => Object.assign(p, { x: aleatorio(-ctx.w / 2, ctx.w / 2), y: aleatorio(-ctx.h / 2, ctx.h / 2), vida: aleatorio(500, 1100), tam: aleatorio(0.5, 1.0), hue: aleatorio(0, 360) }),
        mover: (p, k) => {
          p.s.setPosition(p.x, p.y)
          p.s.setScale(p.tam * u * Math.sin(Math.PI * k))
          p.s.setRotation(k * 1.4)
          p.s.setTint(hsl(p.hue + k * 90, 1, 0.8))
        },
      })
      return (t, dt) => {
        const { w, h, g, ga } = ctx
        brilhos.atualizar(dt)
        const ang = 0.6
        const R = (Math.abs(Math.cos(ang)) * w + Math.abs(Math.sin(ang)) * h) / 2
        const largura = R * 0.9
        const ciclo = 2200
        const k = (t % ciclo) / ciclo
        const centro = -R - largura + (2 * R + 2 * largura) * Math.min(1, k / 0.72)
        // véu holográfico sempre presente (arco-íris fraco em faixas fixas que se deslocam)
        for (let i = 0; i < 5; i++) {
          const a = -R + ((i + (t / 2600)) % 5) * ((2 * R) / 5)
          const poli = faixa(w, h, ang, a, a + (2 * R) / 10)
          if (poli.length > 2) {
            ga.fillStyle(hsl(t / 8 + i * 70, 1, 0.65), 0.2)
            ga.fillPoints(poli, true)
          }
        }
        // a faixa brilhante que varre: 5 tiras de cores diferentes lado a lado
        if (k < 0.72) {
          for (let i = 0; i < 5; i++) {
            const a = centro - largura / 2 + (i * largura) / 5
            const poli = faixa(w, h, ang, a, a + largura / 5)
            if (poli.length > 2) {
              ga.fillStyle(hsl(180 + i * 55 + t / 6, 1, 0.72), 0.78)
              ga.fillPoints(poli, true)
            }
          }
          const nucleo = faixa(w, h, ang, centro - largura * 0.08, centro + largura * 0.08)
          if (nucleo.length > 2) {
            ga.fillStyle(0xffffff, 0.85)
            ga.fillPoints(nucleo, true)
          }
        }
        // borda que muda de cor
        contorno(ctx, hsl(t / 5, 1, 0.65), 0.9, 3 * u, 1 * u, g)
        contorno(ctx, hsl(t / 5 + 120, 1, 0.7), 0.35, 8 * u, 2 * u)
      }
    },
  },

  'efeito-arco-iris': {
    criar(ctx) {
      const N = 56
      return (t) => {
        const { w, h, u, ga, g } = ctx
        const ww = w + 4 * u
        const hh = h + 4 * u
        for (const [larg, alfa, alvo] of [[11 * u, 0.28, ga], [4.6 * u, 1, g]]) {
          for (let i = 0; i < N; i++) {
            const a = pontoNoPerimetro(ww, hh, i / N)
            const b = pontoNoPerimetro(ww, hh, (i + 1.15) / N)
            alvo.lineStyle(larg, hsl((i / N) * 360 + t * 0.28, 1, 0.58), alfa)
            alvo.beginPath()
            alvo.moveTo(a.x, a.y)
            alvo.lineTo(b.x, b.y)
            alvo.strokePath()
          }
        }
        // cantos arredondados em branco para dar acabamento
        contorno(ctx, 0xffffff, 0.3, 1 * u, 4.5 * u, ga)
      }
    },
  },

  'efeito-brilho': {
    criar(ctx) {
      const { scene, c, u } = ctx
      const e = enxame(scene, c, {
        n: 12,
        textura: 'cosm-estrela',
        nascer: (p) => {
          const pt = pontoNoPerimetro(ctx.w, ctx.h, Math.random())
          Object.assign(p, { x: pt.x + pt.nx * aleatorio(-3, 6) * u + aleatorio(-6, 6) * u * Math.abs(pt.ny), y: pt.y + pt.ny * aleatorio(-3, 6) * u, vida: aleatorio(650, 1300), tam: aleatorio(0.5, 1.15), giro: aleatorio(-2, 2) })
        },
        mover: (p, k) => {
          p.s.setPosition(p.x, p.y)
          p.s.setScale(p.tam * u * Math.sin(Math.PI * k) * 1.3)
          p.s.setRotation(k * p.giro)
          p.s.setTint(misturar(0xfff0a0, 0xffffff, sin01(k * 12)))
        },
      })
      return (t, dt) => {
        e.atualizar(dt)
        halo(ctx, 0xffd34d, 0.55 + 0.45 * sin01(t / 260), 1.1)
      }
    },
  },

  'efeito-bolhas': {
    criar(ctx) {
      const { scene, c, u } = ctx
      const e = enxame(scene, c, {
        n: 18,
        textura: 'cosm-bolha',
        blend: 'NORMAL',
        nascer: (p) => {
          Object.assign(p, { x: aleatorio(-ctx.w * 0.62, ctx.w * 0.62), y: ctx.h / 2 + aleatorio(-4, 8) * u, vy: -aleatorio(28, 62) * u, vida: aleatorio(1000, 1900), fase: Math.random() * TAU, tam: aleatorio(0.35, 1.1) })
        },
        mover: (p, k) => {
          const t = p.idade / 1000
          p.s.setPosition(p.x + Math.sin(p.fase + t * 3.2) * 5 * u, p.y + p.vy * t)
          p.s.setScale(p.tam * u * (0.6 + k * 0.6))
          p.s.setAlpha(Math.min(1, (1 - k) * 2) * 0.95)
          p.s.setTint(misturar(0x7fe8ff, 0xd8f8ff, p.tam / 1.1))
        },
      })
      return (t, dt) => {
        e.atualizar(dt)
        halo(ctx, 0x4fd0ff, 0.5 + 0.2 * sin01(t / 400), 0.9)
      }
    },
  },

  'efeito-folhas': {
    criar(ctx) {
      const { scene, c, u } = ctx
      const verdes = [0x3fbf4a, 0x7bd84a, 0xb8e04a, 0x2f9a45, 0xe0a030]
      const e = enxame(scene, c, {
        n: 16,
        textura: 'cosm-folha',
        blend: 'NORMAL',
        nascer: (p) => {
          Object.assign(p, { x: aleatorio(-ctx.w * 0.65, ctx.w * 0.65), y: -ctx.h / 2 - aleatorio(0, 10) * u, vy: aleatorio(22, 46) * u, vida: aleatorio(1500, 2600), fase: Math.random() * TAU, tam: aleatorio(0.5, 0.95), cor: verdes[Math.floor(Math.random() * verdes.length)], giro: aleatorio(-3, 3) })
        },
        mover: (p, k) => {
          const t = p.idade / 1000
          p.s.setPosition(p.x + Math.sin(p.fase + t * 2.4) * 15 * u, p.y + p.vy * t)
          p.s.setRotation(p.fase + t * p.giro)
          p.s.setScale(p.tam * u * (0.35 + 0.65 * Math.abs(Math.cos(p.fase + t * 2.4))), p.tam * u)
          p.s.setAlpha(Math.min(1, k * 8, (1 - k) * 3))
          p.s.setTint(p.cor)
        },
      })
      return (t, dt) => {
        e.atualizar(dt)
        halo(ctx, 0x5be06a, 0.4 + 0.2 * sin01(t / 500), 0.8)
      }
    },
  },

  'efeito-sombra': {
    atras: true,
    criar(ctx) {
      const { scene, c, u } = ctx
      const e = enxame(scene, c, {
        n: 14,
        textura: 'cosm-glow',
        blend: 'NORMAL',
        nascer: (p) => {
          const pt = pontoNoPerimetro(ctx.w, ctx.h, Math.random())
          Object.assign(p, { x: pt.x, y: pt.y, nx: pt.nx, ny: pt.ny, vida: aleatorio(1100, 2000), tam: aleatorio(0.9, 1.6) })
        },
        mover: (p, k) => {
          const d = 4 + k * 20
          p.s.setPosition(p.x + p.nx * d * u, p.y + p.ny * d * u - k * 14 * u)
          p.s.setScale(p.tam * u * (0.7 + k * 0.9))
          p.s.setAlpha(Math.sin(Math.PI * k) * 0.75)
          p.s.setTint(misturar(0x120620, 0x3a1c6a, k))
        },
      })
      return (t, dt) => {
        const { g, ga, w, h, u: s } = ctx
        // sombra projetada, forte, atrás da carta
        g.fillStyle(0x0a0414, 0.55 + 0.15 * sin01(t / 300))
        g.fillRoundedRect(-w / 2 - 3 * s, -h / 2 + 3 * s, w + 6 * s, h + 3 * s, 8 * s)
        e.atualizar(dt)
        contorno(ctx, 0x8a4cff, 0.28 + 0.2 * sin01(t / 350), 10 * s, 2 * s, ga)
        contorno(ctx, 0xb48cff, 0.75, 2 * s, 0.5 * s, ga)
      }
    },
  },

  'efeito-eletrico': {
    criar(ctx) {
      const { u } = ctx
      let arcos = []
      let proxima = 0
      const novo = () => {
        arcos = []
        const n = reduzido() ? 2 : 4
        for (let i = 0; i < n; i++) {
          const ini = pontoNoPerimetro(ctx.w, ctx.h, Math.random())
          const pts = [{ x: ini.x, y: ini.y }]
          const dirX = aleatorio(-1, 1)
          const dirY = aleatorio(-1, 1)
          let x = ini.x
          let y = ini.y
          const passos = Math.floor(aleatorio(4, 8))
          for (let k = 0; k < passos; k++) {
            x += (ini.nx * 7 + dirX * 5 + aleatorio(-6, 6)) * u
            y += (ini.ny * 7 + dirY * 5 + aleatorio(-6, 6)) * u
            pts.push({ x, y })
          }
          arcos.push(pts)
        }
      }
      novo()
      return (t) => {
        const { g, ga } = ctx
        if (t > proxima) {
          proxima = t + (reduzido() ? 220 : 85)
          novo()
        }
        const pisca = 0.6 + 0.4 * Math.random()
        contorno(ctx, 0x4fd8ff, 0.45 * pisca, 6 * u, 2 * u)
        contorno(ctx, 0xc8f4ff, 0.9, 1.6 * u, 1 * u)
        for (const pts of arcos) {
          for (const [larg, cor, alfa, alvo] of [[6 * u, 0x2aa8ff, 0.4 * pisca, ga], [2.6 * u, 0x9be8ff, 0.95, ga], [1.1 * u, 0xffffff, 1, g]]) {
            alvo.lineStyle(larg, cor, alfa)
            alvo.beginPath()
            alvo.moveTo(pts[0].x, pts[0].y)
            for (let i = 1; i < pts.length; i++) alvo.lineTo(pts[i].x, pts[i].y)
            alvo.strokePath()
          }
        }
      }
    },
  },

  'efeito-pixel-fogo': {
    criar(ctx) {
      const { scene, c, u } = ctx
      const px = Math.max(2, Math.round(3 * u))
      const degraus = [0xffffff, 0xfff27a, 0xffc22e, 0xff8a1a, 0xe8401a, 0xb02a1a]
      const e = enxame(scene, c, {
        n: 40,
        textura: 'cosm-quad',
        blend: 'NORMAL',
        nascer: (p) => {
          Object.assign(p, pontoDeFogo(ctx.w, ctx.h), { vy: -aleatorio(34, 80) * u, vx: aleatorio(-5, 5) * u, vida: aleatorio(600, 1100), tam: Math.random() < 0.5 ? 2 : 1 })
        },
        mover: (p, k) => {
          const t = p.idade / 1000
          const x = Math.round((p.x + p.vx * t) / px) * px
          const y = Math.round((p.y + p.vy * t) / px) * px
          p.s.setPosition(x, y)
          p.s.setScale((px / 4) * p.tam * (k < 0.75 ? 1 : 0.5))
          p.s.setTint(degraus[Math.min(degraus.length - 1, Math.floor(k * degraus.length))])
          p.s.setAlpha(k > 0.9 ? 0.5 : 1)
        },
      })
      return (t, dt) => {
        e.atualizar(dt)
        // borda de pixels pontilhada que pisca em laranja/amarelo
        const { g, w, h } = ctx
        const passo = px * 2
        const fase = Math.floor(t / 130) % 2
        for (let i = 0; i * passo < w + px; i++) {
          const x = -w / 2 + i * passo
          const cor = (i + fase) % 2 ? 0xffc22e : 0xff6a1a
          g.fillStyle(cor, 1)
          g.fillRect(x, -h / 2 - px, px, px)
          g.fillRect(x, h / 2, px, px)
        }
        for (let i = 0; i * passo < h + px; i++) {
          const y = -h / 2 + i * passo
          const cor = (i + fase) % 2 ? 0xffc22e : 0xff6a1a
          g.fillStyle(cor, 1)
          g.fillRect(-w / 2 - px, y, px, px)
          g.fillRect(w / 2, y, px, px)
        }
      }
    },
  },

  'efeito-estrelas': {
    criar(ctx) {
      const { scene, c, u } = ctx
      const N = 7
      const cores = [0xfff07a, 0xffffff, 0xff9ee8, 0x9ee8ff]
      const itens = []
      for (let i = 0; i < N; i++) {
        const rastro = []
        for (let k = 0; k < 2; k++) {
          const s = scene.add.image(0, 0, 'cosm-estrela').setBlendMode(ADD)
          c.add(s)
          rastro.push(s)
        }
        const s = scene.add.image(0, 0, 'cosm-estrela').setBlendMode(ADD)
        c.add(s)
        itens.push({ s, rastro, fase: (i / N) * TAU, cor: cores[i % cores.length], vel: i % 2 ? 1 : -1, tam: aleatorio(0.55, 0.8) })
      }
      const vel = reduzido() ? 0.0011 : 0.0021
      return (t) => {
        const { w, h } = ctx
        const rx = w * 0.66
        const ry = h * 0.62
        for (const it of itens) {
          const pos = (a) => ({ x: Math.cos(a) * rx, y: Math.sin(a) * ry })
          const a = it.fase + t * vel * it.vel
          const p = pos(a)
          it.s.setPosition(p.x, p.y)
          it.s.setScale(it.tam * u * (0.85 + 0.35 * sin01(t / 120 + it.fase * 3)))
          it.s.setRotation(t / 400 + it.fase)
          it.s.setTint(it.cor)
          it.rastro.forEach((r, k) => {
            const q = pos(a - it.vel * 0.22 * (k + 1))
            r.setPosition(q.x, q.y)
            r.setScale(it.tam * u * (0.6 - k * 0.2))
            r.setAlpha(0.55 - k * 0.22)
            r.setTint(it.cor)
            r.setRotation(t / 400 + it.fase)
          })
        }
        contorno(ctx, 0xfff07a, 0.35 + 0.2 * sin01(t / 300), 5 * u, 1.5 * u)
        contorno(ctx, 0xfff9c8, 0.7, 1.4 * u, 0.8 * u)
      }
    },
  },
}

const VAZIO = { destroy() {} }

export function aplicarEfeitoCarta(scene, alvo, id) {
  const def = EFEITOS_DEF[id]
  if (!def || !scene?.add || !alvo) return VAZIO
  let c = null
  let ligacao = null
  try {
    garantirTexturas(scene)
    const m = medir(alvo)
    c = scene.add.container(m.x, m.y)
    c.setDepth((alvo.depth ?? 0) + (def.atras ? -0.5 : 1))
    const g = scene.add.graphics()
    const ga = scene.add.graphics().setBlendMode(ADD)
    c.add([g, ga])
    const ctx = { scene, c, g, ga, w: m.w, h: m.h, u: m.w / 70 }
    const quadro = def.criar(ctx)
    ligacao = ligarAtualizacao(
      scene,
      (t, dt) => {
        if ((alvo.scene === undefined && 'scene' in alvo) || alvo.scene === null || alvo.active === false) return false
        const q = medir(alvo)
        ctx.w = q.w
        ctx.h = q.h
        c.setPosition(q.x, q.y)
        c.setRotation(q.giro)
        c.setScale(q.esc)
        c.setVisible(alvo.visible !== false)
        c.setAlpha(alvo.alpha ?? 1)
        g.clear()
        ga.clear()
        quadro(t, dt)
      },
      () => c.destroy(),
    )
  } catch {
    c?.destroy()
    return VAZIO
  }
  return { destroy: () => ligacao.destroy() }
}
