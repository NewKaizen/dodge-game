import Phaser from 'phaser'
import { CORACAO } from '../constants.js'
import { ESCALA } from '../arte/texturas.js'
import { flash } from '../effects/flash.js'

// O coração (SOUL) de um jogador; a posição vem do JOY (-100..100 em cada eixo)
export default class Heart {
  constructor(scene, caixa, cor, jogador) {
    this.scene = scene
    this.caixa = caixa
    this.cor = cor
    this.jogador = jogador
    this.hitbox = CORACAO.hitbox
    this.graze = CORACAO.graze
    this.x = 0
    this.y = 0
    this.ativo = false
    this.invencivelMs = 0

    this.anel = scene.add.circle(0, 0, this.graze).setStrokeStyle(1, 0xffffff).setDepth(9)
    this.sprite = scene.add.image(0, 0, 'coracao').setTint(cor).setScale(ESCALA.coracao).setDepth(10)
    caixa.recortar(this.anel, this.sprite)
    this.esconder()
  }

  get invencivel() {
    return this.invencivelMs > 0
  }

  mostrar(x, y) {
    this.x = x
    this.y = y
    this.ativo = true
    this.invencivelMs = 0
    this.sprite.setVisible(true).setAlpha(1)
    this.anel.setVisible(true).setAlpha(0)
    this.posicionar()
  }

  esconder() {
    this.ativo = false
    this.scene.tweens.killTweensOf(this.sprite)
    this.sprite.setVisible(false)
    this.anel.setVisible(false)
  }

  tick(dt) {
    if (this.invencivelMs > 0) this.invencivelMs -= dt
  }

  // velocidade em px/s, delta em ms
  update(joy, velocidade, delta) {
    if (!joy) return
    // Limita o vetor a comprimento 1 para a diagonal não ser mais rápida
    const dir = new Phaser.Math.Vector2(joy.x / 100, joy.y / 100)
    if (dir.length() > 1) dir.normalize()

    const passo = velocidade * (delta / 1000)
    const r = this.caixa.limites
    const meio = CORACAO.tamanho / 2
    this.x = Phaser.Math.Clamp(this.x + dir.x * passo, r.left + meio, r.right - meio)
    this.y = Phaser.Math.Clamp(this.y + dir.y * passo, r.top + meio, r.bottom - meio)
    this.posicionar()
  }

  // Depois que a caixa muda de tamanho: traz o coração para dentro dela
  ajustar() {
    const r = this.caixa.limites
    const meio = CORACAO.tamanho / 2
    this.x = Phaser.Math.Clamp(this.x, r.left + meio, r.right - meio)
    this.y = Phaser.Math.Clamp(this.y, r.top + meio, r.bottom - meio)
    this.posicionar()
  }

  posicionar() {
    this.sprite.setPosition(this.x, this.y)
    this.anel.setPosition(this.x, this.y)
  }

  piscarGraze() {
    this.scene.tweens.killTweensOf(this.anel)
    this.anel.setAlpha(0.9)
    this.scene.tweens.add({ targets: this.anel, alpha: 0, duration: 250 })
  }

  destruir() {
    this.scene.tweens.killTweensOf([this.sprite, this.anel])
    this.sprite.destroy()
    this.anel.destroy()
  }

  tomarDano(duracaoMs) {
    this.invencivelMs = duracaoMs
    flash(this.scene, this.sprite, duracaoMs)
    // "pop": o coração incha e volta, junto do flash e do tremor
    this.sprite.setScale(ESCALA.coracao * 1.9)
    this.scene.tweens.add({ targets: this.sprite, scale: ESCALA.coracao, duration: 180, ease: 'Back.easeOut' })
  }
}
