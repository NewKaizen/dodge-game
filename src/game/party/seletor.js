import { PERSONAGENS } from '../data/personagens.js'
import { FONTE, LARGURA, TEXTO, corTexto } from '../constants.js'
import { tocar } from '../audio.js'
import { canal, meuIndice, souHostDaRede, participantesDaPartida } from '../rede.js'
import { corDaVaga, textoDaVaga } from '../vagas.js'
import { desenharForma, formaDaVaga, nomeNoCoracao } from '../coop/marcadores.js'
import { iniciarPicks, vizinho, pedir } from './escolha.js'

// MODO PARTY: o seletor de personagem das telas de espera (CONTINUAR e as duas votações), docs/online.md
// "Modo Party". Uma faixa de cartinhas, uma por jogador (forma + cor da vaga, retrato e nome do personagem);
// a minha tem ▲ ▼ e muda com ↑/↓ (a votação usa ←/→ + A, então não há choque). A regra é a de party/escolha.js.
//   convidado -> host   partyPick {id}
//   host -> todos       partyPicks {picks: {vaga: id}}  (a cada mudança e a cada segundo: quem entra recebe)
// Os picks ficam no registry ('partyPicks'), então atravessam as cenas da party.
export const CHAVE_SALVA = 'dodge-party' // a lista da última partida (a mesma do EscolhaPartyN)
const ESTADO_MS = 1000
const PENDENTE_MS = 900 // o convidado ignora o host por este tempo depois de trocar (o pedido ainda está indo)
const CHIP = { largura: 190, altura: 54, espaco: 10, retrato: 42 }

// a lista por vaga da última partida (registry; senão o localStorage); só ids que existem
export function ultimaParty(registry) {
  let lista = registry.get('party')
  if (!Array.isArray(lista)) {
    try {
      lista = JSON.parse(localStorage.getItem(CHAVE_SALVA))
    } catch {
      lista = null
    }
  }
  return Array.isArray(lista) ? lista.map((id) => (PERSONAGENS[id] ? id : null)) : []
}

export default class Seletor {
  // cena: a cena da party; y: o centro vertical da faixa
  constructor(cena, { y }) {
    this.cena = cena
    this.y = y
    this.ids = Object.keys(PERSONAGENS)
    this.meu = meuIndice()
    this.souHost = souHostDaRede()
    this.ultima = ultimaParty(cena.registry)
    this.pendente = null
    this.assinatura = ''
    this.picks = this.normalizar(cena.registry.get('partyPicks') ?? {})
    cena.registry.set('partyPicks', this.picks)
    this.montar()
    this.ligar()
    this.desenhar()
  }

  presentes() {
    return participantesDaPartida().map((p) => p.indice)
  }

  // quem saiu perde o pick; quem entrou ganha o padrão; os válidos ficam
  normalizar(anteriores) {
    return iniciarPicks({ presentes: this.presentes(), ids: this.ids, anteriores, ultima: this.ultima })
  }

  // ---------- rede ----------

  ligar() {
    const cena = this.cena
    const desligar = []
    if (this.souHost) {
      desligar.push(canal.ao('partyPick', (d, _c, de) => this.aoPedido(participantesDaPartida().find((p) => p.id === de)?.indice ?? -1, d?.id)))
      cena.time.addEvent({ delay: ESTADO_MS, loop: true, callback: () => this.mandar() })
    } else {
      desligar.push(canal.ao('partyPicks', (d) => this.aoEstado(d)))
    }
    cena.events.once('shutdown', () => desligar.forEach((fn) => fn()))
    if (this.souHost) this.mandar()
  }

  // host: manda os picks de todos (e reaproveita para pôr quem entrou / tirar quem saiu)
  mandar() {
    this.picks = this.normalizar(this.picks)
    this.cena.registry.set('partyPicks', this.picks)
    canal.enviar('partyPicks', null, { picks: { ...this.picks } })
    this.desenhar()
  }

  aoPedido(vaga, id) {
    const r = pedir(this.picks, vaga, id, this.ids, this.presentes())
    if (r.ok) {
      this.picks = r.picks
      this.mandar()
    }
  }

  // convidado: o que o host diz (o meu pick fica como está enquanto o pedido ainda está indo)
  aoEstado(d) {
    if (!d?.picks) return
    const novo = {}
    for (const [v, id] of Object.entries(d.picks)) if (this.ids.includes(id)) novo[Number(v)] = id
    if (this.pendente && Date.now() < this.pendente.ate && novo[this.meu] !== this.pendente.id) novo[this.meu] = this.pendente.id
    else this.pendente = null
    this.picks = novo
    this.cena.registry.set('partyPicks', this.picks)
    this.desenhar()
  }

