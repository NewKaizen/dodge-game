import Phaser from 'phaser'
import Controles from '../controles.js'
import { criarFundo } from '../backgrounds/index.js'
import { tocar } from '../audio.js'
import { CORES, LARGURA, TEXTO } from '../constants.js'
import { menosMovimento } from '../preferencias.js'
import { capturarTexto } from '../../lib/simulador.js'
import { montarAvisos } from './avisos.js'
import { caixa, desenharDicas, texto, COR } from './ui.js'

// Base das telas de conta (Perfil, Amigos, Coleção): a moldura da tela de
// Configurações (fundo escuro, título amarelo, caixas pretas de borda branca,
// coração como cursor, dicas de botão no rodapé) e o que as três repetem:
//
//   - navegação: ↑↓←→ e A/B (C e Esc voltam também), tudo pelo Controles
//     (teclado, joystick serial e, depois, controle USB)
//   - pilha de telas: quem abre diz de onde veio (`pilha`); B volta para lá
//       scene.start('Perfil', { pilha: [{ cena: 'Menu' }] })
//   - redesenho: a subclasse implementa desenhar() e chama this.sujo = true
//     (ou this.ouvir(store)) quando algo muda; o desenho é refeito do zero
//   - texto: this.digitar() captura o teclado (lib/simulador.js capturarTexto),
//     nada vaza para o jogo enquanto digita
//   - os avisos (convite, pedido de amizade) aparecem por cima (conta/avisos.js)
//
// A subclasse define: desenhar(), aoDirecao(d), aoBotao(b) e, se quiser,
// travado() (modal aberto), tique(tempo) e dicas().
export default class CenaConta extends Phaser.Scene {
  init(dados) {
    this.pilha = dados?.pilha ?? [{ cena: 'Menu' }]
  }

