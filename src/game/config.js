import Phaser from 'phaser'
import { LARGURA, ALTURA, CORES } from './constants.js'
import Boot from './scenes/Boot.js'
import Menu from './scenes/Menu.js'
import EscolhaParty from './scenes/EscolhaParty.js'
import PvpEscolha from './scenes/PvpEscolha.js'
import PvpArena from './scenes/PvpArena.js'
import PvpResultado from './scenes/PvpResultado.js'
import Selecao from './scenes/Selecao.js'
import Dificuldade from './scenes/Dificuldade.js'
import Battle from './scenes/Battle.js'
import Vitoria from './scenes/Vitoria.js'
import Pausa from './scenes/Pausa.js'
import Config from './scenes/Config.js'
import GameOver from './scenes/GameOver.js'
import Entrada from './scenes/Entrada.js'
import TesteCartas from './scenes/TesteCartas.js'
import PvpArenaTeste from './scenes/PvpArenaTeste.js'

// tamanho: { largura, altura, zoomCss } de prepararResolucao() (resolucao.js)
export function criarConfig(parent, { largura = LARGURA, altura = ALTURA, zoomCss = 1 } = {}) {
  return {
    type: Phaser.AUTO,
    parent,
    width: largura,
    height: altura,
    backgroundColor: CORES.fundo,
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.NONE, zoom: zoomCss },
    // TesteCartas e PvpArenaTeste: telas de teste do PvP (no dev: debugJogo.jogo.scene.start('...'))
    scene: [Boot, Menu, EscolhaParty, PvpEscolha, PvpArena, PvpResultado, Selecao, Dificuldade, Battle, Vitoria, GameOver, Entrada, Pausa, Config, TesteCartas, PvpArenaTeste],
  }
}
