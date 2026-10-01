import Phaser from 'phaser'
import { LARGURA, ALTURA, CORES } from './constants.js'
import Boot from './scenes/Boot.js'
import Menu from './scenes/Menu.js'
import Selecao from './scenes/Selecao.js'
import Dificuldade from './scenes/Dificuldade.js'
import Battle from './scenes/Battle.js'
import Vitoria from './scenes/Vitoria.js'
import Pausa from './scenes/Pausa.js'
import GameOver from './scenes/GameOver.js'
import Entrada from './scenes/Entrada.js'

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
    scene: [Boot, Menu, Selecao, Dificuldade, Battle, Vitoria, GameOver, Entrada, Pausa],
  }
}
