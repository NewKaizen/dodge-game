import Phaser from 'phaser'
import { LARGURA, ALTURA, FONTE } from '../constants.js'

export default class Menu extends Phaser.Scene {
  constructor() {
    super('Menu')
  }

  create() {
    this.add
      .text(LARGURA / 2, ALTURA / 2 - 20, 'aguardando joystick...', { fontFamily: FONTE, fontSize: '22px' })
      .setOrigin(0.5)
    this.add
      .text(LARGURA / 2, ALTURA / 2 + 20, 'escolha o número de jogadores e conecte\n(ou use o simulador de teclado)', {
        fontFamily: FONTE,
        fontSize: '14px',
        color: '#888888',
        align: 'center',
      })
      .setOrigin(0.5, 0)

    const iniciar = () => this.scene.start('Modo')
    if (this.registry.get('conectado')) return iniciar()

    const aoMudar = (_, conectado) => conectado && iniciar()
    this.registry.events.on('changedata-conectado', aoMudar)
    this.events.once('shutdown', () => this.registry.events.off('changedata-conectado', aoMudar))
  }
}
