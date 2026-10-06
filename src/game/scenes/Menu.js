import Phaser from 'phaser'
import Controles from '../controles.js'
import { tocar, musica } from '../audio.js'
import { ASSETS } from '../assets.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'
import { BATIDA, TELA, LOGO, OPCOES as POS } from '../menu/layout.js'
import { criarSala } from '../menu/sala.js'
import { criarTelao } from '../menu/telao.js'
import { criarLogo } from '../menu/logo.js'

// Tela inicial: um quarto escuro e calmo, com o caos preso no telão da parede
// (uma luta de balas rolando) e a luz dele iluminando a sala e as silhuetas
// dos lutadores. Logo no canto de cima à esquerda, opções alinhadas à
// esquerda. CO-OP (-> EscolhaParty) e PVP (-> PvpEscolha): a luz do telão engole
// a sala. CONFIGURAÇÕES (-> Config). Embaixo da lista, uma linha diz o que a
// opção escolhida faz; sem joystick conectado, as opções ficam apagadas e a
// linha vira um aviso pedindo para conectar.
//
// Música: ASSETS.musicas.menu (public/assets/musicas/menu.mid, ou o arquivo
// apontado em assets.js); sem ela, toca a do Jevil. O nome no canto de cima
// vem de ASSETS.tituloMusicaMenu.
//
// As peças ficam em game/menu/ (layout.js, sala.js, telao.js, logo.js).
//   cima/baixo escolher · A confirmar
export const TITULO = 'DODGE'
const SUBTITULO = 'DESVIE OU CAIA'
// Para onde vai o PVP: a escolha de personagem (PvpEscolha -> PvpArena -> PvpResultado)
export const CENA_PVP = 'PvpEscolha'
const OPCOES = [
  { id: 'coop', rotulo: 'CO-OP', cor: '#6dd0ff', cena: 'EscolhaParty', dica: 'cartas juntos contra um chefe' },
  { id: 'pvp', rotulo: 'PVP', cor: '#ff3d6e', cena: CENA_PVP, dica: 'duelo de cartas: quem desvia, vence' },
  { id: 'config', rotulo: 'CONFIGURAÇÕES', cor: '#f2c14e', cena: 'Config', dica: 'som, velocidade e tela cheia' },
]

export default class Menu extends Phaser.Scene {
  constructor() {
    super('Menu')
  }

  create() {
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => botao === 'A' && this.confirmar())
    this.saindo = false
    this.pronto = false
    this.batidas = 0
    this.indice = Math.min(this.registry.get('menuIndice') ?? 0, OPCOES.length - 1) // volta na opção de onde saiu
    const rapido = Boolean(this.registry.get('menuVisto'))
    this.registry.set('menuVisto', true)

    this.sala = criarSala(this, { tela: TELA })
    this.telao = criarTelao(this, TELA)
    this.logo = criarLogo(this, LOGO, { titulo: TITULO, subtitulo: SUBTITULO })
    this.montarOpcoes()
    this.montarCantos()

    musica(this, 'menu', 'jevil')
    this.cameras.main.fadeIn(rapido ? 220 : 500)
    this.abrir(rapido)