  // ---------- entrada ----------

  // ↑/↓ (a cena manda a direção do toque); devolve se usou
  tratar(direcao) {
    if (direcao !== 'cima' && direcao !== 'baixo') return false
    const id = vizinho(this.picks, this.meu, direcao === 'cima' ? -1 : 1, this.ids)
    if (id === this.picks[this.meu]) {
      tocar(this.cena, 'erro')
      return true
    }
    tocar(this.cena, 'mover')
    if (this.souHost) {
      this.aoPedido(this.meu, id)
      return true
    }
    this.picks = { ...this.picks, [this.meu]: id }
    this.pendente = { id, ate: Date.now() + PENDENTE_MS }
    this.cena.registry.set('partyPicks', this.picks)
    canal.enviar('partyPick', null, { id })
    this.desenhar()
    return true
  }

  // ---------- desenho ----------

  montar() {
    const c = this.cena
    this.gfx = c.add.graphics().setDepth(6)
    this.legenda = c.add.text(LARGURA / 2, this.y - CHIP.altura / 2 - 12, 'PERSONAGEM DA PRÓXIMA PARTIDA   ▲ ▼ troca o seu', { fontFamily: FONTE, fontSize: '11px', color: TEXTO.desabilitado, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(6)
    this.chips = Array.from({ length: 4 }, () => ({
      retrato: c.add.image(0, 0, 'coracao').setDepth(7).setVisible(false),
      jogador: c.add.text(0, 0, '', { fontFamily: FONTE, fontSize: '10px', stroke: '#000000', strokeThickness: 3 }).setDepth(7),
      personagem: c.add.text(0, 0, '', { fontFamily: FONTE, fontSize: '15px', stroke: '#000000', strokeThickness: 3 }).setDepth(7),
      setas: c.add.text(0, 0, '▲\n▼', { fontFamily: FONTE, fontSize: '11px', color: TEXTO.selecionado, align: 'center', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(7),
    }))
  }

  // os picks de quem está na sala, lidos pelos testes de navegador (window.partyVoto/partyFim.estadoDebug)
  lista() {
    return { ...this.picks }
  }

  desenhar() {
    if (!this.gfx?.scene) return
    const ps = participantesDaPartida()
    const assinatura = JSON.stringify([ps.map((p) => [p.indice, p.nome]), this.picks])
    if (assinatura === this.assinatura) return
    this.assinatura = assinatura
    const g = this.gfx.clear()
    const n = ps.length
    const total = n * CHIP.largura + (n - 1) * CHIP.espaco
    this.chips.forEach((chip, k) => {
      const p = ps[k]
      const visivel = Boolean(p)
      for (const o of Object.values(chip)) o.setVisible(visivel)
      if (!p) return
      const x = (LARGURA - total) / 2 + k * (CHIP.largura + CHIP.espaco)
      const meu = p.indice === this.meu
      const id = this.picks[p.indice]
      const def = PERSONAGENS[id]
      g.fillStyle(0x0b0914, 0.88).fillRoundedRect(x, this.y - CHIP.altura / 2, CHIP.largura, CHIP.altura, 8)
      g.lineStyle(meu ? 3 : 1.5, corDaVaga(p.indice), meu ? 1 : 0.7).strokeRoundedRect(x, this.y - CHIP.altura / 2, CHIP.largura, CHIP.altura, 8)
      desenharForma(g, formaDaVaga(p.indice), x + 14, this.y - 14, 6, corDaVaga(p.indice))
      chip.retrato.setTexture(id).setPosition(x + 46, this.y)
      chip.retrato.setScale(Math.min(CHIP.retrato / chip.retrato.width, CHIP.retrato / chip.retrato.height))
      chip.jogador.setText(nomeNoCoracao(p.nome, 10)).setColor(textoDaVaga(p.indice)).setPosition(x + 76, this.y - CHIP.altura / 2 + 7)
      chip.personagem.setText(def.nome.toUpperCase()).setColor(corTexto(def.cor)).setPosition(x + 76, this.y + 2)
      chip.setas.setPosition(x + CHIP.largura - 12, this.y).setVisible(meu)
    })
  }
}
