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
import { joyDeTodos } from '../manual/paginaBase.js'
import { fatores } from '../acessibilidade.js'
import { desenharCenario } from '../campanha/desenharCenario.js'
import { criarEco } from '../campanha/eco.js'
import { semLigaduras } from '../campanha/texto.js'
import { NOME_SILENCIO } from '../campanha/CaixaDeDialogo.js'
import { mundoDe, faseDe, TEXTOS, libertosAte } from '../campanha/mundos/index.js'
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
// esquiva da CPU que o servidor já decidiu. O fundo é o lugar da fase (campanha/cenario.js) e o
// oponente é um ECO (campanha/eco.js): apagado, com a imagem dupla.
//
//   escolha: ←→ carta · A jogar · B passar a vez · esquiva: mover o coração · Esc: desistir (2×)
//   scene.start('CampanhaArena', { mundo: 1, fase: 1, escolhas })
const MINI = { escala: 0.5, x: 598, y: 112 }
const MAO_POS = { x: 362, y: 424 }
const FRASE_Y = 128
const PEDACO_MS = 250
// as balas, por dentro com os nomes antigos: cinzas (folha), paredes (galho), olhares (semente), mariposas (papel)
// e os novos: feixes de luz (feixe) e estilhaços de cristal (estilhaco)
const COR_BALA = { folha: 0xc8c4d8, galho: 0x3fb3a8, semente: 0xe03048, papel: 0xe0b84a, feixe: 0xf2e2b0, estilhaco: 0x9fe0ff }
// os balões das falas durante a luta: o lado do oponente (e do Silêncio) e o lado da Kris (os amigos)
const BALAO = { oponente: { x: LARGURA - 16, y: ALTURA - 26, largura: 240 }, amigos: { x: 16, y: ALTURA - 26, largura: 186 } }
const BALAO_MS = 2600
const TINTA = '#e8e4f4'
const COR_TEXTO = { tema: '#8fb8c0', apagado: '#8a86a0', dica: '#6a6680' }

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
  cenario: null,
  eco: null,
  turma: null,
  baloes: null,
  ditas: null,
  perfeitos: 0,
  furia: false,
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
    this.cenario = desenharCenario(this, TEXTOS[this.mundo.id].fases[this.fase.id]?.cenario ?? 'mapa', { profundidade: -10, brilho: 0.8, veu: 0.3, partida: true })
    // o escuro descendo de cima, atrás do HUD (em degradê): o texto fica legível sobre qualquer lugar
    for (let k = 0; k < 8; k++) this.add.rectangle(0, 0, LARGURA, 40 + k * 12, 0x000000, 0.09).setOrigin(0).setDepth(1)
    this.montarCena()
    this.pararCampanha = aoCampanha((m) => this.aoServidor(m))
    this.events.once('shutdown', () => {
      this.pararCampanha?.()
      this.mao?.destroy()
    })
    musica('campanha2', 'campanha')
    this.cameras.main.fadeIn(260)
    comecarFase(this.mundo.id, this.fase.n)
  }

  // ---------- montagem ----------

  montarCena() {
    const estilo = (t, cor = TINTA) => ({ fontFamily: FONTE, fontSize: `${t}px`, color: cor })
    this.hud = this.add.graphics().setDepth(20)
    this.hpMostrado = { eu: null, cpu: null }
    this.add.text(LARGURA / 2, 10, `${this.fase.chefe ? 'CHEFE' : `FASE ${this.fase.n}`} · ${this.fase.nome}`, estilo(14)).setOrigin(0.5, 0).setDepth(21)
    this.regra = this.add.text(LARGURA / 2, 30, semLigaduras(TEXTOS[this.mundo.id].fases[this.fase.id]?.tema ?? descreverRegra(this.fase.regra)), { ...estilo(11, COR_TEXTO.tema), align: 'center', wordWrap: { width: 400 } }).setOrigin(0.5, 0).setDepth(21)
    this.frase = this.add.text(MAO_POS.x, FRASE_Y, '', { ...estilo(13), align: 'center', wordWrap: { width: 420 } }).setOrigin(0.5, 1).setDepth(25)
    this.aviso = this.add.text(LARGURA / 2, ALTURA / 2, 'conectando ao servidor da campanha…', estilo(15)).setOrigin(0.5).setDepth(40)
    this.infoCarta = this.add.text(566, 230, '', { ...estilo(12), wordWrap: { width: 262 }, lineSpacing: 3 }).setDepth(21)
    this.rotuloAtaque = this.add.text((CAIXA_CAMPANHA.esquerda + CAIXA_CAMPANHA.direita) / 2, CAIXA_CAMPANHA.base + 8, '', estilo(11, COR_TEXTO.apagado)).setOrigin(0.5, 0).setDepth(21)
    this.add.text(LARGURA - 14, ALTURA - 6, 'ESC 2×: DESISTIR', estilo(10, COR_TEXTO.dica)).setOrigin(1, 1).setDepth(21)
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
    this.add.text(MINI.x + larguraMini / 2, MINI.y - 6, `a caixa do eco de ${PERSONAGENS[this.fase.oponente].nome}`, estilo(10, COR_TEXTO.apagado)).setOrigin(0.5, 1).setDepth(21)
    this.kris = this.add.image(150, CAIXA_CAMPANHA.base, this.mundo.personagem).setOrigin(0.5, 1).setScale(ESCALA.personagem).setDepth(4)
    // a torcida: quem já foi libertado fica atrás da Kris, com cor, e pula quando você manda bem
    this.turma = libertosAte(this.mundo.id, this.fase.n).map((p, i) => this.add.image(104 - (i % 3) * 30, CAIXA_CAMPANHA.base - 4 - Math.floor(i / 3) * 10, p).setOrigin(0.5, 1).setScale(ESCALA.personagem * 0.62).setDepth(3.9 - Math.floor(i / 3) * 0.1))
    this.baloes = { oponente: null, amigos: null }
    this.ditas = new Set()
    this.eco = criarEco(this, 800, 214, this.fase.oponente, { escala: ESCALA.personagem, profundidade: 4, alpha: 0.62, flipX: true })
    this.oponente = this.eco.corpo
    this.mao = new Mao(this, { jogador: 0, x: MAO_POS.x, y: MAO_POS.y, rotulo: '', largura: 60, espacamento: 50, larguraMax: 300, profundidade: 30 })
    this.mao.setAtiva(false)
  }

  // ---------- falas durante a luta (só sabor) ----------

  // um balão de fala: o oponente e o Silêncio à direita, os amigos à esquerda
  falar(fala, { atraso = 0 } = {}) {
    if (!fala) return
    const mostrar = () => {
      if (this.saindo || !this.scene.isActive()) return
      const silencio = fala.quem === 'silencio'
      const lado = silencio || fala.quem === this.fase.oponente ? 'oponente' : 'amigos'
      const b = BALAO[lado]
      this.baloes[lado]?.destroy()
      const nome = silencio ? NOME_SILENCIO : (PERSONAGENS[fala.quem]?.nome ?? fala.quem).toUpperCase()
      const preso = !silencio && fala.quem === this.fase.oponente
      const cor = silencio ? '#d8b8ff' : preso ? '#bcd4dc' : TINTA
      const t = this.add
        .text(b.x, b.y, `${nome}\n${semLigaduras(fala.texto)}`, { fontFamily: FONTE, fontSize: silencio ? '13px' : '12px', color: cor, backgroundColor: silencio ? '#160a24' : '#000000', padding: { x: 8, y: 6 }, wordWrap: { width: b.largura - 16 }, lineSpacing: 3, align: lado === 'oponente' ? 'right' : 'left' })
        .setOrigin(lado === 'oponente' ? 1 : 0, 1)
        .setDepth(26)
      this.baloes[lado] = t
      if (!menosMovimento()) {
        t.setAlpha(0).setY(b.y + 6)
        this.tweens.add({ targets: t, alpha: 1, y: b.y, duration: 180 })
      }
      if (silencio && !menosMovimento() && fatores().tremor > 0) this.cameras.main.shake(160, 0.002 * fatores().tremor)
      if (lado === 'amigos') this.pularTurma(fala.quem)
      this.time.delayedCall(BALAO_MS, () => {
        if (this.baloes[lado] !== t) return
        this.baloes[lado] = null
        if (menosMovimento()) return t.destroy()
        this.tweens.add({ targets: t, alpha: 0, duration: 250, onComplete: () => t.destroy() })
      })
    }
    if (atraso) this.time.delayedCall(atraso, mostrar)
    else mostrar()
  }

  // a fala da luta de um momento (inicio, ferido, quase, voceMal, perfeito), uma vez por partida
  // (o perfeito pode voltar, mas não seguido)
  falaDaLuta(momento, op = {}) {
    if (this.ditas.has(momento)) return
    const falas = TEXTOS[this.mundo.id].fases[this.fase.id]?.luta?.[momento]
    if (!falas?.length) return
    this.ditas.add(momento)
    // o amigo que torce precisa estar livre (senão, fala o próprio oponente)
    const fala = falas[0]
    if (fala.quem !== 'silencio' && fala.quem !== this.fase.oponente && !this.turma.some((o) => o.texture.key === fala.quem)) return
    this.falar(fala, op)
  }

  // os amigos libertados pulam (todos, ou só quem falou)
  pularTurma(quem = null) {
    if (menosMovimento()) return
    for (const o of this.turma ?? []) {
      if (quem && o.texture.key !== quem) continue
      if (o.getData('pulando')) continue
      o.setData('pulando', true)
      const y = o.y
      this.tweens.add({ targets: o, y: y - 10, duration: 140, yoyo: true, ease: 'Quad.easeOut', onComplete: () => (o.setY(y), o.setData('pulando', false)) })
    }
  }

  // um texto que sobe e some (PERFEITO!, dano no oponente)
  subir(x, y, texto, cor, tamanho = 16) {
    const t = this.add.text(x, y, texto, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(27)
    if (menosMovimento()) return this.time.delayedCall(900, () => t.destroy())
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 1000, delay: 250, ease: 'Quad.easeOut', onComplete: () => t.destroy() })
  }

  desenharCaixa(g, c) {
    g.clear()
    g.fillStyle(0x000000, 1).fillRect(c.esquerda, c.topo, c.direita - c.esquerda, c.base - c.topo)
    g.lineStyle(2, 0xffffff, 1).strokeRect(c.esquerda - 1, c.topo - 1, c.direita - c.esquerda + 2, c.base - c.topo + 2)
  }

  desenharHud() {
    const v = this.visao
    if (!v) return
    const g = this.hud
    g.clear()
    const barra = (x, y, w, hp, max, cor, direita = false) => {
      g.fillStyle(0x14121e, 0.95).fillRect(x, y, w, 10)
      const k = Math.max(0, Math.min(1, hp / max))
      g.fillStyle(cor, 0.9).fillRect(direita ? x + w * (1 - k) : x, y, w * k, 10)
      g.lineStyle(1, 0xffffff, 0.6).strokeRect(x, y, w, 10)
    }
    const eu = this.hpMostrado.eu ?? v.eu
    const cpu = this.hpMostrado.cpu ?? v.cpu
    barra(24, 72, 190, eu.hp, eu.hpMax, PERSONAGENS[this.mundo.personagem].cor)
    barra(LARGURA - 214, 72, 190, cpu.hp, cpu.hpMax, this.furia ? 0xd0485a : this.visao?.virou ? 0xb070e8 : 0x8fb8c0, true)
    for (let k = 0; k < ENERGIA.maxima; k++) {
      g.fillStyle(k < eu.energia ? 0xe0b84a : 0x2a2838, 1).fillCircle(30 + k * 18, 98, 5)
      if (k < eu.energia) g.lineStyle(1, 0xf2e2b0, 0.8).strokeCircle(30 + k * 18, 98, 5)
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
    if (v.virou) this.regra.setText(semLigaduras(TEXTOS[this.mundo.id].virada))
    if (v.furia) this.regra.setText(semLigaduras(TEXTOS[this.mundo.id].furia ?? ''))
    if (v.rodada === 1) this.falaDaLuta('inicio', { atraso: 500 })
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
        if (!menosMovimento() && fatores().tremor > 0) this.cameras.main.shake(120, 0.004 * fatores().tremor)
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
    const textos = TEXTOS[this.mundo.id]
    if (r.cpu.acertos) {
      tocar(this, 'impacto')
      this.subir(this.oponente.x, this.oponente.y - 90, `-${r.cpu.dano}`, '#f2e2b0', 18)
      this.pularTurma()
      if (!menosMovimento()) this.tweens.add({ targets: this.oponente, x: this.oponente.x + 6, duration: 50, yoyo: true, repeat: 2 })
    }
    // desviou de tudo: PERFEITO! (a torcida comemora)
    if (this.rodadaAtual?.ataque && r.acertos === 0) {
      const cx = this.rodadaAtual.ataque.caixa
      this.subir((cx.esquerda + cx.direita) / 2, (cx.topo + cx.base) / 2, 'PERFEITO!', '#f2e2b0', 20)
      tocar(this, 'brilhoRank')
      this.pularTurma()
      this.perfeitos++
      if (this.perfeitos === 2 || this.perfeitos === 5) {
        this.ditas.delete('perfeito')
        this.falaDaLuta('perfeito', { atraso: 300 })
      }
    }
    if (r.virou) {
      this.regra.setText(semLigaduras(textos.virada))
      tocar(this, 'superAtivar')
      if (!menosMovimento() && fatores().clarao >= 1) this.cameras.main.flash(420, 110, 90, 50)
      // a porta se abre: os amigos libertados gritam, um de cada vez
      const gritos = (textos.viradaFalas ?? []).filter((f) => this.turma.some((o) => o.texture.key === f.quem))
      gritos.forEach((f, i) => this.falar(f, { atraso: 200 + i * 650 }))
      this.ditas.add('ferido')
    }
    if (r.furia) {
      this.furia = true
      this.regra.setText(semLigaduras(textos.furia ?? ''))
      tocar(this, 'superAtivar')
      if (!menosMovimento() && fatores().clarao >= 1) this.cameras.main.flash(380, 140, 30, 50)
      if (!menosMovimento() && fatores().tremor > 0) this.cameras.main.shake(420, 0.006 * fatores().tremor)
      this.oponente.setTint(0xd07090)
      this.falar(textos.furiaFala, { atraso: 300 })
      this.ditas.add('quase')
    }
    const cpuHp = r.adversario
    const euHp = r.eu
    if (!r.vencedor) {
      if (cpuHp.hp > 0 && cpuHp.hp <= cpuHp.hpMax * 0.25) this.falaDaLuta('quase', { atraso: 350 })
      else if (cpuHp.hp > 0 && cpuHp.hp <= cpuHp.hpMax * 0.5 && !this.fase.regra?.virada) this.falaDaLuta('ferido', { atraso: 350 })
      if (euHp.hp > 0 && euHp.hp <= euHp.hpMax * 0.35) this.falaDaLuta('voceMal', { atraso: 900 })
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
      // o feixe de luz: contorno piscando enquanto avisa; depois aceso, com brilho
      if (b.tipo === 'retangulo') {
        const x = b.x - b.largura / 2
        const y = b.y - b.altura / 2
        const cor = COR_BALA[b.extra?.tipo] ?? 0xffffff
        if (avisando) {
          const k = b.idade / b.aviso
          g.fillStyle(cor, 0.05 + 0.12 * k).fillRect(x, y, b.largura, b.altura)
          g.lineStyle(1, cor, Math.sin(b.idade / (40 * fatores().pulso)) > 0 ? 0.9 : 0.35).strokeRect(x, y, b.largura, b.altura)
        } else {
          const v = b.extra?.vertical
          g.fillStyle(cor, 0.25).fillRect(v ? x - 4 : x, v ? y : y - 4, b.largura + (v ? 8 : 0), b.altura + (v ? 0 : 8))
          g.fillStyle(cor, 1).fillRect(x, y, b.largura, b.altura)
          g.fillStyle(0xffffff, 0.9).fillRect(v ? b.x - 3 : x, v ? y : b.y - 3, v ? 6 : b.largura, v ? b.altura : 6)
        }
        continue
      }
      // o cristal que vai estourar: um losango que cresce enquanto avisa
      if (avisando && b.extra?.tipo === 'estilhaco' && b.extra.centro) {
        const r = 4 + 9 * (b.idade / b.aviso)
        const { x, y } = b.extra.centro
        g.fillStyle(COR_BALA.estilhaco, 0.12).fillCircle(x, y, r + 6)
        g.fillStyle(COR_BALA.estilhaco, Math.sin(b.idade / (50 * fatores().pulso)) > 0 ? 0.9 : 0.55).fillTriangle(x, y - r, x + r * 0.6, y, x - r * 0.6, y).fillTriangle(x, y + r, x + r * 0.6, y, x - r * 0.6, y)
        continue
      }
      const fora = b.x + b.raio < caixa.esquerda || b.x - b.raio > caixa.direita || b.y + b.raio < caixa.topo || b.y - b.raio > caixa.base
      if (fora) continue
      const cor = COR_BALA[b.extra?.tipo] ?? 0xffffff
      if (avisando && b.extra?.linha) {
        const { x, y, dx, dy } = b.extra.linha
        g.lineStyle(1, 0xe03048, Math.sin(b.idade / (45 * fatores().pulso)) > 0 ? 0.8 : 0.35)
        for (let k = 0; k < 12; k++) g.lineBetween(x + dx * k * 22, y + dy * k * 22, x + dx * (k * 22 + 11), y + dy * (k * 22 + 11))
      }
      g.fillStyle(cor, avisando ? 0.08 : 0.18).fillCircle(b.x, b.y, b.raio + 3)
      g.fillStyle(cor, avisando ? 0.5 : 1).fillCircle(b.x, b.y, b.raio)
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

  update(tempo, delta) {
    if (!this.controles) return
    this.controles.atualizar()
    this.cenario?.atualizar(delta)
    this.eco?.atualizar(tempo)
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

