import Phaser from 'phaser'
import { CORES, FONTE, TEXTO, LARGURA, corTexto } from '../constants.js'
import { PERSONAGENS } from '../data/personagens.js'
import { CORES_CARTA } from '../entities/Carta.js'
import { ENERGIA } from './regras.js'

// Selo "VELOCIDADE x1.24" da morte súbita (o mesmo do co-op): a arena põe um
// no alto, no meio, entre os dois placares (é da partida, não de um jogador)
export { IndicadorVelocidade } from '../entities/Hud.js'

// Placar de um jogador na arena PvP (canto de cima): P1/P2, nome do
// personagem na cor dele, barra de HP, gemas de energia e os estados de
// copas (escudo, segunda chance). O P1 fica à esquerda e o P2 à direita
// (espelhado). Só visual: a cena passa os números de regras.js.
//
//   const hud = new HudPvp(cena, { jogador: 0, personagem: 'kris', hpMax: 90, rotulo? })   rotulo: 'CPU' (padrão P1/P2)
//   hud.setHp(70)            barra anda (com o rastro branco do dano)
//   hud.setEnergia(5)        gemas acesas; as novas piscam
//   hud.setEscudo(0.6)       "ESCUDO -40%" (fator do dano; null apaga)
//   hud.setProtegido(true)   "SEGUNDA CHANCE"
//   hud.tremer()             levou um golpe
//   hud.pontoHp / hud.pontoEnergia   onde soltar números flutuantes
const BARRA = { largura: 176, altura: 10 }
const GEMA = { passo: 12, raio: 5 }
const MARGEM = 14

