import { LARGURA, ALTURA } from '../../constants.js'

// cor entre a e b (p de 0 a 1)
const misturar = (a, b, p) => {
  const c = (d) => Math.round(((a >> d) & 255) + (((b >> d) & 255) - ((a >> d) & 255)) * p) << d
  return c(16) | c(8) | c(0)
}

// CASTELO: o salão de cartas de sempre (o fundo original do PvP). Piso roxo
// com losangos; de vez em quando uma onda de brilho atravessa os losangos.
export default function castelo(scene, objetos) {
  const add = (o) => {
    objetos.push(o)
    return o.setDepth(-10)
  }
  const g = add(scene.add.graphics())
  g.fillStyle(0x0d0a16, 1)
  g.fillRect(0, 0, LARGURA, ALTURA)
  g.fillStyle(0x17122b, 1)
  g.fillRoundedRect(6, 66, LARGURA - 12, ALTURA - 72, 16)
  const losangos = []
  for (let y = 84; y < ALTURA - 14; y += 28) {
    for (let x = 24 + ((y / 28) % 2) * 14; x < LARGURA - 16; x += 28) losangos.push({ x, y })
  }
  const brilho = add(scene.add.graphics())

  return {
    atualizar(dt, estado) {
      // a onda de brilho cruza o salão na diagonal a cada ~6 s
      const frente = ((estado.tempo / 6000) % 1) * (LARGURA + ALTURA + 400) - 200
      brilho.clear()
      for (const { x, y } of losangos) {
        const perto = Math.max(0, 1 - Math.abs(x + y - frente) / 90)
        brilho.fillStyle(misturar(0x221a3c, 0x5a46a8, perto), 1)
        brilho.fillPoints([{ x, y: y - 4 }, { x: x + 3, y }, { x, y: y + 4 }, { x: x - 3, y }], true)
      }
    },
  }
}
