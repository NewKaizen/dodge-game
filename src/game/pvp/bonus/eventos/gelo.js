import { tocar } from '../../../audio.js'

// PISTA DE GELO: o chão das caixas vira gelo. O coração DESLIZA: demora para
// pegar velocidade, demora para frear e continua escorregando quando você
// solta o direcional (a velocidade vai para o joystick com inércia). Dá para
// "patinar" desviando, mas frear em cima da hora não dá. Um "shhh" de patins
// quando o coração muda de direção com força.
// Visual (tudo por baixo das balas, que são brancas: o piso é um azul médio
// para elas continuarem saltando aos olhos): piso em degradê azul, rachaduras,
// reflexos largos passando, brilhinhos piscando, geada na borda da caixa,
// flocos caindo e um rastro de patins atrás do coração.

const ACELERA_MS = 380 // tempo para responder ao direcional
const DESLIZA_MS = 1100 // tempo para parar sozinho (sem direcional)
const PISO = { cima: 0x6cc4ff, baixo: 0x1d5a9e, alpha: 0.5 }
const GEADA = 0xdff6ff
const RASTRO = { aCadaMs: 35, vidaMs: 420 }
// rachaduras e brilhinhos em frações da caixa (a caixa pode mudar de tamanho)
const RACHADURAS = [
  [[0.08, 0.2], [0.18, 0.28], [0.2, 0.42], [0.31, 0.5]],
  [[0.18, 0.28], [0.27, 0.22]],
  [[0.62, 0.7], [0.7, 0.62], [0.82, 0.66], [0.9, 0.58]],
  [[0.7, 0.62], [0.72, 0.5]],
  [[0.44, 0.9], [0.5, 0.8], [0.6, 0.84]],
]
const BRILHOS = [
  [0.15, 0.7, 0], [0.32, 0.18, 1.3], [0.55, 0.4, 2.6], [0.78, 0.22, 0.7], [0.88, 0.8, 3.4], [0.4, 0.66, 4.1], [0.66, 0.9, 5.2],
]

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
  let visuais = [] // por pista: { pista, piso, brilho, flocos, rastro, proximoRastro }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      tocar(arena, 'congelar')
      visuais = arena.pistas.map((pista, j) => {
        const piso = arena.add.graphics().setDepth(2)
        const brilho = arena.add.graphics().setDepth(3)
        pista.caixa.recortar(piso, brilho)
        velocidade[j] = { x: 0, y: 0 }
        return { pista, piso, brilho, flocos: [], rastro: [], proximoRastro: 0 }
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
        const px = (f) => l.left + f * l.width
        const py = (f) => l.top + f * l.height
        // piso: degradê azul, claro em cima e fundo embaixo
        v.piso.clear()
        v.piso.fillGradientStyle(PISO.cima, PISO.cima, PISO.baixo, PISO.baixo, PISO.alpha, PISO.alpha, PISO.alpha, PISO.alpha)
        v.piso.fillRect(l.left, l.top, l.width, l.height)
        // rachaduras finas no gelo
        v.piso.lineStyle(1, 0xffffff, 0.3)
        for (const linha of RACHADURAS) v.piso.strokePoints(linha.map(([fx, fy]) => ({ x: px(fx), y: py(fy) })))
        // geada na borda de dentro da caixa
        v.piso.lineStyle(4, GEADA, 0.55).strokeRect(l.left + 2, l.top + 2, l.width - 4, l.height - 4)
        v.piso.lineStyle(1, 0xffffff, 0.8).strokeRect(l.left + 5, l.top + 5, l.width - 10, l.height - 10)

        v.brilho.clear()
        // reflexos largos atravessando o gelo devagar (faixa clara + fio branco)
        for (let k = -1; k < 4; k++) {
          const x = l.left + ((k * 120 + t * 0.035) % (l.width + 240)) - 120
          v.brilho.fillStyle(0xffffff, 0.12)
          v.brilho.fillPoints([{ x, y: l.bottom }, { x: x + 26, y: l.bottom }, { x: x + 26 + 60, y: l.top }, { x: x + 60, y: l.top }], true)
          v.brilho.lineStyle(2, 0xffffff, 0.35).lineBetween(x + 30, l.bottom, x + 90, l.top)
        }
        // brilhinhos piscando (estrela de 4 pontas)
        for (const [fx, fy, fase] of BRILHOS) {
          const a = Math.max(0, Math.sin(t / 380 + fase)) ** 4
          if (a < 0.05) continue
          const x = px(fx)
          const y = py(fy)
          const r = 2 + a * 4
          v.brilho.lineStyle(1.5, 0xffffff, a).lineBetween(x - r, y, x + r, y).lineBetween(x, y - r, x, y + r)
          v.brilho.fillStyle(0xffffff, a).fillCircle(x, y, 1.2)
        }
        // rastro de patins atrás do coração
        const c = v.pista.coracoes[0]
        if (c?.ativo && t >= v.proximoRastro) {
          v.proximoRastro = t + RASTRO.aCadaMs
          const ultimo = v.rastro[v.rastro.length - 1]
          if (!ultimo || Math.hypot(c.x - ultimo.x, c.y - ultimo.y) > 1.5) v.rastro.push({ x: c.x, y: c.y, t })
        }
        v.rastro = v.rastro.filter((p) => t - p.t < RASTRO.vidaMs)
        for (const p of v.rastro) {
          const a = 1 - (t - p.t) / RASTRO.vidaMs
          v.brilho.fillStyle(0xdff6ff, 0.5 * a).fillCircle(p.x, p.y, 1.5 + 2.5 * a)
        }
        v.flocos = v.flocos.filter((f) => {
          f.y += delta * 0.04
          f.x += Math.sin((t + f.getData('fase')) / 300) * 0.25
          if (f.y < l.bottom) return true
          f.destroy()
          return false
        })
        if (sorte() < delta / 160) {
          const f = arena.add.circle(l.left + sorte() * l.width, l.top - 2, 0.8 + sorte(), 0xcfeaff, 0.4).setDepth(3) // fraquinhos: não parecem bala
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
