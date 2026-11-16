import Phaser from 'phaser'
import Controles from '../controles.js'
import { partyDe } from '../data/batalha.js'
import { criarFundo } from '../backgrounds/index.js'
import { ESCALA, escalaDe } from '../arte/texturas.js'
import { tocar, musica } from '../audio.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'
import { claraoCamera } from '../effects/flash.js'
import { canal, emRede, souHostDaRede, irParaCena } from '../rede.js'
import { semLigaduras } from '../campanha/texto.js'

// O MODO do CO-OP, logo depois da party (EscolhaParty / EscolhaPartyN -> ModoCoop -> Selecao):
//   LUTA RÁPIDA   um chefe, uma luta (o CO-OP de sempre)
//   EXPEDIÇÃO     3 lutas seguidas: lacaios -> tenente -> chefão, com melhorias entre elas (coop/expedicao.js)
// ← → escolhem, A confirma, B volta para a party. Dados: { party, modo? } (modo: onde o cursor começa).
// EM REDE (como a Selecao): quem escolhe é o HOST; o cursor dele vai para os outros ('cursor', tela 'modo')
// e o A também ('confirmou'); o host leva todos para a Selecao (irParaCena).
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
const CURSOR_MS = 300

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
  }

  create() {
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => (botao === 'A' ? this.confirmar() : this.voltar()))
    this.rede = emRede()
    this.host = !this.rede || souHostDaRede()
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
    texto(LARGURA / 2, ALTURA - 30, this.host ? '← → escolher     A: confirmar     B: party' : '', 14, TEXTO.desabilitado, { strokeThickness: 0 })
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

  ligarRede() {
    if (this.host) {
      this.mandarCursor()
      this.time.addEvent({ delay: CURSOR_MS, loop: true, callback: () => this.mandarCursor() })
      return
    }
    const desligar = [
      canal.ao('cursor', (d) => d?.tela === 'modo' && !this.escolhido && OPCOES[d.indice] && d.indice !== this.indice && this.selecionar(d.indice)),
      canal.ao('confirmou', (d) => d?.tela === 'modo' && OPCOES[d.indice] && this.confirmar(d.indice)),
    ]
    this.events.once('shutdown', () => desligar.forEach((fn) => fn()))
  }

  mandarCursor() {
    if (!this.escolhido) canal.enviarRapido('cursor', { tela: 'modo', indice: this.indice })
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

  confirmar(doHost = null) {
    if (this.escolhido) return
    if (!this.host && doHost == null) return this.soHost()
    if (doHost != null) this.selecionar(doHost, false)
    this.escolhido = true
    const modo = OPCOES[this.indice].id
    this.registry.set('modoCoop', modo)
    tocar(this, 'confirmar')
    claraoCamera(this.cameras.main, 200, 255, 255, 255)
    this.cameras.main.fadeOut(300, 0, 0, 0)
    if (this.rede && this.host) canal.enviar('confirmou', null, { tela: 'modo', indice: this.indice })
    if (!this.host) return
    const dados = { party: this.party ?? partyDe(this.registry), modo, chefe: this.registry.get('chefe') }
    this.time.delayedCall(320, () => (this.rede ? irParaCena(this, 'Selecao', dados) : this.scene.start('Selecao', dados)))
  }

  voltar() {
    if (this.escolhido) return
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
    for (let j = 0; j < this.controles.numJogadores && this.host && !this.escolhido; j++) {
      const d = this.controles.toque(j)
      if (d === 'esquerda' || d === 'cima') this.selecionar(this.indice - 1)
      if (d === 'direita' || d === 'baixo') this.selecionar(this.indice + 1)
      if (this.rede && d) this.mandarCursor()
    }
    this.fundo?.atualizar(delta)
    const p = this.paineis[this.indice]
    this.cursor.setPosition(p.x, PAINEL.y - PAINEL.altura / 2 - 18 + Math.sin(time / 200) * 3)
    this.info.setText(this.rede ? (this.host ? 'você é o host da partida: você escolhe' : 'o host da partida está escolhendo o modo...') : '')
  }
}
