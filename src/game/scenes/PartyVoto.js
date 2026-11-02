import Phaser from 'phaser'
import Controles from '../controles.js'
import { ARENAS, ARENA } from '../pvp/arenas.js'
import { CHEFES, ORDEM_CHEFES } from '../coop/chefes/index.js'
import { criarRng } from '../pvp/baralho.js'
import { criarFundo } from '../backgrounds/index.js'
import { ESCALA } from '../arte/texturas.js'
import { tocar, musica } from '../audio.js'
import { estilhacos } from '../effects/entrada.js'
import { claraoCamera } from '../effects/flash.js'
import { fatores } from '../acessibilidade.js'
import { CORES, DIFICULDADES, FONTE, LARGURA, ALTURA, TEXTO, corTexto } from '../constants.js'
import { canal, emRede, meuIndice, meuLado, souHostDaRede, irParaCena, participantesDaPartida } from '../rede.js'
import { iniciarPartida, partyModo, encerrarParty } from '../../lib/lan/rede.js'
import { corDaVaga } from '../vagas.js'
import { desenharForma, formaDaVaga } from '../coop/marcadores.js'
import { desenharIcone } from './PvpVoto.js'
import { MODOS_PARTY, VOTO_MS, ehPvp, opcoesDeModo, sortearTres, novaVotacao, votar, votacaoAcabou, apurar, restanteVoto } from '../party/regras.js'
import { vigiarParty } from '../party/cliente.js'
import Seletor, { CHAVE_SALVA, ultimaParty } from '../party/seletor.js'
import { montarInicio } from '../party/escolha.js'
import { PERSONAGENS } from '../data/personagens.js'
import { timesDoArranjo } from '../../lib/times2x2.js'
import { get } from 'svelte/store'
import { lan } from '../../lib/lan/rede.js'

// MODO PARTY: a votação (docs/online.md "Modo Party"). A mesma cena serve às duas votações:
//   { fase: 'modo', opcoes, id }          2x2 (só com 4) · TODOS CONTRA TODOS · CO-OP
//   { fase: 'mapa', modo, opcoes, id }    3 arenas (PVP) ou 3 chefes (CO-OP: o chefe é o "mapa")
// Cada um move o próprio coração (←/→) e vota com A; dá para trocar o voto até o tempo (10 s)
// acabar ou todos votarem. O voto de cada um aparece como a forma + cor da vaga embaixo do cartão.
// Quem não votou não conta; empate = roleta rápida entre as empatadas (sem giro com "reduzir
// animações": só o destaque). O HOST da party conta o tempo, apura (o sorteio é só dele) e leva todos
// para a próxima tela; os outros só mandam o voto.
//   convidado -> host   partyVoto {id, opcao}
//   host -> todos       partyVotos {id, votos: {vaga: opcao}, restante} · partyApuracao {id, ...apurar()}
// No dev: window.partyVoto (votar(opcao), estadoDebug()).

const CARTAO = { y: 196, largura: 210, altura: 224, espaco: 34 }
const ESTADO_MS = 1000 // de quanto em quanto o host manda os votos (e o tempo) de novo
const FUNDO_MODO = 'queen'

const estadoInicial = () => ({
  cartoes: [],
  fundo: null,
  fundoId: null,
  votacao: null,
  apurando: false,
  saindo: false,
  cursor: 0,
  coracao: null,
  barra: null,
  status: null,
  dica: null,
  restanteGuest: 0,
  seletor: null,
})

export default class PartyVoto extends Phaser.Scene {
  constructor() {
    super('PartyVoto')
  }

  init(dados) {
    Object.assign(this, estadoInicial())
    this.dados = dados ?? {}
  }

  create() {
    if (!emRede() || !Array.isArray(this.dados.opcoes) || !this.dados.opcoes.length) return this.scene.start('Lan')
    this.fase = this.dados.fase === 'mapa' ? 'mapa' : 'modo'
    this.modo = this.dados.modo ?? null
    this.opcoes = this.dados.opcoes
    this.idVoto = String(this.dados.id ?? '')
    this.meu = meuIndice()
    this.souHost = souHostDaRede()
    this.calmo = !fatores().piscar // "reduzir animações": sem giro na roleta
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => botao === 'A' && this.votar(this.opcoes[this.cursor]))
    this.votacao = novaVotacao({ opcoes: this.opcoes, eleitores: this.presentes(), agora: Date.now() })
    this.restanteGuest = VOTO_MS

