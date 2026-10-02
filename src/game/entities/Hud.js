import { CORES, TEXTO, FONTE, LAYOUT, TP, corTexto } from '../constants.js'
import { ESCALA } from '../arte/texturas.js'
import { ignorarNasCaixas } from '../recorte.js'

const ICONE = {
  FIGHT: 'icone-fight',
  ACT: 'icone-act',
  MAGIC: 'icone-magic',
  ITEM: 'icone-item',
  SPARE: 'icone-spare',
  DEFEND: 'icone-defend',
}
const BOTAO = { largura: 52, altura: 22 }

// Painéis da party (ícone, nome, HP e botões de comando) e a barra de TP
export default class Hud {
  constructor(scene, party, numJogadores) {
    this.scene = scene
    this.tempo = 0
    this.tpAlvo = 0
    this.tpExibido = 0
    this.previa = 0

    const { x, y, largura, altura } = LAYOUT.paineis
    const w = largura / party.length
    const texto = (tx, ty, conteudo, tamanho, cor = TEXTO.normal, extra = {}) =>
      scene.add.text(tx, ty, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, ...extra })

    this.paineis = party.map((m, i) => {
      const px = x + i * w
      scene.add.rectangle(px + 3, y, w - 6, altura, CORES.painel).setOrigin(0).setStrokeStyle(2, m.cor)
      const icone = scene.textures.exists(`icone-${m.id}`) ? `icone-${m.id}` : 'coracao' // personagem sem ícone ainda
      scene.add.image(px + 24, y + 14, icone).setScale(ESCALA.icone)
      const nome = texto(px + 46, y + 4, m.nome.toUpperCase(), 16, corTexto(m.cor))
      if (numJogadores > 1) {
        texto(nome.x + nome.width + 8, y + 7, `P${m.jogador + 1}`, 13, corTexto(CORES.almas[m.jogador]))
      }
      const hp = texto(px + w - 14, y + 5, '', 14).setOrigin(1, 0)
      const larguraBarra = w - 62
      scene.add.rectangle(px + 46, y + 24, larguraBarra, 6, CORES.hpFundo).setOrigin(0)
      const barra = scene.add.rectangle(px + 46, y + 24, larguraBarra, 6, m.cor).setOrigin(0)

      const n = m.comandos.length
      const passo = (w - 22 - BOTAO.largura) / Math.max(1, n - 1)
      const botoes = m.comandos.map((c, k) => {
        const bx = px + 11 + k * passo
        const by = y + 42
        const brilho = scene.add.rectangle(bx - 3, by - 3, BOTAO.largura + 6, BOTAO.altura + 6, CORES.selecionado).setOrigin(0).setAlpha(0)
        const caixa = scene.add.rectangle(bx, by, BOTAO.largura, BOTAO.altura, 0x000000).setOrigin(0).setStrokeStyle(2, CORES.comando)
        const icone = scene.add.image(bx + 10, by + BOTAO.altura / 2, ICONE[c.rotulo] ?? ICONE[c.tipo])
        const rotulo = texto(bx + 19, by + BOTAO.altura / 2, c.rotulo, c.rotulo.length > 5 ? 9 : 10).setOrigin(0, 0.5)
        return { brilho, caixa, icone, rotulo, selecionado: false }
      })
      const cursor = scene.add.image(0, 0, 'coracao').setDepth(3).setVisible(false)
      return { nome, hp, barra, botoes, cursor }
    })

