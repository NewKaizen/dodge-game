import Phaser from 'phaser'
import { ASSETS } from '../assets.js'
import { gerarTexturas } from '../arte/texturas.js'

// Carrega os arquivos que estiverem no manifesto (assets.js), gera por
// código o resto e espera a fonte pixelada antes de começar
export default class Boot extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  preload() {
    for (const [chave, arquivo] of Object.entries(ASSETS.texturas)) if (arquivo) this.load.image(chave, arquivo)
    for (const [nome, arquivo] of Object.entries(ASSETS.sons)) if (arquivo) this.load.audio(`som-${nome}`, arquivo)
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
