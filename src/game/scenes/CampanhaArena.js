import Phaser from 'phaser'
import Controles from '../controles.js'
import { tocar, musica } from '../audio.js'
import { FONTE, LARGURA, ALTURA } from '../constants.js'
import { menosMovimento } from '../preferencias.js'
import { PERSONAGENS } from '../data/personagens.js'
import { ESCALA } from '../arte/texturas.js'
import { SIMBOLOS } from '../pvp/cartas.js'
import { ENERGIA } from '../pvp/regras.js'
import Mao from '../entities/Mao.js'
import { garantirPapel, PAPEL, TINTA, joyDeTodos } from '../manual/paginaBase.js'
import { mundoDe, faseDe, TEXTOS } from '../campanha/mundos/index.js'
import { descreverRegra, CAIXA_CAMPANHA, VELOCIDADE_CORACAO } from '../campanha/partida.js'
import { criarEsquivaLocal, criarSimulacao, inicioDaCaixa } from '../campanha/simulacao.js'
import { ler, posicaoNoTempo, alvoNoTempo, PASSO_MS } from '../campanha/amostras.js'
import { nomeDoModelo, ataqueDaCartaNaCampanha } from '../campanha/ataques.js'
import { aoCampanha, comecarFase, jogarCarta, enviarPosicoes, terminarEsquiva, desistirDaCorrida, trapacaDev } from '../../lib/campanha.js'

// CAMPANHA: a PARTIDA de uma fase (docs/campanha.md). Quem manda é o SERVIDOR (server/campanha.js):
// daqui sai só a carta escolhida e as posições do coração (~20 Hz, em pedaços de 250 ms); a mão, a
// energia, a jogada da CPU, a semente dos ataques e o dano chegam de lá. A esquiva roda aqui com o
// MESMO modelo puro que o servidor refaz (campanha/simulacao.js): os acertos que você sente na hora
// são confirmados (ou corrigidos) pelo servidor no fim da rodada. A caixa pequena à direita repete a
// esquiva da CPU que o servidor já decidiu.
//
//   escolha: ←→ carta · A jogar · B passar a vez · esquiva: mover o coração · Esc: desistir (2×)
//   scene.start('CampanhaArena', { mundo: 1, fase: 1, escolhas })
const MINI = { escala: 0.5, x: 598, y: 112 }
const MAO_POS = { x: 362, y: 424 }
const FRASE_Y = 128
const PEDACO_MS = 250
const COR_BALA = { folha: 0x4cb878, galho: 0x8a5a3a, semente: 0xd01a33, papel: 0xfff8e8 }

const estadoInicial = () => ({
  mundo: null,
  fase: null,
  corrida: null,
  etapa: 'conectando', // conectando | escolha | enviando | revelacao | esquiva | conferindo | fim
  visao: null,
  rodadaAtual: null,
  mao: null,
  controles: null,
  hud: null,
  frase: null,
  infoCarta: null,
  balas: null,
  miniBalas: null,
  coracao: null,
  miniCoracao: null,
  esquiva: null,
  cpu: null,
  pedacos: 0,
  ultimoPedaco: 0,
  tempoEsquiva: 0,
  acertosLocais: 0,
  hpMostrado: null,
  desistir: 0,
  saindo: false,
  pararCampanha: null,
  dadosFim: null,
  escolhas: null,
  regra: null,
  caixaG: null,
  miniG: null,
  rotuloAtaque: null,
  kris: null,
  oponente: null,
  aviso: null,
  hudTextos: null,
})

export default class CampanhaArena extends Phaser.Scene {
  constructor() {
    super('CampanhaArena')
  }

