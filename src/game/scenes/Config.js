import Phaser from 'phaser'
import { get } from 'svelte/store'
import Controles from '../controles.js'
import { criarFundo } from '../backgrounds/index.js'
import { tocar } from '../audio.js'
import { CORES, CORACAO, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'
import { jogo } from '../../lib/estado.js'
import { alternarTelaCheia } from '../../lib/telaCheia.js'

// Configurações: volumes, som, velocidade do coração e tela cheia (salvas no
// navegador, ver lib/estado.js), mais a lista de teclas.
//   scene.start('Config', { voltar: 'Menu' })   tela própria; B volta para `voltar`
//   scene.launch('Config', { sobre: 'Pausa' })  por cima de uma cena pausada
//                                               (no fim ela é retomada)
//   cima/baixo escolher · ←/→ ajustar (segure para ir rápido) · A alterna · B/C volta
const VELOCIDADE = { min: 60, max: 400, passo: 10 }
const REPETIR = { espera: 320, intervalo: 55 } // segurar ←/→
const LARGURA_BARRA = 170

const ITENS = [
  { id: 'musica', rotulo: 'MÚSICA', tipo: 'barra' },
  { id: 'efeitos', rotulo: 'EFEITOS', tipo: 'barra' },
  { id: 'som', rotulo: 'SOM', tipo: 'liga' },
  { id: 'velocidade', rotulo: 'VELOCIDADE DO CORAÇÃO', tipo: 'barra' },
  { id: 'telaCheia', rotulo: 'TELA CHEIA', tipo: 'liga' },
  { id: 'voltar', rotulo: 'VOLTAR', tipo: 'acao' },
]

const TECLAS = [
  'P1   mover: WASD   A: Espaço / Z / E   B: Q / X   pausa: C / Esc',
  'P2   mover: setas   A: Enter   B: Shift direito   pausa: P',
  'F: tela cheia (Esc sai)',
]

export default class Config extends Phaser.Scene {
  constructor() {
    super('Config')
  }

  init(dados) {
    this.sobre = dados?.sobre ?? null
    this.voltarPara = dados?.voltar ?? 'Menu'
  }

  create() {
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => (botao === 'A' ? this.apertarA() : botao === 'B' && this.sair()))
    this.controles.onPausa(() => this.sair())
    this.indice = 0
    this.saindo = false
    this.segurando = null

    if (this.sobre) {
      this.scene.bringToTop() // por cima da cena de onde veio (a Pausa também foi trazida para frente)
      const veu = this.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000).setOrigin(0).setAlpha(0)
      this.tweens.add({ targets: veu, alpha: 0.6, duration: 140 })
    } else {
      this.fundo = criarFundo(this, 'queen')
      this.fundo.escurecer(true)
      this.cameras.main.fadeIn(220)
    }

    const texto = (x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) =>
      this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 4, ...extra })

    const painel = this.add.container(LARGURA / 2, ALTURA / 2)
    const caixa = this.add.rectangle(0, 0, 560, 420, CORES.painel, 0.95).setStrokeStyle(3, CORES.caixa)
    const titulo = texto(0, -184, 'CONFIGURAÇÕES', 30, TEXTO.selecionado).setOrigin(0.5)
    painel.add([caixa, titulo])

    const x0 = -230
    const xValor = 40
    this.linhas = ITENS.map((item, i) => {
      const y = -128 + i * 38
      const rotulo = texto(x0 + 24, y, item.rotulo, 17).setOrigin(0, 0.5)
      const valor = texto(xValor, y, '', 16).setOrigin(0, 0.5)
      const barra = item.tipo === 'barra' ? this.add.graphics() : null
      painel.add([rotulo, valor, ...(barra ? [barra] : [])])
      return { item, y, rotulo, valor, barra }
    })

    const separador = this.add.graphics()
    separador.lineStyle(1, 0xffffff, 0.15).lineBetween(-250, 106, 250, 106)
    const tituloTeclas = texto(-250, 116, 'CONTROLES', 12, TEXTO.desabilitado, { strokeThickness: 0 })
    const teclas = TECLAS.map((t, i) => texto(-250, 136 + i * 18, t, 12, '#b8b8c8', { strokeThickness: 0 }))
    const dica = texto(0, 196, 'cima/baixo: escolher    ←/→: ajustar    A: alternar    B: voltar', 11, TEXTO.desabilitado, { strokeThickness: 0 }).setOrigin(0.5)
    this.cursor = this.add.image(x0 + 6, 0, 'coracao').setTint(CORES.almas[0]).setScale(1.3)
    painel.add([separador, tituloTeclas, ...teclas, dica, this.cursor])

    painel.setScale(0.9).setAlpha(0)
    this.tweens.add({ targets: painel, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' })

    // a tela cheia pode mudar por fora (tecla F, Esc do navegador)
    const aoMudarTela = () => this.desenhar()
    document.addEventListener('fullscreenchange', aoMudarTela)
    this.events.once('shutdown', () => document.removeEventListener('fullscreenchange', aoMudarTela))

    this.desenhar()
  }

  // ---------- valores ----------

  get estado() {
    return get(jogo)
  }

  valorDe(id) {
    const s = this.estado
    if (id === 'musica') return s.volume.musica
    if (id === 'efeitos') return s.volume.efeitos
    if (id === 'som') return s.som
    if (id === 'velocidade') return s.velocidade
    if (id === 'telaCheia') return Boolean(document.fullscreenElement)
    return null
  }

  // fração 0..1 da barra
  fracao(id) {
    const v = this.valorDe(id)
    if (id === 'velocidade') return (v - VELOCIDADE.min) / (VELOCIDADE.max - VELOCIDADE.min)
    return v / 100
  }

  ajustar(passo) {
    const { id, tipo } = ITENS[this.indice]
    if (tipo === 'liga') return this.alternar(id)
    if (tipo !== 'barra') return
    const antes = this.valorDe(id)
    if (id === 'velocidade') {
      const v = Phaser.Math.Clamp(antes + passo * VELOCIDADE.passo, VELOCIDADE.min, VELOCIDADE.max)
      if (v !== antes) jogo.update((s) => ({ ...s, velocidade: v }))
    } else {
      const v = Phaser.Math.Clamp(antes + passo * 5, 0, 100)
      if (v !== antes) jogo.update((s) => ({ ...s, volume: { ...s.volume, [id]: v } }))
    }
    if (this.valorDe(id) !== antes) tocar(this, id === 'efeitos' ? 'cartaSelecionar' : 'mover')
    this.desenhar()
  }

  alternar(id) {
    if (id === 'som') jogo.update((s) => ({ ...s, som: !s.som }))
    if (id === 'telaCheia') alternarTelaCheia()
    tocar(this, 'confirmar')
    this.desenhar()
  }

  apertarA() {
    if (this.saindo) return
    const { id, tipo } = ITENS[this.indice]
    if (tipo === 'acao') return this.sair()
    if (tipo === 'liga') return this.alternar(id)
    // A numa barra: a velocidade volta para a padrão
    if (id === 'velocidade') {
      jogo.update((s) => ({ ...s, velocidade: CORACAO.velocidadePadrao }))
      tocar(this, 'confirmar')
      this.desenhar()
    }
  }

  sair() {
    if (this.saindo) return
    this.saindo = true
    tocar(this, 'cancelar')
    if (this.sobre) {
      this.scene.stop()
      this.scene.resume(this.sobre)
      return
    }
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => this.scene.start(this.voltarPara))
  }

  // ---------- desenho ----------

  desenhar() {
    this.linhas.forEach((l, i) => {
      const { id, tipo } = l.item
      const ativo = i === this.indice
      l.rotulo.setColor(ativo ? TEXTO.selecionado : TEXTO.normal)
      if (tipo === 'barra') {
        const v = this.valorDe(id)
        const largura = Math.round(LARGURA_BARRA * this.fracao(id))
        const mudo = id !== 'velocidade' && !this.estado.som
        l.barra.clear()
        l.barra.fillStyle(0xffffff, 0.1).fillRect(40, l.y - 6, LARGURA_BARRA, 12)
        l.barra.fillStyle(mudo ? 0x606070 : ativo ? CORES.selecionado : 0x6dd0ff, 1).fillRect(40, l.y - 6, largura, 12)
        l.barra.lineStyle(1, 0xffffff, ativo ? 0.7 : 0.25).strokeRect(40, l.y - 6, LARGURA_BARRA, 12)
        const padrao = id === 'velocidade' && v === CORACAO.velocidadePadrao
        l.valor.setText(id === 'velocidade' ? `${v}${padrao ? ' (padrão)' : ''}` : `${v}%`).setX(40 + LARGURA_BARRA + 12)
        l.valor.setColor(mudo ? TEXTO.desabilitado : TEXTO.normal)
      } else if (tipo === 'liga') {
        const ligado = this.valorDe(id)
        l.valor.setText(ligado ? '◀ LIGADO ▶' : '◀ DESLIGADO ▶').setColor(ligado ? '#7fe08a' : '#ff7a7a').setX(40)
      } else {
        l.valor.setText('')
      }
    })
    this.cursor.setY(this.linhas[this.indice].y)
  }

  update(time, delta) {
    this.controles.atualizar()
    this.fundo?.atualizar(delta)
    if (this.saindo) return
    for (let j = 0; j < this.controles.numJogadores; j++) {
      const d = this.controles.toque(j)
      if (d === 'cima' || d === 'baixo') {
        this.indice = (this.indice + (d === 'cima' ? -1 : 1) + ITENS.length) % ITENS.length
        tocar(this, 'mover')
        this.desenhar()
      }
      if (d === 'esquerda' || d === 'direita') {
        const passo = d === 'direita' ? 1 : -1
        this.ajustar(passo)
        this.segurando = { j, passo, proximo: time + REPETIR.espera }
      }
    }
    // segurando ←/→ numa barra: repete
    const s = this.segurando
    if (s) {
      const x = this.controles.joy(s.j).x
      if (Math.sign(x) !== s.passo || Math.abs(x) < 50) this.segurando = null
      else if (time >= s.proximo && ITENS[this.indice].tipo === 'barra') {
        this.ajustar(s.passo)
        s.proximo = time + REPETIR.intervalo
      }
    }
    this.cursor.setX(-230 + 6 + Math.sin(time / 180) * 2)
  }
}
