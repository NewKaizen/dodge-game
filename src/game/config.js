import Phaser from 'phaser'
import { LARGURA, ALTURA, CORES } from './constants.js'
import Boot from './scenes/Boot.js'
import Menu from './scenes/Menu.js'
import EscolhaParty from './scenes/EscolhaParty.js'
import PvpEscolha from './scenes/PvpEscolha.js'
import PvpArena from './scenes/PvpArena.js'
import PvpVoto from './scenes/PvpVoto.js'
import CoopArena from './scenes/CoopArena.js'
import PvpResultado from './scenes/PvpResultado.js'
import Selecao from './scenes/Selecao.js'
import Dificuldade from './scenes/Dificuldade.js'
import Vitoria from './scenes/Vitoria.js'
import Pausa from './scenes/Pausa.js'
import Config from './scenes/Config.js'
import GameOver from './scenes/GameOver.js'
import Entrada from './scenes/Entrada.js'
import Grimorio from './scenes/Grimorio.js'

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
    scene: [Boot, Menu, EscolhaParty, PvpEscolha, PvpVoto, PvpArena, PvpResultado, Selecao, Dificuldade, CoopArena, Vitoria, GameOver, Entrada, Pausa, Config, Grimorio],
  }
}
