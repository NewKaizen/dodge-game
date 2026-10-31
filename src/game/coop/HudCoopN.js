import { CORES, FONTE, TEXTO, corTexto } from '../constants.js'
import { PERSONAGENS } from '../data/personagens.js'
import { CORES_CARTA } from '../entities/Carta.js'
import { ENERGIA, COMBO_PERFEITO, multiplicadorPerfeito } from '../pvp/regras.js'
import { desenharForma, formaDaVaga } from './marcadores.js'
import { corDaVaga } from '../vagas.js'
import { fatores } from '../acessibilidade.js'

// O placar de UM jogador no CO-OP de 3 e 4 (Fase 5B), em 854x480: quatro cartões de 190x62 no alto da
// tela, dois de cada lado do relógio (x 4, 198 | 466, 660). Cada cartão traz, de cima para baixo:
//   linha 1  a forma da vaga (a cor nunca é a única pista) + o NOME do jogador na cor dela; à direita o
//            ESTADO DA MÃO: ESCOLHENDO / PRONTO / PASSOU / CAÍDO volta em N / SEM CONEXÃO 12s / SAIU
//   linha 2  a barra de HP (cor do personagem, rastro branco do dano) e os números
//   linha 3  as gemas de energia (10) e o número
//   linha 4  o combo de perfeitos, o escudo / 2ª chance e as cartas da mão (5 retângulos)
// O cartão do jogador deste PC tem borda grossa na cor dele e "VOCÊ". Só visual: a cena passa os números.
//
//   const hud = new HudCoopN(cena, { vaga, n, nome, personagem, hpMax, meu })
//   hud.setHp(70) · setEnergia(5) · setSequencia(3) · comboQuebrou() · setEscudo(0.6) · setProtegido(true)
//   hud.setMao(5)                  quantas cartas na mão (retângulos acesos)
//   hud.setEstado('PRONTO', cor)   o estado da mão (linha 1, à direita); null apaga
//   hud.setAlvo(vaga)              o alvo (seta + forma + cor, sem nome); null apaga
//   hud.setApagado(true)           caído / sem conexão / saiu: cartão apagado
//   hud.tremer()                   levou um golpe
//   hud.pontoHp / hud.pontoEnergia onde soltar números flutuantes
export const CARTAO = { largura: 190, altura: 62, y: 2, colunas: [4, 198, 466, 660] }
const BARRA = { largura: 122, altura: 8 }
const GEMA = { passo: 9, raio: 3.4 }

