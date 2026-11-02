import { LARGURA, ALTURA } from '../constants.js'

// BOSS SEMANAL · LADRA DE CARTAS: o cofre de um cassino à noite. Faixas de luz de lanterna
// varrendo devagar e cartas viradas caindo girando
export default function ladra(scene, objetos) {
  const add = (o) => {
    objetos.push(o)
    return o.setDepth(-10)
  }
  add(scene.add.rectangle(0, 0, LARGURA, ALTURA, 0x0c0712).setOrigin(0))
  for (let x = 0; x < LARGURA; x += 48) add(scene.add.rectangle(x, 0, 2, ALTURA, 0x1c1226).setOrigin(0))
  const luzes = [0, 1].map((i) => add(scene.add.triangle(LARGURA * (0.3 + 0.4 * i), 0, 0, 0, -90, ALTURA, 90, ALTURA, 0xffb060, 0.06).setOrigin(0.5, 0)))
  const cartas = Array.from({ length: 14 }, (_, i) => {
    const c = add(scene.add.rectangle(0, 0, 12, 17, i % 2 ? 0x6e2a1e : 0x2a2244).setStrokeStyle(1, 0xffb060, 0.5))
    return { c, x: (i * 157) % LARGURA, y: (i * 89) % ALTURA, v: 10 + (i % 5) * 4, giro: (i % 3) - 1, fase: i }
  })
  return {
    atualizar(dt, estado) {
      const t = estado.tempo / 1000
      luzes.forEach((l, i) => l.setAngle(Math.sin(t * 0.4 + i * 2) * 18))
      for (const q of cartas) {
        q.y += (q.v * (1 + estado.fase * 0.4) * dt) / 1000
        if (q.y > ALTURA + 12) q.y = -12
        q.c.setPosition(q.x + Math.sin(t * 0.8 + q.fase) * 10, q.y).setAngle(t * 40 * q.giro + q.fase * 20).setAlpha(0.35)
      }
    },
  }
}
