import Phaser from 'phaser'
import Controles from '../controles.js'
import { PERSONAGENS } from '../data/personagens.js'
import { criarFundo } from '../backgrounds/index.js'
import Carta from '../entities/Carta.js'
import { tocar, musica } from '../audio.js'
import { fogoArtificio, canhoesConfete, chuvaConfete, raiosDeLuz, CORES_FESTA } from '../effects/festa.js'
import { shake } from '../effects/shake.js'
import { TEXTO_JOGADOR } from '../pvp/perfil.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO, corTexto } from '../constants.js'

// Tela de fim da partida PvP, em etapas (como a Vitoria):
//   luz crescendo -> ESTOURO + "JOGADOR 1 VENCE!" (ou 2, ou EMPATE) na cor do
//   vencedor -> vencedor comemorando e perdedor caído -> estatísticas dos dois
//   lado a lado, rolando com contador.
// A ou B durante a animação pula para o fim. Depois:
//   A: REVANCHE (mesmos personagens) · B: TROCAR PERSONAGENS (PvpEscolha)
//
// Recebe de PvpArena:
//   { vencedor: 1 | 2 | 0 (empate), p1, p2, rodadas,
//     estatisticas: { p1: {...}, p2: {...} } }  (também aceita { 1, 2 })  por jogador: danoCausado,
//     danoRecebido, cartasJogadas, maiorCarta ({ naipe, valor, nome } ou null), grazes, ases

const TEMPO = {
  subida: 120,
  estouro: 650,
  musica: 1150,
  lutadores: 900,
  painel: 1500,
  linha: 280, // intervalo entre as linhas de estatística
  rolar: 420, // quanto tempo cada número leva rolando
  opcoes: 500, // depois da última linha
}

const PAINEL = { x: 140, y: 118, largura: 360, altura: 290, linhaY: 176, espaco: 40 }
const COLUNA = [PAINEL.x + 64, PAINEL.x + PAINEL.largura - 64] // centro dos valores do P1 e do P2
const LUTADOR = { x: [70, LARGURA - 70], chao: 318, escala: 4 }
const COR_EMPATE = '#c8c8d8'

const VAZIO = { danoCausado: 0, danoRecebido: 0, cartasJogadas: 0, maiorCarta: null, grazes: 0, ases: 0 }

const estilo = (tamanho, cor = TEXTO.normal, extra = {}) => ({
  fontFamily: FONTE,
  fontSize: `${tamanho}px`,
  color: cor,
  stroke: '#000000',
  strokeThickness: Math.max(3, Math.round(tamanho / 6)),
  ...extra,
})

// Linhas de estatística; `menor`: o menor valor é o melhor (dano recebido)
const LINHAS = [
  { chave: 'danoCausado', rotulo: 'Dano causado' },
  { chave: 'danoRecebido', rotulo: 'Dano recebido', menor: true },
  { chave: 'cartasJogadas', rotulo: 'Cartas jogadas' },
  { chave: 'maiorCarta', rotulo: 'Maior carta', carta: true },
  { chave: 'grazes', rotulo: 'Grazes' },
  { chave: 'ases', rotulo: 'Ases jogados' },
]

export default class PvpResultado extends Phaser.Scene {
  constructor() {
    super('PvpResultado')
  }

