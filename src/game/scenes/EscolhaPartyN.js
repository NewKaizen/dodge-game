import Phaser from 'phaser'
import Controles from '../controles.js'
import { PERSONAGENS } from '../data/personagens.js'
import { criarFundo } from '../backgrounds/index.js'
import { tocar, musica } from '../audio.js'
import { CORES, FONTE, LARGURA, ALTURA, TEXTO, corTexto } from '../constants.js'
import { perfilPvp, rotuloCarta } from '../pvp/perfil.js'
import { SIMBOLOS } from '../pvp/cartas.js'
import { claraoCamera } from '../effects/flash.js'
import { canal, emRede, meuIndice, meuLado, souHostDaRede, irParaCena, participantesDaPartida } from '../rede.js'
import { montarAvisos } from '../conta/avisos.js'
import { corDaVaga, textoDaVaga } from '../vagas.js'
import { criarParty, avisoRepetido } from '../coop/partyN.js'
import { desenharForma, formaDaVaga, nomeNoCoracao } from '../coop/marcadores.js'

// Area da grade de personagens e do painel de detalhes (px)
const GRADE = { topo: 70, base: 262, esquerda: 40, direita: LARGURA - 40, espaco: 10, larguraMax: 188, alturaMax: 180 }
const DETALHE = { x: 40, y: 272, largura: 440, altura: 170, linha: 17 }
const LISTA = { x: 496, y: 272, largura: LARGURA - 40 - 496, linha: 40 }
const CURSOR_MS = 300 // de quanto em quanto o meu cursor vai de novo para o host
const ESTADO_MS = 250 // de quanto em quanto o host manda a party e os cursores a todos
const CHAVE_SALVA = 'dodge-party'

const estadoInicial = () => ({
  colunas: null,
  card: null,
  cards: null,
  selos: null,
  cursores: null,
  detalhe: null,
  linhas: null,
  status: null,
})

// Escolha da party do CO-OP DE 3 E 4 (online; Fase 5B, docs/coop-cartas.md): o lobby abre aqui nos dois PCs
// (irParaCena) e cada jogador escolhe o PRÓPRIO personagem na mesma grade, vendo os cursores dos outros
// (a forma e o nome de cada vaga). Sem repetir: quem arbitra é o HOST da partida (o primeiro pedido a
// chegar leva o personagem; o resto vê "FULANO pegou X primeiro"). Confirmar é definitivo. Quando todos
// que estão na sala confirmaram, o host leva todos para a Selecao (chefe) com a party POR VAGA.
// B antes de alguém confirmar volta todos ao lobby (o convidado pede ao host).
//   convidado -> host   cursor {tela:'party', indice} (rápida) · personagem {id} · voltarLobby {}
//   host -> todos       partyEstado {c: [id|null por vaga], k: [índice do cursor por vaga]} (rápida, a cada 250 ms)
export default class EscolhaPartyN extends Phaser.Scene {
  constructor() {
    super('EscolhaPartyN')
  }

