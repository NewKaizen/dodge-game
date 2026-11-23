import { LARGURA, ALTURA } from '../constants.js'
import { assarRegiao } from '../arte/assar.js'

const HORIZONTE = 200
const FUGA = { x: LARGURA / 2, y: HORIZONTE }

// Cidade cibernética neon: skyline em duas camadas (parallax), grade em
// perspectiva no chão e linhas de dados descendo.
// Desempenho (docs/desempenho.md, fase 1): as linhas que saem do ponto de fuga são paradas (textura
// assada); as horizontais que vêm vindo e as linhas de dados são Images (sem Graphics por quadro).
export default function queen(scene, objetos) {
  const add = (o) => {
    objetos.push(o)
    return o.setDepth(-10)
  }
  add(scene.add.rectangle(0, 0, LARGURA, ALTURA, 0x05061a).setOrigin(0))
  add(scene.add.rectangle(0, HORIZONTE - 60, LARGURA, 60, 0x2a0a40).setOrigin(0).setAlpha(0.5))
  const longe = add(scene.add.tileSprite(0, HORIZONTE - 160, LARGURA, 160, 'fundo-queen-cidade').setOrigin(0).setAlpha(0.8))
  const perto = add(scene.add.tileSprite(0, HORIZONTE - 150, LARGURA, 160, 'fundo-queen-cidade-perto').setOrigin(0))
  const pintarRaios = (g) => {
    g.lineStyle(1, 0xff4fc8, 0.45)
    for (let k = -10; k <= 10; k++) g.lineBetween(FUGA.x, FUGA.y, FUGA.x + k * 90, ALTURA)
  }
  const raios = assarRegiao(scene, 'fundo-queen-raios', { x: 0, y: HORIZONTE - 2, largura: LARGURA, altura: ALTURA - HORIZONTE + 2 }, pintarRaios)
  if (raios) add(raios)
  else pintarRaios(add(scene.add.graphics()))
  // as horizontais (1 px, ciano 0,5) e, de cada linha de dados, o rastro e a ponta branca
  const horizontais = Array.from({ length: 10 }, () => add(scene.add.image(0, 0, '__WHITE').setOrigin(0, 0.5).setDisplaySize(LARGURA, 1).setTint(0x40f0ff).setAlpha(0.5)))

  const linhas = Array.from({ length: 38 }, (_, i) => ({
    x: (i * 23 + 7) % LARGURA,
    y: (i * 61) % ALTURA,
    v: 60 + (i % 7) * 25,
    tam: 14 + (i % 4) * 12,
    cor: i % 2 ? 0x40f0ff : 0xff4fc8,
  }))
  for (const l of linhas) {
    l.rastro = add(scene.add.image(l.x, l.y, '__WHITE').setOrigin(0).setDisplaySize(2, l.tam).setTint(l.cor).setAlpha(0.35))
    l.ponta = add(scene.add.image(l.x, l.y, '__WHITE').setOrigin(0).setDisplaySize(2, 2).setAlpha(0.6))
  }

  return {
    atualizar(dt, estado) {
      const t = estado.tempo / 1000
      longe.tilePositionX = t * 6
      perto.tilePositionX = t * 16

      // grade em perspectiva: linhas saindo do ponto de fuga + horizontais vindo
      const avanco = (t * 0.6) % 1
      for (let k = 0; k < 10; k++) {
        const p = (k + avanco) / 10
        horizontais[k].setY(HORIZONTE + (ALTURA - HORIZONTE) * p * p)
      }

      // linhas de dados caindo (mais rápidas nas fases finais)
      const vel = 1 + estado.fase * 0.5
      for (const l of linhas) {
        l.y += (l.v * vel * dt) / 1000
        if (l.y > ALTURA + l.tam) l.y = -l.tam
        l.rastro.setY(l.y)
        l.ponta.setY(l.y + l.tam - 2)
      }
    },
  }
}
