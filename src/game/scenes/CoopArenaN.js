import Phaser from 'phaser'
import { LARGURA, ALTURA, CENTRO_X, FONTE, CORES, TEXTO, corTexto, DESAFIO, NIVEIS, DIFICULDADES, TEMPOS } from '../constants.js'
import Controles from '../controles.js'
import { tocar, musica, velocidadeMusica, tocarMusicaEspecial, voltarMusicaNormal } from '../audio.js'
import { debug } from '../debug.js'
import { PERSONAGENS } from '../data/personagens.js'
import { CHEFES, nivelDoChefe } from '../coop/chefes/index.js'
import { partyDe } from '../data/batalha.js'
import { criarFundo } from '../backgrounds/index.js'
import { ataques } from '../attacks/index.js'
import Carta, { SIMBOLOS, CORES_CARTA } from '../entities/Carta.js'
import Mao from '../entities/Mao.js'
import Inimigo from '../entities/Inimigo.js'
import Balao from '../entities/Balao.js'
import Pista from '../pvp/Pista.js'
import { ehSuper } from '../pvp/cartas.js'
import { energiaPerfeito, registrarGrazes, ENERGIA } from '../pvp/regras.js'
import { ataqueDaCartaChefe, TIPOS_CHEFE, superDoChefe } from '../coop/cartasChefe.js'
import {
  COOP,
  criarPartidaCoop,
  podeJogarCoop,
  resolverRodadaCoop,
  aplicarDanoCoop,
  calcularGolpes,
  comboDosGolpes,
  aplicarGolpe,
  fracaoDoCombo,
  danoComEscudo,
  registrarPerfeitoCombo,
} from '../coop/regras.js'
import { quadroDoGrupo, inicioDoCoracao } from '../coop/quadro.js'
import { superNoChefe } from '../coop/superNoChefe.js'
import ArenaRedeCoopN from '../coop/ArenaRedeCoopN.js'
import HudCoopN from '../coop/HudCoopN.js'
import { marcadorDaVaga, nomeNoCoracao } from '../coop/marcadores.js'
import { anunciarSuper } from '../pvp/super/anuncio.js'
import { canal, emRede, meuLado, meuIndice, souHostDaRede, irParaCena, participantesDaPartida } from '../rede.js'
import { corDaVaga, textoDaVaga } from '../vagas.js'
import { shake } from '../effects/shake.js'
import { flashTela } from '../effects/flash.js'
import { numero } from '../effects/numero.js'
import { particulas } from '../effects/particulas.js'
import { entrarNoJogo, voltarAoMenu, levouGolpe, informarVida } from '../../lib/saida.js'
import { fatores } from '../acessibilidade.js'

// CO-OP de 3 e 4 jogadores, ONLINE (Fase 5B): cada PC roda esta cena; o HOST DA PARTIDA decide toda regra
// e a ponte (coop/ArenaRedeCoopN.js) liga os PCs em estrela (docs/rede-pvp.md "CO-OP de 3 e 4"). Regras em
// coop/regras.js (N jogadores) e docs/coop-cartas.md. A CoopArena de 2 jogadores continua como era: esta é
// outra cena, para o grupo de 3 e 4, e só existe em rede.
//
// A rodada é a da CoopArena (inicio, escolha, revelacao, super, arremesso, esquiva, contra, fim), com:
//   - UMA mão na tela, a MINHA (o cursor, a prévia e o PASSAR são só meus); os outros aparecem no placar de cada
//     um com o estado da mão (ESCOLHENDO, PRONTO, PASSOU, CAÍDO, SEM CONEXÃO) e a carta de cada um só
//     aparece na revelação
//   - o quadro com N corações: cada um com a COR da vaga, a FORMA (círculo, quadrado, triângulo, losango) e o
//     NOME em cima dele. Sem colisão entre aliados: o coração só leva dano das balas. O meu anda pelo joystick
//     daqui e colide aqui; os dos outros são espelho (anda pelas posições que o host junta num pacote só)
//   - a MIRA do chefe (rodízio, coop/regras.js escolherMira): os mirados ganham a mira girando e o nome no
//     alto do quadro; os tiros mirados só vão para eles
//   - quem caiu da rede fica "SEM CONEXÃO (volta caído)" (fora do quadro e da mira) por 20 s e é DERRUBADO na hora (HP 0);
//     voltou, entra na próxima rodada ainda caído ("voltou caído: precisa de resgate");
//     não voltou, SAIU e a luta segue sem ele
//
//   irParaCena(this, 'CoopArenaN', { chefe, nivel, party: [p1..pN] (por vaga), semente })
//   window.coopArena (dev): estadoDebug, setHp, setEnergia, setHpChefe, forcarMao (valem em todos os PCs)

const CHEFE = { x: CENTRO_X, y: 196 }
const INTENCAO = { x: CENTRO_X, y: 278 }
const LARGURA_INTENCAO = 42
const ROTULO_INTENCAO = { x: INTENCAO.x + 30, y: INTENCAO.y }
// onde ficam, por vaga: a carta revelada na mesa, o golpe carregando e o personagem. Vagas 0 e 1 à esquerda, 2 e 3 à direita
const MESA = [
  { x: 112, y: 172 },
  { x: 246, y: 172 },
  { x: LARGURA - 246, y: 172 },
  { x: LARGURA - 112, y: 172 },
]
const ESCALA_MESA = 1.05
const ARMADA = [
  { x: 52, y: 100 },
  { x: 52, y: 168 },
  { x: LARGURA - 52, y: 100 },
  { x: LARGURA - 52, y: 168 },
]
const ESCALA_ARMADA = 0.55
const PERSONAGEM = [
  { x: 40, y: 262 },
  { x: 40, y: 334 },
  { x: LARGURA - 40, y: 262 },
  { x: LARGURA - 40, y: 334 },
]
const MAO = { x: CENTRO_X - 20, y: 426, monte: { x: 62, y: 404 } }
const PASSAR = { x: CENTRO_X + 150, y: 428 }
const PREVIA = { x: 218, y: 176, escala: 1.5 }
const MAO_FORA = ALTURA + 80
const HP_BAIXO = 0.25
const TEMPO_ESCOLHA = 15000
const PILULA_BLOQUEIO = '#b3162d'
const NOMES_ESPECIAIS = { espelho: 'ESPELHO!', anular: 'ANULAR!', roubo: 'ROUBO!', segundaChance: 'SEGUNDA CHANCE!' }
const NOMES_GOLPE = { espadas: 'GOLPE', ouros: 'GOLPE + ATRASA', paus: 'ARMADILHA', super: 'SUPER', espelho: 'REFLEXO', eco: 'ECO' }

// A instância da cena é REAPROVEITADA pelo Phaser: o que a partida/abertura anterior deixou aqui volta ao
// inicial no começo do init(). Testado em src/game/__tests__/cenasReaproveitadas.test.js.
const estadoInicial = () => ({
  fundo: null,
  inimigo: null,
  textoChefe: null,
  balao: null,
  personagens: null,
  quadro: null,
  pistas: null,
  huds: null,
  mao: null,
  monte: null,
  botaoPassar: null,
  previa: null,
  banner: null,
  status: null,
  dica: null,
  infoQuadro: null,
  textoRodada: null,
  textoRelogio: null,
  textoTreino: null,
  avisos: null,
  etiquetasMesa: [],
  reveladas: [],
  armadas: [],
  intencaoVisual: null,
  rede: null,
  fimDaEscolha: null,
  prontos: [],
  musicaEspecial: null,
  vigia: 0,
})

export default class CoopArenaN extends Phaser.Scene {
  constructor() {
    super('CoopArenaN')
  }

  init(dados) {
    Object.assign(this, estadoInicial())
    this.idChefe = CHEFES[dados?.chefe] ? dados.chefe : this.registry.get('chefe') ?? 'king'
    const nivel = dados?.nivel ?? this.registry.get('nivel')
    this.idNivel = NIVEIS[nivel] ? nivel : 'facil'
    // a party vem nos dados (o registry é de cada PC): uma por vaga
    this.partyDosDados = Array.isArray(dados?.party) && dados.party.filter((id) => PERSONAGENS[id]).length >= 3 ? dados.party.filter((id) => PERSONAGENS[id]).slice(0, 4) : null
    this.semente = dados?.semente ?? `coop4:${Date.now()}`
    this.tempoBase = dados?.tempo ?? TEMPO_ESCOLHA
  }

  create() {
    // só existe em rede: sem a sala não tem com quem jogar
    if (!emRede()) return this.scene.start('Lan')
    this.registry.set('chefe', this.idChefe)
    this.registry.set('nivel', this.idNivel)
    this.defChefe = CHEFES[this.idChefe]
    this.nivel = nivelDoChefe(this.idChefe, this.idNivel)
    const party = this.partyDosDados ?? partyDe(this.registry).slice(0, 4)
    this.ids = party
    this.n = Math.min(4, Math.max(3, party.length))
    this.registry.set('party', this.ids)
    this.meu = meuIndice()
    this.estado = criarPartidaCoop({ party: this.ids, chefe: this.idChefe, nivel: this.idNivel, semente: this.semente })
    this.grupo = this.estado.grupo
    this.quadroCfg = quadroDoGrupo(this.grupo)
    this.nomes = Array.from({ length: this.n }, (_, j) => participantesDaPartida().find((p) => p.indice === j)?.nome ?? `P${j + 1}`)

    this.controles = new Controles(this)
    this.rede = new ArenaRedeCoopN(this, { canal, meuIndice: this.meu, souHost: souHostDaRede(), participantes: participantesDaPartida, dev: Boolean(import.meta.env?.DEV) })
    this.tempoEscolha = this.tempoBase
    this.hpAvisado = Array(this.n).fill(false)
    this.fase = 'abertura'
    this.saindo = false
    this.escolhido = undefined // undefined = escolhendo; null = passei; id = carta
    this.noPassar = false
    this.relogio = 0
    this.ultimoSegundo = null
    this.tempoEsgotado = false
    this.encerrando = false
    this.paradaAgendada = false
    this.invertido = 0
    this.ko = Array(this.n).fill(false)
    this.acertosRodada = Array(this.n).fill(0)
    this.grazesRodada = Array(this.n).fill(0)
    this.perfeitosRodada = Array(this.n).fill(null)
    this.combosRodada = Array(this.n).fill(null)
    this.perfeitoCoop = Array(this.n).fill(false)
    this.rodadaAtual = null
    this.armadas = Array(this.n).fill(null)
    this.reveladas = Array(this.n).fill(null)
    this.prontos = Array(this.n).fill(false)
    this.inicioLuta = this.time.now
    this.estatisticas = Array.from({ length: this.n }, () => ({ danoCausado: 0, danoRecebido: 0, cartasJogadas: 0, maiorCarta: null, grazes: 0, ases: 0, passes: 0, perfeitos: 0, maiorSequencia: 0, supers: 0, maiorGolpe: 0, golpes: 0, criticos: 0 }))
    this.combos = 0
    velocidadeMusica(1)
    // retomada: o host voltou a rodada (2D) ou eu caí e voltei (5A): o estado de agora no lugar do novo
    this.retomada = this.rede.aplicarRetomada(this.sys.settings.data?.retomada)
    this.entrandoNaLuta = Boolean(this.sys.settings.data?.retomada?.entrando)

    this.desenharFundo()
    this.criarChefe()
    this.criarPersonagens()
    this.criarQuadro()
    this.huds = Array.from({ length: this.n }, (_, j) => new HudCoopN(this, { vaga: j, n: this.n, nome: this.nomes[j], personagem: this.ids[j], hpMax: this.estado.jogadores[j].hpMax, meu: j === this.meu }))
    this.criarTopo()
    this.criarMao()
    this.criarTextos()

    this.controles.onBotao((_, botao) => {
      if (this.saindo) return
      if (botao === 'A') this.apertarA()
      else if (botao === 'B') this.apertarB()
    })
    this.events.on('postupdate', this.filtrarCaixas, this)
    if (import.meta.env.DEV) window.coopArena = this
    entrarNoJogo()
    this.events.once('shutdown', () => {
      this.saindo = true
      voltarAoMenu()
      this.events.off('postupdate', this.filtrarCaixas, this)
      this.rede?.destruir()
      this.pistas?.forEach((p) => p.destruir())
      this.voltarDaMusicaEspecial()
      velocidadeMusica(1)
      if (window.coopArena === this) delete window.coopArena
    })
    musica(this.defChefe.musica)
    this.cameras.main.fadeIn(300)
    this.atualizarHuds(false)
    this.atualizarCaidos()
    this.partida()
  }

