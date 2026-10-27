import Phaser from 'phaser'
import { CORACAO, FONTE } from '../constants.js'
import { ESCALA } from '../arte/texturas.js'
import { flash } from '../effects/flash.js'
import { desenharForma } from '../coop/marcadores.js'

// O coração (SOUL) de um jogador; a posição vem do JOY (-100..100 em cada eixo)
//
// `marcador` (CO-OP de 3 e 4, coop/marcadores.js: { forma, cor, rotulo }): vários corações no mesmo
// quadro precisam ser reconhecidos sem depender da cor: uma FORMA pequena (círculo, quadrado,
// triângulo, losango) e o NOME do jogador flutuam em cima do coração (embaixo, se ele está
// encostado no topo da caixa). `setMirado(true)`: o chefe mirou neste coração nesta rodada (mira
// girando em volta dele); nada disso aparece num coração sem marcador.
export default class Heart {
  constructor(scene, caixa, cor, jogador, marcador = null) {
    this.scene = scene
    this.caixa = caixa
    this.cor = cor
    this.jogador = jogador
    this.hitbox = CORACAO.hitbox // raio do miolo que leva dano (bem menor que o sprite)
    this.graze = CORACAO.graze
    this.tamanho = 1 // setTamanho(): coração gigante/mini (sprite, hitbox e graze juntos)
    this.x = 0
    this.y = 0
    this.ativo = false
    this.invencivelMs = 0

    this.anel = scene.add.circle(0, 0, this.graze).setStrokeStyle(1, 0xffffff).setDepth(9)
    this.sprite = scene.add.image(0, 0, 'coracao').setTint(cor).setScale(ESCALA.coracao).setDepth(10)
    caixa.recortar(this.anel, this.sprite)
    this.marcador = marcador
    this.mirado = false
    this.fase = 0 // a mira gira
    if (marcador) {
      this.forma = scene.add.graphics().setDepth(11)
      desenharForma(this.forma, marcador.forma, 0, 0, 4.5, marcador.cor ?? cor)
      this.tag = scene.add
        .text(0, 0, marcador.rotulo ?? '', { fontFamily: FONTE, fontSize: '8px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 })
        .setOrigin(0.5)
        .setDepth(11)
      this.reticula = scene.add.graphics().setDepth(12)
      this.desenharReticula()
      caixa.recortar(this.forma, this.tag, this.reticula)
    }
    this.esconder()
  }

  // a mira do chefe: um anel tracejado com 4 pontas (branco e vermelho, para aparecer em qualquer fundo)
  desenharReticula() {
    const g = this.reticula
    const r = 15
    g.clear()
    g.lineStyle(3, 0x000000, 1)
    g.strokeCircle(0, 0, r)
    g.lineStyle(1.5, 0xffffff, 1)
    g.strokeCircle(0, 0, r)
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2
      const x0 = Math.cos(a) * (r - 4)
      const y0 = Math.sin(a) * (r - 4)
      const x1 = Math.cos(a) * (r + 5)
      const y1 = Math.sin(a) * (r + 5)
      g.lineStyle(4, 0x000000, 1)
      g.lineBetween(x0, y0, x1, y1)
      g.lineStyle(2, 0xff3048, 1)
      g.lineBetween(x0, y0, x1, y1)
    }
  }

  setMirado(sim) {
    this.mirado = Boolean(sim)
    this.reticula?.setVisible(this.mirado && this.ativo)
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
    this.forma?.setVisible(true)
    this.tag?.setVisible(true)
    this.reticula?.setVisible(this.mirado)
    this.posicionar()
  }

  esconder() {
    this.ativo = false
    this.scene.tweens.killTweensOf(this.sprite)
    this.sprite.setVisible(false)
    this.anel.setVisible(false)
    this.forma?.setVisible(false)
    this.tag?.setVisible(false)
    this.reticula?.setVisible(false)
  }

  // Fator de tamanho (1 = normal): sprite, hitbox, graze e a margem da caixa
  setTamanho(fator = 1) {
    this.tamanho = fator
    this.hitbox = CORACAO.hitbox * fator
    this.graze = CORACAO.graze * fator
    this.anel.setRadius(this.graze)
    // o "pop" do dano voltaria ao tamanho antigo: mata os tweens do sprite e
    // refaz o pisca dos i-frames que ainda faltam
    this.scene.tweens.killTweensOf(this.sprite)
    this.sprite.setScale(ESCALA.coracao * fator).setAlpha(1)
    if (this.ativo && this.invencivelMs > 0) flash(this.scene, this.sprite, this.invencivelMs)
    this.ajustar()
  }

  tick(dt) {
    if (this.invencivelMs > 0) this.invencivelMs -= dt
    if (this.reticula?.visible) {
      this.fase += dt / 1000
      this.reticula.setRotation(this.fase * 1.6).setScale(1 + Math.sin(this.fase * 6) * 0.08)
    }
  }

  // velocidade em px/s, delta em ms
  update(joy, velocidade, delta) {
    if (!joy) return
    // Limita o vetor a comprimento 1 para a diagonal não ser mais rápida
    const dir = new Phaser.Math.Vector2(joy.x / 100, joy.y / 100)
    if (dir.length() > 1) dir.normalize()

    const passo = velocidade * (delta / 1000)
    const r = this.caixa.limites
    const meio = (CORACAO.tamanho * this.tamanho) / 2
    this.x = Phaser.Math.Clamp(this.x + dir.x * passo, r.left + meio, r.right - meio)
    this.y = Phaser.Math.Clamp(this.y + dir.y * passo, r.top + meio, r.bottom - meio)
    this.posicionar()
  }

  // Depois que a caixa muda de tamanho: traz o coração para dentro dela
  ajustar() {
    const r = this.caixa.limites
    const meio = (CORACAO.tamanho * this.tamanho) / 2
    this.x = Phaser.Math.Clamp(this.x, r.left + meio, r.right - meio)
    this.y = Phaser.Math.Clamp(this.y, r.top + meio, r.bottom - meio)
    this.posicionar()
  }

  posicionar() {
    this.sprite.setPosition(this.x, this.y)
    this.anel.setPosition(this.x, this.y)
    if (!this.marcador) return
    // a forma e o nome em cima do coração; encostado no topo da caixa, embaixo dele
    const r = this.caixa.limites
    const embaixo = this.y - 24 < r.top + 2
    const lado = embaixo ? 1 : -1
    const tx = Phaser.Math.Clamp(this.x, r.left + this.tag.width / 2 + 2, r.right - this.tag.width / 2 - 2)
    this.forma.setPosition(this.x, this.y + lado * 13)
    this.tag.setPosition(tx, this.y + lado * 23)
    this.reticula.setPosition(this.x, this.y)
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
    this.forma?.destroy()
    this.tag?.destroy()
    this.reticula?.destroy()
  }

  tomarDano(duracaoMs) {
    this.invencivelMs = duracaoMs
    flash(this.scene, this.sprite, duracaoMs)
    // "pop": o coração incha e volta, junto do flash e do tremor
    this.sprite.setScale(ESCALA.coracao * this.tamanho * 1.9)
    this.scene.tweens.add({ targets: this.sprite, scale: ESCALA.coracao * this.tamanho, duration: 180, ease: 'Back.easeOut' })
  }
}
