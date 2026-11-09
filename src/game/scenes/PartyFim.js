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
import Seletor from '../party/seletor.js'
import { normalizarPlacar, ranking, lider, manchete, rotuloPontos } from '../party/placar.js'
import { desenharCoroa } from '../party/coroa.js'

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
  posDaVaga: {},
  barra: null,
  status: null,
  restanteGuest: 0,
  assinatura: '',
  seletor: null,
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
    // o placar da party (o host manda junto com esta cena: party/placar.js)
    this.placar = normalizarPlacar(this.sys.settings.data?.placar)
    this.titulo = t(LARGURA / 2, 22, this.placar.partidas ? `PARTY · ${this.placar.partidas} PARTIDA${this.placar.partidas > 1 ? 'S' : ''}` : 'PARTY', 26, TEXTO.selecionado, { strokeThickness: 5 })
    const nomeDe = (v) => nomeNoCoracao(participantesDaPartida().find((p) => p.indice === v)?.nome ?? `P${v + 1}`, 10)
    this.manchete = t(LARGURA / 2, 48, manchete(this.placar, this.presentes(), nomeDe), 13, '#ffd27a', { strokeThickness: 3 })
    this.status = t(LARGURA / 2, 86, 'PRÓXIMA PARTIDA', 14, TEXTO.normal, { strokeThickness: 3 })
    this.barra = this.add.graphics()
    this.membrosGfx = this.add.graphics()
    this.rotulos = OPCOES.map((o, i) => t(LARGURA / 2 + (i === 0 ? -130 : 130), 300, o.rotulo, 22, TEXTO.normal))
    this.cursor = this.add.image(0, 300, 'coracao').setTint(corDaVaga(this.meu)).setScale(1.3)
    t(LARGURA / 2, ALTURA - 14, '← → escolher     A: confirmar     ↑ ↓ personagem', 13, TEXTO.desabilitado, { strokeThickness: 0 })
    this.atualizarTela()
    this.mostrarGanhos()
    // a escolha de personagem da próxima partida (já começa no último usado): vale na espera
    this.seletor = new Seletor(this, { y: 396 })

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
    // na ordem do placar (o 1º à esquerda); sem partida jogada, na ordem das vagas
    const placar = this.placar
    const comPlacar = placar.partidas > 0
    const ordem = comPlacar ? ranking(placar, ps.map((p) => p.indice)) : ps.map((p) => p.indice)
    const coroa = lider(placar, ordem)
    this.posDaVaga = {}
    ordem.forEach((v, k) => {
      const p = ps.find((q) => q.indice === v)
      const x = LARGURA / 2 + (k - (ordem.length - 1) / 2) * 150
      const y = 190
      this.posDaVaga[v] = { x, y }
      const ok = this.fim.escolhas[v] === 'continuar'
      const texto = (dx, dy, s, tam, cor, origem = 0.5) => this.nomes.push(this.add.text(x + dx, y + dy, s, { fontFamily: FONTE, fontSize: `${tam}px`, color: cor, stroke: '#000000', strokeThickness: 3 }).setOrigin(origem, 0.5))
      g.fillStyle(0x0b0914, 0.85).fillRoundedRect(x - 62, y - 58, 124, 124, 8)
      g.lineStyle(v === this.meu ? 3 : 1.5, coroa === v ? 0xffd23a : corDaVaga(v), ok ? 1 : 0.5).strokeRoundedRect(x - 62, y - 58, 124, 124, 8)
      desenharForma(g, formaDaVaga(v), x, y - 26, 13, corDaVaga(v))
      texto(0, 0, nomeNoCoracao(p.nome, 10), 13, textoDaVaga(v))
      if (comPlacar) {
        texto(-52, -46, `${k + 1}º`, 13, k === 0 && coroa != null ? '#ffd23a' : '#c8c8d8', 0)
        texto(0, 24, rotuloPontos(placar.pontos[v] ?? 0), 19, '#ffffff')
        const seq = placar.sequencia[v] ?? 0
        if (seq >= 2) texto(0, 48, `${seq} SEGUIDAS`, 11, '#ff8a3a')
        else if (placar.vitorias[v]) texto(0, 48, `${placar.vitorias[v]} VITÓRIA${placar.vitorias[v] > 1 ? 'S' : ''}`, 11, '#a8a8c0')
      }
      if (coroa === v) {
        desenharCoroa(g, x, y - 64, 20)
      }
      if (ok) texto(44, -44, '✓', 20, TEXTO.cura)
    })
  }

  // o que cada um ganhou na partida que acabou: "+3" subindo do placar dele
  mostrarGanhos() {
    for (const [v, g] of Object.entries(this.placar.ganho ?? {})) {
      const pos = this.posDaVaga?.[v]
      if (!pos || !g) continue
      const t = this.add.text(pos.x + 46, pos.y + 24, `+${g}`, { fontFamily: FONTE, fontSize: '16px', color: TEXTO.cura, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(5).setAlpha(0)
      this.tweens.add({ targets: t, alpha: 1, y: pos.y + 6, delay: 350 + Number(v) * 120, duration: 300, ease: 'Back.easeOut', onStart: () => tocar(this, 'brilhoRank') })
      this.tweens.add({ targets: t, alpha: 0, delay: 2200 + Number(v) * 120, duration: 500, onComplete: () => t.destroy() })
    }
  }

  update(_, delta) {
    this.controles.atualizar()
    this.fundo?.atualizar(delta)
    if (this.saindo) return
    const d = this.controles.toque(meuLado())
    if (d === 'cima' || d === 'baixo') this.seletor?.tratar(d)
    if (d === 'esquerda' || d === 'direita') {
      this.opcao = (this.opcao + 1) % OPCOES.length
      tocar(this, 'mover')
      this.atualizarTela()
    }
    let restante
    if (this.souHost) restante = restanteFim(this.fim, Date.now())
    else restante = this.restanteGuest = Math.max(0, this.restanteGuest - delta)
    const p = restante / FIM_MS
    this.barra.clear().fillStyle(0xffffff, 0.15).fillRect(LARGURA / 2 - 160, 102, 320, 5)
    this.barra.fillStyle(p < 0.3 ? 0xff5050 : 0xffe040, 1).fillRect(LARGURA / 2 - 160, 102, 320 * p, 5)
    this.status.setText(`PRÓXIMA PARTIDA  ·  ${Math.ceil(restante / 1000)}s`)
    // alguém entrou ou saiu: redesenha os cartões dos membros
    this.atualizarTela()
    if (this.souHost && fimDecidido(this.fim, this.presentes(), Date.now())) this.seguir()
  }

  estadoDebug() {
    return { escolhas: { ...this.fim.escolhas }, restante: Math.round(restanteFim(this.fim, Date.now())), presentes: this.presentes(), host: this.souHost, picks: this.seletor?.lista() }
  }
}
