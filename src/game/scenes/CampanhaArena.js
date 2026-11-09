import Phaser from 'phaser'
import Controles from '../controles.js'
import { tocar, musica, tocarMusicaEspecial, voltarMusicaNormal } from '../audio.js'
import { FONTE, LARGURA, ALTURA, CENTRO_X, CORES } from '../constants.js'
import { menosMovimento } from '../preferencias.js'
import { PERSONAGENS } from '../data/personagens.js'
import { ESCALA } from '../arte/texturas.js'
import { SIMBOLOS, ehSuper } from '../pvp/cartas.js'
import Mao from '../entities/Mao.js'
import Carta from '../entities/Carta.js'
import Inimigo from '../entities/Inimigo.js'
import BattleBox from '../entities/BattleBox.js'
import HudPvp from '../pvp/HudPvp.js'
import { numero } from '../effects/numero.js'
import { joyDeTodos } from '../manual/paginaBase.js'
import { fatores } from '../acessibilidade.js'
import { CHEFES } from '../coop/chefes/index.js'
import { QUADRO } from '../coop/quadro.js'
import { TAMANHO_CARTA } from '../attacks/arremesso.js'
import { desenharCenario } from '../campanha/desenharCenario.js'
import { criarEco } from '../campanha/eco.js'
import { semLigaduras } from '../campanha/texto.js'
import { NOME_SILENCIO } from '../campanha/CaixaDeDialogo.js'
import { mundoDe, faseDe, TEXTOS, libertosAte } from '../campanha/mundos/index.js'
import { descreverRegra } from '../campanha/luta.js'
import { criarQuadro, limitesDoQuadro } from '../campanha/quadro.js'
import { PASSO_MS } from '../campanha/amostras.js'
import { criarMedo } from '../campanha/medo.js'
import { criarTita } from '../campanha/tita.js'
import { aoCampanha, comecarFase, jogarCarta, enviarPosicoes, terminarEsquiva, desistirDaCorrida, trapacaDev } from '../../lib/campanha.js'
import { entrarNoJogo, voltarAoMenu, informarVida, levouGolpe, venceu } from '../../lib/saida.js'

// CAMPANHA: a LUTA de uma fase (docs/campanha.md), no jeito do CO-OP: o CHEFE no alto, a carta dele
// (a intenção, com o naipe à vista) embaixo, o QUADRO grande onde você (e a CPU aliada) desviam do
// ataque de verdade da carta dele, e as suas cartas voando no chefe depois. Quem manda é o SERVIDOR
// (server/campanha.js, campanha/luta.js sobre coop/regras.js): daqui sai a carta escolhida e a sua
// posição a cada passo da esquiva; a mão, a energia, a carta do chefe, a da aliada, a semente e o
// dano chegam de lá. O quadro roda aqui com o MESMO código que o servidor refaz (campanha/quadro.js),
// na BattleBox de verdade (recorte e faixa de aproximação como no CO-OP).
//
//   escolha: ←→ carta · A jogar · B passar a vez · esquiva: mover o coração · Esc: desistir (2×)
//   scene.start('CampanhaArena', { mundo: 1, fase: 1, escolhas })
const CHEFE = { x: CENTRO_X, y: 196 }
// a carta do chefe (a intenção) fica ao lado dele: embaixo do chefe ficam a frase e a descrição da carta
const INTENCAO = { x: CENTRO_X + 92, y: 204 }
const LARGURA_INTENCAO = 46
const MAO_POS = { x: CENTRO_X, y: 432 }
const MAO_FORA = ALTURA + 90
const PERSONAGEM = [
  { x: 64, y: 330 },
  { x: LARGURA - 64, y: 330 },
]
// a carta de cada um carregando (em cima do personagem) até o contra-ataque
const ARMADA = [
  { x: 64, y: 196 },
  { x: LARGURA - 64, y: 196 },
]
const ESCALA_ARMADA = 0.75
const LARGURA_CARTA = 82 // as cartas da mão (maiores que no PvP: é uma mão só)
const PEDACO_MS = 250
const BALAO = { oponente: { x: LARGURA - 16, y: ALTURA - 16, largura: 210 }, amigos: { x: 16, y: ALTURA - 16, largura: 186 } }
const BALAO_MS = 2600
const TINTA = '#e8e4f4'
const COR_TEXTO = { tema: '#8fb8c0', apagado: '#8a86a0', dica: '#6a6680', ouro: '#f2e2b0', aviso: '#ff8a8a' }
const TINTA_ECO = 0xc8b8f0 // o chefe é um eco (possuído pelo Silêncio): frio e violeta
const BORDA_MEDO = 0x8a1028
const NOMES_ESPECIAIS = { espelho: 'ESPELHO!', anular: 'ANULAR!', roubo: 'ROUBO!', segundaChance: 'SEGUNDA CHANCE!' }
const DESTINOS = { refletida: 'REFLETIU!', anulada: 'ANULADA!', roubada: 'ROUBADA!', varrida: 'O SUPER VARREU!' }

const misturar = (a, b, k) => {
  const c = (s) => [(s >> 16) & 255, (s >> 8) & 255, s & 255]
  const [x, y] = [c(a), c(b)]
  return x.reduce((acc, v, i) => (acc << 8) | Math.round(v + (y[i] - v) * k), 0)
}

