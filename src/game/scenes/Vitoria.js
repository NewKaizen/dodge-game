import Phaser from 'phaser'
import Controles from '../controles.js'
import { CHEFES } from '../data/chefes/index.js'
import { criarFundo } from '../backgrounds/index.js'
import { ESCALA } from '../arte/texturas.js'
import { tocar, musica } from '../audio.js'
import { DIFICULDADES, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'

// Tela de vitória: título quicando, faíscas subindo e resumo da luta.
// A: lutar de novo com o mesmo chefe · B: escolher outro chefe
export default class Vitoria extends Phaser.Scene {
  constructor() {
    super('Vitoria')
  }

  create({ chefe, modo, turnos = 0 }) {
    this.idChefe = chefe
    const def = CHEFES[chefe]
    this.fundo = criarFundo(this, def.fundo)
    this.fundo.escurecer(true)
    this.cameras.main.fadeIn(400)
    tocar(this, 'vitoria')
    musica(this, 'vitoria')

    const estilo = (tamanho, cor = TEXTO.normal) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 4 })

    this.add.particles(0, ALTURA + 10, 'faisca', {
      x: { min: 0, max: LARGURA },
      speedY: { min: -140, max: -60 },
      speedX: { min: -20, max: 20 },
      lifespan: 2600,
      scale: { start: 1.4, end: 0 },
      tint: [0xffe040, 0xffffff, 0x3cff6a],
      frequency: 50,
      blendMode: 'ADD',
    })

    const sprite = this.add.image(LARGURA / 2, 250, def.sprite).setScale(ESCALA.chefe)
    if (modo === 'spare') {
      this.tweens.add({ targets: sprite, y: 240, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    } else {
      sprite.setTint(0x606060).setAlpha(0.5).setAngle(-8)
    }

    const titulo = this.add.text(LARGURA / 2, -60, 'VITÓRIA!', estilo(52, TEXTO.selecionado)).setOrigin(0.5)
    this.tweens.add({ targets: titulo, y: 90, duration: 900, ease: 'Bounce.easeOut' })

    const linhas = [
      modo === 'spare' ? `Vocês pouparam ${def.nome}.` : `Vocês derrotaram ${def.nome}.`,
      `Dificuldade: ${DIFICULDADES[def.dificuldade].rotulo}   Turnos: ${turnos}`,
    ]
    linhas.forEach((linha, i) => {
      const t = this.add.text(LARGURA / 2, 350 + i * 28, linha, estilo(18)).setOrigin(0.5).setAlpha(0)
      this.tweens.add({ targets: t, alpha: 1, delay: 700 + i * 350, duration: 400 })
    })

    const opcoes = this.add.text(LARGURA / 2, ALTURA - 40, 'A: lutar de novo     B: escolher chefe', estilo(16)).setOrigin(0.5).setAlpha(0)
    this.tweens.add({ targets: opcoes, alpha: 1, delay: 1500, duration: 300, onComplete: () => this.tweens.add({ targets: opcoes, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 }) })

    this.controles = new Controles(this)
    this.time.delayedCall(1200, () => {
      this.controles.onBotao((_, botao) => {
        if (this.saindo) return
        this.saindo = true
        tocar(this, 'confirmar')
        this.scene.start(botao === 'A' ? 'Battle' : 'Selecao', { chefe: this.idChefe })
      })
    })
    this.saindo = false
  }

  update(time, delta) {
    this.controles.atualizar()
    this.fundo.atualizar(delta)
  }
}