  create(dados = {}) {
    Object.assign(this, estadoInicial())
    this.mundo = mundoDe(dados.mundo ?? 1)
    this.fase = faseDe(this.mundo.id, dados.fase ?? 1)
    this.escolhas = dados.escolhas ?? {}
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => this.botao(botao))
    this.controles.onPausa(() => this.pausa())
    garantirPapel(this)
    this.add.image(0, 0, PAPEL.mesa).setOrigin(0)
    this.add.image(0, 0, PAPEL.papel).setOrigin(0)
    this.montarCena()
    this.pararCampanha = aoCampanha((m) => this.aoServidor(m))
    this.events.once('shutdown', () => {
      this.pararCampanha?.()
      this.mao?.destroy()
    })
    musica(this.fase.chefe ? 'pvp_b' : 'pvp', 'jevil')
    this.cameras.main.fadeIn(260)
    comecarFase(this.mundo.id, this.fase.n)
  }

  // ---------- montagem ----------

  montarCena() {
    const estilo = (t, cor = TINTA) => ({ fontFamily: FONTE, fontSize: `${t}px`, color: cor })
    this.hud = this.add.graphics().setDepth(20)
    this.hpMostrado = { eu: null, cpu: null }
    this.add.text(LARGURA / 2, 10, `${this.fase.chefe ? 'CHEFE' : `FASE ${this.fase.n}`} · ${this.fase.nome}`, estilo(14)).setOrigin(0.5, 0).setDepth(21)
    this.regra = this.add.text(LARGURA / 2, 30, descreverRegra(this.fase.regra), { ...estilo(11, '#2f6b3a'), align: 'center', wordWrap: { width: 380 } }).setOrigin(0.5, 0).setDepth(21)
    this.frase = this.add.text(MAO_POS.x, FRASE_Y, '', { ...estilo(13), align: 'center', wordWrap: { width: 420 } }).setOrigin(0.5, 1).setDepth(25)
    this.aviso = this.add.text(LARGURA / 2, ALTURA / 2, 'conectando ao servidor da campanha…', estilo(15)).setOrigin(0.5).setDepth(40)
    this.infoCarta = this.add.text(566, 230, '', { ...estilo(12), wordWrap: { width: 262 }, lineSpacing: 3 }).setDepth(21)
    this.rotuloAtaque = this.add.text((CAIXA_CAMPANHA.esquerda + CAIXA_CAMPANHA.direita) / 2, CAIXA_CAMPANHA.base + 8, '', estilo(11, '#4e3f63')).setOrigin(0.5, 0).setDepth(21)
    this.add.text(LARGURA - 14, ALTURA - 10, 'ESC 2×: DESISTIR', estilo(10, '#6a5a80')).setOrigin(1, 1).setDepth(21)
    // as duas caixas: a sua (grande) e a da CPU (pequena, só o replay do que o servidor decidiu)
    this.caixaG = this.add.graphics().setDepth(5)
    this.balas = this.add.graphics().setDepth(8)
    this.coracao = this.add.image(0, 0, 'coracao').setTint(0xff2a3a).setScale(ESCALA.coracao).setDepth(9).setVisible(false)
    const mini = this.add.container(MINI.x - CAIXA_CAMPANHA.esquerda * MINI.escala, MINI.y - CAIXA_CAMPANHA.topo * MINI.escala).setScale(MINI.escala).setDepth(6)
    this.miniG = this.add.graphics()
    this.miniBalas = this.add.graphics()
    this.miniCoracao = this.add.image(0, 0, 'coracao').setTint(PERSONAGENS[this.fase.oponente].cor).setScale(ESCALA.coracao).setVisible(false)
    mini.add([this.miniG, this.miniBalas, this.miniCoracao])
    this.desenharCaixa(this.caixaG, CAIXA_CAMPANHA)
    this.desenharCaixa(this.miniG, CAIXA_CAMPANHA)
    const larguraMini = (CAIXA_CAMPANHA.direita - CAIXA_CAMPANHA.esquerda) * MINI.escala
    this.add.text(MINI.x + larguraMini / 2, MINI.y - 6, `a caixa de ${PERSONAGENS[this.fase.oponente].nome}`, estilo(10, '#4e3f63')).setOrigin(0.5, 1).setDepth(21)
    this.kris = this.add.image(150, CAIXA_CAMPANHA.base, this.mundo.personagem).setOrigin(0.5, 1).setScale(ESCALA.personagem).setDepth(4)
    this.oponente = this.add.image(800, 214, this.fase.oponente).setOrigin(0.5, 1).setScale(ESCALA.personagem).setFlipX(true).setDepth(4)
    this.mao = new Mao(this, { jogador: 0, x: MAO_POS.x, y: MAO_POS.y, rotulo: '', largura: 60, espacamento: 50, larguraMax: 300, profundidade: 30 })
    this.mao.setAtiva(false)
  }

  desenharCaixa(g, c) {
    g.clear()
    g.fillStyle(0x10101c, 1).fillRect(c.esquerda, c.topo, c.direita - c.esquerda, c.base - c.topo)
    g.lineStyle(4, 0xffffff, 1).strokeRect(c.esquerda - 2, c.topo - 2, c.direita - c.esquerda + 4, c.base - c.topo + 4)
  }

  desenharHud() {
    const v = this.visao
    if (!v) return
    const g = this.hud
    g.clear()
    const barra = (x, y, w, hp, max, cor, direita = false) => {
      g.fillStyle(0x2b2540, 0.85).fillRect(x, y, w, 12)
      const k = Math.max(0, Math.min(1, hp / max))
      g.fillStyle(cor, 1).fillRect(direita ? x + w * (1 - k) : x, y, w * k, 12)
      g.lineStyle(2, 0x2b2540, 1).strokeRect(x, y, w, 12)
    }
    const eu = this.hpMostrado.eu ?? v.eu
    const cpu = this.hpMostrado.cpu ?? v.cpu
    barra(24, 72, 190, eu.hp, eu.hpMax, PERSONAGENS[this.mundo.personagem].cor)
    barra(LARGURA - 214, 72, 190, cpu.hp, cpu.hpMax, PERSONAGENS[this.fase.oponente].cor, true)
    for (let k = 0; k < ENERGIA.maxima; k++) {
      g.fillStyle(k < eu.energia ? 0xffd34d : 0xc8c0b0, 1).fillCircle(30 + k * 18, 98, 6)
      g.lineStyle(1.5, 0x2b2540, 1).strokeCircle(30 + k * 18, 98, 6)
    }
    if (!this.hudTextos) {
      const estilo = { fontFamily: FONTE, fontSize: '12px', color: TINTA }
      this.hudTextos = [this.add.text(24, 56, '', estilo).setDepth(21), this.add.text(LARGURA - 24, 56, '', estilo).setOrigin(1, 0).setDepth(21), this.add.text(LARGURA / 2, 86, '', { ...estilo, fontSize: '13px' }).setOrigin(0.5, 0).setDepth(21)]
    }
    const [a, b, r] = this.hudTextos
    a.setText(`${PERSONAGENS[this.mundo.personagem].nome.toUpperCase()}  ${eu.hp}/${eu.hpMax}`)
    b.setText(`${PERSONAGENS[this.fase.oponente].nome.toUpperCase()}  ${cpu.hp}/${cpu.hpMax}`)
    r.setText(`RODADA ${v.rodada}`)
  }

  // ---------- servidor ----------

  aoServidor(m) {
    if (this.saindo) return
    if (m.t === '_fechou') return this.erroFatal('a conexão caiu: a partida da campanha foi abandonada (sem recompensa)')
    if (m.t === 'campanhaErro') {
      if (m.corrida && m.corrida === this.corrida && m.motivo === 'carta') {
        tocar(this, 'erro')
        this.frase.setText(m.msg)
        this.etapa = 'escolha'
        this.mao.setAtiva(true)
        return
      }
      if (!m.corrida || m.corrida === this.corrida) return this.erroFatal(m.msg ?? 'a campanha não está disponível agora')
      return
    }
    if (m.t === 'campanhaInicio') {
      if (this.corrida) return
      this.corrida = m.corrida
      this.aviso.setVisible(false)
      return this.novaRodada(m.rodada)
    }
    if (m.corrida !== this.corrida) return
    if (m.t === 'campanhaEsquiva') return this.revelar(m)
    if (m.t === 'campanhaRodada') return this.fimDaRodada(m)
    if (m.t === 'campanhaFim') return this.fim(m)
  }

  novaRodada(v) {
    this.visao = v
    this.hpMostrado = { eu: null, cpu: null }
    this.etapa = 'escolha'
    this.rotuloAtaque.setText('')
    this.desenharCaixa(this.caixaG, v.caixa)
    this.desenharHud()
    this.mao.limpar()
    this.mao.comprarVarias(v.eu.mao.map((c) => ({ ...c }))).then(() => {
      if (!this.scene.isActive()) return
      this.mao.setEnergia(v.eu.energia)
      this.mao.setAtiva(this.etapa === 'escolha')
      this.mostrarCarta()
    })
    this.frase.setText(v.eu.jogaveis.length ? 'escolha uma carta (A) ou passe a vez (B)' : 'nenhuma carta cabe na energia: B passa a vez (+1 de energia)')
    if (v.virou) this.regra.setText(`${TEXTOS[this.mundo.id].virada}`)
    tocar(this, 'rodada')
  }

  mostrarCarta() {
    const c = this.mao.selecionada?.dados
    if (!c || this.etapa !== 'escolha') return this.infoCarta.setText('')
    const pode = this.visao.eu.jogaveis.includes(c.id)
    // na campanha o ataque é o modelo da floresta (o efeito de suporte e o dos Ases continua o do jogo)
    const at = ataqueDaCartaNaCampanha(c)
    const efeito = c.naipe === 'copas' || c.valor === 1 ? `\n${c.descricao}` : ''
    this.infoCarta.setText(`${c.nome}  ${SIMBOLOS[c.naipe]}  (custa ${c.custo})\n${at ? `ataque: ${at.modelos.map(nomeDoModelo).join(' + ')} · ${at.dano} por acerto` : 'não manda ataque'}${efeito}${pode ? '' : '\n— falta energia'}`)
  }

  // as cartas reveladas: o servidor já resolveu a rodada; agora a esquiva começa
  revelar(m) {
    this.rodadaAtual = m
    this.etapa = 'revelacao'
    this.mao.setAtiva(false)
    this.mao.limpar()
    this.infoCarta.setText('')
    const [eu, cpu] = m.jogadas
    const nome = (j, quem) => (j.passou ? `${quem} passou a vez` : `${quem}: ${j.carta.nome} ${SIMBOLOS[j.carta.naipe]}${j.anulada ? ' (anulada)' : ''}`)
    this.frase.setText(`${nome(eu, 'você')}\n${nome(cpu, PERSONAGENS[this.fase.oponente].nome)}`)
    this.hpMostrado = { eu: { ...m.eu }, cpu: { ...m.cpu } }
    this.desenharHud()
    const at = m.ataque
    this.rotuloAtaque.setText(at ? `${at.modelos.map(nomeDoModelo).join(' + ')} · ${at.dano} de dano por acerto` : 'nenhum ataque na sua caixa')
    if (at) this.desenharCaixa(this.caixaG, at.caixa)
    this.time.delayedCall(menosMovimento() ? 700 : 1300, () => this.comecarEsquiva())
  }

  comecarEsquiva() {
    if (this.saindo || this.etapa !== 'revelacao') return
    const m = this.rodadaAtual
    this.etapa = 'esquiva'
    this.tempoEsquiva = 0
    this.acertosLocais = 0
    this.pedacos = 0
    this.ultimoPedaco = 0
    this.esquiva = m.ataque ? criarEsquivaLocal(m.ataque, { velocidade: VELOCIDADE_CORACAO }) : null
    this.coracao.setVisible(Boolean(this.esquiva))
    // a CPU: o servidor mandou o caminho dela; a caixa pequena refaz as balas com ele
    this.cpu = m.ataqueCpu ? { sim: criarSimulacao(m.ataqueCpu), amostras: ler(m.cpuAmostras) ?? [], inicio: inicioDaCaixa(m.ataqueCpu.caixa), duracao: m.ataqueCpu.duracao, real: 0 } : null
    this.miniCoracao.setVisible(Boolean(this.cpu))
    if (this.esquiva) this.frase.setText('desvie!')
    else this.frase.setText(this.cpu ? `${PERSONAGENS[this.fase.oponente].nome} desvia do seu ataque…` : 'ninguém atacou nesta rodada')
  }

  atualizarEsquiva(delta) {
    const e = this.esquiva
    if (e && !e.acabou) {
      const r = e.quadro(delta, joyDeTodos(this.controles))
      if (r.acertos) {
        this.acertosLocais += r.acertos
        tocar(this, 'dano')
        if (!menosMovimento()) this.cameras.main.shake(120, 0.004)
        const eu = this.hpMostrado.eu
        eu.hp = Math.max(0, eu.hp - r.acertos * this.rodadaAtual.ataque.dano)
        this.desenharHud()
      }
      if (r.grazes) tocar(this, 'graze')
      this.tempoEsquiva += delta
      if (this.tempoEsquiva - this.ultimoPedaco >= PEDACO_MS) this.mandarPedaco()
    }
    const c = this.cpu
    if (c && c.sim.t < c.duracao) {
      c.real += delta
      while (c.sim.t + PASSO_MS <= c.real && c.sim.t < c.duracao) {
        const t = c.sim.t + PASSO_MS
        c.sim.passo(posicaoNoTempo(c.amostras, t, c.inicio), alvoNoTempo(c.amostras, t, c.inicio))
      }
    }
    this.desenharBalas()
    const fimEu = !e || e.acabou
    const fimCpu = !c || c.sim.t >= c.duracao
    if (fimEu && fimCpu) this.terminarEsquiva()
  }

  mandarPedaco() {
    this.ultimoPedaco = this.tempoEsquiva
    let a = this.esquiva.gravador.tirar()
    // SÓ NO DEV: as trapaças do teste de navegador (o servidor tem de recusar)
    if (trapacaDev() === 'teleporte' && this.pedacos === 2 && a.length >= 6) {
      const cx = this.rodadaAtual.ataque.caixa
      a = [...a]
      a[4] = a[4] > ((cx.esquerda + cx.direita) / 2) * 10 ? (cx.esquerda + 12) * 10 : (cx.direita - 12) * 10
    }
    enviarPosicoes(this.corrida, this.rodadaAtual.rodada, this.pedacos++, a)
  }

  terminarEsquiva() {
    this.etapa = 'conferindo'
    if (this.esquiva) this.mandarPedaco()
    this.coracao.setVisible(false)
    this.miniCoracao.setVisible(false)
    this.balas.clear()
    this.miniBalas.clear()
    this.frase.setText('o servidor está conferindo a rodada…')
    terminarEsquiva(this.corrida, this.rodadaAtual.rodada, trapacaDev() === 'semAcertos' ? 0 : this.acertosLocais)
  }

  fimDaRodada(m) {
    const r = m.resumo
    const nome = PERSONAGENS[this.fase.oponente].nome
    const partes = [`você levou ${r.acertos} acerto${r.acertos === 1 ? '' : 's'}`, `${nome} levou ${r.cpu.acertos}`]
    if (r.acertos > this.acertosLocais) partes.push(`(o servidor contou ${r.acertos - this.acertosLocais} a mais)`)
    this.frase.setText(partes.join(' · '))
    if (r.cpu.acertos) tocar(this, 'impacto')
    if (r.virou) {
      this.regra.setText(TEXTOS[this.mundo.id].virada)
      tocar(this, 'superAtivar')
      if (!menosMovimento()) this.cameras.main.flash(260, 255, 255, 255)
    }
    this.hpMostrado = { eu: r.eu, cpu: r.adversario }
    this.visao = { ...this.visao, eu: { ...this.visao.eu, ...r.eu }, cpu: { ...this.visao.cpu, ...r.adversario } }
    this.desenharHud()
    if (m.proxima) this.time.delayedCall(menosMovimento() ? 500 : 1100, () => !this.saindo && this.novaRodada(m.proxima))
    else this.etapa = 'fim'
  }

  fim(m) {
    this.etapa = 'fim'
    this.saindo = true
    this.dadosFim = m
    this.time.delayedCall(m.resultado === 'vitoria' ? 900 : 600, () => {
      this.cameras.main.fadeOut(240, 0, 0, 0)
      this.time.delayedCall(260, () => this.scene.start('CampanhaFim', { mundo: this.mundo.id, fase: this.fase.n, fim: m, escolhas: this.escolhas }))
    })
  }

  erroFatal(msg) {
    if (this.saindo) return
    this.saindo = true
    this.mao.setAtiva(false)
    this.aviso.setText(`${msg}\n\nA ou B: voltar ao mapa`).setVisible(true).setAlign('center').setWordWrapWidth(600)
    this.etapa = 'erro'
  }

  // ---------- desenho das balas ----------

  desenharBalas() {
    const g = this.balas
    g.clear()
    const e = this.esquiva
    if (e) {
      this.pintar(g, e.sim.lista, this.rodadaAtual.ataque.caixa)
      this.coracao.setPosition(e.coracao.x, e.coracao.y).setAlpha(e.sim.invencivel > 0 && Math.floor(this.time.now / 80) % 2 ? 0.35 : 1)
    }
    const c = this.cpu
    this.miniBalas.clear()
    if (c) {
      this.pintar(this.miniBalas, c.sim.lista, this.rodadaAtual.ataqueCpu.caixa)
      const p = posicaoNoTempo(c.amostras, c.sim.t, c.inicio)
      this.miniCoracao.setPosition(p.x, p.y)
    }
  }

  pintar(g, lista, caixa) {
    for (const b of lista) {
      const avisando = b.idade < b.aviso
      const fora = b.x + b.raio < caixa.esquerda || b.x - b.raio > caixa.direita || b.y + b.raio < caixa.topo || b.y - b.raio > caixa.base
      if (fora) continue
      const cor = COR_BALA[b.extra?.tipo] ?? 0xffffff
      if (avisando && b.extra?.linha) {
        const { x, y, dx, dy } = b.extra.linha
        g.lineStyle(1.5, 0xd01a33, Math.sin(b.idade / 45) > 0 ? 0.8 : 0.35)
        for (let k = 0; k < 12; k++) g.lineBetween(x + dx * k * 22, y + dy * k * 22, x + dx * (k * 22 + 11), y + dy * (k * 22 + 11))
      }
      g.fillStyle(cor, avisando ? 0.5 : 1).fillCircle(b.x, b.y, b.raio)
      g.lineStyle(1.5, 0x2b2540, 1).strokeCircle(b.x, b.y, b.raio)
    }
  }

  // ---------- entrada ----------

  botao(botao) {
    if (this.etapa === 'erro') return this.voltarAoMapa()
    if (this.etapa !== 'escolha' || this.saindo) return
    if (botao === 'A') {
      const c = this.mao.selecionada?.dados
      if (!c || !this.visao.eu.jogaveis.includes(c.id)) {
        tocar(this, 'erro')
        return this.frase.setText(c ? 'falta energia para essa carta' : 'escolha uma carta')
      }
      this.enviarCarta(c.id)
    } else if (botao === 'B') this.enviarCarta(null)
  }

  enviarCarta(id) {
    this.etapa = 'enviando'
    this.mao.setAtiva(false)
    tocar(this, id ? 'cartaSelecionar' : 'passar')
    this.frase.setText(id ? 'carta jogada!' : 'você passou a vez')
    jogarCarta(this.corrida, id)
  }

  pausa() {
    if (this.saindo) return this.etapa === 'erro' && this.voltarAoMapa()
    const agora = this.time.now
    if (agora - this.desistir < 2000) {
      if (this.corrida) desistirDaCorrida(this.corrida)
      return this.voltarAoMapa()
    }
    this.desistir = agora
    this.frase.setText('Esc de novo para desistir (a partida não conta)')
  }

  voltarAoMapa() {
    this.saindo = true
    this.cameras.main.fadeOut(220, 0, 0, 0)
    this.time.delayedCall(240, () => this.scene.start('Campanha', { mundo: this.mundo.id, fase: this.fase.n }))
  }

  update(_, delta) {
    if (!this.controles) return
    this.controles.atualizar()
    if (this.etapa === 'esquiva') return this.atualizarEsquiva(delta)
    if (this.etapa === 'escolha') {
      for (let j = 0; j < this.controles.numJogadores; j++) {
        const d = this.controles.toque(j)
        if (d === 'esquerda' || d === 'direita') {
          this.mao.mover(d === 'direita' ? 1 : -1)
          this.mostrarCarta()
        }
      }
    }
  }
}