    const aoConectar = () => this.atualizarOpcoes()
    this.registry.events.on('changedata-conectado', aoConectar)
    // o painel de cima pode mudar o número de jogadores: os controles mudam junto
    const aoMudar = (_, valor, anterior) => valor !== anterior && this.scene.restart()
    this.registry.events.on('changedata-numJogadores', aoMudar)
    this.events.once('shutdown', () => {
      this.registry.events.off('changedata-conectado', aoConectar)
      this.registry.events.off('changedata-numJogadores', aoMudar)
    })
  }

  // a TV liga, o logo entra e as opções deslizam da esquerda
  async abrir(rapido) {
    await this.telao.ligar({ rapido })
    if (!this.scene.isActive()) return
    this.time.addEvent({ delay: BATIDA, loop: true, callback: () => this.batida() })
    await this.logo.entrar({ rapido })
    if (!this.scene.isActive()) return
    this.pronto = true
    this.atualizarOpcoes()
    this.tweens.add({ targets: this.painel, x: 0, alpha: 1, duration: rapido ? 120 : 320, ease: 'Cubic.easeOut' })
  }

  batida() {
    if (this.saindo) return
    const n = ++this.batidas
    this.telao.batida(n)
    this.sala.batida(n)
    this.logo.batida(n)
    this.barras?.forEach((b, i) => this.tweens.add({ targets: b, scaleY: Phaser.Math.FloatBetween(0.3, 1), duration: BATIDA * 0.45, yoyo: true, delay: i * 25 }))
  }

  // ---------- opções (alinhadas à esquerda, cada uma com a sua cor) ----------

  montarOpcoes() {
    this.painel = this.add.container(-40, 0).setDepth(30).setAlpha(0)
    const estilo = (tamanho, cor) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 5 })
    this.linhas = OPCOES.map((o, i) => this.add.text(POS.x, POS.y + i * POS.passo, o.rotulo, estilo(26, o.cor)).setOrigin(0, 0.5))
    this.seta = this.add.text(0, 0, '◀', estilo(22, '#ffffff')).setOrigin(0, 0.5)
    this.aviso = this.add.text(POS.x, POS.y + OPCOES.length * POS.passo - 6, '', { ...estilo(12, TEXTO.desabilitado), lineSpacing: 4 }).setOrigin(0, 0)
    this.painel.add([...this.linhas, this.seta, this.aviso])
  }

  get conectado() {
    return Boolean(this.registry.get('conectado'))
  }

  atualizarOpcoes() {
    const ativo = this.conectado
    this.linhas.forEach((l, i) => {
      const sel = i === this.indice
      l.setColor(ativo ? OPCOES[i].cor : '#5a5a6a').setAlpha(ativo ? (sel ? 1 : 0.55) : 0.8)
      l.setX(POS.x + (sel && ativo ? 8 : 0))
    })
    const l = this.linhas[this.indice]
    this.seta.setVisible(ativo).setColor(OPCOES[this.indice].cor).setPosition(POS.x + 8 + l.width + 12, l.y)
    this.aviso
      .setText(ativo ? OPCOES[this.indice].dica : 'conecte o joystick ou use o\nSIMULADOR (TECLADO) aí em cima ↑')
      .setColor(ativo ? '#9a9ab0' : TEXTO.desabilitado)
  }

  selecionar(indice) {
    this.indice = (indice + OPCOES.length) % OPCOES.length
    tocar(this, 'mover')
    this.atualizarOpcoes()
  }

  // ---------- cantos: música tocando (cima, direita) e botões (baixo, direita) ----------

  montarCantos() {
    const estilo = (tamanho, cor) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor })
    const y = 22
    const nome = this.add.text(LARGURA - 14, y, ASSETS.tituloMusicaMenu ?? '', estilo(11, '#c8c8d8')).setOrigin(1, 0.5).setDepth(30)
    const xBarras = nome.x - nome.width - 26
    this.add.rectangle(xBarras - 8, y - 11, LARGURA - xBarras - 6 + 8, 22, 0x000000, 0.45).setOrigin(0).setDepth(29)
    this.barras = [0, 1, 2, 3].map((i) =>
      this.add.rectangle(xBarras + i * 5, y + 7, 3, 14, 0x3fd6c8).setOrigin(0.5, 1).setDepth(30).setScale(1, 0.5),
    )
    const dica = (x, letra, texto) => {
      this.add.circle(x, ALTURA - 18, 7).setStrokeStyle(1.5, 0xc8c8d8).setDepth(30)
      this.add.text(x, ALTURA - 18, letra, estilo(10, '#c8c8d8')).setOrigin(0.5).setDepth(30)
      return this.add.text(x + 12, ALTURA - 18, texto, estilo(11, '#c8c8d8')).setOrigin(0, 0.5).setDepth(30)
    }
    dica(LARGURA - 92, 'A', 'ESCOLHER')
    this.add.text(LARGURA - 108, ALTURA - 18, '↑↓ MOVER', estilo(11, '#c8c8d8')).setOrigin(1, 0.5).setDepth(30)
  }

  confirmar() {
    if (this.saindo || !this.pronto || !this.conectado) return
    this.saindo = true
    const opcao = OPCOES[this.indice]
    this.registry.set('menuIndice', this.indice)
    if (opcao.id === 'config') {
      tocar(this, 'confirmar')
      this.cameras.main.fadeOut(220, 0, 0, 0)
      this.time.delayedCall(240, () => this.scene.start('Config', { voltar: 'Menu' }))
      return
    }
    // CO-OP/PVP: o logo e as opções somem e a luz do telão engole a sala
    this.registry.set('modo', opcao.id)
    tocar(this, 'superAtivar')
    this.logo.sair()
    this.tweens.add({ targets: this.painel, x: -60, alpha: 0, duration: 220, ease: 'Cubic.easeIn' })
    this.telao.explodir().then(() => this.scene.isActive() && this.scene.start(opcao.cena))
  }

  update(time, delta) {
    this.controles.atualizar()
    if (this.pronto && !this.saindo && this.conectado) {
      for (let j = 0; j < this.controles.numJogadores; j++) {
        const d = this.controles.toque(j)
        if (d === 'cima' || d === 'esquerda') this.selecionar(this.indice - 1)
        if (d === 'baixo' || d === 'direita') this.selecionar(this.indice + 1)
      }
    }
    this.sala.iluminar(this.telao.cor())
    this.sala.atualizar(delta)
    this.telao.atualizar(delta)
    this.logo.atualizar(delta)
    if (this.pronto && !this.saindo && this.seta.visible) this.seta.setX(POS.x + 8 + this.linhas[this.indice].width + 12 + Math.sin(time / 160) * 3)
  }
}
