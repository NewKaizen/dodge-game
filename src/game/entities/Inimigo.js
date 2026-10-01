import Phaser from 'phaser'
import { CORES, FONTE, MERCY_MAX } from '../constants.js'
import { ESCALA } from '../arte/texturas.js'
import { particulas } from '../effects/particulas.js'
import { flashTela } from '../effects/flash.js'
import { shake } from '../effects/shake.js'
import { tocar } from '../audio.js'

const LARGURA_BARRA = 100
const TREMOR_MS = 750 // tempo tremendo antes de estourar (no relógio da cena: a câmera lenta estica)

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
    const pequeno = { fontFamily: FONTE, fontSize: '12px', color: '#ffffff' }
    this.nome = scene.add.text(x, by - 18, def.nome.toUpperCase(), { ...pequeno, fontSize: '15px' }).setOrigin(0.5, 0)
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

  // intensidade 0..1 (escala com o dano do golpe): amplitude e duração do tremor
  dano(intensidade = 0.4) {
    this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
    this.scene.time.delayedCall(110, () => this.sprite.setTintMode(Phaser.TintModes.MULTIPLY).setTint(0xffffff))
    this.tweenTremer?.stop()
    this.sprite.x = this.x
    this.tweenTremer = this.scene.tweens.add({
      targets: this.sprite,
      x: this.x + 5 + 9 * intensidade,
      duration: 35,
      yoyo: true,
      repeat: 4 + Math.round(intensidade * 4),
      onComplete: () => (this.sprite.x = this.x),
    })
  }

  // Poupado sobe e some; derrotado treme cada vez mais e estoura em pedaços
  sumir(poupado) {
    this.idle.stop()
    ;[...this.hp, ...this.mercy, this.nome].forEach((o) => o.setVisible(false))
    if (!poupado) return this.desfazer()
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      y: this.y + (poupado ? -30 : 0),
      scaleX: poupado ? this.sprite.scaleX : this.sprite.scaleX * 1.4,
      duration: poupado ? 900 : 700,
    })
  }

  // Morte: pisca branco/vermelho tremendo com força crescente e, no auge,
  // quebra o sprite numa grade de pedaços que voam e somem
  desfazer() {
    const { scene, sprite } = this
    this.tweenTremer?.stop()
    scene.tweens.killTweensOf(sprite)
    sprite.setPosition(this.x, this.y).setTintMode(Phaser.TintModes.FILL).setTint(0xffffff)
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: TREMOR_MS,
      onUpdate: (tw) => {
        const p = tw.getValue()
        const amplitude = 2 + 10 * p
        sprite.setPosition(this.x + Phaser.Math.FloatBetween(-amplitude, amplitude), this.y + Phaser.Math.FloatBetween(-amplitude, amplitude) * 0.5)
        const branco = Math.floor(p * p * 14) % 2 === 0 // pisca mais rápido perto do fim
        sprite.setTintMode(branco ? Phaser.TintModes.FILL : Phaser.TintModes.MULTIPLY).setTint(branco ? 0xffffff : 0xff5050)
      },
      onComplete: () => this.estourar(),
    })
  }

  estourar() {
    const { scene, sprite } = this
    const quadro = sprite.frame
    const cols = Math.min(9, Math.ceil(quadro.width / 5))
    const linhas = Math.min(9, Math.ceil(quadro.height / 5))
    const pw = Math.ceil(quadro.width / cols)
    const ph = Math.ceil(quadro.height / linhas)
    const escala = sprite.scaleX
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < linhas; j++) {
        const cx = i * pw
        const cy = j * ph
        // origem no centro do pedaço: gira em torno dele mesmo
        const ox = (cx + pw / 2) / quadro.width
        const oy = (cy + ph / 2) / quadro.height
        const px = this.x + (ox - 0.5) * quadro.width * escala
        const py = this.y + (oy - 0.5) * quadro.height * sprite.scaleY
        const pedaco = scene.add
          .image(px, py, sprite.texture.key, quadro.name)
          .setCrop(cx, cy, pw, ph)
          .setOrigin(ox, oy)
          .setScale(escala, sprite.scaleY)
          .setDepth(3)
          .setTintMode(Phaser.TintModes.FILL)
          .setTint(0xffffff)
        scene.cameraCaixa?.ignore(pedaco)
        // voa para longe do centro, com um pouco de gravidade
        const angulo = Math.atan2(py - this.y, px - this.x) + Phaser.Math.FloatBetween(-0.4, 0.4)
        const distancia = Phaser.Math.Between(60, 190)
        const duracao = Phaser.Math.Between(550, 900)
        scene.time.delayedCall(60, () => pedaco.setTintMode(Phaser.TintModes.MULTIPLY).setTint(0xffffff))
        scene.tweens.add({ targets: pedaco, x: px + Math.cos(angulo) * distancia, duration: duracao, ease: 'Quad.easeOut' })
        scene.tweens.add({ targets: pedaco, y: py + Math.sin(angulo) * distancia * 0.8 + 70, duration: duracao, ease: 'Quad.easeIn' })
        scene.tweens.add({
          targets: pedaco,
          angle: Phaser.Math.Between(-240, 240),
          alpha: 0,
          scaleX: escala * 0.4,
          scaleY: sprite.scaleY * 0.4,
          duration: duracao,
          ease: 'Cubic.easeIn',
          onComplete: () => pedaco.destroy(),
        })
      }
    }
    sprite.setVisible(false)
    particulas(scene, this.x, this.y, { cor: 0xffffff, quantidade: 40, velocidade: 320, vida: 700, escala: 1.6 })
    particulas(scene, this.x, this.y, { cor: 0xff5050, quantidade: 24, velocidade: 200, vida: 900, escala: 1.2 })
    flashTela(scene, 0xffffff, 0.6, 260)
    shake(scene, 260, 0.018)
    tocar(scene, 'estouro')
  }

  // Ponto onde fica a ponta do balão de fala
  get boca() {
    return { x: this.x - 52, y: this.y - 34 }
  }
}
