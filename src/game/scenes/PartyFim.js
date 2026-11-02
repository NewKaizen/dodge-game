import Phaser from 'phaser'
import Controles from '../controles.js'
import { criarFundo } from '../backgrounds/index.js'
import { tocar, musica } from '../audio.js'
import { FONTE, LARGURA, ALTURA, TEXTO } from '../constants.js'
import { canal, emRede, meuIndice, meuLado, souHostDaRede, irParaCena, participantesDaPartida } from '../rede.js'
import { encerrarPartida, partyAberta, encerrarParty, sairSala } from '../../lib/lan/rede.js'
import { corDaVaga, textoDaVaga } from '../vagas.js'
import { desenharForma, formaDaVaga, nomeNoCoracao } from '../coop/marcadores.js'
import { FIM_MS, novoFim, marcarFim, fimDecidido, restanteFim, opcoesDeModo, partySegue } from '../party/regras.js'
import { vigiarParty } from '../party/cliente.js'

// MODO PARTY: depois do resultado de cada partida (docs/online.md "Modo Party"). CONTINUAR (quem aperta
// continua; quando todos apertaram, ou em 15 s, a party segue para a votação do modo; quem não apertou
// nada também continua) ou SAIR DA PARTY (sai da sala na hora). Enquanto esta tela está aberta a sala
// aceita gente nova (`party {aberta}`): quem entra cai aqui e vota na próxima. Com menos de 3 a party
// acaba (o servidor tira a `party` da sala e todos voltam ao lobby).
//   convidado -> host   partyFimEscolha {escolha: 'continuar' | 'sair'}
//   host -> todos       partyFimEstado {escolhas: {vaga: escolha}, restante}
// No dev: window.partyFim (escolher(id), estadoDebug()).

const OPCOES = [
  { id: 'continuar', rotulo: 'CONTINUAR' },
  { id: 'sair', rotulo: 'SAIR DA PARTY' },
]
const ESTADO_MS = 1000

const estadoInicial = () => ({
  fim: null,
  opcao: 0,
  saindo: false,
  rotulos: [],
  cursor: null,
  membrosGfx: null,
  nomes: [],
  barra: null,
  status: null,
  restanteGuest: 0,
  assinatura: '',
})

export default class PartyFim extends Phaser.Scene {
  constructor() {
    super('PartyFim')
  }

  init() {
    Object.assign(this, estadoInicial())
  }

  create() {
    if (!emRede()) return this.scene.start('Lan')
    this.meu = meuIndice()
    this.souHost = souHostDaRede()
    this.fim = novoFim(Date.now())
    this.restanteGuest = FIM_MS
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => {
      if (botao === 'A') this.escolher(OPCOES[this.opcao].id)
    })
    // a partida acabou: o registro do XP fecha e a sala abre para quem quiser entrar na próxima
    if (this.souHost) {
      encerrarPartida()
      partyAberta(true)
    }