const estadoInicial = () => ({
  mundo: null,
  fase: null,
  def: null,
  corrida: null,
  etapa: 'conectando', // conectando | escolha | enviando | revelacao | abrindo | esquiva | conferindo | golpes | fim | erro
  visao: null,
  rodadaAtual: null,
  controles: null,
  mao: null,
  huds: null,
  inimigo: null,
  ecoChefe: null,
  tita: null,
  intencao: null,
  rotuloIntencao: null,
  frase: null,
  aviso: null,
  infoCarta: null,
  infoQuadro: null,
  caixa: null,
  coracoes: null,
  personagens: null,
  armadas: null,
  quadro: null,
  real: 0,
  pedacos: 0,
  ultimoPedaco: 0,
  acertosLocais: 0,
  desistir: 0,
  saindo: false,
  pararCampanha: null,
  escolhas: null,
  cenario: null,
  medo: null,
  baloes: null,
  ditas: null,
  perfeitos: 0,
  arremesso: null,
  falasTita: 0,
  musicaEspecial: false,
  turma: null,
})

export default class CampanhaArena extends Phaser.Scene {
  constructor() {
    super('CampanhaArena')
  }

  create(dados = {}) {
    Object.assign(this, estadoInicial())
    this.mundo = mundoDe(dados.mundo ?? 1)
    this.fase = faseDe(this.mundo.id, dados.fase ?? 1)
    this.def = CHEFES[this.fase.inimigo]
    this.escolhas = dados.escolhas ?? {}
    this.controles = new Controles(this)
    this.controles.onBotao((_, botao) => this.botao(botao))
    this.controles.onPausa(() => this.pausa())
    this.cenario = desenharCenario(this, this.textosDaFase?.cenario ?? 'mapa', { profundidade: -10, brilho: 0.8, veu: 0.35, partida: true })
    for (let k = 0; k < 6; k++) this.add.rectangle(0, 0, LARGURA, 30 + k * 14, 0x000000, 0.1).setOrigin(0).setDepth(-6)
    this.montar()
    this.pararCampanha = aoCampanha((m) => this.aoServidor(m))
    // joystick serial: GAME, o meu HP no OLED e o BUZZER (HP baixo, K.O., SUPER do chefe, vitória), em todo
    // joystick deste PC (a campanha é de um jogador só)
    entrarNoJogo({ umJogador: true })
    this.events.once('shutdown', () => {
      voltarAoMenu()
      this.pararCampanha?.()
      this.mao?.destroy()
      this.limparArremesso()
      this.limparArmadas()
      this.quadro?.parar()
      this.quadro = null
      this.caixa?.destruir()
      this.medo?.destruir()
      if (this.musicaEspecial) voltarMusicaNormal()
    })
    musica(this.def.musica ?? 'campanha_luta', 'campanha2')
    this.cameras.main.fadeIn(260)
    comecarFase(this.mundo.id, this.fase.n)
  }

  get textosDaFase() {
    return TEXTOS[this.mundo.id]?.fases?.[this.fase.id] ?? null
  }

  // ---------- montagem ----------

