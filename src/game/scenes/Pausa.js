import Phaser from 'phaser'
import { UI } from '../tema.js'
import { menosMovimento } from '../preferencias.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'
import Controles, { travarEntrada } from '../controles.js'
import { tocar, pararMusica } from '../audio.js'
import { avisarPausa } from '../../lib/lan/rede.js'
import { semLigaduras } from '../campanha/texto.js'

// Menu de pause por cima da luta (botão C: tecla C/Esc, ou BTN C no joystick).
// A arena fica congelada (scene.pause) e a música parada no ponto em que
// estava; "Continuar" devolve tudo exatamente de onde parou. Dados:
//   cena        chave da cena pausada (CoopArena ou PvpArena; precisa de retomarDaPausa())
//   recomecar   dados para reiniciar essa cena
//   sair        cena de destino do "SAIR" (dadosSair: os dados com que ela abre)
//   confirmarSaida  já abre perguntando "TEM CERTEZA?" no SAIR (o B da partida do Manual do Ralsei)
//   subtitulo   texto embaixo de PAUSA (padrão "contra <nome>")
//   motivo      só quando o jogo pausou sozinho (janela sem foco, controle desconectado): vai no pé da caixa
//
//   C ou B     continuar
//   CONFIGURAÇÕES abre a cena Config por cima (esta fica pausada até ela fechar)
//   cima/baixo escolher, A confirma
//
// MODO ONLINE (`online: true`; partida em rede e campanha/desafio diário, game/pausaOnline.js): a
// "pausa" dos jogos online. O menu abre POR CIMA e a partida CONTINUA para todos (a arena não é
// pausada): enquanto ele está aberto o meu coração fica parado (controles.js travarEntrada: só a
// Pausa e a Config leem o controle), o relógio da escolha corre e passa a vez sozinho, e os outros
// veem PAUSADO no meu lugar (lib/lan/rede.js avisarPausa). Opções: CONTINUAR, CONFIGURAÇÕES e
// SAIR DA PARTIDA (com confirmação; `sair` é quem sai: sairSala na sala, desistir na campanha).
const OPCOES_ONLINE = [
  { id: 'continuar', rotulo: 'CONTINUAR' },
  { id: 'config', rotulo: 'CONFIGURAÇÕES' },
  { id: 'sair', rotulo: 'SAIR DA PARTIDA' },
]
const OPCOES = [
  { id: 'continuar', rotulo: 'CONTINUAR' },
  { id: 'config', rotulo: 'CONFIGURAÇÕES' },
  { id: 'recomecar', rotulo: 'RECOMEÇAR A LUTA' },
  { id: 'sair', rotulo: 'SAIR DA LUTA' },
]

// A instância da cena é REAPROVEITADA pelo Phaser: o que a abertura anterior deixou aqui
// (a Config aberta por cima, por exemplo) volta ao inicial no começo do init().
const estadoInicial = () => ({
  emConfig: false,
  online: false,
  opcoes: OPCOES,
  destravar: null,
  sairOnline: null,
})

export default class Pausa extends Phaser.Scene {
  constructor() {
    super('Pausa')
  }

  init(dados) {
    Object.assign(this, estadoInicial())
    this.nomeChefe = dados.nome ?? ''
    this.cenaPausada = dados.cena
    this.dadosRecomecar = dados.recomecar
    this.destinoSair = dados.sair
    this.dadosSair = dados.dadosSair
    this.confirmarSaida = Boolean(dados.confirmarSaida)
    this.subtitulo = dados.subtitulo ?? (this.nomeChefe ? `contra ${this.nomeChefe}` : '')
    this.motivo = typeof dados.motivo === 'string' ? dados.motivo : ''
    this.online = Boolean(dados.online)
    this.opcoes = this.online ? OPCOES_ONLINE : OPCOES
    this.sairOnline = typeof dados.sair === 'function' ? dados.sair : null
  }

  create() {
    // "SAIR" pede confirmação (segundo A); com confirmarSaida a pausa já abre nela
    const OPCOES = this.opcoes
    this.indice = this.confirmarSaida ? OPCOES.findIndex((o) => o.id === 'sair') : 0
    this.confirmando = this.confirmarSaida
    this.fechando = false

    const cx = LARGURA / 2
    const veu = this.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000).setOrigin(0).setAlpha(0)
    // online a partida continua aparecendo atrás (e o véu segura o mouse: nada da arena por baixo)
    this.tweens.add({ targets: veu, alpha: this.online ? 0.5 : 0.72, duration: 140 })
    if (this.online) veu.setInteractive()

