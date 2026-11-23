import { LARGURA, ALTURA } from '../constants.js'
import { assar } from '../arte/assar.js'

const FATIAS = 16
const CORES_FATIAS = [0x2a1050, 0x0e2a55]
const NAIPES = ['espadas', 'copas', 'ouros', 'paus']
const CORES_NAIPES = { espadas: 0x9a8bff, copas: 0xff5f8a, ouros: 0xffd24c, paus: 0x5ff0b0 }

// Carrossel/circo: espiral de fatias girando, anéis pulsando e naipes
// flutuando. Tudo acelera nas fases finais (estado.velocidade).
export default function jevil(scene, objetos) {
  const add = (o) => {
    objetos.push(o)
    return o.setDepth(-10)
  }
  const [cx, cy] = [LARGURA / 2, 175] // centro do carrossel
  add(scene.add.rectangle(0, 0, LARGURA, ALTURA, 0x0a0418).setOrigin(0))
  // a espiral gira inteira (giro = 0,35 t, sem mudar de forma): é desenhada uma vez numa textura e a
  // Image gira (antes: 16 fillPoints de 25 pontos pelo earcut a cada quadro). Sem textura, o Graphics
  const pintarEspiral = (g, giro, x0 = 0, y0 = 0) => {
    for (let k = 0; k < FATIAS; k++) {
      g.fillStyle(CORES_FATIAS[k % 2], 1)
      const a0 = giro + (k * Math.PI * 2) / FATIAS
      const a1 = a0 + (Math.PI * 2) / FATIAS
      const pontos = [{ x: x0, y: y0 }]
      for (let r = 40; r <= 520; r += 40) pontos.push({ x: x0 + Math.cos(a0 + r / 260) * r, y: y0 + Math.sin(a0 + r / 260) * r })
      for (let r = 520; r >= 40; r -= 40) pontos.push({ x: x0 + Math.cos(a1 + r / 260) * r, y: y0 + Math.sin(a1 + r / 260) * r })
      g.fillPoints(pontos, true)
    }
  }
  const espiralImg = assar(scene, 'fundo-jevil-espiral', 1044, 1044, (g) => pintarEspiral(g, 0), { folga: 0 })
  const espiral = add(espiralImg ? espiralImg.setPosition(cx, cy) : scene.add.graphics())
  const aneis = add(scene.add.graphics())

  const naipes = Array.from({ length: 24 }, (_, i) => {
    const forma = NAIPES[i % 4]
    const img = add(scene.add.image(0, 0, `bala-${forma}`).setTint(CORES_NAIPES[forma]).setAlpha(0.35).setScale(0.9 + (i % 3) * 0.4))
    return { img, x: (i * 131) % LARGURA, y: (i * 71) % ALTURA, vx: ((i % 5) - 2) * 8, vy: -10 - (i % 4) * 6, giro: ((i % 3) - 1) * 1.5 }
  })

  return {
    atualizar(dt, estado) {
      const t = estado.tempo / 1000
      const s = dt / 1000

      // espiral: fatias alternadas torcidas, girando
      const giro = t * 0.35
      if (espiralImg) espiral.setRotation(giro)
      else {
        espiral.clear()
        pintarEspiral(espiral, giro, cx, cy)
      }

      // anéis pulsando a partir do centro
      aneis.clear()
      for (let k = 0; k < 5; k++) {
        const r = ((t * 60 + k * 90) % 450) + 10
        aneis.lineStyle(2, k % 2 ? 0xffd24c : 0xff5f8a, 0.25 * (1 - r / 460))
        aneis.strokeCircle(cx, cy, r)
      }

      for (const n of naipes) {
        n.x += n.vx * s
        n.y += n.vy * s
        if (n.y < -20) n.y = ALTURA + 20
        if (n.x < -20) n.x = LARGURA + 20
        if (n.x > LARGURA + 20) n.x = -20
        n.img.setPosition(n.x + Math.sin(t + n.y / 50) * 10, n.y).setRotation(n.img.rotation + n.giro * s)
      }
    },
  }
}
