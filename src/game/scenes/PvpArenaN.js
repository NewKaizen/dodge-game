import Phaser from 'phaser'
import { LARGURA, ALTURA, CENTRO_X, FONTE, CORES, TEXTO, corTexto, TEMPOS, ACELERACAO, fatorAceleracao, nivelAceleracao, parteDoFator } from '../constants.js'
import Controles from '../controles.js'
import { tocar, musica, velocidadeMusica, tocarMusicaEspecial, voltarMusicaNormal } from '../audio.js'
import { debug } from '../debug.js'
import { PERSONAGENS } from '../data/personagens.js'
import Carta, { CORES_CARTA } from '../entities/Carta.js'
import Mao from '../entities/Mao.js'
import Pista from '../pvp/Pista.js'
import { CARTAS, TEMAS, ehSuper, superDoPersonagem } from '../pvp/cartas.js'
import { ataqueDaCartaNoJogo } from '../pvp/ataquesDasCartas.js'
import { podeJogar, registrarGrazes, registrarPerfeitoCombo, energiaPerfeito, ENERGIA } from '../pvp/regras.js'
import { FFA, criarPartidaFfa, resolverRodadaFfa, aplicarDanoFfa, danoAusente, classificacao, colocacoes, vivos } from '../pvp/ffa.js'
import { DUPLA, criarPartidaDupla, resolverRodadaDupla, podeJogarDupla, parceiroDe, membros, dePe, alvosDeApoio, classificacaoDupla } from '../pvp/dupla.js'
import { timesDoArranjo, ROTULO_TIME } from '../../lib/times2x2.js'
import { ARENA, ARENA_PADRAO } from '../pvp/arenas.js'
import { criarFundo } from '../backgrounds/index.js'
import { anunciarSuper } from '../pvp/super/anuncio.js'
import FimDePartida from '../pvp/fimDePartida/index.js'
import ArenaRedeN from '../pvp/rede/ArenaRedeN.js'
import HudCoopN from '../coop/HudCoopN.js'
import { marcadorDaVaga, nomeNoCoracao, desenharForma, formaDaVaga } from '../coop/marcadores.js'
import { canal, emRede, meuLado, meuIndice, souHostDaRede, irParaCena, participantesDaPartida } from '../rede.js'
import { corDaVaga, textoDaVaga } from '../vagas.js'
import { shake } from '../effects/shake.js'
import { flashTela, claraoCamera } from '../effects/flash.js'
import { numero } from '../effects/numero.js'
import { particulas } from '../effects/particulas.js'
import { fogoArtificio } from '../effects/festa.js'
import { entrarNoJogo, voltarAoMenu, levouGolpe, informarVida, venceu } from '../../lib/saida.js'
import { fatores } from '../acessibilidade.js'
import { pref } from '../preferencias.js'
import { quemEmFoco, estadoDoCartao, TEXTO_CARTAO, vistasDaGrade, vistasDoFoco, criarTransicao, avancarTransicao, parametrosSopro, posicaoDoCartao, FOCO, TRANSICAO } from '../pvp/focoFfa.js'

// TODOS CONTRA TODOS (1x1x1x1, 3 e 4 jogadores, ONLINE; Fase 5D). Regras em pvp/ffa.js e docs/pvp-regras.md
// "Todos contra todos"; rede em pvp/rede/ArenaRedeN.js e docs/rede-pvp.md. A PvpArena de 2 continua como era:
// esta é outra cena e só existe em rede (o host da partida decide toda regra; cada PC é dono do PRÓPRIO
// coração e desvia na própria caixa sem atraso).
//
// Tela (854x480): no alto os cartões de cada vaga (HudCoopN: forma + nome + HP + energia + estado). Embaixo
// uma GRADE 2x2 com UMA CAIXA POR JOGADOR (vaga 0 em cima à esquerda, 1 em cima à direita, 2 embaixo à
// esquerda, 3 embaixo à direita; com 3 jogadores a 4ª célula mostra o rodízio). Cada célula tem a cor, a
// forma e o nome do dono; ao lado da caixa, quem ataca ela e com o quê. Só a MINHA mão aparece.
//
// Uma rodada:
//   'inicio'     o host inicia (pvp/ffa.js iniciarRodadaFfa) e manda o estado COM O RODÍZIO
//   'escolha'    o painel do RODÍZIO no meio ("ANA → BETO", com forma e cor; o meu par em destaque) e a
//                minha mão. Os outros aparecem como ESCOLHENDO / PRONTO. Confirmar é definitivo
//   'revelacao'  as cartas de todos viram (o host resolveu: resolverRodadaFfa)
//   'super'      a animação de cada SUPER jogado
//   'arremesso'  as caixas dos vivos abrem na grade e a tela vai para o FOCO (pvp/focoFfa.js, ~700 ms com
//                ease; "reduzir animações": corte seco): a MINHA caixa grande no meio, a do meu ALVO menor
//                ao lado (cada uma com forma, nome e HP), os outros só como cartões pequenos no canto
//                (nome, HP, DESVIANDO / CAÍDO / SEM CONEXÃO / ELIMINADO), sem caixa desenhada. As cartas
//                que importam (a que vem para mim e a minha) voam para as duas caixas
//   'esquiva'    cada PC roda todas as caixas (a minha de verdade, as dos outros espelho): as de fora do
//                foco continuam rodando, só não são desenhadas (BattleBox.setOculta). No fim a tela
//                volta à grade e cada célula mostra o dano da rodada
//   'fim'        o host aplica o ataque inteiro em quem está sem conexão, elimina quem zerou e manda o estado
// ELIMINADO: o cartão fica "ELIMINADO 4º" e quem caiu vira ESPECTADOR ("ELIMINADO — assistindo"): ←/→
// escolhe qual caixa seguir (a borda dela pisca e o nome aparece; no foco, o par de quem ele segue). O último K.O. tem câmera lenta e o
// replay (pvp/fimDePartida/, o placar mostra quem venceu e quem caiu por último). Acaba com 1 vivo ou no
// limite de rodadas (FFA.limiteRodadas); a partir de FFA.morteSubita o dano sobe.
//
// 2x2 (Fase 5E, modo '2x2': regras em pvp/dupla.js, docs/pvp-regras.md "2x2"): a MESMA cena com 4 caixas e
// TIMES. O painel do anúncio mostra os DOIS DUELOS da rodada; cada célula tem a etiqueta e a borda da cor do
// time. Quem zera CAI (não sai): a caixa não abre, a mão desce e o foco vai para o duelo do parceiro, que
// resgata com uma rodada limpa ou um ♥ (o ♥ escolhe o alvo com ←/→: VOCÊ ou o PARCEIRO). No foco, o parceiro
// é um cartão pequeno ("PARCEIRO"). Acaba quando um time tem os dois caídos (os dois times juntos: empate).
//
//   irParaCena(this, 'PvpArenaN', { personagens: [p0..pN-1] (por vaga), arena, semente, modo?: '2x2', times?: [t0..t3] })
//   window.pvpArenaN (dev): estadoDebug, setHp(j, hp), setEnergia, forcarMao (valem em todos os PCs)

const TEMPO_ESCOLHA = 15000
const HP_BAIXO = 0.25
const PILULA_BLOQUEIO = '#b3162d'
const PISTA = { largura: 220, altura: 170 }
const TOPO_GRADE = 66
const CELULA = { largura: LARGURA / 2, altura: (ALTURA - TOPO_GRADE) / 2 }
const LADO = 92 // largura das colunas de texto ao lado da caixa
const celula = (k) => {
  const x0 = (k % 2) * CELULA.largura
  const y0 = TOPO_GRADE + Math.floor(k / 2) * CELULA.altura
  return { x0, y0, x: x0 + CELULA.largura / 2, y: y0 + CELULA.altura / 2 }
}
const campoDe = (k) => {
  const c = celula(k)
  return { esquerda: c.x0 + LADO + 4, direita: c.x0 + CELULA.largura - LADO - 4, topo: c.y0 + 4, base: c.y0 + CELULA.altura - 4 }
}
const MAO = { x: CENTRO_X - 20, y: 426, monte: { x: 62, y: 404 } }
const PASSAR = { x: CENTRO_X + 150, y: 428 }
const PREVIA = { x: 112, y: 214, escala: 1.4 }
const MAO_FORA = ALTURA + 80
const ESCALA_MESA = 1.05
const mesaDe = (k, n) => ({ x: (LARGURA * (k + 1)) / (n + 1), y: 196 })
const NOMES_ESPECIAIS = { espelho: 'ESPELHO!', anular: 'ANULAR!', roubo: 'ROUBO!', segundaChance: 'SEGUNDA CHANCE!' }

// A instância da cena é REAPROVEITADA pelo Phaser: o que a partida anterior deixou aqui volta ao inicial no
// começo do init(). Testado em src/game/__tests__/cenasReaproveitadas.test.js.
const estadoInicial = () => ({
  fundoArena: null,
  pistas: null,
  huds: null,
  mao: null,
  monte: null,
  botaoPassar: null,
  previa: null,
  banner: null,
  status: null,
  dica: null,
  textoRodada: null,
  textoRelogio: null,
  textoModo: null,
  celulas: null,
  avisoPista: null,
  infoPista: null,
  painelAlvos: null,
  legenda: null,
  etiquetasMesa: [],
  reveladas: [],
  rede: null,
  fimDaEscolha: null,
  fimDePartida: null,
  prontos: [],
  musicaEspecial: null,
  vigia: 0,
  seguindo: null,
  espectadorDesde: null,
  rodadaAtual: null,
  paradas: null,
  objetosGrade: [],
  fundoGrade: null,
  alphaGrade: 1,
  vistas: null,
  transicao: null,
  selecao: null,
  emFoco: false,
  rotulosFoco: null,
  cartoes: null,
  escolhaApoio: null,
  rotulosTime: [],
  comAtaque: null,
})

// as cores dos times do 2x2 (a etiqueta e a borda da célula; a forma e o nome continuam na cor da vaga)
const COR_TIME = [0x4ab0ff, 0xffa040]
const TEXTO_TIME = ['#7cc8ff', '#ffb870']

export default class PvpArenaN extends Phaser.Scene {
  constructor() {
    super('PvpArenaN')
  }

  init(dados) {
    Object.assign(this, estadoInicial())
    const lista = Array.isArray(dados?.personagens) ? dados.personagens.filter((id) => CARTAS[id]).slice(0, 4) : []
    this.idsDosDados = lista.length >= 2 ? lista : null
    this.arena = ARENA[dados?.arena] ?? ARENA[ARENA_PADRAO]
    this.semente = dados?.semente ?? `ffa:${Date.now()}`
    this.tempoBase = dados?.tempo ?? TEMPO_ESCOLHA
    this.modo = dados?.modo === '2x2' ? '2x2' : 'ffa'
    this.timesDados = Array.isArray(dados?.times) && dados.times.length === 4 ? dados.times : null
  }

