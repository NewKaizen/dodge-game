import Phaser from 'phaser'
import { ESCALA } from '../arte/texturas.js'

// Personagem da party na cena (sprite de pixel art com respiração,
// tremor ao levar dano e pose de caído)
export default class Ator {
  constructor(scene, x, y, textura) {
    this.scene = scene
    this.x = x
    this.y = y
    this.caido = false
    // personagem sem sprite ainda: coração no lugar
    this.sprite = scene.add.image(x, y, scene.textures.exists(textura) ? textura : 'coracao').setScale(ESCALA.personagem).setDepth(2)
    scene.tweens.add({
      targets: this.sprite,
      scaleY: ESCALA.personagem * 1.03,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  // Entrada da batalha: desliza da esquerda
  entrar(atraso = 0) {
    this.sprite.x = this.x - 180
    this.scene.tweens.add({ targets: this.sprite, x: this.x, delay: atraso, duration: 450, ease: 'Back.easeOut' })
  }

  tremer() {
    this.tweenTremer?.stop()
    this.sprite.x = this.x
    this.tweenTremer = this.scene.tweens.add({
      targets: this.sprite,
      x: this.x + 5,
      duration: 40,
      yoyo: true,
      repeat: 3,
      onComplete: () => (this.sprite.x = this.x),
    })
    this.piscarBranco()
  }

  piscarBranco() {
    this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
    this.scene.time.delayedCall(90, () => this.restaurarCor())
  }

  restaurarCor() {
    this.sprite.setTintMode(Phaser.TintModes.MULTIPLY).setTint(this.caido ? 0x707070 : 0xffffff)
  }

  pular() {
    this.scene.tweens.add({ targets: this.sprite, y: this.y - 10, duration: 110, yoyo: true, ease: 'Quad.easeOut' })
  }

  setCaido(caido) {
    this.caido = caido
    this.restaurarCor()
    this.scene.tweens.add({ targets: this.sprite, rotation: caido ? -Math.PI / 2 : 0, duration: 200 })
  }
}
