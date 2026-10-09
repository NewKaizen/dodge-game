import { LARGURA, ALTURA } from '../../constants.js'

// cor entre a e b (p de 0 a 1)
const misturar = (a, b, p) => {
  const c = (d) => Math.round(((a >> d) & 255) + (((b >> d) & 255) - ((a >> d) & 255)) * p) << d
  return c(16) | c(8) | c(0)
}

// CASTELO: o salão de cartas de sempre (o fundo original do PvP). Piso roxo
// com losangos; de vez em quando uma onda de brilho atravessa os losangos e
// naipes translúcidos sobem devagar, balançando, como poeira mágica do castelo.
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
  const NAIPES = ['espadas', 'copas', 'ouros', 'paus']
  const CORES_NAIPES = [0x9a8bff, 0xff5f8a, 0xffd24c, 0x7fe0c0]
  const naipes = Array.from({ length: 16 }, (_, i) => ({
    img: add(scene.add.image(0, 0, `bala-${NAIPES[i % 4]}`).setTint(CORES_NAIPES[i % 4]).setAlpha(0.1 + (i % 3) * 0.03).setScale(0.8 + (i % 4) * 0.35)),
    x: 30 + ((i * 167) % (LARGURA - 60)),
    y: (i * 89) % ALTURA,
    v: 9 + (i % 5) * 3,
    fase: i * 1.7,
  }))

  return {
    atualizar(dt, estado) {
      for (const n of naipes) {
        n.y -= (n.v * dt) / 1000
        if (n.y < 50) n.y = ALTURA + 20
        n.img.setPosition(n.x + Math.sin(estado.tempo / 1400 + n.fase) * 10, n.y).setRotation(Math.sin(estado.tempo / 2000 + n.fase) * 0.4)
      }
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