export default class HudCoopN {
  constructor(cena, { vaga, n, nome, personagem, hpMax, meu = false }) {
    this.cena = cena
    this.vaga = vaga
    this.n = n
    this.hpMax = hpMax
    this.hp = hpMax
    this.energia = 0
    this.meu = meu
    this.sequencia = 0
    this.mao = 0
    this.escudo = null
    this.protegido = false
    const cor = corDaVaga(vaga)
    const def = PERSONAGENS[personagem]
    this.corBarra = def?.cor ?? 0xffffff
    // três jogadores: o terceiro vai para o lado direito (a metade esquerda tem dois, a direita um)
    const x0 = CARTAO.colunas[vaga] ?? CARTAO.colunas[3]
    const y0 = CARTAO.y
    this.x0 = x0
    this.y0 = y0

    const c = (this.container = cena.add.container(0, 0).setDepth(70))
    const texto = (x, y, conteudo, tamanho, corT, extra = {}) => cena.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: corT, stroke: '#000000', strokeThickness: 3, ...extra })

    const moldura = cena.add.graphics()
    moldura.fillStyle(0x0b0914, 0.82)
    moldura.fillRoundedRect(x0, y0, CARTAO.largura, CARTAO.altura, 5)
    moldura.lineStyle(meu ? 3 : 1.5, cor, meu ? 1 : 0.7)
    moldura.strokeRoundedRect(x0, y0, CARTAO.largura, CARTAO.altura, 5)
    this.moldura = moldura

    // linha 1: forma + nome (+ "você") e o estado da mão
    const forma = cena.add.graphics()
    desenharForma(forma, formaDaVaga(vaga), x0 + 12, y0 + 12, 5.2, cor)
    this.nome = texto(x0 + 22, y0 + 4, nome.toUpperCase(), 11, corTexto(cor)).setOrigin(0, 0)
    if (this.nome.width > 100) this.nome.setFontSize(9)
    this.voce = meu ? texto(this.nome.x + this.nome.width + 5, y0 + 7, 'VOCÊ', 7, '#ffffff', { strokeThickness: 2 }).setOrigin(0, 0) : null
    this.estado = texto(x0 + CARTAO.largura - 6, y0 + 6, '', 8, TEXTO.desabilitado, { strokeThickness: 2 }).setOrigin(1, 0)
    this.marcaAlvo = cena.add.graphics()

    // linha 2: HP
    const yb = y0 + 22
    this.xBarra = x0 + 6
    const fundo = cena.add.rectangle(this.xBarra - 1, yb - 1, BARRA.largura + 2, BARRA.altura + 2, 0x000000).setOrigin(0).setStrokeStyle(1, 0x5a4a7a)
    const vazio = cena.add.rectangle(this.xBarra, yb, BARRA.largura, BARRA.altura, CORES.hpFundo).setOrigin(0)
    this.rastro = cena.add.rectangle(this.xBarra, yb, BARRA.largura, BARRA.altura, 0xffffff).setOrigin(0)
    this.barra = cena.add.rectangle(this.xBarra, yb, BARRA.largura, BARRA.altura, this.corBarra).setOrigin(0)
    this.yBarra = yb
    this.textoHp = texto(this.xBarra + BARRA.largura + 6, yb - 2, '', 10, TEXTO.normal).setOrigin(0, 0)

    // linha 3: energia
    this.yGemas = y0 + 40
    this.gemas = cena.add.graphics()
    this.textoEnergia = texto(x0 + 6 + ENERGIA.maxima * GEMA.passo + 4, this.yGemas - 6, '', 10, '#7fd8ff').setOrigin(0, 0)

    // linha 4: combo / escudo à esquerda, mão à direita
    this.yLinha4 = y0 + 50
    this.textoCombo = texto(x0 + 6, this.yLinha4, '', 8, '#ffd23c', { strokeThickness: 2 }).setOrigin(0, 0).setVisible(false)
    this.textoEfeito = texto(x0 + 6, this.yLinha4, '', 8, TEXTO.guarda, { strokeThickness: 2 }).setOrigin(0, 0)
    this.cartas = cena.add.graphics()

    c.add([moldura, forma, this.nome, ...(this.voce ? [this.voce] : []), this.estado, this.marcaAlvo, fundo, vazio, this.rastro, this.barra, this.textoHp, this.gemas, this.textoEnergia, this.textoCombo, this.textoEfeito, this.cartas])
    this.setHp(hpMax, false)
    this.setEnergia(0, false)
    this.setMao(0)
  }

  get pontoHp() {
    return { x: this.xBarra + BARRA.largura / 2, y: this.y0 + 62 }
  }

  get pontoEnergia() {
    return { x: this.x0 + 6 + (ENERGIA.maxima * GEMA.passo) / 2, y: this.yGemas + 14 }
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
      this.barra.width = largura
      this.cena.tweens.add({ targets: this.rastro, width: largura, delay: 260, duration: 380, ease: 'Quad.easeIn' })
    } else {
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
      const x = this.x0 + 6 + GEMA.raio + i * GEMA.passo
      const y = this.yGemas
      const r = GEMA.raio
      const losango = (k) => [{ x, y: y - k }, { x: x + k * 0.86, y }, { x, y: y + k }, { x: x - k * 0.86, y }]
      if (i < energia) {
        g.fillStyle(CORES_CARTA.gemaEscura, 1)
        g.fillPoints(losango(r + 1), true)
        g.fillStyle(CORES_CARTA.gema, 1)
        g.fillPoints(losango(r - 0.4), true)
      } else {
        g.lineStyle(1, CORES.gemaVazia, 1)
        g.strokePoints(losango(r), true)
      }
    }
    this.textoEnergia.setText(String(energia))
    if (animado && energia !== antes) this.cena.tweens.add({ targets: this.textoEnergia, scale: { from: 1.5, to: 1 }, duration: 260, ease: 'Back.easeOut' })
  }

  setSequencia(sequencia, animado = true) {
    const antes = this.sequencia
    this.sequencia = sequencia
    const t = this.textoCombo
    this.cena.tweens.killTweensOf(t)
    t.setScale(1).setAlpha(1)
    if (!sequencia) {
      if (animado && antes && t.visible) this.cena.tweens.add({ targets: t, alpha: 0, duration: 220, onComplete: () => t.setVisible(false).setAlpha(1) })
      else t.setVisible(false)
      this.atualizarEfeito()
      return
    }
    const mult = multiplicadorPerfeito(sequencia)
    const maximo = mult >= COMBO_PERFEITO.teto
    t.setText(`PERFEITO x${mult}${maximo ? ' MÁX' : ''}`).setVisible(true).setColor(maximo ? '#ff9ae8' : mult >= 3 ? '#ffb02e' : '#ffd23c')
    if (animado && sequencia > antes) this.cena.tweens.add({ targets: t, scale: { from: 1.5, to: 1 }, duration: 320, ease: 'Back.easeOut' })
    this.atualizarEfeito()
  }

  comboQuebrou() {
    this.setSequencia(0, false)
    const t = this.cena.add.text(this.x0 + 6, this.yLinha4, 'COMBO QUEBROU', { fontFamily: FONTE, fontSize: '8px', color: '#ff6a7a', stroke: '#000000', strokeThickness: 2 }).setOrigin(0, 0)
    this.container.add(t)
    this.cena.tweens.add({ targets: t, alpha: 0, delay: 650, duration: 350, onComplete: () => t.destroy() })
  }

  setEscudo(fator) {
    this.escudo = fator
    this.atualizarEfeito()
  }

  setProtegido(valor) {
    this.protegido = valor
    this.atualizarEfeito()
  }

  // escudo / 2ª chance ocupam o lugar do combo (o combo aparece quando não há nenhum dos dois)
  atualizarEfeito() {
    const partes = []
    if (this.escudo != null) partes.push(`ESCUDO -${Math.round((1 - this.escudo) * 100)}%`)
    if (this.protegido) partes.push('2ª CHANCE')
    this.textoEfeito.setText(partes.join(' · ')).setColor(this.protegido ? '#ffe040' : TEXTO.guarda)
    this.textoCombo.setX(this.x0 + 6 + (partes.length ? this.textoEfeito.width + 8 : 0))
  }

  // as cartas da mão: 5 retângulos, os acesos são as que sobram na mão
  setMao(n) {
    this.mao = n
    const g = this.cartas
    g.clear()
    const w = 7
    const h = 10
    const x1 = this.x0 + CARTAO.largura - 6
    for (let i = 0; i < 5; i++) {
      const x = x1 - (5 - i) * (w + 2) + 2
      const acesa = i < n
      g.fillStyle(acesa ? 0xe8e0ff : 0x1a1626, acesa ? 0.95 : 0.9)
      g.fillRect(x, this.yLinha4, w, h)
      g.lineStyle(1, acesa ? 0xffffff : 0x5a4a7a, 1)
      g.strokeRect(x, this.yLinha4, w, h)
    }
  }

  // o estado da mão (ESCOLHENDO, PRONTO...) na linha 1
  setEstado(texto, cor = TEXTO.desabilitado) {
    this.estado.setText(texto ?? '').setColor(cor)
  }

  // o alvo de quem este cartão é (depois da escolha): uma seta + a forma e a cor do alvo, sem nome. null apaga
  setAlvo(vaga) {
    const g = this.marcaAlvo
    g.clear()
    if (vaga == null) return
    const cor = corDaVaga(vaga)
    const x = this.x0 + CARTAO.largura - 16
    const y = this.y0 + 11
    g.lineStyle(4, 0x000000, 0.9).lineBetween(x - 30, y, x - 12, y).lineBetween(x - 12, y, x - 18, y - 5).lineBetween(x - 12, y, x - 18, y + 5)
    g.lineStyle(2, 0xffffff, 0.95).lineBetween(x - 30, y, x - 12, y).lineBetween(x - 12, y, x - 18, y - 5).lineBetween(x - 12, y, x - 18, y + 5)
    desenharForma(g, formaDaVaga(vaga), x, y, 6, cor)
  }

  setApagado(apagado) {
    this.container.setAlpha(apagado ? 0.5 : 1)
  }

  tremer() {
    const c = this.container
    this.cena.tweens.killTweensOf(c)
    c.setPosition(0, 0)
    const px = 4 * fatores().tremor
    if (px > 0.2) this.cena.tweens.add({ targets: c, x: { from: px, to: 0 }, duration: 50, repeat: 2, yoyo: true, onComplete: () => c.setPosition(0, 0) })
    this.barra.setFillStyle(0xffffff)
    this.cena.time.delayedCall(90, () => this.barra.setFillStyle(this.corBarra))
  }
}

