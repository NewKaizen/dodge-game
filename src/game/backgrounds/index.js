import Phaser from 'phaser'
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

// Envolve o fundo com as reações à batalha: escurece no turno inimigo e
// pulsa quando o TP está cheio. `agito` acelera tudo (nível da luta).
export function criarFundo(scene, id, agito = 1) {
  const objetos = []
  const camada = (FUNDOS[id] ?? king)(scene, objetos)
  const estado = { tempo: 0, fase: 0, velocidade: 1, agito }

  const sombra = scene.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000).setOrigin(0).setDepth(-5).setAlpha(0)
  const pulso = scene.add
    .rectangle(0, 0, LARGURA, ALTURA, 0xffffff)
    .setOrigin(0)
    .setDepth(-5)
    .setAlpha(0)
    .setBlendMode(Phaser.BlendModes.ADD)
  objetos.push(sombra, pulso)
  let pulsando = false

  return {
    estado,
    atualizar(dt) {
      const passo = dt * estado.velocidade * estado.agito
      estado.tempo += passo
      camada.atualizar(passo, estado)
      pulso.setAlpha(pulsando ? 0.05 + 0.05 * Math.sin(estado.tempo / 160) : 0)
    },
    escurecer(ativo) {
      scene.tweens.add({ targets: sombra, alpha: ativo ? FUNDO.escurecer : 0, duration: 300 })
    },
    pulsar(ativo) {
      pulsando = ativo
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
