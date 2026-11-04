import { criarRng } from '../pvp/baralho.js'
import { setaGiz } from './giz.js'
import { PALETA } from './cera.js'
import { Balao, RalseiDesenhado, assarCamadas, imagemDeCera } from './paginaBase.js'

// O TREINADOR da página 5 do Manual do Ralsei: um Ralsei de giz pequenininho no canto da arena de verdade
// (scenes/ManualRalsei5Partida.js), com um balão que mostra a dica do momento (manual/dicasDaPartida.js) e
// uma seta de giz apontando para o que a dica fala (a sua vida, a energia, o PASSAR, a caixa).
// Nunca trava: é só desenho por cima do HUD. Texto na fonte clara (o Balao do caderno).
// "Reduzir animações": entra e sai sem deslizar, balão inteiro de uma vez, seta parada, Ralsei parado.
//
//   const t = new Treinador(cena, { calmo, alvos: { vida: { de, para }, ... }, profundidade })
//   t.mostrar(dica)   { texto, alvo } (alvo: uma chave de `alvos`, ou null)
//   t.esconder()
//   t.update(tempo, delta)
//   t.objetos         o que a cena desenha (para conferir em testes)

// o canto: embaixo à direita (o lado da CPU, que é o próprio Ralsei; a sua mão e a sua caixa ficam livres)
export const CANTO = { ralsei: { x: 812, y: 470, escala: 0.4 }, balao: { x: 512, y: 356, largura: 270, altura: 74, tamanho: 14 } }

export class Treinador {
  constructor(cena, { calmo = false, alvos = {}, profundidade = 150 } = {}) {
    this.cena = cena
    this.calmo = calmo
    this.alvos = alvos
    this.visivel = false
    this.alvo = null
    const b = CANTO.balao
    const r = CANTO.ralsei
    this.balao = new Balao(cena, { ...b, chave: 'manual-p5-treinador-balao', calmo, cauda: { de: b.x + b.largura - 60, x: r.x - 30, y: r.y - 24, largura: 20 } })
    this.caixaBalao = cena.add.container(0, 0, this.balao.objetos).setDepth(profundidade).setVisible(false)
    this.ralsei = new RalseiDesenhado(cena, r.x, r.y, { calmo, escala: r.escala })
    this.ralsei.container.setDepth(profundidade)
    // uma seta de giz por alvo (amarela com sombra escura: lê em cima da arena escura)
    this.setas = {}
    for (const [id, a] of Object.entries(alvos)) {
      const tracos = setaGiz(criarRng(`treinador:${id}`), a.de.x, a.de.y, a.para.x, a.para.y, { tremor: 0.8, ponta: 12 })
      const info = assarCamadas(
        cena,
        `manual-p5-seta-${id}`,
        [
          { tipo: 'traco', tracos, cor: 0x1a1426, largura: 7, passadas: 2, alpha: 0.85 },
          { tipo: 'traco', tracos, cor: PALETA.amarelo, largura: 4, passadas: 2 },
        ],
        { grao: 0.25, margem: 6 },
      )
      const img = imagemDeCera(cena, 0, 0, info).setDepth(profundidade).setVisible(false)
      const len = Math.hypot(a.para.x - a.de.x, a.para.y - a.de.y) || 1
      this.setas[id] = { img, dx: (a.para.x - a.de.x) / len, dy: (a.para.y - a.de.y) / len }
    }
  }

  get objetos() {
    return [this.caixaBalao, this.ralsei.container, ...Object.values(this.setas).map((s) => s.img)]
  }

  mostrar(dica) {
    this.visivel = true
    this.balao.dizer(dica.texto)
    this.caixaBalao.setVisible(true)
    this.ralsei.setExpressao('animado')
    for (const s of Object.values(this.setas)) s.img.setVisible(false)
    this.alvo = dica.alvo && this.setas[dica.alvo] ? dica.alvo : null
    const seta = this.alvo && this.setas[this.alvo].img.setVisible(true)
    const alvos = [this.caixaBalao, ...(seta ? [seta] : [])]
    this.cena.tweens.killTweensOf(alvos)
    if (this.calmo) return alvos.forEach((o) => o.setAlpha(1))
    this.caixaBalao.setAlpha(0).setX(24)
    this.cena.tweens.add({ targets: this.caixaBalao, alpha: 1, x: 0, duration: 200, ease: 'Cubic.easeOut' })
    if (seta) {
      seta.setAlpha(0)
      this.cena.tweens.add({ targets: seta, alpha: 1, duration: 200 })
    }
  }

  esconder() {
    if (!this.visivel) return
    this.visivel = false
    this.ralsei.setExpressao('feliz')
    const alvos = [this.caixaBalao, ...Object.values(this.setas).map((s) => s.img)]
    this.cena.tweens.killTweensOf(alvos)
    const sumir = () => alvos.forEach((o) => o.setVisible(false))
    if (this.calmo) return sumir()
    this.cena.tweens.add({ targets: alvos, alpha: 0, duration: 180, onComplete: sumir })
  }

  update(tempo, delta) {
    this.balao.update(tempo, delta, false)
    this.ralsei.update(tempo)
    // a seta "cutuca" o alvo (vai e volta na direção dele); parada no modo calmo
    const s = this.alvo && this.setas[this.alvo]
    if (s && !this.calmo) {
      const k = Math.sin(tempo / 140) * 3
      s.img.setPosition(s.dx * k, s.dy * k)
    }
  }
}
