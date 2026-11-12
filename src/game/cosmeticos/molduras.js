// MOLDURAS ANIMADAS: a moldura de perfil/avatar (quadrada, como conta/ui.js criarAvatar) em volta de
// uma área de `tamanho` x `tamanho` centrada em (x, y). A faixa da moldura fica FORA dessa área
// (espessura ~ 16% do tamanho) e os enfeites (chamas, gotas, estrelas) saem dela.
//
//   desenharMoldura(scene, x, y, tamanho, id) -> Phaser.GameObjects.Container
//
// O container se limpa sozinho ao ser destruído (ou quando a cena fecha): o ouvinte de 'update' é
// removido e os filhos destruídos. Sem tweens nem timers.
import { ADD, TAU, aleatorio, enxame, garantirTexturas, hsl, ligarAtualizacao, misturar, pontoNoPerimetro, reduzido } from './util.js'

const sin01 = (x) => (Math.sin(x) + 1) / 2

// faixa quadrada pintada em N segmentos; cor(i, u) -> 0xRRGGBB
function faixaSeg(g, c, cor, alfa = 1, N = 40, extra = 0) {
  const lado = c.S + c.b
  g.lineStyle(c.b + 1 + extra, 0, 0)
  for (let i = 0; i < N; i++) {
    const a = pontoNoPerimetro(lado, lado, i / N)
    const b = pontoNoPerimetro(lado, lado, (i + 1.12) / N)
    g.lineStyle(c.b + 1 + extra, cor(i, i / N), alfa)
    g.beginPath()
    g.moveTo(a.x, a.y)
    g.lineTo(b.x, b.y)
    g.strokePath()
  }
}

// contorno fino de dentro e de fora
function arestas(g, c, corFora, corDentro, larg = 1.5) {
  const o = c.S / 2 + c.b
  const i = c.S / 2
  g.lineStyle(larg, corFora, 1)
  g.strokeRect(-o, -o, 2 * o, 2 * o)
  g.lineStyle(larg, corDentro, 1)
  g.strokeRect(-i, -i, 2 * i, 2 * i)
}

function brilhoFora(g, c, cor, alfa, camadas = 3) {
  const m = c.S / 2 + c.b / 2
  for (let k = camadas; k >= 1; k--) {
    g.lineStyle(c.b + k * c.b * 0.55, cor, (alfa * 0.5) / k)
    g.strokeRect(-m, -m, 2 * m, 2 * m)
  }
}

// ponto num anel em volta da moldura (u de 0 a 1), com folga `f` para fora
function noAnel(c, u, f = 0) {
  const lado = c.S + c.b + 2 * f
  return pontoNoPerimetro(lado, lado, u)
}

