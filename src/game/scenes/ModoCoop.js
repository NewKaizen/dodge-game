import Phaser from 'phaser'
import Controles from '../controles.js'
import { partyDe } from '../data/batalha.js'
import { criarFundo } from '../backgrounds/index.js'
import { ESCALA, escalaDe } from '../arte/texturas.js'
import { tocar, musica } from '../audio.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'
import { claraoCamera } from '../effects/flash.js'
import { emRede, souHostDaRede, irParaCena, meuLado } from '../rede.js'
import VotacaoCena from '../coop/votacaoCena.js'
import { semLigaduras } from '../campanha/texto.js'

// O MODO do CO-OP, logo depois da party (EscolhaParty / EscolhaPartyN -> ModoCoop -> Selecao):
//   LUTA RÁPIDA   um chefe, uma luta (o CO-OP de sempre)
//   EXPEDIÇÃO     3 lutas seguidas: lacaios -> tenente -> chefão, com melhorias entre elas (coop/expedicao.js)
// ← → escolhem, A confirma, B volta para a party. Dados: { party, modo? } (modo: onde o cursor começa).
// EM REDE (docs/coop-cartas.md "Votação do CO-OP"): NINGUÉM escolhe sozinho. Cada um move o próprio coração e vota
// com A (dá para trocar até acabar os 20 s); o mais votado vence, empate = sorteio com roleta (coop/votacaoCena.js).
// O host apura e leva todos para a Selecao (irParaCena). B (só o host) volta para a party.
const OPCOES = [
  {
    id: 'rapida',
    titulo: 'LUTA RÁPIDA',
    linhas: ['Um chefe, uma luta.', 'Uns 4 minutos.'],
    cor: 0x4aa8ff,
    corTexto: '#9ad0ff',
  },
  {
    id: 'expedicao',
    titulo: 'EXPEDIÇÃO',
    linhas: ['3 lutas seguidas:', 'lacaios, tenente e chefão.', 'Melhorias entre as lutas.', 'Uns 10 a 12 minutos.'],
    cor: 0xffa040,
    corTexto: '#ffc070',
  },
]
const PAINEL = { largura: 320, altura: 250, y: 230, passo: 360 }

// a instância da cena é REAPROVEITADA pelo Phaser (cenasReaproveitadas.test.js)
const estadoInicial = () => ({
  indice: 0,
  party: null,
  modoInicial: null,
  paineis: null,
  fundo: null,
  cursor: null,
  info: null,
  escolhido: false,
  voto: null,
  semente: null,
  rede: false,
  host: true,
  controles: null,
})

export default class ModoCoop extends Phaser.Scene {
  constructor() {
    super('ModoCoop')
  }

  init(dados) {
    Object.assign(this, estadoInicial())
    this.party = Array.isArray(dados?.party) ? dados.party : null
    this.modoInicial = dados?.modo ?? null
    this.semente = typeof dados?.semente === 'string' ? dados.semente : null // o sorteio dos empates (igual em todos os PCs)
  }

  create() {
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => (botao === 'A' ? this.aoA() : this.voltar()))
    this.rede = emRede()
    this.host = !this.rede || souHostDaRede()
    this.semente ??= `coop:${Date.now()}`
    if (this.party) this.registry.set('party', this.party)
    this.fundo = criarFundo(this, 'king')
    this.fundo.escurecer()
    const texto = (x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) =>
      this.add.text(x, y, semLigaduras(conteudo), { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 4, align: 'center', ...extra }).setOrigin(0.5)