  montar() {
    const estilo = (t, cor = TINTA, extra = {}) => ({ fontFamily: FONTE, fontSize: `${t}px`, color: cor, stroke: '#000000', strokeThickness: 3, ...extra })
    // o título da fase e a regra, no meio do alto (os placares ficam nos cantos)
    this.add.text(CENTRO_X, 4, `${this.fase.chefe ? 'ÚLTIMA PORTA' : `PORTA ${this.fase.n}`} · ${this.fase.nome}`, estilo(12)).setOrigin(0.5, 0).setDepth(71)
    this.add.text(CENTRO_X, 22, semLigaduras(this.textosDaFase?.tema ?? descreverRegra(this.fase.regra)), { ...estilo(10, COR_TEXTO.tema), align: 'center', wordWrap: { width: 300 } }).setOrigin(0.5, 0).setDepth(71)

    // o chefe: um eco (o amigo possuído) ou o TITÃ gigante atrás de tudo
    if (this.def.titan) {
      this.tita = criarTita(this, this.def.sprite, { x: CHEFE.x, topo: -70, escala: 24, profundidade: -5 })
      // o nome e a barra do titã ficam embaixo dos olhos dele (o sprite do Inimigo some: o corpo é o titã)
      this.inimigo = new Inimigo(this, CHEFE.x, CHEFE.y + 46, this.def)
      this.inimigo.sprite.setVisible(false)
    } else {
      this.ecoChefe = criarEco(this, CHEFE.x, CHEFE.y + 48, this.def.sprite, { escala: ESCALA.chefe, profundidade: 1.5, alpha: 0, origemY: 1 })
      this.inimigo = new Inimigo(this, CHEFE.x, CHEFE.y, this.def)
      this.inimigo.sprite.setTint(TINTA_ECO)
    }

    // a carta do chefe (a intenção) embaixo dele, virada, com o naipe à vista
    this.rotuloIntencao = this.add.text(INTENCAO.x + 30, INTENCAO.y, '', { ...estilo(12), wordWrap: { width: 130 } }).setOrigin(0, 0.5).setDepth(12)

    // os placares: você (P1, à esquerda) e a aliada (à direita)
    const aliado = this.fase.aliado
    this.huds = [new HudPvp(this, { jogador: 0, personagem: this.mundo.personagem, hpMax: 90, rotulo: 'VOCÊ' }), aliado ? new HudPvp(this, { jogador: 1, personagem: aliado, hpMax: 90, rotulo: 'CPU' }) : null]
    this.personagens = [this.add.image(PERSONAGEM[0].x, PERSONAGEM[0].y, this.mundo.personagem).setOrigin(0.5, 1).setScale(ESCALA.personagem).setDepth(4), aliado ? this.add.image(PERSONAGEM[1].x, PERSONAGEM[1].y, aliado).setOrigin(0.5, 1).setScale(ESCALA.personagem).setFlipX(true).setDepth(4) : null]
    // a torcida: quem já foi libertado e não está lutando fica pequeno atrás da Kris
    this.turma = libertosAte(this.mundo.id, this.fase.n)
      .filter((p) => p !== aliado)
      .map((p, i) => this.add.image(PERSONAGEM[0].x + 44 + i * 26, PERSONAGEM[0].y - 2, p).setOrigin(0.5, 1).setScale(ESCALA.personagem * 0.6).setDepth(3.9))

    // o quadro: a BattleBox de verdade (recorte e faixa de aproximação), do tamanho da rodada
    this.caixa = new BattleBox(this, { x: QUADRO.x, y: QUADRO.y, largura: QUADRO.largura, altura: QUADRO.altura, dinamica: { campo: QUADRO.campo }, cor: CORES.caixa, campoFaixa: QUADRO.faixa })
    this.coracoes = [0, 1].map((j) => {
      const img = this.add.image(0, 0, 'coracao').setTint(j === 0 ? 0xff2a3a : CORES.almas[1]).setScale(ESCALA.coracao).setDepth(9).setVisible(false)
      this.caixa.recortar(img)
      return img
    })
    // o nome do ataque e o dano, EM CIMA do quadro (embaixo dele é onde o titã alinha as suas cartas)
    this.infoQuadro = this.add.text(CENTRO_X, QUADRO.y - QUADRO.altura / 2 - 8, '', estilo(11, '#cfc8e8')).setOrigin(0.5, 1).setDepth(71)

    this.frase = this.add.text(CENTRO_X, 270, '', { ...estilo(14), align: 'center', wordWrap: { width: 440 } }).setOrigin(0.5).setDepth(72)
    this.infoCarta = this.add.text(CENTRO_X, 288, '', { ...estilo(11, '#cfc8e8'), align: 'center', wordWrap: { width: 470 }, lineSpacing: 2 }).setOrigin(0.5, 0).setDepth(72)
    this.aviso = this.add.text(CENTRO_X, ALTURA / 2, 'conectando ao servidor da campanha…', estilo(16)).setOrigin(0.5).setDepth(90)
    this.add.text(LARGURA - 8, ALTURA - 4, 'ESC 2×: DESISTIR', estilo(9, COR_TEXTO.dica)).setOrigin(1, 1).setDepth(71)

    this.mao = new Mao(this, { jogador: 0, x: MAO_POS.x, y: MAO_POS.y, rotulo: '', largura: LARGURA_CARTA, espacamento: 70, larguraMax: 380, profundidade: 30 })
    this.mao.setAtiva(false)
    this.medo = criarMedo(this, { profundidade: 3 })
    this.baloes = { oponente: null, amigos: null }
    this.ditas = new Set()
    this.armadas = [null, null]
  }

  // ---------- placares ----------

  atualizarPlacares(eu, aliado) {
    if (eu) {
      const h = this.huds[0]
      h.hpMax = eu.hpMax
      h.setHp(Math.max(0, eu.hp))
      h.setEnergia(eu.energia)
      h.setEscudo(eu.escudo ?? null)
      h.setSequencia(eu.sequencia ?? 0)
      this.personagens[0].setAlpha(eu.caido ? 0.35 : 1)
    }
    if (aliado && this.huds[1]) {
      const h = this.huds[1]
      h.hpMax = aliado.hpMax
      h.setHp(Math.max(0, aliado.hp))
      h.setEnergia(aliado.energia)
      h.setEscudo(aliado.escudo ?? null)
      this.personagens[1]?.setAlpha(aliado.caido ? 0.35 : 1)
    }
  }

  atualizarChefe(chefe) {
    if (!chefe) return
    this.inimigo.atualizar(chefe.hp, chefe.hpMax)
  }

  // ---------- servidor ----------

