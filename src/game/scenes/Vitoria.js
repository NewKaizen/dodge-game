import Phaser from 'phaser'
import Controles from '../controles.js'
import { CHEFES } from '../data/chefes/index.js'
import { criarFundo } from '../backgrounds/index.js'
import { ESCALA } from '../arte/texturas.js'
import { tocar, musica } from '../audio.js'
import { calcularRank, formatarTempo } from '../battle/estatisticas.js'
import { partyDe } from '../data/batalha.js'
import { fogoArtificio, canhoesConfete, chuvaConfete, raiosDeLuz, CORES_FESTA } from '../effects/festa.js'
import { shake } from '../effects/shake.js'
import { flashTela } from '../effects/flash.js'
import { FONTE, LARGURA, ALTURA, TEXTO, NIVEIS } from '../constants.js'

// Tela de vitória, em etapas com ritmo:
//   silêncio + luz crescendo -> ESTOURO (flash, confete, fogos) -> "VITÓRIA!"
//   batendo na tela -> party comemorando -> estatísticas rolando -> NOTA carimbada
// A ou B durante a animação pula para o fim. Depois:
//   A: lutar de novo com o mesmo chefe · B: escolher outro chefe

// Momentos da animação (ms desde o início da cena)
const TEMPO = {
  subida: 150, // sopro subindo + ponto de luz crescendo
  estouro: 750, // flash, confete, título
  musica: 1250, // música de vitória começa depois do impacto
  mensagem: 1150,
  party: 1350,
  painel: 1900,
  linha: 300, // intervalo entre as linhas de estatística
  rolar: 420, // quanto tempo cada número leva rolando
  pausaNota: 550, // suspense antes do carimbo
  opcoes: 900, // depois do carimbo
}

const PAINEL = { x: 196, y: 140, largura: 248, altura: 246, linhaY: 156, espaco: 23 }
const NOTA = { x: 548, y: 248 }
const COR_POUPADO = '#ffe040'
const COR_DERROTADO = '#ff4050'

const estilo = (tamanho, cor = TEXTO.normal, extra = {}) => ({
  fontFamily: FONTE,
  fontSize: `${tamanho}px`,
  color: cor,
  stroke: '#000000',
  strokeThickness: Math.max(3, Math.round(tamanho / 6)),
  ...extra,
})

const VAZIO = { danoCausado: 0, danoRecebido: 0, maiorGolpe: 0, combos: 0, grazes: 0, tpGasto: 0, tempoMs: 0, caidosNoFim: 0, hpMaxParty: 0 }

export default class Vitoria extends Phaser.Scene {
  constructor() {
    super('Vitoria')
  }

