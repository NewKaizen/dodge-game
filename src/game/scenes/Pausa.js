import Phaser from 'phaser'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'
import Controles from '../controles.js'
import { tocar, pararMusica } from '../audio.js'

// Menu de pause por cima da batalha (botão C: tecla C/Esc, ou BTN C no joystick).
// A Battle fica congelada (scene.pause) e a música parada no ponto em que
// estava; "Continuar" devolve tudo exatamente de onde parou.
//
//   C ou B     continuar
//   cima/baixo escolher, A confirma
const OPCOES = [
  { id: 'continuar', rotulo: 'CONTINUAR' },
  { id: 'recomecar', rotulo: 'RECOMEÇAR A LUTA' },
  { id: 'sair', rotulo: 'SAIR DA LUTA' },
]

export default class Pausa extends Phaser.Scene {
  constructor() {
    super('Pausa')
  }

  init(dados) {
    this.idChefe = dados.chefe
    this.nomeChefe = dados.nome ?? ''
  }

  create() {
    this.indice = 0
    this.confirmando = false // "SAIR" pede confirmação (segundo A)
    this.fechando = false

    const cx = LARGURA / 2
    const veu = this.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000).setOrigin(0).setAlpha(0)
    this.tweens.add({ targets: veu, alpha: 0.72, duration: 140 })

    const painel = this.add.container(cx, ALTURA / 2)
    const caixa = this.add.rectangle(0, 0, 300, 230, CORES.painel, 0.96).setStrokeStyle(3, CORES.caixa)
    const texto = (x, y, conteudo, tamanho, cor = TEXTO.normal) =>
      this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
    const titulo = texto(0, -84, 'PAUSA', 34, TEXTO.selecionado)
    const sub = texto(0, -54, this.nomeChefe ? `contra ${this.nomeChefe}` : '', 13, TEXTO.desabilitado)
    this.linhas = OPCOES.map((o, i) => texto(10, -12 + i * 36, o.rotulo, 18))
    this.cursor = this.add.image(0, 0, 'coracao').setTint(CORES.almas[0]).setScale(1.3)
    this.aviso = texto(0, 92, 'C / B: continuar     A: escolher', 12, TEXTO.desabilitado)
    painel.add([caixa, titulo, sub, ...this.linhas, this.cursor, this.aviso])

    // entra com um "soco" rápido
    painel.setScale(0.85).setAlpha(0)
    this.tweens.add({ targets: painel, scale: 1, alpha: 1, duration: 160, ease: 'Back.easeOut' })
    this.tweens.add({ targets: titulo, scale: 1.06, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => (botao === 'A' ? this.escolher() : this.continuar()))
    this.controles.onPausa(() => this.continuar())
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
    this.indice = (this.indice + passo + OPCOES.length) % OPCOES.length
    this.confirmando = false
    this.marcar(true)
  }

  marcar(comSom) {
    if (comSom) tocar(this, 'mover')
    this.linhas.forEach((l, i) => {
      l.setColor(i === this.indice ? TEXTO.selecionado : TEXTO.normal)
      if (OPCOES[i].id === 'sair') l.setText(this.confirmando && i === this.indice ? 'TEM CERTEZA? (A)' : OPCOES[i].rotulo)
    })
    const alvo = this.linhas[this.indice]
    this.cursor.setPosition(alvo.x - alvo.width / 2 - 18, alvo.y)
  }

  escolher() {
    if (this.fechando) return
    const opcao = OPCOES[this.indice].id
    if (opcao === 'continuar') return this.continuar()
    if (opcao === 'sair' && !this.confirmando) {
      this.confirmando = true
      tocar(this, 'erro')
      return this.marcar(false)
    }
    this.fechando = true
    tocar(this, 'confirmar')
    pararMusica()
    this.scene.stop('Entrada')
    this.scene.stop('Battle')
    if (opcao === 'recomecar') this.scene.start('Battle', { chefe: this.idChefe })
    else this.scene.start('Selecao')
  }

  continuar() {
    if (this.fechando) return
    this.fechando = true
    tocar(this, 'cancelar')
    this.scene.get('Battle')?.retomarDaPausa()
    this.scene.stop()
  }
}
