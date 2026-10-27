import Phaser from 'phaser'
import { LARGURA, ALTURA } from './constants.js'
import { fatores } from './acessibilidade.js'
import { caixa, texto, COR } from './conta/ui.js'
import { textoDaQueda } from '../lib/lan/religar.js'

// Aviso da QUEDA DE CONEXÃO no meio da partida em rede (Fase 2D, game/rede.js):
// por cima da cena (que fica parada), no visual das telas de conta. Diz quem
// caiu e quanto falta da janela de 20 s; os controles daqui ficam travados
// enquanto ele está na tela (game/rede.js).
//
//   cena.scene.launch('Religando', { queda: () => queda })   queda: veja textoDaQueda (lib/lan/religar.js)
export default class Religando extends Phaser.Scene {
  constructor() {
    super('Religando')
  }

  init(dados) {
    this.queda = typeof dados?.queda === 'function' ? dados.queda : () => null
  }

  create() {
    this.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000, 0.6).setOrigin(0)
    const w = 420
    const h = 120
    const x = (LARGURA - w) / 2
    const y = (ALTURA - h) / 2
    caixa(this.add.graphics(), x, y, w, h, COR.tema)
    this.titulo = texto(this, LARGURA / 2, y + 28, '', 20, COR.gold).setOrigin(0.5)
    this.texto = texto(this, LARGURA / 2, y + 66, '', 13, COR.texto, { align: 'center', wordWrap: { width: w - 40 } }).setOrigin(0.5)
    this.dica = texto(this, LARGURA / 2, y + h - 16, 'a partida volta no começo da rodada', 11, COR.dica).setOrigin(0.5)
    this.ponto = this.add.image(x + 26, y + 28, 'coracao').setTint(0xffe040).setScale(1.2)
    if (fatores().piscar) this.tweens.add({ targets: this.ponto, alpha: 0.25, duration: 500, yoyo: true, repeat: -1 })
    this.atualizar()
  }

  atualizar() {
    const t = textoDaQueda(this.queda() ?? {})
    this.titulo.setText(t.titulo)
    this.texto.setText(t.texto)
  }

  update() {
    this.atualizar()
  }
}
