import Phaser from 'phaser'
import { LARGURA, ALTURA, FONTE, CORES, TEXTO, ATAQUE, CORACAO, corTexto } from '../constants.js'
import Controles from '../controles.js'
import { tocar, musica, pausarMusica, retomarMusica } from '../audio.js'
import { debug } from '../debug.js'
import { PERSONAGENS } from '../data/personagens.js'
import Carta, { CORES_CARTA, TIPOS } from '../entities/Carta.js'
import Mao from '../entities/Mao.js'
import Pista from '../pvp/Pista.js'
import HudPvp from '../pvp/HudPvp.js'
import { CARTAS, TEMAS } from '../pvp/cartas.js'
import { ataqueDaCartaNoJogo } from '../pvp/ataquesDasCartas.js'
import { criarPartida, iniciarRodada, podeJogar, resolverRodada, aplicarDano, registrarGrazes, fimDaRodada, ENERGIA } from '../pvp/regras.js'
import { escolherJogada, NIVEIS_BOT, NIVEL_BOT_PADRAO } from '../pvp/bot.js'
import { EsquivaBot } from '../pvp/botEsquiva.js'
import { criarRng } from '../pvp/baralho.js'
import { shake } from '../effects/shake.js'
import { flashTela } from '../effects/flash.js'
import { numero } from '../effects/numero.js'
import { particulas } from '../effects/particulas.js'

// Partida PvP de cartas. Junta as peças de pvp/ (regras, baralho, cartas,
// Pista) com o visual das cartas (Carta, Mao). Regras em docs/pvp-regras.md.
//
//   scene.start('PvpArena', { p1: 'susie', p2: 'noelle', semente?, tempo? })
//     p1, p2   personagens (padrão: registry 'pvp' = { p1, p2 }; depois kris x susie)
//     tempo    ms para escolher a carta (padrão TEMPO.escolha; 0 = sem limite)
//
// Máquina de estados (this.fase), uma volta por rodada:
//   'abertura'   só no começo: "KRIS vs SUSIE"
//   'inicio'     iniciarRodada (energia), as mãos completam 5 com animação
//   'escolha'    os dois escolhem juntos (←/→, A confirma, B desfaz). No fim
//                da mão (lado de dentro) fica o PASSAR (+1 energia). Com tempo
//                limite: quem não escolheu passa sozinho
//   'revelacao'  as duas cartas vão ao centro, viram juntas e mostram o efeito
//                (resolverRodada: Ases, copas, escudo, roubo, compra)
//   'arremesso'  as mãos descem, as caixas abrem e cada carta de ataque voa
//                até a caixa de quem vai desviar dela (o espelho rebate)
//   'esquiva'    as duas Pistas rodam ao mesmo tempo; acertos tiram HP do dono
//                da pista (aplicarDano), grazes viram energia (registrarGrazes)
//   'fim'        fimDaRodada: vencedor? -> 'resultado' (PvpResultado); senão volta ao 'inicio'
//
// Com 1 jogador no painel, o P2 é a CPU (pvp/bot.js escolhe a carta,
// pvp/botEsquiva.js desvia). Nível: registry 'pvpNivelBot' (tela PvpEscolha, ↑/↓).
//
// Música: musica('pvp'), ou seja public/assets/musicas/pvp.mid; sem o arquivo, toca a do Jevil.
//
// No dev: debugJogo.jogo.scene.start('PvpArena', { p1: 'susie', p2: 'noelle' })
// e window.pvpArena (estadoDebug, forcarMao, setHp) para os testes.

export const TEMPO = { escolha: 15000 }

// CPU: quanto ela "pensa" antes de mexer o cursor e quanto leva cada passo dele (ms)
const CPU = { pensarMin: 700, pensarMax: 1700, passoMin: 150, passoMax: 260 }
// HP abaixo desta fração do máximo: alarme (uma vez, até curar acima de novo)
const HP_BAIXO = 0.25

const PISTA = { largura: 220, altura: 170, y: 198 }
const CENTROS = [LARGURA / 4, (LARGURA * 3) / 4]
// região de cada pista: a caixa muda de forma sem invadir a metade da outra
const CAMPOS = [
  { esquerda: 8, direita: LARGURA / 2 - 8, topo: 74, base: 334 },
  { esquerda: LARGURA / 2 + 8, direita: LARGURA - 8, topo: 74, base: 334 },
]
const MAOS = [
  { x: 150, y: 424, monte: { x: 28, y: 366 } },
  { x: 490, y: 424, monte: { x: 612, y: 366 } },
]
const MAO_ESCONDIDA = 512 // y das mãos durante a esquiva (só a pontinha aparece)
const LARGURA_MAO = 150
// botão PASSAR: do lado de dentro de cada mão (P1 à direita, P2 à esquerda)
const PASSAR = [
  { x: 292, y: 426, lado: 'direita' },
  { x: 348, y: 426, lado: 'esquerda' },
]
const PREVIAS = [
  { x: 160, y: 176, escala: 1.5 },
  { x: 480, y: 176, escala: 1.5 },
]
const MESA = [
  { x: 244, y: 184 },
  { x: 396, y: 184 },
]
const ESCALA_MESA = 1.45
const COLUNA = [150, 262] // y das cartas na coluna entre as caixas, antes do arremesso

const outro = (j) => 1 - j
const VENCEDOR = { p1: 1, p2: 2, empate: 0 }

export default class PvpArena extends Phaser.Scene {
  constructor() {
    super('PvpArena')
  }

  init(dados) {
    const salvo = this.registry.get('pvp') ?? {}
    const valido = (id) => (CARTAS[id] ? id : null)
    this.ids = [valido(dados?.p1) ?? valido(salvo.p1) ?? 'kris', valido(dados?.p2) ?? valido(salvo.p2) ?? 'susie']
    this.semente = dados?.semente ?? `pvp:${Date.now()}`
    this.tempoBase = dados?.tempo ?? TEMPO.escolha
  }

  create() {
    this.controles = new Controles(this)
    this.numJogadores = this.controles.numJogadores
    // sozinho: o P2 é a CPU
    this.cpu = this.numJogadores < 2 ? 1 : null
    const nivel = this.registry.get('pvpNivelBot')
    this.nivelBot = NIVEIS_BOT[nivel] ? nivel : NIVEL_BOT_PADRAO
    this.rngBot = criarRng(`${this.semente}:cpu`)
    this.esquivaBot = this.cpu === null ? null : new EsquivaBot({ nivel: this.nivelBot })
    this.tempoEscolha = this.tempoBase
    this.hpAvisado = [false, false]
    this.estado = criarPartida({ p1: this.ids[0], p2: this.ids[1], semente: this.semente })
    this.fase = 'abertura'
    this.saindo = false
    this.pausado = false
    this.retomadoEm = 0
    this.escolhas = [undefined, undefined] // undefined = escolhendo; null = passou; id = carta
    this.noPassar = [false, false]
    this.previas = [null, null]
    this.reveladas = [null, null]
    this.relogio = 0
    this.invertido = [0, 0]
    this.ko = [false, false]
    this.estatisticas = [0, 1].map(() => ({ danoCausado: 0, danoRecebido: 0, cartasJogadas: 0, maiorCarta: null, grazes: 0, ases: 0, passes: 0 }))

    this.desenharFundo()
    this.criarPistas()
    this.huds = [0, 1].map((j) => new HudPvp(this, { jogador: j, personagem: this.ids[j], hpMax: this.estado.jogadores[j].hpMax, rotulo: this.rotulo(j) }))
    this.criarTopo()
    this.montes = [0, 1].map((j) => this.criarMonte(j))
    this.maos = [0, 1].map(
      (j) => new Mao(this, { jogador: j, x: MAOS[j].x, y: MAOS[j].y, monte: MAOS[j].monte, larguraMax: LARGURA_MAO, espacamento: 40, profundidade: 20 }),
    )
    this.botoesPassar = [0, 1].map((j) => this.criarBotaoPassar(j))
    this.criarTextos()

    this.controles.onBotao((j, botao) => {
      if (this.pausado || this.saindo) return
      if (botao === 'A') this.apertarA(j)
      else this.apertarB(j)
    })
    this.controles.onPausa(() => this.pausar())

    // objetos de fora das caixas não aparecem nas câmeras de recorte (ver filtrarCaixas)
    this.events.on('postupdate', this.filtrarCaixas, this)

    if (import.meta.env.DEV) window.pvpArena = this
    this.events.once('shutdown', () => {
      this.saindo = true
      this.events.off('postupdate', this.filtrarCaixas, this)
      this.pistas.forEach((p) => p.destruir())
      if (window.pvpArena === this) delete window.pvpArena
    })

    musica(this, 'pvp', 'jevil')
    this.cameras.main.fadeIn(300)
    this.partida()
  }

