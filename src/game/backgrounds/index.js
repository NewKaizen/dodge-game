import { LARGURA, ALTURA, FUNDO } from '../constants.js'
import king from './king.js'
import queen from './queen.js'
import jevil from './jevil.js'
import coronel from './coronel.js'

// Fundos animados, um módulo por chefe. Cada módulo é uma função
// (scene, objetos) -> { atualizar(dt, estado) } que desenha na profundidade
// -10 e guarda o que criar em `objetos` (destruídos no fim).
//   estado.tempo      ms desde o início
//   estado.fase       fase atual do chefe (0, 1, 2...)
//   estado.velocidade multiplicador de animação (sobe nas fases finais)
//   estado.agito      multiplicador extra, do nível da luta (NIVEIS.fundo)
const FUNDOS = { king, queen, jevil, coronel }

// Envolve o fundo: escurecer() põe um véu escuro por cima (telas de menu) e
// `agito` acelera tudo (nível da luta).
export function criarFundo(scene, id, agito = 1) {
  const objetos = []
  const camada = (FUNDOS[id] ?? king)(scene, objetos)
  const estado = { tempo: 0, fase: 0, velocidade: 1, agito }

  const sombra = scene.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000).setOrigin(0).setDepth(-5).setAlpha(0)
  objetos.push(sombra)

  return {
    estado,
    atualizar(dt) {
      const passo = dt * estado.velocidade * estado.agito
      estado.tempo += passo
      camada.atualizar(passo, estado)
    },
    escurecer() {
      scene.tweens.add({ targets: sombra, alpha: FUNDO.escurecer, duration: 300 })
    },
    setFase(fase, velocidade = 1) {
      estado.fase = fase
      estado.velocidade = velocidade
    },
    destruir() {
      objetos.forEach((o) => {
        scene.tweens.killTweensOf(o)
        o.destroy()
      })
    },
  }
}
