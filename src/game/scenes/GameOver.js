import Phaser from 'phaser'
import Controles from '../controles.js'
import { tocar, pararMusica } from '../audio.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'

const ESCALA_CORACAO = 3

// Game over: o coração racha, parte ao meio, vira cacos e o título aparece.
// A: tentar de novo com o mesmo chefe · B: escolher outro chefe
export default class GameOver extends Phaser.Scene {
  constructor() {
    super('GameOver')
  }

  create({ chefe }) {
    this.idChefe = chefe
    this.saindo = false
    pararMusica()
    this.cameras.main.setBackgroundColor(0x000000)
    const cx = LARGURA / 2
    const cy = 190
    const cor = CORES.almas[0]
    const coracao = this.add.image(cx, cy, 'coracao').setTint(cor).setScale(ESCALA_CORACAO)

    this.time.delayedCall(500, () => {
      coracao.setTexture('coracao-rachado')
      tocar(this, 'quebrar')
      this.cameras.main.shake(150, 0.01)
    })

    this.time.delayedCall(1200, () => {
      coracao.destroy()
      tocar(this, 'quebrar')
      for (const [lado, dx] of [['esq', -14], ['dir', 14]]) {
        const metade = this.add.image(cx, cy, `coracao-${lado}`).setTint(cor).setScale(ESCALA_CORACAO)
        this.tweens.add({ targets: metade, x: cx + dx, angle: dx, duration: 250, ease: 'Quad.easeOut' })
        this.time.delayedCall(700, () => this.cacos(metade.x, cy, cor, () => metade.destroy()))
      }
    })

    this.time.delayedCall(2400, () => {
      tocar(this, 'gameover')
      const titulo = this.add
        .text(cx, 300, 'GAME OVER', { fontFamily: FONTE, fontSize: '56px', color: TEXTO.normal })
        .setOrigin(0.5)
        .setAlpha(0)
      this.tweens.add({ targets: titulo, alpha: 1, duration: 1400 })
    })

    this.time.delayedCall(3600, () => {
      this.add.text(cx, 360, 'Fiquem determinados!', { fontFamily: FONTE, fontSize: '18px', color: TEXTO.desabilitado }).setOrigin(0.5)
      const opcoes = this.add
        .text(cx, ALTURA - 50, 'A: tentar de novo     B: escolher chefe', { fontFamily: FONTE, fontSize: '16px', color: TEXTO.normal })
        .setOrigin(0.5)
      this.tweens.add({ targets: opcoes, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 })
      this.controles.onBotao((_, botao) => {
        if (this.saindo) return
        this.saindo = true
        tocar(this, 'confirmar')
        this.scene.start(botao === 'A' ? 'Battle' : 'Selecao', { chefe: this.idChefe })
      })
    })

    this.controles = new Controles(this)
  }

  // Pedacinhos do coração caindo com "gravidade"
  cacos(x, y, cor, aoTerminar) {
    aoTerminar()
    for (let k = 0; k < 5; k++) {
      const caco = this.add.rectangle(x, y, 5, 5, cor)
      const dx = Phaser.Math.Between(-90, 90)
      this.tweens.add({ targets: caco, x: x + dx, duration: 1300, ease: 'Linear' })
      this.tweens.add({
        targets: caco,
        y: y + 320,
        angle: Phaser.Math.Between(-360, 360),
        alpha: 0,
        duration: 1300,
        ease: 'Quad.easeIn',
        onComplete: () => caco.destroy(),
      })
    }
  }

  update() {
    this.controles.atualizar()
  }
}