export default class HudPvp {
  constructor(cena, { jogador, personagem, hpMax, rotulo }) {
    this.cena = cena
    this.jogador = jogador
    this.hpMax = hpMax
    this.hp = hpMax
    this.energia = 0
    const def = PERSONAGENS[personagem]
    const corPersonagem = def?.cor ?? 0xffffff
    this.corBarra = corPersonagem
    const direita = jogador === 1
    this.direita = direita
    const s = direita ? -1 : 1 // sentido do crescimento (P2 cresce para a esquerda)
    const x0 = direita ? LARGURA - MARGEM : MARGEM
    this.x0 = x0
    this.s = s
    const origem = direita ? 1 : 0

    this.container = cena.add.container(0, 0).setDepth(70)
    const texto = (x, y, conteudo, tamanho, cor, extra = {}) =>
      cena.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, ...extra })

    const tag = texto(x0, 6, rotulo ?? `P${jogador + 1}`, 13, corTexto(CORES.almas[jogador])).setOrigin(origem, 0)
    const coracao = cena.add.image(x0 + s * (tag.width + 10), 13, 'coracao').setTint(CORES.almas[jogador]).setScale(0.9)
    this.nome = texto(x0 + s * (tag.width + 20), 4, (def?.nome ?? personagem).toUpperCase(), 16, corTexto(corPersonagem)).setOrigin(origem, 0)
    this.estado = texto(this.nome.x + s * (this.nome.width + 10), 8, '', 10, TEXTO.guarda).setOrigin(origem, 0)

    // barra de HP (fundo, rastro do dano e a barra em si)
    const yb = 28
    this.xBarra = direita ? x0 - BARRA.largura : x0
    const fundo = cena.add.rectangle(this.xBarra - 2, yb - 2, BARRA.largura + 4, BARRA.altura + 4, 0x000000).setOrigin(0).setStrokeStyle(1, 0x5a4a7a)
    const vazio = cena.add.rectangle(this.xBarra, yb, BARRA.largura, BARRA.altura, CORES.hpFundo).setOrigin(0)
    this.rastro = cena.add.rectangle(this.xBarra, yb, BARRA.largura, BARRA.altura, 0xffffff).setOrigin(0)
    this.barra = cena.add.rectangle(this.xBarra, yb, BARRA.largura, BARRA.altura, corPersonagem).setOrigin(0)
    if (direita) {
      // P2: a barra esvazia da esquerda para a direita (o cheio fica encostado na borda da tela)
      for (const r of [this.rastro, this.barra]) r.setOrigin(1, 0).setX(this.xBarra + BARRA.largura)
    }
    this.textoHp = texto(x0 + s * (BARRA.largura + 8), yb - 2, '', 12, TEXTO.normal).setOrigin(origem, 0)

    // gemas de energia (ENERGIA.maxima espaços)
    this.yGemas = 52
    this.gemas = cena.add.graphics()
    this.textoEnergia = texto(x0 + s * (ENERGIA.maxima * GEMA.passo + 6), this.yGemas - 7, '', 11, '#7fd8ff').setOrigin(origem, 0)

    this.container.add([fundo, vazio, this.rastro, this.barra, tag, coracao, this.nome, this.estado, this.textoHp, this.gemas, this.textoEnergia])
    this.escudo = null
    this.protegido = false
    this.setHp(hpMax, false)
    this.setEnergia(0, false)
  }

  get pontoHp() {
    return { x: this.xBarra + BARRA.largura / 2, y: 74 }
  }

  get pontoEnergia() {
    return { x: this.x0 + this.s * ((ENERGIA.maxima * GEMA.passo) / 2), y: this.yGemas + 14 }
  }

  objetos() {
    return [this.container]
  }

  setHp(hp, animado = true) {
    const antes = this.hp
    this.hp = hp
    const largura = Math.max(0, (BARRA.largura * hp) / this.hpMax)
    this.textoHp.setText(`${hp}/${this.hpMax}`)
    this.textoHp.setColor(hp <= this.hpMax * 0.25 ? TEXTO.caido : TEXTO.normal)
    this.cena.tweens.killTweensOf([this.barra, this.rastro])
    if (!animado) {
      this.barra.width = largura
      this.rastro.width = largura
      return
    }
    if (hp < antes) {
      // dano: a barra cai na hora e o rastro branco desce depois
      this.barra.width = largura
      this.cena.tweens.add({ targets: this.rastro, width: largura, delay: 260, duration: 380, ease: 'Quad.easeIn' })
    } else {
      // cura: o rastro (verde) vai na frente e a barra enche atrás
      this.rastro.setFillStyle(0x3cff6a)
      this.rastro.width = largura
      this.cena.tweens.add({ targets: this.barra, width: largura, duration: 420, ease: 'Cubic.easeOut', onComplete: () => this.rastro.setFillStyle(0xffffff) })
    }
  }

  setEnergia(energia, animado = true) {
    const antes = this.energia
    this.energia = energia
    const g = this.gemas
    g.clear()
    for (let i = 0; i < ENERGIA.maxima; i++) {
      const x = this.x0 + this.s * (GEMA.raio + i * GEMA.passo)
      const y = this.yGemas
      const r = GEMA.raio
      const losango = (k) => [{ x, y: y - k }, { x: x + k * 0.86, y }, { x, y: y + k }, { x: x - k * 0.86, y }]
      if (i < energia) {
        g.fillStyle(CORES_CARTA.gemaEscura, 1)
        g.fillPoints(losango(r + 1), true)
        g.fillStyle(CORES_CARTA.gema, 1)
        g.fillPoints(losango(r - 0.4), true)
        g.fillStyle(0xffffff, 0.7)
        g.fillPoints([{ x, y: y - r + 1 }, { x: x + 2, y: y - 1 }, { x, y }, { x: x - 2, y: y - 1 }], true)
      } else {
        g.lineStyle(1, 0x3a4a6a, 1)
        g.strokePoints(losango(r), true)
      }
    }
    this.textoEnergia.setText(String(energia))
    if (animado && energia !== antes) {
      this.cena.tweens.add({ targets: this.textoEnergia, scale: { from: 1.6, to: 1 }, duration: 260, ease: 'Back.easeOut' })
      // brilho nas gemas novas
      for (let i = Math.min(antes, energia); i < Math.max(antes, energia); i++) {
        const x = this.x0 + this.s * (GEMA.raio + i * GEMA.passo)
        const b = this.cena.add.image(x, this.yGemas, 'brilho').setTint(energia > antes ? 0x7fd8ff : 0xff5a70).setScale(0.3).setAlpha(0.9).setDepth(71)
        b.setBlendMode(Phaser.BlendModes.ADD)
        this.cena.tweens.add({ targets: b, scale: 0.6, alpha: 0, duration: 420, delay: (i - Math.min(antes, energia)) * 50, onComplete: () => b.destroy() })
      }
    }
  }

  setEscudo(fator) {
    this.escudo = fator
    this.atualizarEstado()
  }

  setProtegido(valor) {
    this.protegido = valor
    this.atualizarEstado()
  }

  atualizarEstado() {
    const partes = []
    if (this.escudo != null) partes.push(`ESCUDO -${Math.round((1 - this.escudo) * 100)}%`)
    if (this.protegido) partes.push('2ª CHANCE')
    this.estado.setText(partes.join(' · '))
    this.estado.setColor(this.protegido ? '#ffe040' : TEXTO.guarda)
  }

  tremer() {
    const c = this.container
    this.cena.tweens.killTweensOf(c)
    c.setPosition(0, 0)
    this.cena.tweens.add({ targets: c, x: { from: this.s * 4, to: 0 }, duration: 50, repeat: 2, yoyo: true, onComplete: () => c.setPosition(0, 0) })
    this.barra.setFillStyle(0xffffff)
    this.cena.time.delayedCall(90, () => this.barra.setFillStyle(this.corBarra))
  }
}
