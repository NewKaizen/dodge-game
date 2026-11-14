import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { registrarZona } from '../../../attacks/zonas.js'
import { texturaMeteoro } from './arteArenasNovas.js'
import { planoMeteoros, METEOROS, REF_CAIXA } from './planosArenas.js'

// METEOROS (ESTAÇÃO ESPACIAL): pedras do espaço cruzam as caixas de um lado a outro,
// numa diagonal suave. Antes de cada pedra, um RISCO vermelho tracejado marca o caminho
// dela e um "!" pisca na borda por onde ela entra (AVISO). A pedra é uma bala redonda
// normal (dano, graze, i-frames; a CPU enxerga) que deixa um rastro de fogo. O plano
// (planosArenas.js) é o mesmo nas duas caixas e sempre deixa um corredor livre.
// `inclinacao` é dy por px andado na direção em que a pedra viaja.

const DANO = 5
const HITBOX = 0.86 // fração do raio desenhado que machuca
const COR_AVISO = 0xff5a3a

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  let ativo = false
  let t = 0
  let plano = []
  let proxima = 0
  let pedras = [] // { pista, j, bala, dir, raio, x1, y1, x2, y2, em }
  let gs = [] // por pista: Graphics do risco e do rastro

  const pistaViva = (j) => {
    const p = arena.pistas?.[j]
    return p && p.atacando && !p.ataque.desarmado && !arena.ko?.[arena.donoDaPista?.(j) ?? j] ? p : null
  }

  const lancar = (onda) => {
    tocar(arena, 'assobio')
    arena.pistas.forEach((pista, j) => {
      if (!pistaViva(j)) return
      const l = pista.caixa.limites
      for (const r of onda.rochas) {
        const x1 = r.dir > 0 ? l.left - r.raio - 10 : l.right + r.raio + 10
        const y1 = l.top + r.fy * l.height
        const x2 = r.dir > 0 ? l.right + r.raio + 10 : l.left - r.raio - 10
        const y2 = y1 + r.inclinacao * Math.abs(x2 - x1)
        const aviso = METEOROS.avisoMs / aceleracao
        const bala = pista.balas.criar({
          x: x1,
          y: y1,
          vx: r.dir * METEOROS.velocidade,
          vy: r.inclinacao * METEOROS.velocidade,
          raio: r.raio * HITBOX,
          textura: texturaMeteoro(arena),
          tamanho: r.raio * 2.3,
          girar: r.dir * 2.6,
          pulso: 0,
          aviso,
          atravessa: true,
          dano: DANO,
          origem: 'bonus-meteoros',
        })
        const comprimento = Math.hypot(x2 - x1, y2 - y1)
        registrarZona(pista.balas, { tipo: 'linha', x1, y1, x2, y2, espessura: r.raio * 2 }, { ms: aviso, dura: (comprimento / METEOROS.velocidade) * 1000 })
        pedras.push({ pista, j, bala, dir: r.dir, raio: r.raio, x1, y1, x2, y2, comprimento, em: t + aviso })
      }
    })
  }

  const desenhar = () => {
    gs.forEach((g, j) => {
      g.clear()
      for (const p of pedras) {
        if (p.j !== j || p.bala.morta) continue
        const falta = p.em - t
        if (falta > 0) {
          // risco do caminho: tracejado correndo na direção da pedra, piscando mais perto da hora
          const pulso = 0.5 + 0.5 * Math.sin(t / (falta < 350 ? 40 : 80))
          const dx = (p.x2 - p.x1) / p.comprimento
          const dy = (p.y2 - p.y1) / p.comprimento
          g.lineStyle(p.raio * 2, COR_AVISO, 0.05 + 0.1 * pulso)
          g.lineBetween(p.x1, p.y1, p.x2, p.y2)
          g.lineStyle(2, COR_AVISO, 0.5 + 0.4 * pulso)
          for (let s = (t * 0.1) % 18; s < p.comprimento; s += 18) g.lineBetween(p.x1 + dx * s, p.y1 + dy * s, p.x1 + dx * (s + 8), p.y1 + dy * (s + 8))
        } else {
          // rastro de fogo atrás da pedra
          const v = Math.hypot(p.bala.vx, p.bala.vy) || 1
          const ux = p.bala.vx / v
          const uy = p.bala.vy / v
          for (let k = 1; k <= 9; k++) {
            const f = 1 - k / 10
            g.fillStyle(k < 4 ? 0xffd070 : k < 7 ? 0xff7a2a : 0xc02a1a, 0.55 * f)
            g.fillCircle(p.bala.x - ux * k * p.raio * 0.55, p.bala.y - uy * k * p.raio * 0.55, p.raio * (0.9 * f + 0.15))
          }
        }
      }
    })
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoMeteoros(sorte, REF_CAIXA)
      proxima = 0
      gs = arena.pistas.map((pista) => {
        const g = arena.add.graphics().setDepth(4)
        pista.caixa.recortar(g)
        return g
      })
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      while (proxima < plano.length && t >= plano[proxima].em / aceleracao) lancar(plano[proxima++])
      for (const p of pedras) {
        if (p.bala.morta) p.feito = true
        else if (!p.pista.atacando || p.pista.ataque?.desarmado) p.bala.inofensiva = true
        if (!p.cruzou && t >= p.em && Math.abs(p.bala.x - p.pista.caixa.limites.centerX) < 8) {
          p.cruzou = true
          shake(arena, 90, 0.002)
        }
      }
      pedras = pedras.filter((p) => !p.feito)
      desenhar()
    },

    estadoDebug() {
      return { pedras: pedras.map((p) => ({ j: p.j, x: Math.round(p.bala.x), y: Math.round(p.bala.y), avisando: p.em > t })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const p of pedras) p.bala.morta = true
      pedras = []
      for (const g of gs) g.destroy()
      gs = []
    },
  }
}
