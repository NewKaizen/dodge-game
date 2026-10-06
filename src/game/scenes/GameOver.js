import Phaser from 'phaser'
import Controles from '../controles.js'
import { CHEFES } from '../coop/chefes/index.js'
import { ESCALA } from '../arte/texturas.js'
import { tocar, musica, pararMusica } from '../audio.js'
import { formatarTempo } from '../coop/nota.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO, NIVEIS } from '../constants.js'

// Tela de game over (os dois caíram na CoopArena).
// Em etapas: ronco grave no escuro -> letras de GAME OVER despencando uma a
// uma -> o chefe vencedor aparece rindo ao fundo -> mensagem -> quanto faltava
// do chefe -> dica -> opções. Cinzas caem e brasas sobem o tempo todo.
// A ou B durante a animação pula para o fim. Depois:
//   A: tentar de novo (mesmo chefe e nível) · B: escolher outro chefe


const TEMPO = {
  ronco: 100,
  letras: 650, // primeira letra começa a cair
  letra: 175, // intervalo entre letras
  queda: 360, // quanto cada letra leva caindo
  chefe: 2700,
  lamento: 2750,
  mensagem: 3150,
  painel: 4300,
  dica: 5300,
  opcoes: 5900,
  sino: 6200, // depois, um sino a cada SINO_MS
}
const SINO_MS = 6500
const TITULO = { texto: 'GAME OVER', y: 104, tamanho: 76, espaco: 52, espacoPalavra: 34 }
const LETRA_MS = 28 // velocidade da mensagem digitada
const COR_TITULO = '#f2e6e6'
const COR_SOMBRA = '#4a0612'
const COR_BRASA = [0xff6a1a, 0xff3a20, 0xffa040]

// Mensagens por chefe (e algumas gerais): sorteia uma
const MENSAGENS = {
  king: [
    'O rei ajeitou a coroa e já se acha invencível. Mostre que o tabuleiro ainda não fechou.',
    'Foi só um xeque. A partida continua enquanto houver peças em pé.',
  ],
  queen: [
    'A rainha já está postando a vitória dela. Hora de apagar esse post.',
    'Seu desempenho foi salvo como "versão de teste". A próxima é a definitiva.',
  ],
  jevil: [
    'O bobo bateu palmas e pediu mais uma rodada. Vai deixar ele esperando?',
    'Caíram no truque desta vez, mas agora vocês já viram onde a carta estava escondida.',
  ],
  coronel: [
    'O coronel buzinou de alegria e saiu cantando pneu. Ainda dá para alcançá-lo.',
    'Atropelados, sim. Vencidos, nunca. Afivelem os cintos para a revanche.',
  ],
  geral: [
    'Corações rachados também batem. Respire fundo e volte mais esperto.',
    'Toda queda ensina um padrão novo. Agora vocês sabem um pouco mais.',
  ],
}

const DICAS = [
  'O naipe da carta virada do chefe avisa o que vem: com ♠ forte chegando, um escudo de copas protege os dois.',
  'Passar pelo ataque sem levar dano deixa o seu golpe CRÍTICO (x1,5) e ainda dá energia.',
  'Os dois atacando com o mesmo naipe fazem COMBO; com o mesmo valor, PAR. Combinem as cartas!',
  'Caiu? Uma carta de cura do parceiro te levanta na hora. Sem cura, você volta sozinho em 2 rodadas.',
  'A barra ★ embaixo do HP do chefe é o SUPER dele. O Ás de ouros tira carga dela.',
  'A armadilha (♣) fica mais forte a cada graze. Passe raspando!',
]
const DICA_NIVEL = 'Está difícil demais? Em B dá para escolher o chefe de novo e trocar o nível.'

const estilo = (tamanho, cor = TEXTO.normal, extra = {}) => ({
  fontFamily: FONTE,
  fontSize: `${tamanho}px`,
  color: cor,
  stroke: '#000000',
  strokeThickness: Math.max(3, Math.round(tamanho / 6)),
  ...extra,
})

export default class GameOver extends Phaser.Scene {
  constructor() {
    super('GameOver')
  }

