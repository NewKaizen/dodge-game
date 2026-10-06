import Phaser from 'phaser'
import Controles from '../controles.js'
import { CHEFES, ORDEM_CHEFES } from '../coop/chefes/index.js'
import { criarFundo } from '../backgrounds/index.js'
import { ESCALA } from '../arte/texturas.js'
import { tocar, musica } from '../audio.js'
import { CORES, DIFICULDADES, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'

const CARTA = { largura: 142, altura: 270, y: 245, passo: 152 }

// Tela de seleção de chefe (com a dificuldade base); depois vem a tela do nível (Dificuldade)
// B: volta para a escolha da party (EscolhaParty)
export default class Selecao extends Phaser.Scene {
  constructor() {
    super('Selecao')
  }

  create() {
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => (botao === 'A' ? this.confirmar() : this.voltar()))
    this.fundo = null
    this.escolhido = false
    const texto = (x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) =>
      this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, ...extra }).setOrigin(0.5)

    texto(LARGURA / 2, 36, 'ESCOLHA O CHEFE', 28, TEXTO.normal, { stroke: '#000000', strokeThickness: 4 })

    this.cartas = ORDEM_CHEFES.map((id, i) => {
      const def = CHEFES[id]
      const dif = DIFICULDADES[def.dificuldade]
      const x = LARGURA / 2 + (i - (ORDEM_CHEFES.length - 1) / 2) * CARTA.passo
      const y = CARTA.y
      const moldura = this.add.rectangle(x, y, CARTA.largura, CARTA.altura, CORES.painel, 0.88).setStrokeStyle(3, 0x505050)
      const sprite = this.add.image(x, y - 40, def.sprite).setScale(ESCALA.chefe * 0.8)
      texto(x, y + 62, def.nome.toUpperCase(), def.nome.length > 11 ? 14 : 18, TEXTO.normal)
      texto(x, y + 86, dif.rotulo, 16, dif.cor)
      const maxEstrelas = Math.max(...Object.values(DIFICULDADES).map((d) => d.estrelas))
      for (let k = 0; k < maxEstrelas; k++) {
        this.add.image(x + (k - (maxEstrelas - 1) / 2) * 20, y + 110, 'coracao').setTint(k < dif.estrelas ? parseInt(dif.cor.slice(1), 16) : 0x303030)
      }
      return { moldura, sprite, x, y }
    })

    this.cursor = this.add.image(0, 0, 'coracao').setTint(CORES.almas[0]).setScale(1.8)
    this.info = texto(LARGURA / 2, ALTURA - 56, '', 15)
    texto(LARGURA / 2, ALTURA - 30, '← → escolher     A: confirmar     B: party', 14, TEXTO.desabilitado)

    const atual = ORDEM_CHEFES.indexOf(this.registry.get('chefe'))
    this.selecionar(Math.max(0, atual), false)
    musica('selecao')
    this.cameras.main.fadeIn(250)
  }

  selecionar(indice, comSom = true) {
    const total = ORDEM_CHEFES.length
    this.indice = (indice + total) % total
    if (comSom) tocar(this, 'mover')
    this.cartas.forEach((c, k) => {
      const selecionada = k === this.indice
      c.moldura.setStrokeStyle(3, selecionada ? CORES.selecionado : 0x505050)
      c.sprite.setAlpha(selecionada ? 1 : 0.45)
      this.tweens.add({ targets: c.sprite, scale: ESCALA.chefe * (selecionada ? 0.9 : 0.8), duration: 150 })
    })
    const c = this.cartas[this.indice]
    this.cursor.setPosition(c.x, c.y - CARTA.altura / 2 - 18)
    this.fundo?.destruir()
    this.fundo = criarFundo(this, CHEFES[ORDEM_CHEFES[this.indice]].fundo)
    this.fundo.escurecer(true)
  }

  confirmar() {
    if (this.escolhido) return
    this.escolhido = true
    tocar(this, 'confirmar')
    this.cameras.main.flash(200, 255, 255, 255)
    this.cameras.main.fadeOut(300, 0, 0, 0)
    this.time.delayedCall(320, () => this.scene.start('Dificuldade', { chefe: ORDEM_CHEFES[this.indice] }))
  }

  voltar() {
    if (this.escolhido) return
    this.escolhido = true
    tocar(this, 'cancelar')
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => this.scene.start('EscolhaParty'))
  }

  update(time, delta) {
    this.controles.atualizar()
    const n = this.controles.numJogadores
    for (let j = 0; j < n; j++) {
      const direcao = this.controles.toque(j)
      if (direcao === 'esquerda' || direcao === 'cima') this.selecionar(this.indice - 1)
      if (direcao === 'direita' || direcao === 'baixo') this.selecionar(this.indice + 1)
    }
    this.fundo?.atualizar(delta)
    this.cursor.setY(this.cartas[this.indice].y - CARTA.altura / 2 - 18 + Math.sin(time / 200) * 3)
    const jogadores = this.registry.get('numJogadores') ?? 1
    this.info.setText(`${jogadores} ${jogadores > 1 ? 'JOGADORES' : 'JOGADOR'}  (mude no painel acima do jogo)`)
  }
}
