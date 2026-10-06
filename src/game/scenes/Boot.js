import Phaser from 'phaser'
import { ASSETS } from '../assets.js'
import { gerarTexturas } from '../arte/texturas.js'
import { IMAGENS_SUPER, SONS_SUPER } from '../pvp/super/sprites/index.js'
import { IMAGENS_HABILIDADES, SONS_HABILIDADES } from '../pvp/habilidades/sprites/index.js'
import { IMAGENS_MENU, SONS_MENU } from '../menu/sprites/index.js'

// Carrega os arquivos que estiverem no manifesto (assets.js), gera por
// código o resto e espera a fonte pixelada antes de começar
export default class Boot extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  preload() {
    for (const [chave, arquivo] of Object.entries(ASSETS.texturas)) if (arquivo) this.load.image(chave, arquivo)
    for (const [nome, arquivo] of Object.entries(ASSETS.sons)) if (arquivo) this.load.audio(`som-${nome}`, arquivo)
    // cartas SUPER (pvp/super/sprites/), cartas normais (pvp/habilidades/sprites/) e menu (menu/sprites/)
    for (const { chave, arquivo, quadro } of [...IMAGENS_SUPER, ...IMAGENS_HABILIDADES, ...IMAGENS_MENU]) {
      if (quadro) this.load.spritesheet(chave, arquivo, { frameWidth: quadro.largura, frameHeight: quadro.altura })
      else this.load.image(chave, arquivo)
    }
    for (const { nome, arquivo } of [...SONS_SUPER, ...SONS_HABILIDADES, ...SONS_MENU]) this.load.audio(`som-${nome}`, arquivo)
    // .mid não passa pelo Phaser: quem toca é game/midi.js
    for (const [nome, arquivo] of Object.entries(ASSETS.musicas)) if (arquivo && !/\.midi?$/i.test(arquivo)) this.load.audio(`musica-${nome}`, arquivo)
  }

  async create() {
    gerarTexturas(this)
    await carregarFonte()
    this.scene.start('Menu')
  }
}

async function carregarFonte() {
  const { familia, arquivos } = ASSETS.fonte
  try {
    await Promise.all(
      Object.entries(arquivos).map(async ([peso, arquivo]) => {
        const face = new FontFace(familia, `url(${arquivo})`, { weight: String(peso) })
        await face.load()
        document.fonts.add(face)
      }),
    )
  } catch (erro) {
    console.warn('[assets] a fonte não carregou; usando monospace', erro)
  }
}
