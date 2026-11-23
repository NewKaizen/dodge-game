import { LARGURA, ALTURA } from '../../constants.js'
import { assar, texturaAssada } from '../../arte/assar.js'

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
  const losangos = []
  for (let y = 84; y < ALTURA - 14; y += 28) {
    for (let x = 24 + ((y / 28) % 2) * 14; x < LARGURA - 16; x += 28) losangos.push({ x, y })
  }
  const losango = (g, x, y) => {
    // dois triângulos (o fillPoints passaria pelo earcut a cada quadro)
    g.fillTriangle(x, y - 4, x + 3, y, x - 3, y)
    g.fillTriangle(x, y + 4, x + 3, y, x - 3, y)
  }
  // o piso parado (salão e os ~480 losangos apagados) vira textura uma vez só (arte/assar.js):
  // só os losangos que a onda de brilho está cruzando são desenhados a cada quadro
  const pintarPiso = (g, dx = 0, dy = 0) => {
    g.fillStyle(0x0d0a16, 1)
    g.fillRect(dx, dy, LARGURA, ALTURA)
    g.fillStyle(0x17122b, 1)
    g.fillRoundedRect(dx + 6, dy + 66, LARGURA - 12, ALTURA - 72, 16)
    g.fillStyle(0x221a3c, 1)
    for (const { x, y } of losangos) losango(g, dx + x, dy + y)
  }
  const piso = assar(scene, 'fundo-castelo', LARGURA, ALTURA, (g) => pintarPiso(g, -LARGURA / 2, -ALTURA / 2))
  if (piso) add(piso.setPosition(LARGURA / 2, ALTURA / 2))
  else pintarPiso(add(scene.add.graphics()))
  // os losangos que a onda acende: Images de um losango branco assado, tingidas (antes um Graphics
  // redesenhado a cada quadro, ~750 comandos); a onda cobre no máximo ~1/6 do piso de uma vez
  const losangoBranco = texturaAssada(scene, 'castelo-losango', 8, 10, (g) => {
    g.fillStyle(0xffffff, 1)
    losango(g, 0, 0)
  }, { folga: 0 })
  const brilho = losangoBranco ? null : add(scene.add.graphics())
  const acesos = losangoBranco ? Array.from({ length: 110 }, () => add(scene.add.image(0, 0, losangoBranco).setVisible(false))) : []
  const NAIPES = ['espadas', 'copas', 'ouros', 'paus']
  const CORES_NAIPES = [0x9a8bff, 0xff5f8a, 0xffd24c, 0x7fe0c0]
  const naipes = Array.from({ length: 22 }, (_, i) => ({
    img: add(scene.add.image(0, 0, `bala-${NAIPES[i % 4]}`).setTint(CORES_NAIPES[i % 4]).setAlpha(0.1 + (i % 3) * 0.03).setScale(0.8 + (i % 4) * 0.35)),
    x: 30 + ((i * 167) % (LARGURA - 60)),
    y: (i * 89) % ALTURA,
    v: 9 + (i % 5) * 3,
    fase: i * 1.7,
  }))

  let brilhoReserva = null // (a onda nunca acende mais que o pool; se acender, o resto vai num Graphics)
  return {
    atualizar(dt, estado) {
      brilhoReserva?.clear()
      for (const n of naipes) {
        n.y -= (n.v * dt) / 1000
        if (n.y < 50) n.y = ALTURA + 20
        n.img.setPosition(n.x + Math.sin(estado.tempo / 1400 + n.fase) * 10, n.y).setRotation(Math.sin(estado.tempo / 2000 + n.fase) * 0.4)
      }
      // a onda de brilho cruza o salão na diagonal a cada ~6 s
      const frente = ((estado.tempo / 6000) % 1) * (LARGURA + ALTURA + 400) - 200
      brilho?.clear()
      let n = 0
      for (const { x, y } of losangos) {
        const perto = Math.max(0, 1 - Math.abs(x + y - frente) / 90)
        if (perto <= 0) continue // apagado: já está no piso
        const cor = misturar(0x221a3c, 0x5a46a8, perto)
        const img = acesos[n++]
        if (img) img.setVisible(true).setPosition(x, y).setTint(cor)
        else {
          ;(brilho ?? (brilhoReserva ??= add(scene.add.graphics()))).fillStyle(cor, 1)
          losango(brilho ?? brilhoReserva, x, y)
        }
      }
      for (let i = n; i < acesos.length; i++) {
        if (!acesos[i].visible) break
        acesos[i].setVisible(false)
      }
    },
  }
}
