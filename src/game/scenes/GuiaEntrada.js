import Phaser from 'phaser'
import { molduraArcade } from '../tema.js'
import Controles from '../controles.js'
import { tocar, musica } from '../audio.js'
import { irCarregando } from '../carregando.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'
import { pref } from '../preferencias.js'
import { essencialCompleto } from '../manual/progresso.js'
import { opcoesDoIndice } from '../manual/indice.js'
import { semLigaduras } from '../campanha/texto.js'

// Menu -> GUIA: a porta de entrada dos dois guias, com a música do tutorial ("Caderno do Ralsei").
//   modo 'guia'    MANUAL DO RALSEI (abre o índice) · CARTAS E ARENAS (cena Grimorio, o guia de antes)
//   modo 'indice'  o índice do manual: CONTINUAR (a 1ª página que falta) e cada página, com ✓ nas
//                  completas e os adesivos das páginas 2 a 4; quem terminou a página 5 (a partida de verdade)
//                  ganha o selo "★ MANUAL ESSENCIAL ✓" embaixo do título. Depois das 5 essenciais vêm os 4 EXTRAS
//                  (páginas 6 a 9: naipes, graze, jogar em dupla, ases/SUPER/perfeitos), marcados "EXTRA" e em azul:
//                  oferecidos, nunca forçados (o CONTINUAR é do essencial; só puxa para um extra já começado quando
//                  o essencial está completo). O progresso vem de manual/progresso.js.
//   ↑/↓ escolhe · A abre · B volta (do índice para o guia, do guia para o Menu)
// Dados: { modo: 'indice' } abre direto no índice (é para onde o B do manual volta).
const GUIA = [
  { rotulo: 'MANUAL DO RALSEI', cor: '#ffd23a', indice: true, dica: 'um caderno desenhado a giz: aprenda mexendo no coração' },
  { rotulo: 'CARTAS E ARENAS', cor: '#b48cff', cena: 'Grimorio', dica: 'todas as cartas e as rodadas bônus das arenas' },
]
// A instância da cena é REAPROVEITADA pelo Phaser: tudo volta ao inicial no começo do init().
const estadoInicial = () => ({
  modo: 'guia',
  opcoes: null,
  indice: 0,
  saindo: false,
  linhas: null,
  marcas: null,
  titulo: null,
  selo: null,
  seta: null,
  dica: null,
  rodape: null,
  controles: null,
})

export default class GuiaEntrada extends Phaser.Scene {
  constructor() {
    super('GuiaEntrada')
  }

  init(dados) {
    Object.assign(this, estadoInicial())
    if (dados?.modo === 'indice') this.modo = 'indice'
  }

  create() {
    this.cameras.main.setBackgroundColor(CORES.fundo)
    molduraArcade(this)
    this.controles = new Controles(this)
    this.controles.onBotao((j, botao) => (botao === 'A' ? this.abrir() : this.voltar()))
    this.controles.onPausa(() => this.voltar())
    this.titulo = this.add.text(LARGURA / 2, 70, '', estilo(34, '#b48cff')).setOrigin(0.5)
    this.selo = this.add.text(LARGURA / 2, 104, '★ MANUAL ESSENCIAL ✓', { ...estilo(14, '#ffd23a'), strokeThickness: 4 }).setOrigin(0.5).setVisible(false)
    this.seta = this.add.image(0, 0, 'coracao').setTint(CORES.almas[0]).setScale(1.6)
    this.dica = this.add.text(LARGURA / 2, 424, '', { ...estilo(13, '#9a9ab0'), strokeThickness: 3, align: 'center', wordWrap: { width: LARGURA - 60 } }).setOrigin(0.5)
    this.rodape = this.add.text(LARGURA / 2, ALTURA - 20, '', { ...estilo(12, '#c8c8d8'), strokeThickness: 3 }).setOrigin(0.5)
    this.montar()
    this.cameras.main.fadeIn(200)
    musica('tutorial', 'menu')
  }

  // (re)monta a lista do modo atual
  montar() {
    for (const o of [...(this.linhas ?? []), ...(this.marcas ?? [])]) o.destroy()
    const indice = this.modo === 'indice'
    this.opcoes = indice ? opcoesDoIndice(pref('manual')) : GUIA
    this.titulo.setText(indice ? 'MANUAL DO RALSEI' : 'GUIA').setColor(indice ? '#ffd23a' : '#b48cff')
    this.selo.setVisible(indice && essencialCompleto(pref('manual')))
    // com os extras o índice tem até 10 linhas: mais apertado e com letra menor
    const cheio = indice && this.opcoes.length > 8
    const passo = cheio ? 29 : indice ? 40 : 64
    const y0 = cheio ? 132 : indice ? 150 + (6 - this.opcoes.length) * 18 : 190
    this.linhas = this.opcoes.map((o, i) => this.add.text(LARGURA / 2, y0 + i * passo, semLigaduras(o.rotulo), estilo(cheio ? 16 : indice ? 20 : 26, o.cor)).setOrigin(0.5))
    // ✓ verde nas páginas completas
    this.marcas = this.opcoes.flatMap((o, i) => (o.completa ? [this.add.text(this.linhas[i].x + this.linhas[i].width / 2 + 14, this.linhas[i].y, '✓', estilo(24, TEXTO.cura ?? '#7dffa0')).setOrigin(0, 0.5)] : []))
    this.rodape.setText(indice ? '↑↓ escolher      A: abrir a página      B: voltar' : '↑↓ escolher      A: abrir      B: voltar')
    this.indice = Math.min(this.indice, this.opcoes.length - 1)
    this.atualizar()
  }

  atualizar() {
    this.linhas.forEach((l, i) => l.setAlpha(i === this.indice ? 1 : 0.5))
    const l = this.linhas[this.indice]
    this.seta.setPosition(l.x - l.width / 2 - 28, l.y)
    this.dica.setText(semLigaduras(this.opcoes[this.indice].dica))
  }

  update() {
    this.controles.atualizar()
    if (this.saindo) return
    // qualquer jogador local navega (como no Menu)
    for (let j = 0; j < this.controles.numJogadores; j++) {
      const t = this.controles.toque(j)
      if (t !== 'cima' && t !== 'baixo') continue
      const n = this.opcoes.length
      this.indice = (this.indice + (t === 'baixo' ? 1 : n - 1)) % n
      tocar(this, 'mover')
      this.atualizar()
      break
    }
  }

  abrir() {
    if (this.saindo) return
    const o = this.opcoes[this.indice]
    tocar(this, 'confirmar')
    if (o.indice) {
      this.modo = 'indice'
      this.indice = 0
      this.montar()
      return
    }
    this.saindo = true
    if (o.cena === 'Grimorio') musica('menu', 'jevil') // o guia de cartas toca a música do menu
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => irCarregando(this, o.cena, o.recomecar ? { recomecar: true } : undefined))
  }

  voltar() {
    if (this.saindo) return
    tocar(this, 'cancelar')
    if (this.modo === 'indice') {
      this.modo = 'guia'
      this.indice = 0
      this.montar()
      return
    }
    this.saindo = true
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => this.scene.start('Menu'))
  }
}

function estilo(tamanho, cor) {
  return { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 5 }
}
