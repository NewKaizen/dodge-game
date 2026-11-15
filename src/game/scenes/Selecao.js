import Phaser from 'phaser'
import Controles from '../controles.js'
import { CHEFES, ORDEM_CHEFES } from '../coop/chefes/index.js'
import { partyDe } from '../data/batalha.js'
import { criarFundo } from '../backgrounds/index.js'
import { ESCALA } from '../arte/texturas.js'
import { tocar, musica } from '../audio.js'
import { CORES, DIFICULDADES, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'
import { claraoCamera } from '../effects/flash.js'
import { SORTEADA } from '../coop/expedicao.js'
import { semLigaduras } from '../campanha/texto.js'
import { canal, emRede, souHostDaRede, irParaCena } from '../rede.js'

const CARTA = { largura: 176, altura: 270, y: 245, passo: 200 } // 4 cartas largas: usam o 16:9 inteiro
// EXPEDIÇÃO: 5 cartas (os 4 chefões e a SORTEADA), um pouco mais estreitas
const CARTA_EXP = { largura: 150, altura: 270, y: 250, passo: 162 }
const CURSOR_MS = 300 // em rede: de quanto em quanto o host manda o cursor de novo

// A instância da cena é REAPROVEITADA pelo Phaser: o que a partida/abertura anterior
// deixou aqui (objetos já destruídos, flags) volta ao inicial no começo do init().
// Testado em src/game/__tests__/cenasReaproveitadas.test.js.
const estadoInicial = () => ({
  indice: null,
  modo: 'rapida',
  ordem: ORDEM_CHEFES,
  carta: CARTA,
})

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
    Object.assign(this, estadoInicial())
    this.party = Array.isArray(dados?.party) ? dados.party : null
    this.chefeInicial = dados?.chefe ?? null
    // EXPEDIÇÃO (ModoCoop): os 4 chefões e a SORTEADA (lacaios de um, tenente de outro, chefão surpresa)
    this.modo = dados?.modo === 'expedicao' ? 'expedicao' : 'rapida'
    this.ordem = this.modo === 'expedicao' ? [...ORDEM_CHEFES, SORTEADA] : ORDEM_CHEFES
    this.carta = this.modo === 'expedicao' ? CARTA_EXP : CARTA
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

    const exp = this.modo === 'expedicao'
    texto(LARGURA / 2, 36, exp ? 'EXPEDIÇÃO: ESCOLHA O CHEFÃO' : 'ESCOLHA O CHEFE', exp ? 26 : 28, exp ? '#ffc070' : TEXTO.normal, { stroke: '#000000', strokeThickness: 4 })
    if (exp) texto(LARGURA / 2, 66, semLigaduras('lacaios  >  tenente  >  chefão'), 14, TEXTO.desabilitado, { stroke: '#000000', strokeThickness: 3 })
    const CARTA_ = this.carta

    this.cartas = this.ordem.map((id, i) => {
      const x = LARGURA / 2 + (i - (this.ordem.length - 1) / 2) * CARTA_.passo
      const y = CARTA_.y
      const moldura = this.add.rectangle(x, y, CARTA_.largura, CARTA_.altura, CORES.painel, 0.88).setStrokeStyle(3, 0x505050)
      if (id === SORTEADA) {
        // a SORTEADA: um "?" grande e as três etapas embaralhadas
        const sprite = texto(x, y - 40, '?', 96, '#ffc070', { stroke: '#000000', strokeThickness: 6 })
        texto(x, y + 62, 'SORTEADA', 18, '#ffc070')
        texto(x, y + 92, semLigaduras('lacaios de um,\ntenente de outro,\nchefão surpresa'), 11, TEXTO.normal, { align: 'center', lineSpacing: 2 })
        return { moldura, sprite, x, y, mistura: true }
      }
      const def = CHEFES[id]
      const dif = DIFICULDADES[def.dificuldade]
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
    const dica = this.host ? '← → escolher     A: confirmar     B: voltar' : ''
    texto(LARGURA / 2, ALTURA - 30, dica, 14, TEXTO.desabilitado)

    const atual = this.ordem.indexOf(this.chefeInicial ?? this.registry.get('chefe'))
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
      canal.ao('cursor', (d) => d?.tela === 'chefe' && !this.escolhido && this.ordem[d.indice] && d.indice !== this.indice && this.selecionar(d.indice)),
      canal.ao('confirmou', (d) => d?.tela === 'chefe' && this.ordem[d.indice] && this.confirmar(d.indice)),
    ]
    this.events.once('shutdown', () => desligar.forEach((fn) => fn()))
  }

  mandarCursor() {
    if (!this.escolhido) canal.enviarRapido('cursor', { tela: 'chefe', indice: this.indice })
  }

  selecionar(indice, comSom = true) {
    const total = this.ordem.length
    this.indice = (indice + total) % total
    if (comSom) tocar(this, 'mover')
    this.cartas.forEach((c, k) => {
      const selecionada = k === this.indice
      c.moldura.setStrokeStyle(3, selecionada ? CORES.selecionado : 0x505050)
      c.sprite.setAlpha(selecionada ? 1 : 0.45)
      this.tweens.add({ targets: c.sprite, scale: c.mistura ? (selecionada ? 1.1 : 1) : ESCALA.chefe * (selecionada ? 0.9 : 0.8), duration: 150 })
    })
    const c = this.cartas[this.indice]
    this.cursor.setPosition(c.x, c.y - this.carta.altura / 2 - 18)
    this.fundo?.destruir()
    this.fundo = criarFundo(this, this.ordem[this.indice] === SORTEADA ? 'jevil' : CHEFES[this.ordem[this.indice]].fundo)
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
    const dados = { chefe: this.ordem[this.indice], party: this.party ?? partyDe(this.registry), nivel: this.registry.get('nivel'), modo: this.modo }
    this.time.delayedCall(320, () => (this.rede ? irParaCena(this, 'Dificuldade', dados) : this.scene.start('Dificuldade', dados)))
  }

  voltar() {
    if (this.escolhido) return
    if (!this.host) return this.soHost()
    this.escolhido = true
    tocar(this, 'cancelar')
    this.cameras.main.fadeOut(200, 0, 0, 0)
    // B volta para a escolha do modo (ModoCoop), com a party
    const dados = { party: this.party ?? partyDe(this.registry), modo: this.modo }
    this.time.delayedCall(220, () => (this.rede ? irParaCena(this, 'ModoCoop', dados) : this.scene.start('ModoCoop', dados)))
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
    this.cursor.setY(this.cartas[this.indice].y - this.carta.altura / 2 - 18 + Math.sin(time / 200) * 3)
    if (this.rede) this.info.setText(this.host ? 'você é o host da partida: você escolhe o chefe' : 'o host da partida está escolhendo o chefe...')
    else {
      const jogadores = this.registry.get('numJogadores') ?? 1
      this.info.setText(`${jogadores} ${jogadores > 1 ? 'JOGADORES' : 'JOGADOR'}  (o 2º entra na escolha da party)`)
    }
  }
}
