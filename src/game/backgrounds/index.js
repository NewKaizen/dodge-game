import { LARGURA, ALTURA, FUNDO } from '../constants.js'
import king from './king.js'
import queen from './queen.js'
import jevil from './jevil.js'
import coronel from './coronel.js'
import { FUNDOS_ARENAS } from './arenas/index.js'
import { fatores } from '../acessibilidade.js'

// Fundos animados, um módulo por chefe. Cada módulo é uma função
// (scene, objetos) -> { atualizar(dt, estado) } que desenha na profundidade
// -10 e guarda o que criar em `objetos` (destruídos no fim).
//   estado.tempo      ms desde o início
//   estado.fase       fase atual do chefe (0, 1, 2...)
//   estado.velocidade multiplicador de animação (sobe nas fases finais)
//   estado.agito      multiplicador extra, do nível da luta (NIVEIS.fundo)
const FUNDOS = { king, queen, jevil, coronel, ...FUNDOS_ARENAS } // arenas do PvP: 'arena-<id>'

// Envolve o fundo: escurecer() põe um véu escuro por cima (telas de menu) e
// `agito` acelera tudo (nível da luta).
// Preferências (acessibilidade.js), valem na hora: no gráfico MÍNIMO o fundo
// fica parado (anda ~0,6 s de uma vez no primeiro quadro, para sair do
// estado inicial, e congela); com "reduzir animações" anda na metade do
// tempo (piscadas e brilhos mais lentos).
const AQUECER = { passos: 36, ms: 16 }
export function criarFundo(scene, id, agito = 1) {
  const objetos = []
  const camada = (FUNDOS[id] ?? king)(scene, objetos)
  const estado = { tempo: 0, fase: 0, velocidade: 1, agito }

  const sombra = scene.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000).setOrigin(0).setDepth(-5).setAlpha(0)
  objetos.push(sombra)

  return {
    estado,
    atualizar(dt) {
      const f = fatores()
      if (f.fundo === 'parado') {
        if (estado.parado) return
        estado.parado = true
        for (let i = 0; i < AQUECER.passos; i++) {
          estado.tempo += AQUECER.ms
          camada.atualizar(AQUECER.ms, estado)
        }
        return
      }
      estado.parado = false
      const passo = dt * estado.velocidade * estado.agito * f.velocidadeFundo
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
