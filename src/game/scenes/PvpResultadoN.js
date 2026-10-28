import Phaser from 'phaser'
import Controles from '../controles.js'
import { PERSONAGENS } from '../data/personagens.js'
import { criarFundo } from '../backgrounds/index.js'
import { tocar, musica } from '../audio.js'
import { FONTE, LARGURA, ALTURA, TEXTO, corTexto } from '../constants.js'
import { canal, emRede, meuIndice, meuLado, souHostDaRede, irParaCena, participantesDaPartida } from '../rede.js'
import { iniciarPartida, encerrarPartida } from '../../lib/lan/rede.js'
import { corDaVaga, textoDaVaga } from '../vagas.js'
import { desenharForma, formaDaVaga, nomeNoCoracao } from '../coop/marcadores.js'
import { prepararXpFfa, mostrarPainelXp } from '../conta/painelXp.js'
import { OPCOES_N, ROTULO, novoAceiteN, registrarN, decidirN, expirouN, dicaDoAceiteN } from '../pvp/fimDePartidaN.js'
import { fogoArtificio, chuvaConfete } from '../effects/festa.js'
import { claraoCamera } from '../effects/flash.js'

// Resultado do TODOS CONTRA TODOS (3 e 4, online; Fase 5D). A classificação do 1º ao último (pvp/ffa.js
// classificacao: quem caiu depois fica na frente; empate pelo HP, depois o dano causado), com a forma, o
// nome e o personagem de cada vaga, o dano causado e recebido, o HP que sobrou e quando cada um caiu (e
// quantas rodadas assistiu). Depois a faixa de XP (1º vitória, 2º o bônus do 2º lugar: conta/painelXp.js) e o
// fim da 2E para N (pvp/fimDePartidaN.js): REVANCHE e TROCAR PERSONAGEM só com TODOS de acordo (um TROCAR
// vale para todos; 15 s sem acordo cancela), VOLTAR AO LOBBY na hora (o do host leva todos).
//   convidado -> host   escolhaFim {escolha} · voltarLobby {}
//   host -> todos       aceiteFim {escolhas: {vaga: escolha}} (cada mudança; {} = a espera acabou)
//
//   irParaCena(this, 'PvpResultadoN', { personagens, arena, classificacao, rodadas, fim, duracao, jogadores })

const LINHA = { y: 92, altura: 54 }
const COLUNAS = { pos: 40, forma: 84, nome: 98, sprite: 290, dano: 360, recebido: 470, hp: 580, quando: 680 }

const estadoInicial = () => ({
  fundo: null,
  linhas: [],
  opcoes: [],
  cursor: null,
  avisos: [],
  dicaAceite: null,
  xp: null,
  painelXp: null,
  liberado: false,
  saindo: false,
  aceite: null,
  opcao: 0,
  desligar: [],
  ultimoSegundo: null,
})

export default class PvpResultadoN extends Phaser.Scene {
  constructor() {
    super('PvpResultadoN')
  }

  create(dados = {}) {
    Object.assign(this, estadoInicial())
    if (!emRede() || !Array.isArray(dados.jogadores)) return this.scene.start('Lan')
    this.dados = dados
    this.n = dados.jogadores.length
    this.meu = meuIndice()
    this.souHost = souHostDaRede()
    this.aceite = novoAceiteN()
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => this.aoBotao(botao))

