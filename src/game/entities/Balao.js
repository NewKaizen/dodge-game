import { FONTE, TEMPOS } from '../constants.js'
import { tocar } from '../audio.js'

const LARGURA_MAX = 170

// Balão de fala do chefe (com digitação). Fica na tela até `terminou`:
// passou TEMPOS.balaoMs depois de digitar tudo, ou alguém apertou A.
export default class Balao {
  constructor(scene) {
    this.scene = scene
    this.grafico = scene.add.graphics().setDepth(20)
    this.texto = scene.add
      .text(0, 0, '', { fontFamily: FONTE, fontSize: '14px', color: '#000000', wordWrap: { width: LARGURA_MAX - 16 } })
      .setDepth(21)
    this.completo = ''
    this.letras = 0
    this.acumulado = 0
    this.restante = 0
    this.esconder()
  }

  // (x, y): ponta do rabinho, do lado direito do balão
  mostrar(texto, x, y) {
    this.completo = texto
    this.letras = 0
    this.acumulado = 0
    this.restante = TEMPOS.balaoMs
    this.texto.setText(texto)
    const w = Math.min(LARGURA_MAX, this.texto.width + 18)
    const h = this.texto.height + 14
    const bx = x - 12 - w
    const by = y - h / 2

    this.grafico.clear()
    this.grafico.fillStyle(0xffffff, 1)
    this.grafico.lineStyle(2, 0x000000, 1)
    this.grafico.fillRoundedRect(bx, by, w, h, 6)
    this.grafico.strokeRoundedRect(bx, by, w, h, 6)
    this.grafico.fillTriangle(bx + w - 1, y - 6, x, y, bx + w - 1, y + 6)
    this.texto.setPosition(bx + 9, by + 7).setText('')
    this.grafico.setVisible(true)
    this.texto.setVisible(true)
  }

  get digitando() {
    return this.letras < this.completo.length
  }

  get terminou() {
    return !this.digitando && this.restante <= 0
  }

  atualizar(dt) {
    if (!this.grafico.visible) return
    if (!this.digitando) {
      this.restante -= dt
      return
    }
    this.acumulado += dt
    const novas = Math.floor(this.acumulado / TEMPOS.letraMs)
    if (!novas) return
    this.acumulado -= novas * TEMPOS.letraMs
    this.letras = Math.min(this.completo.length, this.letras + novas)
    this.texto.setText(this.completo.slice(0, this.letras))
    if (this.letras % 3 === 0) tocar(this.scene, 'texto')
  }

  // A: completa o texto ou fecha
  avancar() {
    if (this.digitando) {
      this.letras = this.completo.length
      this.texto.setText(this.completo)
    } else {
      this.restante = 0
    }
  }

  esconder() {
    this.grafico.setVisible(false)
    this.texto.setVisible(false)
  }
}
