import { tocar } from '../../../audio.js'

// PISTA DE GELO: o chão das caixas vira gelo. O coração DESLIZA: demora para
// pegar velocidade, demora para frear e continua escorregando quando você
// solta o direcional (a velocidade vai para o joystick com inércia). Dá para
// "patinar" desviando, mas frear em cima da hora não dá. Flocos caem e o gelo
// brilha; um "shhh" de patins quando o coração muda de direção com força.

const ACELERA_MS = 380 // tempo para responder ao direcional
const DESLIZA_MS = 1100 // tempo para parar sozinho (sem direcional)
const COR = 0xbfefff

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  let ativo = false
  let t = 0
  let ultimoDelta = 16
  let ultimoSom = 0
  const velocidade = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]
  let visuais = [] // por pista: { pista, piso, brilho, flocos }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      tocar(arena, 'congelar')
      visuais = arena.pistas.map((pista, j) => {
        const piso = arena.add.rectangle(0, 0, 10, 10, COR, 0.14).setOrigin(0).setDepth(2)
        const brilho = arena.add.graphics().setDepth(2)
        pista.caixa.recortar(piso, brilho)
        velocidade[j] = { x: 0, y: 0 }
        return { pista, piso, brilho, flocos: [] }
      })
    },

    joy(j, joy) {
      if (!ativo || arena.ko?.[j]) return joy
      const v = velocidade[j]
      const empurrando = Math.hypot(joy.x, joy.y) > 15
      const k = Math.min(1, ultimoDelta / (empurrando ? ACELERA_MS : DESLIZA_MS))
      const antes = Math.atan2(v.y, v.x)
      v.x += (joy.x - v.x) * k
      v.y += (joy.y - v.y) * k
      // curva fechada em alta velocidade: barulho de patins
      const rapido = Math.hypot(v.x, v.y) > 60
      const virou = Math.abs(Math.atan2(v.y, v.x) - antes) > 0.06
      if (empurrando && rapido && virou && t - ultimoSom > 450) {
        ultimoSom = t
        tocar(arena, 'patins')
      }
      return { x: v.x, y: v.y }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      ultimoDelta = delta
      for (const v of visuais) {
        const l = v.pista.caixa.limites
        v.piso.setPosition(l.left, l.top).setSize(l.width, l.height)
        // reflexos diagonais andando devagar no gelo
        v.brilho.clear().lineStyle(2, 0xffffff, 0.18)
        for (let k = -2; k < 6; k++) {
          const x = l.left + ((k * 70 + t * 0.02) % (l.width + 140)) - 70
          v.brilho.lineBetween(x, l.bottom, x + 50, l.top)
        }
        v.flocos = v.flocos.filter((f) => {
          f.y += delta * 0.04
          f.x += Math.sin((t + f.getData('fase')) / 300) * 0.25
          if (f.y < l.bottom) return true
          f.destroy()
          return false
        })
        if (sorte() < delta / 160) {
          const f = arena.add.circle(l.left + sorte() * l.width, l.top - 2, 1 + sorte() * 1.5, 0xffffff, 0.8).setDepth(3)
          f.setData('fase', sorte() * 1000)
          v.pista.caixa.recortar(f)
          v.flocos.push(f)
        }
      }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of visuais) {
        v.piso.destroy()
        v.brilho.destroy()
        v.flocos.forEach((f) => f.destroy())
      }
      visuais = []
    },
  }
}
