import { LARGURA, ALTURA } from '../constants.js'

// BOSS SEMANAL · ESCURIDÃO: quase preto. Só uns grãos de luz subindo bem devagar e uma névoa
// roxa que respira (a luta é de ouvido: o fundo não pode competir com nada)
export default function escuridao(scene, objetos) {
  const add = (o) => {
    objetos.push(o)
    return o.setDepth(-10)
  }
  add(scene.add.rectangle(0, 0, LARGURA, ALTURA, 0x020106).setOrigin(0))
  const nevoa = add(scene.add.ellipse(LARGURA / 2, ALTURA * 0.42, LARGURA * 0.9, ALTURA * 0.55, 0x2a1f5a, 0.12))
  const graos = Array.from({ length: 30 }, (_, i) => {
    const p = add(scene.add.rectangle(0, 0, 2, 2, i % 4 ? 0x5a50a0 : 0xb8b0ff))
    return { p, x: (i * 131) % LARGURA, y: (i * 71) % ALTURA, v: 4 + (i % 4) * 3, fase: i }
  })
  return {
    atualizar(dt, estado) {
      const t = estado.tempo / 1000
      nevoa.setAlpha(0.08 + 0.06 * Math.sin(t * 0.6)).setScale(1 + 0.04 * Math.sin(t * 0.35))
      for (const q of graos) {
        q.y -= (q.v * (1 + estado.fase * 0.3) * dt) / 1000
        if (q.y < -4) q.y = ALTURA + 4
        q.p.setPosition(q.x + Math.sin(t * 0.7 + q.fase) * 5, q.y).setAlpha(0.15 + 0.2 * Math.sin(t * 1.3 + q.fase))
      }
    },
  }
}