  // ---------- montagem da mesa ----------

  desenharFundo() {
    const g = this.add.graphics().setDepth(-10)
    g.fillStyle(0x0d0a16, 1)
    g.fillRect(0, 0, LARGURA, ALTURA)
    g.fillStyle(0x17122b, 1)
    g.fillRoundedRect(6, 66, LARGURA - 12, ALTURA - 72, 16)
    g.lineStyle(2, 0x3a2d5a, 1)
    g.strokeRoundedRect(6, 66, LARGURA - 12, ALTURA - 72, 16)
    g.fillStyle(0x221a3c, 1)
    for (let y = 84; y < ALTURA - 14; y += 28) {
      for (let x = 24 + ((y / 28) % 2) * 14; x < LARGURA - 16; x += 28) {
        g.fillPoints([{ x, y: y - 4 }, { x: x + 3, y }, { x, y: y + 4 }, { x: x - 3, y }], true)
      }
    }
    // metade de cada jogador: um brilho bem fraco na cor do coração
    for (const j of [0, 1]) {
      g.fillStyle(CORES.almas[j], 0.05)
      g.fillRect(j ? LARGURA / 2 + 2 : 8, 68, LARGURA / 2 - 10, ALTURA - 76)
    }
    g.lineStyle(1, 0x3a2d5a, 0.9)
    for (let y = 76; y < 340; y += 12) g.lineBetween(LARGURA / 2, y, LARGURA / 2, y + 6)
  }

  criarPistas() {
    this.pistas = [0, 1].map((j) => {
      const pista = new Pista(this, {
        x: CENTROS[j],
        y: PISTA.y,
        largura: PISTA.largura,
        altura: PISTA.altura,
        jogador: j,
        cor: CORES.almas[j],
        tema: TEMAS[this.ids[outro(j)]],
        velocidadeMax: 300,
        dinamica: { campo: CAMPOS[j] },
      })
      pista.aoAcertar = (dano) => this.acertou(j, dano)
      pista.aoGraze = () => this.grazeou(j)
      return pista
    })
  }

