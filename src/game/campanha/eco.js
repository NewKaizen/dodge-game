import Phaser from 'phaser'
import { menosMovimento } from '../preferencias.js'

// Um ECO na tela (campanha, docs/campanha.md): o sprite de alguém do elenco, mas não bem a pessoa —
// apagado (frio e meio transparente) e com duas "sombras de luz" que se desencontram devagar, como
// uma imagem que ficou na retina. "Reduzir animações": as sombras ficam paradas.
//
//   const e = criarEco(scene, x, y, 'ralsei', { escala: 3, profundidade: 10, alpha: 0.6, flipX: true })
//   no update: e.atualizar(tempo) · e.destruir() · e.objetos (para pôr num container)
export const TOM_ECO = 0xa8c8d4
export const COR_SOMBRA = 0x3fb3a8

export function criarEco(scene, x, y, textura, { escala = 3, profundidade = 10, alpha = 0.6, flipX = false, origemY = 1 } = {}) {
  const sombras = [0, 1].map(() => scene.add.image(x, y, textura).setOrigin(0.5, origemY).setScale(escala).setFlipX(flipX).setTint(COR_SOMBRA).setAlpha(0.2).setDepth(profundidade).setBlendMode(Phaser.BlendModes.ADD))
  const corpo = scene.add.image(x, y, textura).setOrigin(0.5, origemY).setScale(escala).setFlipX(flipX).setTint(TOM_ECO).setAlpha(alpha).setDepth(profundidade + 0.1)
  // sem cor: o filtro de cor (WebGL); sem ele, fica só o tom frio
  try {
    corpo.enableFilters()
    corpo.filters?.internal?.addColorMatrix()?.colorMatrix.saturate(-0.8)
  } catch {
    // sem filtros
  }
  const fase = Math.random() * 6
  const e = {
    corpo,
    objetos: [...sombras, corpo],
    atualizar(tempo) {
      if (menosMovimento()) {
        sombras[0].setPosition(x - 4, y)
        sombras[1].setPosition(x + 4, y)
        return
      }
      const t = tempo / 1000 + fase
      sombras[0].setPosition(x - 4 - 2 * Math.sin(t * 0.7), y - Math.sin(t * 0.5))
      sombras[1].setPosition(x + 4 + 2 * Math.sin(t * 0.9), y + Math.sin(t * 0.6))
      corpo.setAlpha(alpha * (0.85 + 0.15 * Math.sin(t * 1.1)))
    },
    mover(nx, ny) {
      x = nx
      y = ny
      for (const o of e.objetos) o.setPosition(nx, ny)
    },
    destruir() {
      for (const o of e.objetos) o.destroy()
    },
  }
  e.atualizar(0)
  return e
}
