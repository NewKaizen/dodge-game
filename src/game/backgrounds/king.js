import { LARGURA, ALTURA } from '../constants.js'

// Salão de castelo escuro: piso de losangos roxo/azul em duas camadas
// (parallax), colunas nas laterais e partículas subindo devagar
export default function king(scene, objetos) {
  const add = (o) => {
    objetos.push(o)
    return o.setDepth(-10)
  }
  add(scene.add.rectangle(0, 0, LARGURA, ALTURA, 0x07040f).setOrigin(0))
  const longe = add(scene.add.tileSprite(0, 0, LARGURA, ALTURA, 'fundo-king-losangos').setOrigin(0).setTileScale(2).setAlpha(0.35))
  const perto = add(scene.add.tileSprite(0, 0, LARGURA, ALTURA, 'fundo-king-losangos').setOrigin(0).setAlpha(0.55))

  const colunas = []
  for (const x of [22, 70, LARGURA - 70, LARGURA - 22]) {
    const c = add(scene.add.rectangle(x, 0, 26, ALTURA, 0x0c0620).setOrigin(0.5, 0).setAlpha(0.9))
    colunas.push({ obj: c, x })
    add(scene.add.rectangle(x, 0, 30, 10, 0x2a1650).setOrigin(0.5, 0))
  }

  const particulas = Array.from({ length: 36 }, (_, i) => {
    const p = add(scene.add.rectangle(0, 0, 2, 2, i % 3 ? 0x8a6cff : 0x4a7aff))
    return { p, x: (i * 97) % LARGURA, y: (i * 53) % ALTURA, v: 12 + (i % 5) * 6, fase: i }
  })

  return {
    atualizar(dt, estado) {
      const t = estado.tempo / 1000
      longe.tilePositionX = t * 4
      longe.tilePositionY = t * 3
      perto.tilePositionX = t * 10
      perto.tilePositionY = t * 7
      colunas.forEach(({ obj, x }, i) => obj.setX(x + Math.sin(t * 0.5 + i) * 1.5))
      const vel = 1 + estado.fase * 0.6
      for (const q of particulas) {
        q.y -= (q.v * vel * dt) / 1000
        if (q.y < -4) q.y = ALTURA + 4
        q.p.setPosition(q.x + Math.sin(t + q.fase) * 6, q.y).setAlpha(0.3 + 0.3 * Math.sin(t * 2 + q.fase))
      }
    },
  }
}