  aoServidor(m) {
    if (this.saindo) return
    if (m.t === '_fechou') return this.erroFatal('a conexão caiu: a luta foi abandonada (sem recompensa)')
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

  // ---------- a rodada ----------

  novaRodada(v) {
    this.visao = v
    this.etapa = 'escolha'
    this.atualizarPlacares(v.eu, v.aliado)
    this.atualizarChefe(v.chefe)
    this.mostrarIntencao(v.chefe.intencao)
    for (const ev of v.eventos ?? []) {
      if (ev.tipo === 'voltou') this.etiqueta(PERSONAGEM[ev.j].x, PERSONAGEM[ev.j].y - 120, 'VOLTOU!', '#9affb0')
      if (ev.tipo === 'superChefe') this.banner(`${this.def.super.nome}!`, '#ff8a8a', { y: 150 })
    }
    this.mao.limpar()
    this.mao.setPosicao({ y: MAO_POS.y })
    const jogaveis = new Set(v.eu.jogaveis)
    this.mao.comprarVarias(v.eu.mao.map((c) => ({ ...c }))).then(() => {
      if (!this.scene.isActive() || this.saindo) return
      this.mao.setEnergia(v.eu.energia)
      // a regra da fase (só espadas) também deixa a carta indisponível
      for (const c of this.mao.cartas) if (!jogaveis.has(c.dados.id)) c.setIndisponivel(true)
      this.mao.setAtiva(this.etapa === 'escolha')
      this.mostrarCarta()
    })
    if (v.eu.caido) this.frase.setText('você caiu: B passa a vez (a aliada segura a luta)')
    else this.frase.setText(v.eu.jogaveis.length ? 'escolha uma carta (A) ou passe a vez (B)' : 'nenhuma carta cabe na energia: B passa a vez')
    if (v.rodada === 1 && this.tita) this.apresentarTita()
    else if (v.rodada === 1) this.falaDaLuta('inicio', { atraso: 500 })
    tocar(this, 'rodada')
  }

  // a carta do chefe, virada (o naipe à vista); o SUPER dele aparece de frente
  mostrarIntencao(intencao) {
    this.intencao?.destroy()
    this.intencao = null
    this.rotuloIntencao.setText('')
    if (!intencao) return
    const dados = intencao.super ? { id: 'chefe-super', personagem: this.def.sprite, naipe: 'espadas', valor: 14, nome: intencao.nome ?? 'SUPER', custo: 0 } : { id: 'chefe-intencao', personagem: this.def.sprite, naipe: intencao.naipe, valor: 7, nome: '', custo: 0 }
    this.intencao = new Carta(this, INTENCAO.x, INTENCAO.y, dados, { largura: LARGURA_INTENCAO, virada: !intencao.super, cor: CORES.hpChefe }).setDepth(12)
    this.rotuloIntencao.setText(intencao.super ? `SUPER: ${intencao.nome}` : `${SIMBOLOS[intencao.naipe]} ${intencao.tipo}`).setColor(intencao.super ? '#ff8a8a' : intencao.naipe === 'copas' || intencao.naipe === 'ouros' ? '#ff9aa8' : TINTA)
  }

  mostrarCarta() {
    const c = this.mao.selecionada?.dados
    if (!c || this.etapa !== 'escolha') return this.infoCarta.setText('')
    const pode = this.visao.eu.jogaveis.includes(c.id)
    this.infoCarta.setText(semLigaduras(`${c.nome}  ${SIMBOLOS[c.naipe]}  (custa ${c.custo})\n${c.descricao ?? ''}${pode ? '' : '\n— não dá para jogar agora'}`))
  }

  // as cartas reveladas: o servidor já resolveu a rodada; as cartas vão para o canto de cada um
  // (carregando) e a do chefe vira; depois a esquiva
  revelar(m) {
    this.rodadaAtual = m
    this.etapa = 'revelacao'
    this.mao.setAtiva(false)
    this.infoCarta.setText('')
    // o TITÃ pega as cartas que você não jogou: elas saem da SUA mão (as Cartas de verdade)
    if (m.esquiva?.cartas?.length) this.prepararArremesso(m.esquiva, m.jogadas[0].passou)
    this.mao.limpar()
    this.limparArmadas()
    m.jogadas.forEach((j, k) => {
      if (!j.carta || (k === 1 && !this.huds[1])) return
      const de = k === 0 ? { x: MAO_POS.x, y: MAO_POS.y - 30 } : { x: PERSONAGEM[1].x, y: PERSONAGEM[1].y - 60 }
      const carta = new Carta(this, de.x, de.y, { ...j.carta }, { largura: LARGURA_CARTA }).setDepth(40)
      this.armadas[k] = carta
      if (menosMovimento()) carta.setPosition(ARMADA[k].x, ARMADA[k].y).setScale(ESCALA_ARMADA)
      else this.tweens.add({ targets: carta, x: ARMADA[k].x, y: ARMADA[k].y, scale: ESCALA_ARMADA, duration: 380, ease: 'Cubic.easeOut' })
      if (j.especial && NOMES_ESPECIAIS[j.especial]) this.etiqueta(ARMADA[k].x, ARMADA[k].y - 70, NOMES_ESPECIAIS[j.especial], '#ffe9a0')
    })
    // a carta do chefe vira de frente
    if (m.intencao) {
      this.intencao?.destroy()
      this.intencao = new Carta(this, INTENCAO.x, INTENCAO.y, { ...m.intencao, personagem: this.def.sprite, custo: 0 }, { largura: LARGURA_INTENCAO, cor: CORES.hpChefe }).setDepth(12)
      this.rotuloIntencao.setText(`${m.intencao.nome}`)
    }
    if (DESTINOS[m.destino]) this.banner(DESTINOS[m.destino], '#ffe9a0', { y: 240 })
    const quem = (j, nome) => (j.passou ? `${nome} passou` : `${nome}: ${j.carta.nome}`)
    this.frase.setText(`${quem(m.jogadas[0], 'você')}${this.huds[1] ? `  ·  ${quem(m.jogadas[1], PERSONAGENS[this.fase.aliado].nome)}` : ''}`)
    this.atualizarPlacares(m.eu, m.aliado)
    this.atualizarChefe(m.chefe)
    if (m.chefeEfeito?.cura) this.numeroNoChefe(`+${m.chefeEfeito.cura}`, '#9affb0')
    // a SUA carta SUPER: a música dela (a mesma do PvP) enquanto a rodada acontece
    const minha = m.jogadas[0]?.carta
    if (ehSuper(minha))
      tocarMusicaEspecial(`super_${minha.personagem}`).then((ok) => {
        if (!ok) return
        this.musicaEspecial = true
        if (this.saindo) this.voltarDaSuper()
      })
    this.time.delayedCall(menosMovimento() ? 700 : 1300, () => this.comecarEsquiva())
  }

  comecarEsquiva() {
    if (this.saindo || this.etapa !== 'revelacao') return
    const esq = this.rodadaAtual.esquiva
    this.acertosLocais = 0
    this.pedacos = 0
    this.ultimoPedaco = 0
    this.real = 0
    if (!esq) {
      this.frase.setText('ninguém desvia nesta rodada')
      return this.time.delayedCall(500, () => this.terminarEsquiva())
    }
    this.frase.setText('')
    this.intencao?.setVisible(false)
    this.rotuloIntencao.setVisible(false)
    this.mao.setPosicao({ y: MAO_FORA })
    // o quadro do tamanho da rodada (a regra do corredor encolhe): a BattleBox fica igual a limitesDoQuadro
    const l = limitesDoQuadro(esq.caixa)
    this.caixa.base = { x: l.centerX, y: l.centerY, largura: l.width, altura: l.height }
    this.etapa = 'abrindo'
    tocar(this, 'caixaAbrir')
    this.caixa.mostrar(() => {
      if (this.saindo || this.etapa !== 'abrindo') return
      this.quadro = criarQuadro(this, esq, { caixa: this.caixa })
      this.coracoes.forEach((img, j) => img.setVisible(Boolean(esq.jogadores[j])))
      this.etapa = 'esquiva'
      this.infoQuadro.setText(semLigaduras(`${this.rodadaAtual.intencao?.nome ?? 'ataque'} · ${esq.danos[0] ?? esq.danos[1] ?? 0} de dano por acerto${esq.inverter ? ' · CONTROLES INVERTIDOS!' : ''}`))
    })
  }

  atualizarEsquiva(delta) {
    const q = this.quadro
    if (!q) return
    this.caixa.atualizar(delta)
    if (!q.acabou) {
      this.real += delta
      const joy = joyDeTodos(this.controles)
      while (q.t + PASSO_MS <= this.real && !q.acabou) {
        const r = q.passo(joy)
        for (const j of r.acertos) this.levouAcerto(j)
        if (r.grazes.length) tocar(this, 'graze')
      }
      if (q.t - this.ultimoPedaco >= PEDACO_MS) this.mandarPedaco()
    }
    q.coracoes.forEach((c, j) => {
      const img = this.coracoes[j]
      if (!img.visible) return
      img.setPosition(c.x, c.y).setAlpha(!c.ativo ? 0.25 : c.invencivel > 0 && Math.floor(this.time.now / 80) % 2 ? 0.35 : 1)
    })
    this.moverArremesso(q.balas.lista)
    const hp = this.huds[0].hp / Math.max(1, this.huds[0].hpMax)
    this.medo.atualizar(delta, { ativo: !q.acabou, hp, caixa: { esquerda: q.limites.left, direita: q.limites.right, topo: q.limites.top, base: q.limites.bottom } })
    if (!q.acabou) this.caixa.retangulo.setStrokeStyle(4, misturar(CORES.caixa, BORDA_MEDO, 0.55 + 0.45 * Math.sin(this.time.now / (110 + 200 * hp))))
    if (q.acabou) this.terminarEsquiva()
  }

  levouAcerto(j) {
    const esq = this.rodadaAtual.esquiva
    const dano = esq.danos[j] ?? 0
    const h = this.huds[j]
    if (j === 0) {
      this.acertosLocais++
      levouGolpe(0, { super: Boolean(this.rodadaAtual?.intencao?.super) }) // vibração; BUZZER só no SUPER do chefe
      tocar(this, 'dano')
      if (!menosMovimento() && fatores().tremor > 0) this.cameras.main.shake(120, 0.004 * fatores().tremor)
    }
    if (h) {
      h.setHp(Math.max(0, h.hp - dano))
      h.tremer()
      numero(this, h.pontoHp.x, h.pontoHp.y + 4, `-${dano}`, '#ff8a8a', { tamanho: 15, desvio: 10 })
    }
    this.caixa.tremer(110, 2)
    this.caixa.retangulo.setStrokeStyle(4, CORES.almas[j] ?? 0xffffff)
  }

  mandarPedaco() {
    this.ultimoPedaco = this.quadro.t
    if (!this.rodadaAtual.esquiva?.jogadores[0]) return
    let a = this.quadro.tirarAmostras()
    if (!a.length) return
    // SÓ NO DEV: a trapaça do teste de navegador (o servidor tem de recusar)
    if (trapacaDev() === 'teleporte' && this.pedacos === 2 && a.length >= 6) {
      const l = this.quadro.limites
      a = [...a]
      a[4] = a[4] > ((l.left + l.right) / 2) * 10 ? (l.left + 12) * 10 : (l.right - 12) * 10
    }
    enviarPosicoes(this.corrida, this.rodadaAtual.rodada, this.pedacos++, a)
  }

  terminarEsquiva() {
    if (this.etapa === 'conferindo') return
    this.etapa = 'conferindo'
    this.voltarDaSuper()
    if (this.quadro) {
      this.mandarPedaco()
      this.quadro.parar()
    }
    this.quadro = null
    if (this.arremesso) for (const a of this.arremesso.values()) if (!a.foi) ((a.foi = true), this.desfazerCarta(a.carta))
    this.arremesso = null
    this.coracoes.forEach((img) => img.setVisible(false))
    this.medo.parar()
    this.infoQuadro.setText('')
    if (this.caixa.bordaVisivel) {
      tocar(this, 'caixaFechar')
      this.caixa.esconder()
    }
    this.intencao?.setVisible(true)
    this.rotuloIntencao.setVisible(true)
    this.frase.setText('o servidor está conferindo a rodada…')
    terminarEsquiva(this.corrida, this.rodadaAtual.rodada, trapacaDev() === 'semAcertos' ? 0 : this.acertosLocais)
  }

  // ---------- o fim da rodada: golpes no chefe ----------

  async fimDaRodada(m) {
    const r = m.resumo
    this.etapa = 'golpes'
    const partes = [`você levou ${r.acertos[0]} acerto${r.acertos[0] === 1 ? '' : 's'}`]
    if (this.huds[1]) partes.push(`${PERSONAGENS[this.fase.aliado].nome} levou ${r.acertos[1]}`)
    if (r.acertos[0] > this.acertosLocais) partes.push(`(o servidor contou ${r.acertos[0] - this.acertosLocais} a mais)`)
    this.frase.setText(partes.join(' · '))
    this.atualizarPlacares(r.eu, r.aliado)
    if (this.rodadaAtual?.esquiva?.jogadores[0] && r.perfeito[0]) {
      this.etiqueta(CENTRO_X, QUADRO.y - 20, r.perfeitos[0]?.multiplicador > 1 ? `PERFEITO x${r.perfeitos[0].multiplicador}!` : 'PERFEITO!', COR_TEXTO.ouro, { tamanho: 22 })
      tocar(this, 'brilhoRank')
      this.pularTurma()
      this.perfeitos++
      if (this.perfeitos === 2 || this.perfeitos === 5) {
        this.ditas.delete('perfeito')
        this.falaDaLuta('perfeito', { atraso: 300 })
      }
    }
    if (r.eu.caido) this.etiqueta(PERSONAGEM[0].x, PERSONAGEM[0].y - 120, 'CAIU!', '#ff6a6a')
    if (r.aliado?.caido) this.etiqueta(PERSONAGEM[1].x, PERSONAGEM[1].y - 120, 'CAIU!', '#ff6a6a')
    await this.esperar(menosMovimento() ? 250 : 600)
    if (this.saindo) return
    // o contra-ataque: as cartas carregadas voam no chefe
    if (r.combo) {
      tocar(this, 'combo')
      this.banner(r.combo === 'super' ? 'SUPER COMBO!' : r.combo === 'par' ? 'PAR!  x1.5' : 'COMBO!  x1.25', '#ffd23c', { y: 240 })
    }
    for (const g of r.golpes) {
      if (this.saindo) return
      await this.golpe(g)
    }
    this.limparArmadas()
    this.atualizarChefe(r.chefe)
    // as falas da luta, pelo HP
    const c = r.chefe
    if (!r.vencedor) {
      if (c.hp > 0 && c.hp <= c.hpMax * 0.25) this.falaDaLuta('quase', { atraso: 200 })
      else if (c.hp > 0 && c.hp <= c.hpMax * 0.5) this.falaDaLuta('ferido', { atraso: 200 })
      if (r.eu.hp > 0 && r.eu.hp <= r.eu.hpMax * 0.35) this.falaDaLuta('voceMal', { atraso: 900 })
    }
    if (r.novaFase != null) await this.trocaDeFase(r.novaFase)
    if (this.saindo) return
    if (m.proxima) {
      await this.esperar(menosMovimento() ? 300 : 700)
      if (!this.saindo) this.novaRodada(m.proxima)
    } else this.etapa = 'fim'
  }

  // um golpe: a carta carregada voa no chefe; o número e os multiplicadores (CRÍTICO, COMBO...)
  async golpe(g) {
    const carta = this.armadas[g.j]
    const alvo = this.tita ? this.tita.centroDosOlhos : { x: CHEFE.x, y: CHEFE.y - 20 }
    if (g.falhou) {
      if (carta) this.desfazerCarta(carta)
      this.armadas[g.j] = null
      return
    }
    this.armadas[g.j] = null
    if (carta && !menosMovimento()) await new Promise((ok) => carta.arremessar(alvo, { duracao: 420, aoImpacto: ok }).then(ok, ok))
    else carta?.destroy()
    if (this.saindo) return
    tocar(this, 'impacto')
    this.inimigo.dano(Math.min(1, g.dano / 60))
    if (!this.tita) this.time.delayedCall(140, () => this.inimigo?.sprite?.active && this.inimigo.sprite.setTint(TINTA_ECO))
    this.tita?.apanhar()
    const extra = g.multiplicadores.map(([nome]) => nome).join(' · ')
    this.numeroNoChefe(`-${g.dano}`, '#f2e2b0', 26)
    if (extra) this.etiqueta(alvo.x, alvo.y + 46, extra, '#ffd23c', { tamanho: 13, ms: 900 })
    if (g.limitado) this.etiqueta(alvo.x, alvo.y + 64, 'AGUENTOU!', '#ff9aa8', { tamanho: 13, ms: 900 })
    this.pularTurma()
    await this.esperar(menosMovimento() ? 150 : 380)
  }

  async trocaDeFase(f) {
    const entrada = this.def.fases[f]?.entrada
    tocar(this, 'superAtivar')
    if (!menosMovimento() && fatores().clarao >= 1) this.cameras.main.flash(380, 110, 60, 140)
    if (this.tita) {
      // o titã: a 2ª fase racha (a luz dos amigos entra), a 3ª é a fúria
      if (f === 1) {
        this.tita.rachar()
        musica('campanha_virada', 'campanha_chefe')
        const gritos = (TEXTOS[this.mundo.id].viradaFalas ?? []).filter((x) => x.quem === this.fase.aliado || this.turma.some((o) => o.texture.key === x.quem))
        gritos.forEach((x, i) => this.falar(x, { atraso: 300 + i * 650 }))
      }
      if (f >= 2) {
        this.tita.furia()
        this.falar(TEXTOS[this.mundo.id].furiaFala, { atraso: 200 })
      }
    }
    if (entrada) this.falar({ quem: 'silencio', texto: entrada })
    this.banner(f >= 2 && this.tita ? 'FÚRIA!' : `FASE ${f + 1}`, '#d8b8ff', { y: 150 })
    await this.esperar(menosMovimento() ? 400 : 1100)
  }

  fim(m) {
    this.saindo = true
    this.etapa = 'fim'
    if (m.resultado === 'vitoria') {
      venceu(0) // BUZZER da vitória
      this.inimigo?.sumir?.()
      if (this.ecoChefe) this.tweens.add({ targets: this.ecoChefe.objetos, alpha: 0, duration: 600 })
    }
    this.time.delayedCall(m.resultado === 'vitoria' ? 1300 : 700, () => {
      this.cameras.main.fadeOut(240, 0, 0, 0)
      this.time.delayedCall(260, () => this.scene.start('CampanhaFim', { mundo: this.mundo.id, fase: this.fase.n, fim: m, escolhas: this.escolhas }))
    })
  }

  erroFatal(msg) {
    if (this.saindo) return
    this.saindo = true
    this.mao.setAtiva(false)
    this.quadro?.parar()
    this.quadro = null
    this.aviso.setText(`${msg}\n\nA ou B: voltar ao mapa`).setVisible(true).setAlign('center').setWordWrapWidth(600)
    this.etapa = 'erro'
  }

  // ---------- o TITÃ ----------

  apresentarTita() {
    const t = TEXTOS[this.mundo.id].titan
    this.tita.olhar(1.8)
    tocar(this, 'superAtivar')
    if (!menosMovimento() && fatores().tremor > 0) this.cameras.main.shake(700, 0.01 * fatores().tremor)
    const titulo = this.add.text(LARGURA / 2, ALTURA / 2 - 60, semLigaduras(t?.apresentacao ?? 'O TITÃ'), { fontFamily: FONTE, fontSize: '40px', color: '#d8b8ff', stroke: '#160a24', strokeThickness: 8 }).setOrigin(0.5).setDepth(95)
    if (menosMovimento()) return this.time.delayedCall(1600, () => titulo.destroy())
    titulo.setScale(2.4).setAlpha(0)
    this.tweens.add({ targets: titulo, scale: 1, alpha: 1, duration: 420, ease: 'Back.easeOut' })
    this.tweens.add({ targets: titulo, alpha: 0, y: titulo.y - 20, delay: 1700, duration: 500, onComplete: () => titulo.destroy() })
    this.falaDaLuta('inicio', { atraso: 2300 })
  }

  // as cartas que você NÃO jogou saem da mão (as Cartas de verdade) e vão para onde a bala de cada
  // uma nasce (attacks/arremesso.js: embaixo do quadro)
  prepararArremesso(esq, passou) {
    this.limparArremesso()
    this.arremesso = new Map()
    const l = limitesDoQuadro(esq.caixa)
    const n = esq.cartas.length
    esq.cartas.forEach((d, i) => {
      let carta = this.mao.cartas.find((c) => c.dados.id === d.id)
      if (carta) this.mao.retirar(carta)
      else carta = new Carta(this, MAO_POS.x, MAO_POS.y, { id: d.id, personagem: this.mundo.personagem, naipe: 'espadas', valor: 2, nome: '', custo: 0 }, { largura: LARGURA_CARTA })
      this.tweens.killTweensOf(carta)
      carta.pararTweensCorpo?.()
      carta.focar?.(false)
      carta.setDepth(12)
      const x = l.left + (l.width * (i + 1)) / (n + 1)
      const y = l.bottom + TAMANHO_CARTA.altura / 2 + 3
      const escala = (TAMANHO_CARTA.largura / (carta.largura || LARGURA_CARTA)) * 1.15
      const a = { carta, bala: null, x, y, escala, voando: false, foi: false }
      this.arremesso.set(String(d.id), a)
      if (menosMovimento()) carta.setPosition(x, y).setScale(escala).setAngle(0)
      else this.tweens.add({ targets: carta, x, y, scale: escala, angle: 0, duration: 420, delay: i * 90, ease: 'Cubic.easeOut' })
    })
    const t = TEXTOS[this.mundo.id].titan
    this.tita?.olhar(1.6)
    if (!menosMovimento() && fatores().tremor > 0) this.cameras.main.shake(260, 0.004 * fatores().tremor)
    this.falar(passou ? t?.passou : t?.arremesso?.[this.falasTita++ % (t?.arremesso?.length || 1)])
  }

  // a cada quadro: cada Carta segue a bala dela (o sprite da bala some); a bala acabou: a carta se desfaz
  moverArremesso(lista) {
    if (!this.arremesso) return
    const vivas = new Set()
    for (const b of lista) {
      if (!b.cartaId) continue
      const a = this.arremesso.get(b.cartaId)
      if (!a || a.foi) continue
      vivas.add(a)
      a.bala = b
      b.sprite?.setVisible(false)
      this.tweens.killTweensOf(a.carta)
      a.carta.setScale(a.escala)
      if (b.idade < b.aviso) {
        const k = menosMovimento() ? 0 : Math.sin(b.idade / 25) * 2
        a.carta.setPosition(b.x + k, b.y).setAngle(k * 2)
      } else {
        if (!a.voando) {
          a.voando = true
          tocar(this, 'cartaSelecionar')
          this.tita?.olhar(1.2)
        }
        a.carta.setPosition(b.x, b.y).setAngle(menosMovimento() ? 0 : Math.sin(b.idade / 60) * 10)
      }
    }
    for (const a of this.arremesso.values()) {
      if (!a.bala || a.foi || vivas.has(a)) continue
      a.foi = true
      this.desfazerCarta(a.carta)
    }
  }

  desfazerCarta(carta) {
    if (!carta?.active) return
    if (menosMovimento()) return carta.destroy()
    this.tweens.add({ targets: carta, alpha: 0, scale: carta.scale * 1.7, angle: carta.angle + 40, duration: 260, onComplete: () => carta.destroy() })
  }

  limparArremesso() {
    if (!this.arremesso) return
    for (const a of this.arremesso.values()) if (!a.foi && a.carta?.active) a.carta.destroy()
    this.arremesso = null
  }

  limparArmadas() {
    if (!this.armadas) return
    this.armadas.forEach((c, k) => {
      if (c?.active) c.destroy()
      this.armadas[k] = null
    })
  }

  voltarDaSuper() {
    if (!this.musicaEspecial) return
    this.musicaEspecial = false
    voltarMusicaNormal()
  }

  // ---------- falas e efeitos ----------

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
        .setDepth(96)
      this.baloes[lado] = t
      if (!menosMovimento()) {
        t.setAlpha(0).setY(b.y + 6)
        this.tweens.add({ targets: t, alpha: 1, y: b.y, duration: 180 })
      }
      if (silencio && !menosMovimento() && fatores().tremor > 0) this.cameras.main.shake(160, 0.002 * fatores().tremor)
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

  // a fala da luta de um momento (inicio, ferido, quase, voceMal, perfeito), uma vez por luta; quem
  // fala precisa estar na luta ou já livre (senão, ninguém fala)
  falaDaLuta(momento, op = {}) {
    if (this.ditas.has(momento)) return
    const falas = this.textosDaFase?.luta?.[momento]
    if (!falas?.length) return
    this.ditas.add(momento)
    const fala = falas[0]
    const presente = fala.quem === 'silencio' || fala.quem === this.fase.oponente || fala.quem === this.fase.aliado || this.turma.some((o) => o.texture.key === fala.quem)
    if (presente) this.falar(fala, op)
  }

  pularTurma() {
    if (menosMovimento()) return
    for (const o of [...(this.turma ?? []), this.personagens?.[1]].filter(Boolean)) {
      if (o.getData('pulando')) continue
      o.setData('pulando', true)
      const y = o.y
      this.tweens.add({ targets: o, y: y - 10, duration: 140, yoyo: true, ease: 'Quad.easeOut', onComplete: () => (o.setY(y), o.setData('pulando', false)) })
    }
  }

  numeroNoChefe(texto, cor, tamanho = 20) {
    const p = this.tita ? this.tita.centroDosOlhos : { x: CHEFE.x, y: CHEFE.y - 40 }
    numero(this, p.x, p.y, texto, cor, { tamanho, desvio: 14 })
  }

  etiqueta(x, y, texto, cor, { tamanho = 16, ms = 1000 } = {}) {
    const t = this.add.text(x, y, texto, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 4, align: 'center' }).setOrigin(0.5).setDepth(97)
    if (menosMovimento()) return this.time.delayedCall(ms, () => t.destroy())
    this.tweens.add({ targets: t, y: y - 24, alpha: 0, duration: ms, delay: 250, ease: 'Quad.easeOut', onComplete: () => t.destroy() })
  }