  create(dados = {}) {
    const salvo = this.registry.get('pvp') ?? {}
    this.p1 = PERSONAGENS[dados.p1] ? dados.p1 : salvo.p1 ?? 'kris'
    this.p2 = PERSONAGENS[dados.p2] ? dados.p2 : salvo.p2 ?? 'susie'
    this.vencedor = [1, 2].includes(dados.vencedor) ? dados.vencedor : 0
    this.empate = this.vencedor === 0
    this.rodadas = dados.rodadas ?? 0
    this.contraCpu = Boolean(dados.cpu) // partida contra a CPU: o P2 aparece como CPU
    this.stats = [1, 2].map((j) => ({ ...VAZIO, ...(dados.estatisticas?.[`p${j}`] ?? dados.estatisticas?.[j]) })) // a arena manda { p1, p2 }
    this.corTitulo = this.empate ? COR_EMPATE : TEXTO_JOGADOR[this.vencedor - 1]
    this.corNumero = this.empate ? 0xc8c8d8 : CORES.almas[this.vencedor - 1]

    this.saindo = false
    this.liberado = false
    this.relogio = 0
    this.contadores = []
    this.ultimoTic = 0

    this.criarCenario()
    this.etapas = this.montarEtapas()

    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => this.aoBotao(botao))
    this.cameras.main.fadeIn(300)
  }

  // ---------- cenário fixo ----------

  criarCenario() {
    this.fundo = criarFundo(this, 'queen')
    this.fundo.escurecer(true)
    this.veu = this.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000).setOrigin(0).setDepth(-4).setAlpha(0.9)
    this.raios = raiosDeLuz(this, LARGURA / 2, 52, { cor: this.corNumero, alpha: this.empate ? 0.08 : 0.2, profundidade: -3 })
    this.halo = this.add.image(LARGURA / 2, 52, 'brilho').setScale(0).setTint(this.corNumero).setBlendMode(Phaser.BlendModes.ADD).setDepth(-1)
  }

  // ---------- linha do tempo ----------

  montarEtapas() {
    const e = []
    const em = (t, f) => e.push({ t, f })
    em(TEMPO.subida, (r) => this.subida(r))
    em(TEMPO.estouro, (r) => this.estouro(r))
    em(TEMPO.musica, () => musica(this, 'pvpResultado', 'vitoria'))
    em(TEMPO.lutadores, (r) => this.entrarLutadores(r))
    em(TEMPO.painel, (r) => this.abrirPainel(r))
    LINHAS.forEach((linha, i) => em(TEMPO.painel + 300 + i * TEMPO.linha, (r) => this.mostrarLinha(linha, i, r)))
    em(TEMPO.painel + 300 + LINHAS.length * TEMPO.linha + TEMPO.rolar + TEMPO.opcoes, (r) => this.liberar(r))
    return e.sort((a, b) => a.t - b.t)
  }

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
    tocar(this, botao === 'A' ? 'confirmar' : 'cancelar')
    this.cameras.main.fadeOut(250, 0, 0, 0)
    const { p1, p2 } = this
    this.time.delayedCall(260, () => (botao === 'A' ? this.scene.start('PvpArena', { p1, p2 }) : this.scene.start('PvpEscolha')))
  }

  // ---------- etapas ----------

  subida(rapido) {
    if (rapido) return
    tocar(this, 'subida')
    this.tweens.add({ targets: this.halo, scale: 1.5, duration: TEMPO.estouro - TEMPO.subida, ease: 'Quad.easeIn' })
  }

  estouro(rapido) {
    if (!rapido) {
      tocar(this, this.empate ? 'impacto' : 'estouroFesta')
      this.cameras.main.flash(240, 255, 255, 240)
      shake(this, 220, 0.012)
    }
    this.tweens.add({ targets: this.veu, alpha: 0.55, duration: rapido ? 1 : 500 })
    this.tweens.add({ targets: this.raios, alpha: this.raios.getData('alpha'), duration: rapido ? 1 : 600 })
    this.tweens.killTweensOf(this.halo)
    this.halo.setScale(3).setAlpha(1)
    this.tweens.add({ targets: this.halo, scale: 2.2, alpha: 0.45, duration: 700, ease: 'Quad.easeOut' })

    if (this.empate) {
      // empate: sem festa, só faíscas nas duas cores subindo devagar
      this.add
        .particles(0, ALTURA + 10, 'faisca', {
          x: { min: 0, max: LARGURA },
          speedY: { min: -70, max: -30 },
          lifespan: 3600,
          scale: { start: 1.1, end: 0 },
          tint: CORES.almas,
          frequency: 120,
          blendMode: 'ADD',
        })
        .setDepth(-2)
    } else {
      canhoesConfete(this)
      chuvaConfete(this, 1)
      const cor = this.corNumero
      // fogos de tempos em tempos, do lado do vencedor (e alguns do outro)
      const ladoVencedor = this.vencedor === 1 ? 0 : 1
      if (!rapido) for (let i = 0; i < 3; i++) this.time.delayedCall(i * 140, () => fogoArtificio(this, 140 + i * 180, Phaser.Math.Between(50, 120), i === 1 ? cor : undefined))
      this.time.addEvent({
        delay: 850,
        loop: true,
        callback: () => {
          const lado = Math.random() < 0.7 ? ladoVencedor : 1 - ladoVencedor
          const x = lado === 0 ? Phaser.Math.Between(24, 150) : Phaser.Math.Between(490, 616)
          fogoArtificio(this, x, Phaser.Math.Between(40, 170), Math.random() < 0.5 ? cor : undefined, { quantidade: 28, profundidade: -1 })
          tocar(this, 'fogo')
        },
      })
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
    }
    this.criarTitulo(rapido)
  }

  // nome curto do jogador 1 ou 2 (contra a CPU, o 2 é "CPU")
  rotulo(j) {
    return this.contraCpu && j === 2 ? 'CPU' : `P${j}`
  }

  criarTitulo(rapido) {
    const vencedor = this.contraCpu ? (this.vencedor === 1 ? 'VOCÊ VENCEU!' : 'A CPU VENCEU!') : `JOGADOR ${this.vencedor} VENCE!`
    const texto = this.empate ? 'EMPATE!' : vencedor
    this.titulo = this.add
      .text(LARGURA / 2, 52, texto, estilo(this.empate ? 54 : 44, this.corTitulo, { strokeThickness: 8 }))
      .setOrigin(0.5)
      .setDepth(10)
      .setShadow(0, 4, '#000000', 0, true, false)
    if (!this.empate) this.titulo.setTint(0xffffff, 0xffffff, 0xffe0c0, 0xffe0c0)

    const nome = (j) => PERSONAGENS[j === 1 ? this.p1 : this.p2].nome
    const r = this.rodadas
    const emRodadas = r ? ` em ${r} rodada${r === 1 ? '' : 's'}` : ''
    const sub = this.empate ? `Os dois caíram juntos${emRodadas}!` : `${nome(this.vencedor)} venceu${emRodadas}!`
    const legenda = this.add.text(LARGURA / 2, 94, sub, estilo(17, TEXTO.normal)).setOrigin(0.5).setDepth(10)

    const pulsar = () => this.tweens.add({ targets: this.titulo, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    if (rapido) return pulsar()
    legenda.setAlpha(0)
    this.tweens.add({ targets: legenda, alpha: 1, delay: 300, duration: 300 })
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
        tocar(this, this.empate ? 'letraPesada' : 'fanfarra')
        if (!this.empate) fogoArtificio(this, LARGURA / 2, 52, this.corNumero, { quantidade: 50, profundidade: 8 })
        pulsar()
      },
    })
  }

  // Vencedor comemorando (pulos + coroa); perdedor caído e acinzentado.
  // Empate: os dois de joelhos, meio apagados.
  entrarLutadores(rapido) {
    const { chao, escala } = LUTADOR
    ;[this.p1, this.p2].forEach((id, k) => {
      const j = k + 1
      const def = PERSONAGENS[id]
      const x = LUTADOR.x[k]
      const lado = k === 0 ? -1 : 1
      const textura = this.textures.exists(id) ? id : 'coracao'
      const venceu = this.vencedor === j
      const sombra = this.add.ellipse(x, chao + 2, 58, 12, 0x000000, 0.5).setDepth(4)
      const s = this.add.image(x, chao, textura).setOrigin(0.5, 1).setScale(escala).setDepth(5).setFlipX(k === 1)
      if (textura === 'coracao') s.setTint(def.cor)
      this.add.text(x, chao + 22, this.rotulo(j), estilo(15, TEXTO_JOGADOR[k])).setOrigin(0.5).setDepth(5)
      this.add.text(x, chao + 44, def.nome.toUpperCase(), estilo(18, venceu || this.empate ? corTexto(def.cor) : '#8a8a8a')).setOrigin(0.5).setDepth(5)

      if (!rapido) {
        s.x += lado * 160
        sombra.x += lado * 160
        this.tweens.add({ targets: [s, sombra], x: `-=${lado * 160}`, duration: 380, delay: k * 120, ease: 'Back.easeOut' })
      }

      if (this.empate) {
        // empate: os dois exaustos, meio apagados, ofegando
        s.setTint(0x9a9a9a).setAngle(-lado * 4)
        this.tweens.add({ targets: s, scaleY: escala * 0.94, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
        return
      }
      if (!venceu) {
        // caído: deitado de lado (a cabeça para o meio da tela), cinza.
        // Gira pelo pé, então anda meio corpo para fora para ficar centrado.
        s.setTint(0x5a5a5a).setAlpha(0.8)
        const deitado = { angle: -lado * 84, x: x + lado * (s.displayHeight / 2) }
        const cair = () => {
          tocar(this, 'cartaImpacto')
          this.tweens.add({ targets: s, ...deitado, duration: 260, ease: 'Bounce.easeOut' })
          this.tweens.add({ targets: sombra, scaleX: 1.8, duration: 260 })
        }
        if (rapido) {
          s.setAngle(deitado.angle).setX(deitado.x)
          sombra.setScale(1.8, 1)
        } else this.time.delayedCall(560, cair)
        return
      }
      // venceu: coroa flutuando e pulinhos com esmagada
      const coroa = this.add.image(x, chao - s.displayHeight - 16, 'bala-coroa').setTint(0xffe040).setScale(1.4).setDepth(6)
      this.tweens.add({ targets: coroa, y: coroa.y - 6, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      const brilho = this.add.image(x, chao - 40, 'brilho').setTint(this.corNumero).setBlendMode(Phaser.BlendModes.ADD).setDepth(3).setScale(1.6).setAlpha(0.35)
      this.tweens.add({ targets: brilho, alpha: 0.15, scale: 1.9, duration: 700, yoyo: true, repeat: -1 })
      if (!rapido) {
        coroa.setAlpha(0).setScale(3)
        this.tweens.add({ targets: coroa, alpha: 1, scale: 1.4, delay: 500, duration: 200, ease: 'Quad.easeIn' })
      }
      const pulo = () => {
        this.tweens.chain({
          targets: s,
          loop: -1,
          loopDelay: 160,
          tweens: [
            { scaleY: escala * 0.85, scaleX: escala * 1.1, duration: 90, ease: 'Quad.easeOut' },
            { y: chao - 34, scaleY: escala * 1.08, scaleX: escala * 0.95, angle: lado * -8, duration: 230, ease: 'Quad.easeOut' },
            { y: chao, scaleY: escala, scaleX: escala, angle: 0, duration: 200, ease: 'Quad.easeIn' },
          ],
        })
        this.tweens.add({ targets: sombra, scaleX: 0.6, alpha: 0.2, duration: 320, yoyo: true, repeat: -1, repeatDelay: 200, delay: 90 })
      }
      this.time.delayedCall(rapido ? 0 : 520, pulo)
    })
  }

  abrirPainel(rapido) {
    const { x, y, largura, altura } = PAINEL
    const g = this.add.graphics().setDepth(6)
    g.fillStyle(0x0b0914, 0.9).fillRoundedRect(0, 0, largura, altura, 8)
    g.lineStyle(3, 0xffffff, 1).strokeRoundedRect(0, 0, largura, altura, 8)
    g.lineStyle(1, this.corNumero, 0.6).strokeRoundedRect(5, 5, largura - 10, altura - 10, 6)
    // cabeçalho: P1 | rodadas | P2
    g.lineStyle(1, 0xffffff, 0.15).lineBetween(14, 44, largura - 14, 44)
    g.setPosition(x, y)
    const cabecalho = [
      this.add.text(COLUNA[0], y + 23, 'P1', estilo(20, TEXTO_JOGADOR[0])).setOrigin(0.5),
      this.add.text(COLUNA[1], y + 23, this.rotulo(2), estilo(20, TEXTO_JOGADOR[1])).setOrigin(0.5),
      this.add.text(x + largura / 2, y + 16, 'RODADAS', estilo(11, '#9a9aae')).setOrigin(0.5),
      this.add.text(x + largura / 2, y + 32, String(this.rodadas), estilo(17, TEXTO.selecionado)).setOrigin(0.5),
    ]
    cabecalho.forEach((t) => t.setDepth(7))
    if (rapido) return
    g.setScale(1, 0).setY(y + altura / 2)
    this.tweens.add({ targets: g, scaleY: 1, y, duration: 260, ease: 'Back.easeOut' })
    cabecalho.forEach((t) => {
      t.setAlpha(0)
      this.tweens.add({ targets: t, alpha: 1, delay: 180, duration: 200 })
    })
    tocar(this, 'voo')
  }

  // quem foi melhor nesta linha (0 = P1, 1 = P2, -1 = empate)
  melhor(linha) {
    if (linha.carta) {
      const [a, b] = this.stats.map((s) => s.maiorCarta?.valor ?? 0)
      // Ás é especial, mas para "maior carta" vale como o mais fraco (1)
      return a === b ? -1 : a > b ? 0 : 1
    }
    const [a, b] = this.stats.map((s) => Number(s[linha.chave]) || 0)
    if (a === b) return -1
    return (linha.menor ? a < b : a > b) ? 0 : 1
  }

  mostrarLinha(linha, i, rapido) {
    const y = PAINEL.linhaY + i * PAINEL.espaco
    const rotulo = this.add.text(LARGURA / 2, y, linha.rotulo, estilo(13, '#c8c8d8', { strokeThickness: 3 })).setOrigin(0.5).setDepth(7)
    if (!rapido) {
      rotulo.setAlpha(0).setY(y + 8)
      this.tweens.add({ targets: rotulo, alpha: 1, y, duration: 160, ease: 'Quad.easeOut' })
    }
    const melhor = this.melhor(linha)
    ;[0, 1].forEach((k) => {
      const cor = melhor === k ? TEXTO_JOGADOR[k] : '#ffffff'
      if (linha.carta) return this.mostrarCarta(this.stats[k].maiorCarta, k, y, cor, rapido)
      const alvo = Math.max(0, Math.round(Number(this.stats[k][linha.chave]) || 0))
      const valor = this.add.text(COLUNA[k], y, rapido ? String(alvo) : '0', estilo(19, cor)).setOrigin(0.5).setDepth(7)
      if (melhor === k) this.marcarMelhor(COLUNA[k], y, k, rapido)
      if (rapido) return
      if (!alvo) {
        this.time.delayedCall(80, () => tocar(this, 'contadorFim'))
        return
      }
      const contador = this.tweens.addCounter({
        from: 0,
        to: alvo,
        duration: TEMPO.rolar,
        ease: 'Quad.easeOut',
        onUpdate: (tw) => {
          valor.setText(String(Math.round(tw.getValue())))
          if (this.time.now - this.ultimoTic > 38) {
            this.ultimoTic = this.time.now
            tocar(this, 'contador')
          }
        },
        onComplete: () => {
          valor.setText(String(alvo))
          if (this.pulando) return
          if (k === 1) tocar(this, 'contadorFim')
          valor.setScale(1.35)
          this.tweens.add({ targets: valor, scale: 1, duration: 150, ease: 'Quad.easeOut' })
        },
      })
      this.contadores.push(contador)
    })
  }

  // estrelinha ao lado do melhor valor da linha
  marcarMelhor(x, y, k, rapido) {
    const lado = k === 0 ? -1 : 1
    const estrela = this.add.image(x + lado * 34, y, 'estrela').setTint(CORES.almas[k]).setScale(0.7).setDepth(7)
    if (rapido) return
    estrela.setScale(0)
    this.tweens.add({ targets: estrela, scale: 0.7, delay: TEMPO.rolar, duration: 160, ease: 'Back.easeOut' })
  }

  // Maior carta: mini carta + nome embaixo do rótulo (ou um traço se não jogou nenhuma)
  mostrarCarta(carta, k, y, cor, rapido) {
    const x = COLUNA[k]
    if (!carta) {
      this.add.text(x, y, '—', estilo(19, '#8a8a8a')).setOrigin(0.5).setDepth(7)
      return
    }
    // espelhado: P1 com a carta por fora e o nome para dentro; P2 ao contrário
    const fora = lado(k)
    const personagem = carta.personagem ?? (k === 0 ? this.p1 : this.p2)
    const mini = new Carta(this, x + fora * 40, y + 2, { id: `resultado-${k}`, custo: 0, descricao: '', ...carta, personagem }, { largura: 24 }).setDepth(7)
    const nome = this.add
      .text(x + fora * 24, y + 2, carta.nome ?? '', estilo(12, cor, { strokeThickness: 3, wordWrap: { width: 80 }, lineSpacing: -2, align: k === 0 ? 'left' : 'right' }))
      .setOrigin(k === 0 ? 0 : 1, 0.5)
      .setDepth(7)
    if (rapido) return
    mini.setScale(2.2).setAlpha(0).setAngle(lado(k) * 20)
    nome.setAlpha(0)
    this.tweens.add({
      targets: mini,
      scale: 1,
      alpha: 1,
      angle: 0,
      duration: 200,
      delay: k * 120,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (!this.pulando) tocar(this, 'cartaImpacto')
      },
    })
    this.tweens.add({ targets: nome, alpha: 1, delay: 200 + k * 120, duration: 200 })
  }

  liberar(rapido) {
    if (rapido) this.time.delayedCall(400, () => (this.liberado = true))
    else this.liberado = true
    const opcoes = this.add
      .text(LARGURA / 2, ALTURA - 26, 'A: REVANCHE     B: TROCAR PERSONAGENS', estilo(16))
      .setOrigin(0.5)
      .setDepth(10)
      .setAlpha(0)
    this.tweens.add({
      targets: opcoes,
      alpha: 1,
      duration: 300,
      onComplete: () => this.tweens.add({ targets: opcoes, alpha: 0.5, duration: 550, yoyo: true, repeat: -1 }),
    })
    this.dicaPular?.destroy()
  }

  update(time, delta) {
    this.controles.atualizar()
    this.fundo.atualizar(delta)
    this.raios.rotation += delta * 0.00018

    this.relogio += delta
    while (this.etapas.length && this.relogio >= this.etapas[0].t) this.etapas.shift().f(false)

    if (!this.dicaPular && !this.liberado && this.relogio > TEMPO.estouro) {
      this.dicaPular = this.add.text(LARGURA - 10, ALTURA - 10, 'A: pular', estilo(12, '#9090a0')).setOrigin(1, 1).setDepth(10)
    }
  }
}

const lado = (k) => (k === 0 ? -1 : 1)
