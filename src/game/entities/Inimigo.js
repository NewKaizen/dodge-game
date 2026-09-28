import Phaser from 'phaser'
import { CORES, FONTE, MERCY_MAX } from '../constants.js'
import { ESCALA } from '../arte/texturas.js'

const LARGURA_BARRA = 100

// Chefe na cena: sprite com animação parada (idle), piscar/tremer ao levar
// dano e barras de HP (aparece depois do Check ou do primeiro dano) e MERCY
// (aparece quando sobe)
export default class Inimigo {
  constructor(scene, x, y, def) {
    this.scene = scene
    this.x = x
    this.y = y
    this.sprite = scene.add.image(x, y, def.sprite).setScale(ESCALA.chefe).setDepth(2)
    this.idle = scene.tweens.add({ targets: this.sprite, y: y - 6, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    scene.tweens.add({ targets: this.sprite, scaleX: ESCALA.chefe * 1.03, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    const bx = x - LARGURA_BARRA / 2
    const by = y - 94
    const pequeno = { fontFamily: FONTE, fontSize: '11px', color: '#ffffff' }
    this.nome = scene.add.text(x, by - 18, def.nome.toUpperCase(), { ...pequeno, fontSize: '13px' }).setOrigin(0.5, 0)
    this.hp = [
      scene.add.rectangle(bx, by, LARGURA_BARRA, 6, 0x303030).setOrigin(0),
      scene.add.rectangle(bx, by, LARGURA_BARRA, 6, CORES.hpChefe).setOrigin(0),
      scene.add.text(bx - 4, by + 3, 'HP', pequeno).setOrigin(1, 0.5),
    ]
    this.mercy = [
      scene.add.rectangle(bx, by + 11, LARGURA_BARRA, 6, 0x3a2a00).setOrigin(0),
      scene.add.rectangle(bx, by + 11, LARGURA_BARRA, 6, CORES.mercy).setOrigin(0),
      scene.add.text(bx + LARGURA_BARRA + 4, by + 14, '', pequeno).setOrigin(0, 0.5),
    ]
    this.rotuloMercy = def.rotuloMercy ?? 'MERCY'
    this.hp.forEach((o) => o.setVisible(false))
    this.mercy.forEach((o) => o.setVisible(false))
  }

  atualizar(chefe) {
    this.hp[1].setScale(Math.max(0, chefe.hp) / chefe.max, 1)
    this.hp.forEach((o) => o.setVisible(chefe.revelado && chefe.ativo))
    this.mercy[1].setScale(chefe.mercy / MERCY_MAX, 1)
    this.mercy[2].setText(`${this.rotuloMercy} ${Math.floor(chefe.mercy)}%`)
    this.mercy.forEach((o) => o.setVisible(chefe.mercy > 0 && chefe.ativo))
  }

  dano() {
    this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
    this.scene.time.delayedCall(110, () => this.sprite.setTintMode(Phaser.TintModes.MULTIPLY).setTint(0xffffff))
    this.tweenTremer?.stop()
    this.sprite.x = this.x
    this.tweenTremer = this.scene.tweens.add({
      targets: this.sprite,
      x: this.x + 8,
      duration: 35,
      yoyo: true,
      repeat: 4,
      onComplete: () => (this.sprite.x = this.x),
    })
  }

  // Poupado sobe e some; derrotado pisca em vermelho e desfaz
  sumir(poupado) {
    this.idle.stop()
    ;[...this.hp, ...this.mercy, this.nome].forEach((o) => o.setVisible(false))
    if (!poupado) this.sprite.setTint(0xff6060)
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      y: this.y + (poupado ? -30 : 0),
      scaleX: poupado ? this.sprite.scaleX : this.sprite.scaleX * 1.4,
      duration: poupado ? 900 : 700,
    })
  }

  // Ponto onde fica a ponta do balão de fala
  get boca() {
    return { x: this.x - 52, y: this.y - 34 }
  }
}
