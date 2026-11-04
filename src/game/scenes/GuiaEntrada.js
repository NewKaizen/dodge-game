import Phaser from 'phaser'
import Controles from '../controles.js'
import { tocar, musica } from '../audio.js'
import { irCarregando } from '../carregando.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'
import { pref } from '../preferencias.js'
import { resumoDoIndice, paginaParaRetomar, PAGINAS } from '../manual/progresso.js'

// Menu -> GUIA: a porta de entrada dos dois guias, com a música do tutorial ("Caderno do Ralsei").
//   modo 'guia'    MANUAL DO RALSEI (abre o índice) · CARTAS E ARENAS (cena Grimorio, o guia de antes)
//   modo 'indice'  o índice do manual: CONTINUAR (a 1ª página que falta) e cada página, com ✓ nas
//                  completas e os adesivos da página 2. O progresso vem de manual/progresso.js.
//   ↑/↓ escolhe · A abre · B volta (do índice para o guia, do guia para o Menu)
// Dados: { modo: 'indice' } abre direto no índice (é para onde o B do manual volta).
const GUIA = [
  { rotulo: 'MANUAL DO RALSEI', cor: '#ffd23a', indice: true, dica: 'um caderno desenhado a giz: aprenda mexendo no coração' },
  { rotulo: 'CARTAS E ARENAS', cor: '#b48cff', cena: 'Grimorio', dica: 'todas as cartas e as rodadas bônus das arenas' },
]
const DICAS_PAGINA = {
  1: 'o seu coração, as marcas e um desvio curtinho',
  2: 'ler os ataques: chuva, linha, mira e uma mistura',
}

// as linhas do índice (lógica pura sobre o progresso salvo)
export function opcoesDoIndice(progresso) {
  const resumo = resumoDoIndice(progresso)
  const retomar = paginaParaRetomar(progresso)
  const comecou = resumo.some((r) => r.completa || r.comecada)
  const linhas = []
  if (retomar && comecou) linhas.push({ rotulo: `CONTINUAR · PÁGINA ${retomar}`, cor: '#7dffa0', cena: PAGINAS[retomar - 1].cena, dica: 'volta de onde você parou' })
  for (const r of resumo) {
    const adesivos = r.total > 1 && (r.comecada || r.completa) ? ` · adesivos: ${r.adesivos} de ${r.total}` : ''
    linhas.push({ rotulo: `PÁGINA ${r.pagina} · ${r.titulo.toUpperCase()}`, cor: '#ffd23a', cena: r.cena, completa: r.completa, dica: `${DICAS_PAGINA[r.pagina]}${adesivos}${r.completa ? ' · jogar de novo' : ''}`, recomecar: r.completa })
  }
  return linhas
}

// A instância da cena é REAPROVEITADA pelo Phaser: tudo volta ao inicial no começo do init().
const estadoInicial = () => ({
  modo: 'guia',
  opcoes: null,
  indice: 0,
  saindo: false,
  linhas: null,
  marcas: null,
  titulo: null,
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
    this.controles = new Controles(this)
    this.controles.onBotao((j, botao) => (botao === 'A' ? this.abrir() : this.voltar()))
    this.controles.onPausa(() => this.voltar())
    this.titulo = this.add.text(LARGURA / 2, 70, '', estilo(34, '#b48cff')).setOrigin(0.5)
    this.seta = this.add.image(0, 0, 'coracao').setTint(CORES.almas[0]).setScale(1.6)
    this.dica = this.add.text(LARGURA / 2, 390, '', { ...estilo(13, '#9a9ab0'), strokeThickness: 3 }).setOrigin(0.5)
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
    const passo = indice ? 56 : 64
    const y0 = indice ? 170 : 190
    this.linhas = this.opcoes.map((o, i) => this.add.text(LARGURA / 2, y0 + i * passo, o.rotulo, estilo(indice ? 22 : 26, o.cor)).setOrigin(0.5))
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
    this.dica.setText(this.opcoes[this.indice].dica)
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
