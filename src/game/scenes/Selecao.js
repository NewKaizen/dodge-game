import Phaser from 'phaser'
import Controles from '../controles.js'
import { CHEFES, ORDEM_CHEFES } from '../coop/chefes/index.js'
import { partyDe } from '../data/batalha.js'
import { criarFundo } from '../backgrounds/index.js'
import { ESCALA } from '../arte/texturas.js'
import { tocar, musica } from '../audio.js'
import { CORES, DIFICULDADES, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'
import { claraoCamera } from '../effects/flash.js'
import { canal, emRede, souHostDaRede, irParaCena } from '../rede.js'

const CARTA = { largura: 142, altura: 270, y: 245, passo: 152 }
const CURSOR_MS = 300 // em rede: de quanto em quanto o host manda o cursor de novo

// Tela de seleção de chefe (com a dificuldade base); depois vem a tela do nível (Dificuldade)
// B: volta para a escolha da party (EscolhaParty)
// Dados (opcionais): { party, chefe } (party: os ids, na ordem; sem ela, a do
// registry 'party'; chefe: onde o cursor começa)
// EM REDE (sala CO-OP, game/rede.js, docs/rede-pvp.md): quem escolhe é o HOST.
// O cursor dele vai para o convidado ('cursor', rápida, repetida de tempos em
// tempos) e o A dele também ('confirmou'), para o convidado ver a mesma
// confirmação; o host leva os dois para a Dificuldade (irParaCena). O B do
// host volta os dois para a EscolhaParty; o do convidado só lembra quem escolhe.
export default class Selecao extends Phaser.Scene {
  constructor() {
    super('Selecao')
  }

  init(dados) {
    this.party = Array.isArray(dados?.party) ? dados.party : null
    this.chefeInicial = dados?.chefe ?? null
  }

  create() {
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => (botao === 'A' ? this.confirmar() : this.voltar()))
    this.rede = emRede()
    this.host = !this.rede || souHostDaRede() // quem escolhe (fora da rede, quem está jogando)
    // em rede a party vem nos dados (o registry é de cada PC): guarda aqui também
    // (a Vitoria mostra a party do registry)
    if (this.party) this.registry.set('party', this.party)
    this.fundo = null
    this.escolhido = false
    const texto = (x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) =>
      this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, ...extra }).setOrigin(0.5)

    texto(LARGURA / 2, 36, 'ESCOLHA O CHEFE', 28, TEXTO.normal, { stroke: '#000000', strokeThickness: 4 })

    this.cartas = ORDEM_CHEFES.map((id, i) => {
      const def = CHEFES[id]
      const dif = DIFICULDADES[def.dificuldade]
      const x = LARGURA / 2 + (i - (ORDEM_CHEFES.length - 1) / 2) * CARTA.passo
      const y = CARTA.y
      const moldura = this.add.rectangle(x, y, CARTA.largura, CARTA.altura, CORES.painel, 0.88).setStrokeStyle(3, 0x505050)
      const sprite = this.add.image(x, y - 40, def.sprite).setScale(ESCALA.chefe * 0.8)
      texto(x, y + 62, def.nome.toUpperCase(), def.nome.length > 11 ? 14 : 18, TEXTO.normal)
      texto(x, y + 86, dif.rotulo, 16, dif.cor)
      const maxEstrelas = Math.max(...Object.values(DIFICULDADES).map((d) => d.estrelas))
      for (let k = 0; k < maxEstrelas; k++) {
        this.add.image(x + (k - (maxEstrelas - 1) / 2) * 20, y + 110, 'coracao').setTint(k < dif.estrelas ? parseInt(dif.cor.slice(1), 16) : 0x303030)
      }
      return { moldura, sprite, x, y }
    })

    this.cursor = this.add.image(0, 0, 'coracao').setTint(CORES.almas[0]).setScale(1.8)
    this.info = texto(LARGURA / 2, ALTURA - 56, '', 15)
    // (o convidado só olha: o texto de cima já diz que o host está escolhendo)
    const dica = this.host ? '← → escolher     A: confirmar     B: party' : ''
    texto(LARGURA / 2, ALTURA - 30, dica, 14, TEXTO.desabilitado)

    const atual = ORDEM_CHEFES.indexOf(this.chefeInicial ?? this.registry.get('chefe'))
    this.selecionar(Math.max(0, atual), false)
    if (this.rede) this.ligarRede()
    musica('selecao')
    this.cameras.main.fadeIn(250)
  }

  // ---------- em rede ----------

  ligarRede() {
    if (this.host) {
      this.mandarCursor()
      this.time.addEvent({ delay: CURSOR_MS, loop: true, callback: () => this.mandarCursor() })
      return
    }
    const desligar = [
      canal.ao('cursor', (d) => d?.tela === 'chefe' && !this.escolhido && ORDEM_CHEFES[d.indice] && d.indice !== this.indice && this.selecionar(d.indice)),
      canal.ao('confirmou', (d) => d?.tela === 'chefe' && ORDEM_CHEFES[d.indice] && this.confirmar(d.indice)),
    ]
    this.events.once('shutdown', () => desligar.forEach((fn) => fn()))
  }

  mandarCursor() {
    if (!this.escolhido) canal.enviarRapido('cursor', { tela: 'chefe', indice: this.indice })
  }

  selecionar(indice, comSom = true) {
    const total = ORDEM_CHEFES.length
    this.indice = (indice + total) % total
    if (comSom) tocar(this, 'mover')
    this.cartas.forEach((c, k) => {
      const selecionada = k === this.indice
      c.moldura.setStrokeStyle(3, selecionada ? CORES.selecionado : 0x505050)
      c.sprite.setAlpha(selecionada ? 1 : 0.45)
      this.tweens.add({ targets: c.sprite, scale: ESCALA.chefe * (selecionada ? 0.9 : 0.8), duration: 150 })
    })
    const c = this.cartas[this.indice]
    this.cursor.setPosition(c.x, c.y - CARTA.altura / 2 - 18)
    this.fundo?.destruir()
    this.fundo = criarFundo(this, CHEFES[ORDEM_CHEFES[this.indice]].fundo)
    this.fundo.escurecer()
  }

  // doHost: em rede, no convidado, o índice que o host confirmou
  confirmar(doHost = null) {
    if (this.escolhido) return
    if (!this.host && doHost == null) return this.soHost()
    if (doHost != null) this.selecionar(doHost, false)
    this.escolhido = true
    tocar(this, 'confirmar')
    claraoCamera(this.cameras.main, 200, 255, 255, 255)
    this.cameras.main.fadeOut(300, 0, 0, 0)
    if (this.rede && this.host) canal.enviar('confirmou', null, { tela: 'chefe', indice: this.indice })
    if (!this.host) return // o convidado espera a Dificuldade chegar
    // a party vai junto: em rede o registry do convidado não é o do host
    const dados = { chefe: ORDEM_CHEFES[this.indice], party: this.party ?? partyDe(this.registry), nivel: this.registry.get('nivel') }
    this.time.delayedCall(320, () => (this.rede ? irParaCena(this, 'Dificuldade', dados) : this.scene.start('Dificuldade', dados)))
  }

  voltar() {
    if (this.escolhido) return
    if (!this.host) return this.soHost()
    this.escolhido = true
    tocar(this, 'cancelar')
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => (this.rede ? irParaCena(this, 'EscolhaParty') : this.scene.start('EscolhaParty')))
  }

  // em rede, o convidado apertou A/B: quem escolhe é o host
  soHost() {
    tocar(this, 'erro')
    this.tweens.killTweensOf(this.info)
    this.info.setScale(1)
    this.tweens.add({ targets: this.info, scale: 1.12, duration: 90, yoyo: true })
  }

  update(time, delta) {
    this.controles.atualizar()
    const n = this.controles.numJogadores
    for (let j = 0; j < n && this.host && !this.escolhido; j++) {
      const direcao = this.controles.toque(j)
      if (direcao === 'esquerda' || direcao === 'cima') this.selecionar(this.indice - 1)
      if (direcao === 'direita' || direcao === 'baixo') this.selecionar(this.indice + 1)
      if (this.rede && direcao) this.mandarCursor()
    }
    this.fundo?.atualizar(delta)
    this.cursor.setY(this.cartas[this.indice].y - CARTA.altura / 2 - 18 + Math.sin(time / 200) * 3)
    if (this.rede) this.info.setText(this.host ? 'você é o host (P1): você escolhe o chefe' : 'o host (P1) está escolhendo o chefe...')
    else {
      const jogadores = this.registry.get('numJogadores') ?? 1
      this.info.setText(`${jogadores} ${jogadores > 1 ? 'JOGADORES' : 'JOGADOR'}  (mude no painel acima do jogo)`)
    }
  }
}
