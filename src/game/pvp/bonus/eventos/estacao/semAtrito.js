import { CORACAO } from '../../../../constants.js'
import { fatores } from '../../../../acessibilidade.js'
import { tocar } from '../../../../audio.js'
import { passoSemAtrito, quicarNasBordas, SEM_ATRITO } from './planos.js'
import { criarCofre, avisoDoEvento, ehEspelho } from './util.js'

// SEM ATRITO (ESTAÇÃO ESPACIAL): gravidade zero de verdade. O joystick vira EMPUXO: o coração ganha velocidade
// e continua DESLIZANDO (quase sem arrasto) quando você solta; para frear é preciso empurrar para o lado
// contrário. A velocidade máxima é um pouco menor que a normal e nas paredes o coração quica de leve.
// Para dar a sensação: estrelas correm ao fundo no sentido oposto ao do coração, uma seta mostra a deriva e
// os jatos saem do coração no sentido contrário ao empurrão. As regras de física estão em planos.js.
// A CPU também desliza (ela não sabe frear direito, e tudo bem).

const ESTRELAS = 30
const COR_JATO = [0xffd070, 0xff7a3a, 0x6ac8ff]

export default function criar(arena, { rng } = {}) {
  const sorte = rng ?? Math.random
  const cofre = criarCofre(arena)
  let ativo = false
  let ultimoDelta = 16
  // por pista: { pista, v, empuxo, estrelas, g, jatos }
  let lados = []

  const meioDoCoracao = (c) => (CORACAO.tamanho * (c.tamanho ?? 1)) / 2

  return {
    comecar() {
      if (ativo) return
      ativo = true
      lados = arena.pistas.map((pista) => {
        const g = cofre.guardar(arena.add.graphics().setDepth(2.5))
        const seta = cofre.guardar(arena.add.graphics().setDepth(9))
        pista.caixa.recortar(g, seta)
        const estrelas = Array.from({ length: ESTRELAS }, () => ({ fx: sorte(), fy: sorte(), prof: 0.25 + sorte() * 0.75, tam: sorte() < 0.25 ? 2 : 1 }))
        return { pista, v: { x: 0, y: 0 }, empuxo: { x: 0, y: 0 }, estrelas, g, seta, jatos: [] }
      })
      tocar(arena, 'voo')
      avisoDoEvento(arena, cofre, 'SEM ATRITO! FREIE AO CONTRÁRIO', { cor: '#9ee8ff' })
    },

    joy(j, joy) {
      const s = lados[j]
      if (!ativo || !s || arena.ko?.[arena.donoDaPista?.(j) ?? j]) return joy
      const c = s.pista.coracoes[0]
      if (!c?.ativo || ehEspelho(arena, j)) return joy
      const bruto = Math.hypot(joy.x, joy.y) / 100
      const f = bruto > 1 ? 1 / bruto : 1
      s.empuxo = bruto > 0.05 ? { x: (joy.x / 100) * f, y: (joy.y / 100) * f } : { x: 0, y: 0 }
      let v = passoSemAtrito(s.v, joy, ultimoDelta)
      v = quicarNasBordas(v, c, s.pista.caixa.limites, meioDoCoracao(c))
      s.v = v
      return { x: v.x, y: v.y }
    },

    atualizar(delta) {
      if (!ativo) return
      ultimoDelta = delta
      const particulas = fatores().particulas
      for (const s of lados) {
        const l = s.pista.caixa.limites
        const c = s.pista.coracoes[0]
        const px = (s.v.x * 180) / 100 // px/s
        const py = (s.v.y * 180) / 100
        const vel = Math.hypot(px, py)

        // estrelas: correm no sentido oposto ao do coração (parallax); viram riscos quando a velocidade é alta
        s.g.clear()
        for (const e of s.estrelas) {
          e.fx -= ((px * e.prof * delta) / 1000 / l.width) * 0.9
          e.fy -= ((py * e.prof * delta) / 1000 / l.height) * 0.9
          e.fx -= Math.floor(e.fx)
          e.fy -= Math.floor(e.fy)
          const x = l.left + e.fx * l.width
          const y = l.top + e.fy * l.height
          const a = 0.25 + 0.4 * e.prof
          s.g.fillStyle(0xcfe8ff, a)
          if (vel > 40) {
            s.g.lineStyle(e.tam, 0xcfe8ff, a)
            s.g.lineBetween(x, y, x + (px * e.prof) / 14, y + (py * e.prof) / 14)
          } else s.g.fillRect(x, y, e.tam, e.tam)
        }

        // seta de deriva: para onde o coração vai se ninguém empurrar
        s.seta.clear()
        if (c?.ativo && vel > 14) {
          const k = Math.min(1, vel / 150)
          const dx = px / vel
          const dy = py / vel
          const comp = 8 + 24 * k
          const x1 = c.x + dx * 11
          const y1 = c.y + dy * 11
          const x2 = c.x + dx * (11 + comp)
          const y2 = c.y + dy * (11 + comp)
          s.seta.lineStyle(2, 0x9ee8ff, 0.35 + 0.4 * k)
          s.seta.lineBetween(x1, y1, x2, y2)
          const nx = -dy * 3.5
          const ny = dx * 3.5
          s.seta.fillStyle(0x9ee8ff, 0.5 + 0.4 * k)
          s.seta.fillTriangle(x2 + dx * 5, y2 + dy * 5, x2 + nx, y2 + ny, x2 - nx, y2 - ny)
        }

        // jatos: saem para o lado contrário ao empurrão
        const forca = Math.hypot(s.empuxo.x, s.empuxo.y)
        if (c?.ativo && forca > 0.25 && s.jatos.length < 28 && sorte() < particulas + 0.2) {
          const ex = s.empuxo.x / forca
          const ey = s.empuxo.y / forca
          s.jatos.push({ x: c.x - ex * 8, y: c.y - ey * 8, vx: -ex * 70 + (sorte() - 0.5) * 30, vy: -ey * 70 + (sorte() - 0.5) * 30, vida: 0 })
        }
        s.jatos = s.jatos.filter((p) => {
          p.vida += delta
          p.x += (p.vx * delta) / 1000
          p.y += (p.vy * delta) / 1000
          if (p.vida > 260) return false
          const k = p.vida / 260
          s.seta.fillStyle(COR_JATO[k < 0.35 ? 0 : k < 0.7 ? 1 : 2], 0.8 * (1 - k))
          s.seta.fillCircle(p.x, p.y, 2.4 * (1 - k * 0.6))
          return true
        })
      }
    },

    estadoDebug() {
      return { v: lados.map((s) => ({ x: Math.round(s.v.x), y: Math.round(s.v.y) })), vmax: SEM_ATRITO.vmax }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      cofre.limpar()
      lados = []
    },
  }
}