  create() {
    Object.assign(this, estadoInicial())
    if (!emRede()) return this.scene.start('Lan')
    this.ids = Object.keys(PERSONAGENS)
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => (botao === 'A' ? this.confirmar() : this.voltarPedido()))
    this.meu = meuIndice()
    this.souHost = souHostDaRede()
    this.vagas = 4
    this.party = criarParty({ vagas: this.vagas }) // (o do host é a verdade; o do convidado só mostra o que o host mandou)
    this.cursorDe = Array(this.vagas).fill(0)
    this.pedido = null // convidado: o personagem que pedi e o host ainda não confirmou
    this.aviso = null
    this.saindo = false
    this.texto = (x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) => this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, ...extra }).setOrigin(0.5)

    this.fundo = criarFundo(this, 'king')
    this.fundo.escurecer()
    this.texto(LARGURA / 2, 26, 'ESCOLHA O SEU PERSONAGEM', 26, TEXTO.normal, { strokeThickness: 4 })
    this.status = this.texto(LARGURA / 2, 52, '', 13, TEXTO.selecionado)
    this.montarGrade()
    this.montarPainel()
    this.texto(LARGURA / 2, ALTURA - 10, '← → ↑ ↓ escolher     A: confirmar (definitivo)     B: voltar ao lobby', 12, TEXTO.desabilitado, { strokeThickness: 0 })
    montarAvisos(this, { selecao: true })

    // o cursor começa no último personagem usado (ou numa posição por vaga)
    const anterior = this.ultimaParty()
    this.cursorDe[this.meu] = Math.max(0, this.ids.indexOf(anterior[this.meu])) || this.meu % this.ids.length
    this.ligarRede()
    this.atualizarTela()
    musica('selecao')
    this.cameras.main.fadeIn(250)
  }

  // ---------- rede ----------

  vagaDe(id) {
    return participantesDaPartida().find((p) => p.id === id)?.indice ?? -1
  }

  presentes() {
    return participantesDaPartida().map((p) => p.indice)
  }

  nomeDe(j) {
    return participantesDaPartida().find((p) => p.indice === j)?.nome ?? `P${j + 1}`
  }

  ligarRede() {
    const desligar = []
    if (this.souHost) {
      desligar.push(
        canal.ao('personagem', (d, _c, de) => this.pedirPersonagem(this.vagaDe(de), d?.id)),
        canal.ao('cursor', (d, _c, de) => {
          const v = this.vagaDe(de)
          if (v >= 0 && d?.tela === 'party' && this.ids[d.indice]) this.cursorDe[v] = d.indice
        }),
        canal.ao('voltarLobby', () => this.voltar()),
      )
      this.time.addEvent({ delay: ESTADO_MS, loop: true, callback: () => this.mandarEstado() })
    } else {
      desligar.push(canal.ao('partyEstado', (d) => this.aoEstado(d)))
      this.time.addEvent({ delay: CURSOR_MS, loop: true, callback: () => this.mandarCursor() })
    }
    this.events.once('shutdown', () => desligar.forEach((fn) => fn()))
    this.mandarCursor()
  }

  mandarCursor() {
    if (this.souHost || this.saindo || this.party.confirmados[this.meu]) return
    canal.enviarRapido('cursor', { tela: 'party', indice: this.cursorDe[this.meu] })
  }

  // host: a party e os cursores de todos
  mandarEstado() {
    if (this.saindo) return
    canal.enviarRapido('partyEstado', { c: [...this.party.confirmados], k: [...this.cursorDe] })
    this.atualizarTela()
    this.verSeCompleta() // (quem não confirmou pode ter saído da sala: aí a party já está completa)
  }

  // convidado: o que o host diz (a party de verdade e onde estão os cursores dos outros)
  aoEstado(d) {
    if (this.saindo || !Array.isArray(d?.c)) return
    d.c.forEach((id, v) => (this.party.confirmados[v] = this.ids.includes(id) ? id : null))
    d.k?.forEach((k, v) => {
      if (v !== this.meu && this.ids[k]) this.cursorDe[v] = k
    })
    if (this.pedido) {
      if (this.party.confirmados[this.meu] === this.pedido) this.pedido = null
      else {
        const dono = this.party.confirmados.indexOf(this.pedido)
        if (dono >= 0) {
          this.aviso = avisoRepetido(this.nomeDe(dono).toUpperCase(), PERSONAGENS[this.pedido].nome.toUpperCase())
          this.pedido = null
          tocar(this, 'erro')
        }
      }
    }
    this.atualizarTela()
  }

  // host: um pedido de personagem (de um convidado ou o meu)
  pedirPersonagem(vaga, id) {
    if (this.saindo || vaga < 0) return
    const r = this.party.confirmar(vaga, id, this.ids)
    if (!r.ok) return
    this.cursorDe[vaga] = this.ids.indexOf(id)
    if (vaga === this.meu) tocar(this, 'confirmar')
    this.mandarEstado()
    this.verSeCompleta()
  }

  // host: todos que estão na sala confirmaram -> Selecao, com a party por vaga
  verSeCompleta() {
    if (this.saindo || !this.party.completa(this.presentes())) return
    this.saindo = true
    const tamanho = Math.max(3, Math.max(...this.presentes()) + 1)
    const lista = this.party.lista(this.ids, tamanho)
    this.registry.set('party', lista)
    try {
      localStorage.setItem(CHAVE_SALVA, JSON.stringify(lista))
    } catch {
      // sem armazenamento: fica só no registry
    }
    this.status.setText('PARTY PRONTA!').setColor(TEXTO.selecionado)
    claraoCamera(this.cameras.main, 200, 255, 255, 255)
    this.mandarEstado()
    this.time.delayedCall(420, () => this.cameras.main.fadeOut(300, 0, 0, 0))
    this.time.delayedCall(780, () => irParaCena(this, 'Selecao', { party: lista, chefe: this.registry.get('chefe') }))
  }

  ultimaParty() {
    let party = this.registry.get('party')
    if (!party) {
      try {
        party = JSON.parse(localStorage.getItem(CHAVE_SALVA))
      } catch {
        party = null
      }
    }
    return Array.isArray(party) ? party.filter((id) => PERSONAGENS[id]) : []
  }

  // ---------- montagem ----------

  montarGrade() {
    const n = this.ids.length
    const g = GRADE
    this.colunas = n <= 4 ? n : n <= 10 ? Math.ceil(n / 2) : 5
    const linhas = Math.ceil(n / this.colunas)
    const largura = Math.min(g.larguraMax, (g.direita - g.esquerda - g.espaco * (this.colunas - 1)) / this.colunas)
    const altura = Math.min(g.alturaMax, (g.base - g.topo - g.espaco * (linhas - 1)) / linhas)
    const alturaTotal = linhas * altura + (linhas - 1) * g.espaco
    const topo = g.topo + (g.base - g.topo - alturaTotal) / 2
    this.card = { largura, altura }
    this.cards = this.ids.map((id, i) => {
      const def = PERSONAGENS[id]
      const linha = Math.floor(i / this.colunas)
      const coluna = i % this.colunas
      const naLinha = Math.min(this.colunas, n - linha * this.colunas)
      const x = LARGURA / 2 + (coluna - (naLinha - 1) / 2) * (largura + g.espaco)
      const y = topo + linha * (altura + g.espaco) + altura / 2
      const moldura = this.add.rectangle(x, y, largura, altura, CORES.painel, 0.88).setStrokeStyle(2, def.cor, 0.55)
      const sprite = this.add.image(x, y - 14, id)
      const escala = Math.max(1, Math.floor(Math.min((largura - 20) / sprite.width, (altura - 50) / sprite.height)))
      sprite.setScale(escala)
      sprite.escalaBase = escala
      this.add.text(x, y + altura / 2 - 28, def.nome.toUpperCase(), { fontFamily: FONTE, fontSize: def.nome.length <= 8 ? '15px' : '12px', color: corTexto(def.cor), stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
      this.add.text(x, y + altura / 2 - 11, `HP ${def.hp}`, { fontFamily: FONTE, fontSize: '11px', color: TEXTO.normal, stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5)
      // quem pegou: a forma + o nome da vaga no alto do card
      const selo = this.add.graphics().setDepth(3)
      const seloTexto = this.add.text(x, y - altura / 2 + 11, '', { fontFamily: FONTE, fontSize: '9px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(3)
      return { id, def, x, y, moldura, sprite, selo, seloTexto }
    })
    // um cursor por vaga: o coração na cor dela, num canto do card (uma vaga por canto)
    this.cursores = Array.from({ length: this.vagas }, (_, v) => ({
      coracao: this.add.image(0, 0, 'coracao').setTint(corDaVaga(v)).setScale(1.1).setDepth(5),
      forma: this.add.graphics().setDepth(5),
      realce: this.add.rectangle(0, 0, 10, 10).setStrokeStyle(v === this.meu ? 3 : 1.5, corDaVaga(v)).setDepth(4).setOrigin(0.5),
    }))
  }

  // o painel de detalhes do personagem sob o MEU cursor e a lista de quem escolheu o quê
  montarPainel() {
    const d = DETALHE
    const moldura = this.add.rectangle(d.x, d.y, d.largura, d.altura, CORES.painel, 0.9).setOrigin(0).setStrokeStyle(2, corDaVaga(this.meu), 0.8)
    const estilo = (tamanho, cor = TEXTO.normal) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor })
    this.detalhe = {
      moldura,
      cabeca: this.add.text(d.x + 10, d.y + 8, '', estilo(16)),
      numeros: this.add.text(d.x + d.largura - 10, d.y + 10, '', estilo(13)).setOrigin(1, 0),
      rotulo: this.add.text(d.x + 10, d.y + 32, '', estilo(13, TEXTO.comando)),
      linhas: Array.from({ length: 5 }, (_, k) => ({ nome: this.add.text(d.x + 20, d.y + 56 + k * d.linha, '', estilo(13)), custo: this.add.text(d.x + d.largura - 12, d.y + 56 + k * d.linha, '', estilo(13, TEXTO.comando)).setOrigin(1, 0) })),
      rodape: this.add.text(d.x + d.largura - 10, d.y + 33, '', estilo(12)).setOrigin(1, 0),
    }
    const l = LISTA
    this.add.rectangle(l.x, l.y, l.largura, d.altura, CORES.painel, 0.9).setOrigin(0).setStrokeStyle(2, 0x505050)
    this.linhas = Array.from({ length: this.vagas }, (_, v) => {
      const y = l.y + 8 + v * l.linha
      return { forma: this.add.graphics(), nome: this.add.text(l.x + 28, y + 4, '', { fontFamily: FONTE, fontSize: '13px', color: textoDaVaga(v), stroke: '#000000', strokeThickness: 3 }), escolha: this.add.text(l.x + l.largura - 10, y + 6, '', { fontFamily: FONTE, fontSize: '12px', color: TEXTO.normal, stroke: '#000000', strokeThickness: 2 }).setOrigin(1, 0), y }
    })
  }

  // ---------- jogo ----------

  confirmar() {
    if (this.saindo || this.party.confirmados[this.meu] || this.pedido) return
    const id = this.ids[this.cursorDe[this.meu]]
    if (this.party.confirmados.includes(id)) return tocar(this, 'erro')
    this.aviso = null
    if (this.souHost) return this.pedirPersonagem(this.meu, id)
    this.pedido = id
    canal.enviar('personagem', null, { id })
    tocar(this, 'confirmar')
    this.atualizarTela()
  }

  voltarPedido() {
    if (this.saindo) return
    if (this.party.confirmados.some(Boolean)) return tocar(this, 'erro')
    if (this.souHost) return this.voltar()
    tocar(this, 'cancelar')
    this.status.setText('voltando ao lobby...').setColor(TEXTO.desabilitado)
    canal.enviar('voltarLobby', null, {})
  }

  voltar() {
    if (this.saindo) return
    this.saindo = true
    tocar(this, 'cancelar')
    this.cameras.main.fadeOut(200, 0, 0, 0)
    this.time.delayedCall(220, () => irParaCena(this, 'Lan'))
  }

  mover(passo) {
    if (this.saindo || this.party.confirmados[this.meu] || this.pedido) return
    const n = this.ids.length
    this.cursorDe[this.meu] = (this.cursorDe[this.meu] + passo + n) % n
    tocar(this, 'mover')
    this.aviso = null
    this.mandarCursor()
    this.atualizarTela()
  }

  moverLinha(sentido) {
    const n = this.ids.length
    const atual = this.cursorDe[this.meu]
    const linhas = Math.ceil(n / this.colunas)
    if (linhas < 2) return
    const coluna = atual % this.colunas
    const linha = (Math.floor(atual / this.colunas) + sentido + linhas) % linhas
    let alvo = linha * this.colunas + coluna
    if (alvo >= n) alvo = sentido > 0 ? coluna : n - 1
    this.mover(alvo - atual)
  }

  // ---------- desenho ----------

  atualizarTela() {
    if (!this.cards) return
    const { largura, altura } = this.card
    const conf = this.party.confirmados
    this.cards.forEach((c) => {
      const dono = conf.indexOf(c.id)
      const escolhido = dono >= 0
      const cor = escolhido ? corDaVaga(dono) : 0xffffff
      c.moldura.setStrokeStyle(2, escolhido ? cor : c.def.cor, escolhido ? 1 : 0.55)
      c.selo.clear()
      c.seloTexto.setText(escolhido ? nomeNoCoracao(this.nomeDe(dono), 8) : '').setColor(escolhido ? textoDaVaga(dono) : '#ffffff')
      if (escolhido) desenharForma(c.selo, formaDaVaga(dono), c.x - c.seloTexto.width / 2 - 9, c.seloTexto.y, 5, cor)
      const emFoco = this.cursorDe.some((k, v) => this.ids[k] === c.id && this.presentes().includes(v))
      c.sprite.setAlpha(emFoco || escolhido ? 1 : 0.55)
    })
    // cursores: cada vaga num canto do card em que está; só quem está na sala
    const presentes = this.presentes()
    this.cursores.forEach((cur, v) => {
      const visivel = presentes.includes(v)
      const card = this.cards[this.cursorDe[v]]
      cur.coracao.setVisible(visivel)
      cur.forma.setVisible(visivel).clear()
      cur.realce.setVisible(visivel && (v === this.meu || !conf[v]))
      if (!visivel) return
      const dx = (v % 2 === 0 ? -1 : 1) * (largura / 2 - 12)
      const dy = (v < 2 ? -1 : 1) * (altura / 2 - 12)
      cur.coracao.setPosition(card.x + dx, card.y + dy).setAlpha(conf[v] ? 0.5 : 1)
      desenharForma(cur.forma, formaDaVaga(v), card.x + dx, card.y + dy - 14, 4, corDaVaga(v))
      const margem = v === this.meu ? 0 : 4 + v
      cur.realce.setPosition(card.x, card.y).setSize(largura + 6 - margem * 2, altura + 6 - margem * 2)
    })

    // detalhes do personagem sob o MEU cursor
    const id = this.ids[this.cursorDe[this.meu]]
    const def = PERSONAGENS[id]
    const d = this.detalhe
    d.cabeca.setText(`${nomeNoCoracao(this.nomeDe(this.meu), 9)}  ${def.nome.toUpperCase()}`).setColor(corTexto(def.cor))
    const perfil = perfilPvp(id)
    d.numeros.setText(`HP ${perfil.hp}`)
    d.rotulo.setText(perfil.estilo.rotulo).setColor(corTexto(perfil.estilo.cor))
    const { naipes } = perfil
    const lista = [{ nome: `♠${naipes.espadas}  ♥${naipes.copas}  ♦${naipes.ouros}  ♣${naipes.paus}`, custo: '' }, ...perfil.fortes.map((c) => ({ nome: `${rotuloCarta(c)}${SIMBOLOS[c.naipe]} ${c.nome}`, custo: String(c.custo) }))]
    d.linhas.forEach((l, k) => {
      l.nome.setText(lista[k]?.nome ?? '')
      l.custo.setText(lista[k]?.custo ?? '')
    })
    let rodape
    const dono = conf.indexOf(id)
    if (conf[this.meu]) rodape = 'PRONTO!'
    else if (this.pedido) rodape = 'pedindo ao host...'
    else if (dono >= 0) rodape = `${nomeNoCoracao(this.nomeDe(dono), 8)} já pegou`
    else rodape = 'A: escolher'
    d.rodape.setText(rodape).setColor(rodape === 'PRONTO!' ? TEXTO.cura : rodape === 'A: escolher' ? TEXTO.normal : TEXTO.caido)

    // a lista de quem está escolhendo / escolheu
    this.linhas.forEach((l, v) => {
      l.forma.clear()
      const na = presentes.includes(v)
      l.nome.setVisible(na)
      l.escolha.setVisible(na)
      if (!na) return
      desenharForma(l.forma, formaDaVaga(v), LISTA.x + 14, l.y + 12, 6, corDaVaga(v))
      l.nome.setText(nomeNoCoracao(this.nomeDe(v), 10) + (v === this.meu ? ' (VOCÊ)' : ''))
      const escolhido = conf[v]
      l.escolha.setText(escolhido ? PERSONAGENS[escolhido].nome.toUpperCase() : 'escolhendo...').setColor(escolhido ? corTexto(PERSONAGENS[escolhido].cor) : TEXTO.desabilitado)
    })

    const faltam = presentes.filter((v) => !conf[v]).length
    this.status
      .setText(conf[this.meu] ? (faltam ? `esperando ${faltam} escolher...` : '') : this.aviso ?? `você é ${nomeNoCoracao(this.nomeDe(this.meu), 9)}: escolha o seu personagem`)
      .setColor(this.aviso && !conf[this.meu] ? TEXTO.caido : TEXTO.selecionado)
  }

  update(_, delta) {
    this.controles.atualizar()
    if (!this.saindo) {
      const direcao = this.controles.toque(meuLado()) // (em rede os controles daqui comandam o meuLado())
      if (direcao === 'esquerda') this.mover(-1)
      if (direcao === 'direita') this.mover(1)
      if (direcao === 'cima') this.moverLinha(-1)
      if (direcao === 'baixo') this.moverLinha(1)
    }
    this.fundo.atualizar(delta)
  }
}
