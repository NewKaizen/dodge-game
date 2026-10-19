import { LARGURA, ALTURA, FONTE } from '../../constants.js'
import { tocar } from '../../audio.js'
import { ajustarCamera } from '../../resolucao.js'

// "APERTE DE NOVO PARA PULAR": pular a câmera lenta / o replay do fim da
// partida pede DOIS apertos (o protocolo do painel só avisa quando o botão é
// apertado, não quando solta: não dá para "segurar"). O primeiro mostra este
// aviso no canto de baixo, com uma barra que esvazia; o segundo, antes da
// barra acabar, pula. Assim quem aperta A/B uma vez sem querer (comemorando,
// ou ainda atacando no duelo) não perde o replay.
//
// Fica numa região do mundo longe de tudo (PULAR.longe), vista por uma câmera
// própria que se mantém em cima de todas (as da transmissão são criadas
// depois, durante o aviso). Montado só no primeiro aperto (com a fonte do
// jogo já carregada; a maioria das partidas nem usa).
//
//   const aviso = new AvisoPular(cena)
//   aviso.apertar()      true = foi o segundo aperto (pule agora)
//   aviso.atualizar(dt)  todo frame (dt real)
//   aviso.esconder()
//   aviso.destruir()
export const PULAR = {
  janelaMs: 1600, // tempo para o segundo aperto
  intervaloMs: 160, // o segundo aperto só vale depois disto (dois toques de um mesmo aperto não contam)
  longe: { x: -40000, y: 40000 },
}

const CAIXA = { largura: 196, altura: 40, margem: 14, baixo: 64 } // baixo: distância da base da tela (acima do placar da TV)

export default class AvisoPular {
  constructor(cena) {
    this.cena = cena
    this.idade = 0
    this.armado = false
    this.camera = null
    this.raiz = null
  }

  montar() {
    const cena = this.cena
    const { x: X, y: Y } = PULAR.longe
    this.camera = ajustarCamera(cena.cameras.add()).setScroll(X, Y).setVisible(false)
    const x = LARGURA - CAIXA.margem - CAIXA.largura / 2
    const y = ALTURA - CAIXA.baixo
    this.raiz = cena.add.container(X + x, Y + y).setDepth(2000).setVisible(false)
    const { largura: w, altura: h } = CAIXA
    const fundo = cena.add.graphics()
    fundo.fillStyle(0x0b0b12, 0.88).fillRoundedRect(-w / 2, -h / 2, w, h, 5)
    fundo.lineStyle(2, 0xffd23a, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 5)
    const texto = (ty, t, tamanho, cor) => cena.add.text(0, ty, t, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor }).setOrigin(0.5)
    this.titulo = texto(-8, 'A / B DE NOVO', 14, '#ffd23a')
    const sub = texto(8, 'para pular  ▶▶', 10, '#ffffff')
    this.barra = cena.add.rectangle(-w / 2 + 6, h / 2 - 5, w - 12, 3, 0xffd23a).setOrigin(0, 0.5)
    this.raiz.add([fundo, this.titulo, sub, this.barra])
  }

  // true = segundo aperto dentro da janela
  apertar() {
    if (this.armado && this.idade >= PULAR.intervaloMs) {
      this.esconder()
      return true
    }
    if (this.armado) return false
    if (!this.raiz) this.montar()
    this.armado = true
    this.idade = 0
    this.noTopo()
    this.camera.setVisible(true)
    this.raiz.setVisible(true).setScale(1.25)
    this.barra.setScale(1, 1)
    tocar(this.cena, 'cartaSelecionar')
    return false
  }

  // a câmera do aviso desenha por último (a transmissão cria câmeras depois dela)
  noTopo() {
    const lista = this.cena.cameras.cameras
    if (lista[lista.length - 1] === this.camera) return
    const i = lista.indexOf(this.camera)
    if (i >= 0) lista.splice(i, 1)
    lista.push(this.camera)
  }

  atualizar(dt) {
    if (!this.armado) return
    this.idade += dt
    const resto = Math.max(0, 1 - this.idade / PULAR.janelaMs)
    this.barra.setScale(resto, 1)
    // entra "batendo" (no relógio real: os tweens da arena andam devagar na câmera lenta)
    this.raiz.setScale(1 + 0.25 * Math.max(0, 1 - this.idade / 140))
    // pisca de leve no fim da janela
    this.titulo.setAlpha(resto < 0.3 ? 0.55 + 0.45 * Math.abs(Math.sin(this.idade / 70)) : 1)
    this.noTopo()
    this.camera.setVisible(true) // a transmissão esconde as câmeras que achar ao entrar no ar
    if (resto <= 0) this.esconder()
  }

  esconder() {
    this.armado = false
    if (!this.raiz?.scene) return
    this.raiz.setVisible(false)
    this.camera.setVisible(false)
  }

  destruir() {
    this.armado = false
    if (this.raiz?.scene) this.raiz.destroy()
    if (this.camera) this.cena.cameras?.remove(this.camera)
  }
}
