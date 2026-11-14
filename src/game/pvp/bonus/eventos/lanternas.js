import { tocar } from '../../../audio.js'
import { registrarZona } from '../../../attacks/zonas.js'
import { texturaLanterna } from './arteArenasNovas.js'
import { planoLanternas, LANTERNAS, REF_CAIXA } from './planosArenas.js'

// LANTERNAS (CHINATOWN): lanternas de festival SOLTAS sobem devagar pela caixa, balançando.
// Cada uma nasce no chão da caixa fraquinha e piscando (um anel dourado fecha em volta:
// é o AVISO, não machuca), depois ACENDE (o brilho fica forte) e sobe: acesa, ela
// machuca e bloqueia o caminho. É uma bala redonda normal (dano, graze, i-frames; a CPU
// enxerga); a zona avisada cobre a coluna por onde ela sobe. O plano
// (planosArenas.js) é o mesmo nas duas caixas e sempre deixa uma faixa livre na largura.

const DANO = 4
const HITBOX = 0.82
const COR = 0xffc060

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  let ativo = false
  let t = 0
  let plano = []
  let proxima = 0
  let lanternas = [] // { pista, j, bala, x0, raio, fase, em, y0 }
  let gs = []

  const pistaViva = (j) => {
    const p = arena.pistas?.[j]
    return p && p.atacando && !p.ataque.desarmado && !arena.ko?.[arena.donoDaPista?.(j) ?? j] ? p : null
  }

  const soltar = (onda) => {
    tocar(arena, 'brotar')
    arena.pistas.forEach((pista, j) => {
      if (!pistaViva(j)) return
      const l = pista.caixa.limites
      for (const q of onda.lanternas) {
        const x0 = l.left + q.fx * l.width
        const y0 = l.bottom - q.raio - 6
        const aviso = LANTERNAS.avisoMs / aceleracao
        const bala = pista.balas.criar({
          x: x0,
          y: y0,
          vy: -LANTERNAS.velocidade,
          raio: q.raio * HITBOX,
          textura: texturaLanterna(arena),
          tamanho: q.raio * 2.8,
          pulso: 0,
          aviso,
          atravessa: true,
          dano: DANO,
          origem: 'bonus-lanternas',
          atualizar: (b) => {
            b.x = x0 + Math.sin(b.idade / 420 + q.fase) * LANTERNAS.balanco
            if (!pista.atacando || pista.ataque?.desarmado) b.inofensiva = true
            if (b.y < l.top - q.raio - 14) b.morta = true
          },
        })
        const coluna = q.raio + LANTERNAS.balanco
        registrarZona(pista.balas, { tipo: 'area', x: x0 - coluna, y: l.top, largura: coluna * 2, altura: l.height }, { ms: aviso, dura: (l.height / LANTERNAS.velocidade) * 1000 })
        lanternas.push({ pista, j, bala, x0, y0, raio: q.raio, fase: q.fase, em: t + aviso })
      }
    })
  }

  const desenhar = () => {
    gs.forEach((g, j) => {
      g.clear()
      for (const q of lanternas) {
        if (q.j !== j || q.bala.morta) continue
        const falta = q.em - t
        if (falta > 0) {
          // anel dourado fechando em volta de onde ela vai subir, brilho fraquinho piscando
          const k = 1 - falta / (LANTERNAS.avisoMs / aceleracao)
          const pisca = Math.sin(t / 60) > 0
          g.lineStyle(2, COR, pisca ? 0.9 : 0.4)
          g.strokeCircle(q.x0, q.y0, q.raio * (2.6 - 1.5 * k))
          g.fillStyle(COR, 0.06 + 0.1 * k).fillCircle(q.x0, q.y0, q.raio * 1.8)
        } else {
          // acesa: brilho quente em volta que treme
          const b = q.bala
          const tremor = 0.8 + 0.2 * Math.sin(t / 70 + q.fase)
          g.fillStyle(0xff8a30, 0.12 * tremor).fillCircle(b.x, b.y, q.raio * 2.4)
          g.fillStyle(0xffb050, 0.18 * tremor).fillCircle(b.x, b.y, q.raio * 1.5)
        }
      }
    })
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoLanternas(sorte, REF_CAIXA)
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
      while (proxima < plano.length && t >= plano[proxima].em / aceleracao) soltar(plano[proxima++])
      lanternas = lanternas.filter((q) => !q.bala.morta)
      desenhar()
    },

    estadoDebug() {
      return { lanternas: lanternas.map((q) => ({ j: q.j, x: Math.round(q.bala.x), y: Math.round(q.bala.y), acesa: q.em <= t })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const q of lanternas) q.bala.morta = true
      lanternas = []
      for (const g of gs) g.destroy()
      gs = []
    },
  }
}