  banner(texto, cor, { y = 200, ms = 1100 } = {}) {
    const t = this.add.text(CENTRO_X, y, texto, { fontFamily: FONTE, fontSize: '30px', color: cor, stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5).setDepth(97)
    if (menosMovimento()) return this.time.delayedCall(ms, () => t.destroy())
    t.setScale(1.6).setAlpha(0)
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' })
    this.tweens.add({ targets: t, alpha: 0, delay: ms, duration: 300, onComplete: () => t.destroy() })
  }

  esperar(ms) {
    return new Promise((ok) => this.time.delayedCall(ms, ok))
  }

  // ---------- entrada ----------

  botao(botao) {
    if (this.etapa === 'erro') return this.voltarAoMapa()
    if (this.etapa !== 'escolha' || this.saindo) return
    if (botao === 'A') {
      const c = this.mao.selecionada?.dados
      if (!c || !this.visao.eu.jogaveis.includes(c.id)) {
        tocar(this, 'erro')
        return this.frase.setText(c ? 'essa carta não dá para jogar agora' : 'escolha uma carta')
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
    this.frase.setText('Esc de novo para desistir (a luta não conta)')
  }

  voltarAoMapa() {
    this.saindo = true
    this.quadro?.parar()
    this.quadro = null
    this.cameras.main.fadeOut(220, 0, 0, 0)
    this.time.delayedCall(240, () => this.scene.start('Campanha', { mundo: this.mundo.id, fase: this.fase.n }))
  }

  update(tempo, delta) {
    if (!this.controles) return
    this.controles.atualizar()
    // (saida.js só manda VIDA quando o número muda, e decide o BUZZER de HP baixo e K.O.)
    if (this.huds?.[0]) informarVida(0, this.huds[0].hp, this.huds[0].hpMax)
    this.cenario?.atualizar(delta)
    this.ecoChefe?.atualizar(tempo)
    this.tita?.atualizar(tempo)
    if (this.etapa === 'esquiva') return this.atualizarEsquiva(delta)
    this.caixa?.atualizar(delta)
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
