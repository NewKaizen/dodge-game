import Phaser from 'phaser'
import { LARGURA, ALTURA } from '../constants.js'
import { menosMovimento } from '../preferencias.js'
import { fatores } from '../acessibilidade.js'
import { gerarCenario, moverParticula } from './cenario.js'

// Desenha um cenário da campanha (campanha/cenario.js) numa cena: as formas paradas em dois
// Graphics (o normal e o de luz, somado), a poeira/chuva num terceiro, redesenhado a cada quadro.
// Acessibilidade: "reduzir animações" ou gráficos no mínimo deixam tudo parado (sem a poeira
// andar e sem os feixes respirarem); a quantidade de partículas segue fatores().particulas.
//
//   const c = desenharCenario(scene, 'sala', { profundidade: -10, brilho: 1 })
//   no update: c.atualizar(delta) · c.destruir()
export function desenharCenario(scene, tema, { profundidade = -10, brilho = 1, semente } = {}) {
  const dados = gerarCenario(tema, { largura: LARGURA, altura: ALTURA, semente })
  const fundo = scene.add.rectangle(0, 0, LARGURA, ALTURA, dados.fundo).setOrigin(0).setDepth(profundidade)
  const g = scene.add.graphics().setDepth(profundidade + 0.1)
  const luz = scene.add.graphics().setDepth(profundidade + 0.2).setBlendMode(Phaser.BlendModes.ADD)
  const poeira = scene.add.graphics().setDepth(profundidade + 0.3)
  for (const f of dados.formas) {
    const alvo = f.luz ? luz : g
    const a = f.alpha * (f.luz ? brilho : 1)
    if (f.tipo === 'poligono') {
      const pts = []
      for (let k = 0; k < f.pontos.length; k += 2) pts.push({ x: f.pontos[k], y: f.pontos[k + 1] })
      alvo.fillStyle(f.cor, a).fillPoints(pts, true)
    } else if (f.tipo === 'linha') alvo.lineStyle(f.largura, f.cor, a).lineBetween(f.x1, f.y1, f.x2, f.y2)
  }
  const fx = fatores()
  const parado = () => menosMovimento() || fatores().fundo === 'parado'
  const ps = dados.particulas.filter((_, i) => i % Math.max(1, Math.round(1 / Math.max(0.15, fx.particulas))) === 0)
  let tempo = 0
  const pintar = () => {
    poeira.clear()
    for (const p of ps) {
      const a = p.alpha * (parado() ? 1 : 0.7 + 0.3 * Math.sin(tempo / 900 + p.fase))
      if (p.alto) poeira.fillStyle(p.cor, a).fillRect(p.x, p.y, 1, p.alto)
      else poeira.fillStyle(p.cor, a).fillRect(Math.round(p.x), Math.round(p.y), p.tam, p.tam)
    }
  }
  pintar()
  return {
    dados,
    atualizar(delta) {
      if (parado()) return
      tempo += delta
      for (const p of ps) moverParticula(p, delta, LARGURA, ALTURA)
      luz.setAlpha(0.85 + 0.15 * Math.sin(tempo / 2400))
      pintar()
    },
    destruir() {
      for (const o of [fundo, g, luz, poeira]) o.destroy()
    },
  }
}