  create() {
    // só existe em rede: sem a sala não tem com quem jogar
    if (!emRede() || !this.idsDosDados) return this.scene.start('Lan')
    this.comecouEm = Date.now()
    this.ids = this.idsDosDados
    this.n = this.ids.length
    this.meu = meuIndice()
    this.dupla = this.modo === '2x2' && this.n === DUPLA.jogadores
    this.estado = this.dupla ? criarPartidaDupla({ personagens: this.ids, times: this.timesDados ?? timesDoArranjo(0), semente: this.semente }) : criarPartidaFfa({ personagens: this.ids, semente: this.semente })
    this.nomes = Array.from({ length: this.n }, (_, j) => participantesDaPartida().find((p) => p.indice === j)?.nome ?? `P${j + 1}`)
    this.nomesJog = this.nomes.map((nome) => nomeNoCoracao(nome, 10))
    this.controles = new Controles(this)
    this.rede = new ArenaRedeN(this, { canal, meuIndice: this.meu, souHost: souHostDaRede(), participantes: participantesDaPartida, dev: Boolean(import.meta.env?.DEV) })
    this.rede.esconderBaralhos(this.estado) // o host embaralha com um sorteio só dele (pvp/sigilo.js)
    this.tempoEscolha = this.tempoBase
    this.fase = 'abertura'
    this.saindo = false
    this.escolhido = undefined
    this.noPassar = false
    this.relogio = 0
    this.ultimoSegundo = null
    this.tempoEsgotado = false
    this.encerrando = false
    this.invertido = 0
    this.aceleracao = 1
    this.nivelAceleracao = 0
    this.hpAvisado = Array(this.n).fill(false)
    this.ko = Array(this.n).fill(false)
    this.acertosRodada = Array(this.n).fill(0)
    this.superNaPista = Array(this.n).fill(false) // o golpe que cai em cada pista é de SUPER? (BUZZER)
    this.danoRodada = Array(this.n).fill(0)
    this.prontos = Array(this.n).fill(false)
    this.paradas = Array(this.n).fill(false)
    this.estatisticas = Array.from({ length: this.n }, () => ({ danoCausado: 0, danoRecebido: 0, cartasJogadas: 0, maiorCarta: null, grazes: 0, ases: 0, passes: 0, perfeitos: 0, maiorSequencia: 0, supers: 0 }))
    velocidadeMusica(1)
    // retomada: o host voltou a rodada (2D) ou eu caí e voltei (5A)
    this.retomada = this.rede.aplicarRetomada(this.sys.settings.data?.retomada)
    this.entrandoNaLuta = Boolean(this.sys.settings.data?.retomada?.entrando)

    this.desenharFundo()
    this.criarCelulas()
    this.criarPistas()
    this.huds = Array.from({ length: this.n }, (_, j) => new HudCoopN(this, { vaga: j, n: this.n, nome: this.nomes[j], personagem: this.ids[j], hpMax: this.estado.jogadores[j].hpMax, meu: j === this.meu }))
    this.criarTopo()
    this.criarMao()
    this.criarTextos()
    this.fimDePartida = new FimDePartida(this, { campos: Array.from({ length: this.n }, (_, k) => campoDe(k)) })
    this.vistas = vistasDaGrade(this.n)
    this.criarFoco()

    this.controles.onBotao((_, botao) => {
      if (this.saindo) return
      if (this.fimDePartida?.botao(botao)) return
      if (botao === 'A') this.apertarA()
      else if (botao === 'B') this.apertarB()
    })
    this.events.on('postupdate', this.filtrarCaixas, this)
    if (import.meta.env.DEV) window.pvpArenaN = this
    entrarNoJogo()
    this.events.once('shutdown', () => {
      this.saindo = true
      voltarAoMenu()
      this.events.off('postupdate', this.filtrarCaixas, this)
      this.rede?.destruir()
      this.pistas?.forEach((p) => p.destruir())
      this.voltarDaMusicaEspecial()
      velocidadeMusica(1)
      if (window.pvpArenaN === this) delete window.pvpArenaN
    })
    musica(this.arena.musica, 'pvp')
    this.cameras.main.fadeIn(300)
    this.atualizarHuds(false)
    this.partida()
  }

  // ---------- montagem ----------

