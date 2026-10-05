import Phaser from 'phaser'
import Controles from '../controles.js'
import { criarFundo } from '../backgrounds/index.js'
import { tocar, musica } from '../audio.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'

// Para onde vai o PVP: a escolha de personagem (PvpEscolha -> PvpArena -> PvpResultado)
export const CENA_PVP = 'PvpEscolha'

const OPCAO = { largura: 268, altura: 250, y: 236, passo: 292 }

const MODOS = [
  {
    id: 'coop',
    rotulo: 'CO-OP',
    cor: '#6dd0ff',
    cena: 'EscolhaParty',
    descricao: ['Monte a party e', 'enfrente um chefe', 'junto, lado a lado.'],
  },
  {
    id: 'pvp',
    rotulo: 'PVP',
    cor: '#ff5a6a',
    cena: CENA_PVP,
    descricao: ['Um contra o outro:', 'quem desviar melhor', 'vence a disputa.'],
  },
]

// Tela do modo de jogo, logo depois do Menu (B volta para ele): CO-OP (Menu -> Modo -> EscolhaParty
// -> Selecao -> Dificuldade -> Battle) ou PVP (PvpEscolha -> PvpArena -> PvpResultado).
// A: confirmar · ← →: escolher · B: voltar ao Menu
export default class Modo extends Phaser.Scene {
  constructor() {
    super('Modo')
  }

  create() {
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => (botao === 'A' ? this.confirmar() : botao === 'B' && this.voltar()))
    this.saindo = false
    const texto = (x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) =>
      this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, ...extra }).setOrigin(0.5)

    this.fundo = criarFundo(this, 'queen')
    this.fundo.escurecer(true)

    texto(LARGURA / 2, 36, 'ESCOLHA O MODO', 28, TEXTO.normal, { strokeThickness: 4 })

    this.opcoes = MODOS.map((modo, i) => {
      const x = LARGURA / 2 + (i - (MODOS.length - 1) / 2) * OPCAO.passo
      const y = OPCAO.y
      const topo = y - OPCAO.altura / 2
      const moldura = this.add.rectangle(x, y, OPCAO.largura, OPCAO.altura, CORES.painel, 0.88).setStrokeStyle(3, 0x505050)
      const rotulo = texto(x, topo + 44, modo.rotulo, 40, modo.cor, { strokeThickness: 5 })
      const cor = parseInt(modo.cor.slice(1), 16)
      // CO-OP: os dois corações lado a lado; PVP: frente a frente, um de cabeça para baixo
      const icones = [-1, 1].map((lado, k) =>
        this.add
          .image(x + lado * (modo.id === 'coop' ? 18 : 30), topo + 108, 'coracao')
          .setScale(2.4)
          .setTint(CORES.almas[k])
          .setAngle(modo.id === 'pvp' ? lado * 90 : 0),
      )
      const detalhes = texto(x, topo + 176, modo.descricao.join('\n'), 15, TEXTO.normal, { align: 'center', lineSpacing: 4, strokeThickness: 0 })
      return { modo, moldura, rotulo, icones, detalhes, x, y, cor }
    })

    this.cursor = this.add.image(0, 0, 'coracao').setTint(CORES.almas[0]).setScale(1.8)
    texto(LARGURA / 2, ALTURA - 30, '← → escolher     A: confirmar     B: voltar', 14, TEXTO.desabilitado, { strokeThickness: 0 })

    const ultimo = MODOS.findIndex((m) => m.id === this.registry.get('modo'))
    this.selecionar(Math.max(0, ultimo), false)

    // o painel Svelte pode mudar o número de jogadores a qualquer momento
    const aoMudar = (_, valor, anterior) => valor !== anterior && this.scene.restart()
    this.registry.events.on('changedata-numJogadores', aoMudar)
    this.events.once('shutdown', () => this.registry.events.off('changedata-numJogadores', aoMudar))

    musica(this, 'selecao')
    this.cameras.main.fadeIn(250)
  }

  selecionar(indice, comSom = true) {
    const total = this.opcoes.length
    this.indice = (indice + total) % total
    if (comSom) tocar(this, 'mover')
    this.opcoes.forEach((o, k) => {
      const selecionada = k === this.indice
      o.moldura.setStrokeStyle(3, selecionada ? CORES.selecionado : 0x505050)
      o.rotulo.setAlpha(selecionada ? 1 : 0.5)
      o.detalhes.setAlpha(selecionada ? 1 : 0.45)
      o.icones.forEach((icone) => {
        icone.setAlpha(selecionada ? 1 : 0.4)
        this.tweens.add({ targets: icone, scale: selecionada ? 2.8 : 2.4, duration: 150 })
      })
    })
  }

  confirmar() {
    if (this.saindo) return
    this.saindo = true
    const { modo } = this.opcoes[this.indice]
    this.registry.set('modo', modo.id)
    tocar(this, 'confirmar')
    this.cameras.main.flash(200, 255, 255, 255)
    this.cameras.main.fadeOut(300, 0, 0, 0)
    this.time.delayedCall(320, () => this.scene.start(modo.cena))
  }

  voltar() {
    if (this.saindo) return
    this.saindo = true
    tocar(this, 'cancelar')
    this.cameras.main.fadeOut(220, 0, 0, 0)
    this.time.delayedCall(240, () => this.scene.start('Menu'))
  }

  update(time, delta) {
    this.controles.atualizar()
    if (!this.saindo) {
      for (let j = 0; j < this.controles.numJogadores; j++) {
        const direcao = this.controles.toque(j)
        if (direcao === 'esquerda' || direcao === 'cima') this.selecionar(this.indice - 1)
        if (direcao === 'direita' || direcao === 'baixo') this.selecionar(this.indice + 1)
      }
    }
    this.fundo.atualizar(delta)
    const o = this.opcoes[this.indice]
    this.cursor.setPosition(o.x, o.y - OPCAO.altura / 2 - 18 + Math.sin(time / 200) * 3)
  }
}