    texto(LARGURA / 2, 40, 'CO-OP: COMO VAI SER?', 28)
    this.paineis = OPCOES.map((o, i) => {
      const x = LARGURA / 2 + (i - 0.5) * PAINEL.passo
      const moldura = this.add.rectangle(x, PAINEL.y, PAINEL.largura, PAINEL.altura, CORES.painel, 0.9).setStrokeStyle(3, 0x505050)
      const titulo = texto(x, PAINEL.y - 92, o.titulo, 30, o.corTexto)
      const desenho = this.desenhoDe(o.id, x, PAINEL.y - 30)
      const linhas = texto(x, PAINEL.y + 62, o.linhas.join('\n'), 15, TEXTO.normal, { lineSpacing: 4, strokeThickness: 3 })
      return { o, x, moldura, titulo, desenho, linhas }
    })
    this.cursor = this.add.image(0, 0, 'coracao').setTint(CORES.almas[0]).setScale(1.8)
    this.info = texto(LARGURA / 2, ALTURA - 58, '', 14, TEXTO.desabilitado, { strokeThickness: 2 })
    const dica = this.rede ? '← → escolher     A: votar (dá para trocar)' + (this.host ? '     B: party' : '') : '← → escolher     A: confirmar     B: party'
    texto(LARGURA / 2, ALTURA - 30, dica, 14, TEXTO.desabilitado, { strokeThickness: 0 })
    const inicial = Math.max(0, OPCOES.findIndex((o) => o.id === (this.modoInicial ?? this.registry.get('modoCoop'))))
    this.selecionar(inicial, false)
    if (this.rede) this.ligarRede()
    musica('selecao')
    this.cameras.main.fadeIn(250)
  }

  // um desenhinho de cada modo: um coração contra um chefe; 3 nós ligados (o mapa da expedição)
  desenhoDe(id, x, y) {
    const g = this.add.graphics()
    if (id === 'rapida') {
      // os dois corações contra um chefe
      g.fillStyle(0x9ad0ff, 0.25).fillCircle(x + 34, y, 30)
      const grupo = this.add.container(0, 0, [
        g,
        this.add.image(x - 52, y - 10, 'coracao').setTint(CORES.almas[0]).setScale(1.6),
        this.add.image(x - 34, y + 12, 'coracao').setTint(CORES.almas[1]).setScale(1.6),
        this.add.image(x + 34, y, 'king').setScale(escalaDe('king', ESCALA.chefe * 0.4)),
      ])
      return grupo
    }
    const nos = [-60, 0, 60]
    g.lineStyle(4, 0xffc070, 0.7).lineBetween(x - 60, y, x + 60, y)
    nos.forEach((dx, k) => {
      g.fillStyle(k === 2 ? 0xff5050 : 0xffa040, 1).fillCircle(x + dx, y, k === 2 ? 16 : 11)
      g.lineStyle(2, 0x000000, 1).strokeCircle(x + dx, y, k === 2 ? 16 : 11)
    })
    return g
  }

  // EM REDE: a votação por cima das duas opções (os votos embaixo de cada painel)
  ligarRede() {
    this.voto = new VotacaoCena(this, {
      tela: 'modo',
      opcoes: OPCOES.map((o) => o.id),
      semente: this.semente,
      caixa: (i) => ({ x: this.paineis[i].x, y: PAINEL.y, w: PAINEL.largura + 12, h: PAINEL.altura + 12 }),
      posMarca: (i, k, n) => ({ x: this.paineis[i].x + (k - (n - 1) / 2) * 32, y: PAINEL.y + PAINEL.altura / 2 + 24 }),
      anuncioY: ALTURA - 56,
      contagemY: PAINEL.y,
      nomeDe: (id) => OPCOES.find((o) => o.id === id).titulo,
      aoRevelar: () => {
        this.cursor.setVisible(false)
        this.info.setVisible(false)
      },
      aoApurar: (_id, indice) => this.confirmar(indice),
    })
    this.events.once('shutdown', () => this.voto?.destruir())
  }

  aoA() {
    if (this.rede) return this.voto?.votar(OPCOES[this.indice].id)
    this.confirmar()
  }

  selecionar(indice, comSom = true) {
    this.indice = (indice + OPCOES.length) % OPCOES.length
    if (comSom) tocar(this, 'mover')
    this.paineis.forEach((p, k) => {
      const sel = k === this.indice
      p.moldura.setStrokeStyle(sel ? 4 : 3, sel ? p.o.cor : 0x505050)
      ;[p.titulo, p.linhas, p.desenho].forEach((o) => o.setAlpha(sel ? 1 : 0.45))
    })
  }

  // doHost: em rede, o índice que a votação elegeu (em todos os PCs)
  confirmar(doHost = null) {
    if (this.escolhido) return
    if (doHost != null) this.selecionar(doHost, false)
    this.escolhido = true
    const modo = OPCOES[this.indice].id
    this.registry.set('modoCoop', modo)
    tocar(this, 'confirmar')
    claraoCamera(this.cameras.main, 200, 255, 255, 255)
    this.cameras.main.fadeOut(300, 0, 0, 0)
    if (!this.host) return // o convidado espera a Selecao chegar
    const dados = { party: this.party ?? partyDe(this.registry), modo, chefe: this.registry.get('chefe'), semente: this.semente }
    this.time.delayedCall(320, () => (this.rede ? irParaCena(this, 'Selecao', dados) : this.scene.start('Selecao', dados)))
  }

  voltar() {
    if (this.escolhido || this.voto?.apurando) return
    if (!this.host) return this.soHost()
    this.escolhido = true
    tocar(this, 'cancelar')
    this.cameras.main.fadeOut(200, 0, 0, 0)
    const escolha = (this.party ?? partyDe(this.registry)).length > 2 ? 'EscolhaPartyN' : 'EscolhaParty'
    this.time.delayedCall(220, () => (this.rede ? irParaCena(this, escolha) : this.scene.start(escolha)))
  }

  soHost() {
    tocar(this, 'erro')
    this.tweens.killTweensOf(this.info)
    this.info.setScale(1)
    this.tweens.add({ targets: this.info, scale: 1.12, duration: 90, yoyo: true })
  }

  update(time, delta) {
    this.controles.atualizar()
    // em rede cada PC move o próprio coração (o meu lado); fora dela, todos os controles daqui
    const lados = this.rede ? [meuLado()] : [...Array(this.controles.numJogadores).keys()]
    for (const j of lados) {
      if (this.escolhido || this.voto?.apurando) break
      const d = this.controles.toque(j)
      if (d === 'esquerda' || d === 'cima') this.selecionar(this.indice - 1)
      if (d === 'direita' || d === 'baixo') this.selecionar(this.indice + 1)
    }
    this.voto?.atualizar(delta)
    this.fundo?.atualizar(delta)
    const p = this.paineis[this.indice]
    this.cursor.setPosition(p.x, PAINEL.y - PAINEL.altura / 2 - 18 + Math.sin(time / 200) * 3)
    this.info.setText(this.rede ? 'Votem no modo — o mais votado ganha; empate: sorteio' : '')
  }
}
