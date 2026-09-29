import Phaser from 'phaser'
import { FONTE, LAYOUT, TEXTO, TEMPOS } from '../constants.js'
import { tocar } from '../audio.js'

const LINHA = 18

// Caixa de texto de baixo (borda branca grossa). Mostra uma mensagem com
// efeito de digitação ou colunas de menu, uma por jogador.
export default class TextBox {
  constructor(scene) {
    this.scene = scene
    this.area = LAYOUT.textbox
    const { x, y, largura, altura } = this.area
    scene.add.rectangle(x, y, largura, altura, 0x000000).setOrigin(0).setStrokeStyle(4, 0xffffff).setDepth(1)
    this.objetos = []
    this.digitando = null
  }

  limpar() {
    this.objetos.forEach((o) => o.destroy())
    this.objetos = []
    this.digitando = null
  }

  mensagem(texto) {
    this.limpar()
    const alvo = this.texto(this.area.x + 18, this.area.y + 14, '', this.area.largura - 36, TEXTO.normal, 17)
    this.digitando = { alvo, completo: texto, letras: 0, acumulado: 0 }
  }

  get digitandoAinda() {
    return !!this.digitando && this.digitando.letras < this.digitando.completo.length
  }

  completar() {
    const d = this.digitando
    if (!d) return
    d.letras = d.completo.length
    d.alvo.setText(d.completo)
  }

  atualizar(dt) {
    const d = this.digitando
    if (!d || d.letras >= d.completo.length) return
    d.acumulado += dt
    const novas = Math.floor(d.acumulado / TEMPOS.letraMs)
    if (!novas) return
    d.acumulado -= novas * TEMPOS.letraMs
    const antes = d.letras
    d.letras = Math.min(d.completo.length, d.letras + novas)
    d.alvo.setText(d.completo.slice(0, d.letras))
    if (Math.floor(d.letras / 2) !== Math.floor(antes / 2) && d.completo[d.letras - 1] !== ' ') tocar(this.scene, 'texto')
  }

  // Cada coluna:
  //   { titulo?, cor?, texto }                                         texto livre
  //   { titulo?, cor?, itens: [{ texto, direita?, desabilitado? }], cursor, corCursor?, rodape? }
  colunas(lista) {
    this.limpar()
    const w = this.area.largura / lista.length

    lista.forEach((col, i) => {
      const cx = this.area.x + 18 + i * w
      let cy = this.area.y + 10
      if (i > 0) this.objetos.push(this.scene.add.rectangle(this.area.x + i * w, this.area.y + 10, 2, this.area.altura - 20, 0x505050).setOrigin(0).setDepth(2))
      if (col.titulo) {
        this.texto(cx, cy, col.titulo, w - 30, col.cor ?? TEXTO.normal, 15)
        cy += 20
      }
      if (col.texto !== undefined) {
        this.texto(cx, cy, col.texto, w - 30, TEXTO.normal, 15)
        return
      }

      const reservado = (col.titulo ? 20 : 0) + (col.rodape ? 20 : 0) + 14
      const visiveis = Math.max(1, Math.floor((this.area.altura - reservado) / LINHA))
      const inicio = Phaser.Math.Clamp(col.cursor - visiveis + 1, 0, Math.max(0, col.itens.length - visiveis))
      col.itens.slice(inicio, inicio + visiveis).forEach((item, k) => {
        const selecionado = inicio + k === col.cursor
        const cor = item.desabilitado ? TEXTO.desabilitado : selecionado ? TEXTO.selecionado : TEXTO.normal
        const ly = cy + k * LINHA
        if (selecionado) {
          const coracao = this.scene.add.image(cx + 5, ly + 8, 'coracao').setTint(col.corCursor ?? 0xff2030).setDepth(2)
          this.objetos.push(coracao)
        }
        this.texto(cx + 18, ly, item.texto, w - 90, cor, 15)
        if (item.direita) this.texto(cx + w - 34, ly, item.direita, 60, cor, 15).setOrigin(1, 0)
      })
      // setas de rolagem, à direita do custo/quantidade
      if (inicio > 0) this.texto(cx + w - 23, cy + 2, '▲', 20, TEXTO.desabilitado, 10).setOrigin(1, 0)
      if (inicio + visiveis < col.itens.length) this.texto(cx + w - 23, cy + (visiveis - 1) * LINHA + 6, '▼', 20, TEXTO.desabilitado, 10).setOrigin(1, 0)
      if (col.rodape) this.texto(cx, this.area.y + this.area.altura - 26, col.rodape, w - 30, TEXTO.desabilitado, 13)
    })
  }

  texto(x, y, conteudo, largura, cor = TEXTO.normal, tamanho = 15, estilo = 'normal') {
    const t = this.scene.add
      .text(x, y, conteudo, {
        fontFamily: FONTE,
        fontSize: `${tamanho}px`,
        fontStyle: estilo,
        color: cor,
        wordWrap: { width: largura },
      })
      .setDepth(2)
    this.objetos.push(t)
    return t
  }
}
