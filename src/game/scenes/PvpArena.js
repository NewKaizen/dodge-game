import Phaser from 'phaser'
import { LARGURA, ALTURA, FONTE, CORES, TEXTO, corTexto, ACELERACAO, fatorAceleracao, nivelAceleracao, parteDoFator } from '../constants.js'
import Controles from '../controles.js'
import { tocar, musica, pausarMusica, retomarMusica, velocidadeMusica, tocarMusicaEspecial, voltarMusicaNormal } from '../audio.js'
import { debug } from '../debug.js'
import { PERSONAGENS } from '../data/personagens.js'
import Carta, { CORES_CARTA, TIPOS } from '../entities/Carta.js'
import Mao from '../entities/Mao.js'
import Pista from '../pvp/Pista.js'
import HudPvp, { IndicadorVelocidade } from '../pvp/HudPvp.js'
import { CARTAS, TEMAS, ehSuper, superDoPersonagem } from '../pvp/cartas.js'
import { ataqueDaCartaNoJogo } from '../pvp/ataquesDasCartas.js'
import { criarPartida, iniciarRodada, podeJogar, resolverRodada, aplicarDano, registrarGrazes, registrarPerfeitoCombo, energiaPerfeito, fimDaRodada, ENERGIA, COMBO_PERFEITO } from '../pvp/regras.js'
import { escolherJogada, NIVEIS_BOT, NIVEL_BOT_PADRAO } from '../pvp/bot.js'
import { EsquivaBot } from '../pvp/botEsquiva.js'
import { criarRng, aleatorio, inteiro } from '../pvp/baralho.js'
import { EVENTOS, EVENTO, ehRodadaBonus, adiarBonus, sortearEvento, transformarMalucas, desfazerMalucas, podeJogarDuelo, resolverDuelo } from '../pvp/bonus.js'
import { EFEITOS } from '../pvp/bonus/eventos/index.js'
import { anunciarBonus } from '../pvp/bonus/anuncio.js'
import Duelo from '../pvp/bonus/Duelo.js'
import { shake } from '../effects/shake.js'
import { flashTela } from '../effects/flash.js'
import { numero } from '../effects/numero.js'
import { particulas } from '../effects/particulas.js'
import { fogoArtificio, canhoesConfete, chuvaConfete } from '../effects/festa.js'
import { anunciarSuper } from '../pvp/super/anuncio.js'

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
//   'super'      só se alguém jogou a carta SUPER (★, custa 10): a animação do
//                personagem (pvp/super/anuncio.js; os dois SUPERs, um depois do
//                outro) e a música especial (super_<personagem>.mid) no lugar da
//                de batalha até o fim da rodada (terminarRodada volta a normal
//                de onde parou). O SUPER é imparável: Anular e Espelho não pegam
////   'arremesso'  as mãos descem, as caixas abrem e cada carta de ataque voa
//                até a caixa de quem vai desviar dela (o espelho rebate)
//   'esquiva'    as duas Pistas rodam ao mesmo tempo; acertos tiram HP do dono
//                da pista (aplicarDano), grazes viram energia (registrarGrazes)
//                DESVIO PERFEITO: quem passou por um ataque de verdade sem
//                levar nenhum acerto ganha energia pela carta (registrarPerfeitoCombo:
//                2-8 +1, 9-Q +2, K/SUPER +3, Ás que ataca +1), com aplausos,
//                "PERFEITO!" e fogos quando as caixas fecham
//                COMBO DE PERFEITOS (jog.sequencia em pvp/regras.js): perfeitos
//                em rodadas seguidas multiplicam essa energia (x1, x2, x3, x4 =
//                COMBO_PERFEITO.teto) e a festa cresce junto ("PERFEITO x2!",
//                "x3!!": texto maior e mais brilhante, aplausos sobrepostos,
//                mais fogos, confete, tremida). Todo acerto zera o combo
//                ("COMBO QUEBROU" pequeno no HUD); rodada sem caixa não conta
//                nem quebra. O combo atual fica no HUD ("PERFEITO x3")
//   'duelo'      só no bonus round de duelo, no lugar de 'arremesso' e 'esquiva'
//   'fim'        fimDaRodada: vencedor? -> 'resultado' (PvpResultado); senão volta ao 'inicio'
//
// Morte súbita (ACELERACAO em constants.js): a cada 5 rodadas (começo da 5ª,
// 10ª...) tudo acelera: balas (velocidade, densidade e teto), o coração (metade
// do bônus), o relógio da escolha (mais curto), as animações de carta e a
// música. Aviso grande ao subir e o selo "VELOCIDADE xN" no alto.
//
// Bonus round (pvp/bonus.js, a cada 3 rodadas: 3ª, 6ª...): no começo da
// rodada o selo "BONUS ROUND: ???" avisa; DEPOIS da escolha das cartas uma
// roleta (pvp/bonus/anuncio.js, música abaixada + som de cassino) sorteia um
// evento caótico. Só caos, sem prêmio. Se alguém jogou o SUPER não tem roleta:
// o bonus fica para a próxima rodada (adiarBonus). Conforme evento.cartas:
//   'normal'   rodada de sempre; o efeito (pvp/bonus/eventos/) bagunça a
//              esquiva, que acontece mesmo se ninguém atacar (caixa "vazia")
//   'malucas'  na revelação cada carta vira outra sorteada (transformarMalucas)
//   'duelo'    a carta escolhida (sem gastar energia) vira a arma do duelo:
//              arremesso + esquiva dão lugar a 'duelo' (pvp/bonus/Duelo.js)
//   CORAÇÃO TROCADO liga coracoesTrocados: cada coração desvia na pista do
//   outro (donoDaPista/pistaDe), ou seja, do ataque que o próprio dono jogou
// Testes: scene.start('PvpArena', { bonus: 'festa' }) força esse evento em
// toda rodada bônus; pvpArena.forcarBonus('duelo') faz a PRÓXIMA rodada ser bônus.
//
// ♦ Q/K (caixa.inverterMs > 0): os controles do dono da caixa ficam invertidos
// do fim do respiro inicial até o ataque daquela caixa acabar (o ataque todo).
//
// Com 1 jogador no painel, o P2 é a CPU (pvp/bot.js escolhe a carta,
// pvp/botEsquiva.js desvia). Nível: registry 'pvpNivelBot' (tela PvpEscolha, ↑/↓).
//
// Música: public/assets/musicas/pvp.mid.
//
// No dev: debugJogo.jogo.scene.start('PvpArena', { p1: 'susie', p2: 'noelle' })
// e window.pvpArena (estadoDebug, forcarMao, setHp) para os testes.

