import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'

// MOSH: a roda de mosh invadiu o palco! De tempos em tempos uma ONDA DE GENTE
// atravessa a caixa de um lado para o outro numa FAIXA (metade de cima, de
// baixo ou o meio) e empurra o coração que estiver nela (entra no joystick:
// dá para resistir um pouco, ou sair da faixa por cima/baixo).
// Sempre com aviso: antes da onda, a borda por onde ela vai entrar pisca em
// rosa só na altura da faixa, com setas apontando o sentido, e as linhas da
// faixa aparecem na caixa (mais o "ê-ê!" da galera). Empurrar não machuca: o
// perigo é ser jogado nas balas. A CPU passa pelo mesmo empurrão.

const PERIODO = { min: 1900, max: 2700 } // ms entre uma onda e a próxima em cada caixa
const PRIMEIRA = { min: 600, max: 1000 }
const AVISO_MS = 950
const VELOCIDADE = 260 // px/s da onda
const LARGURA = 58 // px da "multidão" (largura da onda)
const FORCA = 80 // empurrão no joystick (o direcional vai de -100 a 100)
const FAIXAS = [
  [0, 0.55],
  [0.45, 1],
  [0.22, 0.78],
] // em fração da altura da caixa (sempre sobra espaço livre)
const COR = 0xff4fa8
const GENTE = 0x7a3aa0

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + (b - a) * sorte()
  let ativo = false
  let t = 0
  // por pista: { pista, g, proxima, onda: { lado, f0, f1, inicio, frente, pessoas } | null }
  let visuais = []

  const pistaViva = (j) => {
    const p = arena.pistas?.[j]
    return p && p.atacando && !arena.ko?.[j] ? p : null
  }

  const novaOnda = (v, j) => {
    if (!pistaViva(j)) return
    const [f0, f1] = FAIXAS[Math.floor(sorte() * FAIXAS.length)]
    const lado = sorte() < 0.5 ? 1 : -1 // 1: entra pela esquerda e vai para a direita
    // a multidão: cabeças com braços para cima, espalhadas na faixa
    const pessoas = Array.from({ length: 14 }, (_, k) => ({ dx: entre(4, LARGURA - 6), fy: (k + 0.5) / 14 + entre(-0.03, 0.03), fase: entre(0, 6), r: entre(4.5, 6.5) }))
    v.onda = { lado, f0, f1, inicio: t, frente: null, pessoas }
    tocar(arena, 'avisoOnda')
  }

  // posição da frente da onda (x) agora; null enquanto avisa
  const frente = (v, l) => {
    const o = v.onda
    const dt = t - o.inicio - AVISO_MS
    if (dt < 0) return null
    const andou = (dt / 1000) * VELOCIDADE * aceleracao
    return o.lado > 0 ? l.left + andou : l.right - andou
  }

  const desenhar = (v) => {
    const g = v.g
    g.clear()
    const o = v.onda
    if (!o) return
    const l = v.pista.caixa.limites
    const y0 = l.top + l.height * o.f0
    const y1 = l.top + l.height * o.f1
    const fx = frente(v, l)
    if (fx === null) {
      // aviso: borda de entrada piscando na altura da faixa, setas e linhas da faixa
      const k = (t - o.inicio) / AVISO_MS
      const pisca = Math.sin(t / 60) > 0 ? 1 : 0.45
      const xb = o.lado > 0 ? l.left : l.right - 16
      g.fillStyle(COR, (0.2 + 0.35 * k) * pisca)
      g.fillRect(xb, y0, 16, y1 - y0)
      g.lineStyle(1, COR, 0.35 + 0.3 * k)
      for (let x = l.left + 4; x < l.right - 4; x += 10) {
        g.lineBetween(x, y0, x + 5, y0)
        g.lineBetween(x, y1, x + 5, y1)
      }
      // setas (chevrons) correndo no sentido da onda
      g.lineStyle(3, 0xffd0ec, 0.9 * pisca)
      for (let n = 0; n < 3; n++) {
        const avanco = ((t / 6 + n * 22) % 66) - 10
        const cx = o.lado > 0 ? l.left + 14 + avanco : l.right - 14 - avanco
        const cy = (y0 + y1) / 2
        const s = 7 * o.lado
        g.lineBetween(cx - s, cy - 9, cx, cy)
        g.lineBetween(cx, cy, cx - s, cy + 9)
      }
      return
    }
    // a onda: faixa rosada e a multidão (por baixo das balas)
    const tras = fx - LARGURA * o.lado
    const xa = Math.min(fx, tras)
    g.fillStyle(COR, 0.2)
    g.fillRect(xa, y0, LARGURA, y1 - y0)
    g.lineStyle(3, COR, 0.85)
    g.lineBetween(fx, y0, fx, y1)
    for (const p of o.pessoas) {
      const x = tras + p.dx * o.lado
      const y = y0 + (y1 - y0) * p.fy + Math.sin(t / 90 + p.fase) * 2
      const braco = Math.sin(t / 110 + p.fase) * 3
      g.lineStyle(2, GENTE, 0.9)
      g.lineBetween(x - 3, y, x - 7 + braco, y - 8)
      g.lineBetween(x + 3, y, x + 7 - braco, y - 8)
      g.fillStyle(GENTE, 0.9)
      g.fillCircle(x, y, p.r)
      g.fillStyle(0xc08ae0, 0.9)
      g.fillCircle(x - 1, y - 1, p.r * 0.45)
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      visuais = arena.pistas.map((pista) => {
        const g = arena.add.graphics().setDepth(4)
        pista.caixa.recortar(g)
        return { pista, g, proxima: entre(PRIMEIRA.min, PRIMEIRA.max), onda: null }
      })
    },

    // empurrão: o coração dentro da onda (na faixa, entre a frente e a traseira)
    joy(j, joy) {
      const v = visuais[j]
      if (!ativo || !v?.onda || arena.ko?.[j]) return joy
      const l = v.pista.caixa.limites
      const fx = frente(v, l)
      const c = v.pista.coracoes[0]
      if (fx === null || !c?.ativo) return joy
      const o = v.onda
      const y0 = l.top + l.height * o.f0 - c.hitbox
      const y1 = l.top + l.height * o.f1 + c.hitbox
      const dentroX = o.lado > 0 ? c.x <= fx && c.x >= fx - LARGURA : c.x >= fx && c.x <= fx + LARGURA
      if (!dentroX || c.y < y0 || c.y > y1) return joy
      return { x: Math.max(-100, Math.min(100, joy.x + FORCA * o.lado)), y: joy.y }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      visuais.forEach((v, j) => {
        if (v.onda) {
          const l = v.pista.caixa.limites
          const fx = frente(v, l)
          if (fx !== null && !v.onda.chegou) {
            v.onda.chegou = true
            tocar(arena, 'onda')
            shake(arena, 220, 0.004)
          }
          const saiu = fx !== null && (v.onda.lado > 0 ? fx - LARGURA > l.right : fx + LARGURA < l.left)
          if (saiu) v.onda = null
        }
        if (!v.onda) {
          v.proxima -= delta
          if (v.proxima <= 0) {
            v.proxima = entre(PERIODO.min, PERIODO.max) / aceleracao
            novaOnda(v, j)
          }
        }
        desenhar(v)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), ondas: visuais.map((v) => (v.onda ? { lado: v.onda.lado, faixa: [v.onda.f0, v.onda.f1], avisando: frente(v, v.pista.caixa.limites) === null } : null)) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of visuais) v.g.destroy()
      visuais = []
    },
  }
}
