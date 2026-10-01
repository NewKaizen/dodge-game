import Phaser from 'phaser'
import { LARGURA, ALTURA, NIVEIS } from '../constants.js'
import { corNumero } from '../effects/entrada.js'

const CORTE = { segmentos: 9, pontaMax: 22 } // zigue-zague da linha onde a tela "abre"

// Abertura da batalha: sobreposição por cima da Battle. Começa com a tela
// preta partida por uma fenda brilhante na diagonal; as duas metades se
// afastam e revelam a luta. Lançada pela Dificuldade junto com a Battle
// (a Battle não precisa saber de nada), e se desliga sozinha no fim.
export default class Entrada extends Phaser.Scene {
  constructor() {
    super('Entrada')
  }

  init(dados) {
    this.nivel = dados?.nivel ?? 'facil'
  }

  create() {
    const indice = Object.keys(NIVEIS).indexOf(this.nivel)
    const cor = corNumero(NIVEIS[this.nivel].cor)

    // fenda diagonal de canto a canto (com folga fora da tela), em zigue-zague
    const inicio = { x: LARGURA * 0.62, y: -40 }
    const fim = { x: LARGURA * 0.38, y: ALTURA + 40 }
    const fenda = [inicio]
    for (let i = 1; i < CORTE.segmentos; i++) {
      const t = i / CORTE.segmentos
      const lado = (i % 2 ? 1 : -1) * Phaser.Math.Between(6, CORTE.pontaMax)
      fenda.push({ x: Phaser.Math.Linear(inicio.x, fim.x, t) + lado, y: Phaser.Math.Linear(inicio.y, fim.y, t) })
    }
    fenda.push(fim)

    // clarão que escapa pela fenda quando ela abre (fica atrás das metades)
    const clarao = this.add.rectangle(0, 0, LARGURA, ALTURA, 0xffffff, 0).setOrigin(0)

    const longe = 2 * LARGURA
    const metade = (lado) => {
      const g = this.add.graphics()
      g.fillStyle(0x000000, 1)
      const borda = lado < 0 ? [{ x: -longe, y: fim.y }, { x: -longe, y: inicio.y }] : [{ x: longe, y: fim.y }, { x: longe, y: inicio.y }]
      g.fillPoints([...fenda, ...borda], true)
      // brilho na borda da fenda, da cor do nível
      g.lineStyle(6, cor, 1)
      g.strokePoints(fenda, false)
      g.lineStyle(2, 0xffffff, 1)
      g.strokePoints(fenda, false)
      return g
    }
    const esquerda = metade(-1)
    const direita = metade(1)

    // as metades saem perpendiculares à fenda (quase na horizontal)
    const espera = 40
    const duracao = 380 - indice * 40 // DIFÍCIL abre mais seco
    const dist = LARGURA * 0.9
    this.tweens.add({ targets: esquerda, x: -dist, y: -dist * 0.3, delay: espera, duration: duracao, ease: 'Quad.easeIn' })
    this.tweens.add({ targets: direita, x: dist, y: dist * 0.3, delay: espera, duration: duracao, ease: 'Quad.easeIn' })

    this.tweens.add({ targets: clarao, alpha: { from: 0.75, to: 0 }, delay: espera + duracao * 0.5, duration: 260 })
    this.time.delayedCall(espera + duracao + 280, () => this.scene.stop())
  }
}
