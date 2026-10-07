import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { particulas } from '../../../effects/particulas.js'

// TERREMOTO: de tempos em tempos a terra treme. Primeiro um ronco e poeira
// caindo do alto das caixas (o aviso), depois o tremor: a tela sacode, o
// coração é jogado para um lado por um instante (entra no joystick) e pedras
// despencam do teto das caixas (balas normais, com o aviso de sempre).

const PERIODO = { min: 2300, max: 3000 } // ms entre tremores
const AVISO_MS = 650
const TRANCO = { forca: 70, ms: 320 } // empurrão no joystick durante o tremor
const PEDRAS = { min: 3, max: 5 }
const DANO = 4
const COR = 0xa08870

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  let ativo = false
  let t = 0
  let proximo = 0
  let avisado = false
  let tranco = null // { x, y, ate }

  const poeira = () => {
    for (const pista of arena.pistas) {
      const l = pista.caixa.limites
      for (let k = 0; k < 6; k++) {
        const p = arena.add.circle(l.left + sorte() * l.width, l.top + 2, 1 + sorte() * 1.5, COR, 0.9).setDepth(3)
        pista.caixa.recortar(p)
        arena.tweens.add({ targets: p, y: l.top + 30 + sorte() * 40, alpha: 0, duration: 600 + sorte() * 300, onComplete: () => p.destroy() })
      }
    }
  }

  const tremer = () => {
    tocar(arena, 'terremoto')
    shake(arena, 600, 0.012)
    const a = sorte() * Math.PI * 2
    tranco = { x: Math.cos(a) * TRANCO.forca, y: Math.sin(a) * TRANCO.forca, ate: t + TRANCO.ms }
    for (const pista of arena.pistas) {
      if (!pista.rodando) continue
      const l = pista.caixa.limites
      const n = PEDRAS.min + Math.floor(sorte() * (PEDRAS.max - PEDRAS.min + 1))
      // as pedras caem espalhadas, com espaço entre elas para passar
      const faixa = l.width / n
      for (let k = 0; k < n; k++) {
        const x = l.left + faixa * (k + 0.2 + sorte() * 0.6)
        pista.balas.criar({ x, y: l.top + 8, vy: 70, ay: 420, raio: 7, forma: 'hex', cor: COR, dano: DANO, girar: 4, origem: 'bonus-terremoto' })
      }
      particulas(arena, l.centerX, l.top + 6, { cor: COR, quantidade: 10, velocidade: 90 })
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      proximo = 900
      avisado = false
    },

    joy(j, joy) {
      if (!ativo || !tranco || t > tranco.ate || arena.ko?.[j]) return joy
      const c = (v) => Math.max(-100, Math.min(100, v))
      return { x: c(joy.x + tranco.x), y: c(joy.y + tranco.y) }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      if (!avisado && t >= proximo - AVISO_MS) {
        avisado = true
        tocar(arena, 'ronco')
        shake(arena, AVISO_MS, 0.003)
        poeira()
      }
      if (t >= proximo) {
        tremer()
        proximo = t + PERIODO.min + sorte() * (PERIODO.max - PERIODO.min)
        avisado = false
      }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      tranco = null
    },
  }
}