const TEMPO = { escolha: 15000 }

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

// posições da mesa, para a CoopArena (CO-OP de cartas) usar as mesmas
export const LAYOUT_PVP = { PISTA, CENTROS, MAOS, MAO_ESCONDIDA, PASSAR, PREVIAS, ESCALA_MESA, HP_BAIXO }

const outro = (j) => 1 - j
// bonus round: o "ataque" da caixa que não recebeu carta (só o evento bagunça ela)
const ATAQUE_VAZIO = { nome: 'bonus', duracao: 5000, caixa: null, iniciar() {} }
const VENCEDOR = { p1: 1, p2: 2, empate: 0 }

export default class PvpArena extends Phaser.Scene {
  // a CoopArena (CO-OP de cartas) estende esta cena com outra chave
  constructor(chave = 'PvpArena') {
    super(chave)
  }

  init(dados) {
    const salvo = this.registry.get('pvp') ?? {}
    const valido = (id) => (CARTAS[id] ? id : null)
    this.ids = [valido(dados?.p1) ?? valido(salvo.p1) ?? 'kris', valido(dados?.p2) ?? valido(salvo.p2) ?? 'susie']
    this.semente = dados?.semente ?? `pvp:${Date.now()}`
    this.tempoBase = dados?.tempo ?? TEMPO.escolha
    this.bonusForcado = EVENTO[dados?.bonus] ? dados.bonus : null
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
    this.aceleracao = 1 // fator da morte súbita (fatorAceleracao da rodada)
    this.nivelAceleracao = 0
    this.rngBonus = criarRng(`${this.semente}:bonus`)
    this.bonus = null // evento do bonus round atual (EVENTOS de pvp/bonus.js) ou null
    this.bonusAnterior = null
    this.bonusProximo = null // forcarBonus(): a próxima rodada é bônus com este evento
    this.efeitoBonus = null // efeito do evento rodando na esquiva (pvp/bonus/eventos/)
    this.bonusPendente = null // rodada bônus com o evento ainda por sortear (depois da escolha)
    this.coracoesTrocados = false // CORAÇÃO TROCADO: o coração de cada um está na pista do outro
    this.duelo = null
    this.musicaEspecial = null // personagem cuja música SUPER está tocando (até o fim da rodada)
    this.acertosRodada = [0, 0] // acertos que cada jogador levou na esquiva (desvio perfeito)
    this.perfeitosRodada = [null, null] // energia ganha por desvio perfeito nesta rodada (null = não fez)
    this.combosRodada = [null, null] // multiplicador do combo de perfeitos nesta rodada (null = não fez)
    velocidadeMusica(1) // começa no andamento normal (revanche/recomeçar também)
    this.estatisticas = [0, 1].map(() => ({ danoCausado: 0, danoRecebido: 0, cartasJogadas: 0, maiorCarta: null, grazes: 0, ases: 0, passes: 0, perfeitos: 0, maiorSequencia: 0, supers: 0 }))

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
      if (this.fase === 'duelo') return botao === 'A' && this.duelo?.atacar(this.ladoDoControle(j))
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
      this.encerrarEfeitoBonus()
      this.duelo?.parar()
      this.duelo = null
      this.pistas.forEach((p) => p.destruir())
      this.voltarDaMusicaEspecial()
      velocidadeMusica(1) // a próxima tela não herda a música acelerada
      if (window.pvpArena === this) delete window.pvpArena
    })

    musica('pvp')
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
      // quem leva o dano/graze é o dono do coração que está nesta pista
      pista.aoAcertar = (dano) => this.acertou(this.donoDaPista(j), dano)
      pista.aoGraze = () => this.grazeou(this.donoDaPista(j))
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
    // morte súbita: logo abaixo do "VS CPU" (escondido enquanto for x1)
    // bonus round: nome do evento enquanto a rodada dura
    // (com a CPU o selo de velocidade ocupa a linha de baixo do "VS CPU": o do bônus desce)
    this.textoBonus = texto(this.cpu !== null ? 81 : 70, 11, TEXTO.selecionado).setOrigin(0.5)
    this.indicadorVelocidade = new IndicadorVelocidade(this, LARGURA / 2, this.cpu !== null ? 61 : 50, { tamanho: 10 })
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

  // CORAÇÃO TROCADO: donoDaPista(j) = de quem é o coração que desvia na pista j;
  // pistaDe(p) = em que pista está o coração do jogador p (a troca é simétrica)
  donoDaPista(j) {
    return this.coracoesTrocados ? outro(j) : j
  }

  pistaDe(p) {
    return this.donoDaPista(p)
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
      let jogadas = await this.escolha()
      if (this.saindo) return
      // bonus round: o evento só é revelado agora, com as cartas já escolhidas
      await this.sortearBonus(jogadas)
      if (this.saindo) return
      if (this.bonus?.cartas === 'duelo') {
        const duelo = resolverDuelo(this.estado, jogadas[0], jogadas[1], this.rngBonus)
        this.contarJogadas(duelo)
        await this.revelacaoDuelo(duelo)
        if (this.saindo) return
        await this.rodarDuelo(duelo)
      } else {
        // cartas malucas: cada carta vira outra antes de resolver (o baralho volta ao normal logo depois)
        let trocas = null
        if (this.bonus?.cartas === 'malucas') ({ jogadas, trocas } = transformarMalucas(this.estado, jogadas, this.rngBonus))
        const resultado = resolverRodada(this.estado, jogadas[0], jogadas[1])
        if (trocas) {
          desfazerMalucas(this.estado, trocas)
          resultado.trocas = trocas
        }
        this.contarJogadas(resultado)
        await this.revelacao(resultado)
        if (this.saindo) return
        await this.anunciarSupers(resultado)
        if (this.saindo) return
        await this.arremesso(resultado)
        if (this.saindo) return
        await this.esquiva(resultado)
      }
      if (this.saindo) return
      const vencedor = await this.terminarRodada()
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
    const acelerou = this.atualizarAceleracao()
    this.textoRodada.setText(`RODADA ${this.estado.rodada}`)
    this.tweens.add({ targets: this.textoRodada, scale: { from: 1.5, to: 1 }, duration: 260, ease: 'Back.easeOut' })
    this.mostrarBanner(`RODADA ${this.estado.rodada}`, TEXTO.normal, { y: 200, tamanho: 28, ms: 700 })
    tocar(this, 'rodada')
    this.time.delayedCall(260, () => tocar(this, 'energia'))
    this.atualizarHuds()
    this.maos.forEach((m) => m.setAtiva(false))
    await this.sincronizarMaos()
    this.atualizarMontes()
    if (acelerou && !this.saindo) await this.avisarAceleracao()
    if (!this.saindo) this.prepararBonus()
  }

  // ---------- bonus round ----------

  // Começo da rodada: é bônus (a cada 3, ou a forçada por forcarBonus)? Só
  // avisa no alto ("BONUS ROUND: ???"); o evento é sorteado depois da escolha
  prepararBonus() {
    const forcado = this.bonusProximo
    this.bonusProximo = null
    this.bonusPendente = null
    if (!forcado && !ehRodadaBonus(this.estado.rodada)) return
    this.bonusPendente = forcado || true
    this.textoBonus.setText('★ BONUS ROUND: ??? ★').setColor(TEXTO.selecionado).setAlpha(1)
    this.tweens.add({ targets: this.textoBonus, scale: { from: 1.6, to: 1 }, duration: 260, ease: 'Back.easeOut' })
  }

  // Depois da escolha das cartas: roleta e o nome do evento no selo do alto.
  // Com SUPER na mesa não tem roleta: o bonus passa para a próxima rodada
  async sortearBonus(jogadas) {
    const forcado = this.bonusPendente
    this.bonusPendente = null
    if (!forcado) return
    if (adiarBonus(this.estado, jogadas)) {
      this.bonusProximo = forcado
      this.tweens.add({ targets: this.textoBonus, alpha: 0, duration: 300 })
      return
    }
    this.fase = 'bonus'
    const evento = EVENTO[forcado] ?? EVENTO[this.bonusForcado] ?? sortearEvento(this.rngBonus, { anterior: this.bonusAnterior })
    this.bonus = evento
    this.bonusAnterior = evento.id
    this.esconderBanner() // o "RODADA N" não fica por cima da roleta
    await anunciarBonus(this, evento, { eventos: EVENTOS, rng: () => aleatorio(this.rngBonus) })
    if (this.saindo) return
    this.textoBonus.setText(`★ BONUS: ${evento.nome} ★`).setColor(corTexto(evento.cor)).setAlpha(1)
    this.tweens.add({ targets: this.textoBonus, scale: { from: 1.6, to: 1 }, duration: 260, ease: 'Back.easeOut' })
  }

  // Liga o efeito do evento (se ele tem um) quando a esquiva começa
  iniciarEfeitoBonus() {
    const criar = this.bonus && EFEITOS[this.bonus.id]
    if (!criar) return
    this.efeitoBonus = criar(this, { rng: () => aleatorio(this.rngBonus), rodada: this.estado.rodada, aceleracao: this.aceleracao })
    this.efeitoBonus.comecar?.()
  }

  encerrarEfeitoBonus() {
    const efeito = this.efeitoBonus
    this.efeitoBonus = null
    efeito?.terminar?.()
  }

  get temEfeitoBonus() {
    return Boolean(this.bonus && EFEITOS[this.bonus.id])
  }

  // Duelo: as cartas vão ao centro, viram e mostram a arma de cada um
  async revelacaoDuelo(r) {
    this.fase = 'revelacao'
    this.atualizarEscolha()
    this.maos.forEach((m) => m.setAtiva(false))
    const cartas = [0, 1].map((j) => {
      const jog = r.jogadas[j]
      if (jog.passou) {
        const b = this.botoesPassar[j]
        b.setEscolhido(false)
        b.setFoco(false)
        return this.criarFichaPassar(j, b.c.x, b.c.y)
      }
      const mao = this.maos[j]
      const carta = mao.cartas.find((c) => c.dados.id === jog.carta.id)
      carta.focar(false)
      mao.retirar(carta)
      return carta.setDepth(80 + j)
    })
    this.maos.forEach((m) => m.setTravada(false))
    tocar(this, 'cartaDeslizar')
    await Promise.all(cartas.map((c, j) => this.tween({ targets: c, x: MESA[j].x, y: MESA[j].y, rotation: 0, scaleX: ESCALA_MESA, scaleY: ESCALA_MESA, duration: 320, ease: 'Cubic.easeOut' })))
    this.mostrarBanner('DUELO!', corTexto(this.bonus.cor))
    await this.esperar(240)
    await Promise.all(cartas.map((c) => (c instanceof Carta ? c.revelar() : this.tween({ targets: c, scale: ESCALA_MESA * 1.15, duration: 110, yoyo: true }))))
    const NOMES = { tiro: 'TIRO', espada: 'ESPADA', bumerangue: 'BUMERANGUE', explosao: 'EXPLOSÃO' }
    const etiquetas = r.armas.flatMap((arma, j) => [
      this.etiquetaEm(MESA[j].x, MESA[j].y + 86, NOMES[arma.arma] ?? arma.arma, '#ffe9a0', { atraso: 120, tamanho: 14, ms: 1700 }),
      this.etiquetaEm(MESA[j].x, MESA[j].y + 104, r.jogadas[j].passou ? 'sorteada (passou)' : `${arma.dano} por acerto`, TEXTO.normal, { atraso: 280, tamanho: 11, ms: 1540 }),
    ])
    tocar(this, 'brilhoRank')
    await this.esperar(1700)
    etiquetas.forEach((t) => t.scene && t.destroy())
    cartas.forEach((c) => this.tirarDaMesa(c))
    this.esconderBanner()
  }

  async rodarDuelo(r) {
    // as mãos descem e o meio da mesa vira a arena do duelo
    this.maos.forEach((m) => m.setPosicao({ y: MAO_ESCONDIDA }))
    this.botoesPassar.forEach((b) => b.descer(true))
    this.status.forEach((s) => s.setText(''))
    this.montes.forEach((m) => this.tweens.add({ targets: [...m.cartas, m.texto], alpha: 0.25, duration: 200 }))
    await this.esperar(300)
    if (this.saindo) return
    this.fase = 'duelo'
    this.ko = [false, false]
    this.dica.setText(this.cpu === null ? 'mira automática   A: atacar' : 'mira automática   A: atacar   (a CPU também luta!)')
    this.duelo = new Duelo(this, { armas: r.armas, cpu: this.cpu, nivelBot: this.nivelBot, semente: `${this.semente}:duelo:${this.estado.rodada}`, aceleracao: this.aceleracao })
    await this.duelo.rodar()
    this.duelo = null
    this.dica.setText('')
  }

  // dev: a próxima rodada é bônus com o evento `id` (ou sorteado, sem id)
  forcarBonus(id = null) {
    this.bonusProximo = EVENTO[id] ? id : true
    return this.bonusProximo
  }

  // ---------- morte súbita ----------

  // Fator da rodada atual (ACELERACAO). Aplica nas pistas, no relógio, na
  // música e no selo; devolve true se o nível subiu agora.
  atualizarAceleracao() {
    const nivel = nivelAceleracao(this.estado.rodada)
    const fator = fatorAceleracao(this.estado.rodada)
    const subiu = nivel > this.nivelAceleracao
    this.nivelAceleracao = nivel
    this.aceleracao = fator
    this.pistas.forEach((p) => (p.fatorCoracao = parteDoFator(fator, ACELERACAO.coracao)))
    // relógio da escolha mais curto (em meios segundos redondos), nunca abaixo do mínimo
    if (this.tempoBase) this.tempoEscolha = Math.max(Math.min(this.tempoBase, ACELERACAO.escolhaMinMs), Math.round(this.tempoBase / fator / 500) * 500)
    if (subiu) velocidadeMusica(parteDoFator(fator, ACELERACAO.musica))
    this.indicadorVelocidade.set(fator, subiu)
    return subiu
  }

  async avisarAceleracao() {
    const maximo = this.aceleracao >= ACELERACAO.maximo
    tocar(this, 'acelerar')
    shake(this, 220, 0.008)
    flashTela(this, 0xff8a1a, 0.18, 260)
    this.mostrarBanner(`VELOCIDADE x${this.aceleracao.toFixed(2)}!`, '#ff9a3a', { y: 200, tamanho: 28, ms: 1300 })
    this.etiquetaEm(LARGURA / 2, 232, maximo ? 'VELOCIDADE MÁXIMA!' : 'a partida está demorando: tudo acelera!', maximo ? TEXTO.caido : TEXTO.normal, {
      atraso: 200,
      tamanho: 12,
      ms: 1100,
    })
    await this.esperar(1500)
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
    this.maos.forEach((m, j) => m.setEnergia(this.energiaNaMao(j)))
  }

  // ---------- escolha ----------

  escolha() {
    this.fase = 'escolha'
    this.escolhas = [undefined, undefined]
    this.noPassar = [false, false]
    this.relogio = this.tempoEscolha
    this.ultimoSegundo = null
    this.maos.forEach((m, j) => {
      m.setEnergia(this.energiaNaMao(j))
      m.setTravada(false)
      m.selecionar(Math.floor(m.cartas.length / 2))
    })
    this.botoesPassar.forEach((b) => {
      b.setEscolhido(false)
      b.setFoco(false)
    })
    this.dica.setText(
      this.bonus?.cartas === 'duelo'
        ? 'DUELO: qualquer carta vale!   ♥ tiro   ♠ espada   ♦ bumerangue   ♣ explosão'
        : '←/→ escolher   A: confirmar   B: desfazer / ir para PASSAR   C: pausa',
    )
    this.atualizarEscolha()
    if (this.cpu !== null) this.jogadaDaCpu(this.cpu, this.estado.rodada)
    return new Promise((resolver) => (this.fimDaEscolha = resolver))
  }

  // energia que a mão usa para marcar as cartas (no duelo nada custa)
  energiaNaMao(j) {
    return this.bonus?.cartas === 'duelo' ? Infinity : this.estado.jogadores[j].energia
  }

  // podeJogar da rodada atual (no duelo basta a carta estar na mão)
  podeJogarAgora(j, id) {
    return this.bonus?.cartas === 'duelo' ? podeJogarDuelo(this.estado, j, id) : podeJogar(this.estado, j, id)
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
    const v = this.podeJogarAgora(m, carta.dados.id)
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
    // no duelo a CPU pega qualquer carta da mão (todas viram arma)
    const mao0 = this.estado.jogadores[j].baralho.mao
    const id =
      this.bonus?.cartas === 'duelo'
        ? mao0[inteiro(this.rngBot, 0, mao0.length - 1)]?.id ?? null
        : this.decidirJogadaCpu(j)
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
    const ok = id && mao.selecionada?.dados.id === id && !this.noPassar[j] && this.podeJogarAgora(j, id).ok
    tocar(this, 'cpu')
    this.escolher(j, ok ? id : null)
  }

  // carta que a CPU vai jogar (id ou null para passar); a CoopArena troca pela CPU aliada
  decidirJogadaCpu(j) {
    return escolherJogada(this.estado, j, { nivel: this.nivelBot, rng: this.rngBot })
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
      if (ehSuper(jog.carta)) e.supers++
      const forca = (c) => (ehSuper(c) ? 15 : c.valor === 1 ? 14 : c.valor)
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
    if (jog.super) {
      lista.push(['★ SUPER! ★', corTexto(superDoPersonagem(jog.carta.personagem)?.cor ?? 0xffe9a0)])
      // o outro tentou anular ou refletir: não pega
      if (['anular', 'espelho'].includes(r.jogadas[outro(j)].especial)) lista.push(['IMPARÁVEL!', '#ff9a3a'])
    }
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
      // carta maluca: na mão ainda está a original
      const id = r.trocas?.[j]?.de.id ?? jog.carta.id
      const carta = mao.cartas.find((c) => c.dados.id === id)
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
    if (r.trocas?.some(Boolean)) await this.enlouquecerCartas(r.trocas)

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

  // Cartas malucas: cada carta revelada gira, vira outra e mostra no que virou
  async enlouquecerCartas(trocas) {
    this.mostrarBanner('CARTAS MALUCAS!', corTexto(EVENTO.malucas.cor), { tamanho: 22 })
    tocar(this, 'maluca')
    await Promise.all(
      trocas.map(async (troca, j) => {
        const velha = this.reveladas[j]
        if (!troca || !(velha instanceof Carta)) return
        // gira rápido (achata e volta algumas vezes) e troca no meio
        for (let k = 0; k < 3; k++) await this.tween({ targets: velha, scaleX: 0.05, duration: 70 + k * 30, yoyo: true, ease: 'Sine.easeInOut' })
        await this.tween({ targets: velha, scaleX: 0.05, duration: 110, ease: 'Sine.easeIn' })
        const nova = new Carta(this, velha.x, velha.y, { ...troca.para }, { largura: velha.largura }).setDepth(velha.depth)
        nova.setScale(0.05, velha.scaleY)
        velha.destroy()
        this.reveladas[j] = nova
        particulas(this, nova.x, nova.y, { cor: EVENTO.malucas.cor, quantidade: 26, velocidade: 180 })
        await this.tween({ targets: nova, scaleX: ESCALA_MESA, duration: 160, ease: 'Back.easeOut' })
        const quem = PERSONAGENS[troca.para.personagem]?.nome ?? troca.para.personagem
        this.etiquetasMesa.push(this.etiquetaEm(MESA[j].x, MESA[j].y - 86, `VIROU ${troca.para.nome}!\n(${quem})`, '#e0c0ff', { tamanho: 11, ms: 1600 }))
      }),
    )
    await this.esperar(500)
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

  // ---------- SUPER ----------

  // Depois da revelação: cada SUPER jogado tem a animação dele (os dois, um
  // depois do outro); depois a música especial do último toca no lugar da de
  // batalha até terminarRodada. Sem o .mid, a música de batalha continua.
  async anunciarSupers(r) {
    const lados = [0, 1].filter((j) => r.jogadas[j].super)
    if (!lados.length) return
    this.fase = 'super'
    this.esconderBanner()
    for (const j of lados) {
      const carta = r.jogadas[j].carta
      await anunciarSuper(this, { jogador: j, personagem: carta.personagem, carta })
      if (this.saindo) return
    }
    const personagem = r.jogadas[lados[lados.length - 1]].carta.personagem
    const tocou = await tocarMusicaEspecial(`super_${personagem}`)
    if (!tocou) return
    this.musicaEspecial = personagem
    // a cena saiu enquanto conferia o arquivo: devolve a música na hora
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
    if (!r.caixas.some(Boolean) && !this.temEfeitoBonus) {
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
    for (const j of [0, 1]) if (!r.caixas[j]) this.infoPista[j].setText(this.temEfeitoBonus ? 'sem carta: só o caos!' : 'caixa livre nesta rodada').setColor(TEXTO.desabilitado)
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
    this.acertosRodada = [0, 0]
    this.perfeitosRodada = [null, null]
    this.combosRodada = [null, null]
    this.esquivaBot?.reiniciar()
    const bonus = this.temEfeitoBonus
    if (!r.caixas.some(Boolean) && !bonus) return
    const comAtaque = [false, false]
    const promessas = [0, 1].map((j) => {
      const caixa = r.caixas[j]
      const ataque = caixa ? ataqueDaCartaNoJogo(caixa.carta) : null
      comAtaque[j] = Boolean(ataque)
      const pista = this.pistas[j]
      // bonus round: a caixa sem ataque também abre, só com o caos do evento
      if (!ataque) return bonus ? pista.rodar(ATAQUE_VAZIO, { dano: 0, semente: `${this.semente}:${this.estado.rodada}:${j}`, aceleracao: this.aceleracao }) : null
      pista.tema = TEMAS[caixa.carta.personagem] ?? pista.tema
      // ♦ Q/K: inverte do começo do ataque (depois do respiro) até ele acabar (ver update)
      if (caixa.inverterMs) this.invertido[j] = { avisado: false }
      return pista.rodar(ataque, { dano: caixa.dano, ritmo: caixa.ritmo, semente: `${this.semente}:${this.estado.rodada}:${j}`, aceleracao: this.aceleracao })
    })
    if (bonus) this.iniciarEfeitoBonus()
    await Promise.all(promessas.filter(Boolean))
    // antes de encerrar o efeito: com CORAÇÃO TROCADO o donoDaPista ainda vale
    const perfeitos = this.registrarDesviosPerfeitos(r, comAtaque)
    this.encerrarEfeitoBonus()
    this.invertido = [0, 0]
    this.avisoPista.forEach((t) => t.setText(''))
    await this.esperar(250)
    if (this.saindo) return
    this.infoPista.forEach((t) => t.setText(''))
    tocar(this, 'caixaFechar')
    await Promise.all(this.pistas.map((p) => p.esconder()))
    if (this.saindo || !perfeitos.length) return
    // a festa vem com as caixas já fechadas (nada fica escondido atrás delas)
    await this.festejarPerfeitos(perfeitos)
  }

  // A festa dos desvios perfeitos da rodada: aplausos no tamanho do maior
  // combo e a comemoração de cada um
  async festejarPerfeitos(perfeitos) {
    const nivel = Math.max(...perfeitos.map((p) => p.multiplicador ?? 1))
    this.aplaudir(nivel)
    perfeitos.forEach((p) => this.festejarPerfeito(p))
    await this.esperar(1100 + 260 * (nivel - 1))
  }

  // Aplausos do combo: x1 uma vez; cada nível sobrepõe mais uma salva (com um
  // atraso pequeno, soa como uma plateia maior), x3+ ganha o estouro de festa
  // e o teto a fanfarra. Só sons que já existem (audio.js)
  aplaudir(nivel = 1) {
    tocar(this, 'aplausos')
    for (let k = 1; k < nivel; k++) this.time.delayedCall(150 * k + 40 * (k - 1), () => !this.saindo && tocar(this, 'aplausos'))
    if (nivel >= 2) tocar(this, 'energia')
    if (nivel >= 3) this.time.delayedCall(120, () => !this.saindo && tocar(this, 'estouroFesta'))
    if (nivel >= COMBO_PERFEITO.teto) this.time.delayedCall(320, () => !this.saindo && tocar(this, 'fanfarra'))
  }

  // DESVIO PERFEITO: em cada pista com ataque de verdade, se o dono do coração
  // não levou nenhum acerto (e não caiu), ganha a energia da carta. Devolve a
  // lista para festejarPerfeito ({ pista, dono, ganho, base, multiplicador, sequencia }).
  // O combo de perfeitos (registrarPerfeitoCombo) sobe 1 e multiplica a energia
  registrarDesviosPerfeitos(r, comAtaque) {
    const lista = []
    for (const k of [0, 1]) {
      const caixa = r.caixas[k]
      if (!caixa || !comAtaque[k]) continue
      const dono = this.donoDaPista(k)
      if (this.acertosRodada[dono] || this.ko[dono] || !energiaPerfeito(caixa.carta)) continue
      const combo = registrarPerfeitoCombo(this.estado, dono, caixa.carta)
      this.perfeitosRodada[dono] = (this.perfeitosRodada[dono] ?? 0) + combo.ganho
      this.combosRodada[dono] = combo.multiplicador
      this.estatisticas[dono].perfeitos++
      this.estatisticas[dono].maiorSequencia = Math.max(this.estatisticas[dono].maiorSequencia ?? 0, combo.sequencia)
      lista.push({ pista: k, dono, ...combo })
    }
    return lista
  }

  // Comemoração de um desvio perfeito; cresce com o combo (multiplicador):
  //   x1 "PERFEITO!"          3 fogos
  //   x2 "PERFEITO x2!"       texto maior e com brilho, 5 fogos, canhões de confete
  //   x3 "PERFEITO x3!!"      maior ainda, 7 fogos, tremida leve, clarão dourado
  //   x4 "PERFEITO x4!!!"     (teto) arco-íris, chuva de confete
  festejarPerfeito({ pista, dono, ganho, base, multiplicador = 1 }) {
    const x = CENTROS[pista]
    const y = PISTA.y
    const cor = CORES.almas[dono]
    const n = Math.max(1, multiplicador)
    const teto = n >= COMBO_PERFEITO.teto
    const titulo = n > 1 ? `PERFEITO x${n}${'!'.repeat(n - 1)}` : 'PERFEITO!'
    const corTitulo = [TEXTO.selecionado, '#ffe14a', '#ffb02e', '#ffffff'][Math.min(n, 4) - 1]
    const ms = 1200 + 200 * (n - 1)
    // brilho atrás do texto (só com combo)
    if (n > 1) {
      const brilho = this.add.image(x, y - 18, 'brilho').setTint(teto ? 0xff9ae8 : 0xffd23c).setBlendMode(Phaser.BlendModes.ADD).setDepth(96).setAlpha(0).setScale(0.6)
      this.tweens.add({ targets: brilho, alpha: 0.35 + 0.15 * n, scaleX: 1.6 + 0.5 * n, scaleY: 0.7 + 0.15 * n, duration: 220, ease: 'Quad.easeOut' })
      this.tweens.add({ targets: brilho, alpha: 0, delay: ms, duration: 300, onComplete: () => brilho.destroy() })
    }
    const t = this.etiquetaEm(x, y - 18, titulo, corTitulo, { tamanho: 24 + 4 * (n - 1), ms })
    if (n > 1) {
      t.setShadow(0, 0, teto ? '#ff9ae8' : '#ffd23c', 6 + 4 * n, true, true)
      // pulsa uma vez por nível
      this.tweens.add({ targets: t, scale: 1.12, delay: 200, duration: 140, yoyo: true, repeat: n - 2, ease: 'Sine.easeInOut' })
    }
    if (teto) {
      const arco = ['#ff4a5a', '#ffa23a', '#ffe14a', '#5ae06a', '#4ab8ff', '#a66bff']
      arco.concat(arco).forEach((c, k) => this.time.delayedCall(k * 110, () => t.scene && t.setColor(c)))
    }
    const energia = ganho ? `+${ganho} ENERGIA${n > 1 && base ? ` (${base} x${n})` : ''}` : 'ENERGIA CHEIA!'
    this.etiquetaEm(x, y + 14 + 2 * n, energia, '#7fd8ff', { atraso: 200, tamanho: 13, ms: ms - 200 })
    particulas(this, x, y, { cor, quantidade: 26 + 10 * (n - 1), velocidade: 200 + 30 * (n - 1) })
    // fogos: 3, 5, 7, 9 (espalhados pela pista e acima dela)
    const fogos = 1 + 2 * n
    for (let i = 0; i < fogos; i++) {
      const dx = fogos === 1 ? 0 : -90 + (180 * i) / (fogos - 1)
      const dy = -40 + (i % 2) * 24 - (i % 3 === 2 ? 30 : 0)
      this.time.delayedCall(i * (480 / fogos), () => !this.saindo && fogoArtificio(this, x + dx, y + dy, undefined, { quantidade: 28 + 6 * (n - 1), profundidade: 97 }))
    }
    if (n >= 2) canhoesConfete(this, 14 * n, 96)
    if (n >= 3) {
      shake(this, 160 + 60 * (n - 3), 0.003 + 0.0015 * (n - 3))
      flashTela(this, 0xffd23c, 0.08 + 0.04 * (n - 3), 200)
    }
    if (teto) {
      const chuva = chuvaConfete(this, 96)
      this.time.delayedCall(1400, () => chuva.scene && chuva.stop())
      this.time.delayedCall(5200, () => chuva.scene && chuva.destroy())
    }
    const hud = this.huds[dono]
    hud.setEnergia(this.estado.jogadores[dono].energia)
    hud.setSequencia(this.estado.jogadores[dono].sequencia ?? 0)
    if (ganho) numero(this, hud.pontoEnergia.x, hud.pontoEnergia.y, `+${ganho}`, '#7fd8ff', { tamanho: 16 + 2 * (n - 1) })
    this.maos[dono]?.setEnergia?.(this.energiaNaMao(dono))
  }

  // Levou acerto com combo de perfeitos: o HUD avisa "COMBO QUEBROU" (pequeno)
  comboQuebrou(j, sequenciaAntes) {
    if (!sequenciaAntes) return
    this.huds[j].comboQuebrou()
  }

  acertou(j, dano) {
    if ((this.fase !== 'esquiva' && this.fase !== 'duelo') || this.ko[j] || debug.invencivel) return false
    this.acertosRodada[j]++ // levou acerto: sem desvio perfeito nesta rodada
    const sequenciaAntes = this.estado.jogadores[j].sequencia ?? 0
    const efetivo = aplicarDano(this.estado, j, dano) // também quebra o combo de perfeitos
    this.comboQuebrou(j, sequenciaAntes)
    const jog = this.estado.jogadores[j]
    this.estatisticas[j].danoRecebido += efetivo
    this.estatisticas[outro(j)].danoCausado += efetivo
    const hud = this.huds[j]
    hud.setHp(jog.hp)
    hud.tremer()
    numero(this, hud.pontoHp.x, hud.pontoHp.y + 4, efetivo ? `-${efetivo}` : '0', TEXTO.caido, { tamanho: 16, desvio: 12 })
    shake(this, 90, 0.004)
    const k = this.pistaDe(j) // a pista onde o coração dele está (CORAÇÃO TROCADO)
    if (this.fase === 'esquiva') {
      const borda = this.pistas[k].caixa.retangulo
      borda.setStrokeStyle(4, 0xff3048)
      this.time.delayedCall(140, () => borda.scene && borda.setStrokeStyle(4, CORES.almas[k]))
    }
    if (jog.protegido && jog.hp === 1 && dano > 0) {
      this.etiquetaEm(CENTROS[k], PISTA.y - PISTA.altura / 2 - 18, 'SEGUNDA CHANCE: AGUENTA!', '#ffe9a0', { tamanho: 11, ms: 700 })
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
    // o duelo quebra o coração (com efeitos próprios) e termina a luta
    if (this.fase === 'duelo') return this.duelo?.nocaute(j)
    const k = this.pistaDe(j) // CORAÇÃO TROCADO: o coração dele está na outra pista
    const coracao = this.pistas[k].coracoes[0]
    tocar(this, 'quebrar')
    flashTela(this, CORES.almas[j], 0.3, 220)
    shake(this, 260, 0.014)
    particulas(this, coracao.x, coracao.y, { cor: CORES.almas[j], quantidade: 30, velocidade: 220, vida: 700 })
    coracao.esconder()
    this.avisoPista[k].setText('K.O.!').setColor(TEXTO.caido).setFontSize(20)
    if (this.paradaAgendada) return
    this.paradaAgendada = true
    this.time.delayedCall(900, () => {
      this.paradaAgendada = false
      this.pistas.forEach((p) => p.parar())
    })
  }

  grazeou(j) {
    if ((this.fase !== 'esquiva' && this.fase !== 'duelo') || this.ko[j]) return
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
    this.voltarDaMusicaEspecial() // fim do SUPER: a música de batalha volta de onde parou
    const vencedor = fimDaRodada(this.estado)
    if (this.bonus) {
      this.bonus = null
      this.tweens.add({ targets: this.textoBonus, alpha: 0, duration: 300 })
    }
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
    return ['inicio', 'escolha', 'revelacao', 'arremesso', 'esquiva', 'duelo'].includes(this.fase) && !this.saindo && !this.pausado
  }

  pausar() {
    // o mesmo C que fechou o menu chega aqui logo depois: ignora
    if (!this.podePausar() || this.time.now - this.retomadoEm < 200) return
    this.pausado = true
    pausarMusica()
    this.scene.pause()
    const nomes = this.ids.map((id) => PERSONAGENS[id]?.nome ?? id)
    this.scene.launch('Pausa', { cena: 'PvpArena', recomecar: { p1: this.ids[0], p2: this.ids[1] }, sair: 'Menu', subtitulo: `${nomes[0]} x ${nomes[1]}` })
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
    // morte súbita: animações de carta, esperas e transições também aceleram
    // (as pistas usam o delta: o bônus delas já vem no ritmo das balas)
    const animacao = debug.acelerar * parteDoFator(this.aceleracao, ACELERACAO.animacao)
    this.tweens.timeScale = animacao
    this.time.timeScale = animacao
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
      // controles invertidos: valem enquanto o ataque desta pista roda (do fim
      // do respiro inicial até o fim); acabou o ataque (ou parou no K.O.), acabou
      // ♦ Q/K vale para quem estiver desviando nesta pista; com CORAÇÃO TROCADO
      // quem desvia aqui (e manda neste coração) é o outro jogador
      const inv = this.invertido[j]
      const dono = this.donoDaPista(j)
      const invertendo = Boolean(inv) && pista.atacando && !this.ko[dono]
      let joy = dono === this.cpu ? this.joyDaCpu(pista, delta, invertendo) : this.controles.joy(dono)
      if (invertendo) {
        if (!inv.avisado) {
          inv.avisado = true
          tocar(this, 'inverter')
        }
        joy = { x: -joy.x, y: -joy.y }
        this.avisoPista[j].setText(Math.floor(this.time.now / 180) % 2 ? 'CONTROLES INVERTIDOS!' : '').setColor('#ff9a3a')
      } else if (inv?.avisado) {
        this.invertido[j] = 0
        if (!this.ko[dono]) this.avisoPista[j].setText('')
      }
      // bonus round: o evento pode mexer no joystick (gravidade...) e no
      // relógio da pista (passo: 0 = congelada neste frame, ex.: estátua, PC da escola)
      if (this.efeitoBonus?.joy) joy = this.efeitoBonus.joy(j, joy) ?? joy
      const passo = this.efeitoBonus?.passo ? this.efeitoBonus.passo(j, delta, joy) : delta
      if (passo > 0) pista.atualizar(passo, joy)
    })
    this.efeitoBonus?.atualizar?.(delta)
    if (this.fase === 'duelo') this.duelo?.atualizar(delta)
  }

  // joystick da CPU na pista dela (pvp/botEsquiva.js)
  joyDaCpu(pista, delta, invertido) {
    const coracao = pista.coracoes[0]
    if (this.fase !== 'esquiva' || !pista.rodando || !coracao?.ativo || this.ko[this.cpu]) return { x: 0, y: 0 }
    return this.esquivaBot.joy(delta, {
      coracao,
      limites: pista.caixa.limites,
      balas: pista.balas.lista,
      velocidade: pista.velocidadeCoracao,
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
      aceleracao: { nivel: this.nivelAceleracao, fator: this.aceleracao, tempoEscolha: this.tempoEscolha },
      bonus: this.bonus?.id ?? null,
      bonusPendente: this.bonusPendente,
      coracoesTrocados: this.coracoesTrocados,
      efeitoBonus: Boolean(this.efeitoBonus),
      musicaEspecial: this.musicaEspecial,
      perfeitos: [...this.perfeitosRodada],
      combos: [...this.combosRodada],
      acertosRodada: [...this.acertosRodada],
      duelo: this.duelo?.estadoDebug?.() ?? null,
      jogadores: this.estado.jogadores.map((jog, j) => {
        const pista = this.pistas[j]
        const cor = pista.coracoes[0]
        return {
          personagem: jog.personagem,
          hp: jog.hp,
          hpMax: jog.hpMax,
          energia: jog.energia,
          sequencia: jog.sequencia ?? 0,
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

