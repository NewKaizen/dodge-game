import Phaser from 'phaser'
import Controles from '../controles.js'
import { tocar } from '../audio.js'
import { irCarregando } from '../carregando.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'

// Menu -> GUIA: a porta de entrada dos dois guias. O MANUAL DO RALSEI (prévia) vem primeiro; o
// guia completo de cartas e arenas (cena Grimorio) continua igual, na segunda opção.
//   ↑/↓ escolhe · A abre · B volta ao Menu
const OPCOES = [
  { rotulo: 'MANUAL DO RALSEI (prévia)', cor: '#ffd23a', cena: 'ManualRalsei', dica: 'um caderno desenhado a giz: aprenda mexendo no coração' },
  { rotulo: 'CARTAS E ARENAS', cor: '#b48cff', cena: 'Grimorio', dica: 'todas as cartas e as rodadas bônus das arenas' },
]

// A instância da cena é REAPROVEITADA pelo Phaser: tudo volta ao inicial no começo do init().
const estadoInicial = () => ({
  indice: 0,
  saindo: false,
  linhas: null,
  seta: null,
  dica: null,
  controles: null,
})

export default class GuiaEntrada extends Phaser.Scene {
  constructor() {
    super('GuiaEntrada')
  }

  init() {
    Object.assign(this, estadoInicial())
  }

  create() {
    this.cameras.main.setBackgroundColor(CORES.fundo)
    this.controles = new Controles(this)
    this.controles.onBotao((j, botao) => (botao === 'A' ? this.abrir() : this.voltar()))
    this.controles.onPausa(() => this.voltar())
    const estilo = (tamanho, cor) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 5 })
    this.add.text(LARGURA / 2, 70, 'GUIA', estilo(34, '#b48cff')).setOrigin(0.5)
    this.linhas = OPCOES.map((o, i) => this.add.text(LARGURA / 2, 190 + i * 64, o.rotulo, estilo(26, o.cor)).setOrigin(0.5))
    this.seta = this.add.image(0, 0, 'coracao').setTint(CORES.almas[0]).setScale(1.6)
    this.dica = this.add.text(LARGURA / 2, 370, '', { ...estilo(13, '#9a9ab0'), strokeThickness: 3 }).setOrigin(0.5)
    this.add.text(LARGURA / 2, ALTURA - 20, '↑↓ escolher      A: abrir      B: voltar', { ...estilo(12, '#c8c8d8'), strokeThickness: 3 }).setOrigin(0.5)
    this.cameras.main.fadeIn(200)
    this.atualizar()
  }

  atualizar() {
    this.linhas.forEach((l, i) => l.setAlpha(i === this.indice ? 1 : 0.5))
    const l = this.linhas[this.indice]
    this.seta.setPosition(l.x - l.width / 2 - 28, l.y)
    this.dica.setText(OPCOES[this.indice].dica)
  }

  update() {
    this.controles.atualizar()
    if (this.saindo) return
    // qualquer jogador local navega (como no Menu)
    for (let j = 0; j < this.controles.numJogadores; j++) {
      const t = this.controles.toque(j)
      if (t !== 'cima' && t !== 'baixo') continue
      this.indice = (this.indice + (t === 'baixo' ? 1 : OPCOES.length - 1)) % OPCOES.length
      tocar(this, 'mover')
      this.atualizar()
      break
    }
  }

  abrir() {
    if (this.saindo) return
    this.saindo = true
    tocar(this, 'confirmar')
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => irCarregando(this, OPCOES[this.indice].cena))
  }

  voltar() {
    if (this.saindo) return
    this.saindo = true
    tocar(this, 'cancelar')
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => this.scene.start('Menu'))
  }
}