  // ---------- montagem ----------

  desenharFundo() {
    this.fundo = criarFundo(this, this.defChefe.fundo, this.nivel.fundo)
    this.add.rectangle(0, 0, LARGURA, ALTURA, 0x05030c, 0.22).setOrigin(0).setDepth(-4)
    const g = this.add.graphics().setDepth(-3)
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.7, 0.7, 0.2, 0.2)
    g.fillRect(0, 0, LARGURA, 68)
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.75, 0.75)
    g.fillRect(0, 340, LARGURA, ALTURA - 340)
  }

  criarChefe() {
    const def = this.defChefe
    this.inimigo = new Inimigo(this, CHEFE.x, CHEFE.y, def)
    this.inimigo.nome.setFontSize(13).setStroke('#000000', 3)
    this.textoChefe = this.add.text(CHEFE.x, 115, '', { fontFamily: FONTE, fontSize: '9px', color: '#ffd23c', stroke: '#000000', strokeThickness: 3, align: 'center' }).setOrigin(0.5).setDepth(30)
    this.balao = new Balao(this)
    this.balao.grafico.setDepth(62)
    this.balao.texto.setDepth(63)
    this.atualizarChefe()
  }

  // os personagens da party nos cantos (vagas 0 e 1 à esquerda, 2 e 3 à direita), virados para o meio, com a forma e o nome
  criarPersonagens() {
    this.avisos = []
    this.personagens = Array.from({ length: this.n }, (_, j) => {
      const { x, y } = PERSONAGEM[j]
      const direita = j >= 2
      const sprite = this.add.image(x, y, this.ids[j]).setScale(2).setFlipX(direita).setDepth(1)
      const idle = this.tweens.add({ targets: sprite, y: y - 3, duration: 700 + j * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      const aviso = this.add
        .text(x, y - 40, '', { fontFamily: FONTE, fontSize: '8px', color: TEXTO.caido, stroke: '#000000', strokeThickness: 3, align: 'center' })
        .setOrigin(0.5)
        .setDepth(2)
      const tag = this.add
        .text(x, y + 30, nomeNoCoracao(this.nomes[j], 9), { fontFamily: FONTE, fontSize: '8px', color: textoDaVaga(j), stroke: '#000000', strokeThickness: 3 })
        .setOrigin(0.5)
        .setDepth(2)
      this.avisos.push(aviso)
      return { sprite, idle, aviso, tag, x, y, direita }
    })
  }

  // O quadro único com os N corações: cada um com a cor, a forma e o nome da vaga dele
  criarQuadro() {
    const def = this.defChefe
    const cfg = this.quadroCfg
    const velocidadeMax = DIFICULDADES[def.dificuldade].velocidadeMaxBala * DESAFIO.velocidadeMax * this.nivel.velocidadeMax
    const marcadores = {}
    for (let j = 0; j < this.n; j++) marcadores[j] = marcadorDaVaga(j, this.nomes[j])
    const quadro = new Pista(this, {
      x: cfg.x,
      y: cfg.y,
      largura: cfg.largura,
      altura: cfg.altura,
      jogador: Array.from({ length: this.n }, (_, j) => j),
      tema: def.tema,
      velocidadeMax,
      dinamica: { campo: cfg.campo },
      faixa: cfg.faixa,
      marcadores,
    })
    // cada coração leva o próprio dano, com o próprio escudo
    quadro.aoAcertar = (dano, bala, coracao) => this.acertou(coracao.jogador, this.danoNoCoracao(coracao.jogador, dano))
    quadro.aoGraze = (coracao) => this.grazeou(coracao.jogador)
    this.quadro = quadro
    this.pistas = [quadro]
  }

  criarTopo() {
    const texto = (y, tamanho, cor) => this.add.text(CENTRO_X, y, '', { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(70)
    this.textoRodada = texto(6, 8, TEXTO.normal)
    this.textoRelogio = texto(20, 22, TEXTO.selecionado)
    this.textoTreino = texto(48, 7, '#9be7ff').setText(`${this.n} JOGADORES`)
  }

  // a MINHA mão, o monte, o PASSAR ao lado dela
  criarMao() {
    const cor = corDaVaga(this.meu)
    const { x, y } = MAO.monte
    this.monte = {
      cartas: [0, 1, 2].map((k) => new Carta(this, x - k * 1.2, y - k * 1.8, { personagem: this.ids[this.meu], naipe: 'espadas', valor: 2 }, { virada: true, largura: 46 }).setDepth(5 + k).setRotation(-0.08)),
      texto: this.add.text(x, y + 40, '', { fontFamily: FONTE, fontSize: '10px', color: TEXTO.desabilitado, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(8),
    }
    this.mao = new Mao(this, { jogador: this.meu, cor, rotulo: `P${this.meu + 1}`, x: MAO.x, y: MAO.y, monte: MAO.monte, larguraMax: 150, espacamento: 40, profundidade: 20 })
    this.botaoPassar = this.criarBotaoPassar(cor)
  }

  criarBotaoPassar(cor) {
    const { x, y } = PASSAR
    const c = this.add.container(x, y).setDepth(18)
    const g = this.add.graphics()
    const titulo = this.add.text(0, -12, 'PASSAR', { fontFamily: FONTE, fontSize: '9px', color: TEXTO.normal, stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5)
    const bonus = this.add.text(4, 8, `+${ENERGIA.passar}`, { fontFamily: FONTE, fontSize: '12px', color: '#7fd8ff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
    const gema = this.add.graphics()
    gema.fillStyle(CORES_CARTA.gemaEscura, 1)
    gema.fillPoints([{ x: -12, y: 2 }, { x: -7, y: 8 }, { x: -12, y: 14 }, { x: -17, y: 8 }], true)
    gema.fillStyle(CORES_CARTA.gema, 1)
    gema.fillPoints([{ x: -12, y: 3.5 }, { x: -8.3, y: 8 }, { x: -12, y: 12.5 }, { x: -15.7, y: 8 }], true)
    c.add([g, titulo, gema, bonus])
    const botao = { c, g, titulo, foco: false, escolhido: false }
    botao.desenhar = () => {
      g.clear()
      g.fillStyle(botao.escolhido ? 0x2a2a3a : 0x0b0914, 0.95)
      g.fillRoundedRect(-22, -32, 44, 64, 6)
      g.lineStyle(botao.foco ? 3 : 1.5, botao.foco || botao.escolhido ? cor : 0x5a4a7a, 1)
      g.strokeRoundedRect(-22, -32, 44, 64, 6)
      titulo.setText(botao.escolhido ? 'PRONTO' : 'PASSAR')
    }
    botao.setFoco = (foco) => {
      if (botao.foco === foco) return
      botao.foco = foco
      botao.desenhar()
      this.tweens.killTweensOf(c)
      this.tweens.add({ targets: c, y: y - (foco ? 10 : 0), scale: foco ? 1.1 : 1, duration: 150, ease: 'Back.easeOut' })
    }
    botao.setEscolhido = (escolhido) => {
      botao.escolhido = escolhido
      botao.desenhar()
    }
    botao.descer = (descer) => this.tweens.add({ targets: c, y: descer ? MAO_FORA + 10 : y, alpha: descer ? 0 : 1, duration: 260, ease: 'Cubic.easeInOut' })
    botao.desenhar()
    return botao
  }

  criarTextos() {
    const estilo = (tamanho, cor) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 4, align: 'center' })
    this.banner = this.add.text(CENTRO_X, 100, '', estilo(26, TEXTO.selecionado)).setOrigin(0.5).setDepth(96)
    this.status = this.add.text(MAO.x, 372, '', estilo(11, textoDaVaga(this.meu))).setOrigin(0.5).setDepth(40)
    this.dica = this.add.text(CENTRO_X, 462, '', { ...estilo(9, TEXTO.desabilitado), strokeThickness: 2 }).setOrigin(0.5).setDepth(40)
    this.infoQuadro = this.add.text(CENTRO_X, this.quadroCfg.campo.base + 2, '', estilo(9, TEXTO.normal)).setOrigin(0.5, 0).setDepth(40)
  }

  // As câmeras de recorte das caixas desenham tudo o que não foi ignorado (como na PvpArena)
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

  mostrarBanner(texto, cor = TEXTO.selecionado, { y = 100, tamanho = 26, ms = 0 } = {}) {
    this.tweens.killTweensOf(this.banner)
    this.banner.setText(texto).setColor(cor).setFontSize(tamanho).setY(y).setAlpha(1).setScale(1.7)
    this.tweens.add({ targets: this.banner, scale: 1, duration: 240, ease: 'Back.easeOut' })
    if (ms) this.tweens.add({ targets: this.banner, alpha: 0, delay: ms, duration: 250 })
  }

  esconderBanner() {
    this.tweens.killTweensOf(this.banner)
    this.tweens.add({ targets: this.banner, alpha: 0, duration: 160 })
  }

  etiquetaEm(x, y, texto, cor, { atraso = 0, tamanho = 14, ms = 1300 } = {}) {
    const t = this.add.text(x, y, texto, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 4, align: 'center' }).setOrigin(0.5).setDepth(97).setAlpha(0).setScale(0.5)
    this.tweens.add({ targets: t, alpha: 1, scale: 1, delay: atraso, duration: 180, ease: 'Back.easeOut' })
    this.tweens.add({ targets: t, alpha: 0, y: y - 16, delay: atraso + ms, duration: 300, onComplete: () => t.destroy() })
    return t
  }

  tirarDaMesa(c) {
    if (!c?.scene) return
    if (c.carimbo) this.tweens.add({ targets: c.carimbo, alpha: 0, duration: 200, onComplete: () => c.carimbo.destroy() })
    if (c instanceof Carta) c.descartar()
    else this.tween({ targets: c, alpha: 0, scale: c.scale * 0.6, duration: 220 }).then(() => c.destroy())
  }

  carimbar(carta, texto) {
    tocar(this, 'carimbo')
    if (carta instanceof Carta) {
      carta.setIndisponivel(true)
      carta.negar()
    }
    const t = this.add.text(carta.x, carta.y, texto, { fontFamily: FONTE, fontSize: '18px', color: '#ff3048', stroke: '#2a0008', strokeThickness: 5 }).setOrigin(0.5).setRotation(-0.35).setDepth(carta.depth + 5).setScale(2.4).setAlpha(0)
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 160, ease: 'Quad.easeIn', onComplete: () => shake(this, 90, 0.006) })
    carta.carimbo = t
  }

  // ---------- placar, caídos, presença ----------

  nomeDe(j) {
    return this.nomes[j] ?? `P${j + 1}`
  }

  // o texto do estado da mão de cada jogador no cartão dele
  textoDoEstado(j) {
    const jog = this.estado.jogadores[j]
    const lista = participantesDaPartida()
    const p = lista.find((x) => x.indice === j)
    if (jog.saiu || !p) return ['SAIU', TEXTO.caido]
    if (p.caiu != null) return [`SEM CONEXÃO (volta caído) ${Math.max(0, Math.ceil(p.caiu / 1000))}s`, '#ff9a3a']
    if (jog.caido) return [`CAÍDO · volta em ${Math.max(1, (jog.voltaEm ?? 0) - this.estado.rodada)}`, TEXTO.caido]
    if (this.fase === 'escolha') return this.prontos[j] ? ['PRONTO', TEXTO.cura] : ['ESCOLHENDO', TEXTO.desabilitado]
    return ['', TEXTO.desabilitado]
  }

  atualizarEstados() {
    this.estado.jogadores.forEach((jog, j) => {
      const [texto, cor] = this.textoDoEstado(j)
      this.huds[j].setEstado(texto, cor)
      this.huds[j].setApagado(jog.caido || jog.saiu || this.rede.fora(j))
    })
  }

  marcarPronto(j) {
    this.prontos[j] = true
    if (this.huds) this.atualizarEstados()
  }

  atualizarHuds(animado = true) {
    this.estado.jogadores.forEach((jog, j) => {
      const hud = this.huds[j]
      if (hud.hp !== jog.hp) hud.setHp(jog.hp, animado)
      if (hud.energia !== jog.energia) hud.setEnergia(jog.energia, animado)
      hud.setMao(jog.caido || jog.saiu ? 0 : jog.baralho.mao.length)
      if (hud.sequencia !== (jog.sequencia ?? 0)) hud.setSequencia(jog.sequencia ?? 0, animado)
    })
    this.atualizarEstados()
  }

  atualizarChefe() {
    const c = this.estado.chefe
    this.inimigo.atualizar(c.hp, c.hpMax)
    const partes = []
    if (c.guarda != null) partes.push(`GUARDA -${Math.round((1 - c.guarda) * 100)}%`)
    const faltam = c.cargaMax - c.carga
    partes.push(faltam <= 1 ? 'SUPER DO CHEFE NA PRÓXIMA!' : `SUPER DO CHEFE EM ${faltam}`)
    this.textoChefe.setText(partes.join('  ')).setColor(faltam <= 1 ? '#ff6a4a' : '#ffd23c')
  }

  // quem caiu: personagem deitado; quem está sem conexão ou saiu: apagado
  atualizarCaidos() {
    this.estado.jogadores.forEach((jog, j) => {
      const p = this.personagens[j]
      const fora = jog.saiu || this.rede.fora(j)
      const caido = jog.caido || fora
      if (caido !== p.caido) {
        p.caido = caido
        this.tweens.killTweensOf(p.sprite)
        if (caido) {
          p.idle.stop()
          this.tweens.add({ targets: p.sprite, angle: p.direita ? -90 : 90, y: p.y + 14, alpha: 0.5, duration: 260, ease: 'Quad.easeIn' })
          p.sprite.setTint(fora ? 0x606070 : 0x8080a0)
        } else {
          p.sprite.clearTint()
          this.tweens.add({ targets: p.sprite, angle: 0, y: p.y, alpha: 1, duration: 260, ease: 'Back.easeOut' })
          p.idle = this.tweens.add({ targets: p.sprite, y: p.y - 3, duration: 700 + j * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 260 })
        }
      }
      const invertendo = j === this.meu && this.invertido && this.fase === 'esquiva'
      if ((this.fase !== 'esquiva' || !this.ko[j]) && !invertendo) {
        const faltam = Math.max(1, (jog.voltaEm ?? 0) - this.estado.rodada)
        p.aviso.setText(jog.saiu ? 'SAIU' : fora ? 'SEM\nCONEXÃO' : jog.caido ? `CAÍDO\nvolta em ${faltam}` : '').setColor(fora ? '#ff9a3a' : TEXTO.caido)
      }
    })
    this.atualizarEstados()
  }

  personagemPula(j) {
    const p = this.personagens[j]
    if (p.caido) return
    this.tweens.add({ targets: p.sprite, x: p.x + (p.direita ? -14 : 14), duration: 90, yoyo: true, ease: 'Quad.easeOut' })
  }

  personagemDoi(j) {
    const p = this.personagens[j]
    p.sprite.setTint(0xff5050)
    this.time.delayedCall(120, () => !p.caido && p.sprite.clearTint())
    this.tweens.add({ targets: p.sprite, x: p.x + (p.direita ? 4 : -4), duration: 40, yoyo: true, repeat: 2, onComplete: () => (p.sprite.x = p.x) })
  }

  falar(texto, ms = 2200) {
    if (!texto) return
    this.balao.mostrar(texto, CHEFE.x - 44, 150)
    this.time.delayedCall(ms, () => this.balao.esconder())
  }

  falaDaFase() {
    const falas = this.defChefe.fases[this.estado.chefe.fase]?.falas ?? this.defChefe.fases[0].falas ?? []
    return falas.length ? falas[Math.floor(Math.random() * falas.length)] : ''
  }

  // ---------- partida ----------

  extrasRetomada() {
    return { estatisticas: this.estatisticas, combos: this.combos }
  }

  async partida() {
    const vez = (this.vezPartida = (this.vezPartida ?? 0) + 1)
    const fora = () => this.saindo || this.vezPartida !== vez
    if (this.retomada) this.mostrarFaseRetomada()
    else await this.abertura()
    if (this.entrandoNaLuta) {
      // voltou da queda no meio da luta: vê a mão e o placar como estão e entra na rodada seguinte
      this.mostrarBanner('VOCÊ VOLTOU!\nentra na próxima rodada', TEXTO.cura, { y: 236, tamanho: 18, ms: 2400 })
      this.sincronizarMao()
      this.atualizarMonte()
      this.atualizarChefe()
    }
    while (!fora()) {
      await this.inicioDaRodada()
      if (fora()) return
      const jogadas = await this.escolha()
      if (fora()) return
      const r = await this.decidirRodada(jogadas)
      if (fora() || !r) return
      this.rodadaAtual = r
      this.contarJogadas(r)
      await this.revelacao(r)
      if (fora()) return
      await this.anunciarSupers(r)
      if (fora()) return
      await this.arremesso(r)
      if (fora()) return
      await this.esquiva(r)
      if (fora()) return
      await this.contraAtaque(r)
      if (fora()) return
      const vencedor = await this.terminarRodada(r)
      if (fora()) return
      if (vencedor) return this.resultado(vencedor)
    }
  }

  // A resolução (resolverRodadaCoop): só o host resolve (a jogada que não vale lá vira passar) e manda
  async decidirRodada(minha) {
    if (!this.rede.souHost) return this.rede.receberResolucao()
    const jogadas = this.rede.validarJogadas(await this.rede.juntarJogadas(this.tempoEscolha), (j, id) => podeJogarCoop(this.estado, j, id))
    if (this.saindo) return null
    void minha
    const r = resolverRodadaCoop(this.estado, ...jogadas)
    this.rede.enviarResolucao(jogadas, r)
    return r
  }

  async abertura() {
    this.fase = 'abertura'
    for (let i = 0; i < 40 && this.scene.isActive('Entrada'); i++) await this.esperar(50)
    const estilo = (tamanho, cor) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 5, align: 'center' })
    const lista = this.nomes.map((nome) => nomeNoCoracao(nome, 9)).join(' · ')
    const time = this.add.text(-300, 214, lista, estilo(this.n === 4 ? 18 : 22, '#ffffff')).setOrigin(0.5).setDepth(96)
    const vs = this.add.text(LARGURA / 2, 246, 'CONTRA', estilo(14, TEXTO.selecionado)).setOrigin(0.5).setDepth(96).setScale(0)
    const chefe = this.add.text(LARGURA + 200, 278, this.defChefe.nome.toUpperCase(), estilo(26, corTexto(this.defChefe.tema.cor))).setOrigin(0.5).setDepth(96)
    tocar(this, 'voo')
    await this.tween({ targets: time, x: LARGURA / 2, duration: 360, ease: 'Back.easeOut' })
    this.tween({ targets: vs, scale: 1, duration: 200, ease: 'Back.easeOut' })
    await this.tween({ targets: chefe, x: LARGURA / 2, duration: 360, ease: 'Back.easeOut' })
    tocar(this, 'impacto')
    shake(this, 180, 0.012)
    this.inimigo.dano(0.3)
    this.falar(this.defChefe.textoInicial, 1800)
    await this.esperar(1300)
    await this.tween({ targets: [time, vs, chefe], alpha: 0, duration: 260 })
    ;[time, vs, chefe].forEach((t) => t.destroy())
  }

  async inicioDaRodada() {
    this.fase = 'inicio'
    this.rodadaAtual = null
    this.prontos = Array(this.n).fill(false)
    const eventos = await this.rede.iniciarRodada()
    if (!eventos) return
    this.entrandoNaLuta = false
    this.textoRodada.setText(`RODADA ${this.estado.rodada}`)
    this.tweens.add({ targets: this.textoRodada, scale: { from: 1.5, to: 1 }, duration: 260, ease: 'Back.easeOut' })
    this.mostrarBanner(`RODADA ${this.estado.rodada}`, TEXTO.normal, { y: 236, tamanho: 26, ms: 700 })
    tocar(this, 'rodada')
    this.time.delayedCall(260, () => tocar(this, 'energia'))
    this.atualizarHuds()
    for (const ev of eventos) {
      if (ev.tipo === 'voltouCaido') {
        const q = this.personagens[ev.j]
        this.etiquetaEm(q.x + (q.direita ? -20 : 20), q.y - 62, 'voltou caído: precisa de resgate', '#ff9a3a', { tamanho: 9, ms: 2400 })
        this.mostrarBanner(`${this.nomeDe(ev.j)} voltou caído:\nprecisa de resgate`, '#ff9a3a', { y: 236, tamanho: 16, ms: 2000 })
        continue
      }
      if (ev.tipo !== 'voltou') continue
      const p = this.personagens[ev.j]
      this.etiquetaEm(p.x + (p.direita ? -20 : 20), p.y - 62, 'VOLTOU!', TEXTO.cura, { tamanho: 11, ms: 1200 })
      tocar(this, 'cura')
    }
    this.atualizarCaidos()
    this.atualizarChefe()
    this.mao.setAtiva(false)
    await this.sincronizarMao()
    this.atualizarMonte()
    if (eventos.some((e) => e.tipo === 'superChefe')) await this.anunciarSuperChefe()
    if (this.saindo) return
    await this.mostrarIntencao()
  }

  // O chefe joga UMA carta virada embaixo dele, com o naipe à vista: o ataque dela vai no quadro, nos dois
  async mostrarIntencao() {
    const dados = this.estado.chefe.intencao
    if (!dados) return
    const cor = this.defChefe.tema.cor
    const { x, y } = INTENCAO
    const carta = new Carta(this, CHEFE.x, CHEFE.y, { ...dados }, { virada: true, largura: LARGURA_INTENCAO, cor }).setDepth(26).setScale(0.4)
    const sup = ehSuper(dados)
    const selo = this.add
      .text(x, y, sup ? '★' : SIMBOLOS[dados.naipe], { fontFamily: FONTE, fontSize: sup ? '22px' : '20px', color: sup ? '#ffd23c' : dados.naipe === 'copas' || dados.naipe === 'ouros' ? '#ff5a70' : '#ffffff', stroke: '#000000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(27)
      .setAlpha(0)
    const rotulo = this.add
      .text(ROTULO_INTENCAO.x, ROTULO_INTENCAO.y, sup ? 'SUPER!' : TIPOS_CHEFE[dados.naipe], { fontFamily: FONTE, fontSize: '9px', color: sup ? '#ff6a4a' : TEXTO.normal, stroke: '#000000', strokeThickness: 3, align: 'left' })
      .setOrigin(0, 0.5)
      .setDepth(27)
      .setAlpha(0)
    tocar(this, 'cartaArremessar')
    if (Math.random() < 0.6) this.falar(this.falaDaFase(), 1900)
    await this.tween({ targets: carta, x, y, scale: 1, rotation: 0, duration: 320, ease: 'Cubic.easeOut' })
    this.tweens.add({ targets: [selo, rotulo], alpha: 1, duration: 160 })
    if (sup) this.tweens.add({ targets: rotulo, scale: 1.25, duration: 260, yoyo: true, repeat: -1 })
    this.intencaoVisual = { carta, selo, rotulo }
    // QUEM É O ALVO desta rodada, já na intenção (antes da carta virar)
    const mira = this.estado.chefe.mira
    if (mira?.length) this.mostrarAlvos(mira)
  }

  // o chefe mira em quem? (rodízio de mira): o nome dos alvos no alto do quadro e, na esquiva, a mira girando no coração
  mostrarAlvos(mira) {
    const nomes = mira.map((j) => nomeNoCoracao(this.nomeDe(j), 8)).join(' · ')
    this.etiquetaEm(CENTRO_X, 126, `ALVO: ${nomes}`, '#ff7a6a', { tamanho: 11, ms: 2200 })
    mira.forEach((j) => {
      const p = this.personagens[j]
      this.etiquetaEm(p.x + (p.direita ? -22 : 22), p.y - 62, 'ALVO!', '#ff7a6a', { tamanho: 9, ms: 1800, atraso: 100 })
    })
    tocar(this, 'cartaSelecionar')
  }

  limparIntencao({ manterCarta = false } = {}) {
    const v = this.intencaoVisual
    if (!v) return null
    this.intencaoVisual = null
    for (const o of [v.selo, v.rotulo]) {
      this.tweens.killTweensOf(o)
      this.tweens.add({ targets: o, alpha: 0, duration: 150, onComplete: () => o.destroy() })
    }
    if (!manterCarta) this.tirarDaMesa(v.carta)
    return v.carta
  }

  async anunciarSuperChefe() {
    this.fase = 'super'
    const { nome } = superDoChefe(this.idChefe)
    const cor = this.defChefe.tema.cor
    tocar(this, 'superAtivar')
    flashTela(this, cor, 0.35, 320)
    shake(this, 400, 0.014)
    const sprite = this.inimigo.sprite
    this.tweens.add({ targets: sprite, scale: sprite.scale * 1.25, duration: 220, yoyo: true, hold: 600, ease: 'Back.easeOut' })
    particulas(this, CHEFE.x, CHEFE.y, { cor, quantidade: 40, velocidade: 260, vida: 900 })
    this.mostrarBanner(`★ ${nome.toUpperCase()} ★`, corTexto(cor), { y: 236, tamanho: 30, ms: 1500 })
    this.etiquetaEm(LARGURA / 2, 268, 'O SUPER DO CHEFE VAI NO QUADRO DE TODOS!', '#ff6a4a', { atraso: 250, tamanho: 12, ms: 1300 })
    await this.esperar(1900)
  }

  // ---------- a minha mão ----------

  // A mão visual passa a ter as cartas da mão do estado (jogou, roubaram, comprou)
  async sincronizarMao({ intervalo = 110 } = {}) {
    const jog = this.estado.jogadores[this.meu]
    const ids = new Set(jog.baralho.mao.map((c) => c.id))
    for (const carta of [...this.mao.cartas]) {
      if (ids.has(carta.dados.id)) continue
      this.mao.retirar(carta)
      carta.descartar?.()
    }
    const presentes = new Set(this.mao.cartas.map((c) => c.dados.id))
    const novas = jog.baralho.mao.filter((c) => !presentes.has(c.id))
    const total = this.mao.cartas.length + novas.length
    await Promise.all(novas.map((dados, i) => this.mao.adicionar({ ...dados }, { atraso: i * intervalo, total })))
    this.mao.setEnergia(jog.energia)
  }

  atualizarMonte() {
    const n = this.estado.jogadores[this.meu].baralho.monte.length
    this.monte.texto.setText(`${n}`)
    this.monte.cartas.forEach((c, k) => c.setVisible(n > k))
  }

  // ---------- escolha ----------

  escolha() {
    this.fase = 'escolha'
    this.escolhido = undefined
    this.noPassar = false
    this.relogio = this.tempoEscolha
    this.ultimoSegundo = null
    this.tempoEsgotado = false
    const jog = this.estado.jogadores[this.meu]
    this.mao.setEnergia(jog.energia)
    this.mao.setTravada(false)
    this.mao.selecionar(Math.floor(this.mao.cartas.length / 2))
    this.botaoPassar.setEscolhido(false)
    this.botaoPassar.setFoco(false)
    this.dica.setText('←/→ escolher   A: confirmar (não dá para desfazer)   →: PASSAR')
    this.rede.comecarEscolha()
    this.atualizarEstados()
    // quem caiu (ou voltou da rede) não joga: passa sozinho, sem esperar ninguém
    if (jog.caido || jog.saiu) {
      this.escolhido = null
      this.noPassar = true
      this.botaoPassar.setEscolhido(true)
    }
    this.atualizarEscolha()
    return new Promise((resolver) => {
      this.fimDaEscolha = resolver
      if (this.escolhido !== undefined) this.encerrarEscolha()
    })
  }

  atualizarEscolha() {
    const escolhendo = this.fase === 'escolha'
    const livre = escolhendo && this.escolhido === undefined
    const jog = this.estado.jogadores[this.meu]
    this.mao.setAtiva(livre && !this.noPassar)
    this.mao.setTravada(typeof this.escolhido === 'string')
    this.botaoPassar.setFoco(livre && this.noPassar)
    let texto = ''
    let bloqueado = false
    if (escolhendo) {
      if (jog.caido) texto = 'CAÍDO: aguarde (ou um aliado joga ♥ / a rodada limpa)'
      else if (this.escolhido !== undefined) texto = 'PRONTO! esperando os outros...'
      else texto = 'escolha uma carta'
      const bloqueio = livre && !this.noPassar && !jog.caido ? podeJogarCoop(this.estado, this.meu, this.mao.selecionada?.dados.id).bloqueio : null
      if (bloqueio) {
        texto = bloqueio.curto
        bloqueado = true
      }
    }
    this.mostrarStatus(texto, bloqueado)
    this.atualizarPrevia()
  }

  mostrarStatus(texto, bloqueado) {
    const t = this.status
    if (bloqueado && texto) return t.setText(`× ${texto}`).setColor('#ffffff').setBackgroundColor(PILULA_BLOQUEIO).setPadding(6, 2, 6, 2)
    return t.setText(texto).setColor(textoDaVaga(this.meu)).setBackgroundColor('').setPadding(0, 0, 0, 0)
  }

  atualizarPrevia() {
    const ativo = this.fase === 'escolha' && this.escolhido === undefined && !this.estado.jogadores[this.meu].caido
    const carta = ativo && !this.noPassar ? this.mao.selecionada : null
    const chave = !ativo ? null : this.noPassar ? 'passar' : carta?.dados.id ?? null
    if (this.previa?.chave === chave && (!carta || this.previa.indisponivel === carta.indisponivel)) return
    this.previa?.destroy()
    this.previa = null
    if (!chave) return
    const p = PREVIA
    let previa
    if (chave === 'passar') {
      previa = this.add.container(p.x, p.y).setDepth(60)
      const g = this.add.graphics()
      g.fillStyle(0x0b0914, 0.95)
      g.fillRoundedRect(-80, -50, 160, 100, 8)
      g.lineStyle(2, corDaVaga(this.meu), 1)
      g.strokeRoundedRect(-80, -50, 160, 100, 8)
      const t1 = this.add.text(0, -26, 'PASSAR A VEZ', { fontFamily: FONTE, fontSize: '14px', color: TEXTO.selecionado, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
      const t2 = this.add.text(0, 10, `Não joga carta nesta\nrodada e ganha +${ENERGIA.passar}\nde energia.`, { fontFamily: FONTE, fontSize: '10px', color: TEXTO.normal, align: 'center', lineSpacing: 3 }).setOrigin(0.5)
      previa.add([g, t1, t2])
    } else {
      previa = new Carta(this, p.x, p.y, carta.dados, { ampliada: p.escala, corFoco: corDaVaga(this.meu) }).setDepth(60)
      if (carta.indisponivel) previa.setIndisponivel(true)
      previa.indisponivel = carta.indisponivel
    }
    previa.chave = chave
    const escala = previa.scaleX
    previa.setScale(escala * 0.85).setAlpha(0.4)
    this.tweens.add({ targets: previa, scaleX: escala, scaleY: escala, alpha: 1, duration: 150, ease: 'Back.easeOut' })
    this.previa = previa
  }

  // ←/→: de carta em carta; passando da última para a direita cai no PASSAR (que fica do lado direito da mão)
  moverCursor(direcao) {
    if (this.fase !== 'escolha' || this.escolhido !== undefined || this.estado.jogadores[this.meu].caido) return
    const mao = this.mao
    if (this.noPassar) {
      if (direcao === 'direita' || !mao.cartas.length) return
      this.noPassar = false
      mao.selecionar(mao.cartas.length - 1)
      tocar(this, 'cartaSelecionar')
    } else if (direcao === 'direita' && mao.indice >= mao.cartas.length - 1) {
      this.noPassar = true
      tocar(this, 'cartaSelecionar')
    } else mao.mover(direcao === 'direita' ? 1 : -1)
    this.atualizarEscolha()
  }

  apertarA() {
    if (this.fase !== 'escolha' || this.escolhido !== undefined || this.estado.jogadores[this.meu].caido) return
    if (this.noPassar || !this.mao.cartas.length) return this.escolher(null)
    const carta = this.mao.selecionada
    if (!carta) return
    const v = podeJogarCoop(this.estado, this.meu, carta.dados.id)
    if (!v.ok) {
      carta.negar()
      this.previa?.negar?.()
      this.mostrarStatus(v.bloqueio?.curto ?? v.motivo, true)
      this.time.delayedCall(900, () => this.atualizarEscolha())
      return
    }
    this.escolher(carta.dados.id)
  }

  // B: atalho para o PASSAR (confirmar é definitivo: a jogada já foi para o host)
  apertarB() {
    if (this.fase !== 'escolha' || this.escolhido !== undefined || this.noPassar || this.estado.jogadores[this.meu].caido) return
    this.noPassar = true
    tocar(this, 'cartaSelecionar')
    this.atualizarEscolha()
  }

  escolher(id, { automatico = false } = {}) {
    this.escolhido = id
    this.rede.enviarJogada(id)
    this.prontos[this.meu] = true
    if (id) this.mao.selecionada?.confirmar()
    else {
      tocar(this, 'passar')
      this.noPassar = true
      this.botaoPassar.setEscolhido(true)
      if (automatico) this.etiquetaEm(PASSAR.x, PASSAR.y - 50, 'TEMPO!', TEXTO.caido, { tamanho: 13, ms: 900 })
    }
    this.atualizarEscolha()
    this.atualizarEstados()
    this.encerrarEscolha()
  }

  encerrarEscolha() {
    if (this.fase !== 'escolha' || this.encerrando) return
    this.encerrando = true
    this.textoRelogio.setText('')
    this.dica.setText('')
    const minha = this.escolhido ?? null
    this.time.delayedCall(280, () => {
      this.encerrando = false
      this.fimDaEscolha?.([minha])
    })
  }

  atualizarRelogio(delta) {
    if (this.fase !== 'escolha') {
      this.textoRelogio.setText('')
      return
    }
    this.relogio = Math.max(0, this.relogio - delta)
    const s = Math.ceil(this.relogio / 1000)
    if (s !== this.ultimoSegundo) {
      this.ultimoSegundo = s
      this.textoRelogio.setText(String(s)).setColor(s <= 5 ? TEXTO.caido : TEXTO.selecionado)
      if (s <= 5 && s > 0 && this.escolhido === undefined) {
        tocar(this, 'contador')
        this.tweens.add({ targets: this.textoRelogio, scale: { from: 1.4, to: 1 }, duration: 200 })
      }
    }
    if (this.relogio <= 0 && !this.tempoEsgotado) {
      this.tempoEsgotado = true
      if (this.escolhido === undefined) {
        tocar(this, 'erro')
        this.escolher(null, { automatico: true })
      }
    }
  }

  contarJogadas(r) {
    r.jogadas.forEach((jog, j) => {
      const e = this.estatisticas[j]
      if (jog.passou) return e.passes++
      e.cartasJogadas++
      if (jog.carta.valor === 1) e.ases++
      if (ehSuper(jog.carta)) e.supers++
      const forca = (c) => (ehSuper(c) ? 15 : c.valor === 1 ? 14 : c.valor)
      if (!e.maiorCarta || forca(jog.carta) > forca(e.maiorCarta)) {
        const { id, personagem, naipe, valor, nome } = jog.carta
        e.maiorCarta = { id, personagem, naipe, valor, nome }
      }
    })
  }

  // ---------- revelação ----------

  textosDoEfeito(r, j) {
    const jog = r.jogadas[j]
    const ef = r.efeitos[j]
    const lista = []
    if (jog.passou) {
      if (this.estado.jogadores[j].caido && !ef.levantou) return [['CAÍDO', TEXTO.caido]]
      if (this.estado.jogadores[j].saiu || this.rede.fora(j)) return [['SEM CONEXÃO', '#ff9a3a']]
      lista.push(['PASSOU', TEXTO.desabilitado])
      if (ef.energia) lista.push([`+${ef.energia} ENERGIA`, '#7fd8ff'])
    } else {
      if (jog.super) lista.push(['★ SUPER! ★', '#ffe9a0'])
      if (NOMES_ESPECIAIS[jog.especial]) lista.push([NOMES_ESPECIAIS[jog.especial], '#ffe9a0'])
      const golpe = r.golpes[j]
      if (golpe) lista.push([`${NOMES_GOLPE[golpe.tipo] ?? 'GOLPE'} ${golpe.base}`, '#ffd23c'])
      if (ef.escudo) lista.push([`ESCUDO -${Math.round((1 - ef.escudo) * 100)}%`, TEXTO.guarda])
      if (ef.energia) lista.push([`+${ef.energia} ENERGIA`, '#7fd8ff'])
      if (ef.compradas.length) lista.push([`+${ef.compradas.length} CARTA${ef.compradas.length > 1 ? 'S' : ''}`, TEXTO.normal])
    }
    if (ef.cura) lista.push([ef.levantou ? `LEVANTOU! +${ef.cura} HP` : `+${ef.cura} HP`, TEXTO.cura])
    if (ef.apoio?.length) lista.push([`APOIA ${ef.apoio.map((k) => nomeNoCoracao(this.nomeDe(k), 5)).join('+')}`, TEXTO.cura])
    return lista
  }

  criarFichaPassar(j, x, y) {
    const c = this.add.container(x, y).setDepth(80 + j)
    const g = this.add.graphics()
    g.fillStyle(0x1a1626, 0.95)
    g.fillRoundedRect(-22, -31, 44, 62, 6)
    g.lineStyle(2, corDaVaga(j), 1)
    g.strokeRoundedRect(-22, -31, 44, 62, 6)
    const t = this.add.text(0, -6, 'PASSOU', { fontFamily: FONTE, fontSize: '8px', color: TEXTO.normal, stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5)
    const b = this.add.text(0, 11, `+${ENERGIA.passar}`, { fontFamily: FONTE, fontSize: '12px', color: '#7fd8ff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
    c.add([g, t, b])
    return c
  }

  async revelacao(r) {
    this.fase = 'revelacao'
    this.etiquetasMesa = []
    this.balao.esconder()
    this.atualizarEscolha()
    this.mao.setAtiva(false)
    this.status.setText('')
    this.atualizarEstados()
    // as cartas de todos viram na mesa (a minha sai da mão; as dos outros chegam viradas do cartão deles)
    this.reveladas = r.jogadas.map((jog, j) => {
      const hud = this.huds[j]
      const origem = { x: hud.x0 + 95, y: hud.y0 + 30 }
      const caidoOuFora = (this.estado.jogadores[j].caido && !r.efeitos[j].levantou) || this.estado.jogadores[j].saiu || this.rede.fora(j)
      if (jog.passou) {
        if (j === this.meu) {
          this.botaoPassar.setEscolhido(false)
          this.botaoPassar.setFoco(false)
        }
        return caidoOuFora ? null : this.criarFichaPassar(j, origem.x, origem.y)
      }
      if (j === this.meu) {
        const carta = this.mao.cartas.find((c) => c.dados.id === jog.carta.id)
        if (carta) {
          carta.focar(false)
          this.mao.retirar(carta)
          return carta.setDepth(80 + j)
        }
      }
      return new Carta(this, origem.x, origem.y, { ...jog.carta }, { virada: true, largura: 70, corFoco: corDaVaga(j) }).setDepth(80 + j).setScale(0.3)
    })
    this.mao.setTravada(false)
    tocar(this, 'cartaDeslizar')
    await Promise.all(
      this.reveladas.map((c, j) =>
        c &&
        this.tween({ targets: c, x: MESA[j].x, y: MESA[j].y, rotation: 0, scaleX: ESCALA_MESA, scaleY: ESCALA_MESA, duration: 320, ease: 'Cubic.easeOut' }),
      ),
    )
    // o dono de cada carta, embaixo dela (a cor da vaga + o nome)
    for (let j = 0; j < this.n; j++) {
      if (!this.reveladas[j]) continue
      this.etiquetasMesa.push(this.etiquetaEm(MESA[j].x, MESA[j].y - 62, nomeNoCoracao(this.nomeDe(j), 8), textoDaVaga(j), { tamanho: 9, ms: 2600 }))
    }
    this.mostrarBanner('REVELAR!', TEXTO.selecionado, { y: 100 })
    await this.esperar(240)
    const v = this.intencaoVisual
    await Promise.all([
      ...this.reveladas.map((c) => (c instanceof Carta ? c.revelar() : c ? this.tween({ targets: c, scale: ESCALA_MESA * 1.12, duration: 110, yoyo: true }) : null)),
      v
        ? (() => {
            v.selo.setVisible(false)
            return v.carta.revelar().then(() => this.tween({ targets: v.carta, scale: 1.25, rotation: 0, duration: 160, ease: 'Back.easeOut' }))
          })()
        : null,
    ])

    const destaques = { anulada: ['ANULADA', TEXTO.caido], refletida: ['DEVOLVIDA!', '#d8ccff'], roubada: ['ROUBADA!', '#d0b8ff'], varrida: ['VARRIDA!', '#ffe9a0'] }
    if (v && r.intencao) {
      const q = r.destino === 'quadro' ? r.quadro : null
      v.rotulo.setText(`${r.intencao.nome}${q ? `\n${q.dano} por acerto` : ''}`).setScale(1).setX(ROTULO_INTENCAO.x + 6)
      this.tweens.killTweensOf(v.rotulo)
      if (r.destino === 'anulada') this.carimbar(v.carta, 'ANULADA')
      else if (destaques[r.destino]) {
        this.etiquetasMesa.push(this.etiquetaEm(v.carta.x, v.carta.y - 50, destaques[r.destino][0], destaques[r.destino][1], { tamanho: 13, ms: 1500 }))
        tocar(this, r.destino === 'refletida' ? 'espelho' : r.destino === 'roubada' ? 'roubo' : 'brilhoRank')
      }
    }

    for (let j = 0; j < this.n; j++) {
      const carta = this.reveladas[j]
      const jog = r.jogadas[j]
      if (jog.especial && carta) {
        tocar(this, 'brilhoRank')
        particulas(this, carta.x, carta.y, { cor: 0xfff0a8, quantidade: 22, velocidade: 160 })
      }
      this.textosDoEfeito(r, j).forEach(([texto, cor], k) =>
        this.etiquetasMesa.push(this.etiquetaEm(MESA[j].x, MESA[j].y + 62 + k * 13, texto, cor, { atraso: 120 + k * 150, tamanho: 9, ms: 1700 })),
      )
      const ef = r.efeitos[j]
      const hud = this.huds[j]
      if (ef.cura) {
        tocar(this, 'cura')
        numero(this, hud.pontoHp.x, hud.pontoHp.y, `+${ef.cura}`, TEXTO.cura, { tamanho: 13 })
      }
      if (ef.escudo) this.time.delayedCall(180, () => tocar(this, 'escudo'))
      if (ef.energia && !jog.passou) this.time.delayedCall(320, () => tocar(this, 'energia'))
      hud.setEscudo(r.quadro?.escudos[j] ?? this.estado.jogadores[j].escudo)
      hud.setProtegido(this.estado.jogadores[j].protegido)
    }
    if (r.chefe.cura) {
      tocar(this, 'cura')
      numero(this, CHEFE.x, CHEFE.y - 70, `+${r.chefe.cura}`, TEXTO.cura, { tamanho: 18 })
      particulas(this, CHEFE.x, CHEFE.y, { cor: 0x7dff9a, quantidade: 20, velocidade: 120 })
    }
    if (r.chefe.guarda != null) this.etiquetasMesa.push(this.etiquetaEm(CHEFE.x, CHEFE.y + 4, 'GUARDA!', TEXTO.guarda, { atraso: 300, tamanho: 14, ms: 1300 }))
    this.atualizarHuds()
    this.atualizarCaidos()
    this.atualizarChefe()
    if (r.efeitos[this.meu].compradas.length) {
      await this.esperar(400)
      await this.sincronizarMao({ intervalo: 140 })
      this.atualizarMonte()
    }
    await this.esperar(1350)
  }

  // ---------- SUPER dos jogadores ----------

  async anunciarSupers(r) {
    const lados = r.jogadas.map((j, k) => (j.super ? k : -1)).filter((k) => k >= 0)
    if (!lados.length) return
    this.fase = 'super'
    this.esconderBanner()
    for (const j of lados) {
      const carta = r.jogadas[j].carta
      await anunciarSuper(this, { jogador: j < 2 ? 0 : 1, personagem: carta.personagem, carta })
      if (this.saindo) return
    }
    const personagem = r.jogadas[lados[lados.length - 1]].carta.personagem
    const tocou = await tocarMusicaEspecial(`super_${personagem}`)
    if (!tocou) return
    this.musicaEspecial = personagem
    if (this.saindo) this.voltarDaMusicaEspecial()
  }

  voltarDaMusicaEspecial() {
    if (!this.musicaEspecial) return
    this.musicaEspecial = null
    voltarMusicaNormal()
  }

  // ---------- arremesso ----------

  async arremesso(r) {
    this.fase = 'arremesso'
    this.esconderBanner()
    for (const t of this.etiquetasMesa ?? []) if (t.scene) this.tweens.add({ targets: t, alpha: 0, duration: 150, onComplete: () => t.destroy() })
    this.etiquetasMesa = []

    for (let j = 0; j < this.n; j++) {
      const carta = this.reveladas[j]
      if (!carta) continue
      if (r.golpes[j] && carta instanceof Carta) {
        this.armadas[j] = carta
        const direita = j >= 2
        this.tween({ targets: carta, x: ARMADA[j].x, y: ARMADA[j].y, scaleX: ESCALA_ARMADA, scaleY: ESCALA_ARMADA, rotation: direita ? 0.1 : -0.1, duration: 300, ease: 'Cubic.easeOut' })
        this.tweens.add({ targets: carta, y: ARMADA[j].y - 4, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 300 })
        carta.carga = this.add
          .text(ARMADA[j].x, ARMADA[j].y + 38, String(r.golpes[j].base), { fontFamily: FONTE, fontSize: '11px', color: '#ffd23c', stroke: '#000000', strokeThickness: 3 })
          .setOrigin(0.5)
          .setDepth(84)
      } else this.tirarDaMesa(carta)
    }
    this.reveladas = Array(this.n).fill(null)

    const q = r.destino === 'quadro' ? r.quadro : null
    if (!q) {
      const carta = this.limparIntencao({ manterCarta: true })
      if (carta && r.destino === 'roubada') {
        const ladrao = Math.max(0, r.efeitos.findIndex((ef) => ef.roubou))
        carta.arremessar({ x: this.huds[ladrao].pontoEnergia.x, y: this.huds[ladrao].pontoEnergia.y }, { duracao: 380 })
      } else if (carta && r.destino === 'refletida') {
        carta.arremessar({ x: CHEFE.x, y: CHEFE.y - 20 }, { duracao: 340, aoImpacto: () => this.inimigo.dano(0.2) })
      } else if (carta) this.tirarDaMesa(carta)
      this.mostrarBanner('NENHUM ATAQUE DO CHEFE', TEXTO.desabilitado, { y: 236, tamanho: 16, ms: 800 })
      tocar(this, 'vazio')
      await this.esperar(1000)
      return
    }
    this.mao.setPosicao({ y: MAO_FORA })
    this.botaoPassar.descer(true)
    this.status.setText('')
    this.monte.cartas.forEach((c) => this.tweens.add({ targets: c, alpha: 0.25, duration: 200 }))
    this.tweens.add({ targets: this.monte.texto, alpha: 0.25, duration: 200 })
    tocar(this, 'caixaAbrir')
    await this.quadro.mostrar()
    if (this.saindo) return
    this.prepararCoracoes(q)
    const carta = this.limparIntencao({ manterCarta: true })
    if (carta) await carta.arremessar({ x: this.quadroCfg.x, y: this.quadroCfg.y }, { aoImpacto: () => this.impactoNoQuadro(q) })
    else this.impactoNoQuadro(q)
    await this.esperar(200)
  }

  // Quem caiu (ou está sem conexão) não está no quadro. Os corações começam em ordem de vaga, lado a lado;
  // sozinho, no meio. Os mirados ganham a mira (o que o chefe vai atirar neles fica à vista)
  prepararCoracoes(q) {
    const l = this.quadro.caixa.limites
    const dentro = q.jogadores.filter(Boolean).length
    const posicoes = q.jogadores.map((d, j) => (d ? j : -1)).filter((j) => j >= 0)
    this.quadro.coracoes.forEach((c, j) => {
      c.setMirado(Boolean(q.mira?.includes(j)))
      if (!q.jogadores[j] || this.rede.fora(j)) return c.esconder()
      const k = posicoes.indexOf(j)
      const p = dentro === 1 ? { x: l.centerX, y: l.bottom - 30 } : inicioDoCoracao(l, k, dentro)
      c.mostrar(p.x, p.y)
    })
  }

  impactoNoQuadro(q) {
    const borda = this.quadro.caixa.retangulo
    borda.setStrokeStyle(6, CORES.selecionado ?? 0xffd23c)
    this.time.delayedCall(120, () => borda.scene && borda.setStrokeStyle(4, CORES.caixa))
    const extras = [q.lento ? 'ATRASADA' : null, q.inverter ? 'INVERTE!' : null].filter(Boolean).join(' · ')
    const dentro = q.jogadores.map((d, j) => (d ? j : -1)).filter((j) => j >= 0)
    const iguais = dentro.every((j) => q.danos[j] === q.danos[dentro[0]])
    const danos = iguais ? `${q.danos[dentro[0]]} por acerto` : dentro.map((j) => `P${j + 1} ${q.danos[j]}`).join(' · ')
    const alvos = q.mira?.length ? ` · ALVO: ${q.mira.map((j) => nomeNoCoracao(this.nomeDe(j), 7)).join(' · ')}` : ''
    this.infoQuadro.setText(`${q.carta.nome}${extras ? ` · ${extras}` : ''} · ${danos}${alvos}`).setColor(TEXTO.normal)
    for (const j of dentro) {
      if (q.escudos[j] == null) continue
      const p = this.personagens[j]
      this.etiquetaEm(p.x, p.y - 62, `ESCUDO -${Math.round((1 - q.escudos[j]) * 100)}%`, TEXTO.guarda, { tamanho: 8, ms: 1100 })
      tocar(this, 'escudo')
      this.huds[j].setEscudo(this.estado.jogadores[j].escudo)
    }
  }

  // ---------- esquiva ----------

  get ritmoBase() {
    const d = this.defChefe.desafio ?? {}
    const q = this.quadroCfg.ritmo ?? {}
    return {
      velocidade: DESAFIO.velocidade * this.nivel.velocidade * (d.velocidade ?? 1) * (q.velocidade ?? 1),
      densidade: DESAFIO.densidade * this.nivel.densidade * (d.densidade ?? 1) * (q.densidade ?? 1),
    }
  }

  noQuadro(j) {
    return Boolean(this.rodadaAtual?.quadro?.jogadores[j])
  }

  danoNoCoracao(j, dano) {
    return danoComEscudo(dano, this.rodadaAtual?.quadro?.escudos[j] ?? null)
  }

  async esquiva(r) {
    this.fase = 'esquiva'
    this.ko = Array(this.n).fill(false)
    this.grazesRodada = Array(this.n).fill(0)
    this.acertosRodada = Array(this.n).fill(0)
    this.perfeitosRodada = Array(this.n).fill(null)
    this.combosRodada = Array(this.n).fill(null)
    this.perfeitoCoop = Array(this.n).fill(false)
    const q = r.destino === 'quadro' ? r.quadro : null
    if (!q) return
    const ataque = ataqueDaCartaChefe(q.carta, { ataques })
    if (q.inverter) this.invertido = { avisado: false }
    const base = this.ritmoBase
    const ritmo = { velocidade: base.velocidade * q.ritmo.velocidade, densidade: base.densidade * q.ritmo.densidade }
    const promessa = this.quadro.rodar(ataque, { dano: q.dano, ritmo, semente: `${this.semente}:${this.estado.rodada}:quadro`, aceleracao: 1, mira: q.mira ?? null })
    this.rede.comecarLuta()
    await this.rede.esperarFimEsquiva(promessa, q.jogadores)
    if (this.saindo) return
    for (let j = 0; j < this.n; j++) this.perfeitoCoop[j] = q.jogadores[j] && !this.acertosRodada[j] && !this.ko[j] && !this.estado.jogadores[j].caido && !this.rede.fora(j)
    const perfeitos = this.registrarPerfeitosNoQuadro(q)
    this.invertido = 0
    this.avisos.forEach((t, j) => !this.estado.jogadores[j].caido && t.setText(''))
    await this.esperar(250)
    if (this.saindo) return
    this.infoQuadro.setText('')
    tocar(this, 'caixaFechar')
    this.quadro.coracoes.forEach((c) => c.setMirado(false))
    await this.quadro.esconder()
    if (this.saindo || !perfeitos.length) return
    await this.festejarPerfeitos(perfeitos)
  }

  registrarPerfeitosNoQuadro(q) {
    const lista = []
    if (!energiaPerfeito(q.carta)) return lista
    for (let j = 0; j < this.n; j++) {
      if (!this.perfeitoCoop[j]) continue
      const combo = registrarPerfeitoCombo(this.estado, j, q.carta)
      this.perfeitosRodada[j] = combo.ganho
      this.combosRodada[j] = combo.multiplicador
      this.estatisticas[j].perfeitos++
      this.estatisticas[j].maiorSequencia = Math.max(this.estatisticas[j].maiorSequencia ?? 0, combo.sequencia)
      lista.push({ dono: j, ...combo })
    }
    return lista
  }

  // a festa do desvio perfeito de cada um (menor que a da arena de 2: são até 4 ao mesmo tempo)
  async festejarPerfeitos(perfeitos) {
    const nivel = Math.max(...perfeitos.map((p) => p.multiplicador ?? 1))
    tocar(this, 'aplausos')
    if (nivel >= 2) tocar(this, 'energia')
    perfeitos.forEach(({ dono, ganho, multiplicador = 1 }) => {
      const hud = this.huds[dono]
      const p = this.personagens[dono]
      const titulo = multiplicador > 1 ? `PERFEITO x${multiplicador}!` : 'PERFEITO!'
      this.etiquetaEm(p.x + (p.direita ? -30 : 30), p.y - 62, titulo, '#ffe14a', { tamanho: 10 + 2 * (multiplicador - 1), ms: 1200 })
      particulas(this, p.x, p.y, { cor: corDaVaga(dono), quantidade: 18 + 8 * multiplicador, velocidade: 180 })
      hud.setEnergia(this.estado.jogadores[dono].energia)
      hud.setSequencia(this.estado.jogadores[dono].sequencia ?? 0)
      if (ganho) numero(this, hud.pontoEnergia.x, hud.pontoEnergia.y, `+${ganho}`, '#7fd8ff', { tamanho: 14 })
    })
    if (nivel >= 3) {
      shake(this, 160, 0.004)
      flashTela(this, 0xffd23c, 0.1, 200)
    }
    await this.esperar(1100)
  }

  // Um frame do quadro: o meu coração anda pelo joystick daqui; o resto vem da rede. O ♦ Q/K inverte
  atualizarPistas(delta) {
    const quadro = this.quadro
    const inv = this.invertido
    const invertendo = Boolean(inv) && quadro.atacando
    if (invertendo) {
      if (!inv.avisado) {
        inv.avisado = true
        tocar(this, 'inverter')
      }
      const pisca = fatores().pulso > 1 || Math.floor(this.time.now / 180) % 2 ? 'CONTROLES\nINVERTIDOS!' : ''
      if (this.noQuadro(this.meu) && !this.ko[this.meu]) this.avisos[this.meu].setText(pisca).setColor('#ff9a3a')
    } else if (inv?.avisado) {
      this.invertido = 0
      if (!this.ko[this.meu]) this.avisos[this.meu].setText('')
    }
    const joy = this.controles.joy(meuLado())
    const meu = invertendo ? { x: -joy.x, y: -joy.y } : joy
    quadro.atualizar(delta, (jogador) => (jogador === this.meu ? meu : { x: 0, y: 0 }))
  }

  // Quem caiu da rede no meio da esquiva some do quadro; a luta continua sem ele
  vigiarPresenca() {
    if (this.fase !== 'esquiva' || !this.rodadaAtual?.quadro) return
    let mudou = false
    this.quadro.coracoes.forEach((c, j) => {
      if (j === this.meu || !c.ativo || !this.rede.fora(j)) return
      c.esconder()
      this.etiquetaEm(this.personagens[j].x + (this.personagens[j].direita ? -20 : 20), this.personagens[j].y - 62, 'CAIU DA REDE', '#ff9a3a', { tamanho: 8, ms: 1600 })
      mudou = true
    })
    if (mudou) {
      this.atualizarCaidos()
      this.pararSeNinguem()
    }
  }

  pararSeNinguem() {
    const q = this.rodadaAtual?.quadro
    if (!q || this.paradaAgendada) return
    if (q.jogadores.every((dentro, k) => !dentro || this.ko[k] || this.rede.fora(k))) {
      this.paradaAgendada = true
      this.time.delayedCall(700, () => {
        this.paradaAgendada = false
        this.quadro.parar()
      })
    }
  }

  // acerto no coração j: só vale o MEU (o dos outros chega pela rede, aplicarAcerto com doOutro)
  acertou(j, dano) {
    if (!this.rede.ehMeu(j)) return false
    const ok = this.aplicarAcerto(j, dano)
    if (ok) this.rede.enviarDano(j, dano)
    return ok
  }

  aplicarAcerto(j, dano, { doOutro = false } = {}) {
    if (this.fase !== 'esquiva' || this.ko[j] || debug.invencivel) return false
    this.acertosRodada[j]++
    const sequenciaAntes = this.estado.jogadores[j].sequencia ?? 0
    const efetivo = aplicarDanoCoop(this.estado, j, dano)
    if (sequenciaAntes) this.huds[j].comboQuebrou()
    const jog = this.estado.jogadores[j]
    this.estatisticas[j].danoRecebido += efetivo
    const hud = this.huds[j]
    hud.setHp(jog.hp)
    hud.tremer()
    if (j === this.meu) levouGolpe(0)
    numero(this, hud.pontoHp.x, hud.pontoHp.y, efetivo ? `-${efetivo}` : '0', TEXTO.caido, { tamanho: 13, desvio: 12 })
    this.quadro.caixa.tremer(110, 2)
    this.personagemDoi(j)
    const coracao = this.quadro.coracoes[j]
    if (doOutro && coracao?.ativo) {
      coracao.tomarDano(TEMPOS.invencivelMs)
      particulas(this, coracao.x, coracao.y, { cor: coracao.cor, quantidade: 10, velocidade: 110 })
      tocar(this, 'dano')
    }
    const borda = this.quadro.caixa.retangulo
    borda.setStrokeStyle(4, corDaVaga(j))
    this.time.delayedCall(140, () => borda.scene && borda.setStrokeStyle(4, CORES.caixa))
    if (jog.protegido && jog.hp === 1 && dano > 0) this.etiquetaEm(this.personagens[j].x, this.personagens[j].y - 62, 'AGUENTA!', '#ffe9a0', { tamanho: 8, ms: 700 })
    if (jog.hp > 0 && jog.hp <= jog.hpMax * HP_BAIXO && !this.hpAvisado[j]) {
      this.hpAvisado[j] = true
      if (j === this.meu) this.time.delayedCall(120, () => tocar(this, 'hpBaixo'))
    }
    if (jog.caido) this.nocaute(j)
    return true
  }

  nocaute(j) {
    this.ko[j] = true
    const coracao = this.quadro.coracoes[j]
    tocar(this, 'quebrar')
    flashTela(this, corDaVaga(j), 0.25, 220)
    this.quadro.caixa.tremer(260, 4)
    if (coracao?.ativo) particulas(this, coracao.x, coracao.y, { cor: coracao.cor, quantidade: 30, velocidade: 220, vida: 700 })
    coracao?.esconder()
    this.avisos[j].setText('CAIU!').setColor(TEXTO.caido).setFontSize(12)
    this.atualizarCaidos()
    const armada = this.armadas[j]
    if (armada) {
      armada.setIndisponivel?.(true)
      armada.carga?.setText('PERDIDO').setColor(TEXTO.caido)
    }
    this.pararSeNinguem()
  }

  grazeou(j) {
    if (!this.rede.ehMeu(j)) return
    if (this.aplicarGraze(j)) this.rede.enviarGraze(j)
  }

  aplicarGraze(j, { doOutro = false } = {}) {
    if (this.fase !== 'esquiva' || this.ko[j]) return false
    this.estatisticas[j].grazes++
    this.grazesRodada[j]++
    const ganho = registrarGrazes(this.estado, j, 1)
    if (ganho) {
      const hud = this.huds[j]
      hud.setEnergia(this.estado.jogadores[j].energia)
      numero(this, hud.pontoEnergia.x, hud.pontoEnergia.y, `+${ganho}`, '#7fd8ff', { tamanho: 11 })
      if (j === this.meu) tocar(this, 'tpMax')
    }
    if (doOutro) this.quadro.coracoes[j]?.ativo && this.quadro.coracoes[j].piscarGraze()
    const armada = this.armadas[j]
    const jog = this.estado.jogadores[j]
    if (armada?.carga && !jog.caido && armada.dados.naipe === 'paus' && armada.dados.valor !== 1) {
      const bonus = Math.min(COOP.grazeArmadilhaMax, this.grazesRodada[j] * COOP.grazeArmadilha)
      armada.carga.setText(`${armada.carga.text.split(' ')[0]} +${Math.round(bonus * 100)}%`)
    }
    return true
  }

  // ---------- contra-ataque ----------

  async golpesDaRodada(r) {
    if (!this.rede.souHost) return this.rede.receberContra()
    const desempenho = this.estado.jogadores.map((_, j) => ({ perfeito: this.perfeitoCoop?.[j], grazes: this.grazesRodada[j] }))
    const golpes = calcularGolpes(this.estado, r.golpes, desempenho)
    const combo = comboDosGolpes(r.golpes, this.estado.jogadores.map((jog) => jog.caido))
    this.rede.enviarContra(golpes, combo)
    return { golpes, combo }
  }

  async contraAtaque(r) {
    const decisao = await this.golpesDaRodada(r)
    if (!decisao || this.saindo) return
    const { golpes: lista, combo } = decisao
    if (!lista.length) return
    this.fase = 'contra'
    if (combo === 'super') await this.superCombo(lista)
    else {
      if (combo) {
        this.combos++
        tocar(this, 'combo')
        flashTela(this, 0xffd23c, 0.2, 200)
        const grupo = lista.find((g) => g.multiplicadores.some(([nome]) => nome === 'COMBO' || nome === 'PAR'))
        const fator = grupo?.multiplicadores.find(([nome]) => nome === 'COMBO' || nome === 'PAR')?.[1] ?? 1.25
        this.mostrarBanner(`${combo === 'par' ? 'PAR!' : 'COMBO!'}  x${Number(fator.toFixed(2))}`, '#ffd23c', { y: 236, tamanho: 30, ms: 900 })
        await this.esperar(700)
      }
      for (const g of lista) {
        const carta = this.armadas[g.j]
        this.armadas[g.j] = null
        if (!carta) continue
        this.tweens.killTweensOf(carta)
        const carga = carta.carga
        if (g.falhou) {
          carga?.destroy()
          this.tirarDaMesa(carta)
          continue
        }
        this.mostrarMultiplicadores(g)
        carga?.destroy()
        this.personagemPula(g.j)
        await this.esperar(g.multiplicadores.length ? 380 : 120)
        if (g.golpe.tipo === 'super') {
          await carta.arremessar({ x: CHEFE.x, y: CHEFE.y }, { duracao: 300 })
          await superNoChefe(this, carta.dados.personagem, () => this.golpeNoChefe(g))
          if (g.limitado) this.chefeAguentou()
        } else {
          await carta.arremessar({ x: CHEFE.x, y: CHEFE.y }, { duracao: 300, aoImpacto: () => this.golpeNoChefe(g) })
          await this.esperar(260)
        }
        if (this.estado.chefe.hp <= 0) break
      }
    }
    this.armadas.forEach((c) => {
      if (!c) return
      c.carga?.destroy()
      this.tirarDaMesa(c)
    })
    this.armadas = Array(this.n).fill(null)
    await this.esperar(400)
  }

  mostrarMultiplicadores(g) {
    g.multiplicadores.forEach(([nome, fator], k) =>
      this.etiquetaEm(ARMADA[g.j].x + (g.j >= 2 ? -4 : 4), ARMADA[g.j].y + 52 + k * 12, `${nome} x${Number(fator.toFixed(2))}`, nome === 'GUARDA' ? TEXTO.guarda : '#ffd23c', { tamanho: 9, ms: 700 }),
    )
  }

  // 2 ou mais jogaram SUPER: as cartas voam juntas, os efeitos acontecem ao mesmo tempo em cima do chefe
  async superCombo(lista) {
    this.combos++
    const k = lista.filter((g) => g.golpe.tipo === 'super').length
    tocar(this, 'superAtivar')
    flashTela(this, 0xffffff, 0.5, 260)
    shake(this, 300, 0.012)
    this.mostrarBanner(`SUPER COMBO!!  ${Math.round(fracaoDoCombo(this.estado.nivel, k) * 100)}% DO HP`, '#ffe9a0', { y: 236, tamanho: 30, ms: 1300 })
    const arco = [0xff4a5a, 0xffa23a, 0xffe14a, 0x5ae06a, 0x4ab8ff, 0xa66bff]
    arco.forEach((cor, i) => this.time.delayedCall(i * 110, () => this.banner.setColor(corTexto(cor))))
    lista.forEach((g) => {
      this.mostrarMultiplicadores(g)
      this.personagemPula(g.j)
    })
    await this.esperar(1000)
    const total = { dano: 0 }
    await Promise.all(
      lista.map(async (g) => {
        const carta = this.armadas[g.j]
        this.armadas[g.j] = null
        if (!carta) return
        this.tweens.killTweensOf(carta)
        carta.carga?.destroy()
        await carta.arremessar({ x: CHEFE.x, y: CHEFE.y }, { duracao: 300 })
        if (g.golpe.tipo !== 'super') {
          this.golpeNoChefe(g)
          return
        }
        await superNoChefe(this, carta.dados.personagem, () => {
          total.dano += g.dano
          this.golpeNoChefe(g)
        })
      }),
    )
    if (this.saindo) return
    tocar(this, 'estouro')
    flashTela(this, 0xffffff, 0.7, 320)
    shake(this, 520, 0.03)
    arco.forEach((cor, i) => this.time.delayedCall(i * 60, () => particulas(this, CHEFE.x, CHEFE.y, { cor, quantidade: 22, velocidade: 360, vida: 800, escala: 1.8 })))
    numero(this, CHEFE.x, CHEFE.y - 90, `${total.dano}!!`, '#ffe9a0', { tamanho: 34 })
    this.inimigo.dano(1)
    if (lista.some((g) => g.limitado)) this.chefeAguentou()
    await this.esperar(900)
  }

  chefeAguentou() {
    if (this.estado.chefe.hp <= 0) return
    this.etiquetaEm(CHEFE.x, CHEFE.y + 4, 'AGUENTOU!', TEXTO.guarda, { atraso: 200, tamanho: 16, ms: 1300 })
  }

  golpeNoChefe(g) {
    const efetivo = aplicarGolpe(this.estado, g.dano)
    const e = this.estatisticas[g.j]
    e.danoCausado += efetivo
    e.golpes++
    e.maiorGolpe = Math.max(e.maiorGolpe, efetivo)
    const critico = g.multiplicadores.some(([nome]) => nome === 'CRÍTICO')
    if (critico) e.criticos++
    const forte = g.golpe.tipo === 'super' || critico
    tocar(this, forte ? 'critico' : 'golpe')
    this.inimigo.dano(Math.min(1, g.dano / 60))
    const tamanho = g.golpe.tipo === 'super' ? 32 : forte ? 26 : 20
    numero(this, CHEFE.x + (g.j - (this.n - 1) / 2) * 14, CHEFE.y - 40, String(g.dano), forte ? '#ffd23c' : '#ffffff', { tamanho, desvio: 10 })
    particulas(this, CHEFE.x, CHEFE.y, { cor: corDaVaga(g.j), quantidade: forte ? 30 : 14, velocidade: forte ? 240 : 150 })
    shake(this, forte ? 220 : 110, forte ? 0.012 : 0.006)
    if (forte) flashTela(this, 0xffffff, 0.25, 160)
    this.atualizarChefe()
  }

  // ---------- fim da rodada ----------

  async terminarRodada(r) {
    this.fase = 'fim'
    this.voltarDaMusicaEspecial()
    // o host decide (fase nova, vitória, derrota, o resgate por rodada limpa) e manda o estado
    const limpa = r.destino === 'quadro' ? { quadro: r.quadro, acertos: this.acertosRodada } : null
    const fim = await this.rede.fimDaRodada(limpa)
    if (this.saindo || !fim) return null
    const { vencedor, novaFase, resgatados = [] } = fim
    this.huds.forEach((hud, j) => {
      hud.setProtegido(false)
      hud.setEscudo(this.estado.jogadores[j].escudo)
    })
    this.atualizarHuds()
    this.atualizarChefe()
    this.atualizarCaidos()
    this.avisos.forEach((t, j) => !this.estado.jogadores[j].caido && t.setText('').setFontSize(8))
    for (const j of resgatados) {
      const p = this.personagens[j]
      this.etiquetaEm(p.x + (p.direita ? -22 : 22), p.y - 62, 'RESGATADO!', TEXTO.cura, { tamanho: 10, ms: 1500 })
      particulas(this, p.x, p.y, { cor: 0x7dff9a, quantidade: 22, velocidade: 140 })
      tocar(this, 'cura')
    }
    if (resgatados.length) this.mostrarBanner(`RODADA LIMPA!  ${resgatados.map((j) => nomeNoCoracao(this.nomeDe(j), 8)).join(' · ')} VOLTA`, TEXTO.cura, { y: 236, tamanho: 16, ms: 1300 })
    if (vencedor) return vencedor
    if (novaFase != null) await this.trocarFase(novaFase)
    this.estado.jogadores.forEach((jog, j) => jog.hp > jog.hpMax * HP_BAIXO && (this.hpAvisado[j] = false))
    tocar(this, 'cartaDeslizar')
    this.mao.setPosicao({ y: MAO.y })
    this.botaoPassar.descer(false)
    this.monte.cartas.forEach((c) => this.tweens.add({ targets: c, alpha: 1, duration: 200 }))
    this.tweens.add({ targets: this.monte.texto, alpha: 1, duration: 200 })
    await this.esperar(resgatados.length ? 900 : 300)
    return null
  }

  mostrarFaseRetomada() {
    const f = this.estado.chefe?.fase ?? 0
    if (!f) return
    const fase = this.defChefe.fases[f] ?? {}
    this.fundo?.setFase(f, fase.velocidadeFundo ?? 1 + f * 0.25)
  }

  async trocarFase(f) {
    const fase = this.defChefe.fases[f] ?? {}
    this.fundo.setFase(f, fase.velocidadeFundo ?? 1 + f * 0.25)
    tocar(this, 'tensao')
    flashTela(this, this.defChefe.tema.cor, 0.3, 300)
    shake(this, 420, 0.012)
    this.inimigo.dano(0.8)
    this.mostrarBanner(`FASE ${f + 1}!`, corTexto(this.defChefe.tema.cor), { y: 236, tamanho: 30, ms: 1500 })
    this.etiquetaEm(LARGURA / 2, 268, 'cartas novas no baralho do chefe', TEXTO.normal, { atraso: 250, tamanho: 11, ms: 1400 })
    if (fase.entrada) this.falar(fase.entrada, 2200)
    await this.esperar(2000)
  }

  async resultado(vencedor) {
    this.fase = 'resultado'
    this.saindo = false
    const dados = {
      chefe: this.idChefe,
      turnos: this.estado.rodada,
      estatisticas: this.resumo(),
      hpChefe: this.estado.chefe.hp,
      hpMaxChefe: this.estado.chefe.hpMax,
      party: [...this.ids],
    }
    if (vencedor === 'vitoria') {
      this.balao.esconder()
      this.inimigo.sumir()
      tocar(this, 'vitoria')
      await this.esperar(1100)
      this.mostrarBanner('VITÓRIA!', TEXTO.selecionado, { y: 236, tamanho: 36 })
      await this.esperar(1300)
    } else {
      tocar(this, 'gameover')
      this.mostrarBanner('A PARTY CAIU...', TEXTO.caido, { y: 236, tamanho: 30 })
      this.falar(this.falaDaFase(), 1600)
      await this.esperar(1800)
    }
    if (this.saindo) return
    // o host abre a tela do fim em todos (depois da animação dos convidados acabar); o convidado avisa e espera
    if (!(await this.rede.prontoParaResultado())) return
    if (this.saindo) return
    this.saindo = true
    this.cameras.main.fadeOut(400, 0, 0, 0)
    await new Promise((r) => this.time.delayedCall(420, r))
    irParaCena(this, vencedor === 'vitoria' ? 'Vitoria' : 'GameOver', dados)
  }

  // números da luta para as telas de vitória e game over (nota em coop/nota.js)
  resumo() {
    const soma = (campo) => this.estatisticas.reduce((t, e) => t + (e[campo] ?? 0), 0)
    return {
      danoCausado: soma('danoCausado'),
      danoRecebido: soma('danoRecebido'),
      maiorGolpe: Math.max(...this.estatisticas.map((e) => e.maiorGolpe)),
      criticos: soma('criticos'),
      combos: this.combos,
      maiorSequencia: Math.max(...this.estatisticas.map((e) => e.maiorSequencia ?? 0)),
      grazes: soma('grazes'),
      tempoMs: Math.max(0, this.time.now - this.inicioLuta),
      turnos: this.estado.rodada,
      nivel: this.idNivel,
      hpMaxParty: this.estado.jogadores.reduce((t, j) => t + j.hpMax, 0),
      caidosNoFim: this.estado.jogadores.filter((j) => j.caido).length,
      jogadores: this.n,
    }
  }

  // ---------- frame ----------

  update(_, deltaReal) {
    const delta = deltaReal * debug.acelerar
    this.tweens.timeScale = debug.acelerar
    this.time.timeScale = debug.acelerar
    this.controles.atualizar()
    this.fundo.atualizar(delta)
    this.balao.atualizar(delta)
    const jog = this.estado.jogadores[this.meu]
    if (jog) informarVida(0, jog.hp, jog.hpMax)
    if (this.fase === 'escolha') {
      const direcao = this.controles.toque(meuLado())
      if (direcao === 'esquerda' || direcao === 'direita') this.moverCursor(direcao)
      this.atualizarRelogio(delta)
    }
    this.atualizarPistas(delta)
    this.rede.atualizar(delta)
    // a cada ~250 ms: quem caiu da rede / voltou (cartão, personagem, coração)
    this.vigia = (this.vigia ?? 0) + deltaReal
    if (this.vigia > 250) {
      this.vigia = 0
      this.vigiarPresenca()
      this.atualizarCaidos()
    }
  }

  // ---------- testes (dev) ----------

  // as ações de debug valem em todos os PCs (rede.espalhar)
  forcarMao(j, ids) {
    this.rede?.espalhar('forcarMao', [j, ids])
    const jog = this.estado.jogadores[j]
    const mao = jog.baralho.mao
    const resto = jog.baralho.monte
    const todas = [...mao, ...resto, ...jog.baralho.descarte]
    const novas = ids.map((id) => todas.find((c) => c.id === id)).filter(Boolean)
    for (const c of novas) {
      for (const lista of [jog.baralho.mao, jog.baralho.monte, jog.baralho.descarte]) {
        const i = lista.indexOf(c)
        if (i >= 0) lista.splice(i, 1)
      }
    }
    jog.baralho.mao = [...novas, ...jog.baralho.mao].slice(0, 5)
    jog.energia = 10
    if (j === this.meu) this.sincronizarMao()
    this.atualizarHuds(false)
  }

  setHp(j, hp) {
    this.rede?.espalhar('setHp', [j, hp])
    const jog = this.estado.jogadores[j]
    jog.hp = Math.max(0, Math.min(jog.hpMax, hp))
    this.atualizarHuds(false)
  }

  setEnergia(j, energia) {
    this.rede?.espalhar('setEnergia', [j, energia])
    this.estado.jogadores[j].energia = Math.max(0, Math.min(ENERGIA.maxima, energia))
    this.atualizarHuds(false)
  }

  setHpChefe(hp) {
    this.rede?.espalhar('setHpChefe', [hp])
    this.estado.chefe.hp = hp
    this.atualizarChefe()
  }

  estadoDebug() {
    const c = this.estado.chefe
    const q = this.quadro
    const r = this.rodadaAtual
    return {
      fase: this.fase,
      rodada: this.estado.rodada,
      n: this.n,
      meu: this.meu,
      rede: { souHost: this.rede.souHost, espelhos: q.coracoes.map((x) => Boolean(x.espelho)) },
      vencedor: this.estado.vencedor,
      chefe: { id: c.id, hp: c.hp, hpMax: c.hpMax, fase: c.fase, carga: c.carga, intencao: c.intencao?.id ?? null, mira: c.mira },
      quadro: {
        rodando: q.ataque?.nome ?? null,
        aberta: q.aberta,
        balas: q.balas.lista.length,
        jogadores: r?.quadro ? [...r.quadro.jogadores] : null,
        mira: r?.quadro?.mira ?? null,
        limites: { x: Math.round(q.caixa.limites.x), y: Math.round(q.caixa.limites.y), largura: Math.round(q.caixa.limites.width), altura: Math.round(q.caixa.limites.height) },
      },
      jogadores: this.estado.jogadores.map((jog, j) => {
        const cor = q.coracoes[j]
        return { personagem: jog.personagem, hp: jog.hp, hpMax: jog.hpMax, energia: jog.energia, caido: jog.caido, ausente: Boolean(jog.ausente), saiu: Boolean(jog.saiu), mao: jog.baralho.mao.map((x) => x.id), coracao: { x: Math.round(cor.x), y: Math.round(cor.y), ativo: cor.ativo, espelho: Boolean(cor.espelho), mirado: cor.mirado } }
      }),
      acertosRodada: [...this.acertosRodada],
      prontos: [...this.prontos],
      estatisticas: this.resumo(),
    }
  }
}

