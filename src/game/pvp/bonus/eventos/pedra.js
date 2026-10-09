import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { particulas } from '../../../effects/particulas.js'

// PEDRA ROLANTE (TEMPLO): de tempos em tempos uma pedra gigante atravessa as
// caixas rolando, estilo filme de aventura. Antes, o AVISO: o chão ronca, a
// tela treme de leve, poeira cai do lado por onde ela vai entrar e a FAIXA
// por onde ela vai passar fica vermelha, com setas correndo no sentido em que
// ela vem. Às vezes vem uma segunda logo atrás, numa faixa diferente (as duas
// faixas aparecem juntas desde o começo). As faixas são terços da caixa: com
// duas pedras sobra sempre um terço livre para fugir.
// A pedra é uma bala redonda normal (dano, graze, i-frames), com hitbox um
// pouco menor que o desenho; a CPU desvia dela como de qualquer bala. O plano
// é o mesmo nas duas caixas (justo para os dois).

const PRIMEIRA_MS = 1100
const PERIODO = { min: 2900, max: 3700 } // ms entre um aviso e o próximo
const AVISO_MS = 1050 // do ronco até a pedra entrar na caixa
const SEGUNDA = { chance: 0.4, atrasoMs: 700 }
const VELOCIDADE = 235 // px/s
const DANO = 5
const HITBOX = 0.84 // fração do raio desenhado que machuca
const FAIXAS = [0, 0.5, 1] // posição da faixa (fração do espaço que sobra na caixa)
const COR_AVISO = 0xff5a2a
const COR_POEIRA = 0x9c7a50
const TEXTURA = 'bonus-templo-pedra'

// pedra de pixel art (redonda, luz de cima à esquerda, rachaduras e musgo)
function criarTextura(arena) {
  if (arena.textures.exists(TEXTURA)) return
  const n = 26
  const c = document.createElement('canvas')
  c.width = n
  c.height = n
  const g = c.getContext('2d')
  const r = n / 2 - 1
  const pix = (x, y, cor) => {
    g.fillStyle = cor
    g.fillRect(x, y, 1, 1)
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x + 0.5 - n / 2
      const dy = y + 0.5 - n / 2
      const d = Math.hypot(dx, dy)
      if (d > r) continue
      // luz: mais claro em cima à esquerda, borda escura
      const luz = (-dx - dy) / (r * 2) + 0.5 - (d / r) ** 4 * 0.45
      const cor = luz > 0.78 ? '#c8a878' : luz > 0.58 ? '#a88a60' : luz > 0.38 ? '#86684a' : luz > 0.2 ? '#634a34' : '#3e2c1e'
      pix(x, y, d > r - 1 ? '#2a1c12' : cor)
    }
  }
  // rachaduras e lascas (ajudam a ver a pedra girando)
  for (const [x, y] of [[8, 6], [9, 7], [9, 8], [10, 9], [11, 9], [12, 10], [17, 14], [18, 15], [18, 16], [19, 17], [6, 15], [7, 16], [8, 16], [14, 19], [15, 19], [16, 20]]) pix(x, y, '#2a1c12')
  for (const [x, y] of [[7, 5], [16, 13], [13, 18], [5, 14]]) pix(x, y, '#d8c090')
  for (const [x, y] of [[15, 5], [16, 5], [16, 6], [17, 6], [4, 10], [5, 10], [19, 20], [20, 19]]) pix(x, y, '#4a6a30')
  arena.textures.addCanvas(TEXTURA, c)
}