    this.fundo = criarFundo(this, 'queen')
    this.fundo.escurecer()
    this.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000).setOrigin(0).setDepth(-4).setAlpha(0.82)
    const vencedor = dados.classificacao?.[0] ?? 0
    const t = (x, y, conteudo, tamanho, cor = TEXTO.normal) => this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 4 })
    const titulo = t(LARGURA / 2, 30, `${nomeNoCoracao(dados.jogadores[vencedor]?.nome, 10)} VENCEU!`, 30, textoDaVaga(vencedor)).setOrigin(0.5).setScale(0)
    const fim = dados.fim === 'limite' ? 'acabou no limite de rodadas (o HP decidiu)' : `o último de pé · ${dados.rodadas} rodadas`
    t(LARGURA / 2, 60, `TODOS CONTRA TODOS · ${fim}`, 11, '#ff7a9a').setOrigin(0.5)
    this.tweens.add({ targets: titulo, scale: 1, duration: 320, ease: 'Back.easeOut' })
    this.montarLinhas()
    this.montarOpcoes()

    // XP: a minha colocação vai com a classificação inteira (o servidor confere com a dos outros)
    const minha = dados.jogadores[this.meu]
    this.xp = prepararXpFfa(this, { colocacoes: dados.classificacao, colocacao: minha?.posicao, rodadas: dados.rodadas, duracao: dados.duracao, personagem: dados.personagens?.[this.meu] ?? null })
    this.ligarRede()
    musica('pvpResultado', 'vitoria')
    tocar(this, 'vitoria')
    claraoCamera(this.cameras.main, 250, 255, 255, 255)
    const chuva = chuvaConfete(this, 50)
    this.time.delayedCall(1600, () => chuva.scene && chuva.stop())
    for (let i = 0; i < 4; i++) this.time.delayedCall(300 + i * 220, () => fogoArtificio(this, 160 + i * 180, 70, corDaVaga(vencedor), { quantidade: 26 }))
    this.time.delayedCall(1700, () => this.liberar())
    this.cameras.main.fadeIn(300)
  }

  montarLinhas() {
    const t = (x, y, conteudo, tamanho, cor = TEXTO.normal) => this.add.text(x, y, conteudo, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3 }).setOrigin(0, 0.5)
    const c = COLUNAS
    t(c.dano, LINHA.y - 20, 'DANO CAUSADO', 8, TEXTO.desabilitado)
    t(c.recebido, LINHA.y - 20, 'RECEBIDO', 8, TEXTO.desabilitado)
    t(c.hp, LINHA.y - 20, 'HP', 8, TEXTO.desabilitado)
    this.dados.classificacao.forEach((j, i) => {
      const jog = this.dados.jogadores[j]
      const y = LINHA.y + 8 + i * LINHA.altura
      const cor = corDaVaga(j)
      const objs = []
      const g = this.add.graphics()
      g.fillStyle(0x0b0914, 0.85).fillRoundedRect(24, y - LINHA.altura / 2 + 3, LARGURA - 48, LINHA.altura - 6, 6)
      g.lineStyle(j === this.meu ? 3 : 1.5, cor, j === this.meu ? 1 : 0.6).strokeRoundedRect(24, y - LINHA.altura / 2 + 3, LARGURA - 48, LINHA.altura - 6, 6)
      desenharForma(g, formaDaVaga(j), c.forma, y, 7, cor)
      objs.push(g)
      objs.push(t(c.pos, y, `${jog.posicao}º`, i === 0 ? 24 : 18, i === 0 ? TEXTO.selecionado : TEXTO.normal))
      objs.push(t(c.nome, y - 8, `${nomeNoCoracao(jog.nome, 10)}${j === this.meu ? '  (VOCÊ)' : ''}`, 13, textoDaVaga(j)))
      const def = PERSONAGENS[this.dados.personagens[j]]
      objs.push(t(c.nome, y + 10, (def?.nome ?? '').toUpperCase(), 9, corTexto(def?.cor ?? 0xffffff)))
      if (this.textures.exists(this.dados.personagens[j])) objs.push(this.add.image(c.sprite, y, this.dados.personagens[j]).setScale(1).setDisplaySize(34, 40))
      objs.push(t(c.dano, y, String(jog.danoCausado ?? 0), 14, '#ffd23c'))
      objs.push(t(c.recebido, y, String(jog.danoRecebido ?? 0), 14, TEXTO.normal))
      objs.push(t(c.hp, y, `${jog.hp}/${jog.hpMax}`, 12, jog.hp > 0 ? TEXTO.cura : TEXTO.caido))
      const quando = i === 0 ? (jog.eliminado ? 'VENCEDOR\n(caiu junto: desempate)' : 'VENCEDOR') : !jog.eliminado ? 'de pé no limite' : `${jog.eliminado.motivo === 'saiu' ? 'saiu' : 'caiu'} na rodada ${jog.eliminado.rodada}\nassistiu ${jog.espectador} rodada${jog.espectador === 1 ? '' : 's'}`
      objs.push(t(c.quando, y, quando, 9, i === 0 || !jog.eliminado ? TEXTO.selecionado : TEXTO.desabilitado))
      objs.forEach((o) => {
        o.setAlpha(0)
        o.x += 40
        this.tweens.add({ targets: o, alpha: 1, x: o.x - 40, delay: 500 + (this.n - 1 - i) * 220, duration: 260, ease: 'Cubic.easeOut' })
      })
      this.linhas.push(objs)
    })
  }

  montarOpcoes() {
    const y = ALTURA - 24
    const estilo = { fontFamily: FONTE, fontSize: '15px', color: TEXTO.normal, stroke: '#000000', strokeThickness: 3 }
    this.opcoes = OPCOES_N.map((id) => this.add.text(0, y, ROTULO[id], estilo).setOrigin(0.5).setAlpha(0))
    const folga = 46
    const total = this.opcoes.reduce((s, o) => s + o.width, 0) + folga * (this.opcoes.length - 1)
    let x = LARGURA / 2 - total / 2
    for (const o of this.opcoes) {
      o.setX(x + o.width / 2)
      x += o.width + folga
    }
    this.cursor = this.add.image(0, y, 'coracao').setTint(corDaVaga(this.meu)).setAlpha(0)
    this.dicaAceite = this.add.text(LARGURA / 2, ALTURA - 50, '', { ...estilo, fontSize: '11px', color: TEXTO.selecionado }).setOrigin(0.5)
  }

  liberar() {
    if (this.liberado || this.saindo) return
    this.liberado = true
    this.painelXp = mostrarPainelXp(this, this.xp, { y: 322 })
    this.opcoes.forEach((o) => this.tweens.add({ targets: o, alpha: 1, duration: 200 }))
    this.tweens.add({ targets: this.cursor, alpha: 1, duration: 200 })
    this.atualizarOpcoes()
  }

  // ---------- rede ----------

  presentes() {
    return participantesDaPartida().map((p) => p.indice)
  }

  vagaDe(id) {
    return participantesDaPartida().find((p) => p.id === id)?.indice ?? -1
  }

  ligarRede() {
    if (this.souHost) {
      this.desligar.push(
        canal.ao('escolhaFim', (d, _c, de) => this.registrar(this.vagaDe(de), d?.escolha)),
        canal.ao('voltarLobby', () => this.voltarAoLobby()),
      )
    } else this.desligar.push(canal.ao('aceiteFim', (d) => this.aoAceite(d)))
    this.events.once('shutdown', () => this.desligar.forEach((f) => f()))
  }

  // host: guarda, manda a todos e vê se todos concordaram
  registrar(vaga, escolha) {
    if (this.saindo || vaga < 0) return
    this.aceite = registrarN(this.aceite, vaga, escolha, Date.now())
    canal.enviar('aceiteFim', null, { escolhas: { ...this.aceite.escolhas } })
    this.atualizarOpcoes()
    const acao = decidirN(this.aceite, this.presentes())
    if (acao) this.sair(acao)
  }

  aoAceite(d) {
    if (this.saindo || !d) return
    const escolhas = d.escolhas ?? {}
    this.aceite = { escolhas, ate: Object.keys(escolhas).length ? this.aceite.ate ?? Date.now() + 15000 : null }
    this.atualizarOpcoes()
  }

  escolher(id) {
    if (this.saindo) return
    if (id === 'lobby') return this.voltarAoLobby()
    if (this.aceite.escolhas[this.meu] === id) return tocar(this, 'cancelar')
    tocar(this, 'confirmar')
    if (this.souHost) return this.registrar(this.meu, id)
    this.aceite = registrarN(this.aceite, this.meu, id, Date.now())
    canal.enviar('escolhaFim', null, { escolha: id })
    this.atualizarOpcoes()
  }

  // todos concordaram: o host abre uma partida nova no servidor (XP novo) e leva todos
  sair(acao) {
    this.saindo = true
    tocar(this, 'superAtivar')
    this.cameras.main.fadeOut(250, 0, 0, 0)
    const { personagens, arena } = this.dados
    this.time.delayedCall(260, () => {
      encerrarPartida()
      iniciarPartida()
      if (acao === 'trocar') irParaCena(this, 'PvpEscolhaN')
      else irParaCena(this, 'PvpArenaN', { personagens, arena, semente: `ffa:${Date.now()}` })
    })
  }

  voltarAoLobby() {
    if (this.saindo) return
    if (!this.souHost) {
      tocar(this, 'cancelar')
      this.dicaAceite.setText('voltando ao lobby...')
      return canal.enviar('voltarLobby', null, {})
    }
    this.saindo = true
    tocar(this, 'cancelar')
    this.cameras.main.fadeOut(250, 0, 0, 0)
    this.time.delayedCall(260, () => irParaCena(this, 'Lan'))
  }

  atualizarOpcoes() {
    if (!this.opcoes.length) return
    this.opcoes.forEach((o, i) => o.setColor(i === this.opcao ? TEXTO.selecionado : this.aceite.escolhas[this.meu] === OPCOES_N[i] ? TEXTO.cura : TEXTO.normal))
    const o = this.opcoes[this.opcao]
    this.cursor.setPosition(o.x - o.width / 2 - 16, o.y)
    const quem = Object.entries(this.aceite.escolhas).map(([v, e]) => `${nomeNoCoracao(participantesDaPartida().find((p) => p.indice === Number(v))?.nome ?? `P${Number(v) + 1}`, 6)}: ${ROTULO[e]}`)
    const dica = dicaDoAceiteN(this.aceite, this.presentes(), Date.now())
    this.dicaAceite.setText([quem.join('  ·  '), dica].filter(Boolean).join('\n')).setY(quem.length ? ALTURA - 58 : ALTURA - 50)
  }

  aoBotao(botao) {
    if (this.saindo) return
    if (!this.liberado) return this.liberar()
    if (botao === 'B') return this.escolher('lobby')
    if (botao === 'A') this.escolher(OPCOES_N[this.opcao])
  }

  update(_, delta) {
    this.controles.atualizar()
    this.fundo?.atualizar(delta)
    if (this.saindo || !this.opcoes.length) return
    const direcao = this.controles.toque(meuLado())
    if (this.liberado && (direcao === 'esquerda' || direcao === 'direita')) {
      this.opcao = (this.opcao + (direcao === 'direita' ? 1 : -1) + OPCOES_N.length) % OPCOES_N.length
      tocar(this, 'mover')
      this.atualizarOpcoes()
    }
    // a espera acabou sem acordo: todos podem escolher de novo (o host avisa)
    if (this.aceite.ate != null && expirouN(this.aceite, Date.now())) {
      this.aceite = novoAceiteN()
      if (this.souHost) canal.enviar('aceiteFim', null, { escolhas: {} })
      this.atualizarOpcoes()
    } else if (this.aceite.ate != null && Math.floor(Date.now() / 1000) !== this.ultimoSegundo) {
      this.ultimoSegundo = Math.floor(Date.now() / 1000)
      this.atualizarOpcoes()
    }
    // quem saiu da sala não segura os outros
    if (this.souHost && Object.keys(this.aceite.escolhas).length) {
      const acao = decidirN(this.aceite, this.presentes())
      if (acao) this.sair(acao)
    }
  }
}