const DEF = {
  'moldura-anim-fogo': {
    criar(c) {
      const e = enxame(c.scene, c.c, {
        n: 30,
        textura: 'cosm-chama',
        nascer: (p) => {
          const pt = noAnel(c, Math.random())
          Object.assign(p, { x: pt.x, y: pt.y, vx: pt.nx * aleatorio(2, 14), vy: -aleatorio(30, 70) * c.u, vida: aleatorio(550, 1000), tam: aleatorio(0.75, 1.3), fase: aleatorio(0, TAU) })
        },
        mover: (p, k) => {
          const t = p.idade / 1000
          p.s.setPosition(p.x + p.vx * t + Math.sin(p.fase + t * 9) * 2 * c.u, p.y + p.vy * t)
          p.s.setScale(p.tam * c.u * (1 - k * 0.7))
          p.s.setAlpha(Math.min(1, (1 - k) * 1.6))
          p.s.setTint(k < 0.3 ? misturar(0xfff2a0, 0xffb02e, k / 0.3) : misturar(0xffb02e, 0xe0301a, (k - 0.3) / 0.7))
        },
      })
      return (t, dt) => {
        const { g, ga } = c
        brilhoFora(ga, c, 0xff7a1a, 0.5 + 0.4 * sin01(t / 110))
        faixaSeg(g, c, (i, u) => misturar(0xb41a0a, 0xff9a1a, sin01(u * 18 + t / 140)))
        arestas(g, c, 0xffd060, 0x601008)
        e.atualizar(dt)
      }
    },
  },

  'moldura-anim-arco-iris': {
    criar(c) {
      return (t) => {
        const { g, ga } = c
        faixaSeg(ga, c, (i, u) => hsl(u * 360 + t * 0.25, 1, 0.6), 0.3, 40, c.b * 0.9)
        faixaSeg(g, c, (i, u) => hsl(u * 360 * 1.5 + t * 0.25, 1, 0.58))
        arestas(g, c, 0xffffff, 0xffffff, 1.2)
      }
    },
  },

  'moldura-anim-glitch': {
    criar(c) {
      let cortes = []
      let proxima = 0
      const novo = () => {
        cortes = []
        const n = reduzido() ? 1 : 4
        for (let i = 0; i < n; i++) cortes.push({ u: Math.random(), l: aleatorio(0.04, 0.16), d: aleatorio(-1, 1) * c.b * 1.4, cor: Math.random() < 0.5 ? 0xff2a6a : 0x2affea })
      }
      novo()
      return (t) => {
        const { g, ga } = c
        if (t > proxima) {
          proxima = t + (reduzido() ? 400 : aleatorio(60, 200))
          novo()
        }
        faixaSeg(g, c, (i, u) => (i % 2 ? 0x1c1030 : 0x2a1a48))
        faixaSeg(ga, c, (i, u) => (Math.floor(u * 40 + t / 90) % 5 === 0 ? 0x2affea : 0x7a2aff), 0.55, 40, -2)
        // fatias deslocadas em ciano/magenta
        for (const k of cortes) {
          const a = noAnel(c, k.u)
          const b = noAnel(c, k.u + k.l)
          ga.lineStyle(c.b * 0.8, k.cor, 0.95)
          ga.beginPath()
          ga.moveTo(a.x + k.d, a.y + k.d * 0.4)
          ga.lineTo(b.x + k.d, b.y + k.d * 0.4)
          ga.strokePath()
        }
        // blocos de ruído
        for (let i = 0; i < 7; i++) {
          const p = noAnel(c, ((Math.sin(Math.floor(t / 110) * 12.9 + i * 4.1) * 43758.5) % 1 + 1) % 1)
          g.fillStyle(i % 2 ? 0xffffff : 0x000000, 0.9)
          g.fillRect(p.x - c.b * 0.5, p.y - c.b * 0.25, c.b * (0.6 + (i % 3) * 0.5), c.b * 0.5)
        }
        arestas(g, c, 0x2affea, 0xff2a6a, 1.4)
      }
    },
  },

  'moldura-anim-coracoes': {
    criar(c) {
      const N = 10
      const hs = []
      for (let i = 0; i < N; i++) {
        const s = c.scene.add.image(0, 0, 'cosm-coracao')
        c.c.add(s)
        hs.push(s)
      }
      return (t) => {
        const { g, ga } = c
        brilhoFora(ga, c, 0xff5fb0, 0.35 + 0.25 * sin01(t / 300), 2)
        faixaSeg(g, c, (i, u) => (i % 2 ? 0xff7ac4 : 0xe03a8a))
        arestas(g, c, 0xffd6ec, 0x7a1048)
        hs.forEach((s, i) => {
          const p = noAnel(c, i / N + t / (reduzido() ? 14000 : 7000), c.b * 0.2)
          s.setPosition(p.x, p.y - Math.sin(t / 220 + i) * 2 * c.u)
          s.setScale((1.1 + 0.4 * sin01(t / 180 + i * 2)) * c.u)
          s.setTint(i % 3 === 0 ? 0xffffff : i % 3 === 1 ? 0xff2a5a : 0xff8ad0)
        })
      }
    },
  },

  'moldura-anim-estrelas': {
    criar(c) {
      const e = enxame(c.scene, c.c, {
        n: 18,
        textura: 'cosm-estrela',
        nascer: (p) => {
          const pt = noAnel(c, Math.random(), c.b * 0.3)
          Object.assign(p, { x: pt.x, y: pt.y, nx: pt.nx, ny: pt.ny, vida: aleatorio(700, 1500), tam: aleatorio(0.4, 0.8), cor: [0xfff07a, 0xffffff, 0x9ee8ff][Math.floor(Math.random() * 3)] })
        },
        mover: (p, k) => {
          p.s.setPosition(p.x + p.nx * k * 12 * c.u, p.y + p.ny * k * 12 * c.u)
          p.s.setScale(p.tam * c.u * Math.sin(Math.PI * k) * 1.2)
          p.s.setRotation(k * 2)
          p.s.setTint(p.cor)
        },
      })
      return (t, dt) => {
        const { g, ga } = c
        faixaSeg(g, c, (i, u) => misturar(0x14206a, 0x3a4ab8, sin01(u * 30 + t / 400)))
        faixaSeg(ga, c, (i, u) => (Math.floor(u * 40 + t / 80) % 8 === 0 ? 0xfff07a : 0x000000), 0.8, 40, -3)
        brilhoFora(ga, c, 0xfff07a, 0.3 + 0.2 * sin01(t / 350), 2)
        arestas(g, c, 0xfff07a, 0xfff07a, 1.4)
        e.atualizar(dt)
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            const o = c.S / 2 + c.b / 2
            ga.fillStyle(0xfff9c8, 0.9)
            ga.fillCircle(sx * o, sy * o, (2.2 + 1.2 * sin01(t / 200 + sx + sy * 2)) * c.u)
          }
        }
      }
    },
  },

  'moldura-anim-slime': {
    criar(c) {
      const gotas = []
      const n = 6
      for (let i = 0; i < n; i++) gotas.push({ x: -c.S / 2 + ((i + 0.5) / n) * c.S + aleatorio(-4, 4), ciclo: aleatorio(1600, 2600), fase: aleatorio(0, 2600), max: aleatorio(0.5, 1) })
      const bolhas = enxame(c.scene, c.c, {
        n: 8,
        textura: 'cosm-ponto',
        blend: 'NORMAL',
        nascer: (p) => {
          const pt = noAnel(c, Math.random())
          Object.assign(p, { x: pt.x, y: pt.y, vida: aleatorio(800, 1600), tam: aleatorio(0.15, 0.4) })
        },
        mover: (p, k) => {
          p.s.setPosition(p.x, p.y - k * 8 * c.u)
          p.s.setScale(p.tam * c.u * Math.sin(Math.PI * k))
          p.s.setTint(0xd8ffa8)
        },
      })
      return (t, dt) => {
        const { g, ga } = c
        faixaSeg(g, c, (i, u) => misturar(0x2fa83a, 0x7be04a, sin01(u * 14 + t / 500)))
        arestas(g, c, 0xc8ff7a, 0x1f6a2a)
        // brilho brilhante (reflexo)
        faixaSeg(ga, c, (i, u) => 0xffffff, 0.22, 40, -c.b * 0.6)
        const base = c.S / 2 + c.b - 1
        gotas.forEach((d) => {
          const k = ((t + d.fase) % d.ciclo) / d.ciclo
          const comp = (k < 0.75 ? suavizar(k / 0.75) : 1) * d.max * c.b * 2.4
          const queda = k > 0.75 ? ((k - 0.75) / 0.25) ** 2 * c.S * 0.35 : 0
          const larg = c.b * 0.46
          g.fillStyle(0x4fc83a, 1 - (k > 0.75 ? (k - 0.75) * 3 : 0))
          g.fillRect(d.x - larg / 2, base - 2 + queda, larg, comp)
          g.fillCircle(d.x, base - 2 + queda + comp, larg * 0.85)
          g.fillStyle(0xd8ffa8, 0.8)
          g.fillCircle(d.x - larg * 0.25, base - 2 + queda + comp - larg * 0.2, larg * 0.22)
        })
        bolhas.atualizar(dt)
      }
    },
  },

  'moldura-anim-neon': {
    criar(c) {
      return (t) => {
        const { g, ga } = c
        const quebra = Math.sin(t / 53) * Math.sin(t / 137) > 0.88 ? 0.35 : 1 // pisca de tubo falhando
        const rf = reduzido() ? 1 : quebra
        const cor = hsl(300 + 60 * Math.sin(t / 1600), 1, 0.6)
        const m = c.S / 2 + c.b / 2
        for (const [mult, al] of [[3.2, 0.12], [2.2, 0.2], [1.5, 0.35]]) {
          ga.lineStyle(c.b * mult, cor, al * rf)
          ga.strokeRect(-m, -m, 2 * m, 2 * m)
        }
        g.lineStyle(c.b + 1, 0x14081e, 1)
        g.strokeRect(-m, -m, 2 * m, 2 * m)
        const f = c.b * 0.34
        ga.lineStyle(f, cor, rf)
        ga.strokeRect(-m, -m, 2 * m, 2 * m)
        ga.lineStyle(f * 0.4, 0xffffff, 0.95 * rf)
        ga.strokeRect(-m, -m, 2 * m, 2 * m)
        // segunda linha neon ciano por dentro
        const i2 = c.S / 2 + 1.5
        ga.lineStyle(2, 0x2affea, 0.9 * rf)
        ga.strokeRect(-i2, -i2, 2 * i2, 2 * i2)
        // cantos viram "terminais" do tubo
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) ga.fillStyle(0xffffff, 0.9 * rf).fillCircle(sx * (m + 1), sy * (m + 1), c.b * 0.28)
      }
    },
  },

  'moldura-anim-gelo': {
    criar(c) {
      // cristais fixos (semente fixa para sempre parecer o mesmo)
      const cristais = []
      for (let i = 0; i < 16; i++) {
        const u = (i + ((i * 7919) % 10) / 10) / 16
        cristais.push({ u, comp: 0.7 + (((i * 31) % 10) / 10) * 0.9, larg: 0.8 + (((i * 17) % 10) / 10) * 0.5 })
      }
      const e = enxame(c.scene, c.c, {
        n: 10,
        textura: 'cosm-estrela',
        nascer: (p) => {
          const pt = noAnel(c, Math.random(), c.b * 0.2)
          Object.assign(p, { x: pt.x, y: pt.y, vida: aleatorio(500, 1100), tam: aleatorio(0.5, 1) })
        },
        mover: (p, k) => {
          p.s.setPosition(p.x, p.y)
          p.s.setScale(p.tam * c.u * Math.sin(Math.PI * k))
          p.s.setTint(0xffffff)
        },
      })
      return (t, dt) => {
        const { g, ga } = c
        brilhoFora(ga, c, 0x8ad8ff, 0.4 + 0.15 * sin01(t / 500), 2)
        faixaSeg(g, c, (i, u) => misturar(0x8ad0f0, 0xe8f8ff, sin01(u * 25 + 1)))
        arestas(g, c, 0xffffff, 0x4a90c0)
        for (const k of cristais) {
          const p = noAnel(c, k.u)
          const h = c.b * 1.5 * k.comp
          const w = c.b * 0.5 * k.larg
          const tx = -p.ny
          const ty = p.nx
          g.fillStyle(0xcdf0ff, 0.95)
          g.fillTriangle(p.x + tx * w, p.y + ty * w, p.x - tx * w, p.y - ty * w, p.x + p.nx * h, p.y + p.ny * h)
          g.fillStyle(0xffffff, 0.9)
          g.fillTriangle(p.x + tx * w, p.y + ty * w, p.x, p.y, p.x + p.nx * h, p.y + p.ny * h)
          g.lineStyle(1, 0x5aa8d8, 1)
          g.lineBetween(p.x - tx * w, p.y - ty * w, p.x + p.nx * h, p.y + p.ny * h)
        }
        // brilho que passa
        const bp = noAnel(c, (t / 2600) % 1)
        ga.fillStyle(0xffffff, 0.9)
        ga.fillCircle(bp.x, bp.y, c.b * 0.7)
        e.atualizar(dt)
      }
    },
  },

  'moldura-anim-gerson': {
    criar(c) {
      const e = enxame(c.scene, c.c, {
        n: 8,
        textura: 'cosm-estrela',
        nascer: (p) => {
          const pt = noAnel(c, Math.random())
          Object.assign(p, { x: pt.x, y: pt.y, vida: aleatorio(500, 1000), tam: aleatorio(0.5, 1) })
        },
        mover: (p, k) => {
          p.s.setPosition(p.x, p.y)
          p.s.setScale(p.tam * c.u * Math.sin(Math.PI * k) * 1.2)
          p.s.setTint(0xfff6c0)
        },
      })
      return (t, dt) => {
        const { g, ga } = c
        // estátua de ouro: bisel claro/escuro e brilho que percorre o perímetro
        faixaSeg(g, c, (i, u) => {
          const d = Math.abs(((u - (t / 2400) % 1 + 1.5) % 1) - 0.5)
          return misturar(misturar(0x9a6a10, 0xe8b830, sin01(u * 40)), 0xfff6c0, Math.max(0, 1 - d * 7))
        })
        arestas(g, c, 0xfff0a0, 0x6a4408, 2)
        const m = c.S / 2 + c.b / 2
        g.lineStyle(1.2, 0xfff0a0, 0.7)
        g.strokeRect(-m, -m, 2 * m, 2 * m)
        // estudes nos cantos
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            g.fillStyle(0x6a4408, 1)
            g.fillCircle(sx * m, sy * m, c.b * 0.5)
            g.fillStyle(0xffd34d, 1)
            g.fillCircle(sx * m, sy * m, c.b * 0.38)
            g.fillStyle(0xffffff, 0.9)
            g.fillCircle(sx * m - c.b * 0.1, sy * m - c.b * 0.1, c.b * 0.12)
          }
        }
        // coroa no topo
        const top = -c.S / 2 - c.b
        const cw = c.b * 2.4
        const ch = c.b * 1.5
        g.fillStyle(0xffd34d, 1)
        g.fillPoints([{ x: -cw, y: top }, { x: -cw, y: top - ch * 0.7 }, { x: -cw / 2, y: top - ch * 0.3 }, { x: 0, y: top - ch }, { x: cw / 2, y: top - ch * 0.3 }, { x: cw, y: top - ch * 0.7 }, { x: cw, y: top }], true)
        g.lineStyle(1.2, 0x6a4408, 1)
        g.strokePoints([{ x: -cw, y: top }, { x: -cw, y: top - ch * 0.7 }, { x: -cw / 2, y: top - ch * 0.3 }, { x: 0, y: top - ch }, { x: cw / 2, y: top - ch * 0.3 }, { x: cw, y: top - ch * 0.7 }, { x: cw, y: top }], true)
        g.fillStyle(0xe03a4a, 1)
        g.fillCircle(0, top - ch * 0.35, c.b * 0.28)
        brilhoFora(ga, c, 0xffe680, 0.4 + 0.2 * sin01(t / 300), 2)
        e.atualizar(dt)
      }
    },
  },

  'moldura-anim-galaxia': {
    criar(c) {
      const e = enxame(c.scene, c.c, {
        n: 22,
        textura: 'cosm-ponto',
        nascer: (p) => {
          const pt = noAnel(c, Math.random(), aleatorio(-c.b * 0.35, c.b * 0.35))
          Object.assign(p, { x: pt.x, y: pt.y, vida: aleatorio(700, 1800), tam: aleatorio(0.15, 0.45), cor: [0xffffff, 0xc8d8ff, 0xffd0f0][Math.floor(Math.random() * 3)] })
        },
        mover: (p, k) => {
          p.s.setPosition(p.x, p.y)
          p.s.setScale(p.tam * c.u * Math.sin(Math.PI * k) * 1.6)
          p.s.setTint(p.cor)
        },
      })
      const cometa = []
      for (let i = 0; i < 6; i++) cometa.push(c.scene.add.image(0, 0, 'cosm-glow').setBlendMode(ADD))
      for (const s of cometa) c.c.add(s)
      return (t, dt) => {
        const { g, ga } = c
        faixaSeg(g, c, (i, u) => {
          const w = sin01(u * 18 + t / 900)
          const w2 = sin01(u * 11 - t / 700)
          return misturar(misturar(0x1a0a48, 0x5a1a9a, w), 0x1a4aa8, w2 * 0.6)
        })
        faixaSeg(ga, c, (i, u) => hsl(260 + 80 * sin01(u * 9 + t / 1000), 0.8, 0.5), 0.35, 40, -2)
        arestas(g, c, 0xb89cff, 0x0a0620)
        e.atualizar(dt)
        cometa.forEach((s, i) => {
          const p = noAnel(c, (t / (reduzido() ? 5200 : 2600) + 1 - i * 0.012) % 1)
          s.setPosition(p.x, p.y)
          s.setScale((0.55 - i * 0.07) * c.u)
          s.setAlpha(1 - i * 0.16)
          s.setTint(i ? 0xb89cff : 0xffffff)
        })
      }
    },
  },
}

function suavizar(k) {
  return k * k * (3 - 2 * k)
}

export const IDS_MOLDURA = Object.keys(DEF)

export function desenharMoldura(scene, x, y, tamanho = 64, id = 'moldura-nenhuma') {
  const raiz = scene.add.container(x, y)
  const def = DEF[id]
  if (!def) return raiz
  try {
    garantirTexturas(scene)
    const b = Math.max(4, Math.round(tamanho * 0.16))
    const g = scene.add.graphics()
    const ga = scene.add.graphics().setBlendMode(ADD)
    raiz.add([g, ga])
    const c = { scene, c: raiz, g, ga, S: tamanho, b, u: Math.max(0.6, tamanho / 64) }
    const quadro = def.criar(c)
    const lig = ligarAtualizacao(
      scene,
      (t, dt) => {
        if (!raiz.active) return false
        g.clear()
        ga.clear()
        quadro(t, dt)
      },
      () => raiz.active && !raiz.isDestroyed && raiz.destroy(),
    )
    raiz.once('destroy', () => lig.destroy())
  } catch {
    // sem moldura animada: o container vazio ainda é válido
  }
  return raiz
}
