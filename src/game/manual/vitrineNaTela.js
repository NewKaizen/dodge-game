import { ajustarCamera, RES } from '../resolucao.js'
import { criarMotorDaVitrine, CAIXA_VITRINE } from './vitrine.js'

// A vitrine na tela: o motor de manual/vitrine.js (o ataque real da carta) + uma câmera só para a região
// do mundo onde ele roda, desenhada em cima do cartão do boneco, na escala do cartão.
//
//   const v = new VitrineDeAtaque(cena, { tela: { x, y, largura, altura } })   (proporção de CAIXA_VITRINE)
//   v.rodar(plano) · v.atualizar(dt) · v.parar() · v.destruir() · v.bonecoNaTela · v.motor
export class VitrineDeAtaque {
  // tela: onde a caixa aparece na tela { x, y, largura, altura } (mesma proporção de CAIXA_VITRINE)
  constructor(cena, { tela }) {
    this.cena = cena
    this.tela = tela
    this.escala = tela.largura / CAIXA_VITRINE.largura
    this.motor = criarMotorDaVitrine(cena)
    this.camera = cena.cameras.add().setVisible(false)
    this.ajustar()
  }

  // onde o boneco aparece na tela
  get bonecoNaTela() {
    const l = this.motor.caixa.limites
    const b = this.motor.boneco
    return { x: this.tela.x + (b.x - l.left) * this.escala, y: this.tela.y + (b.y - l.top) * this.escala }
  }

  ajustar() {
    const t = this.tela
    const l = this.motor.caixa.limites
    ajustarCamera(this.camera, t.x, t.y, t.largura, t.altura).setZoom(RES.escala * this.escala)
    this.camera.setScroll(l.left, l.top)
  }

  rodar(plano) {
    this.ajustar()
    this.camera.setVisible(true)
    return this.motor.rodar(plano)
  }

  atualizar(dt) {
    this.ajustar() // a janela pode ter mudado de tamanho (resolucao.js recria o zoom)
    this.motor.passo(dt)
    if (!this.motor.rodando) this.camera.setVisible(false)
  }

  parar() {
    this.motor.parar()
    this.camera.setVisible(false)
  }

  // no shutdown da cena (o Phaser já destrói as câmeras da cena sozinho)
  destruir() {
    this.motor.parar()
  }
}
