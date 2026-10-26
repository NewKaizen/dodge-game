import Phaser from 'phaser'
import { FONTE, LARGURA, ALTURA, TEXTO, CORES } from './constants.js'
import { fatores } from './acessibilidade.js'
import { aposQuadros } from './quadros.js'

// Quadro "CARREGANDO…" para as trocas de cena pesadas (arenas, escolha de
// personagem, GUIA): em PCs fracos o create() da cena nova trava a tela por uns
// instantes; assim o jogador vê isto (e não um quadro congelado ou preto) e o
// trabalho pesado começa só depois de o quadro ter sido desenhado.
//
//   irCarregando(cena, 'PvpArena', dados, aoIniciar?)
//       no lugar de cena.scene.start(chave, dados): sobe o quadro, espera 2 quadros
//       desenhados e então abre a cena (aoIniciar roda logo depois do start, p. ex.
//       scene.launch('Entrada')). O quadro some quando a cena nova já desenhou 2 quadros.
//
// Só para trocas locais: em rede, o host troca as cenas dos dois PCs por
// irParaCena (rede.js), que continua mandando direto.
export function irCarregando(cena, chave, dados, aoIniciar) {
  const cenas = cena.scene
  if (!cenas.get('Carregando') || cenas.isActive('Carregando')) {
    cenas.start(chave, dados)
    aoIniciar?.()
    return
  }
  cenas.launch('Carregando', { destino: chave })
  cenas.bringToTop('Carregando')
  const jogo = cena.game
  aposQuadros(jogo.events, 2, () => {
    cenas.start(chave, dados)
    aoIniciar?.()
    cenas.bringToTop('Carregando')
    jogo.events.emit('carregando-aberto')
  })
}

export default class Carregando extends Phaser.Scene {
  constructor() {
    super('Carregando')
  }

  init(dados) {
    this.destino = dados?.destino
  }

  create() {
    this.add.rectangle(0, 0, LARGURA, ALTURA, CORES.fundo).setOrigin(0)
    const cx = LARGURA / 2
    const cy = ALTURA / 2
    this.add
      .text(cx, cy - 6, 'CARREGANDO…', { fontFamily: FONTE, fontSize: '28px', color: TEXTO.normal, stroke: '#000000', strokeThickness: 4 })
      .setOrigin(0.5)
    const coracao = this.add.image(cx, cy + 40, 'coracao').setTint(CORES.almas[0]).setScale(1.6)
    // "reduzir animações": o coração fica parado
    if (fatores().piscar) this.tweens.add({ targets: coracao, scale: 2.1, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.fechar = null
    this.aberto = false
    this.game.events.once('carregando-aberto', () => (this.aberto = true))
    this.events.once('shutdown', () => this.game.events.off('carregando-aberto'))
  }

  // some quando a cena de destino já está de pé e desenhou 2 quadros
  update() {
    if (this.fechar || !this.aberto || !this.destino || !this.scene.isActive(this.destino)) return
    this.fechar = aposQuadros(this.game.events, 2, () => this.scene.stop())
  }
}
