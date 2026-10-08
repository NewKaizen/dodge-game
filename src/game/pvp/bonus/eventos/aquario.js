import { tocar } from '../../../audio.js'

// AQUÁRIO: as caixas enchem de água. Tudo fica em câmera lenta (a pista anda
// a RITMO do tempo: balas, coração e o próprio ataque), o coração BOIA (um
// empuxo para cima entra no joystick) e o movimento tem inércia de água: para
// afundar, segure para BAIXO. Bolhas sobem, dois peixinhos passeiam e a
// superfície ondula no alto da caixa.

const RITMO = 0.72 // fator do relógio da pista (câmera lenta)
const EMPUXO = 48 // quanto a água empurra para cima (no joystick, -100..100)
const FORCA = 0.85 // quanto do joystick vale dentro d'água
const INERCIA_MS = 220 // quanto o coração demora para responder (arrasto da água)
const AGUA = 0x2a7fff
const SUPERFICIE = 10 // altura da faixa de espuma no alto (px)

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  let ativo = false
  let t = 0
  let ultimoDelta = 16
  let proximaBolha = 0
  const velocidade = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]
  let visuais = [] // por pista: { pista, agua, onda, peixes, bolhas }

  const peixe = (cor) => {
    const g = arena.add.graphics().setDepth(3)
    g.fillStyle(cor, 0.9).fillEllipse(0, 0, 18, 10)
    g.fillTriangle(-8, 0, -15, -6, -15, 6)
    g.fillStyle(0xffffff, 1).fillCircle(5, -1, 2)
    g.fillStyle(0x000000, 1).fillCircle(5.5, -1, 1)
    return g
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      tocar(arena, 'tchibum')
      visuais = arena.pistas.map((pista, j) => {
        const agua = arena.add.rectangle(0, 0, 10, 10, AGUA, 0.26).setOrigin(0).setDepth(2)
        const onda = arena.add.graphics().setDepth(3)
        const peixes = [peixe(0xffa23a), peixe(0xff5fa0)].map((p, k) => {
          p.setData({ base: 0.3 + k * 0.4, fase: sorte() * 6, lado: k ? -1 : 1, vel: 0.00025 + sorte() * 0.0002 })
          return p
        })
        pista.caixa.recortar(agua, onda, ...peixes)
        velocidade[j] = { x: 0, y: 0 }
        return { pista, agua, onda, peixes, bolhas: [] }
      })
    },

    // dentro d'água: joystick mais fraco, empuxo para cima e inércia
    joy(j, joy) {
      if (!ativo || arena.ko?.[j]) return joy
      const alvo = { x: joy.x * FORCA, y: joy.y * FORCA - EMPUXO }
      const k = Math.min(1, ultimoDelta / INERCIA_MS)
      const v = velocidade[j]
      v.x += (alvo.x - v.x) * k
      v.y += (alvo.y - v.y) * k
      return { x: Math.max(-100, Math.min(100, v.x)), y: Math.max(-100, Math.min(100, v.y)) }
    },

    passo(j, delta) {
      return ativo ? delta * RITMO : delta
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      ultimoDelta = delta
      for (const v of visuais) {
        const l = v.pista.caixa.limites
        v.agua.setPosition(l.left, l.top).setSize(l.width, l.height)
        // superfície ondulando
        v.onda.clear()
        v.onda.fillStyle(0xbfe8ff, 0.55)
        for (let x = 0; x <= l.width; x += 6) {
          const y = Math.sin(x / 14 + t / 260) * 2.5 + Math.sin(x / 7 - t / 180) * 1.2
          v.onda.fillRect(l.left + x, l.top + y, 6, SUPERFICIE / 2)
        }
        // peixes indo e vindo
        for (const p of v.peixes) {
          const { base, fase, lado, vel } = p.data.values
          const ida = Math.sin(t * vel * 6 + fase)
          p.setPosition(l.centerX + ida * l.width * 0.38 * lado, l.top + l.height * base + Math.sin(t / 400 + fase) * 6)
          p.setScale(Math.cos(t * vel * 6 + fase) * lado >= 0 ? 1 : -1, 1)
        }
        // bolhas subindo e somem na superfície
        v.bolhas = v.bolhas.filter((b) => {
          b.y -= delta * 0.05
          b.x += Math.sin((t + b.getData('fase')) / 180) * 0.3
          if (b.y > l.top + 4) return true
          b.destroy()
          return false
        })
      }
      if (t >= proximaBolha) {
        proximaBolha = t + 90
        for (const v of visuais) {
          const l = v.pista.caixa.limites
          const b = arena.add.circle(l.left + sorte() * l.width, l.bottom - 2, 1.5 + sorte() * 2.5).setStrokeStyle(1, 0xdff4ff).setDepth(3)
          b.setData('fase', sorte() * 1000)
          v.pista.caixa.recortar(b)
          v.bolhas.push(b)
        }
        if (sorte() < 0.08) tocar(arena, 'bolha')
      }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of visuais) {
        v.agua.destroy()
        v.onda.destroy()
        v.peixes.forEach((p) => p.destroy())
        v.bolhas.forEach((b) => b.destroy())
      }
      visuais = []
    },
  }
}