  // chamar no create() da subclasse
  iniciarBase({ titulo, sub = '', musica = true } = {}) {
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => this.apertar(botao))
    this.controles.onPausa(() => this.apertar('B'))
    this.saindo = false
    this.sujo = true
    this.digitando = null
    this.cancelarTexto = null
    this.cursorAlvo = null
    this.piscou = -1
    this.fundo = criarFundo(this, 'queen')
    this.fundo.escurecer()
    this.cameras.main.fadeIn(220)
    this.tituloTexto = texto(this, 28, 6, titulo, 24, TEXTO.selecionado)
    this.subTexto = texto(this, LARGURA - 28, 16, sub, 11, COR.apagado).setOrigin(1, 0)
    this.view = this.add.container(0, 0).setDepth(10)
    this.cursor = this.add.image(0, 0, 'coracao').setTint(CORES.almas[0]).setDepth(30).setVisible(false)
    this.parar = []
    montarAvisos(this)
    this.events.once('shutdown', () => {
      this.cancelarTexto?.()
      this.parar.forEach((f) => f())
    })
  }

  // refaz a tela quando a loja mudar
  ouvir(loja) {
    let primeira = true
    this.parar.push(
      loja.subscribe(() => {
        if (primeira) return (primeira = false)
        this.sujo = true
      }),
    )
  }

  // ---------- desenho ----------

  t(x, y, conteudo, tamanho, cor = COR.texto, extra = {}) {
    const obj = texto(this, x, y, conteudo, tamanho, cor, extra)
    this.view.add(obj)
    return obj
  }

  caixa(x, y, largura, altura, borda = COR.borda, fundo = CORES.painel, alfa = 0.94) {
    const g = this.add.graphics()
    caixa(g, x, y, largura, altura, borda, fundo, alfa)
    this.view.add(g)
    return g
  }

  grafico() {
    const g = this.add.graphics()
    this.view.add(g)
    return g
  }

  rodape(dicas) {
    desenharDicas(this, this.view, dicas)
  }

  // o coração da seleção (balança no update)
  cursorEm(x, y, escala = 1) {
    this.cursorAlvo = { x, y, escala }
  }

  // campo de texto sendo digitado: o texto e o cursor piscando
  campoTexto() {
    return `${this.digitando?.texto ?? ''}${Math.floor(this.time.now / 400) % 2 ? '_' : ' '}`
  }

  // Caixa no meio com um título, algumas linhas de texto e as opções embaixo
  // (sem login, "carregando", contas indisponíveis). itens: [{ rotulo, cor? }]; indice: a selecionada
  telaCentral({ titulo, linhas = [], erro = '', itens = [], indice = 0, esquerda = false }) {
    const e = { x: 154, y: 100, largura: LARGURA - 308, altura: 300 }
    this.caixa(e.x, e.y, e.largura, e.altura)
    const cx = LARGURA / 2
    this.t(cx, e.y + 30, titulo, 18, COR.gold).setOrigin(0.5)
    linhas.forEach((l, i) => this.t(esquerda ? e.x + 54 : cx, e.y + 70 + i * 20, l, 12, COR.descricao, { wordWrap: { width: e.largura - 100 } }).setOrigin(esquerda ? 0 : 0.5, 0))
    if (erro) this.t(cx, e.y + e.altura - 100, erro, 12, COR.erro, { wordWrap: { width: e.largura - 60 }, align: 'center' }).setOrigin(0.5, 0)
    itens.forEach((it, i) => {
      const y = e.y + e.altura - 56 + (i - (itens.length - 1) / 2) * 32
      if (i === indice) {
        this.grafico().fillStyle(0xffe040, 0.12).fillRect(cx - 150, y - 14, 300, 28)
        this.cursorEm(cx - 130, y)
      }
      this.t(cx, y, it.rotulo, 16, it.cor ?? COR.texto).setOrigin(0.5)
    })
    this.rodape([['cimaBaixo', 'Escolher'], ['A', 'Confirmar'], ['B', 'Voltar']])
  }

  // ---------- entrada ----------

  // modal aberto (foto, por exemplo): a subclasse sobrescreve
  travado() {
    return false
  }

  apertar(botao) {
    if (this.saindo || this.digitando || this.travado()) return
    this.aoBotao(botao)
  }

  digitar({ inicial = '', max = 16, permitido, aoConfirmar, aoCancelar }) {
    this.digitando = { texto: inicial }
    this.sujo = true
    const fim = () => {
      this.digitando = null
      this.cancelarTexto = null
      this.sujo = true
    }
    this.cancelarTexto = capturarTexto({
      inicial,
      max,
      ...(permitido && { permitido }),
      aoMudar: (t) => {
        this.digitando = { texto: t }
        this.sujo = true
      },
      aoConfirmar: (t) => {
        fim()
        tocar(this, 'confirmar')
        aoConfirmar(t)
      },
      aoCancelar: () => {
        fim()
        tocar(this, 'cancelar')
        aoCancelar?.()
      },
    })
  }

  // ---------- navegação entre telas ----------

  // abre outra tela e volta para esta no B
  irPara(cena, dados = {}) {
    this.sair(cena, { ...dados, pilha: [...this.pilha, { cena: this.scene.key }] })
  }

  voltar() {
    const anterior = this.pilha.at(-1) ?? { cena: 'Menu' }
    this.sair(anterior.cena, { ...(anterior.dados ?? {}), pilha: this.pilha.slice(0, -1) })
  }

  sair(cena, dados) {
    if (this.saindo) return
    this.saindo = true
    this.cancelarTexto?.()
    this.cameras.main.fadeOut(180, 0, 0, 0)
    this.time.delayedCall(190, () => this.scene.start(cena, dados))
  }

  // ---------- quadro a quadro ----------

  update(time, delta) {
    this.controles.atualizar()
    this.fundo.atualizar(delta)
    if (!this.saindo && !this.digitando && !this.travado()) {
      for (let j = 0; j < this.controles.numJogadores; j++) {
        const d = this.controles.toque(j)
        if (d) this.aoDirecao(d)
      }
    }
    this.tique?.(time)
    // o cursor do campo de texto pisca
    if (this.digitando) {
      const fase = Math.floor(time / 400)
      if (fase !== this.piscou) {
        this.piscou = fase
        this.sujo = true
      }
    }
    if (this.sujo) {
      this.sujo = false
      this.view.removeAll(true)
      this.cursorAlvo = null
      this.desenhar()
    }
    const a = this.cursorAlvo
    this.cursor.setVisible(Boolean(a) && !this.digitando)
    if (a) this.cursor.setPosition(a.x + (menosMovimento() ? 0 : Math.sin(time / 180) * 2), a.y).setScale(a.escala)
  }
}