  create({ chefe, modo, turnos = 0, estatisticas = null, cena = 'Battle' }) {
    this.idChefe = chefe
    this.cenaLuta = cena // A: revanche nesta cena (CoopArena no CO-OP de cartas)
    this.def = CHEFES[chefe]
    this.modo = modo
    this.poupado = modo === 'spare'
    this.saindo = false
    this.liberado = false
    this.relogio = 0
    this.contadores = []
    this.ultimoTic = 0

    const nivel = estatisticas?.nivel ?? (NIVEIS[this.registry.get('nivel')] ? this.registry.get('nivel') : 'facil')
    this.stats = { ...VAZIO, ...estatisticas, turnos: estatisticas?.turnos ?? turnos, nivel }
    this.rank = calcularRank(this.stats, modo)

    this.criarCenario()
    this.etapas = this.montarEtapas()

    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => this.aoBotao(botao))
    this.cameras.main.fadeIn(300)
  }

  // ---------- cenário fixo ----------

  criarCenario() {
    this.fundo = criarFundo(this, this.def.fundo)
    this.fundo.escurecer(true)
    // véu escuro: começa quase preto (silêncio) e abre no estouro
    this.veu = this.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000).setOrigin(0).setDepth(-4).setAlpha(0.88)

    const corRaio = this.poupado ? 0xffe040 : 0xff9a40
    this.raios = raiosDeLuz(this, LARGURA / 2, 70, { cor: corRaio, alpha: 0.2, profundidade: -3 })
    // halo atrás do título
    this.halo = this.add.image(LARGURA / 2, 66, 'brilho').setScale(0).setTint(corRaio).setBlendMode(Phaser.BlendModes.ADD).setDepth(-1)
  }

  // ---------- linha do tempo ----------

  montarEtapas() {
    const e = []
    const em = (t, f) => e.push({ t, f })
    em(TEMPO.subida, (r) => this.subida(r))
    em(TEMPO.estouro, (r) => this.estouro(r))
    em(TEMPO.musica, () => musica(this, 'vitoria'))
    em(TEMPO.mensagem, (r) => this.mensagem(r))
    em(TEMPO.party, (r) => this.entrarParty(r))
    em(TEMPO.painel, (r) => this.abrirPainel(r))
    const linhas = this.linhasEstatisticas()
    linhas.forEach((linha, i) => em(TEMPO.painel + 250 + i * TEMPO.linha, (r) => this.mostrarLinha(linha, i, r)))
    const fimLinhas = TEMPO.painel + 250 + linhas.length * TEMPO.linha + TEMPO.rolar
    em(fimLinhas, (r) => this.prepararNota(r))
    em(fimLinhas + TEMPO.pausaNota, (r) => this.carimbar(r))
    em(fimLinhas + TEMPO.pausaNota + TEMPO.opcoes, (r) => this.liberar(r))
    return e.sort((a, b) => a.t - b.t)
  }

  // A ou B no meio da animação: roda tudo o que falta de uma vez
  pular() {
    this.pulando = true
    this.contadores.forEach((c) => c.isPlaying() && c.complete())
    while (this.etapas.length) this.etapas.shift().f(true)
    this.pulando = false
  }

  aoBotao(botao) {
    if (this.saindo) return
    if (!this.liberado) {
      if (this.etapas.length) this.pular()
      return
    }
    this.saindo = true
    tocar(this, 'confirmar')
    this.cameras.main.fadeOut(250, 0, 0, 0)
    this.time.delayedCall(260, () => this.scene.start(botao === 'A' ? this.cenaLuta : 'Selecao', { chefe: this.idChefe }))
  }

  // ---------- etapas ----------

  subida(rapido) {
    if (rapido) return
    tocar(this, 'subida')
    const dur = TEMPO.estouro - TEMPO.subida
    this.tweens.add({ targets: this.halo, scale: 1.6, duration: dur, ease: 'Quad.easeIn' })
    // faíscas sendo sugadas para o centro antes do estouro
    for (let i = 0; i < 22; i++) {
      const ang = Math.random() * Math.PI * 2
      const dist = Phaser.Math.Between(160, 300)
      const f = this.add
        .image(this.halo.x + Math.cos(ang) * dist, this.halo.y + Math.sin(ang) * dist, 'faisca')
        .setTint(Phaser.Utils.Array.GetRandom(CORES_FESTA))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(2.6)
        .setAlpha(0)
        .setDepth(-1)
      this.tweens.add({ targets: f, x: this.halo.x, y: this.halo.y, alpha: 1, scale: 0.8, delay: Math.random() * dur * 0.4, duration: dur * 0.6, ease: 'Cubic.easeIn', onComplete: () => f.destroy() })
    }
  }

  estouro(rapido) {
    if (!rapido) {
      tocar(this, 'estouroFesta')
      this.cameras.main.flash(260, 255, 255, 240)
      shake(this, 220, 0.012)
      for (let i = 0; i < 3; i++) this.time.delayedCall(i * 140, () => fogoArtificio(this, 120 + i * 200 + Phaser.Math.Between(-30, 30), Phaser.Math.Between(60, 150)))
    }
    canhoesConfete(this)
    this.tweens.add({ targets: this.veu, alpha: 0.5, duration: rapido ? 1 : 500 })
    this.tweens.add({ targets: this.raios, alpha: this.raios.getData('alpha'), duration: rapido ? 1 : 600 })
    this.tweens.killTweensOf(this.halo)
    this.halo.setScale(3.2).setAlpha(1)
    this.tweens.add({ targets: this.halo, scale: 2.4, alpha: 0.55, duration: 700, ease: 'Quad.easeOut' })
    this.tweens.add({ targets: this.halo, alpha: 0.35, delay: 700, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    // faíscas e estrelinhas subindo o tempo todo
    this.add
      .particles(0, ALTURA + 10, 'faisca', {
        x: { min: 0, max: LARGURA },
        speedY: { min: -120, max: -50 },
        speedX: { min: -15, max: 15 },
        lifespan: 3200,
        scale: { start: 1.3, end: 0 },
        tint: [0xffe040, 0xffffff, this.poupado ? 0x3cff6a : 0xff8a1a],
        frequency: 60,
        blendMode: 'ADD',
      })
      .setDepth(-2)
    this.add
      .particles(0, ALTURA + 10, 'estrela', {
        x: { min: 0, max: LARGURA },
        speedY: { min: -70, max: -30 },
        lifespan: 5000,
        rotate: { start: 0, end: 360 },
        scale: { start: 0.7, end: 0.1 },
        alpha: { start: 0.8, end: 0 },
        tint: CORES_FESTA,
        frequency: 380,
        blendMode: 'ADD',
      })
      .setDepth(-2)
    chuvaConfete(this, 1)

    // fogos de tempos em tempos, nas laterais (longe do painel)
    this.time.addEvent({
      delay: 900,
      loop: true,
      callback: () => {
        const lado = Math.random() < 0.5
        const x = lado ? Phaser.Math.Between(30, 170) : Phaser.Math.Between(470, 610)
        fogoArtificio(this, x, Phaser.Math.Between(40, 140), undefined, { quantidade: 28, profundidade: -1 })
        tocar(this, 'fogo')
      },
    })

    this.criarTitulo(rapido)
  }

  criarTitulo(rapido) {
    const cor = this.poupado ? TEXTO.selecionado : '#ffffff'
    // brilho: cópia em ADD atrás do título, pulsando
    this.tituloBrilho = this.add
      .text(LARGURA / 2, 66, 'VITÓRIA!', estilo(60, this.poupado ? '#fff0a0' : '#ffd0a0', { strokeThickness: 0 }))
      .setOrigin(0.5)
      .setDepth(9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
    this.titulo = this.add
      .text(LARGURA / 2, 66, 'VITÓRIA!', estilo(60, cor, { strokeThickness: 8 }))
      .setOrigin(0.5)
      .setDepth(10)
      .setShadow(0, 5, '#7a2a00', 0, true, false)
    if (!this.poupado) this.titulo.setTint(0xffffff, 0xffffff, 0xffd060, 0xffd060)

    const pulsar = () => {
      this.tweens.add({ targets: this.titulo, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      this.tweens.add({ targets: this.tituloBrilho, scale: 1.14, alpha: { from: 0.55, to: 0.1 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }
    if (rapido) return pulsar()

    // bate na tela: vem gigante e transparente, encolhe rápido e treme
    this.titulo.setScale(4).setAlpha(0).setAngle(-6)
    this.tweens.add({
      targets: this.titulo,
      scale: 1,
      alpha: 1,
      angle: 0,
      duration: 190,
      ease: 'Quad.easeIn',
      onComplete: () => {
        shake(this, 260, 0.018)
        tocar(this, 'fanfarra')
        this.tituloBrilho.setAlpha(1).setScale(1.4)
        this.tweens.add({ targets: this.tituloBrilho, scale: 1, alpha: 0.4, duration: 300, onComplete: pulsar })
        fogoArtificio(this, LARGURA / 2, 66, 0xffe040, { quantidade: 50, profundidade: 8 })
      },
    })
  }

  mensagem(rapido) {
    const nome = this.def.nome
    const texto = this.poupado ? `Vocês pouparam ${nome}. A gentileza venceu!` : `${nome} caiu! Ninguém segura essa dupla!`
    const t = this.add
      .text(LARGURA / 2, 114, texto, estilo(18, this.poupado ? TEXTO.cura : TEXTO.normal))
      .setOrigin(0.5)
      .setDepth(10)
    if (rapido) return
    t.setAlpha(0).setY(124)
    this.tweens.add({ targets: t, alpha: 1, y: 114, duration: 350, ease: 'Quad.easeOut' })
  }

  // Chefe (retrato à esquerda) e party comemorando embaixo dele
  entrarParty(rapido) {
    const chefe = this.add.image(108, 192, this.def.sprite).setScale(ESCALA.chefe * 0.62).setDepth(5)
    if (this.poupado) {
      this.tweens.add({ targets: chefe, y: 184, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      // coraçõezinhos subindo do chefe poupado
      this.add
        .particles(108, 168, 'coracao', {
          x: { min: -26, max: 26 },
          speedY: { min: -40, max: -20 },
          lifespan: 1600,
          scale: { start: 0.7, end: 0.2 },
          alpha: { start: 0.9, end: 0 },
          tint: [0xff6fa8, 0xffe040],
          frequency: 420,
        })
        .setDepth(5)
    } else {
      chefe.setTint(0x6a6a6a).setAlpha(0.6).setAngle(-12)
      this.tweens.add({ targets: chefe, angle: -9, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    }

    const chao = 358
    // a party que lutou (registry 'party'), lado a lado embaixo do chefe
    const party = partyDe(this.registry)
    const membros = party.map((id, i) => ({
      textura: this.textures.exists(id) ? id : 'coracao',
      x: 108 + (i - (party.length - 1) / 2) * Math.min(68, 150 / Math.max(1, party.length - 1)),
      atraso: i * 210,
    }))
    membros.forEach(({ textura, x, atraso }, i) => {
      const sombra = this.add.ellipse(x, chao + 2, 40, 10, 0x000000, 0.45).setDepth(4)
      const s = this.add.image(x, chao, textura).setOrigin(0.5, 1).setScale(ESCALA.personagem).setDepth(5)
      if (i === 1) s.setFlipX(true) // os dois virados um para o outro
      if (!rapido) {
        s.x -= 200
        sombra.x -= 200
        this.tweens.add({ targets: [s, sombra], x: `+=200`, duration: 420, delay: atraso * 0.5, ease: 'Back.easeOut' })
      }
      // pulinho de comemoração com esmagada ao cair
      const pulo = () => {
        this.tweens.chain({
          targets: s,
          loop: -1,
          loopDelay: 180,
          tweens: [
            { scaleY: ESCALA.personagem * 0.85, scaleX: ESCALA.personagem * 1.1, duration: 90, ease: 'Quad.easeOut' },
            { y: chao - 30, scaleY: ESCALA.personagem * 1.08, scaleX: ESCALA.personagem * 0.95, angle: i ? -8 : 8, duration: 230, ease: 'Quad.easeOut' },
            { y: chao, scaleY: ESCALA.personagem, scaleX: ESCALA.personagem, angle: 0, duration: 200, ease: 'Quad.easeIn' },
          ],
        })
        this.tweens.add({ targets: sombra, scaleX: 0.6, alpha: 0.2, duration: 320, yoyo: true, repeat: -1, repeatDelay: 200, delay: 90 })
      }
      this.time.delayedCall(rapido ? atraso : 450 + atraso, pulo)
    })
  }

  abrirPainel(rapido) {
    const { x, y, largura, altura } = PAINEL
    const g = this.add.graphics().setDepth(6)
    g.fillStyle(0x0b0914, 0.88).fillRoundedRect(0, 0, largura, altura, 8)
    g.lineStyle(3, 0xffffff, 1).strokeRoundedRect(0, 0, largura, altura, 8)
    g.lineStyle(1, this.rank.cor, 0.6).strokeRoundedRect(5, 5, largura - 10, altura - 10, 6)
    g.setPosition(x, y)
    if (rapido) return
    // abre do meio: começa achatado no centro e cresce para cima e para baixo
    g.setScale(1, 0).setY(y + altura / 2)
    this.tweens.add({ targets: g, scaleY: 1, y, duration: 260, ease: 'Back.easeOut' })
    tocar(this, 'voo')
  }

  linhasEstatisticas() {
    const s = this.stats
    const nivel = NIVEIS[s.nivel] ?? NIVEIS.facil
    return [
      { rotulo: 'Resultado', texto: this.poupado ? 'POUPADO' : 'DERROTADO', cor: this.poupado ? COR_POUPADO : COR_DERROTADO },
      { rotulo: 'Nível', texto: nivel.rotulo, cor: nivel.cor },
      { rotulo: 'Turnos', valor: s.turnos },
      { rotulo: 'Tempo', valor: Math.round(s.tempoMs / 1000), formatar: (v) => formatarTempo(v * 1000) },
      { rotulo: 'Dano causado', valor: s.danoCausado, cor: '#ffffff' },
      { rotulo: 'Maior golpe', valor: s.maiorGolpe, cor: TEXTO.selecionado },
      { rotulo: 'Combos perfeitos', valor: s.combos, cor: TEXTO.comando },
      { rotulo: 'Grazes', valor: s.grazes, cor: TEXTO.guarda },
      { rotulo: 'Dano recebido', valor: s.danoRecebido, cor: s.danoRecebido ? TEXTO.caido : TEXTO.cura },
      { rotulo: 'TP gasto', valor: s.tpGasto, formatar: (v) => `${v}%`, cor: TEXTO.comando },
    ]
  }

  mostrarLinha(linha, i, rapido) {
    const y = PAINEL.linhaY + i * PAINEL.espaco
    const esquerda = PAINEL.x + 16
    const direita = PAINEL.x + PAINEL.largura - 16
    const rotulo = this.add.text(esquerda, y, linha.rotulo, estilo(15, '#c8c8d8')).setOrigin(0, 0.5).setDepth(7)
    const formatar = linha.formatar ?? ((v) => String(v))
    const final = linha.texto ?? formatar(linha.valor)
    const valor = this.add.text(direita, y, rapido ? final : '', estilo(16, linha.cor ?? '#ffffff')).setOrigin(1, 0.5).setDepth(7)
    if (rapido) return

    rotulo.setAlpha(0).setX(esquerda - 14)
    this.tweens.add({ targets: rotulo, alpha: 1, x: esquerda, duration: 160, ease: 'Quad.easeOut' })

    if (linha.texto) {
      // texto (resultado, nível) entra carimbado, sem rolar
      valor.setText(final).setScale(1.8).setAlpha(0)
      this.tweens.add({ targets: valor, scale: 1, alpha: 1, duration: 170, delay: 80, ease: 'Quad.easeIn', onComplete: () => tocar(this, 'contadorFim') })
      return
    }
    const alvo = linha.valor
    if (!alvo) {
      valor.setText(final)
      this.time.delayedCall(80, () => tocar(this, 'contadorFim'))
      return
    }
    const contador = this.tweens.addCounter({
      from: 0,
      to: alvo,
      duration: TEMPO.rolar,
      ease: 'Quad.easeOut',
      onUpdate: (tw) => {
        valor.setText(formatar(Math.round(tw.getValue())))
        if (this.time.now - this.ultimoTic > 38) {
          this.ultimoTic = this.time.now
          tocar(this, 'contador')
        }
      },
      onComplete: () => {
        valor.setText(final)
        if (this.pulando) return
        tocar(this, 'contadorFim')
        valor.setScale(1.35)
        this.tweens.add({ targets: valor, scale: 1, duration: 150, ease: 'Quad.easeOut' })
      },
    })
    this.contadores.push(contador)
  }

  prepararNota(rapido) {
    if (!rapido) tocar(this, 'rufar')
    this.add.text(NOTA.x, NOTA.y - 96, 'NOTA', estilo(18, '#c8c8d8')).setOrigin(0.5).setDepth(7)
    // moldura tracejada onde o carimbo vai cair
    const g = this.add.graphics().setDepth(6)
    g.lineStyle(2, 0xffffff, 0.35)
    for (let a = 0; a < 360; a += 20) {
      const r1 = Phaser.Math.DegToRad(a)
      const r2 = Phaser.Math.DegToRad(a + 10)
      g.beginPath().arc(NOTA.x, NOTA.y, 62, r1, r2).strokePath()
    }
    if (!rapido) {
      g.setAlpha(0)
      this.tweens.add({ targets: g, alpha: 1, duration: 250 })
    }
  }

  carimbar(rapido) {
    const { letra, cor, texto, frase, pontos } = this.rank
    const c = this.add.container(NOTA.x, NOTA.y).setDepth(8)
    const brilho = this.add.image(0, 0, 'brilho').setTint(cor).setBlendMode(Phaser.BlendModes.ADD).setScale(2.4).setAlpha(0.5)
    const anel = this.add.graphics()
    anel.fillStyle(0x000000, 0.55).fillCircle(0, 0, 58)
    anel.lineStyle(6, cor, 1).strokeCircle(0, 0, 58)
    anel.lineStyle(2, cor, 0.8).strokeCircle(0, 0, 48)
    const letraTxt = this.add.text(0, 2, letra, estilo(92, texto, { strokeThickness: 8 })).setOrigin(0.5)
    c.add([brilho, anel, letraTxt])
    c.setAngle(-10)

    const legenda = this.add.text(NOTA.x, NOTA.y + 84, `${pontos} pts`, estilo(16, '#ffffff')).setOrigin(0.5).setDepth(7)
    const fraseTxt = this.add
      .text(NOTA.x, NOTA.y + 108, frase, estilo(15, texto, { align: 'center', wordWrap: { width: 170 } }))
      .setOrigin(0.5, 0)
      .setDepth(7)
    if (this.stats.danoRecebido <= 0) {
      this.add.text(NOTA.x, NOTA.y - 74, 'SEM DANO!', estilo(13, TEXTO.cura)).setOrigin(0.5).setDepth(9).setAngle(8)
    }

    const aposImpacto = () => {
      tocar(this, 'carimbo')
      shake(this, 240, 0.02)
      flashTela(this, cor, 0.35, 220)
      fogoArtificio(this, NOTA.x, NOTA.y, cor, { quantidade: 44, profundidade: 9 })
      // onda de choque
      const onda = this.add.circle(NOTA.x, NOTA.y, 58).setStrokeStyle(4, cor).setDepth(8)
      this.tweens.add({ targets: onda, scale: 2.2, alpha: 0, duration: 450, ease: 'Quad.easeOut', onComplete: () => onda.destroy() })
      if (letra === 'S') {
        this.time.delayedCall(120, () => tocar(this, 'brilhoRank'))
        for (let i = 0; i < 4; i++) this.time.delayedCall(200 + i * 160, () => fogoArtificio(this, NOTA.x + Phaser.Math.Between(-80, 80), NOTA.y + Phaser.Math.Between(-90, 40), undefined, { quantidade: 30, profundidade: 9 }))
      }
      this.tweens.add({ targets: brilho, scale: 2.8, alpha: 0.25, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      this.tweens.add({ targets: [legenda, fraseTxt], alpha: 1, duration: 250 })
    }

    legenda.setAlpha(0)
    fraseTxt.setAlpha(0)
    if (rapido) {
      aposImpacto()
      return
    }
    c.setScale(3.2).setAlpha(0).setAngle(-28)
    this.tweens.add({ targets: c, scale: 1, alpha: 1, angle: -10, duration: 200, ease: 'Quad.easeIn', onComplete: aposImpacto })
  }

  // depois de pular, espera um pouco: o mesmo toque em A não reinicia a luta sem querer
  liberar(rapido) {
    if (rapido) this.time.delayedCall(400, () => (this.liberado = true))
    else this.liberado = true
    const opcoes = this.add.text(LARGURA / 2, ALTURA - 26, 'A: lutar de novo     B: escolher chefe', estilo(16)).setOrigin(0.5).setDepth(10).setAlpha(0)
    this.tweens.add({
      targets: opcoes,
      alpha: 1,
      duration: 300,
      onComplete: () => this.tweens.add({ targets: opcoes, alpha: 0.45, duration: 550, yoyo: true, repeat: -1 }),
    })
    this.dicaPular?.destroy()
  }

  update(time, delta) {
    this.controles.atualizar()
    this.fundo.atualizar(delta)
    this.raios.rotation += delta * 0.00018

    this.relogio += delta
    while (this.etapas.length && this.relogio >= this.etapas[0].t) this.etapas.shift().f(false)

    if (!this.dicaPular && !this.liberado && this.relogio > TEMPO.painel) {
      this.dicaPular = this.add.text(LARGURA - 10, ALTURA - 10, 'A: pular', estilo(12, '#9090a0')).setOrigin(1, 1).setDepth(10)
    }
  }
}