export default function criar(arena, { rng } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + (b - a) * sorte()
  let ativo = false
  let t = 0
  let proximo = 0
  let avisos = [] // { eixo, sentido, faixa, em, graficos: [Graphics por pista], poeiraEm }
  let pedras = [] // { pista, bala, eixo, sentido, raio, poeiraEm }
  const vivos = new Set() // enfeites soltos (poeira) para o terminar

  const guardar = (o) => {
    vivos.add(o)
    o.once('destroy', () => vivos.delete(o))
    return o
  }
  const raioDe = (l) => Math.max(20, Math.min(30, Math.min(l.width, l.height) * 0.17))
  // posição da faixa no eixo perpendicular ao movimento
  const centroDe = (l, eixo, faixa) => {
    const r = raioDe(l)
    return eixo === 'h' ? l.top + r + faixa * (l.height - 2 * r) : l.left + r + faixa * (l.width - 2 * r)
  }
  const viva = (j) => {
    const p = arena.pistas?.[j]
    return p && p.atacando && !arena.ko?.[j] ? p : null
  }

  const poeirinha = (pista, x, y, { dx = 0, dy = 18, cor = COR_POEIRA, ms = 500 } = {}) => {
    const p = guardar(arena.add.rectangle(x, y, 3, 3, cor, 0.85).setDepth(3))
    pista.caixa.recortar(p)
    arena.tweens.add({ targets: p, x: x + dx, y: y + dy, alpha: 0, duration: ms, onComplete: () => p.destroy() })
  }

  const avisar = (plano) => {
    const graficos = arena.pistas.map((pista) => {
      const g = arena.add.graphics().setDepth(2)
      pista.caixa.recortar(g)
      return g
    })
    avisos.push({ ...plano, graficos, poeiraEm: 0 })
  }

  const planejar = () => {
    const eixo = sorte() < 0.72 ? 'h' : 'v'
    const sentido = sorte() < 0.5 ? -1 : 1
    const i = Math.floor(sorte() * FAIXAS.length)
    avisar({ eixo, sentido, faixa: FAIXAS[i], em: t + AVISO_MS })
    if (sorte() < SEGUNDA.chance) {
      const k = (i + 1 + Math.floor(sorte() * (FAIXAS.length - 1))) % FAIXAS.length
      avisar({ eixo, sentido: sorte() < 0.6 ? -sentido : sentido, faixa: FAIXAS[k], em: t + AVISO_MS + SEGUNDA.atrasoMs })
    }
    tocar(arena, 'ronco')
    shake(arena, AVISO_MS, 0.0025)
  }

  const desenharAviso = (a, g, l) => {
    g.clear()
    const r = raioDe(l)
    const c = centroDe(l, a.eixo, a.faixa)
    const falta = a.em - t
    const urgente = falta < 350
    const pulso = 0.5 + 0.5 * Math.sin(t / (urgente ? 40 : 75))
    const h = a.eixo === 'h'
    const [x, y, w, alt] = h ? [l.left, c - r, l.width, 2 * r] : [c - r, l.top, 2 * r, l.height]
    g.fillStyle(COR_AVISO, 0.08 + 0.14 * pulso).fillRect(x, y, w, alt)
    // bordas tracejadas da faixa
    g.fillStyle(COR_AVISO, 0.55)
    const comp = h ? l.width : l.height
    for (let s = (t * 0.06) % 12; s < comp; s += 12) {
      if (h) {
        g.fillRect(l.left + s, c - r, 6, 2)
        g.fillRect(l.left + s, c + r - 2, 6, 2)
      } else {
        g.fillRect(c - r, l.top + s, 2, 6)
        g.fillRect(c + r - 2, l.top + s, 2, 6)
      }
    }
    // setas (>>) correndo no sentido em que a pedra vem
    g.lineStyle(3, 0xffb070, 0.45 + 0.4 * pulso)
    const passo = 34
    for (let s = (t * 0.11) % passo; s < comp + passo; s += passo) {
      const p = a.sentido > 0 ? s - passo / 2 : comp - s + passo / 2
      const ponta = 7 * a.sentido
      if (h) {
        const px = l.left + p
        g.lineBetween(px - ponta, c - 8, px, c)
        g.lineBetween(px, c, px - ponta, c + 8)
      } else {
        const py = l.top + p
        g.lineBetween(c - 8, py - ponta, c, py)
        g.lineBetween(c, py, c + 8, py - ponta)
      }
    }
  }

  const lancar = (a) => {
    a.graficos.forEach((g) => g.destroy())
    tocar(arena, 'pedraRolando')
    shake(arena, 900, 0.005)
    arena.pistas.forEach((pista, j) => {
      if (!viva(j)) return
      const l = pista.caixa.limites
      const r = raioDe(l)
      const c = centroDe(l, a.eixo, a.faixa)
      const h = a.eixo === 'h'
      const x = h ? (a.sentido > 0 ? l.left - r : l.right + r) : c
      const y = h ? c : a.sentido > 0 ? l.top - r : l.bottom + r
      const bala = pista.balas.criar({
        x,
        y,
        raio: r * HITBOX,
        vx: h ? a.sentido * VELOCIDADE : 0,
        vy: h ? 0 : a.sentido * VELOCIDADE,
        textura: TEXTURA,
        tamanho: r * 2,
        girar: (a.sentido * VELOCIDADE) / r, // rola sem escorregar
        pulso: 0,
        jaAvisada: true, // a faixa vermelha foi o aviso
        atravessa: true,
        dano: DANO,
        origem: 'bonus-pedra',
      })
      pedras.push({ pista, bala, eixo: a.eixo, sentido: a.sentido, raio: r, poeiraEm: 0 })
    })
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      proximo = PRIMEIRA_MS - AVISO_MS
      criarTextura(arena)
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      if (t >= proximo) {
        proximo = t + entre(PERIODO.min, PERIODO.max)
        planejar()
      }
      for (const a of avisos) {
        arena.pistas.forEach((pista, j) => desenharAviso(a, a.graficos[j], pista.caixa.limites))
        // poeira caindo do lado por onde a pedra vai entrar
        if (t >= a.poeiraEm) {
          a.poeiraEm = t + 110
          arena.pistas.forEach((pista, j) => {
            if (!viva(j)) return
            const l = pista.caixa.limites
            const r = raioDe(l)
            const c = centroDe(l, a.eixo, a.faixa)
            if (a.eixo === 'h') poeirinha(pista, a.sentido > 0 ? l.left + 4 + sorte() * 10 : l.right - 4 - sorte() * 10, c - r + sorte() * 2 * r, { dy: 14 })
            else poeirinha(pista, c - r + sorte() * 2 * r, a.sentido > 0 ? l.top + 3 : l.bottom - 3, { dy: a.sentido * 14 })
          })
        }
        if (t >= a.em) {
          a.feito = true
          lancar(a)
        }
      }
      avisos = avisos.filter((a) => !a.feito)
      // rastro de poeira atrás de cada pedra rolando
      pedras = pedras.filter((p) => !p.bala.morta)
      for (const p of pedras) {
        if (t < p.poeiraEm) continue
        p.poeiraEm = t + 45
        const { bala, raio: r, sentido } = p
        if (p.eixo === 'h') poeirinha(p.pista, bala.x - sentido * r * 0.7, bala.y + r * 0.75, { dx: -sentido * 10, dy: -8 - sorte() * 8, ms: 420 })
        else poeirinha(p.pista, bala.x + (sorte() < 0.5 ? -1 : 1) * r * 0.8, bala.y - sentido * r * 0.7, { dx: 0, dy: -sentido * 10, ms: 420 })
        if (sorte() < 0.08) particulas(arena, bala.x, bala.y + (p.eixo === 'h' ? r * 0.8 : 0), { cor: COR_POEIRA, quantidade: 4, velocidade: 60 })
      }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const a of avisos) a.graficos.forEach((g) => g.destroy())
      avisos = []
      for (const p of pedras) p.bala.morta = true
      pedras = []
      for (const o of [...vivos]) {
        arena.tweens?.killTweensOf(o)
        o.destroy()
      }
      vivos.clear()
    },

    estadoDebug() {
      return { avisos: avisos.map((a) => ({ eixo: a.eixo, sentido: a.sentido, faixa: a.faixa, falta: Math.round(a.em - t) })), pedras: pedras.length }
    },
  }
}