    const t = LAYOUT.tp
    this.alturaTp = t.altura - 4
    this.baseTp = t.y + t.altura - 2
    texto(t.x + t.largura / 2, t.y - 22, 'TP', 17, TEXTO.comando).setOrigin(0.5, 0)
    scene.add.rectangle(t.x, t.y, t.largura, t.altura, 0x000000).setOrigin(0).setStrokeStyle(2, 0xffffff)
    this.tpBarra = scene.add.rectangle(t.x + 2, this.baseTp, t.largura - 4, this.alturaTp, CORES.tp).setOrigin(0, 1).setScale(1, 0)
    this.tpPrevia = scene.add.rectangle(t.x + 2, this.baseTp, t.largura - 4, this.alturaTp, CORES.tpPrevia).setOrigin(0, 1).setVisible(false)
    this.tpTexto = texto(t.x + t.largura / 2, t.y + t.altura + 4, '0%', 13).setOrigin(0.5, 0)
  }

  // estado.escolhendo: Map(membro -> { cursor, cor }) de quem está escolhendo comando
  // estado.desabilitados: Map(membro -> Set de tipos de comando indisponíveis)
  // estado.previa: custo de TP do ACT/magia com o cursor em cima
  atualizar(party, tp, { escolhendo = new Map(), desabilitados = new Map(), previa = 0 } = {}) {
    party.forEach((m, i) => {
      const p = this.paineis[i]
      p.hp.setText(`HP ${m.hp}/${m.max}`).setColor(m.caido ? TEXTO.caido : TEXTO.normal)
      p.nome.setColor(m.caido ? TEXTO.caido : corTexto(m.cor))
      p.barra.setScale(Math.max(0, m.hp) / m.max, 1)

      const sel = escolhendo.get(m)
      const bloqueados = desabilitados.get(m)
      p.cursor.setVisible(false)
      p.botoes.forEach((b, k) => {
        const tipo = m.comandos[k].tipo
        const selecionado = sel !== undefined && sel.cursor === k
        const escolhido = sel === undefined && m.acao?.tipo === tipo
        let cor = CORES.comando
        if (bloqueados?.has(tipo)) cor = 0x606060
        if (selecionado) cor = CORES.selecionado
        else if (escolhido) cor = 0xffffff
        b.selecionado = selecionado
        b.caixa.setStrokeStyle(2, cor)
        b.icone.setTint(cor).setVisible(!selecionado)
        b.rotulo.setColor(corTexto(cor))
        const alpha = sel !== undefined || escolhido ? 1 : 0.35
        ;[b.caixa, b.icone, b.rotulo].forEach((o) => o.setAlpha(alpha))
        if (!selecionado) b.brilho.setAlpha(0)
        if (selecionado) p.cursor.setPosition(b.icone.x, b.icone.y).setTint(sel.cor).setVisible(true)
      })
    })
    this.tpAlvo = tp
    this.previa = previa
  }

  // Animações por frame: TP enchendo, MAX piscando, brilho do botão
  tick(dt) {
    this.tempo += dt
    this.tpExibido += (this.tpAlvo - this.tpExibido) * Math.min(1, dt / 90)
    if (Math.abs(this.tpAlvo - this.tpExibido) < 0.2) this.tpExibido = this.tpAlvo
    const cheio = this.tpAlvo >= TP.max
    this.tpBarra.setScale(1, this.tpExibido / TP.max).setFillStyle(cheio ? CORES.tpMax : CORES.tp)

    if (this.previa > 0 && this.previa <= this.tpAlvo) {
      this.tpPrevia
        .setVisible(true)
        .setY(this.baseTp - ((this.tpAlvo - this.previa) / TP.max) * this.alturaTp)
        .setScale(1, this.previa / TP.max)
        .setAlpha(0.45 + 0.35 * Math.sin(this.tempo / 90))
    } else {
      this.tpPrevia.setVisible(false)
    }

    if (cheio) {
      this.tpTexto.setText('MAX').setColor(Math.sin(this.tempo / 110) > 0 ? TEXTO.selecionado : TEXTO.normal)
    } else {
      this.tpTexto.setText(`${Math.floor(this.tpAlvo)}%`).setColor(TEXTO.normal)
    }

    const brilho = 0.2 + 0.2 * Math.sin(this.tempo / 140)
    for (const p of this.paineis) for (const b of p.botoes) if (b.selecionado) b.brilho.setAlpha(brilho)
  }
}

// Selo pequeno e fixo com o fator da morte súbita (ACELERACAO em constants.js):
// "VELOCIDADE x1.24". Escondido enquanto o fator é 1. Usado no co-op (Battle)
// e na arena PvP.
//
//   const ind = new IndicadorVelocidade(cena, x, y, { origem: [0.5, 0], tamanho: 11 })
//   ind.set(1.24)   mostra (com um pulo quando o valor muda)
export class IndicadorVelocidade {
  constructor(cena, x, y, { origem = [0.5, 0], tamanho = 11, profundidade = 70 } = {}) {
    this.cena = cena
    this.fator = 1
    this.texto = cena.add
      .text(x, y, '', { fontFamily: FONTE, fontSize: `${tamanho}px`, color: '#ff9a3a', stroke: '#000000', strokeThickness: 3 })
      .setOrigin(...origem)
      .setDepth(profundidade)
      .setVisible(false)
    ignorarNasCaixas(cena, this.texto)
  }

  set(fator, animado = true) {
    const mudou = fator !== this.fator
    this.fator = fator
    this.texto.setVisible(fator > 1.001)
    this.texto.setText(`VELOCIDADE x${fator.toFixed(2)}`)
    if (!animado || !mudou || fator <= 1.001) return
    const t = this.texto
    this.cena.tweens.killTweensOf(t)
    t.setScale(1).setColor('#ffffff')
    this.cena.tweens.add({ targets: t, scale: { from: 1.8, to: 1 }, duration: 320, ease: 'Back.easeOut', onComplete: () => t.setColor('#ff9a3a') })
  }
}