  criarTopo() {
    const texto = (y, tamanho, cor) =>
      this.add.text(LARGURA / 2, y, '', { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(70)
    this.textoRodada = texto(5, 13, TEXTO.normal)
    this.textoRelogio = texto(22, 22, TEXTO.selecionado)
    this.textoTreino = texto(50, 9, '#9be7ff')
    if (this.cpu !== null) this.textoTreino.setText(`VS CPU · ${{ facil: 'fácil', normal: 'normal', dificil: 'difícil' }[this.nivelBot]}`)
  }

  // monte de cada jogador (3 versos empilhados e quantas cartas restam)
  criarMonte(j) {
    const { x, y } = MAOS[j].monte
    const cartas = [0, 1, 2].map((k) =>
      new Carta(this, x - k * 1.2, y - k * 1.8, { personagem: this.ids[j], naipe: 'espadas', valor: 2 }, { virada: true, largura: 46 }).setDepth(5 + k).setRotation(j ? 0.08 : -0.08),
    )
    const texto = this.add
      .text(x, y + 40, '', { fontFamily: FONTE, fontSize: '10px', color: TEXTO.desabilitado, stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5, 0)
      .setDepth(8)
    return { cartas, texto }
  }

  atualizarMontes() {
    this.montes.forEach((m, j) => {
      const n = this.estado.jogadores[j].baralho.monte.length
      m.texto.setText(`${n}`)
      m.cartas.forEach((c, k) => c.setVisible(n > k))
    })
  }

  // botão PASSAR (do lado de dentro da mão): +1 energia sem jogar carta
  criarBotaoPassar(j) {
    const { x, y } = PASSAR[j]
    const c = this.add.container(x, y).setDepth(18)
    const g = this.add.graphics()
    const titulo = this.add.text(0, -12, 'PASSAR', { fontFamily: FONTE, fontSize: '9px', color: TEXTO.normal, stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5)
    const bonus = this.add.text(4, 8, `+${ENERGIA.passar}`, { fontFamily: FONTE, fontSize: '12px', color: '#7fd8ff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
    const gema = this.add.graphics()
    gema.fillStyle(CORES_CARTA.gemaEscura, 1)
    gema.fillPoints([{ x: -12, y: 2 }, { x: -7, y: 8 }, { x: -12, y: 14 }, { x: -17, y: 8 }], true)
    gema.fillStyle(CORES_CARTA.gema, 1)
    gema.fillPoints([{ x: -12, y: 3.5 }, { x: -8.3, y: 8 }, { x: -12, y: 12.5 }, { x: -15.7, y: 8 }], true)
    const cursor = this.add.image(0, -50, 'coracao').setTint(CORES.almas[j]).setScale(1.3).setAngle(180).setVisible(false)
    c.add([g, titulo, gema, bonus, cursor])
    const botao = { c, g, titulo, cursor, foco: false, escolhido: false }
    botao.desenhar = () => {
      g.clear()
      const cor = botao.escolhido ? 0x2a2a3a : 0x0b0914
      g.fillStyle(cor, 0.95)
      g.fillRoundedRect(-22, -32, 44, 64, 6)
      g.lineStyle(botao.foco ? 3 : 1.5, botao.foco || botao.escolhido ? CORES.almas[j] : 0x5a4a7a, 1)
      g.strokeRoundedRect(-22, -32, 44, 64, 6)
      titulo.setText(botao.escolhido ? 'PRONTO' : 'PASSAR')
    }
    botao.setFoco = (foco) => {
      if (botao.foco === foco) return
      botao.foco = foco
      botao.desenhar()
      cursor.setVisible(foco)
      this.tweens.killTweensOf(c)
      this.tweens.add({ targets: c, y: y - (foco ? 10 : 0), scale: foco ? 1.1 : 1, duration: 150, ease: 'Back.easeOut' })
    }
    botao.setEscolhido = (escolhido) => {
      botao.escolhido = escolhido
      botao.desenhar()
      if (escolhido) this.tweens.add({ targets: c, scaleY: { from: 1.25, to: botao.foco ? 1.1 : 1 }, duration: 160, ease: 'Quad.easeOut' })
    }
    botao.descer = (descer) => {
      this.tweens.add({ targets: c, y: descer ? MAO_ESCONDIDA + 10 : y, alpha: descer ? 0 : 1, duration: 260, ease: 'Cubic.easeInOut' })
    }
    botao.desenhar()
    this.tweens.add({ targets: cursor, y: -46, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    return botao
  }

  criarTextos() {
    const estilo = (tamanho, cor) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 4, align: 'center' })
    this.banner = this.add.text(LARGURA / 2, 92, '', estilo(26, TEXTO.selecionado)).setOrigin(0.5).setDepth(96)
    this.status = [0, 1].map((j) => this.add.text(CENTROS[j], 84, '', estilo(11, corTexto(CORES.almas[j]))).setOrigin(0.5).setDepth(40))
    this.dica = this.add.text(LARGURA / 2, 322, '', { ...estilo(9, TEXTO.desabilitado), strokeThickness: 2 }).setOrigin(0.5).setDepth(40)
    this.infoPista = [0, 1].map((j) => this.add.text(CENTROS[j], 342, '', estilo(10, TEXTO.normal)).setOrigin(0.5, 0).setDepth(40))
    this.avisoPista = [0, 1].map((j) => this.add.text(CENTROS[j], 92, '', estilo(12, TEXTO.caido)).setOrigin(0.5).setDepth(41))
  }

  // As câmeras de recorte das caixas desenham tudo o que não foi ignorado.
  // Tudo que a câmera principal desenha (HUD, cartas, textos) é de fora das
  // caixas; o que a caixa recorta (balas, coração) já é ignorado pela
  // principal. Roda todo frame, depois do update, então pega também os
  // objetos criados por Mao/Carta/efeitos.
  filtrarCaixas() {
    const caixas = this.caixasDeRecorte
    if (!caixas?.length) return
    const principal = this.cameras.main.id
    let mascara = 0
    for (const caixa of caixas) mascara |= caixa.camera.id
    for (const o of this.children.list) {
      if (o.cameraFilter & principal) continue
      if ((o.cameraFilter & mascara) !== mascara) o.cameraFilter |= mascara
    }
  }

  // ---------- utilidades ----------

  esperar(ms) {
    return new Promise((r) => this.time.delayedCall(ms, r))
  }

  tween(config) {
    return new Promise((r) => this.tweens.add({ ...config, onComplete: r }))
  }

  mostrarBanner(texto, cor = TEXTO.selecionado, { y = 92, tamanho = 26, ms = 0 } = {}) {
    this.tweens.killTweensOf(this.banner)
    this.banner.setText(texto).setColor(cor).setFontSize(tamanho).setY(y).setAlpha(1).setScale(1.7)
    this.tweens.add({ targets: this.banner, scale: 1, duration: 240, ease: 'Back.easeOut' })
    if (ms) this.tweens.add({ targets: this.banner, alpha: 0, delay: ms, duration: 250 })
  }

  esconderBanner() {
    this.tweens.killTweensOf(this.banner)
    this.tweens.add({ targets: this.banner, alpha: 0, duration: 160 })
  }

  // etiqueta pequena que sobe e some (efeito de carta, +HP, ESCUDO...)
  etiquetaEm(x, y, texto, cor, { atraso = 0, tamanho = 14, ms = 1300 } = {}) {
    const t = this.add
      .text(x, y, texto, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 4, align: 'center' })
      .setOrigin(0.5)
      .setDepth(97)
      .setAlpha(0)
      .setScale(0.5)
    this.tweens.add({ targets: t, alpha: 1, scale: 1, delay: atraso, duration: 180, ease: 'Back.easeOut' })
    this.tweens.add({ targets: t, alpha: 0, y: y - 16, delay: atraso + ms, duration: 300, onComplete: () => t.destroy() })
    return t
  }

  atualizarHuds(animado = true) {
    this.estado.jogadores.forEach((jog, j) => {
      const hud = this.huds[j]
      if (hud.hp !== jog.hp) hud.setHp(jog.hp, animado)
      if (hud.energia !== jog.energia) hud.setEnergia(jog.energia, animado)
    })
  }

  // nome curto do lado j nos textos (a CPU aparece como CPU)
  rotulo(j) {
    return j === this.cpu ? 'CPU' : `P${j + 1}`
  }

  // qual lado o controle j comanda (sozinho, o controle é sempre o do P1)
  ladoDoControle(j) {
    return j
  }

  // ---------- partida ----------

  async partida() {
    await this.abertura()
    while (!this.saindo) {
      await this.inicioDaRodada()
      if (this.saindo) return
      const jogadas = await this.escolha()
      if (this.saindo) return
      const resultado = resolverRodada(this.estado, jogadas[0], jogadas[1])
      this.contarJogadas(resultado)
      await this.revelacao(resultado)
      if (this.saindo) return
      await this.arremesso(resultado)
      if (this.saindo) return
      await this.esquiva(resultado)
      if (this.saindo) return
      const vencedor = await this.terminarRodada(resultado)
      if (this.saindo) return
      if (vencedor) return this.resultado(vencedor)
    }
  }

  async abertura() {
    this.fase = 'abertura'
    const nomes = this.ids.map((id) => PERSONAGENS[id]?.nome?.toUpperCase() ?? id.toUpperCase())
    const textos = [0, 1].map((j) =>
      this.add
        .text(LARGURA / 2 + (j ? 1 : -1) * 90, 200, nomes[j], {
          fontFamily: FONTE,
          fontSize: '30px',
          color: corTexto(PERSONAGENS[this.ids[j]]?.cor ?? 0xffffff),
          stroke: '#000000',
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setDepth(96)
        .setX(j ? LARGURA + 120 : -120),
    )
    const vs = this.add.text(LARGURA / 2, 200, 'VS', { fontFamily: FONTE, fontSize: '22px', color: TEXTO.selecionado, stroke: '#000000', strokeThickness: 5 }).setOrigin(0.5).setDepth(96).setScale(0)
    const tags = [0, 1].map((j) =>
      this.add
        .text(LARGURA / 2 + (j ? 1 : -1) * 90, 232, `P${j + 1}`, { fontFamily: FONTE, fontSize: '13px', color: corTexto(CORES.almas[j]), stroke: '#000000', strokeThickness: 3 })
        .setOrigin(0.5)
        .setDepth(96)
        .setAlpha(0),
    )
    tocar(this, 'voo')
    await Promise.all(textos.map((t, j) => this.tween({ targets: t, x: LARGURA / 2 + (j ? 1 : -1) * 110, duration: 380, ease: 'Back.easeOut' })))
    tocar(this, 'impacto')
    shake(this, 160, 0.01)
    this.tweens.add({ targets: tags, alpha: 1, duration: 200 })
    await this.tween({ targets: vs, scale: 1, duration: 220, ease: 'Back.easeOut' })
    await this.esperar(900)
    await this.tween({ targets: [...textos, vs, ...tags], alpha: 0, duration: 260 })
    ;[...textos, vs, ...tags].forEach((t) => t.destroy())
  }

  async inicioDaRodada() {
    this.fase = 'inicio'
    iniciarRodada(this.estado)
    this.textoRodada.setText(`RODADA ${this.estado.rodada}`)
    this.tweens.add({ targets: this.textoRodada, scale: { from: 1.5, to: 1 }, duration: 260, ease: 'Back.easeOut' })
    this.mostrarBanner(`RODADA ${this.estado.rodada}`, TEXTO.normal, { y: 200, tamanho: 28, ms: 700 })
    tocar(this, 'rodada')
    this.time.delayedCall(260, () => tocar(this, 'energia'))
    this.atualizarHuds()
    this.maos.forEach((m) => m.setAtiva(false))
    await this.sincronizarMaos()
    this.atualizarMontes()
  }

  // A mão visual (Mao) passa a ter as mesmas cartas da mão do estado: cartas
  // que saíram (roubadas) voam até a mão do ladrão; as novas são compradas do
  // monte (ou vêm do lugar da carta roubada).
  async sincronizarMaos({ intervalo = 110 } = {}) {
    const saidas = [[], []]
    this.maos.forEach((mao, j) => {
      const ids = new Set(this.estado.jogadores[j].baralho.mao.map((c) => c.id))
      for (const carta of [...mao.cartas]) {
        if (ids.has(carta.dados.id)) continue
        mao.retirar(carta)
        saidas[j].push(carta)
      }
    })
    const compras = this.maos.map((mao, j) => {
      const presentes = new Set(mao.cartas.map((c) => c.dados.id))
      const novas = this.estado.jogadores[j].baralho.mao.filter((c) => !presentes.has(c.id))
      const total = mao.cartas.length + novas.length
      return Promise.all(
        novas.map((dados, i) => {
          const roubada = saidas[outro(j)].shift()
          if (!roubada) return mao.adicionar({ ...dados }, { atraso: i * intervalo, total })
          // carta roubada: sai do lugar dela na mão do outro
          const monte = mao.monte
          mao.monte = { x: roubada.x, y: roubada.y }
          const p = mao.adicionar({ ...dados }, { atraso: i * intervalo, total })
          mao.monte = monte
          particulas(this, roubada.x, roubada.y, { cor: 0xb8a8ff, quantidade: 12, velocidade: 120 })
          tocar(this, 'roubo')
          roubada.destroy()
          return p
        }),
      )
    })
    // sobrou alguma saída sem destino (não deveria): some
    saidas.flat().forEach((c) => c.scene && c.descartar())
    await Promise.all(compras)
    this.maos.forEach((m, j) => m.setEnergia(this.estado.jogadores[j].energia))
  }

  // ---------- escolha ----------

  escolha() {
    this.fase = 'escolha'
    this.escolhas = [undefined, undefined]
    this.noPassar = [false, false]
    this.relogio = this.tempoEscolha
    this.ultimoSegundo = null
    this.maos.forEach((m, j) => {
      m.setEnergia(this.estado.jogadores[j].energia)
      m.setTravada(false)
      m.selecionar(Math.floor(m.cartas.length / 2))
    })
    this.botoesPassar.forEach((b) => {
      b.setEscolhido(false)
      b.setFoco(false)
    })
    this.dica.setText('←/→ escolher   A: confirmar   B: desfazer / ir para PASSAR   C: pausa')
    this.atualizarEscolha()
    if (this.cpu !== null) this.jogadaDaCpu(this.cpu, this.estado.rodada)
    return new Promise((resolver) => (this.fimDaEscolha = resolver))
  }

  atualizarEscolha() {
    const escolhendo = this.fase === 'escolha'
    for (const j of [0, 1]) {
      const livre = escolhendo && this.escolhas[j] === undefined
      const naMao = livre && !this.noPassar[j]
      this.maos[j].setAtiva(naMao)
      this.maos[j].setTravada(typeof this.escolhas[j] === 'string')
      this.botoesPassar[j].setFoco(livre && this.noPassar[j])
      let texto = ''
      if (escolhendo) {
        if (this.escolhas[j] !== undefined) texto = 'PRONTO!'
        else texto = j === this.cpu ? 'CPU pensando...' : 'escolha uma carta'
      }
      this.status[j].setText(texto)
      this.atualizarPrevia(j)
    }
  }

  // prévia ampliada da carta sob o cursor (ou a explicação do PASSAR)
  atualizarPrevia(j) {
    const mao = this.maos[j]
    // a CPU não abre a prévia ampliada (só o cursor dela anda pela mão)
    const ativo = this.fase === 'escolha' && this.escolhas[j] === undefined && j !== this.cpu
    const carta = ativo && !this.noPassar[j] ? mao.selecionada : null
    const chave = !ativo ? null : this.noPassar[j] ? 'passar' : carta?.dados.id ?? null
    if (this.previas[j]?.chave === chave && (!carta || this.previas[j].indisponivel === carta.indisponivel)) return
    this.previas[j]?.destroy()
    this.previas[j] = null
    if (!chave) return
    const p = PREVIAS[j]
    let previa
    if (chave === 'passar') {
      previa = this.add.container(p.x, p.y).setDepth(60)
      const g = this.add.graphics()
      g.fillStyle(0x0b0914, 0.95)
      g.fillRoundedRect(-80, -50, 160, 100, 8)
      g.lineStyle(2, CORES.almas[j], 1)
      g.strokeRoundedRect(-80, -50, 160, 100, 8)
      const t1 = this.add.text(0, -26, 'PASSAR A VEZ', { fontFamily: FONTE, fontSize: '14px', color: TEXTO.selecionado, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
      const t2 = this.add
        .text(0, 10, `Não joga carta nesta\nrodada e ganha +${ENERGIA.passar}\nde energia.`, { fontFamily: FONTE, fontSize: '10px', color: TEXTO.normal, align: 'center', lineSpacing: 3 })
        .setOrigin(0.5)
      previa.add([g, t1, t2])
    } else {
      previa = new Carta(this, p.x, p.y, carta.dados, { ampliada: p.escala, corFoco: CORES.almas[j] }).setDepth(60)
      if (carta.indisponivel) previa.setIndisponivel(true)
      previa.indisponivel = carta.indisponivel
    }
    previa.chave = chave
    const escala = previa.scaleX
    previa.setScale(escala * 0.85).setAlpha(0.4)
    this.tweens.add({ targets: previa, scaleX: escala, scaleY: escala, alpha: 1, duration: 150, ease: 'Back.easeOut' })
    this.previas[j] = previa
  }

  moverCursor(m, direcao) {
    const mao = this.maos[m]
    const ladoPassar = PASSAR[m].lado
    if (this.noPassar[m]) {
      if (direcao === ladoPassar || !mao.cartas.length) return
      this.noPassar[m] = false
      mao.selecionar(ladoPassar === 'direita' ? mao.cartas.length - 1 : 0)
      tocar(this, 'cartaSelecionar')
    } else {
      const borda = ladoPassar === 'direita' ? mao.indice >= mao.cartas.length - 1 : mao.indice <= 0
      if (direcao === ladoPassar && borda) {
        this.noPassar[m] = true
        tocar(this, 'cartaSelecionar')
      } else mao.mover(direcao === 'direita' ? 1 : -1)
    }
    this.atualizarEscolha()
  }

  apertarA(j) {
    if (this.fase !== 'escolha') return
    const m = this.ladoDoControle(j)
    if (this.escolhas[m] !== undefined) return
    if (this.noPassar[m] || !this.maos[m].cartas.length) return this.escolher(m, null)
    const carta = this.maos[m].selecionada
    if (!carta) return
    const v = podeJogar(this.estado, m, carta.dados.id)
    if (!v.ok) {
      carta.negar()
      this.previas[m]?.negar?.()
      const custo = carta.dados.custo
      this.status[m].setText(`energia insuficiente (custa ${custo})`).setColor(TEXTO.caido)
      this.time.delayedCall(900, () => {
        this.status[m].setColor(corTexto(CORES.almas[m]))
        this.atualizarEscolha()
      })
      return
    }
    this.escolher(m, carta.dados.id)
  }

  apertarB(j) {
    if (this.fase !== 'escolha') return
    // cada um desfaz a sua
    const m = this.ladoDoControle(j)
    if (this.escolhas[m] !== undefined) return this.desfazer(m)
    // nada escolhido: atalho para o PASSAR
    const a = this.ladoDoControle(j)
    if (this.escolhas[a] !== undefined || this.noPassar[a]) return
    this.noPassar[a] = true
    tocar(this, 'cartaSelecionar')
    this.atualizarEscolha()
  }

  escolher(m, id, { automatico = false } = {}) {
    this.escolhas[m] = id
    if (id) {
      this.maos[m].selecionada.confirmar()
    } else {
      tocar(this, 'passar')
      this.noPassar[m] = true
      this.botoesPassar[m].setEscolhido(true)
      if (automatico) this.etiquetaEm(PASSAR[m].x, PASSAR[m].y - 50, 'TEMPO!', TEXTO.caido, { tamanho: 13, ms: 900 })
    }
    this.atualizarEscolha()
    if (this.escolhas.every((e) => e !== undefined)) this.encerrarEscolha()
  }

  // A CPU escolhe a carta (pvp/bot.js), "pensa" um pouco e leva o cursor até
  // ela passo a passo (com som), como um jogador faria; depois confirma.
  async jogadaDaCpu(j, rodada) {
    const valida = () => !this.saindo && this.fase === 'escolha' && this.estado.rodada === rodada && this.escolhas[j] === undefined
    const sorte = (min, max) => min + Math.random() * (max - min)
    const id = escolherJogada(this.estado, j, { nivel: this.nivelBot, rng: this.rngBot })
    await this.esperar(sorte(CPU.pensarMin, CPU.pensarMax))
    const mao = this.maos[j]
    const ladoPassar = PASSAR[j].lado
    const contrario = ladoPassar === 'direita' ? 'esquerda' : 'direita'
    for (let passos = 0; passos < 12 && valida(); passos++) {
      const alvo = id ? mao.cartas.findIndex((c) => c.dados.id === id) : -1
      let direcao = null
      if (!id) direcao = this.noPassar[j] ? null : ladoPassar
      else if (alvo < 0) break
      else if (this.noPassar[j]) direcao = contrario
      else if (alvo !== mao.indice) direcao = alvo > mao.indice ? 'direita' : 'esquerda'
      if (!direcao) break
      this.moverCursor(j, direcao)
      await this.esperar(sorte(CPU.passoMin, CPU.passoMax))
    }
    if (!valida()) return
    await this.esperar(sorte(150, 350))
    if (!valida()) return
    const ok = id && mao.selecionada?.dados.id === id && !this.noPassar[j] && podeJogar(this.estado, j, id).ok
    tocar(this, 'cpu')
    this.escolher(j, ok ? id : null)
  }

  desfazer(m) {
    tocar(this, 'cancelar')
    const id = this.escolhas[m]
    this.escolhas[m] = undefined
    if (id) {
      const carta = this.maos[m].cartas.find((c) => c.dados.id === id)
      carta?.virar(true)
      this.noPassar[m] = false
    } else {
      this.botoesPassar[m].setEscolhido(false)
    }
    this.atualizarEscolha()
  }

  encerrarEscolha() {
    this.fase = 'revelacao'
    this.textoRelogio.setText('')
    this.dica.setText('')
    this.atualizarEscolha()
    const jogadas = [...this.escolhas]
    this.time.delayedCall(280, () => this.fimDaEscolha?.(jogadas))
  }

  atualizarRelogio(delta) {
    if (this.fase !== 'escolha' || !this.tempoEscolha) {
      if (this.fase !== 'escolha') this.textoRelogio.setText('')
      return
    }
    this.relogio = Math.max(0, this.relogio - delta)
    const s = Math.ceil(this.relogio / 1000)
    if (s !== this.ultimoSegundo) {
      this.ultimoSegundo = s
      this.textoRelogio.setText(String(s)).setColor(s <= 5 ? TEXTO.caido : TEXTO.selecionado)
      if (s <= 5 && s > 0) {
        tocar(this, 'contador')
        this.tweens.add({ targets: this.textoRelogio, scale: { from: 1.4, to: 1 }, duration: 200 })
      }
    }
    if (this.relogio <= 0) {
      tocar(this, 'erro')
      for (const j of [0, 1]) if (this.escolhas[j] === undefined && this.fase === 'escolha') this.escolher(j, null, { automatico: true })
    }
  }

  // ---------- revelação ----------

  contarJogadas(r) {
    r.jogadas.forEach((jog, j) => {
      const e = this.estatisticas[j]
      if (jog.passou) return e.passes++
      e.cartasJogadas++
      if (jog.carta.valor === 1) e.ases++
      const forca = (c) => (c.valor === 1 ? 14 : c.valor)
      if (!e.maiorCarta || forca(jog.carta) > forca(e.maiorCarta)) {
        const { id, personagem, naipe, valor, nome } = jog.carta
        e.maiorCarta = { id, personagem, naipe, valor, nome }
      }
    })
  }

  // textos do efeito de cada lado (aparecem embaixo da carta revelada)
  textosDoEfeito(r, j) {
    const jog = r.jogadas[j]
    const ef = r.efeitos[j]
    const lista = []
    if (jog.passou) {
      lista.push(['PASSOU', TEXTO.desabilitado])
      if (ef.energia) lista.push([`+${ef.energia} ENERGIA`, '#7fd8ff'])
      return lista
    }
    if (jog.anulada) return [['ANULADA!', TEXTO.caido]]
    const especial = { espelho: 'ESPELHO!', anular: 'ANULAR!', roubo: 'ROUBO!', segundaChance: 'SEGUNDA CHANCE!' }[jog.especial]
    if (especial) lista.push([especial, '#ffe9a0'])
    if (ef.cura) lista.push([`+${ef.cura} HP`, TEXTO.cura])
    if (ef.escudo) lista.push([`ESCUDO -${Math.round((1 - ef.escudo) * 100)}%`, TEXTO.guarda])
    if (ef.energia) lista.push([`+${ef.energia} ENERGIA`, '#7fd8ff'])
    if (ef.compradas.length) lista.push([`+${ef.compradas.length} CARTA${ef.compradas.length > 1 ? 'S' : ''}`, TEXTO.normal])
    if (ef.roubou) lista.push(['ROUBOU 1 CARTA', '#d0b8ff'])
    const caixa = r.caixas.find((c) => c && c.de === j && !c.refletida && c.carta.id === jog.carta.id) ?? r.caixas.find((c) => c && c.de === j)
    if (caixa && !especial && jog.carta.naipe !== 'copas') lista.push([`${TIPOS[jog.carta.naipe]} · ${caixa.dano} por acerto`, TEXTO.normal])
    return lista
  }

  async revelacao(r) {
    this.fase = 'revelacao'
    this.etiquetasMesa = []
    this.atualizarEscolha()
    this.maos.forEach((m) => m.setAtiva(false))
    // as duas (ou o PASSAR) vão para o centro, ainda viradas
    this.reveladas = [0, 1].map((j) => {
      const jog = r.jogadas[j]
      if (jog.passou) {
        const b = this.botoesPassar[j]
        const ficha = this.criarFichaPassar(j, b.c.x, b.c.y)
        b.setEscolhido(false)
        b.setFoco(false)
        return ficha
      }
      const mao = this.maos[j]
      const carta = mao.cartas.find((c) => c.dados.id === jog.carta.id)
      carta.focar(false)
      mao.retirar(carta)
      carta.setDepth(80 + j)
      return carta
    })
    this.maos.forEach((m) => m.setTravada(false))
    tocar(this, 'cartaDeslizar')
    await Promise.all(
      this.reveladas.map((c, j) => this.tween({ targets: c, x: MESA[j].x, y: MESA[j].y, rotation: 0, scaleX: ESCALA_MESA, scaleY: ESCALA_MESA, duration: 320, ease: 'Cubic.easeOut' })),
    )
    this.mostrarBanner('REVELAR!')
    await this.esperar(240)
    await Promise.all(this.reveladas.map((c) => (c instanceof Carta ? c.revelar() : this.tween({ targets: c, scale: ESCALA_MESA * 1.15, duration: 110, yoyo: true }))))

    // destaque do especial da rodada
    const especiais = r.jogadas.map((jog) => (jog.anulada ? null : jog.especial))
    const anulou = r.jogadas.some((jog) => jog.anulada)
    if (anulou) this.mostrarBanner('ANULADA!', TEXTO.caido)
    else if (especiais.includes('espelho')) {
      this.mostrarBanner('ESPELHO!', '#d8ccff')
      tocar(this, 'espelho')
    } else if (especiais.includes('roubo')) {
      this.mostrarBanner('ROUBO!', '#d0b8ff')
      tocar(this, 'roubo')
    }
    else if (especiais.includes('segundaChance')) this.mostrarBanner('SEGUNDA CHANCE!', '#ffe9a0', { tamanho: 22 })
    else if (r.jogadas.every((jog) => jog.passou)) this.mostrarBanner('OS DOIS PASSARAM', TEXTO.desabilitado, { tamanho: 18 })
    else this.esconderBanner()

    // cada lado: efeito embaixo da carta, cartas anuladas, HUD
    for (const j of [0, 1]) {
      const jog = r.jogadas[j]
      const carta = this.reveladas[j]
      if (jog.anulada) this.carimbar(carta, 'ANULADA')
      else if (jog.especial) {
        tocar(this, 'brilhoRank')
        particulas(this, carta.x, carta.y, { cor: CORES_CARTA.ouroClaro, quantidade: 22, velocidade: 160 })
      }
      this.textosDoEfeito(r, j).forEach(([texto, cor], k) =>
        this.etiquetasMesa.push(this.etiquetaEm(MESA[j].x, MESA[j].y + 86 + k * 17, texto, cor, { atraso: 120 + k * 160, tamanho: 12, ms: 1500 })),
      )
      const ef = r.efeitos[j]
      const hud = this.huds[j]
      if (ef.cura) {
        tocar(this, 'cura')
        numero(this, hud.pontoHp.x, hud.pontoHp.y + 6, `+${ef.cura}`, TEXTO.cura, { tamanho: 16 })
      }
      // escudo e energia de copas (o PASSAR já tocou a ficha na escolha)
      if (ef.escudo && !jog.anulada) this.time.delayedCall(180, () => tocar(this, 'escudo'))
      if (ef.energia && !jog.passou) this.time.delayedCall(320, () => tocar(this, 'energia'))
      // escudo: mostra o que vale nesta rodada (gasto no impacto, se vier ataque)
      hud.setEscudo(r.caixas[j]?.escudo ?? this.estado.jogadores[j].escudo)
      hud.setProtegido(this.estado.jogadores[j].protegido)
    }
    this.atualizarHuds()
    // compra extra (copas) e roubo mexem nas mãos
    if (r.efeitos.some((ef) => ef.compradas.length || ef.roubou)) {
      await this.esperar(500)
      await this.sincronizarMaos({ intervalo: 140 })
      this.atualizarMontes()
    }
    await this.esperar(1250)
  }

  criarFichaPassar(j, x, y) {
    const c = this.add.container(x, y).setDepth(80 + j)
    const g = this.add.graphics()
    g.fillStyle(0x1a1626, 0.95)
    g.fillRoundedRect(-24, -34, 48, 68, 6)
    g.lineStyle(2, CORES.almas[j], 1)
    g.strokeRoundedRect(-24, -34, 48, 68, 6)
    const t = this.add.text(0, -6, 'PASSOU', { fontFamily: FONTE, fontSize: '9px', color: TEXTO.normal, stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5)
    const b = this.add.text(0, 12, `+${ENERGIA.passar}`, { fontFamily: FONTE, fontSize: '13px', color: '#7fd8ff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
    c.add([g, t, b])
    return c
  }

  // carimbo vermelho por cima da carta (ANULADA)
  carimbar(carta, texto) {
    tocar(this, 'carimbo')
    if (carta instanceof Carta) {
      carta.setIndisponivel(true)
      carta.negar()
    }
    const t = this.add
      .text(carta.x, carta.y, texto, { fontFamily: FONTE, fontSize: '18px', color: '#ff3048', stroke: '#2a0008', strokeThickness: 5 })
      .setOrigin(0.5)
      .setRotation(-0.35)
      .setDepth(carta.depth + 5)
      .setScale(2.4)
      .setAlpha(0)
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 160, ease: 'Quad.easeIn', onComplete: () => shake(this, 90, 0.006) })
    carta.carimbo = t
  }

  // ---------- arremesso ----------

  async arremesso(r) {
    this.fase = 'arremesso'
    this.esconderBanner()
    if (!r.caixas.some(Boolean)) {
      // ninguém mandou ataque (passou, anulou, segunda chance...): nem abre as caixas
      for (const t of this.etiquetasMesa ?? []) if (t.scene) this.tweens.add({ targets: t, alpha: 0, duration: 150, onComplete: () => t.destroy() })
      this.etiquetasMesa = []
      this.reveladas.forEach((c) => this.tirarDaMesa(c))
      this.reveladas = [null, null]
      this.mostrarBanner('NINGUÉM ATACOU', TEXTO.desabilitado, { y: 200, tamanho: 18, ms: 800 })
      tocar(this, 'vazio')
      await this.esperar(1100)
      return
    }
    // as mãos descem para liberar espaço; as caixas abrem
    this.maos.forEach((m) => m.setPosicao({ y: MAO_ESCONDIDA }))
    this.botoesPassar.forEach((b) => b.descer(true))
    this.status.forEach((s) => s.setText(''))
    this.montes.forEach((m) => this.tweens.add({ targets: [...m.cartas, m.texto], alpha: 0.25, duration: 200 }))
    for (const t of this.etiquetasMesa ?? []) if (t.scene) this.tweens.add({ targets: t, alpha: 0, duration: 150, onComplete: () => t.destroy() })
    this.etiquetasMesa = []

    // cartas que voam (a do ataque e o espelho que rebate); o resto (anulada,
    // segunda chance, PASSOU) sai da mesa
    const usadas = new Set()
    r.caixas.forEach((caixa, j) => {
      if (!caixa) return
      usadas.add(caixa.de)
      if (caixa.refletida) usadas.add(outro(j))
    })
    for (const j of [0, 1]) if (!usadas.has(j)) this.tirarDaMesa(this.reveladas[j])
    // as que voam esperam na coluna do meio (entre as caixas) enquanto elas abrem
    tocar(this, 'caixaAbrir')
    if (usadas.size) tocar(this, 'cartaDeslizar')
    await Promise.all([
      ...this.pistas.map((p) => p.mostrar()),
      ...[...usadas].map((j) => this.tween({ targets: this.reveladas[j], x: LARGURA / 2, y: COLUNA[j], scaleX: 0.8, scaleY: 0.8, duration: 260, ease: 'Cubic.easeOut' })),
    ])
    const voos = [0, 1].map(async (j) => {
      const caixa = r.caixas[j]
      if (!caixa) return
      const carta = this.reveladas[caixa.de]
      await this.esperar(caixa.de * 160)
      if (caixa.refletida) {
        // a carta vai até o espelho do outro e volta para a caixa de quem jogou
        const espelho = this.reveladas[outro(j)]
        await carta.arremessar({ x: espelho.x, y: espelho.y }, { destruir: false, duracao: 300, giros: 1, arco: 30, escalaFinal: carta.scaleX * 0.9 })
        this.etiquetaEm(espelho.x, espelho.y - 80, 'DEVOLVIDA!', '#d8ccff', { tamanho: 14, ms: 700 })
        tocar(this, 'espelho')
        this.tweens.add({ targets: espelho, scaleX: espelho.scaleX * 1.15, scaleY: espelho.scaleY * 1.15, duration: 90, yoyo: true })
        espelho.descartar?.()
        await this.esperar(80)
      }
      await carta.arremessar({ x: CENTROS[j], y: PISTA.y }, { aoImpacto: () => this.impactoNaCaixa(j, caixa) })
    })
    for (const j of [0, 1]) if (!r.caixas[j]) this.infoPista[j].setText('caixa livre nesta rodada').setColor(TEXTO.desabilitado)
    await Promise.all(voos)
    this.reveladas = [null, null]
    await this.esperar(200)
  }

  tirarDaMesa(c) {
    if (!c?.scene) return
    if (c.carimbo) this.tweens.add({ targets: c.carimbo, alpha: 0, duration: 200, onComplete: () => c.carimbo.destroy() })
    if (c instanceof Carta) c.descartar()
    else this.tween({ targets: c, alpha: 0, scale: c.scale * 0.6, duration: 220 }).then(() => c.destroy())
  }

  impactoNaCaixa(j, caixa) {
    const pista = this.pistas[j]
    const borda = pista.caixa.retangulo
    borda.setStrokeStyle(6, 0xffffff)
    this.time.delayedCall(120, () => borda.setStrokeStyle(4, CORES.almas[j]))
    const nome = caixa.carta.nome
    const quem = PERSONAGENS[caixa.carta.personagem]?.nome ?? caixa.carta.personagem
    this.infoPista[j].setText(`${nome} (${quem})${caixa.refletida ? ' · devolvida' : ''}\n${caixa.dano} de dano por acerto`).setColor(TEXTO.normal)
    if (caixa.escudo != null) {
      this.etiquetaEm(CENTROS[j], PISTA.y - PISTA.altura / 2 - 18, `ESCUDO! -${Math.round((1 - caixa.escudo) * 100)}%`, TEXTO.guarda, { tamanho: 13, ms: 1100 })
      tocar(this, 'escudo')
      this.huds[j].setEscudo(this.estado.jogadores[j].escudo)
    }
  }

  // ---------- esquiva ----------

  async esquiva(r) {
    this.fase = 'esquiva'
    this.ko = [false, false]
    this.grazesRodada = [0, 0]
    this.esquivaBot?.reiniciar()
    if (!r.caixas.some(Boolean)) return
    const promessas = [0, 1].map((j) => {
      const caixa = r.caixas[j]
      const ataque = caixa ? ataqueDaCartaNoJogo(caixa.carta) : null
      if (!ataque) return null
      const pista = this.pistas[j]
      pista.tema = TEMAS[caixa.carta.personagem] ?? pista.tema
      if (caixa.inverterMs) this.invertido[j] = { espera: ATAQUE.respiroMs, restante: caixa.inverterMs }
      return pista.rodar(ataque, { dano: caixa.dano, ritmo: caixa.ritmo, semente: `${this.semente}:${this.estado.rodada}:${j}` })
    })
    await Promise.all(promessas.filter(Boolean))
    this.invertido = [0, 0]
    this.avisoPista.forEach((t) => t.setText(''))
    await this.esperar(250)
    if (this.saindo) return
    this.infoPista.forEach((t) => t.setText(''))
    tocar(this, 'caixaFechar')
    await Promise.all(this.pistas.map((p) => p.esconder()))
  }

  acertou(j, dano) {
    if (this.fase !== 'esquiva' || this.ko[j] || debug.invencivel) return false
    const efetivo = aplicarDano(this.estado, j, dano)
    const jog = this.estado.jogadores[j]
    this.estatisticas[j].danoRecebido += efetivo
    this.estatisticas[outro(j)].danoCausado += efetivo
    const hud = this.huds[j]
    hud.setHp(jog.hp)
    hud.tremer()
    numero(this, hud.pontoHp.x, hud.pontoHp.y + 4, efetivo ? `-${efetivo}` : '0', TEXTO.caido, { tamanho: 16, desvio: 12 })
    shake(this, 90, 0.004)
    const borda = this.pistas[j].caixa.retangulo
    borda.setStrokeStyle(4, 0xff3048)
    this.time.delayedCall(140, () => borda.scene && borda.setStrokeStyle(4, CORES.almas[j]))
    if (jog.protegido && jog.hp === 1 && dano > 0) {
      this.etiquetaEm(CENTROS[j], PISTA.y - PISTA.altura / 2 - 18, 'SEGUNDA CHANCE: AGUENTA!', '#ffe9a0', { tamanho: 11, ms: 700 })
    }
    if (jog.hp > 0 && jog.hp <= jog.hpMax * HP_BAIXO && !this.hpAvisado[j]) {
      this.hpAvisado[j] = true
      this.time.delayedCall(120, () => tocar(this, 'hpBaixo'))
    }
    if (jog.hp <= 0) this.nocaute(j)
    return true
  }

  // HP zerou no meio da esquiva: o coração quebra e as duas pistas param logo
  // depois (dá tempo do outro zerar também: empate)
  nocaute(j) {
    this.ko[j] = true
    const coracao = this.pistas[j].coracoes[0]
    tocar(this, 'quebrar')
    flashTela(this, CORES.almas[j], 0.3, 220)
    shake(this, 260, 0.014)
    particulas(this, coracao.x, coracao.y, { cor: CORES.almas[j], quantidade: 30, velocidade: 220, vida: 700 })
    coracao.esconder()
    this.avisoPista[j].setText('K.O.!').setColor(TEXTO.caido).setFontSize(20)
    if (this.paradaAgendada) return
    this.paradaAgendada = true
    this.time.delayedCall(900, () => {
      this.paradaAgendada = false
      this.pistas.forEach((p) => p.parar())
    })
  }

  grazeou(j) {
    if (this.fase !== 'esquiva' || this.ko[j]) return
    this.estatisticas[j].grazes++
    this.grazesRodada[j]++
    const ganho = registrarGrazes(this.estado, j, 1)
    if (ganho) {
      const hud = this.huds[j]
      hud.setEnergia(this.estado.jogadores[j].energia)
      numero(this, hud.pontoEnergia.x, hud.pontoEnergia.y, `+${ganho}`, '#7fd8ff', { tamanho: 14 })
      tocar(this, 'tpMax')
    }
  }

  // ---------- fim da rodada ----------

  async terminarRodada() {
    this.fase = 'fim'
    const vencedor = fimDaRodada(this.estado)
    this.huds.forEach((hud, j) => {
      hud.setProtegido(false)
      hud.setEscudo(this.estado.jogadores[j].escudo)
    })
    this.atualizarHuds()
    this.avisoPista.forEach((t) => t.setText('').setFontSize(12))
    if (vencedor) return vencedor
    // curou acima do limite: o alarme de HP baixo pode tocar de novo
    this.estado.jogadores.forEach((jog, j) => jog.hp > jog.hpMax * HP_BAIXO && (this.hpAvisado[j] = false))
    // as mãos voltam
    tocar(this, 'cartaDeslizar')
    this.maos.forEach((m, j) => m.setPosicao({ y: MAOS[j].y }))
    this.botoesPassar.forEach((b) => b.descer(false))
    this.montes.forEach((m) => this.tweens.add({ targets: [...m.cartas, m.texto], alpha: 1, duration: 200 }))
    await this.esperar(300)
    return null
  }

  async resultado(vencedor) {
    this.fase = 'resultado'
    const v = VENCEDOR[vencedor]
    if (v) {
      const cor = corTexto(PERSONAGENS[this.ids[v - 1]]?.cor ?? 0xffffff)
      this.mostrarBanner(`${this.rotulo(v - 1)} VENCEU!`, cor, { y: 200, tamanho: 34 })
      this.huds[outro(v - 1)].container.setAlpha(0.5)
      tocar(this, 'vitoria')
    } else {
      this.mostrarBanner('EMPATE!', TEXTO.selecionado, { y: 200, tamanho: 34 })
      tocar(this, 'sino')
    }
    shake(this, 300, 0.012)
    this.cameras.main.flash(250, 255, 255, 255)
    await this.esperar(1800)
    if (this.saindo) return
    this.cameras.main.fadeOut(400, 0, 0, 0)
    await this.esperar(420)
    if (this.saindo) return
    this.saindo = true
    this.scene.start('PvpResultado', {
      vencedor: v,
      p1: this.ids[0],
      p2: this.ids[1],
      rodadas: this.estado.rodada,
      cpu: this.cpu !== null,
      estatisticas: { p1: { ...this.estatisticas[0] }, p2: { ...this.estatisticas[1] } },
    })
  }

  // ---------- pause (botão C) ----------

  podePausar() {
    return ['inicio', 'escolha', 'revelacao', 'arremesso', 'esquiva'].includes(this.fase) && !this.saindo && !this.pausado
  }

  pausar() {
    // o mesmo C que fechou o menu chega aqui logo depois: ignora
    if (!this.podePausar() || this.time.now - this.retomadoEm < 200) return
    this.pausado = true
    pausarMusica()
    this.scene.pause()
    const nomes = this.ids.map((id) => PERSONAGENS[id]?.nome ?? id)
    this.scene.launch('Pausa', { cena: 'PvpArena', recomecar: { p1: this.ids[0], p2: this.ids[1] }, sair: 'Modo', subtitulo: `${nomes[0]} x ${nomes[1]}` })
    this.scene.bringToTop('Pausa') // a Pausa vem antes da arena na lista de cenas: sem isso, ela ficaria por baixo
  }

  retomarDaPausa() {
    if (!this.pausado) return
    this.pausado = false
    this.retomadoEm = this.time.now
    this.scene.resume()
    retomarMusica()
  }

  // ---------- frame ----------

  update(_, deltaReal) {
    const delta = deltaReal * debug.acelerar
    this.tweens.timeScale = debug.acelerar
    this.time.timeScale = debug.acelerar
    this.controles.atualizar()

    if (this.fase === 'escolha') {
      for (let j = 0; j < this.numJogadores; j++) {
        const direcao = this.controles.toque(j)
        if (direcao !== 'esquerda' && direcao !== 'direita') continue
        const m = this.ladoDoControle(j)
        if (this.escolhas[m] !== undefined) continue
        this.moverCursor(m, direcao)
      }
      this.atualizarRelogio(delta)
    }

    this.pistas.forEach((pista, j) => {
      const inv = this.invertido[j]
      const invertendo = Boolean(inv) && inv.espera <= 0 && inv.restante > 0
      let joy = j === this.cpu ? this.joyDaCpu(pista, delta, invertendo) : this.controles.joy(j)
      if (inv) {
        if (inv.espera > 0) inv.espera -= delta
        else if (inv.restante > 0) {
          if (!inv.avisado) {
            inv.avisado = true
            tocar(this, 'inverter')
          }
          inv.restante -= delta
          joy = { x: -joy.x, y: -joy.y }
          this.avisoPista[j].setText(Math.floor(this.time.now / 180) % 2 ? 'CONTROLES INVERTIDOS!' : '').setColor('#ff9a3a')
        } else {
          this.invertido[j] = 0
          if (!this.ko[j]) this.avisoPista[j].setText('')
        }
      }
      pista.atualizar(delta, joy)
    })
  }

  // joystick da CPU na pista dela (pvp/botEsquiva.js)
  joyDaCpu(pista, delta, invertido) {
    const coracao = pista.coracoes[0]
    if (this.fase !== 'esquiva' || !pista.rodando || !coracao?.ativo || this.ko[this.cpu]) return { x: 0, y: 0 }
    return this.esquivaBot.joy(delta, {
      coracao,
      limites: pista.caixa.limites,
      balas: pista.balas.lista,
      velocidade: pista.velocidade ?? this.registry.get('velocidade') ?? CORACAO.velocidadePadrao,
      fatorVelocidade: pista.balas.fatorVelocidade,
      velocidadeMax: pista.balas.velocidadeMax,
      invertido,
    })
  }

  // ---------- testes (dev) ----------

  // Coloca na mão do jogador j as cartas pedidas (ids do baralho dele), na escolha
  forcarMao(j, ids) {
    const b = this.estado.jogadores[j].baralho
    for (const id of ids) {
      if (b.mao.some((c) => c.id === id)) continue
      for (const pilha of [b.monte, b.descarte]) {
        const i = pilha.findIndex((c) => c.id === id)
        if (i < 0) continue
        const [carta] = pilha.splice(i, 1)
        if (b.mao.length >= 5) b.monte.push(b.mao.shift())
        b.mao.push(carta)
        break
      }
    }
    const mao = this.maos[j]
    mao.limpar()
    for (const dados of b.mao) mao.adicionar({ ...dados }, { revelar: true })
    mao.layout(false)
    mao.setEnergia(this.estado.jogadores[j].energia)
    mao.selecionar(0)
    this.atualizarEscolha()
    return b.mao.map((c) => c.id)
  }

  setHp(j, hp) {
    this.estado.jogadores[j].hp = hp
    this.huds[j].setHp(hp)
  }

  setEnergia(j, energia) {
    this.estado.jogadores[j].energia = energia
    this.huds[j].setEnergia(energia)
    this.maos[j].setEnergia(energia)
  }

  estadoDebug() {
    return {
      fase: this.fase,
      rodada: this.estado.rodada,
      cpu: this.cpu,
      nivelBot: this.cpu === null ? null : this.nivelBot,
      relogio: Math.round(this.relogio),
      escolhas: this.escolhas.map((e) => (e === undefined ? 'escolhendo' : e)),
      noPassar: [...this.noPassar],
      vencedor: this.estado.vencedor,
      pausado: this.pausado,
      jogadores: this.estado.jogadores.map((jog, j) => {
        const pista = this.pistas[j]
        const cor = pista.coracoes[0]
        return {
          personagem: jog.personagem,
          hp: jog.hp,
          hpMax: jog.hpMax,
          energia: jog.energia,
          escudo: jog.escudo,
          protegido: jog.protegido,
          mao: jog.baralho.mao.map((c) => c.id),
          maoVisual: this.maos[j].cartas.map((c) => c.dados.id),
          cursor: this.noPassar[j] ? 'passar' : this.maos[j].selecionada?.dados.id ?? null,
          indisponiveis: this.maos[j].cartas.filter((c) => c.indisponivel).map((c) => c.dados.id),
          rodando: pista.ataque?.nome ?? null,
          aberta: pista.aberta,
          balas: pista.balas.lista.length,
          coracao: { x: Math.round(cor.x), y: Math.round(cor.y) },
          invertido: Boolean(this.invertido[j]),
        }
      }),
      estatisticas: this.estatisticas.map((e) => ({ ...e })),
      historico: this.estado.historico,
    }
  }
}

