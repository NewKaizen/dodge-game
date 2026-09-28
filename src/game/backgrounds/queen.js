import { LARGURA, ALTURA } from '../constants.js'

const HORIZONTE = 200
const FUGA = { x: LARGURA / 2, y: HORIZONTE }

// Cidade cibernética neon: skyline em duas camadas (parallax), grade em
// perspectiva no chão e linhas de dados descendo
export default function queen(scene, objetos) {
  const add = (o) => {
    objetos.push(o)
    return o.setDepth(-10)
  }
  add(scene.add.rectangle(0, 0, LARGURA, ALTURA, 0x05061a).setOrigin(0))
  add(scene.add.rectangle(0, HORIZONTE - 60, LARGURA, 60, 0x2a0a40).setOrigin(0).setAlpha(0.5))
  const longe = add(scene.add.tileSprite(0, HORIZONTE - 160, LARGURA, 160, 'fundo-queen-cidade').setOrigin(0).setAlpha(0.8))
  const perto = add(scene.add.tileSprite(0, HORIZONTE - 150, LARGURA, 160, 'fundo-queen-cidade-perto').setOrigin(0))
  const grade = add(scene.add.graphics())
  const dados = add(scene.add.graphics())

  const linhas = Array.from({ length: 28 }, (_, i) => ({
    x: (i * 23 + 7) % LARGURA,
    y: (i * 61) % ALTURA,
    v: 60 + (i % 7) * 25,
    tam: 14 + (i % 4) * 12,
    cor: i % 2 ? 0x40f0ff : 0xff4fc8,
  }))

  return {
    atualizar(dt, estado) {
      const t = estado.tempo / 1000
      longe.tilePositionX = t * 6
      perto.tilePositionX = t * 16

      // grade em perspectiva: linhas saindo do ponto de fuga + horizontais vindo
      grade.clear()
      grade.lineStyle(1, 0xff4fc8, 0.45)
      for (let k = -10; k <= 10; k++) grade.lineBetween(FUGA.x, FUGA.y, FUGA.x + k * 90, ALTURA)
      grade.lineStyle(1, 0x40f0ff, 0.5)
      const avanco = (t * 0.6) % 1
      for (let k = 0; k < 10; k++) {
        const p = (k + avanco) / 10
        const y = HORIZONTE + (ALTURA - HORIZONTE) * p * p
        grade.lineBetween(0, y, LARGURA, y)
      }

      // linhas de dados caindo (mais rápidas nas fases finais)
      const vel = 1 + estado.fase * 0.5
      dados.clear()
      for (const l of linhas) {
        l.y += (l.v * vel * dt) / 1000
        if (l.y > ALTURA + l.tam) l.y = -l.tam
        dados.fillStyle(l.cor, 0.35)
        dados.fillRect(l.x, l.y, 2, l.tam)
        dados.fillStyle(0xffffff, 0.6)
        dados.fillRect(l.x, l.y + l.tam - 2, 2, 2)
      }
    },
  }
}