    this.fundo = criarFundo(this, 'king')
    this.fundo.escurecer()
    const t = (x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) => this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 4, ...extra }).setOrigin(0.5)
    this.titulo = t(LARGURA / 2, 70, 'PARTY', 44, TEXTO.selecionado, { strokeThickness: 6 })
    this.status = t(LARGURA / 2, 112, 'PRÓXIMA PARTIDA', 14, TEXTO.normal, { strokeThickness: 3 })
    this.barra = this.add.graphics()
    this.membrosGfx = this.add.graphics()
    this.rotulos = OPCOES.map((o, i) => t(LARGURA / 2 + (i === 0 ? -130 : 130), 360, o.rotulo, 22, TEXTO.normal))
    this.cursor = this.add.image(0, 360, 'coracao').setTint(corDaVaga(this.meu)).setScale(1.3)
    t(LARGURA / 2, ALTURA - 14, '← → escolher     A: confirmar', 13, TEXTO.desabilitado, { strokeThickness: 0 })
    this.atualizarTela()

    this.ligarRede()
    vigiarParty(this)
    if (import.meta.env.DEV) window.partyFim = this
    this.events.once('shutdown', () => {
      this.fundo?.destruir()
      if (window.partyFim === this) delete window.partyFim
    })
    musica('lobby', 'menu')
    this.cameras.main.fadeIn(250)
  }

  presentes() {
    return participantesDaPartida().map((p) => p.indice)
  }

  vagaDe(id) {
    return participantesDaPartida().find((p) => p.id === id)?.indice ?? -1
  }

  ligarRede() {
    const desligar = []
    if (this.souHost) {
      desligar.push(canal.ao('partyFimEscolha', (d, _c, de) => this.registrar(this.vagaDe(de), d?.escolha)))
      this.time.addEvent({ delay: ESTADO_MS, loop: true, callback: () => this.mandarEstado() })
    } else
      desligar.push(
        canal.ao('partyFimEstado', (d) => {
          if (this.saindo || !d) return
          this.fim = { ...this.fim, escolhas: { ...(d.escolhas ?? {}), ...(this.fim.escolhas[this.meu] ? { [this.meu]: this.fim.escolhas[this.meu] } : {}) } }
          if (Number.isFinite(d.restante)) this.restanteGuest = d.restante
          this.atualizarTela()
        }),
      )
    this.events.once('shutdown', () => desligar.forEach((fn) => fn()))
  }

  mandarEstado() {
    if (this.saindo) return
    canal.enviar('partyFimEstado', null, { escolhas: { ...this.fim.escolhas }, restante: restanteFim(this.fim, Date.now()) })
  }

  registrar(vaga, escolha) {
    if (this.saindo || vaga < 0) return
    const antes = this.fim
    this.fim = marcarFim(this.fim, vaga, escolha, Date.now())
    if (this.fim === antes) return
    this.mandarEstado()
    this.atualizarTela()
  }

  escolher(id) {
    if (this.saindo) return
    if (this.fim.escolhas[this.meu] === id) return
    tocar(this, id === 'sair' ? 'cancelar' : 'confirmar')
    if (id === 'sair') return this.sairDaParty()
    if (this.souHost) return this.registrar(this.meu, id)
    this.fim = marcarFim(this.fim, this.meu, id, Date.now())
    canal.enviar('partyFimEscolha', null, { escolha: id })
    this.atualizarTela()
  }

  // SAIR DA PARTY: sai da sala (o host saindo encerra a party; o dono saindo fecha a sala, como sempre)
  sairDaParty() {
    this.saindo = true
    if (!this.souHost) canal.enviar('partyFimEscolha', null, { escolha: 'sair' })
    this.cameras.main.fadeOut(220, 0, 0, 0)
    this.time.delayedCall(240, () => {
      sairSala()
      this.scene.start('Lan')
    })
  }

  // host: todos continuaram ou o tempo acabou
  seguir() {
    this.saindo = true
    partyAberta(false)
    const n = this.presentes().length
    tocar(this, 'superAtivar')
    this.cameras.main.fadeOut(260, 0, 0, 0)
    this.time.delayedCall(280, () => {
      if (!partySegue(n)) {
        encerrarParty()
        return irParaCena(this, 'Lan')
      }
      irParaCena(this, 'PartyVoto', { fase: 'modo', opcoes: opcoesDeModo(n), id: `v${Date.now()}` })
    })
  }

  atualizarTela() {
    this.rotulos.forEach((r, i) => r.setColor(i === this.opcao ? TEXTO.selecionado : this.fim.escolhas[this.meu] === OPCOES[i].id ? TEXTO.cura : TEXTO.normal))
    const r = this.rotulos[this.opcao]
    this.cursor.setPosition(r.x - r.width / 2 - 20, r.y)
    // os membros: forma + cor; quem já apertou CONTINUAR ganha o ✓
    const ps = participantesDaPartida()
    const assinatura = JSON.stringify([ps.map((p) => [p.indice, p.nome]), this.fim.escolhas])
    if (assinatura === this.assinatura) return
    this.assinatura = assinatura
    this.nomes.forEach((n) => n.destroy())
    this.nomes = []
    const g = this.membrosGfx.clear()
    ps.forEach((p, k) => {
      const x = LARGURA / 2 + (k - (ps.length - 1) / 2) * 150
      const y = 210
      const ok = this.fim.escolhas[p.indice] === 'continuar'
      g.fillStyle(0x0b0914, 0.85).fillRoundedRect(x - 62, y - 44, 124, 104, 8)
      g.lineStyle(p.indice === this.meu ? 3 : 1.5, corDaVaga(p.indice), ok ? 1 : 0.5).strokeRoundedRect(x - 62, y - 44, 124, 104, 8)
      desenharForma(g, formaDaVaga(p.indice), x, y - 10, 16, corDaVaga(p.indice))
      this.nomes.push(this.add.text(x, y + 26, nomeNoCoracao(p.nome, 10), { fontFamily: FONTE, fontSize: '13px', color: textoDaVaga(p.indice), stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5))
      if (ok) this.nomes.push(this.add.text(x + 44, y - 30, '✓', { fontFamily: FONTE, fontSize: '20px', color: TEXTO.cura, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5))
    })
  }

  update(_, delta) {
    this.controles.atualizar()
    this.fundo?.atualizar(delta)
    if (this.saindo) return
    const d = this.controles.toque(meuLado())
    if (d === 'esquerda' || d === 'direita') {
      this.opcao = (this.opcao + 1) % OPCOES.length
      tocar(this, 'mover')
      this.atualizarTela()
    }
    let restante
    if (this.souHost) restante = restanteFim(this.fim, Date.now())
    else restante = this.restanteGuest = Math.max(0, this.restanteGuest - delta)
    const p = restante / FIM_MS
    this.barra.clear().fillStyle(0xffffff, 0.15).fillRect(LARGURA / 2 - 160, 130, 320, 5)
    this.barra.fillStyle(p < 0.3 ? 0xff5050 : 0xffe040, 1).fillRect(LARGURA / 2 - 160, 130, 320 * p, 5)
    this.status.setText(`PRÓXIMA PARTIDA  ·  ${Math.ceil(restante / 1000)}s`)
    // alguém entrou ou saiu: redesenha os cartões dos membros
    this.atualizarTela()
    if (this.souHost && fimDecidido(this.fim, this.presentes(), Date.now())) this.seguir()
  }

  estadoDebug() {
    return { escolhas: { ...this.fim.escolhas }, restante: Math.round(restanteFim(this.fim, Date.now())), presentes: this.presentes(), host: this.souHost }
  }
}
