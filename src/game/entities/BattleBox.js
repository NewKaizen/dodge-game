import Phaser from 'phaser'
import { LAYOUT, CAIXA, CORES } from '../constants.js'

// A caixa branca onde os corações desviam (expande no turno inimigo e
// encolhe no fim)
export default class BattleBox {
  constructor(scene) {
    this.scene = scene
    const { x, y } = LAYOUT.caixa
    this.limites = new Phaser.Geom.Rectangle(x - CAIXA.largura / 2, y - CAIXA.altura / 2, CAIXA.largura, CAIXA.altura)
    this.retangulo = scene.add
      .rectangle(x, y, CAIXA.largura, CAIXA.altura, CORES.fundo)
      .setStrokeStyle(CAIXA.borda, CORES.caixa)
      .setDepth(1)
      .setVisible(false)

    // Câmera com viewport do tamanho da caixa: o que for passado para
    // recortar() só é desenhado por ela, então some fora da caixa. Ela só
    // fica visível com a caixa aberta.
    const l = this.limites
    this.camera = scene.cameras.add(l.x, l.y, l.width, l.height).setScroll(l.x, l.y).setVisible(false)
    scene.cameraCaixa = this.camera
  }

  recortar(...objetos) {
    this.scene.cameras.main.ignore(objetos)
  }

  mostrar(aoAbrir) {
    this.scene.tweens.killTweensOf(this.retangulo)
    this.retangulo.setVisible(true).setScale(0.05, 0.05)
    this.scene.tweens.add({
      targets: this.retangulo,
      scaleX: 1,
      scaleY: 1,
      duration: CAIXA.tweenMs,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.camera.setVisible(true)
        aoAbrir?.()
      },
    })
  }

  esconder(aoFechar) {
    this.camera.setVisible(false)
    this.scene.tweens.killTweensOf(this.retangulo)
    this.scene.tweens.add({
      targets: this.retangulo,
      scaleX: 0.05,
      scaleY: 0.05,
      duration: CAIXA.tweenMs,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.retangulo.setVisible(false)
        aoFechar?.()
      },
    })
  }
}