  desenharFundo() {
    this.fundoArena = criarFundo(this, `arena-${this.arena.id}`)
    this.events.once('shutdown', () => this.fundoArena?.destruir())
    const g = this.add.graphics().setDepth(-4)
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.75, 0.75, 0.3, 0.3)
    g.fillRect(0, 0, LARGURA, TOPO_GRADE)
    g.fillStyle(0x000000, Math.max(0.35, this.arena.moldura?.alpha ?? 0.4))
    g.fillRect(0, TOPO_GRADE, LARGURA, ALTURA - TOPO_GRADE)
  }

  // A grade: cada célula com o brilho da cor da vaga, a forma, o nome e o personagem do dono
  criarCelulas() {
    const g = this.add.graphics().setDepth(-3)
    this.fundoGrade = g
    this.objetosGrade = []
    this.celulas = []
    for (let k = 0; k < 4; k++) {
      const c = celula(k)
      g.lineStyle(1, this.arena.moldura?.cor ?? 0x5a4a7a, 0.6)
      g.strokeRect(c.x0 + 2, c.y0 + 2, CELULA.largura - 4, CELULA.altura - 4)
      if (k >= this.n) {
        this.legenda = this.add.text(c.x, c.y, '', { fontFamily: FONTE, fontSize: '10px', color: TEXTO.normal, stroke: '#000000', strokeThickness: 3, align: 'center', lineSpacing: 4 }).setOrigin(0.5).setDepth(5)
        continue
      }
      const cor = corDaVaga(k)
      g.fillStyle(cor, 0.07)
      g.fillRect(c.x0 + 3, c.y0 + 3, CELULA.largura - 6, CELULA.altura - 6)
      const forma = this.add.graphics().setDepth(5)
      desenharForma(forma, formaDaVaga(k), c.x0 + 14, c.y0 + 20, 6, cor)
      const estilo = (tamanho, corT) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: corT, stroke: '#000000', strokeThickness: 3, wordWrap: { width: LADO - 6 } })
      const nome = this.add.text(c.x0 + 24, c.y0 + 13, nomeNoCoracao(this.nomes[k], 8), estilo(11, textoDaVaga(k))).setDepth(5)
      const voce = k === this.meu ? this.add.text(c.x0 + 8, c.y0 + 32, 'VOCÊ', estilo(9, '#ffffff')).setDepth(5) : null
      const personagem = this.add.text(c.x0 + 8, c.y0 + (voce ? 46 : 32), (PERSONAGENS[this.ids[k]]?.nome ?? this.ids[k]).toUpperCase(), estilo(9, corTexto(PERSONAGENS[this.ids[k]]?.cor ?? 0xffffff))).setDepth(5)
      const estado = this.add.text(c.x0 + 8, c.y0 + 64, '', estilo(9, TEXTO.normal)).setDepth(5)
      // à direita da caixa: quem ataca esta caixa e com o quê
      const ataque = this.add.text(c.x0 + CELULA.largura - LADO, c.y0 + 14, '', { ...estilo(9, TEXTO.normal), wordWrap: { width: LADO - 6 } }).setDepth(5)
      const destaque = this.add.rectangle(c.x, c.y, CELULA.largura - 6, CELULA.altura - 6).setStrokeStyle(3, 0xffe14a).setDepth(6).setVisible(false)
      // 2x2: a borda e a etiqueta do time (embaixo à esquerda da célula)
      if (this.dupla) {
        const t = this.estado.times[k]
        g.lineStyle(2, COR_TIME[t], 0.85)
        g.strokeRect(c.x0 + 4, c.y0 + 4, CELULA.largura - 8, CELULA.altura - 8)
        const parceiro = parceiroDe(this.estado, this.meu)
        const rot = this.add.text(c.x0 + 8, c.y0 + CELULA.altura - 14, `${ROTULO_TIME[t]}${k === parceiro ? ' · PARCEIRO' : ''}`, estilo(9, TEXTO_TIME[t])).setOrigin(0, 0.5).setDepth(5)
        this.rotulosTime.push(rot)
        this.objetosGrade.push(rot)
      }
      this.celulas.push({ ...c, forma, nome, voce, personagem, estado, ataque, destaque })
      this.objetosGrade.push(estado, ataque, ...(voce ? [voce] : []))
    }
    if (this.legenda) this.objetosGrade.push(this.legenda)
  }

  criarPistas() {
    this.avisoPista = []
    this.infoPista = []
    this.pistas = Array.from({ length: this.n }, (_, k) => {
      const c = celula(k)
      const pista = new Pista(this, {
        x: c.x,
        y: c.y,
        largura: PISTA.largura,
        altura: PISTA.altura,
        jogador: k,
        cor: corDaVaga(k),
        tema: TEMAS[this.ids[k]],
        velocidadeMax: 300,
        dinamica: { campo: campoDe(k) },
        marcadores: { [k]: marcadorDaVaga(k, this.nomes[k]) },
      })
      pista.aoAcertar = (dano) => this.acertou(k, dano)
      pista.aoGraze = () => this.grazeou(k)
      const estilo = (tamanho, cor) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 4, align: 'center' })
      this.avisoPista.push(this.add.text(c.x, c.y - 18, '', estilo(14, TEXTO.caido)).setOrigin(0.5).setDepth(41))
      this.infoPista.push(this.add.text(c.x, c.y + 18, '', estilo(10, TEXTO.desabilitado)).setOrigin(0.5).setDepth(40))
      return pista
    })
  }

  criarTopo() {
    const texto = (y, tamanho, cor) => this.add.text(CENTRO_X, y, '', { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(70)
    this.textoRodada = texto(5, 8, TEXTO.normal)
    this.textoRelogio = texto(18, 22, TEXTO.selecionado)
    this.textoModo = texto(46, 7, '#ff7a9a').setText(this.dupla ? '2x2 · EQUIPES' : `TODOS x TODOS · ${this.n}`)
  }

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
    this.banner = this.add.text(CENTRO_X, 200, '', estilo(26, TEXTO.selecionado)).setOrigin(0.5).setDepth(96)
    this.status = this.add.text(MAO.x, 372, '', estilo(11, textoDaVaga(this.meu))).setOrigin(0.5).setDepth(40)
    this.dica = this.add.text(CENTRO_X, 466, '', { ...estilo(9, TEXTO.desabilitado), strokeThickness: 2 }).setOrigin(0.5).setDepth(40)
    // o painel do rodízio (na escolha): fundo + uma linha por par
    const painel = this.add.container(CENTRO_X, 0).setDepth(30).setVisible(false)
    const fundo = this.add.graphics()
    const titulo = this.add.text(0, 92, '', estilo(13, '#ff7a9a')).setOrigin(0.5)
    const sub = this.add.text(0, 110, 'cada um ataca UM e recebe UM ataque', { ...estilo(9, TEXTO.desabilitado), strokeThickness: 2 }).setOrigin(0.5)
    const formas = this.add.graphics()
    const linhas = Array.from({ length: 4 }, (_, i) => this.add.text(0, 136 + i * 24, '', estilo(14, TEXTO.normal)).setOrigin(0.5))
    const meu = this.add.text(0, 136 + 4 * 24 + 6, '', estilo(11, TEXTO.selecionado)).setOrigin(0.5)
    painel.add([fundo, titulo, sub, formas, ...linhas, meu])
    this.painelAlvos = { painel, fundo, titulo, sub, formas, linhas, meu }
  }

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

  mostrarBanner(texto, cor = TEXTO.selecionado, { y = 200, tamanho = 26, ms = 0 } = {}) {
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
    const t = this.add.text(carta.x, carta.y, texto, { fontFamily: FONTE, fontSize: '16px', color: '#ff3048', stroke: '#2a0008', strokeThickness: 5 }).setOrigin(0.5).setRotation(-0.35).setDepth(carta.depth + 5).setScale(2.4).setAlpha(0)
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 160, ease: 'Quad.easeIn', onComplete: () => shake(this, 90, 0.006) })
    carta.carimbo = t
  }

  nomeDe(j) {
    return nomeNoCoracao(this.nomes[j] ?? `P${j + 1}`, 10)
  }

  // usados pelo replay do K.O. (pvp/fimDePartida/)
  rotulo(j) {
    return `P${j + 1}`
  }

  corDoLado(j) {
    return corDaVaga(j)
  }

  eliminado(j) {
    return Boolean(this.estado.jogadores[j]?.eliminado)
  }

  get euEliminado() {
    return this.eliminado(this.meu)
  }

  // fora da rodada: eliminado, ou CAÍDO no 2x2 (não joga, não é alvo; pode voltar)
  inativo(j) {
    const jog = this.estado.jogadores[j]
    return Boolean(jog?.eliminado || (this.dupla && jog?.caido))
  }

  get euFora() {
    return this.inativo(this.meu)
  }

  podeJogarAgora(j, jogada) {
    return this.dupla ? podeJogarDupla(this.estado, j, jogada) : podeJogar(this.estado, j, jogada)
  }

  parceiro(j = this.meu) {
    return this.dupla ? parceiroDe(this.estado, j) : -1
  }

  semAlvo(j) {
    return this.dupla && this.estado.semAlvo.includes(j)
  }

  // posição de cada um agora (para "ELIMINADO 4º")
  posicaoDe(j) {
    return colocacoes(this.estado)[j]
  }

  // ---------- placar ----------

  textoDoEstado(j) {
    const jog = this.estado.jogadores[j]
    const p = participantesDaPartida().find((x) => x.indice === j)
    if (this.dupla && jog.eliminado) return ['FORA (saiu)', TEXTO.caido]
    if (jog.eliminado) return [`ELIMINADO ${this.posicaoDe(j)}º${jog.eliminado.motivo === 'saiu' ? ' (saiu)' : ''}`, TEXTO.caido]
    if (!p) return ['SAIU', TEXTO.caido]
    if (p.caiu != null) return [`SEM CONEXÃO ${Math.max(0, Math.ceil(p.caiu / 1000))}s`, '#ff9a3a']
    if (this.dupla && jog.caido) return ['CAÍDO · resgate!', TEXTO.caido]
    if (this.fase === 'escolha') return this.prontos[j] ? ['já escolheu ✓', TEXTO.cura] : ['ESCOLHENDO', TEXTO.desabilitado]
    if (this.semAlvo(j)) return ['SEM ALVO: apoio', '#7fd8ff']
    const alvo = this.estado.alvos[j]
    return alvo != null ? [`→ ${this.nomeDe(alvo)}`, textoDaVaga(alvo)] : ['', TEXTO.desabilitado]
  }

  atualizarEstados() {
    this.estado.jogadores.forEach((jog, j) => {
      const [texto, cor] = this.textoDoEstado(j)
      this.huds[j].setEstado(texto, cor)
      this.huds[j].setApagado(Boolean(jog.eliminado) || this.rede.fora(j))
      const cel = this.celulas[j]
      if (!cel) return
      const atacante = this.estado.alvos.indexOf(j)
      const textoCel = this.dupla && jog.eliminado ? 'FORA\n(saiu)' : jog.eliminado ? `ELIMINADO\n${this.posicaoDe(j)}º LUGAR` : this.rede.fora(j) ? 'SEM CONEXÃO\n(leva o ataque\ninteiro)' : this.dupla && jog.caido ? 'CAÍDO\n(o parceiro\nresgata)' : this.semAlvo(j) ? 'SEM ALVO\n+1 energia\nsó ♥' : ''
      cel.estado.setText(textoCel).setColor(jog.eliminado || (this.dupla && jog.caido) ? TEXTO.caido : this.semAlvo(j) && !this.rede.fora(j) ? '#7fd8ff' : '#ff9a3a')
      if (this.fase !== 'esquiva' && this.fase !== 'arremesso') cel.ataque.setText(atacante >= 0 && !this.inativo(j) ? `${this.dupla ? 'duelo com' : 'atacado por'}\n${this.nomeDe(atacante)}` : '').setColor(atacante >= 0 ? textoDaVaga(atacante) : TEXTO.normal)
      const apagar = this.inativo(j) ? 0.4 : 1
      for (const o of [cel.nome, cel.personagem, cel.forma]) o.setAlpha(apagar * this.alphaGrade)
    })
  }

  // a grade (fundos, nomes, estados) some no foco
  aplicarAlphaGrade(a) {
    this.alphaGrade = a
    this.fundoGrade?.setAlpha(a)
    for (const o of this.objetosGrade) o.setAlpha(a)
    this.celulas?.forEach((cel, j) => {
      const apagar = this.inativo(j) ? 0.4 : 1
      for (const o of [cel.nome, cel.personagem, cel.forma]) o.setAlpha(apagar * a)
      cel.destaque.setVisible(a > 0.5 && j === this.seguindo)
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
      hud.setMao(jog.eliminado ? 0 : jog.baralho.mao.length)
      if (hud.sequencia !== (jog.sequencia ?? 0)) hud.setSequencia(jog.sequencia ?? 0, animado)
    })
    this.atualizarEstados()
  }

  // o painel do rodízio: um par por linha (forma + nome na cor da vaga), o meu em destaque
  mostrarAlvos() {
    if (this.dupla) return this.mostrarDuelos()
    const p = this.painelAlvos
    const pares = this.estado.alvos.map((alvo, j) => (alvo == null ? null : [j, alvo])).filter(Boolean)
    const altura = 70 + pares.length * 24 + 30
    p.fundo.clear().fillStyle(0x0b0914, 0.9).fillRoundedRect(-200, 80, 400, altura, 8).lineStyle(2, 0xff7a9a, 0.9).strokeRoundedRect(-200, 80, 400, altura, 8)
    p.titulo.setText(`RODÍZIO DA RODADA ${this.estado.rodada}`)
    p.formas.clear()
    p.linhas.forEach((l, i) => {
      const par = pares[i]
      if (!par) return l.setText('')
      const [a, b] = par
      l.setText(`${this.nomeDe(a)}   →   ${this.nomeDe(b)}`).setColor(a === this.meu || b === this.meu ? '#ffffff' : TEXTO.normal)
      l.setFontSize(a === this.meu ? 16 : 14)
      const y = l.y
      desenharForma(p.formas, formaDaVaga(a), -l.width / 2 - 14, y, 6, corDaVaga(a))
      desenharForma(p.formas, formaDaVaga(b), l.width / 2 + 14, y, 6, corDaVaga(b))
    })
    const meuAlvo = this.estado.alvos[this.meu]
    const quem = this.estado.alvos.indexOf(this.meu)
    p.meu.setY(136 + pares.length * 24 + 4)
    p.meu.setText(this.euEliminado ? 'você foi eliminado: assistindo' : meuAlvo != null ? `VOCÊ ATACA ${this.nomeDe(meuAlvo)} · ${this.nomeDe(quem)} ATACA VOCÊ` : '')
    p.painel.setVisible(true).setAlpha(0)
    this.tweens.add({ targets: p.painel, alpha: 1, duration: 200 })
    this.legenda?.setText(`RODÍZIO\n${pares.map(([a, b]) => `${this.nomeDe(a)} → ${this.nomeDe(b)}`).join('\n')}`)
    if (meuAlvo != null) this.etiquetaEm(CENTRO_X, 372, `SEU ALVO: ${this.nomeDe(meuAlvo)}`, textoDaVaga(meuAlvo), { tamanho: 13, ms: 1600 })
  }

  // 2x2: os dois duelos da rodada ("ANA × BETO", o meu em destaque) e quem está SEM ALVO / CAÍDO
  mostrarDuelos() {
    const p = this.painelAlvos
    const e = this.estado
    const pares = e.alvos.map((alvo, j) => (alvo != null && j < alvo ? [j, alvo] : null)).filter(Boolean)
    const extras = e.jogadores.map((jog, j) => (jog.eliminado ? [j, 'FORA'] : jog.caido ? [j, 'CAÍDO: o parceiro resgata'] : this.semAlvo(j) ? [j, 'SEM ALVO: +1 energia, só ♥'] : null)).filter(Boolean)
    const linhas = pares.length + extras.length
    const altura = 70 + linhas * 24 + 30
    p.fundo.clear().fillStyle(0x0b0914, 0.9).fillRoundedRect(-210, 80, 420, altura, 8).lineStyle(2, 0xffd23a, 0.9).strokeRoundedRect(-210, 80, 420, altura, 8)
    p.titulo.setText(`DUELOS DA RODADA ${e.rodada}`).setColor('#ffd23a')
    p.sub.setText('cada duelo é um 1x1 · o ♥ vai em você ou no parceiro')
    p.formas.clear()
    p.linhas.forEach((l, i) => {
      if (i < pares.length) {
        const [a, b] = pares[i]
        const meu = a === this.meu || b === this.meu
        l.setText(`${this.nomeDe(a)}   ×   ${this.nomeDe(b)}`).setColor(meu ? '#ffffff' : TEXTO.normal).setFontSize(meu ? 16 : 14)
        desenharForma(p.formas, formaDaVaga(a), -l.width / 2 - 14, l.y, 6, corDaVaga(a))
        desenharForma(p.formas, formaDaVaga(b), l.width / 2 + 14, l.y, 6, corDaVaga(b))
        return
      }
      const extra = extras[i - pares.length]
      if (!extra) return l.setText('')
      const [j, texto] = extra
      l.setText(`${this.nomeDe(j)}: ${texto}`).setColor(textoDaVaga(j)).setFontSize(11)
      desenharForma(p.formas, formaDaVaga(j), -l.width / 2 - 12, l.y, 5, corDaVaga(j))
    })
    const meuAlvo = e.alvos[this.meu]
    const parc = this.parceiro()
    const alvoParc = parc >= 0 ? e.alvos[parc] : null
    const partes = []
    if (meuAlvo != null) partes.push(`VOCÊ × ${this.nomeDe(meuAlvo)}`)
    else if (this.euFora) partes.push(e.jogadores[this.meu].caido ? 'VOCÊ CAIU: o parceiro pode te resgatar' : 'você saiu')
    else if (this.semAlvo(this.meu)) partes.push('VOCÊ: SEM ALVO (apoie o parceiro)')
    if (parc >= 0 && alvoParc != null) partes.push(`PARCEIRO ${this.nomeDe(parc)} × ${this.nomeDe(alvoParc)}`)
    p.meu.setY(136 + linhas * 24 + 4)
    p.meu.setText(partes.join(' · '))
    p.painel.setVisible(true).setAlpha(0)
    this.tweens.add({ targets: p.painel, alpha: 1, duration: 200 })
    if (meuAlvo != null) this.etiquetaEm(CENTRO_X, 372, `SEU DUELO: ${this.nomeDe(meuAlvo)}`, textoDaVaga(meuAlvo), { tamanho: 13, ms: 1600 })
  }

  esconderAlvos() {
    const p = this.painelAlvos.painel
    this.tweens.add({ targets: p, alpha: 0, duration: 160, onComplete: () => p.setVisible(false) })
  }

  // ---------- partida ----------

  extrasRetomada() {
    return { estatisticas: this.estatisticas, comecouEm: this.comecouEm }
  }

  async partida() {
    const vez = (this.vezPartida = (this.vezPartida ?? 0) + 1)
    const fora = () => this.saindo || this.vezPartida !== vez
    if (!this.retomada) await this.abertura()
    if (this.entrandoNaLuta) {
      this.mostrarBanner('VOCÊ VOLTOU!\nentra na próxima rodada', TEXTO.cura, { tamanho: 18, ms: 2400 })
      this.sincronizarMao()
      this.atualizarMonte()
    }
    while (!fora()) {
      await this.inicioDaRodada()
      if (fora()) return
      const jogadas = await this.escolha()
      if (fora()) return
      const decidida = await this.decidirRodada(jogadas)
      if (fora() || !decidida) return
      this.contarJogadas(decidida)
      // as jogadas já travaram: a carta dos outros aparece de verdade (pvp/sigilo.js)
      const r = this.rede.verResultado(decidida)
      this.rodadaAtual = r
      await this.revelacao(r)
      if (fora()) return
      await this.anunciarSupers(r)
      if (fora()) return
      await this.arremesso(r)
      if (fora()) return
      await this.esquiva(r)
      if (fora()) return
      const fim = await this.terminarRodada(r)
      if (fora()) return
      if (fim) return this.resultado()
    }
  }

  async abertura() {
    this.fase = 'abertura'
    const estilo = (tamanho, cor) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 5, align: 'center' })
    const titulo = this.add.text(CENTRO_X, 150, this.dupla ? '2x2 · EQUIPES' : 'TODOS CONTRA TODOS', estilo(30, this.dupla ? '#ffd23a' : '#ff7a9a')).setOrigin(0.5).setDepth(96).setScale(0)
    const nomes = this.nomes.map((nome, j) => this.add.text(mesaDe(j, this.n).x, 230, nomeNoCoracao(nome, 9), estilo(this.n === 4 ? 16 : 20, textoDaVaga(j))).setOrigin(0.5).setDepth(96).setAlpha(0))
    const pers = this.ids.map((id, j) => this.add.text(mesaDe(j, this.n).x, 256, (PERSONAGENS[id]?.nome ?? id).toUpperCase(), estilo(10, '#b8b8c8')).setOrigin(0.5).setDepth(96).setAlpha(0))
    const regra = this.add.text(CENTRO_X, 300, this.dupla ? 'derrube os DOIS adversários · o parceiro caído volta com uma rodada limpa ou um ♥' : 'o último de pé vence · o alvo de cada um é anunciado a cada rodada', estilo(10, TEXTO.normal)).setOrigin(0.5).setDepth(96).setAlpha(0)
    // 2x2: os times
    if (this.dupla) {
      const time = (t) => `${ROTULO_TIME[t]}: ${membros(this.estado, t).map((j) => nomeNoCoracao(this.nomes[j], 8)).join(' + ')}`
      pers.push(this.add.text(CENTRO_X - 20, 330, time(0), estilo(12, TEXTO_TIME[0])).setOrigin(1, 0.5).setDepth(96).setAlpha(0))
      pers.push(this.add.text(CENTRO_X, 330, '×', estilo(12, '#ffffff')).setOrigin(0.5).setDepth(96).setAlpha(0))
      pers.push(this.add.text(CENTRO_X + 20, 330, time(1), estilo(12, TEXTO_TIME[1])).setOrigin(0, 0.5).setDepth(96).setAlpha(0))
    }
    tocar(this, 'voo')
    await this.tween({ targets: titulo, scale: 1, duration: 300, ease: 'Back.easeOut' })
    tocar(this, 'impacto')
    shake(this, 160, 0.01)
    this.tweens.add({ targets: [...nomes, ...pers, regra], alpha: 1, duration: 260 })
    await this.esperar(1500)
    const todos = [titulo, ...nomes, ...pers, regra]
    await this.tween({ targets: todos, alpha: 0, duration: 260 })
    todos.forEach((t) => t.destroy())
  }

  async inicioDaRodada() {
    this.fase = 'inicio'
    this.rodadaAtual = null
    this.prontos = Array(this.n).fill(false)
    const eventos = await this.rede.iniciarRodada()
    if (!eventos) return
    this.entrandoNaLuta = false
    const acelerou = this.atualizarAceleracao()
    this.textoRodada.setText(`RODADA ${this.estado.rodada}${this.estado.rodada >= FFA.morteSubita ? ' · MORTE SÚBITA' : ''}`)
    this.mostrarBanner(`RODADA ${this.estado.rodada}`, TEXTO.normal, { y: 236, tamanho: 26, ms: 700 })
    tocar(this, 'rodada')
    this.time.delayedCall(260, () => tocar(this, 'energia'))
    for (const ev of eventos) {
      const c = this.celulas[ev.j]
      if (ev.tipo === 'voltou') this.etiquetaEm(c.x, c.y, `${this.nomeDe(ev.j)} VOLTOU!`, TEXTO.cura, { tamanho: 12, ms: 1500 })
      if (ev.tipo === 'saiu') this.etiquetaEm(c.x, c.y, `${this.nomeDe(ev.j)} SAIU: ELIMINADO`, TEXTO.caido, { tamanho: 12, ms: 1800 })
    }
    if (this.estado.rodada === FFA.morteSubita) this.etiquetaEm(CENTRO_X, 266, `MORTE SÚBITA: dano x${FFA.fatorMorteSubita} (a partida acaba na rodada ${FFA.limiteRodadas})`, '#ff9a3a', { tamanho: 11, ms: 2200 })
    this.atualizarHuds()
    this.mao.setAtiva(false)
    await this.sincronizarMao()
    this.atualizarMonte()
    if (acelerou && !this.saindo) {
      tocar(this, 'acelerar')
      this.mostrarBanner(`VELOCIDADE x${this.aceleracao.toFixed(2)}!`, '#ff9a3a', { y: 236, tamanho: 24, ms: 1100 })
      await this.esperar(1200)
    }
    if (!this.saindo) this.mostrarAlvos()
  }

  atualizarAceleracao() {
    const nivel = nivelAceleracao(this.estado.rodada)
    const fator = fatorAceleracao(this.estado.rodada)
    const subiu = nivel > this.nivelAceleracao
    this.nivelAceleracao = nivel
    this.aceleracao = fator
    this.pistas.forEach((p) => (p.fatorCoracao = parteDoFator(fator, ACELERACAO.coracao)))
    if (this.tempoBase) this.tempoEscolha = Math.max(Math.min(this.tempoBase, ACELERACAO.escolhaMinMs), Math.round(this.tempoBase / fator / 500) * 500)
    if (subiu) velocidadeMusica(parteDoFator(fator, ACELERACAO.musica))
    return subiu
  }

  // Só o host resolve (a jogada que não vale lá vira passar) e manda
  async decidirRodada() {
    if (!this.rede.souHost) return this.rede.receberResolucao()
    const jogadas = this.rede.validarJogadas(await this.rede.juntarJogadas(this.tempoEscolha), (j, id) => this.podeJogarAgora(j, id))
    if (this.saindo) return null
    const r = this.dupla ? resolverRodadaDupla(this.estado, jogadas) : resolverRodadaFfa(this.estado, jogadas)
    this.rede.enviarResolucao(jogadas, r)
    return r
  }

  // ---------- a minha mão ----------

  async sincronizarMao({ intervalo = 110 } = {}) {
    const jog = this.estado.jogadores[this.meu]
    const ids = new Set(jog.eliminado ? [] : jog.baralho.mao.map((c) => c.id))
    for (const carta of [...this.mao.cartas]) {
      if (ids.has(carta.dados.id)) continue
      this.mao.retirar(carta)
      carta.descartar?.()
    }
    if (jog.eliminado) return
    const presentes = new Set(this.mao.cartas.map((c) => c.dados.id))
    const novas = jog.baralho.mao.filter((c) => !presentes.has(c.id))
    const total = this.mao.cartas.length + novas.length
    await Promise.all(novas.map((dados, i) => this.mao.adicionar({ ...dados }, { atraso: i * intervalo, total })))
    this.mao.setEnergia(jog.energia)
  }

  atualizarMonte() {
    const n = this.euEliminado ? 0 : this.estado.jogadores[this.meu].baralho.monte.length
    this.monte.texto.setText(this.euEliminado ? '' : `${n}`)
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
    this.escolhaApoio = null
    this.botaoPassar.c.setVisible(!this.euFora)
    this.dica.setText(this.euFora ? (this.euEliminado ? '←/→: escolher quem assistir' : 'CAÍDO: o parceiro resgata com uma rodada limpa ou um ♥   (←/→: quem assistir)') : this.semAlvo(this.meu) ? 'SEM ALVO: jogue um ♥ (em você ou no parceiro) ou passe   A: confirmar' : '←/→ escolher   A: confirmar (não dá para desfazer)   →: PASSAR')
    this.rede.comecarEscolha()
    this.atualizarEstados()
    if (this.euFora) {
      this.escolhido = null
      this.noPassar = true
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
    this.mao.setAtiva(livre && !this.noPassar && !this.escolhaApoio)
    this.mao.setTravada(typeof this.escolhido === 'string')
    this.botaoPassar.setFoco(livre && this.noPassar)
    let texto = ''
    let bloqueado = false
    if (this.euEliminado) texto = this.dupla ? 'FORA — assistindo' : 'ELIMINADO — assistindo'
    else if (this.euFora) texto = 'CAÍDO — assistindo o parceiro'
    else if (escolhendo && this.escolhaApoio) texto = this.textoApoio()
    else if (escolhendo) {
      if (this.escolhido !== undefined) texto = 'PRONTO! esperando os outros...'
      else texto = 'escolha uma carta'
      const bloqueio = livre && !this.noPassar ? this.podeJogarAgora(this.meu, this.mao.selecionada?.dados.id).bloqueio : null
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
    return t.setText(texto).setColor(this.euFora ? TEXTO.caido : textoDaVaga(this.meu)).setBackgroundColor('').setPadding(0, 0, 0, 0)
  }

  atualizarPrevia() {
    const ativo = this.fase === 'escolha' && this.escolhido === undefined && !this.euFora
    const carta = ativo && !this.noPassar ? this.mao.selecionada : null
    const chave = !ativo ? null : this.noPassar ? 'passar' : carta?.dados.id ?? null
    if (this.previa?.chave === chave && (!carta || this.previa.indisponivel === carta.indisponivel)) return
    this.previa?.destroy()
    this.previa = null
    if (!chave) return
    let previa
    if (chave === 'passar') {
      previa = this.add.container(PREVIA.x, PREVIA.y).setDepth(60)
      const g = this.add.graphics()
      g.fillStyle(0x0b0914, 0.95).fillRoundedRect(-80, -50, 160, 100, 8)
      g.lineStyle(2, corDaVaga(this.meu), 1).strokeRoundedRect(-80, -50, 160, 100, 8)
      const t1 = this.add.text(0, -26, 'PASSAR A VEZ', { fontFamily: FONTE, fontSize: '14px', color: TEXTO.selecionado, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5)
      const t2 = this.add.text(0, 10, `Não joga carta nesta\nrodada e ganha +${ENERGIA.passar}\nde energia.`, { fontFamily: FONTE, fontSize: '10px', color: TEXTO.normal, align: 'center', lineSpacing: 3 }).setOrigin(0.5)
      previa.add([g, t1, t2])
    } else {
      previa = new Carta(this, PREVIA.x, PREVIA.y, carta.dados, { ampliada: PREVIA.escala, corFoco: corDaVaga(this.meu) }).setDepth(60)
      if (carta.indisponivel) previa.setIndisponivel(true)
      previa.indisponivel = carta.indisponivel
    }
    previa.chave = chave
    const escala = previa.scaleX
    previa.setScale(escala * 0.85).setAlpha(0.4)
    this.tweens.add({ targets: previa, scaleX: escala, scaleY: escala, alpha: 1, duration: 150, ease: 'Back.easeOut' })
    this.previa = previa
  }

  moverCursor(direcao) {
    if (this.euFora) return this.seguir(direcao === 'direita' ? 1 : -1)
    if (this.fase !== 'escolha' || this.escolhido !== undefined) return
    if (this.escolhaApoio) {
      // 2x2: ←/→ troca o alvo do ♥ (VOCÊ / PARCEIRO)
      const a = this.escolhaApoio
      a.indice = (a.indice + 1) % a.opcoes.length
      tocar(this, 'cartaSelecionar')
      return this.atualizarEscolha()
    }
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
    if (this.fase !== 'escolha' || this.escolhido !== undefined || this.euFora) return
    if (this.escolhaApoio) {
      const { id, opcoes, indice } = this.escolhaApoio
      this.escolhaApoio = null
      return this.escolher(id, { apoio: opcoes[indice] })
    }
    if (this.noPassar || !this.mao.cartas.length) return this.escolher(null)
    const carta = this.mao.selecionada
    if (!carta) return
    const v = this.podeJogarAgora(this.meu, carta.dados.id)
    if (!v.ok) {
      carta.negar()
      this.previa?.negar?.()
      this.mostrarStatus(v.bloqueio?.curto ?? v.motivo, true)
      this.time.delayedCall(900, () => this.atualizarEscolha())
      return
    }
    // 2x2: o ♥ pergunta em quem vai (o parceiro caído vem primeiro: é o resgate)
    const opcoes = this.dupla && carta.dados.naipe === 'copas' ? alvosDeApoio(this.estado, this.meu) : null
    if (opcoes?.length > 1) {
      const p = opcoes[1]
      this.escolhaApoio = { id: carta.dados.id, opcoes, indice: this.estado.jogadores[p].caido ? 1 : 0 }
      tocar(this, 'cartaSelecionar')
      this.mao.setAtiva(false)
      return this.atualizarEscolha()
    }
    this.escolher(carta.dados.id)
  }

  // o texto da escolha do alvo do ♥ (2x2)
  textoApoio() {
    const { opcoes, indice } = this.escolhaApoio
    const alvo = opcoes[indice]
    const nome = alvo === this.meu ? 'VOCÊ' : `PARCEIRO ${this.nomeDe(alvo)}${this.estado.jogadores[alvo].caido ? ' (LEVANTA!)' : ''}`
    return `♥ EM: ◀ ${nome} ▶   A confirma · B volta`
  }

  apertarB() {
    if (this.escolhaApoio && this.fase === 'escolha' && this.escolhido === undefined) {
      this.escolhaApoio = null
      tocar(this, 'cancelar')
      return this.atualizarEscolha()
    }
    if (this.fase !== 'escolha' || this.escolhido !== undefined || this.noPassar || this.euFora) return
    this.noPassar = true
    tocar(this, 'cartaSelecionar')
    this.atualizarEscolha()
  }

  // apoio (2x2): em quem vai o ♥ (a jogada vai como { carta, apoio })
  escolher(id, { automatico = false, apoio = null } = {}) {
    this.escolhido = id
    this.escolhaApoio = null
    this.rede.enviarJogada(id && apoio != null ? { carta: id, apoio } : id)
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
      if (s <= 5 && s > 0 && this.escolhido === undefined) tocar(this, 'contador')
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
      if (jog.fora) return
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
    if (this.eliminado(j) && jog.passou) return []
    if (jog.fora && this.dupla && !this.rede.fora(j) && !this.estado.jogadores[j].ausente) return [['CAÍDO', TEXTO.caido]]
    if (jog.fora) return [['SEM CONEXÃO', '#ff9a3a']]
    if (jog.passou) return [['PASSOU', TEXTO.desabilitado], ...(ef.energia ? [[`+${ef.energia} ENERGIA`, '#7fd8ff']] : [])]
    if (jog.anulada) return [['ANULADA!', TEXTO.caido]]
    const lista = []
    if (jog.super) lista.push(['★ SUPER! ★', corTexto(superDoPersonagem(jog.carta.personagem)?.cor ?? 0xffe9a0)])
    if (NOMES_ESPECIAIS[jog.especial]) lista.push([NOMES_ESPECIAIS[jog.especial], '#ffe9a0'])
    if (ef.apoiou != null) lista.push([`♥ EM ${this.nomeDe(ef.apoiou)}`, textoDaVaga(ef.apoiou)])
    if (r.levantados?.some((x) => x.por === j)) lista.push(['LEVANTOU O PARCEIRO!', TEXTO.cura])
    if (ef.cura) lista.push([`+${ef.cura} HP`, TEXTO.cura])
    if (ef.escudo) lista.push([`ESCUDO -${Math.round((1 - ef.escudo) * 100)}%`, TEXTO.guarda])
    if (ef.energia) lista.push([`+${ef.energia} ENERGIA`, '#7fd8ff'])
    if (ef.compradas.length) lista.push([`+${ef.compradas.length} CARTA${ef.compradas.length > 1 ? 'S' : ''}`, TEXTO.normal])
    if (ef.roubou) lista.push(['ROUBOU 1 CARTA', '#d0b8ff'])
    const alvo = r.alvos[j]
    if (alvo != null && r.caixas[alvo]?.de === j) lista.push([`→ ${this.nomeDe(alvo)}`, textoDaVaga(alvo)])
    if (r.superDupla?.includes(this.estado.times?.[j])) lista.push([`SUPER EM DUPLA +${Math.round((DUPLA.superDupla - 1) * 100)}%`, '#ffd23a'])
    return lista
  }

  criarFichaPassar(j, x, y) {
    const c = this.add.container(x, y).setDepth(80 + j)
    const g = this.add.graphics()
    g.fillStyle(0x1a1626, 0.95).fillRoundedRect(-22, -31, 44, 62, 6)
    g.lineStyle(2, corDaVaga(j), 1).strokeRoundedRect(-22, -31, 44, 62, 6)
    const t = this.add.text(0, -6, 'PASSOU', { fontFamily: FONTE, fontSize: '8px', color: TEXTO.normal, stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5)
    c.add([g, t])
    return c
  }

  async revelacao(r) {
    this.fase = 'revelacao'
    this.etiquetasMesa = []
    this.esconderAlvos()
    this.atualizarEscolha()
    this.mao.setAtiva(false)
    this.status.setText(this.euEliminado ? (this.dupla ? 'FORA — assistindo' : 'ELIMINADO — assistindo') : this.euFora ? 'CAÍDO — assistindo o parceiro' : '')
    if (!this.euFora) this.dica.setText('')
    this.atualizarEstados()
    this.reveladas = r.jogadas.map((jog, j) => {
      const hud = this.huds[j]
      const origem = { x: hud.x0 + 95, y: hud.y0 + 30 }
      if (this.eliminado(j) && jog.passou) return null
      if (jog.passou) {
        if (j === this.meu) {
          this.botaoPassar.setEscolhido(false)
          this.botaoPassar.setFoco(false)
        }
        return jog.fora ? null : this.criarFichaPassar(j, origem.x, origem.y)
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
    await Promise.all(this.reveladas.map((c, j) => c && this.tween({ targets: c, ...mesaDe(j, this.n), rotation: 0, scaleX: ESCALA_MESA, scaleY: ESCALA_MESA, duration: 320, ease: 'Cubic.easeOut' })))
    for (let j = 0; j < this.n; j++) {
      if (!this.reveladas[j]) continue
      const m = mesaDe(j, this.n)
      this.etiquetasMesa.push(this.etiquetaEm(m.x, m.y - 62, this.nomeDe(j), textoDaVaga(j), { tamanho: 10, ms: 2400 }))
    }
    this.mostrarBanner('REVELAR!', TEXTO.selecionado, { y: 110 })
    await this.esperar(240)
    await Promise.all(this.reveladas.map((c) => (c instanceof Carta ? c.revelar() : c ? this.tween({ targets: c, scale: ESCALA_MESA * 1.12, duration: 110, yoyo: true }) : null)))
    if (r.jogadas.some((j) => j.anulada)) tocar(this, 'carimbo')
    for (let j = 0; j < this.n; j++) {
      const carta = this.reveladas[j]
      const jog = r.jogadas[j]
      if (jog.anulada && carta) this.carimbar(carta, 'ANULADA')
      else if (jog.especial && carta) {
        tocar(this, jog.especial === 'espelho' ? 'espelho' : jog.especial === 'roubo' ? 'roubo' : 'brilhoRank')
        particulas(this, carta.x, carta.y, { cor: 0xfff0a8, quantidade: 22, velocidade: 160 })
      }
      const m = mesaDe(j, this.n)
      this.textosDoEfeito(r, j).forEach(([texto, cor], k) => this.etiquetasMesa.push(this.etiquetaEm(m.x, m.y + 62 + k * 14, texto, cor, { atraso: 120 + k * 150, tamanho: 10, ms: 1700 })))
      const ef = r.efeitos[j]
      const hud = this.huds[j]
      if (ef.cura) {
        tocar(this, 'cura')
        const quem = this.huds[ef.apoiou ?? j]
        numero(this, quem.pontoHp.x, quem.pontoHp.y, `+${ef.cura}`, TEXTO.cura, { tamanho: 13 })
      }
      hud.setEscudo(r.caixas[j]?.escudo ?? this.estado.jogadores[j].escudo)
      hud.setProtegido(this.estado.jogadores[j].protegido)
    }
    // 2x2: o ♥ levantou o parceiro caído; os dois SUPER do time
    for (const { j, por } of r.levantados ?? []) {
      const c = celula(j)
      this.etiquetaEm(c.x, c.y, `${this.nomeDe(j)} LEVANTOU!\n♥ de ${this.nomeDe(por)}`, TEXTO.cura, { tamanho: 13, ms: 1800 })
      tocar(this, 'cura')
      if (j === this.meu) this.mostrarBanner('RESGATADO!\nvocê volta na próxima rodada', TEXTO.cura, { y: 236, tamanho: 18, ms: 1800 })
    }
    for (const t of r.superDupla ?? []) this.etiquetaEm(CENTRO_X, 150, `SUPER EM DUPLA! ${ROTULO_TIME[t]} +${Math.round((DUPLA.superDupla - 1) * 100)}%`, TEXTO_TIME[t], { tamanho: 16, ms: 1600 })
    this.atualizarHuds()
    if (r.efeitos[this.meu].compradas.length || r.efeitos[this.meu].roubou || r.efeitos[this.meu].perdeu) {
      await this.esperar(400)
      await this.sincronizarMao({ intervalo: 140 })
      this.atualizarMonte()
    }
    await this.esperar(1350)
  }

  async anunciarSupers(r) {
    const lados = r.jogadas.map((j, k) => (j.super && !j.fora ? k : -1)).filter((k) => k >= 0)
    if (!lados.length) return
    this.fase = 'super'
    this.esconderBanner()
    for (const j of lados) {
      const carta = r.jogadas[j].carta
      await anunciarSuper(this, { jogador: j % 2, personagem: carta.personagem, carta })
      if (this.saindo) return
    }
    const personagem = r.jogadas[lados[lados.length - 1]].carta.personagem
    if (!(await tocarMusicaEspecial(`super_${personagem}`))) return
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
    // o foco desta rodada: só as cartas que vão para as duas caixas do foco voam; o resto sai da mesa
    const sel = this.calcularFoco(r)
    const doFoco = (k) => k === sel.foco || k === sel.alvo
    const voam = new Set(r.caixas.flatMap((c, k) => (c && doFoco(k) ? [c.de, c.dono] : [])))
    this.reveladas.forEach((c, j) => !voam.has(j) && this.tirarDaMesa(c))
    this.mao.setPosicao({ y: MAO_FORA })
    this.botaoPassar.descer(true)
    this.status.setText('')
    this.tweens.add({ targets: [...this.monte.cartas, this.monte.texto], alpha: 0, duration: 200 }) // (a célula de baixo à esquerda fica livre)
    // as que voam esperam na coluna do meio (entre as caixas) enquanto elas abrem
    tocar(this, 'caixaAbrir')
    const naColuna = [...voam].map((j, i) => this.reveladas[j] && this.tween({ targets: this.reveladas[j], x: CENTRO_X, y: 110 + i * 90, scaleX: 0.7, scaleY: 0.7, duration: 260, ease: 'Cubic.easeOut' }))
    const abrir = this.pistas.map((p, k) => (!this.eliminado(k) && !(this.dupla && this.estado.jogadores[k].caido) ? p.mostrar() : null))
    await Promise.all([...naColuna, ...abrir])
    if (this.saindo) return
    // as caixas abertas na grade: a tela vai para o par em foco (as cartas esperam no vão entre as duas)
    ;[...voam].forEach((j, i) => this.reveladas[j] && this.tweens.add({ targets: this.reveladas[j], x: 548, y: 300 + i * 84, duration: TRANSICAO.ms, ease: 'Cubic.easeInOut' }))
    await this.irParaFoco(sel)
    if (this.saindo) return
    this.pistas.forEach((p, k) => {
      if (this.inativo(k)) return
      const caixa = r.caixas[k]
      if (!caixa) this.infoPista[k].setText(this.rede.fora(k) ? '' : this.semAlvo(k) ? 'SEM ALVO nesta rodada' : 'caixa livre nesta rodada').setColor(TEXTO.desabilitado)
      if (this.rede.fora(k) || this.estado.jogadores[k].ausente) p.coracoes[0]?.esconder()
    })
    const voos = r.caixas.map(async (caixa, k) => {
      if (!caixa) return
      const carta = doFoco(k) ? this.reveladas[caixa.dono] ?? this.reveladas[caixa.de] : null
      if (!carta) return this.impactoNaCaixa(k, caixa)
      await this.esperar(caixa.de * 120)
      if (caixa.refletida && this.reveladas[caixa.de]) {
        // passou adiante: a carta toca no espelho de quem a passou e segue
        const espelho = this.reveladas[caixa.de]
        await carta.arremessar({ x: espelho.x, y: espelho.y }, { destruir: false, duracao: 280, giros: 1, arco: 30, escalaFinal: carta.scaleX * 0.9 })
        this.etiquetaEm(espelho.x + 60, espelho.y, 'PASSOU ADIANTE!', '#d8ccff', { tamanho: 11, ms: 700 })
        tocar(this, 'espelho')
        espelho.descartar?.()
      }
      await carta.arremessar(this.centroNaTela(k), { aoImpacto: () => this.impactoNaCaixa(k, caixa) })
    })
    await Promise.all(voos)
    this.reveladas = []
    await this.esperar(200)
  }

  impactoNaCaixa(k, caixa) {
    const borda = this.pistas[k].caixa.retangulo
    borda.setStrokeStyle(6, 0xffffff)
    this.time.delayedCall(120, () => borda.scene && borda.setStrokeStyle(4, corDaVaga(k)))
    const cel = this.celulas[k]
    cel.ataque.setText(`${this.nomeDe(caixa.de)}:\n${caixa.carta.nome}\n${caixa.dano} por\nacerto${caixa.refletida ? '\n(passada\nadiante)' : ''}`).setColor(textoDaVaga(caixa.de))
    if (caixa.escudo != null) {
      const c = this.centroNaTela(k)
      if (!this.pistas[k].caixa.oculta) this.etiquetaEm(c.x, c.y - (PISTA.altura / 2) * c.escala - 6, `ESCUDO! -${Math.round((1 - caixa.escudo) * 100)}%`, TEXTO.guarda, { tamanho: 11, ms: 1100 })
      tocar(this, 'escudo')
      this.huds[k].setEscudo(this.estado.jogadores[k].escudo)
    }
    if (this.estado.jogadores[k].ausente || this.rede.fora(k)) this.infoPista[k].setText(`SEM CONEXÃO\nleva ${danoAusente(caixa)} de dano`).setColor('#ff9a3a')
    this.atualizarFoco()
  }

  // ---------- esquiva ----------

  async esquiva(r) {
    this.fase = 'esquiva'
    this.ko = Array(this.n).fill(false)
    this.acertosRodada = Array(this.n).fill(0)
    this.danoRodada = Array(this.n).fill(0)
    this.paradas = Array(this.n).fill(false)
    this.superNaPista = r.caixas.map((c) => ehSuper(c?.carta)) // o golpe que cai em cada pista é de SUPER?
    const no = Array(this.n).fill(false)
    const comAtaque = Array(this.n).fill(false)
    const promessas = this.pistas.map((pista, k) => {
      const caixa = r.caixas[k]
      if (this.inativo(k) || !caixa || this.estado.jogadores[k].ausente || this.rede.fora(k)) return null
      const ataque = ataqueDaCartaNoJogo(caixa.carta)
      if (!ataque) return null
      comAtaque[k] = true
      no[k] = true
      pista.tema = TEMAS[caixa.carta.personagem] ?? pista.tema
      if (k === this.meu && caixa.inverterMs) this.invertido = { avisado: false }
      return pista.rodar(ataque, { dano: caixa.dano, ritmo: caixa.ritmo, semente: `${this.semente}:${this.estado.rodada}:${k}`, aceleracao: this.aceleracao })
    })
    this.comAtaque = comAtaque
    if (!promessas.some(Boolean)) return this.voltarParaGrade({ fechar: true })
    this.rede.comecarLuta()
    await this.rede.esperarFimEsquiva(promessas[this.meu] ?? Promise.resolve(), no)
    if (this.saindo) return
    // todos acabaram (ou caíram da rede): as caixas espelho que ainda rodam param aqui
    this.pistas.forEach((p) => p.parar())
    const perfeitos = this.registrarPerfeitos(r, comAtaque)
    this.invertido = 0
    await this.esperar(250)
    if (this.saindo) return
    // de volta à grade (o dano da rodada de todos) e as caixas fecham lá
    await this.voltarParaGrade({ fechar: true })
    if (this.saindo || !perfeitos.length) return
    this.festejarPerfeitos(perfeitos)
    await this.esperar(900)
  }

  registrarPerfeitos(r, comAtaque) {
    const lista = []
    for (let k = 0; k < this.n; k++) {
      const caixa = r.caixas[k]
      if (!comAtaque[k] || this.acertosRodada[k] || this.ko[k] || this.rede.fora(k) || !energiaPerfeito(caixa.carta)) continue
      const combo = registrarPerfeitoCombo(this.estado, k, caixa.carta)
      this.estatisticas[k].perfeitos++
      this.estatisticas[k].maiorSequencia = Math.max(this.estatisticas[k].maiorSequencia ?? 0, combo.sequencia)
      lista.push({ dono: k, ...combo })
    }
    return lista
  }

  festejarPerfeitos(perfeitos) {
    tocar(this, 'aplausos')
    for (const { dono, ganho, multiplicador = 1 } of perfeitos) {
      const c = celula(dono)
      this.etiquetaEm(c.x, c.y - 10, multiplicador > 1 ? `PERFEITO x${multiplicador}!` : 'PERFEITO!', '#ffe14a', { tamanho: 16 + 2 * (multiplicador - 1), ms: 1100 })
      if (ganho) this.etiquetaEm(c.x, c.y + 14, `+${ganho} ENERGIA`, '#7fd8ff', { atraso: 150, tamanho: 11, ms: 900 })
      for (let i = 0; i < 2 + multiplicador; i++) this.time.delayedCall(i * 120, () => !this.saindo && fogoArtificio(this, c.x - 60 + i * 40, c.y - 30, undefined, { quantidade: 22, profundidade: 97 }))
      const hud = this.huds[dono]
      hud.setEnergia(this.estado.jogadores[dono].energia)
      hud.setSequencia(this.estado.jogadores[dono].sequencia ?? 0)
    }
    if (perfeitos.some((p) => p.dono === this.meu)) this.mao.setEnergia(this.estado.jogadores[this.meu].energia)
  }

  // o MEU coração: aplica e manda (o dos outros chega pela rede: aplicarAcerto com doOutro)
  acertou(j, dano) {
    if (!this.rede.ehMeu(j)) return false
    const ok = this.aplicarAcerto(j, dano)
    if (ok) this.rede.enviarDano(j, dano)
    return ok
  }

  aplicarAcerto(j, dano, { doOutro = false } = {}) {
    if (this.fase !== 'esquiva' || this.ko[j] || this.eliminado(j) || debug.invencivel) return false
    this.acertosRodada[j]++
    const de = this.rodadaAtual?.caixas[j]?.de ?? null
    const sequenciaAntes = this.estado.jogadores[j].sequencia ?? 0
    const efetivo = aplicarDanoFfa(this.estado, j, dano, de)
    if (sequenciaAntes) this.huds[j].comboQuebrou()
    this.danoRodada[j] += efetivo
    this.estatisticas[j].danoRecebido += efetivo
    if (de != null && this.estatisticas[de]) this.estatisticas[de].danoCausado += efetivo
    const jog = this.estado.jogadores[j]
    const hud = this.huds[j]
    hud.setHp(jog.hp)
    hud.tremer()
    if (j === this.meu) levouGolpe(0, { super: Boolean(this.superNaPista?.[j]) })
    numero(this, hud.pontoHp.x, hud.pontoHp.y, efetivo ? `-${efetivo}` : '0', TEXTO.caido, { tamanho: 13, desvio: 12 })
    const pista = this.pistas[j]
    pista.caixa.tremer(110, 2)
    const coracao = pista.coracoes[0]
    if (doOutro && coracao?.ativo) {
      coracao.tomarDano(TEMPOS.invencivelMs)
      particulas(this, coracao.x, coracao.y, { cor: coracao.cor, quantidade: 10, velocidade: 110 })
    }
    const borda = pista.caixa.retangulo
    borda.setStrokeStyle(4, CORES.acerto)
    this.time.delayedCall(140, () => borda.scene && borda.setStrokeStyle(4, corDaVaga(j)))
    if (jog.protegido && jog.hp === 1 && dano > 0 && !pista.caixa.oculta) this.etiquetaEm(this.centroNaTela(j).x, this.centroNaTela(j).y - 60, 'SEGUNDA CHANCE: AGUENTA!', '#ffe9a0', { tamanho: 10, ms: 700 })
    this.atualizarFoco()
    if (jog.hp > 0 && jog.hp <= jog.hpMax * HP_BAIXO && !this.hpAvisado[j]) {
      this.hpAvisado[j] = true
      if (j === this.meu) this.time.delayedCall(120, () => tocar(this, 'hpBaixo'))
    }
    if (jog.hp <= 0) this.nocaute(j)
    return true
  }

  // HP zerou: o coração quebra e a caixa dele para. O ÚLTIMO K.O. (sobra um de pé) tem câmera lenta e replay
  nocaute(j) {
    this.ko[j] = true
    const dePe = vivos(this.estado).filter((k) => !this.ko[k] && this.estado.jogadores[k].hp > 0 && !this.inativo(k))
    // o último K.O. (câmera lenta + replay): no 2x2, quando o time de j não tem mais ninguém de pé
    const ultimo = this.dupla ? !dePe.some((k) => this.estado.times[k] === this.estado.times[j]) : dePe.length <= 1
    if (ultimo && this.fimDePartida?.nocaute(j, j)) return
    const pista = this.pistas[j]
    const coracao = pista.coracoes[0]
    tocar(this, 'quebrar')
    flashTela(this, corDaVaga(j), 0.22, 200)
    pista.caixa.tremer(260, 4)
    if (coracao?.ativo) particulas(this, coracao.x, coracao.y, { cor: corDaVaga(j), quantidade: 30, velocidade: 220, vida: 700 })
    coracao?.esconder()
    this.avisoPista[j].setText(`${this.dupla ? 'CAIU' : 'K.O.'}!\n${this.nomeDe(j)}`).setColor(TEXTO.caido)
    if (this.paradas[j]) return
    this.paradas[j] = true
    this.time.delayedCall(700, () => pista.parar())
  }

  grazeou(j) {
    if (!this.rede.ehMeu(j)) return
    if (this.aplicarGraze(j)) this.rede.enviarGraze(j)
  }

  aplicarGraze(j, { doOutro = false } = {}) {
    if (this.fase !== 'esquiva' || this.ko[j] || this.eliminado(j)) return false
    this.estatisticas[j].grazes++
    const ganho = registrarGrazes(this.estado, j, 1)
    if (ganho) {
      const hud = this.huds[j]
      hud.setEnergia(this.estado.jogadores[j].energia)
      numero(this, hud.pontoEnergia.x, hud.pontoEnergia.y, `+${ganho}`, '#7fd8ff', { tamanho: 11 })
      if (j === this.meu) tocar(this, 'tpMax')
    }
    if (doOutro) this.pistas[j].coracoes[0]?.ativo && this.pistas[j].coracoes[0].piscarGraze()
    return true
  }

  // não voltou em 20 s (o host elimina na hora: ArenaRedeN)
  aoSaiu(j) {
    const c = this.centroNaTela(j)
    this.etiquetaEm(c.x, c.y, `${this.nomeDe(j)} SAIU: ELIMINADO`, TEXTO.caido, { tamanho: 12, ms: 1800 })
    this.pistas[j]?.parar()
    this.atualizarEstados()
  }

  // ---------- fim da rodada ----------

  async terminarRodada(r) {
    this.fase = 'fim'
    this.voltarDaMusicaEspecial()
    // host: quem estava sem conexão (e não terminou a caixa) leva o ataque inteiro
    const fins = this.rede.fins.get(this.estado.rodada) ?? {}
    const ausentes = this.rede.souHost
      ? vivos(this.estado)
          .filter((j) => r.caixas[j] && (this.estado.jogadores[j].ausente || this.rede.fora(j)) && !(j in fins))
          .map((j) => ({ j, caixa: r.caixas[j], jaLevou: this.danoRodada[j] }))
      : []
    // 2x2: a RODADA LIMPA de cada um (tinha ataque e não levou acerto) resgata o parceiro caído
    const limpas = this.dupla ? Array.from({ length: this.n }, (_, k) => Boolean(this.comAtaque?.[k]) && !this.acertosRodada[k] && !this.ko[k] && !this.rede.fora(k)) : []
    const fim = await this.rede.fimDaRodada(ausentes, { limpas })
    if (this.saindo || !fim) return null
    for (const { j, dano } of fim.ausentes) {
      const c = celula(j)
      this.etiquetaEm(c.x, c.y, `SEM CONEXÃO: -${dano}`, '#ff9a3a', { tamanho: 13, ms: 1400 })
      numero(this, this.huds[j].pontoHp.x, this.huds[j].pontoHp.y, `-${dano}`, TEXTO.caido, { tamanho: 13 })
    }
    this.huds.forEach((hud, j) => {
      hud.setProtegido(false)
      hud.setEscudo(this.estado.jogadores[j].escudo)
    })
    this.atualizarHuds()
    for (const j of fim.eliminados) {
      const c = celula(j)
      this.etiquetaEm(c.x, c.y, `ELIMINADO!\n${this.posicaoDe(j)}º LUGAR`, TEXTO.caido, { tamanho: 16, ms: 1700 })
      tocar(this, 'quebrar')
    }
    if (fim.eliminados.includes(this.meu) && !fim.fim) this.virarEspectador()
    if (this.dupla) this.mostrarQuedas(fim)
    if (fim.fim) return fim
    if (fim.eliminados.length || fim.caidos?.length || fim.resgatados?.length) await this.esperar(1100)
    this.estado.jogadores.forEach((jog, j) => jog.hp > jog.hpMax * HP_BAIXO && (this.hpAvisado[j] = false))
    tocar(this, 'cartaDeslizar')
    if (!this.euFora) {
      this.mao.setPosicao({ y: MAO.y })
      this.botaoPassar.descer(false)
      this.tweens.add({ targets: [...this.monte.cartas, this.monte.texto], alpha: 1, duration: 200 })
    }
    await this.esperar(300)
    return null
  }

  // 2x2: quem caiu nesta rodada e quem voltou pela rodada limpa do parceiro
  mostrarQuedas(fim) {
    for (const { j, por } of fim.resgatados ?? []) {
      const c = celula(j)
      this.etiquetaEm(c.x, c.y - 8, `RODADA LIMPA!\n${this.nomeDe(j)} VOLTA`, TEXTO.cura, { tamanho: 14, ms: 1900 })
      this.etiquetaEm(celula(por).x, celula(por).y + 20, 'RESGATOU O PARCEIRO!', TEXTO.cura, { atraso: 200, tamanho: 11, ms: 1600 })
      tocar(this, 'cura')
      particulas(this, c.x, c.y, { cor: corDaVaga(j), quantidade: 24, velocidade: 140 })
      if (j === this.meu) {
        this.mostrarBanner('RESGATADO!\nvocê volta na próxima rodada', TEXTO.cura, { y: 236, tamanho: 18, ms: 1900 })
        this.seguindo = null
      }
    }
    for (const j of fim.caidos ?? []) {
      const c = celula(j)
      this.etiquetaEm(c.x, c.y, `${this.nomeDe(j)} CAIU!${fim.fim ? '' : '\no parceiro pode resgatar'}`, TEXTO.caido, { tamanho: 14, ms: 1800 })
      tocar(this, 'quebrar')
    }
    if (!fim.fim && fim.caidos?.includes(this.meu)) {
      this.mostrarBanner('VOCÊ CAIU\nseu parceiro pode te resgatar', TEXTO.caido, { y: 236, tamanho: 18, ms: 2200 })
      this.mao.setPosicao({ y: MAO_FORA })
      this.seguindo = this.parceiro()
      this.dica.setText(`CAÍDO — assistindo ${this.nomeDe(this.seguindo)}`)
    }
  }

  // ---------- foco (pvp/focoFfa.js) ----------

  // o par em foco desta rodada: eu (vivo) ou quem eu sigo (espectador)
  calcularFoco(r) {
    if (this.dupla) {
      // 2x2: caído ou SEM ALVO, o foco vai para o duelo do parceiro (←/→ troca); o parceiro vem primeiro nos cartões
      const parc = this.parceiro()
      const fora = this.estado.jogadores.map((_, k) => this.inativo(k) || r.alvos[k] == null)
      if (fora[this.meu] && (this.seguindo == null || fora[this.seguindo])) this.seguindo = !fora[parc] ? parc : this.estado.jogadores.findIndex((_, k) => !fora[k])
      const sel = quemEmFoco({ alvos: r.alvos, eu: this.meu, eliminados: fora, seguindo: this.seguindo })
      sel.outros.sort((a, b) => Number(b === parc) - Number(a === parc) || Number(b === this.meu) - Number(a === this.meu))
      return sel
    }
    return quemEmFoco({ alvos: r.alvos, eu: this.meu, eliminados: this.estado.jogadores.map((j) => Boolean(j.eliminado)), seguindo: this.seguindo })
  }

  get reduzirAnimacoes() {
    return Boolean(pref('reduzirMovimento'))
  }

  // onde o centro da caixa k aparece agora (e com que escala)
  centroNaTela(k) {
    const v = this.pistas[k]?.caixa.vista ?? { ...celula(k), escala: 1 }
    return { x: v.x, y: v.y, escala: v.escala }
  }

  // particulas()/efeitos no MUNDO de uma caixa durante a esquiva vão para onde a caixa aparece (null: não aparece)
  pontoNaTela(x, y) {
    if (!this.emFoco || this.fase !== 'esquiva' || !this.pistas) return undefined
    for (let k = 0; k < this.n; k++) {
      const c = campoDe(k)
      if (x < c.esquerda - 60 || x > c.direita + 60 || y < c.topo - 60 || y > c.base + 60) continue
      const caixa = this.pistas[k].caixa
      if (caixa.oculta) return null
      return { ...caixa.naTela(x, y), escala: caixa.vista.escala }
    }
    return undefined
  }

  aplicarVistas(vistas) {
    this.vistas = vistas
    vistas.forEach((v, k) => {
      const caixa = this.pistas[k]?.caixa
      if (!caixa) return
      caixa.setVista(v.x, v.y, v.escala)
      caixa.setOculta(!v.visivel)
      const e = Math.max(0.75, Math.min(1.25, v.escala))
      this.avisoPista[k].setPosition(v.x, v.y - 18 * v.escala).setScale(e).setVisible(v.visivel)
      this.infoPista[k].setPosition(v.x, v.y + 18 * v.escala).setScale(e).setVisible(v.visivel)
    })
  }

  // a transição anda pelo relógio de verdade (não pela câmera lenta nem pelo acelerar do debug)
  avancarVista(dt) {
    const t = this.transicao
    if (!t) return
    const { vistas, k, fim } = avancarTransicao(t, dt)
    this.aplicarVistas(vistas)
    const a = t.paraFoco ? 1 - k : k
    this.aplicarAlphaGrade(a)
    this.rotulosFoco?.forEach((r) => r.c.setAlpha(1 - a))
    this.cartoes?.forEach((c) => c.c.setAlpha(1 - a))
    if (!fim) return
    this.transicao = null
    t.resolver?.()
  }

  transicionar(para, { paraFoco, ms = TRANSICAO.ms, som = paraFoco ? 'entrar' : 'sair' } = {}) {
    const reduzir = this.reduzirAnimacoes
    this.transicao?.resolver?.()
    const t = criarTransicao(this.vistas ?? vistasDaGrade(this.n), para, { ms, reduzir })
    t.paraFoco = paraFoco
    this.transicao = t
    tocar(this, 'sopro', parametrosSopro(som, { reduzir }))
    return new Promise((resolver) => {
      t.resolver = resolver
      if (t.corte) this.avancarVista(0)
    })
  }

  async irParaFoco(sel, { ms } = {}) {
    this.selecao = sel
    this.emFoco = true
    this.montarFoco(sel)
    this.legenda?.setVisible(false)
    await this.transicionar(vistasDoFoco(sel, this.n), { paraFoco: true, ms })
  }

  // volta à grade: as caixas de fora do foco crescem de volta do cartão; no fim cada célula mostra o dano
  // da rodada (recebido e causado) e as caixas fecham
  async voltarParaGrade({ fechar = false } = {}) {
    if (this.emFoco) {
      this.emFoco = false
      await this.transicionar(vistasDaGrade(this.n), { paraFoco: false })
      this.rotulosFoco.forEach((r) => r.c.setVisible(false))
      this.cartoes.forEach((c) => c.c.setVisible(false))
      this.legenda?.setVisible(true)
      if (this.saindo) return
      this.mostrarDanoDaRodada()
    }
    if (!fechar) return
    tocar(this, 'caixaFechar')
    await Promise.all(this.pistas.map((p) => p.esconder()))
    this.avisoPista.forEach((t) => t.setText(''))
    this.infoPista.forEach((t) => t.setText(''))
  }

  // na grade, depois do foco: o dano que cada um levou e causou nesta rodada
  mostrarDanoDaRodada() {
    const r = this.rodadaAtual
    if (!r) return
    const causado = Array(this.n).fill(0)
    r.caixas.forEach((caixa, k) => caixa && (causado[caixa.de] += this.danoRodada[k] ?? 0))
    for (let k = 0; k < this.n; k++) {
      if (this.eliminado(k)) continue
      const c = celula(k)
      const levou = this.danoRodada[k] ?? 0
      this.etiquetaEm(c.x, c.y - 8, levou ? `-${levou} HP` : r.caixas[k] ? 'SEM DANO' : '', levou ? TEXTO.caido : TEXTO.cura, { tamanho: levou ? 16 : 12, ms: 1500 })
      if (causado[k]) this.etiquetaEm(c.x, c.y + 14, `causou ${causado[k]}`, textoDaVaga(k), { atraso: 120, tamanho: 10, ms: 1400 })
    }
  }

  // os rótulos das duas caixas do foco e os cartões dos de fora (criados uma vez, atualizados a cada rodada)
  criarFoco() {
    const estilo = (tamanho, cor) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 3 })
    this.rotulosFoco = ['foco', 'alvo'].map((papel) => {
      const c = this.add.container(0, 0).setDepth(42).setVisible(false)
      const forma = this.add.graphics()
      const nome = this.add.text(14, 0, '', estilo(papel === 'foco' ? 13 : 10, '#ffffff')).setOrigin(0, 0.5)
      const hp = this.add.text(0, 0, '', estilo(papel === 'foco' ? 11 : 9, TEXTO.normal)).setOrigin(1, 0.5)
      const barra = this.add.graphics()
      const linha = this.add.text(0, papel === 'foco' ? 16 : 13, '', estilo(papel === 'foco' ? 9 : 8, TEXTO.desabilitado)).setOrigin(0, 0.5)
      c.add([forma, nome, hp, barra, linha])
      return { papel, c, forma, nome, hp, barra, linha, vaga: null }
    })
    const { largura, altura } = FOCO.cartoes
    this.cartoes = Array.from({ length: 3 }, (_, i) => {
      const p = posicaoDoCartao(i)
      const c = this.add.container(p.x, p.y).setDepth(42).setVisible(false)
      const fundo = this.add.graphics()
      const forma = this.add.graphics()
      const nome = this.add.text(22, 11, '', estilo(10, '#ffffff')).setOrigin(0, 0.5)
      const status = this.add.text(largura - 8, 11, '', estilo(8, TEXTO.normal)).setOrigin(1, 0.5)
      const barra = this.add.graphics()
      const hp = this.add.text(largura - 8, 31, '', estilo(8, TEXTO.normal)).setOrigin(1, 0.5)
      c.add([fundo, forma, nome, status, barra, hp])
      return { c, fundo, forma, nome, status, barra, hp, vaga: null, largura, altura }
    })
  }

  montarFoco(sel) {
    const [rf, ra] = this.rotulosFoco
    rf.vaga = sel.foco
    ra.vaga = sel.alvo
    const posicao = (r, v) => {
      const largura = 220 * v.escala
      r.c.setPosition(v.x - largura / 2, v.y - (170 * v.escala) / 2 - (r.papel === 'foco' ? 40 : 34))
      r.largura = largura
    }
    posicao(rf, FOCO.foco)
    posicao(ra, FOCO.alvo)
    for (const r of this.rotulosFoco) {
      r.c.setVisible(r.vaga != null).setAlpha(0)
      if (r.vaga == null) continue
      r.forma.clear()
      desenharForma(r.forma, formaDaVaga(r.vaga), 5, 0, r.papel === 'foco' ? 6 : 5, corDaVaga(r.vaga))
      r.nome.setColor(textoDaVaga(r.vaga))
      r.hp.setX(r.largura)
    }
    this.cartoes.forEach((c, i) => {
      c.vaga = sel.outros[i] ?? null
      c.c.setVisible(c.vaga != null).setAlpha(0)
      if (c.vaga == null) return
      const cor = corDaVaga(c.vaga)
      c.fundo.clear().fillStyle(0x0b0914, 0.88).fillRoundedRect(0, 0, c.largura, c.altura, 6).lineStyle(2, cor, 0.9).strokeRoundedRect(0, 0, c.largura, c.altura, 6)
      c.forma.clear()
      desenharForma(c.forma, formaDaVaga(c.vaga), 12, 11, 5, cor)
      const papel = !this.dupla ? '' : c.vaga === this.meu ? 'VOCÊ · ' : c.vaga === this.parceiro() ? 'PARCEIRO · ' : ''
      c.nome.setText(`${papel}${this.nomeDe(c.vaga)}`).setColor(textoDaVaga(c.vaga))
      if (this.dupla) c.fundo.lineStyle(2, COR_TIME[this.estado.times[c.vaga]], 0.9).strokeRoundedRect(0, 0, c.largura, c.altura, 6)
    })
    this.atualizarFoco()
  }

  // HP, estado e o que cada caixa do foco recebe; o estado de cada cartão
  atualizarFoco() {
    if (!this.rotulosFoco || !this.selecao) return
    const r = this.rodadaAtual
    const sel = this.selecao
    const barra = (g, x, y, w, h, jog, cor) => {
      const f = Math.max(0, jog.hp) / jog.hpMax
      g.clear().fillStyle(0x000000, 0.7).fillRect(x, y, w, h).fillStyle(f <= HP_BAIXO ? 0xff4060 : cor, 1).fillRect(x, y, Math.round(w * f), h)
    }
    for (const rot of this.rotulosFoco) {
      const k = rot.vaga
      if (k == null) continue
      const jog = this.estado.jogadores[k]
      const eu = k === this.meu
      const titulo = rot.papel === 'foco' ? (eu ? `VOCÊ · ${this.nomeDe(k)}` : `${this.dupla && k === this.parceiro() ? 'PARCEIRO' : 'ASSISTINDO'} ${this.nomeDe(k)}`) : `${this.nomeDe(k)}`
      rot.nome.setText(titulo)
      rot.hp.setText(`HP ${Math.max(0, jog.hp)}/${jog.hpMax}`)
      barra(rot.barra, 0, 7, rot.largura, 3, jog, corDaVaga(k))
      const caixa = r?.caixas[k]
      const de = caixa ? this.nomeDe(caixa.de) : null
      const carta = caixa ? caixa.carta.nome : ''
      let linha = ''
      if (rot.papel === 'foco') linha = caixa ? `${eu ? 'desvie' : 'desvia'} de ${de}: ${carta} · ${caixa.dano}/acerto` : 'nenhum ataque vem para cá'
      else linha = caixa ? `${caixa.de === this.meu ? 'o seu ataque' : `ataque de ${de}`}: ${carta}` : 'sem ataque nesta rodada'
      rot.linha.setText(linha)
    }
    for (const c of this.cartoes) {
      const k = c.vaga
      if (k == null) continue
      const jog = this.estado.jogadores[k]
      const estado = estadoDoCartao({ eliminado: Boolean(jog.eliminado), fora: this.rede.fora(k) || jog.ausente, caido: this.ko[k] || jog.hp <= 0 || Boolean(this.dupla && jog.caido), comAtaque: this.fase === 'esquiva' && Boolean(this.pistas[k].rodando) })
      const cor = { eliminado: TEXTO.caido, semConexao: '#ff9a3a', caido: TEXTO.caido, desviando: TEXTO.cura, livre: TEXTO.desabilitado }[estado]
      c.status.setText(estado === 'eliminado' ? (this.dupla ? 'FORA' : `ELIMINADO ${this.posicaoDe(k)}º`) : estado === 'livre' && this.semAlvo(k) ? 'SEM ALVO' : TEXTO_CARTAO[estado]).setColor(cor)
      barra(c.barra, 22, 27, c.largura - 96, 6, jog, corDaVaga(k))
      c.hp.setText(`${Math.max(0, jog.hp)}/${jog.hpMax}`)
      c.c.setAlpha(this.transicao ? c.c.alpha : 1)
    }
  }

  // ---------- espectador ----------

  virarEspectador() {
    this.espectadorDesde = { rodada: this.estado.rodada, ms: Date.now() }
    this.mao.limpar?.()
    this.monte.cartas.forEach((c) => c.setVisible(false))
    this.monte.texto.setText('')
    this.mostrarBanner('ELIMINADO — assistindo', TEXTO.caido, { y: 236, tamanho: 22, ms: 2200 })
    this.seguir(1)
  }

  // ←/→ do espectador: qual caixa seguir (a borda da célula pisca e o nome aparece)
  seguir(passo) {
    const lista = this.dupla ? vivos(this.estado).filter((k) => dePe(this.estado, k) && k !== this.meu) : vivos(this.estado)
    if (!lista.length) return
    const i = this.seguindo == null ? -1 : lista.indexOf(this.seguindo)
    this.seguindo = lista[(i + passo + lista.length) % lista.length]
    this.celulas.forEach((c, k) => c.destaque.setVisible(k === this.seguindo && this.alphaGrade > 0.5))
    // no foco: o par de quem eu sigo (uma transição curta, ou o corte)
    if (this.emFoco && this.rodadaAtual) this.irParaFoco(this.calcularFoco(this.rodadaAtual), { ms: TRANSICAO.msSeguir })
    this.dica.setText(`${this.dupla ? (this.euEliminado ? 'FORA' : 'CAÍDO') : 'ELIMINADO'} — assistindo ${this.nomeDe(this.seguindo)}   (←/→: outro jogador)`)
    tocar(this, 'mover')
  }

  // ---------- resultado ----------

  // o placar do replay: quem venceu (esquerda) e quem caiu por último (direita)
  ladosDoReplay() {
    if (this.dupla) {
      const ordem = classificacaoDupla(this.estado)
      return [ordem[0], ordem[2]]
    }
    const ordem = classificacao(this.estado)
    return [ordem[0], ordem[1]]
  }

  // só grava o replay quando o próximo K.O. pode acabar a partida (economiza o desenho com 4 caixas)
  gravarPista(pista) {
    const k = this.pistas.indexOf(pista)
    if (this.dupla) return k >= 0 && !this.inativo(k) && [0, 1].some((t) => membros(this.estado, t).filter((j) => dePe(this.estado, j)).length <= 1)
    return vivos(this.estado).length <= 3 && k >= 0 && !this.eliminado(k)
  }

  async resultado() {
    this.fase = 'resultado'
    await this.fimDePartida?.replay()
    if (this.saindo) return
    if (this.dupla) return this.resultadoDupla()
    const ordem = classificacao(this.estado)
    const v = ordem[0]
    const motivo = this.estado.fim === 'limite' ? `LIMITE DE ${FFA.limiteRodadas} RODADAS` : ''
    this.mostrarBanner(`${this.nomeDe(v)} VENCEU!${motivo ? `\n${motivo}` : ''}`, textoDaVaga(v), { y: 236, tamanho: 30 })
    tocar(this, 'vitoria')
    if (v === this.meu) venceu(0) // BUZZER do meu joystick
    shake(this, 300, 0.012)
    claraoCamera(this.cameras.main, 250, 255, 255, 255)
    await this.esperar(1800)
    if (this.saindo) return
    if (!(await this.rede.prontoParaResultado())) return
    if (this.saindo) return
    this.saindo = true
    this.cameras.main.fadeOut(400, 0, 0, 0)
    await this.esperar(420)
    const pos = colocacoes(this.estado)
    const dados = {
      personagens: [...this.ids],
      arena: this.arena.id,
      classificacao: ordem,
      rodadas: this.estado.rodada,
      fim: this.estado.fim,
      duracao: Math.round((Date.now() - this.comecouEm) / 1000),
      jogadores: this.estado.jogadores.map((jog, j) => ({
        nome: this.nomes[j],
        posicao: pos[j],
        hp: Math.max(0, jog.hp),
        hpMax: jog.hpMax,
        eliminado: jog.eliminado,
        // quantas rodadas assistiu depois de cair (o tempo de espectador)
        espectador: jog.eliminado ? Math.max(0, this.estado.rodada - jog.eliminado.rodada) : 0,
        ...this.estatisticas[j],
        danoCausado: jog.danoCausado,
        danoRecebido: jog.danoRecebido,
      })),
    }
    console.info('[ffa] fim', { rodadas: dados.rodadas, fim: dados.fim, duracao: dados.duracao, espectador: dados.jogadores.map((x) => x.espectador) })
    irParaCena(this, 'PvpResultadoN', dados)
  }

  // 2x2: o time vencedor (ou o empate) e a tela de resultado com os times
  async resultadoDupla() {
    const e = this.estado
    const t = e.vencedorTime
    const motivo = e.fim === 'limite' ? `\nLIMITE DE ${FFA.limiteRodadas} RODADAS` : ''
    const nomes = t == null ? '' : `\n${membros(e, t).map((j) => this.nomeDe(j)).join(' + ')}`
    this.mostrarBanner(t == null ? `EMPATE!${motivo}` : `${ROTULO_TIME[t]} VENCEU!${nomes}${motivo}`, t == null ? TEXTO.selecionado : TEXTO_TIME[t], { y: 236, tamanho: 28 })
    tocar(this, 'vitoria')
    if (t != null && e.times[this.meu] === t) venceu(0) // BUZZER do meu joystick
    shake(this, 300, 0.012)
    claraoCamera(this.cameras.main, 250, 255, 255, 255)
    await this.esperar(1800)
    if (this.saindo) return
    if (!(await this.rede.prontoParaResultado())) return
    if (this.saindo) return
    this.saindo = true
    this.cameras.main.fadeOut(400, 0, 0, 0)
    await this.esperar(420)
    const ordem = classificacaoDupla(e)
    const dados = {
      modo: '2x2',
      times: [...e.times],
      vencedorTime: t,
      personagens: [...this.ids],
      arena: this.arena.id,
      classificacao: ordem,
      rodadas: e.rodada,
      fim: e.fim,
      duracao: Math.round((Date.now() - this.comecouEm) / 1000),
      jogadores: e.jogadores.map((jog, j) => ({
        nome: this.nomes[j],
        time: e.times[j],
        posicao: t == null ? 1 : e.times[j] === t ? 1 : 2,
        hp: Math.max(0, jog.hp),
        hpMax: jog.hpMax,
        caido: jog.caido,
        eliminado: jog.eliminado,
        ...this.estatisticas[j],
        danoCausado: jog.danoCausado,
        danoRecebido: jog.danoRecebido,
      })),
    }
    console.info('[2x2] fim', { rodadas: dados.rodadas, fim: dados.fim, vencedorTime: t, duracao: dados.duracao })
    irParaCena(this, 'PvpResultadoN', dados)
  }

  // ---------- frame ----------

  update(_, deltaReal) {
    const lento = this.fimDePartida?.fator ?? 1
    const delta = deltaReal * debug.acelerar * lento
    const animacao = debug.acelerar * parteDoFator(this.aceleracao, ACELERACAO.animacao) * lento
    this.tweens.timeScale = animacao
    this.time.timeScale = animacao
    this.controles.atualizar()
    this.fundoArena?.atualizar(delta)
    const jog = this.estado.jogadores[this.meu]
    if (jog) informarVida(0, jog.hp, jog.hpMax)
    const direcao = this.controles.toque(meuLado())
    if ((direcao === 'esquerda' || direcao === 'direita') && (this.fase === 'escolha' || this.euFora)) this.moverCursor(direcao)
    if (this.fase === 'escolha') this.atualizarRelogio(delta)
    this.atualizarPistas(delta)
    this.rede.atualizar(delta)
    this.avancarVista(deltaReal)
    if (this.seguindo != null) {
      const c = this.celulas[this.seguindo]
      c?.destaque.setAlpha(fatores().piscar ? 0.5 + 0.5 * Math.abs(Math.sin(this.time.now / 260)) : 1)
    }
    this.vigia += deltaReal
    if (this.vigia > 250) {
      this.vigia = 0
      this.vigiarPresenca()
    }
  }

  // as caixas andam: o MEU coração pelo joystick daqui (♦ Q/K inverte); os outros vêm da rede
  atualizarPistas(delta) {
    const inv = this.invertido
    this.pistas.forEach((pista, k) => {
      let joy = { x: 0, y: 0 }
      if (k === this.meu) {
        joy = this.controles.joy(meuLado())
        const invertendo = Boolean(inv) && pista.atacando && !this.ko[k]
        if (invertendo) {
          if (!inv.avisado) {
            inv.avisado = true
            tocar(this, 'inverter')
          }
          joy = { x: -joy.x, y: -joy.y }
          this.avisoPista[k].setText(fatores().pulso > 1 || Math.floor(this.time.now / 180) % 2 ? 'CONTROLES INVERTIDOS!' : '').setColor('#ff9a3a').setFontSize(11)
        } else if (inv?.avisado) {
          this.invertido = 0
          if (!this.ko[k]) this.avisoPista[k].setText('').setFontSize(14)
        }
      }
      pista.atualizar(delta, joy)
    })
  }

  // quem cai da rede no meio da esquiva some da caixa dele (o host aplica o ataque inteiro no fim)
  vigiarPresenca() {
    if (this.emFoco) this.atualizarFoco()
    if (this.fase === 'esquiva') {
      this.pistas.forEach((p, k) => {
        if (k === this.meu || !p.coracoes[0]?.ativo || !this.rede.fora(k)) return
        p.coracoes[0].esconder()
        this.infoPista[k].setText('CAIU DA REDE\nleva o ataque inteiro').setColor('#ff9a3a')
      })
    }
    this.atualizarEstados()
  }

  // ---------- testes (dev): valem em todos os PCs ----------

  forcarMao(j, ids) {
    this.rede?.espalhar('forcarMao', [j, ids])
    const b = this.estado.jogadores[j].baralho
    const todas = [...b.mao, ...b.monte, ...b.descarte]
    const novas = ids.map((id) => todas.find((c) => c.id === id)).filter(Boolean)
    for (const c of novas) for (const lista of [b.mao, b.monte, b.descarte]) lista.includes(c) && lista.splice(lista.indexOf(c), 1)
    b.mao = [...novas, ...b.mao].slice(0, 5)
    this.estado.jogadores[j].energia = 10
    if (j === this.meu) this.sincronizarMao()
    this.atualizarHuds(false)
    return b.mao.map((c) => c.id)
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
    if (j === this.meu) this.mao.setEnergia(this.estado.jogadores[j].energia)
  }

  estadoDebug() {
    return {
      fase: this.fase,
      rodada: this.estado.rodada,
      n: this.n,
      meu: this.meu,
      souHost: this.rede.souHost,
      alvos: [...this.estado.alvos],
      modo: this.estado.modo,
      times: this.estado.times ?? null,
      semAlvo: this.estado.semAlvo ?? null,
      vencedorTime: this.estado.vencedorTime ?? null,
      fim: this.estado.fim,
      vencedor: this.estado.vencedor,
      prontos: [...this.prontos],
      seguindo: this.seguindo,
      foco: this.emFoco ? { ...this.selecao } : null,
      transicao: this.transicao ? { t: Math.round(this.transicao.t), ms: this.transicao.ms, corte: this.transicao.corte } : null,
      vistas: this.pistas.map((p) => ({ ...p.caixa.vista, oculta: p.caixa.oculta })),
      classificacao: classificacao(this.estado),
      escolhido: this.escolhido === undefined ? 'escolhendo' : this.escolhido,
      pistas: this.pistas.map((p) => ({ aberta: p.aberta, espelho: p.espelho, rodando: p.ataque?.nome ?? null, coracao: { x: Math.round(p.coracoes[0].x), y: Math.round(p.coracoes[0].y), ativo: p.coracoes[0].ativo } })),
      jogadores: this.estado.jogadores.map((jog) => ({ personagem: jog.personagem, hp: jog.hp, hpMax: jog.hpMax, energia: jog.energia, eliminado: jog.eliminado, caido: jog.caido ?? null, ausente: jog.ausente, danoCausado: jog.danoCausado, mao: jog.baralho.mao.map((c) => c.id) })),
    }
  }
}