    this.veu = this.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000, 0.5).setOrigin(0).setDepth(-4)
    this.texto = (x, y, conteudo, tamanho, cor = TEXTO.normal, extra = {}) =>
      this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3, ...extra }).setOrigin(0.5)
    const titulo = this.fase === 'modo' ? 'PARTY  ·  VOTE NO MODO' : this.modo === 'coop4' ? 'PARTY  ·  VOTE NO CHEFE' : 'PARTY  ·  VOTE NA ARENA'
    this.titulo = this.texto(LARGURA / 2, 22, titulo, 24, TEXTO.normal, { strokeThickness: 4 })
    this.status = this.texto(LARGURA / 2, 46, '', 12, TEXTO.selecionado)
    this.barra = this.add.graphics().setDepth(2)
    this.montarCartoes()
    this.coracao = this.add.image(0, 0, 'coracao').setTint(corDaVaga(this.meu)).setScale(1.4).setDepth(8)
    this.dica = this.texto(LARGURA / 2, ALTURA - 14, '← → escolher     A: votar (dá para trocar)     ↑ ↓ personagem', 13, TEXTO.desabilitado, { strokeThickness: 0 })
    this.trocarFundo()
    this.atualizarTela()

    this.ligarRede()
    // o personagem da partida se escolhe aqui, na espera (party/seletor.js): depois do mapa a partida começa direto
    this.seletor = new Seletor(this, { y: 408 })
    vigiarParty(this)
    if (import.meta.env.DEV) window.partyVoto = this
    this.events.once('shutdown', () => {
      this.fundo?.destruir()
      if (window.partyVoto === this) delete window.partyVoto
    })
    musica('pvpEscolha')
    this.cameras.main.fadeIn(250)
  }

  // ---------- rede ----------

  presentes() {
    return participantesDaPartida().map((p) => p.indice)
  }

  vagaDe(id) {
    return participantesDaPartida().find((p) => p.id === id)?.indice ?? -1
  }

  ligarRede() {
    const desligar = []
    if (this.souHost) {
      desligar.push(canal.ao('partyVoto', (d, _c, de) => d?.id === this.idVoto && this.registrar(this.vagaDe(de), d.opcao)))
      this.time.addEvent({ delay: ESTADO_MS, loop: true, callback: () => this.mandarVotos() })
    } else {
      desligar.push(
        canal.ao('partyVotos', (d) => {
          if (d?.id !== this.idVoto || this.apurando) return
          this.votacao = { ...this.votacao, votos: { ...(d.votos ?? {}) } }
          if (Number.isFinite(d.restante)) this.restanteGuest = d.restante
          this.atualizarTela()
        }),
        canal.ao('partyApuracao', (d) => d?.id === this.idVoto && this.revelar(d)),
      )
    }
    this.events.once('shutdown', () => desligar.forEach((fn) => fn()))
  }

  mandarVotos() {
    if (this.apurando || this.saindo) return
    canal.enviar('partyVotos', null, { id: this.idVoto, votos: { ...this.votacao.votos }, restante: restanteVoto(this.votacao, Date.now()) })
  }

  // host: o voto de uma vaga (o meu ou o que chegou)
  registrar(vaga, opcao) {
    if (this.apurando || vaga < 0) return
    const antes = this.votacao
    this.votacao = votar(this.votacao, vaga, opcao, Date.now())
    if (this.votacao === antes) return
    if (vaga !== this.meu) tocar(this, 'mover')
    this.mandarVotos()
    this.atualizarTela()
  }

  votar(opcao) {
    if (this.apurando || this.saindo || !this.opcoes.includes(opcao)) return
    if (this.votacao.votos[this.meu] === opcao) return
    tocar(this, 'confirmar')
    const cartao = this.cartoes[this.opcoes.indexOf(opcao)]
    this.tweens.add({ targets: cartao.c, scale: 1.12, duration: 90, yoyo: true })
    if (this.souHost) return this.registrar(this.meu, opcao)
    // (o convidado já mostra o próprio voto; o host confirma no próximo partyVotos)
    this.votacao = { ...this.votacao, votos: { ...this.votacao.votos, [this.meu]: opcao } }
    canal.enviar('partyVoto', null, { id: this.idVoto, opcao })
    this.atualizarTela()
  }

  // ---------- montagem ----------

  infoDe(id) {
    if (this.fase === 'modo') {
      const m = MODOS_PARTY[id]
      return { nome: m.rotulo, sub: m.sub, cor: m.cor }
    }
    if (this.modo === 'coop4') {
      const def = CHEFES[id]
      const dif = DIFICULDADES[def?.dificuldade]
      return { nome: (def?.nome ?? id).toUpperCase(), sub: dif?.rotulo ?? '', cor: dif ? parseInt(dif.cor.slice(1), 16) : 0xffffff }
    }
    const a = ARENA[id]
    return { nome: a?.nome ?? id, sub: a?.tituloMusica ? `♪ ${a.tituloMusica}` : '', cor: a?.cor ?? 0xffffff }
  }

  montarCartoes() {
    const n = this.opcoes.length
    const total = n * CARTAO.largura + (n - 1) * CARTAO.espaco
    this.cartoes = this.opcoes.map((id, i) => {
      const info = this.infoDe(id)
      const x = (LARGURA - total) / 2 + CARTAO.largura / 2 + i * (CARTAO.largura + CARTAO.espaco)
      const c = this.add.container(x, CARTAO.y).setDepth(3)
      const brilho = this.add.rectangle(0, 0, CARTAO.largura + 12, CARTAO.altura + 12, info.cor, 0).setStrokeStyle(3, info.cor, 0)
      const moldura = this.add.rectangle(0, 0, CARTAO.largura, CARTAO.altura, CORES.painel, 0.9).setStrokeStyle(2, info.cor, 0.6)
      const faixa = this.add.rectangle(0, CARTAO.altura / 2 - 34, CARTAO.largura - 8, 52, info.cor, 0.18)
      const arte = this.montarArte(id, info.cor)
      const nome = this.add.text(0, CARTAO.altura / 2 - 44, info.nome, { fontFamily: FONTE, fontSize: info.nome.length > 12 ? '15px' : '20px', color: corTexto(info.cor), stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5)
      const sub = this.add.text(0, CARTAO.altura / 2 - 20, info.sub, { fontFamily: FONTE, fontSize: '11px', color: '#d8d8e8', stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5)
      if (sub.width > CARTAO.largura - 12) sub.setFontSize(9)
      const votos = this.add.graphics()
      c.add([brilho, moldura, faixa, ...arte, nome, sub, votos])
      return { id, x, c, brilho, moldura, votos, cor: info.cor }
    })
  }

  // o desenho do cartão: o ícone do modo, o da arena ou o chefe
  montarArte(id, cor) {
    if (this.fase === 'mapa' && this.modo === 'coop4') {
      const def = CHEFES[id]
      return def && this.textures.exists(def.sprite) ? [this.add.image(0, -40, def.sprite).setScale(ESCALA.chefe * 0.62)] : []
    }
    const g = this.add.graphics()
    if (this.fase === 'mapa') {
      g.setScale(1.8)
      desenharIcone(g, id, 0, -22, cor)
      return [g]
    }
    // modo: as formas de quem joga (2x2: duas duplas; todos: quatro soltos; CO-OP: todos contra o chefe)
    const r = 13
    if (id === '2x2') {
      ;[0, 1].forEach((v) => desenharForma(g, formaDaVaga(v), -58 + v * 30, -40, r, corDaVaga(v)))
      ;[2, 3].forEach((v) => desenharForma(g, formaDaVaga(v), 28 + (v - 2) * 30, -40, r, corDaVaga(v)))
      g.lineStyle(3, 0xffffff, 0.8).lineBetween(-8, -52, 8, -28).lineBetween(8, -52, -8, -28)
    } else if (id === 'ffa') {
      ;[0, 1, 2, 3].forEach((v) => desenharForma(g, formaDaVaga(v), (v % 2 ? 1 : -1) * 34, -62 + Math.floor(v / 2) * 44, r, corDaVaga(v)))
      g.lineStyle(3, 0xffffff, 0.8).lineBetween(-10, -50, 10, -30).lineBetween(10, -50, -10, -30)
    } else {
      g.fillStyle(cor, 0.9).fillTriangle(0, -86, -20, -56, 20, -56)
      g.fillStyle(0xffe040, 1).fillRect(-16, -92, 32, 6)
      ;[0, 1, 2, 3].forEach((v) => desenharForma(g, formaDaVaga(v), -51 + v * 34, -26, 11, corDaVaga(v)))
    }
    return [g]
  }

  // o fundo acompanha o cartão em foco (arena: o fundo dela; chefe: o dele; modo: um fixo)
  trocarFundo() {
    const id = this.opcoes[this.cursor]
    const fundoId = this.fase === 'modo' ? FUNDO_MODO : this.modo === 'coop4' ? id : `arena-${id}`
    if (fundoId === this.fundoId) return
    this.fundoId = fundoId
    this.fundo?.destruir()
    this.fundo = criarFundo(this, fundoId)
    if (this.fase === 'modo') this.fundo.escurecer?.()
  }

  // ---------- tela ----------

  atualizarTela() {
    const meuVoto = this.votacao.votos[this.meu]
    this.cartoes.forEach((c, i) => {
      const foco = i === this.cursor && !this.apurando
      const votado = meuVoto === c.id
      c.brilho.setStrokeStyle(3, c.cor, foco ? 0.9 : votado ? 0.5 : 0).setFillStyle(c.cor, foco ? 0.16 : 0)
      c.moldura.setStrokeStyle(2, c.cor, foco || votado ? 1 : 0.6)
      if (!this.apurando) c.c.setScale(foco ? 1.06 : 1).setY(CARTAO.y - (foco ? 6 : 0))
      // os votos: forma + cor de cada vaga que votou aqui
      const vagas = Object.entries(this.votacao.votos)
        .filter(([, o]) => o === c.id)
        .map(([v]) => Number(v))
        .sort((a, b) => a - b)
      c.votos.clear()
      vagas.forEach((v, k) => {
        const x = (k - (vagas.length - 1) / 2) * 30
        c.votos.fillStyle(0x000000, 0.6).fillCircle(x, CARTAO.altura / 2 + 22, 13)
        desenharForma(c.votos, formaDaVaga(v), x, CARTAO.altura / 2 + 22, 9, corDaVaga(v))
        if (v === this.meu) c.votos.lineStyle(2, 0xffffff, 1).strokeCircle(x, CARTAO.altura / 2 + 22, 14)
      })
    })
    if (this.apurando) return
    const total = this.votacao.eleitores.length
    const votaram = Object.keys(this.votacao.votos).length
    this.status.setText(`${votaram}/${total} votaram`)
  }

  update(time, delta) {
    this.controles.atualizar()
    this.fundo?.atualizar(delta)
    if (this.apurando || this.saindo) return
    const d = this.controles.toque(meuLado())
    if (d === 'esquerda' || d === 'direita') {
      this.cursor = (this.cursor + (d === 'direita' ? 1 : -1) + this.opcoes.length) % this.opcoes.length
      tocar(this, 'mover')
      this.trocarFundo()
      this.atualizarTela()
    }
    if (d === 'cima' || d === 'baixo') this.seletor?.tratar(d)
    const c = this.cartoes[this.cursor]
    this.coracao.setPosition(c.x, c.c.y - CARTAO.altura / 2 - 16 + Math.sin(time / 200) * 2)
    // o tempo: o do host vale (o convidado acerta o dele a cada partyVotos)
    let restante
    if (this.souHost) restante = restanteVoto(this.votacao, Date.now())
    else restante = this.restanteGuest = Math.max(0, this.restanteGuest - delta)
    const p = restante / VOTO_MS
    this.barra.clear().fillStyle(0xffffff, 0.15).fillRect(LARGURA / 2 - 160, 60, 320, 5)
    this.barra.fillStyle(p < 0.3 ? 0xff5050 : 0xffe040, 1).fillRect(LARGURA / 2 - 160, 60, 320 * p, 5)
    if (this.souHost && votacaoAcabou(this.votacao, this.presentes(), Date.now())) this.apurarHost()
  }

  // ---------- apuração ----------

  apurarHost() {
    if (this.apurando) return
    // (no dev, window.partySemente fixa o sorteio do empate: os testes de 4 abas)
    const semente = (import.meta.env.DEV && window.partySemente) || `party:${this.idVoto}:${Date.now()}`
    const r = apurar(this.votacao, this.presentes(), criarRng(semente))
    canal.enviar('partyApuracao', null, { id: this.idVoto, ...r })
    this.revelar(r)
  }

  async revelar(r) {
    if (this.apurando || !this.opcoes.includes(r?.vencedora)) return
    this.apurando = true
    this.votacao = { ...this.votacao, votos: { ...(r.votos ?? {}) } }
    this.coracao.setVisible(false)
    this.dica.setText('')
    this.barra.clear()
    this.atualizarTela()
    const esperar = (ms) => new Promise((ok) => this.time.delayedCall(ms, ok))
    const empate = (r.empatadas?.length ?? 0) > 1
    this.status.setText(empate ? (Object.keys(r.votos ?? {}).length ? 'EMPATE! ROLETA!' : 'NINGUÉM VOTOU: ROLETA!') : 'APURAÇÃO!')
    this.tweens.add({ targets: this.status, scale: { from: 1.4, to: 1 }, duration: 200, ease: 'Back.easeOut' })
    await esperar(350)
    if (empate && !this.calmo) await this.roleta(r.empatadas, r.voltas, esperar)
    await this.destacar(r.vencedora, esperar)
    if (this.souHost) this.seguir(r.vencedora)
  }

  realcar(id) {
    for (const c of this.cartoes) {
      const sim = c.id === id
      c.brilho.setStrokeStyle(3, c.cor, sim ? 1 : 0).setFillStyle(c.cor, sim ? 0.28 : 0)
      c.c.setScale(sim ? 1.1 : 1).setY(CARTAO.y - (sim ? 8 : 0))
    }
  }

  async roleta(empatadas, voltas, esperar) {
    tocar(this, 'roletaGiro', { duracao: 1.4 })
    let atraso = 60
    for (let k = 0; k <= voltas; k++) {
      this.realcar(empatadas[k % empatadas.length])
      tocar(this, 'roleta')
      await esperar(atraso)
      atraso = Math.min(320, atraso * 1.18)
    }
    tocar(this, 'roletaFim')
  }

  async destacar(id, esperar) {
    const cartao = this.cartoes.find((c) => c.id === id)
    this.realcar(id)
    this.cartoes.forEach((c) => c !== cartao && this.tweens.add({ targets: c.c, alpha: 0.25, duration: 300 }))
    tocar(this, 'impacto')
    if (!this.calmo) {
      claraoCamera(this.cameras.main, 140, 255, 255, 255)
      estilhacos(this, cartao.x, CARTAO.y, { quantidade: 24, cores: [cartao.cor, 0xffffff], profundidade: 11, duracao: 600 })
    }
    this.tweens.add({ targets: cartao.c, scale: 1.18, duration: 220, ease: 'Back.easeOut' })
    this.status.setText(this.infoDe(id).nome)
    tocar(this, 'fanfarra')
    await esperar(1400)
    this.cameras.main.fadeOut(260, 0, 0, 0)
    await esperar(280)
  }

  // host: a próxima tela, em todos
  seguir(vencedora) {
    if (this.saindo) return
    this.saindo = true
    const n = this.presentes().length
    if (this.fase === 'modo') {
      partyModo(vencedora) // o servidor fica sabendo o modo (o XP e a sala do 2x2 dependem dele)
      const anterior = this.registry.get('partyAnterior') ?? {}
      const pool = vencedora === 'coop4' ? ORDEM_CHEFES : ARENAS.map((a) => a.id)
      const opcoes = sortearTres(pool, vencedora === 'coop4' ? anterior.chefe : anterior.arena, criarRng(`party:mapa:${Date.now()}`))
      return irParaCena(this, 'PartyVoto', { fase: 'mapa', modo: vencedora, opcoes, id: `m${Date.now()}` })
    }
    // o modo ainda cabe na sala (alguém pode ter saído): senão, vota o modo de novo
    if (!opcoesDeModo(n).includes(this.modo)) {
      if (!opcoesDeModo(n).length) {
        encerrarParty()
        return irParaCena(this, 'Lan')
      }
      return irParaCena(this, 'PartyVoto', { fase: 'modo', opcoes: opcoesDeModo(n), id: `v${Date.now()}` })
    }
    const anterior = this.registry.get('partyAnterior') ?? {}
    this.registry.set('partyAnterior', ehPvp(this.modo) ? { ...anterior, arena: vencedora } : { ...anterior, chefe: vencedora })
    this.registry.set('modo', this.modo)
    iniciarPartida() // a partida de verdade começa aqui (o servidor registra com o modo votado)
    this.comecarPartida(vencedora)
  }

  // host: direto para a partida com os personagens escolhidos na espera (sem a cena de escolha de personagem);
  // o nível do CO-OP vai pré-escolhido no último usado (a Dificuldade confirma sozinha em 3 s)
  comecarPartida(vencedora) {
    const ids = Object.keys(PERSONAGENS)
    const ultima = ultimaParty(this.registry)
    const { cena, dados, lista } = montarInicio({
      modo: this.modo,
      vencedora,
      picks: this.seletor?.picks ?? {},
      presentes: this.presentes(),
      ids,
      ultima,
      times: this.modo === '2x2' ? timesDoArranjo(get(lan).sala?.arranjo) : null,
      nivel: this.registry.get('nivel'),
    })
    this.registry.set('party', lista)
    try {
      localStorage.setItem(CHAVE_SALVA, JSON.stringify(lista))
    } catch {
      // sem armazenamento: fica só no registry
    }
    irParaCena(this, cena, dados)
  }

  // testes/console
  estadoDebug() {
    return { fase: this.fase, modo: this.modo, opcoes: [...this.opcoes], votos: { ...this.votacao.votos }, eleitores: [...this.votacao.eleitores], apurando: this.apurando, cursor: this.opcoes[this.cursor], host: this.souHost, picks: this.seletor?.lista() }
  }
}
