import { LARGURA, ALTURA } from '../../constants.js'

// SALA DE INFORMÁTICA (PROVISÓRIO: o fundo de verdade é fileiras de monitores de tubo piscando, código verde subindo, cabos no chão).
// Por enquanto: degradê na cor da arena com partículas subindo devagar.
export default function informatica(scene, objetos) {
  const add = (o) => {
    objetos.push(o)
    return o.setDepth(-10)
  }
  add(scene.add.rectangle(0, 0, LARGURA, ALTURA, 0x0a1a26).setOrigin(0))
  const g = add(scene.add.graphics())
  for (let i = 0; i < 12; i++) {
    g.fillStyle(0x4fc8ff, 0.02 + i * 0.006)
    g.fillRect(0, ALTURA - (i + 1) * 30, LARGURA, 30)
  }
  const pontos = Array.from({ length: 30 }, (_, i) => ({
    obj: add(scene.add.circle(0, 0, 1 + (i % 3), 0x4fc8ff).setAlpha(0.25)),
    x: (i * 97) % LARGURA,
    y: (i * 53) % ALTURA,
    v: 8 + (i % 5) * 4,
  }))
  return {
    atualizar(dt) {
      for (const p of pontos) {
        p.y -= (p.v * dt) / 1000
        if (p.y < -4) p.y = ALTURA + 4
        p.obj.setPosition(p.x, p.y)
      }
    },
  }
}
