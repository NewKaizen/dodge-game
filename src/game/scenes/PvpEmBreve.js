import Phaser from 'phaser'
import Controles from '../controles.js'
import { criarFundo } from '../backgrounds/index.js'
import { tocar, musica } from '../audio.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'

// Tela provisória do PVP ("em construção"). Quando a cena 'PvpEscolha' existir,
// troque CENA_PVP em Modo.js e esta tela pode sair do jogo.
// B (ou A): voltar para a escolha do modo
export default class PvpEmBreve extends Phaser.Scene {
  constructor() {
    super('PvpEmBreve')
  }

  create() {
    this.controles = new Controles(this)
    this.controles.onBotao(() => this.voltar())
    this.saindo = false
    const texto = (x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) =>
      this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, ...extra }).setOrigin(0.5)

    this.fundo = criarFundo(this, 'queen')
    this.fundo.escurecer(true)

    this.add.rectangle(LARGURA / 2, ALTURA / 2 - 10, 420, 220, CORES.painel, 0.9).setStrokeStyle(3, 0x505050)
    texto(LARGURA / 2, ALTURA / 2 - 80, 'PVP', 40, '#ff5a6a', { strokeThickness: 5 })
    // dois corações se encarando
    this.coracoes = [-1, 1].map((lado, k) =>
      this.add
        .image(LARGURA / 2 + lado * 34, ALTURA / 2 - 22, 'coracao')
        .setScale(2.6)
        .setTint(CORES.almas[k])
        .setAngle(lado * 90),
    )
    texto(LARGURA / 2, ALTURA / 2 + 30, 'EM CONSTRUÇÃO', 22, TEXTO.selecionado)
    texto(LARGURA / 2, ALTURA / 2 + 62, 'Este modo ainda está sendo preparado.', 14, TEXTO.normal, { strokeThickness: 0 })
    texto(LARGURA / 2, ALTURA - 30, 'B: voltar', 14, TEXTO.desabilitado, { strokeThickness: 0 })

    musica(this, 'selecao')
    this.cameras.main.fadeIn(250)
  }

  voltar() {
    if (this.saindo) return
    this.saindo = true
    tocar(this, 'cancelar')
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => this.scene.start('Modo'))
  }

  update(time, delta) {
    this.controles.atualizar()
    this.fundo.atualizar(delta)
    this.coracoes.forEach((c, k) => c.setX(LARGURA / 2 + (k ? 1 : -1) * (34 + Math.sin(time / 180) * 4)))
  }
}
