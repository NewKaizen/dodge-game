import Phaser from 'phaser'
import { LARGURA, ALTURA, CORES } from './constants.js'
import Boot from './scenes/Boot.js'
import Menu from './scenes/Menu.js'
import Selecao from './scenes/Selecao.js'
import Battle from './scenes/Battle.js'
import Vitoria from './scenes/Vitoria.js'
import GameOver from './scenes/GameOver.js'

export function criarConfig(parent, zoom = 1) {
  return {
    type: Phaser.AUTO,
    parent,
    width: LARGURA,
    height: ALTURA,
    backgroundColor: CORES.fundo,
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.NONE, zoom },
    scene: [Boot, Menu, Selecao, Battle, Vitoria, GameOver],
  }
}

// Maior escala inteira que cabe na janela (pixel art sem borrar)
export function zoomInteiro(margemVertical = 190) {
  const x = (window.innerWidth - 32) / LARGURA
  const y = (window.innerHeight - margemVertical) / ALTURA
  return Math.max(1, Math.floor(Math.min(x, y)))
}