  // estatisticas: CoopArena.resumo(); hpChefe/hpMaxChefe: quanto faltava do chefe
  create({ chefe, estatisticas, hpChefe, hpMaxChefe }) {
    this.idChefe = chefe
    this.def = CHEFES[chefe]
    this.stats = estatisticas
    this.nivel = estatisticas.nivel
    this.hp = { atual: hpChefe, max: hpMaxChefe }
    this.saindo = false
    this.liberado = false
    this.relogio = 0
    this.letras = []
    this.proximoSino = TEMPO.sino

    pararMusica()
    musica(this, 'gameover') // por baixo da ambientação sintetizada (ronco, lamento, sino)
    this.cameras.main.setBackgroundColor(0x000000)
    this.criarCenario()
    this.etapas = this.montarEtapas()

    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => this.aoBotao(botao))
    this.cameras.main.fadeIn(500)
  }

  // ---------- cenário fixo ----------

  criarCenario() {
    // brilho avermelhado embaixo, como brasa no chão
    this.chao = this.add.image(LARGURA / 2, ALTURA + 40, 'brilho').setTint(0x801010).setScale(12, 4).setAlpha(0).setDepth(-6)
    this.tweens.add({ targets: this.chao, alpha: 0.45, duration: 2500, ease: 'Sine.easeInOut' })

    // vinheta vermelho-escura pulsando devagar, como uma respiração
    this.textures.get('vinheta').setFilter(Phaser.Textures.FilterMode.LINEAR)
    const sx = LARGURA / 128
    const sy = ALTURA / 128
    this.vinheta = this.add.image(LARGURA / 2, ALTURA / 2, 'vinheta').setTint(0x3a0008).setScale(sx * 1.6, sy * 1.6).setDepth(8).setAlpha(0)
    this.tweens.add({ targets: this.vinheta, alpha: 1, scaleX: sx * 1.04, scaleY: sy * 1.04, duration: 2200, ease: 'Cubic.easeOut' })
    this.tweens.add({ targets: this.vinheta, scaleX: sx * 0.96, scaleY: sy * 0.96, delay: 2200, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    // cinzas caindo e brasas subindo, sem parar
    this.time.addEvent({ delay: 90, loop: true, callback: () => this.cinza() })
    this.time.addEvent({ delay: 260, loop: true, callback: () => this.brasa() })
    for (let i = 0; i < 26; i++) this.cinza(Phaser.Math.Between(0, ALTURA))
  }

  cinza(y = -6) {
    const tom = Phaser.Math.Between(70, 150)
    const lado = Phaser.Math.FloatBetween(1.5, 3.5)
    const c = this.add
      .rectangle(Phaser.Math.Between(-20, LARGURA + 20), y, lado, lado, Phaser.Display.Color.GetColor(tom, tom - 12, tom - 12))
      .setAlpha(Phaser.Math.FloatBetween(0.25, 0.7))
      .setDepth(-3)
    const dur = Phaser.Math.Between(5000, 9000) * ((ALTURA - y) / ALTURA + 0.05)
    this.tweens.add({ targets: c, y: ALTURA + 8, duration: dur, onComplete: () => c.destroy() })
    this.tweens.add({ targets: c, x: c.x + Phaser.Math.Between(-40, 40), angle: 180, duration: dur / 2, yoyo: true, ease: 'Sine.easeInOut' })
  }

  brasa() {
    const b = this.add
      .image(Phaser.Math.Between(20, LARGURA - 20), ALTURA + 6, 'faisca')
      .setTint(Phaser.Utils.Array.GetRandom(COR_BRASA))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(Phaser.Math.FloatBetween(0.6, 1.3))
      .setDepth(-2)
    const dur = Phaser.Math.Between(3000, 5200)
    this.tweens.add({ targets: b, y: Phaser.Math.Between(180, 360), alpha: 0, scale: 0.2, duration: dur, ease: 'Quad.easeOut', onComplete: () => b.destroy() })
    this.tweens.add({ targets: b, x: b.x + Phaser.Math.Between(-30, 30), duration: dur / 3, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' })
  }

  // ---------- linha do tempo ----------

  montarEtapas() {
    const e = []
    const em = (t, f) => e.push({ t, f })
    em(TEMPO.ronco, (r) => !r && tocar(this, 'abismo'))
    const posicoes = this.posicoesTitulo()
    posicoes.forEach((p, i) => em(TEMPO.letras + i * TEMPO.letra, (r) => this.soltarLetra(p, i === posicoes.length - 1, r)))
    em(TEMPO.letras + posicoes.length * TEMPO.letra + TEMPO.queda, (r) => this.tituloCompleto(r))
    em(TEMPO.chefe, (r) => this.chefeRindo(r))
    em(TEMPO.lamento, (r) => !r && tocar(this, 'lamento'))
    em(TEMPO.mensagem, (r) => this.mensagem(r))
    em(TEMPO.painel, (r) => this.painel(r))
    em(TEMPO.dica, (r) => this.dica(r))
    em(TEMPO.opcoes, (r) => this.liberar(r))
    return e.sort((a, b) => a.t - b.t)
  }

  // A ou B no meio da animação: roda tudo o que falta de uma vez
  pular() {
    while (this.etapas.length) this.etapas.shift().f(true)
    for (const l of this.letras) {
      this.tweens.killTweensOf(l.texto)
      l.texto.setPosition(l.x, TITULO.y).setScale(1).setAngle(l.angulo).setAlpha(1)
    }
    if (this.digitando) {
      this.digitando.remove()
      this.digitando = null
      this.textoMensagem.setText(this.mensagemCompleta)
    }
    this.barraHp?.completar()
    this.relogio = Math.max(this.relogio, TEMPO.opcoes)
    this.proximoSino = this.relogio + 1500
  }

  aoBotao(botao) {
    if (this.saindo) return
    if (!this.liberado) return this.pular()
    this.saindo = true
    tocar(this, 'confirmar')
    this.cameras.main.fadeOut(300, 0, 0, 0)
    this.time.delayedCall(320, () => {
      if (botao === 'A') this.scene.start('CoopArena', { chefe: this.idChefe, nivel: this.nivel })
      else this.scene.start('Selecao', { chefe: this.idChefe })
    })
  }

  // ---------- título ----------

  posicoesTitulo() {
    const letras = [...TITULO.texto]
    const larguras = letras.map((ch) => (ch === ' ' ? TITULO.espacoPalavra : TITULO.espaco))
    const total = larguras.reduce((a, b) => a + b, 0)
    let x = LARGURA / 2 - total / 2
    const lista = []
    letras.forEach((ch, i) => {
      if (ch !== ' ') lista.push({ ch, x: x + larguras[i] / 2 })
      x += larguras[i]
    })
    return lista
  }

  soltarLetra({ ch, x }, ultima, rapido) {
    // cai reta, sem girar: texto girado fica serrilhado e com falhas em pixel art
    const angulo = 0
    const texto = this.add
      .text(x, rapido ? TITULO.y : -70, ch, estilo(TITULO.tamanho, COR_TITULO, { stroke: COR_SOMBRA, strokeThickness: 10 }))
      .setOrigin(0.5, 0.85)
      .setDepth(10)
    this.letras.push({ texto, x, angulo })
    if (rapido) return
    this.tweens.add({
      targets: texto,
      y: TITULO.y,
      duration: TEMPO.queda,
      ease: 'Quad.easeIn',
      onComplete: () => {
        tocar(this, 'letraPesada')
        this.cameras.main.shake(ultima ? 260 : 110, ultima ? 0.012 : 0.005)
        texto.setScale(1.25, 0.7)
        this.tweens.add({ targets: texto, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.easeOut' })
        this.poeira(x, TITULO.y + 8, ultima ? 14 : 7)
      },
    })
  }

  poeira(x, y, quantidade) {
    for (let k = 0; k < quantidade; k++) {
      const lado = k % 2 ? 1 : -1
      const p = this.add.rectangle(x + lado * Phaser.Math.Between(4, 20), y, 4, 4, 0x8a7a7a).setAlpha(0.8).setDepth(9)
      this.tweens.add({
        targets: p,
        x: p.x + lado * Phaser.Math.Between(16, 46),
        y: y - Phaser.Math.Between(4, 22),
        alpha: 0,
        scale: 0.3,
        duration: Phaser.Math.Between(380, 650),
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      })
    }
  }

  tituloCompleto(rapido) {
    // brilho vermelho que pulsa atrás do título
    const halo = this.add.image(LARGURA / 2, TITULO.y - 26, 'brilho').setTint(0xc01020).setBlendMode(Phaser.BlendModes.ADD).setDepth(5).setScale(9, 2.2).setAlpha(0)
    this.tweens.add({ targets: halo, alpha: 0.35, duration: rapido ? 1 : 900 })
    this.tweens.add({ targets: halo, scaleX: 9.8, alpha: 0.2, delay: 900, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    // linha fina sob o título
    const linha = this.add.rectangle(LARGURA / 2, TITULO.y + 20, 430, 2, 0x8a1020).setDepth(6).setScale(0, 1)
    this.tweens.add({ targets: linha, scaleX: 1, duration: rapido ? 1 : 700, ease: 'Cubic.easeOut' })
  }

  // ---------- chefe ao fundo ----------

  chefeRindo(rapido) {
    const escala = ESCALA.chefe * 1.5
    const x = LARGURA / 2
    const y = 150
    const chefe = this.add.image(x, y, this.def.sprite).setScale(escala).setTint(0x9a3040).setAlpha(0).setDepth(-4)
    this.tweens.add({ targets: chefe, alpha: 0.32, duration: rapido ? 1 : 1400 })
    // balanço lento
    this.tweens.add({ targets: chefe, angle: { from: -3, to: 3 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    // crises de riso: pulinhos rápidos de tempos em tempos
    const rir = () => {
      if (!chefe.active) return
      this.tweens.add({ targets: chefe, y: y - 7, scaleY: escala * 1.04, duration: 75, yoyo: true, repeat: 5, ease: 'Sine.easeOut', onComplete: () => chefe.setY(y) })
    }
    this.time.addEvent({ delay: 2600, loop: true, startAt: rapido ? 1600 : 900, callback: rir })
  }

  // ---------- textos ----------

  mensagem(rapido) {
    const lista = [...(MENSAGENS[this.idChefe] ?? []), ...MENSAGENS.geral]
    this.mensagemCompleta = Phaser.Utils.Array.GetRandom(lista)
    this.textoMensagem = this.add
      .text(LARGURA / 2, 168, rapido ? this.mensagemCompleta : '', estilo(19, '#e8dcdc', { align: 'center', wordWrap: { width: 540 } }))
      .setOrigin(0.5, 0)
      .setDepth(10)
    if (rapido) return
    // digita com o texto inteiro já medido, para as linhas não pularem
    let n = 0
    const total = this.mensagemCompleta.length
    this.digitando = this.time.addEvent({
      delay: LETRA_MS,
      repeat: total - 1,
      callback: () => {
        n++
        const visivel = this.mensagemCompleta.slice(0, n)
        const oculto = this.mensagemCompleta.slice(n).replace(/\S/g, ' ')
        this.textoMensagem.setText(visivel + oculto)
        if (n % 3 === 0 && this.mensagemCompleta[n - 1] !== ' ') tocar(this, 'texto')
        if (n >= total) this.digitando = null
      },
    })
  }

  painel(rapido) {
    const cx = LARGURA / 2
    const y = 252
    const objetos = []
    {
      const resto = Phaser.Math.Clamp(this.hp.atual / this.hp.max, 0, 1)
      const pct = Math.max(resto > 0 ? 1 : 0, Math.round(resto * 100))
      const frase = resto <= 0.25 ? 'Faltou muito pouco!' : resto <= 0.5 ? 'Já passaram da metade!' : 'Agora vocês conhecem os ataques.'
      objetos.push(this.add.text(cx, y, `${this.def.nome} ainda tinha ${pct}% do HP`, estilo(16, TEXTO.normal)).setOrigin(0.5))
      const largura = 300
      const fundo = this.add.rectangle(cx - largura / 2, y + 24, largura, 12, CORES.hpFundo).setOrigin(0, 0.5).setStrokeStyle(2, 0x000000)
      const barra = this.add.rectangle(cx - largura / 2, y + 24, largura, 12, CORES.hpChefe).setOrigin(0, 0.5)
      objetos.push(fundo, barra)
      // a barra começa cheia e esvazia até onde o chefe ficou
      const alvo = largura * resto
      if (rapido) barra.width = alvo
      else {
        const tw = this.tweens.add({ targets: barra, width: alvo, delay: 300, duration: 900, ease: 'Cubic.easeOut' })
        this.barraHp = {
          completar: () => {
            tw.stop()
            barra.width = alvo
          },
        }
      }
      objetos.push(this.add.text(cx, y + 46, frase, estilo(15, resto <= 0.25 ? TEXTO.selecionado : '#b0a0a0')).setOrigin(0.5))
    }
    {
      const s = this.stats
      const nivel = NIVEIS[this.nivel] ?? NIVEIS.facil
      const linha = `Turnos ${s.turnos}   ·   Tempo ${formatarTempo(s.tempoMs)}   ·   Grazes ${s.grazes}   ·   `
      const t = this.add.text(0, y + 74, linha, estilo(14, TEXTO.desabilitado)).setOrigin(0, 0.5)
      const tn = this.add.text(0, y + 74, nivel.rotulo, estilo(14, nivel.cor)).setOrigin(0, 0.5)
      const total = t.width + tn.width
      t.x = cx - total / 2
      tn.x = t.x + t.width
      objetos.push(t, tn)
    }
    for (const o of objetos) {
      o.setDepth(10)
      if (rapido) continue
      const yFinal = o.y
      o.setAlpha(0).setY(yFinal + 8)
      this.tweens.add({ targets: o, alpha: 1, y: yFinal, duration: 350, ease: 'Quad.easeOut' })
    }
  }

  dica(rapido) {
    const dicas = this.nivel !== 'facil' && Math.random() < 0.3 ? [DICA_NIVEL] : DICAS
    const texto = Phaser.Utils.Array.GetRandom(dicas)
    const y = 368
    const caixa = this.add.rectangle(LARGURA / 2, y, 560, 52, CORES.painel, 0.85).setStrokeStyle(2, 0x5a2a30).setDepth(9)
    const rotulo = this.add.text(LARGURA / 2 - 268, y - 16, 'DICA', estilo(13, TEXTO.selecionado)).setOrigin(0, 0.5).setDepth(10)
    const corpo = this.add
      .text(LARGURA / 2 + 10, y + 7, texto, estilo(14, TEXTO.normal, { align: 'center', wordWrap: { width: 500 }, strokeThickness: 3 }))
      .setOrigin(0.5)
      .setDepth(10)
    if (rapido) return
    for (const o of [caixa, rotulo, corpo]) {
      o.setAlpha(0)
      this.tweens.add({ targets: o, alpha: 1, duration: 400 })
    }
  }

  liberar(rapido) {
    this.liberado = true
    this.dicaPular?.destroy()
    const y = ALTURA - 38
    const opcao = (x, botao, rotulo, cor) => {
      const icone = this.add.image(x - 92, y, 'coracao').setTint(cor).setScale(1.6).setDepth(10)
      const t = this.add.text(x - 78, y, `${botao}  ${rotulo}`, estilo(18, TEXTO.normal)).setOrigin(0, 0.5).setDepth(10)
      return [icone, t]
    }
    const itens = [...opcao(LARGURA / 2 - 120, 'A', 'TENTAR DE NOVO', CORES.almas[0]), ...opcao(LARGURA / 2 + 160, 'B', 'ESCOLHER CHEFE', 0xb0b0b0)]
    for (const o of itens) {
      o.setAlpha(0)
      this.tweens.add({ targets: o, alpha: 1, duration: rapido ? 1 : 400 })
    }
    // o coração do A bate devagar, chamando para a revanche
    this.tweens.add({ targets: itens[0], scale: 2, duration: 160, yoyo: true, repeat: -1, repeatDelay: 900, ease: 'Quad.easeOut' })
  }

  update(time, delta) {
    this.controles.atualizar()
    this.relogio += Math.min(delta, 100) // um engasgo (aba em segundo plano) não pula a animação
    while (this.etapas.length && this.relogio >= this.etapas[0].t) this.etapas.shift().f(false)

    if (!this.dicaPular && !this.liberado && this.relogio > TEMPO.letras + 400) {
      this.dicaPular = this.add.text(LARGURA - 12, ALTURA - 12, 'A: pular', estilo(12, TEXTO.desabilitado)).setOrigin(1).setDepth(10)
    }
    if (this.liberado && this.relogio >= this.proximoSino) {
      tocar(this, 'sino')
      this.proximoSino = this.relogio + SINO_MS
    }
  }
}