    const painel = this.add.container(cx, ALTURA / 2)
    const caixa = this.add.rectangle(0, 0, 360, 290, UI.painel, 0.98).setStrokeStyle(1, UI.linha)
    const texto = (x, y, conteudo, tamanho, cor = TEXTO.normal) =>
      this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
    const titulo = texto(0, -104, this.online ? 'PAUSA' : 'RESPIRA.', 38, UI.destaque)
    const sub = texto(0, -64, this.subtitulo, 13, TEXTO.desabilitado)
    this.linhas = OPCOES.map((o, i) => texto(10, -26 + i * 32, o.rotulo, 18))
    this.cursor = this.add.image(0, 0, 'coracao').setTint(CORES.almas[0]).setScale(1.3)
    this.aviso = texto(0, 104, 'C / B: continuar     A: escolher', 12, TEXTO.desabilitado)
    // online: a partida não para (o coração fica parado e o relógio corre)
    const continua = this.online ? texto(0, 128, semLigaduras('a partida continua: seu coração fica parado'), 11, TEXTO.selecionado) : null
    const detalhe = this.add.rectangle(-178, -104, 3, 48, UI.ciano)
    this.realcePausa = this.add.rectangle(0, -26, 326, 29, UI.elevado)
    painel.add([caixa, detalhe, this.realcePausa, titulo, sub, ...this.linhas, this.cursor, this.aviso, ...(continua ? [continua] : [])])
    this.linhas.forEach((l, i) => {
      l.setInteractive({ useHandCursor: true })
      l.on('pointerover', () => { if (!this.emConfig && !this.fechando) { this.indice = i; this.confirmando = false; this.marcar(false) } })
      l.on('pointerdown', () => { if (!this.emConfig && !this.fechando) { this.indice = i; this.escolher() } })
    })
    if (this.motivo) painel.add(texto(0, -45, `pausado: ${this.motivo}`, 11, TEXTO.selecionado))

    // entra com um "soco" rápido
    painel.setScale(menosMovimento() ? 1 : 0.98).setAlpha(0)
    this.tweens.add({ targets: painel, scale: 1, alpha: 1, duration: 160, ease: 'Cubic.easeOut' })


    this.controles = new Controles(this)
    // com as configurações abertas por cima, quem ouve os botões é a Config
    this.controles.onBotao((_, botao) => !this.emConfig && (botao === 'A' ? this.escolher() : this.continuar()))
    this.controles.onPausa(() => !this.emConfig && this.continuar())
    this.controles.onPausaOnline(() => !this.emConfig && this.continuar())
    const aoVoltar = () => (this.emConfig = false)
    this.events.on('resume', aoVoltar)
    // online: a partida acabou (ou a cena trocou) com o menu aberto: ele fecha junto (senão a tela
    // seguinte ficaria sem controle, travada por ele)
    const debaixo = this.online ? this.scene.get(this.cenaPausada) : null
    const fecharJunto = () => {
      if (this.scene.isActive() || this.scene.isPaused()) {
        if (this.scene.isActive('Config')) this.scene.stop('Config')
        this.scene.stop()
      }
    }
    if (this.online) {
      // só esta cena (e a Config por cima) lê o controle: o coração da arena fica parado
      this.destravar = travarEntrada(['Pausa', 'Config'])
      avisarPausa(true)
      debaixo?.events.once('shutdown', fecharJunto)
    }
    this.events.once('shutdown', () => {
      this.events.off('resume', aoVoltar) // a cena é reaproveitada: sem ouvinte acumulado
      debaixo?.events.off('shutdown', fecharJunto)
      if (this.online) {
        // (depois dos outros ouvintes deste mesmo botão: o C que fechou não reabre a pausa na arena)
        const destravar = this.destravar
        this.destravar = null
        queueMicrotask(() => destravar?.())
        avisarPausa(false)
      }
    })
    this.marcar(false)
    tocar(this, 'confirmar')
  }

  update() {
    if (this.fechando) return
    this.controles.atualizar()
    const direcao = this.controles.toque(0) ?? this.controles.toque(1)
    if (direcao === 'cima') this.mover(-1)
    if (direcao === 'baixo') this.mover(1)
  }

  mover(passo) {
    const OPCOES = this.opcoes
    this.indice = (this.indice + passo + OPCOES.length) % OPCOES.length
    this.confirmando = false
    this.marcar(true)
  }

  marcar(comSom) {
    const OPCOES = this.opcoes
    if (comSom) tocar(this, 'mover')
    this.linhas.forEach((l, i) => {
      l.setColor(i === this.indice ? UI.destaque : TEXTO.normal)
      if (OPCOES[i].id === 'sair') l.setText(this.confirmando && i === this.indice ? 'TEM CERTEZA? (A)' : OPCOES[i].rotulo)
    })
    const alvo = this.linhas[this.indice]
    this.realcePausa.setY(alvo.y)
    this.cursor.setPosition(alvo.x - alvo.width / 2 - 18, alvo.y)
  }

  escolher() {
    if (this.fechando) return
    const opcao = this.opcoes[this.indice].id
    if (opcao === 'continuar') return this.continuar()
    if (opcao === 'config') {
      this.emConfig = true
      tocar(this, 'confirmar')
      this.scene.launch('Config', { sobre: 'Pausa' })
      this.scene.pause()
      return
    }
    if (opcao === 'sair' && !this.confirmando) {
      this.confirmando = true
      tocar(this, 'erro')
      return this.marcar(false)
    }
    this.fechando = true
    tocar(this, 'confirmar')
    if (this.online) {
      // a saída de sempre da partida online (a sala: sairSala, e game/rede.js leva ao lobby/menu)
      const sair = this.sairOnline
      this.scene.stop()
      sair?.()
      return
    }
    pararMusica()
    this.scene.stop('Entrada')
    this.scene.stop(this.cenaPausada)
    if (opcao === 'recomecar') this.scene.start(this.cenaPausada, this.dadosRecomecar)
    else this.scene.start(this.destinoSair, this.dadosSair)
  }

  continuar() {
    if (this.fechando) return
    this.fechando = true
    tocar(this, 'cancelar')
    if (!this.online) this.scene.get(this.cenaPausada)?.retomarDaPausa()
    this.scene.stop()
  }
}
