import PvpArena, { LAYOUT_PVP } from './PvpArena.js'
import { LARGURA, ALTURA, CENTRO_X, FONTE, CORES, TEXTO, corTexto, DESAFIO, NIVEIS, DIFICULDADES } from '../constants.js'
import Controles from '../controles.js'
import { tocar, musica, velocidadeMusica, pausarMusica } from '../audio.js'
import { debug } from '../debug.js'
import { PERSONAGENS } from '../data/personagens.js'
import { CHEFES, nivelDoChefe } from '../coop/chefes/index.js'
import { partyDe } from '../data/batalha.js'
import { criarFundo } from '../backgrounds/index.js'
import { ataques } from '../attacks/index.js'
import Carta, { SIMBOLOS } from '../entities/Carta.js'
import Mao from '../entities/Mao.js'
import Inimigo from '../entities/Inimigo.js'
import Balao from '../entities/Balao.js'
import Pista from '../pvp/Pista.js'
import HudPvp from '../pvp/HudPvp.js'
import { EsquivaBot } from '../pvp/botEsquiva.js'
import { criarRng } from '../pvp/baralho.js'
import { ehSuper } from '../pvp/cartas.js'
import { energiaPerfeito } from '../pvp/regras.js'
import { ataqueDaCartaChefe, TIPOS_CHEFE, superDoChefe } from '../coop/cartasChefe.js'
import {
  COOP,
  criarPartidaCoop,
  iniciarRodadaCoop,
  podeJogarCoop,
  resolverRodadaCoop,
  aplicarDanoCoop,
  calcularGolpes,
  comboDosGolpes,
  aplicarGolpe,
  fimDaRodadaCoop,
  fracaoDoCombo,
  danoComEscudo,
  registrarPerfeitoCombo,
} from '../coop/regras.js'
import { QUADRO, inicioDoCoracao } from '../coop/quadro.js'
import { escolherJogadaCoop } from '../coop/bot.js'
import { superNoChefe } from '../coop/superNoChefe.js'
import ArenaRedeCoop from '../coop/ArenaRedeCoop.js'
import { canal, emRede, meuLado, souHostDaRede, irParaCena } from '../rede.js'
import { shake } from '../effects/shake.js'
import { flashTela } from '../effects/flash.js'
import { numero } from '../effects/numero.js'
import { particulas } from '../effects/particulas.js'
import { entrarNoJogo, voltarAoMenu, levouGolpe } from '../../lib/saida.js'
import { fatores } from '../acessibilidade.js'

// CO-OP de cartas: os dois jogadores (ou 1 + CPU aliada) contra um chefe que
// também joga cartas. Regras em coop/regras.js (docs/coop-cartas.md).
//
// Estende a PvpArena: a escolha de cartas (mãos, PASSAR, relógio, prévia,
// CPU mexendo o cursor), os placares e a morte súbita são os mesmos. Muda o
// resto da rodada, e a esquiva é num QUADRO ÚNICO (coop/quadro.js): o chefe
// joga UMA carta por rodada e os dois desviam do MESMO ataque, no meio da mesa
// (embaixo do chefe), com os dois corações dentro:
//   'inicio'     energia, mãos, quem caiu volta; o chefe joga a carta VIRADA embaixo
//                dele (o naipe fica à vista: a intenção, para os dois)
//   'escolha'    igual ao PvP (quem está caído passa sozinho)
//   'revelacao'  as cartas dos jogadores e a do chefe viram; Ases, copas, SUPER
//                (A♠/A♦/A♣ e o SUPER de jogador tiram o ataque do quadro, para os dois)
//   'super'      animação do SUPER de jogador (a mesma do PvP)
//   'arremesso'  o quadro abre e a carta do chefe voa para ele; as de ataque dos
//                jogadores ficam CARREGANDO no canto de cada um (em cima do personagem)
//   'esquiva'    os dois no quadro; cada coração leva o próprio dano (com o próprio
//                escudo) e faz os próprios grazes; HP 0 = caiu (o coração some e o
//                outro segue). Desvio perfeito é de cada um: energia x combo de
//                perfeitos (festa e HUD da PvpArena) + CRÍTICO no contra-ataque (fixo).
//                A CPU aliada desvia no mesmo quadro (EsquivaBot)
//   'contra'     as cartas carregadas voam no chefe (crítico, combo, par, armadilha);
//                o SUPER tem o efeito do personagem em cima do chefe (coop/superNoChefe.js)
//                e os dois SUPER juntos viram o SUPER COMBO (forte, mas o chefe com mais
//                da metade do HP aguenta: limiteDoSuper em coop/regras.js, "AGUENTOU!")
//   'fim'        fase nova do chefe? vitória (Vitoria) ou os dois caídos (GameOver)
//
//   scene.start('CoopArena', { chefe: 'king', nivel: 'facil', party?, semente? })
//   (party: dados.party; sem ela, registry 'party'. 1 jogador no painel: o P2 é a CPU aliada)
//
// EM REDE (numa sala, docs/rede-pvp.md, seção "CO-OP em rede"): se emRede() na
// hora do create, cada PC roda esta cena com os mesmos dados (o host abre com
// irParaCena(this, 'CoopArena', { chefe, nivel, party: [p1, p2], semente })) e
// this.rede (coop/ArenaRedeCoop.js) liga as duas. Sem CPU aliada (são os dois
// humanos: o host é o P1, o convidado o P2) e sem pausa.
//   - o HOST decide tudo que é regra: a carta do chefe (iniciarRodadaCoop, mensagem
//     `inicio`), a resolução (`resolucao`), o contra-ataque (`contra`) e o fim da
//     rodada / fase nova / vitória ou derrota (`fimRodada`). O convidado mostra o
//     mesmo e fica com o estado do host
//   - cada PC é dono do PRÓPRIO coração no quadro: ele anda pelo joystick daqui e
//     colide aqui; o dano (já com o escudo) e os grazes vão por `dano`/`graze`. O
//     coração do outro é espelho (coracao.espelho): anda pelas posições que chegam
//     (`coracao`, interpolado) e não colide aqui. O ataque roda nos dois com a mesma
//     semente; os dois avisam quando o quadro acabou (`fimEsquiva`) e se encontram
//   - no fim, o convidado avisa que acabou a animação (`resultadoPronto`) e o host
//     abre a Vitoria/GameOver nos dois (irParaCena)
//   jogada, cursor, coracao, dano, graze e fimEsquiva são as mesmas da PvpArena.
// No dev: window.coopArena (estadoDebug, setHp, setHpChefe, forcarMao...); em rede
// forcarMao/setHp/setEnergia/setHpChefe valem nos dois PCs.

const { MAOS, ESCALA_MESA, HP_BAIXO } = LAYOUT_PVP

const CHEFE = { x: CENTRO_X, y: 196 }
// a carta do chefe (a intenção), embaixo dele: uma só, para os dois. O nome
// (ATAQUE, CONTROLE...) fica do lado dela: embaixo passa a dica da escolha
const INTENCAO = { x: QUADRO.x, y: 278 }
const LARGURA_INTENCAO = 42
const ROTULO_INTENCAO = { x: INTENCAO.x + 30, y: INTENCAO.y }
const MESA = [
  { x: CENTRO_X - 160, y: 188 },
  { x: CENTRO_X + 160, y: 188 },
]
// a carta de ataque de cada um fica carregando no canto dele (em cima do personagem):
// o meio da mesa, embaixo do chefe, é do quadro
const ARMADA = [
  { x: 58, y: 166 },
  { x: LARGURA - 58, y: 166 },
]
const ESCALA_ARMADA = 0.6
const PERSONAGEM = [
  { x: 36, y: 300 },
  { x: LARGURA - 36, y: 300 },
]
// avisos de cada um durante a esquiva (CAIU!, CONTROLES INVERTIDOS!, ESCUDO!), no canto dele
const AVISO = [
  { x: 76, y: 226 },
  { x: LARGURA - 76, y: 226 },
]
const INFO_QUADRO_Y = QUADRO.campo.base + 2 // nome do ataque e dano, embaixo do quadro (uma linha)
// na esquiva as mãos descem até sumir (no PvP a pontinha aparece): embaixo do quadro fica o nome do ataque
const MAO_FORA = ALTURA + 80
// a festa do desvio perfeito de cada um, no lado dele do quadro
const FESTA = [
  { x: QUADRO.x - QUADRO.largura / 4, y: QUADRO.y },
  { x: QUADRO.x + QUADRO.largura / 4, y: QUADRO.y },
]
const NOMES_ESPECIAIS = { espelho: 'ESPELHO!', anular: 'ANULAR!', roubo: 'ROUBO!', segundaChance: 'SEGUNDA CHANCE!' }
const NOMES_GOLPE = { espadas: 'GOLPE', ouros: 'GOLPE + ATRASA', paus: 'ARMADILHA', super: 'SUPER', espelho: 'REFLEXO', eco: 'ECO' }

export default class CoopArena extends PvpArena {
  constructor() {
    super('CoopArena')
  }

  init(dados) {
    this.idChefe = CHEFES[dados?.chefe] ? dados.chefe : this.registry.get('chefe') ?? 'king'
    const nivel = dados?.nivel ?? this.registry.get('nivel')
    this.idNivel = NIVEIS[nivel] ? nivel : 'facil'
    // em rede a party vem nos dados (o registry é de cada PC)
    this.partyDosDados = Array.isArray(dados?.party) && dados.party.some((id) => PERSONAGENS[id]) ? dados.party.filter((id) => PERSONAGENS[id]) : null
    this.semente = dados?.semente ?? `coop:${Date.now()}`
    this.tempoBase = dados?.tempo ?? 15000
    this.bonusForcado = null
  }

  create() {
    this.registry.set('chefe', this.idChefe)
    this.registry.set('nivel', this.idNivel)
    if (this.partyDosDados) this.registry.set('party', this.partyDosDados)
    this.defChefe = CHEFES[this.idChefe]
    this.nivel = nivelDoChefe(this.idChefe, this.idNivel)
    const party = this.partyDosDados ?? partyDe(this.registry)
    this.ids = [party[0], party[1] ?? party[0]]

    // partida EM REDE: cada PC roda esta cena; coop/ArenaRedeCoop.js faz a ponte
    this.rede = emRede() ? new ArenaRedeCoop(this, { canal, meuLado: meuLado(), souHost: souHostDaRede() }) : null
    this.controles = new Controles(this)
    this.numJogadores = this.controles.numJogadores
    this.cpu = this.numJogadores < 2 ? 1 : null // sozinho: o P2 é a CPU aliada (em rede, nunca)
    this.nivelBot = 'normal'
    this.rngBot = criarRng(`${this.semente}:cpu`)
    this.esquivaBot = this.cpu === null ? null : new EsquivaBot({ nivel: this.nivelBot })
    this.tempoEscolha = this.tempoBase
    this.hpAvisado = [false, false]
    this.estado = criarPartidaCoop({ party: this.ids, chefe: this.idChefe, nivel: this.idNivel, semente: this.semente })
    this.fase = 'abertura'
    this.saindo = false
    this.pausado = false
    this.retomadoEm = 0
    this.escolhas = [undefined, undefined]
    this.noPassar = [false, false]
    this.previas = [null, null]
    this.reveladas = [null, null]
    this.relogio = 0
    this.invertido = [0, 0] // [0]: o ataque do quadro inverte os controles (os dois)
    this.ko = [false, false]
    this.aceleracao = 1
    this.nivelAceleracao = 0
    this.bonus = null
    this.bonusPendente = null
    this.bonusProximo = null
    this.efeitoBonus = null
    this.coracoesTrocados = false
    this.duelo = null
    this.musicaEspecial = null
    this.acertosRodada = [0, 0]
    this.perfeitosRodada = [null, null]
    this.combosRodada = [null, null] // multiplicador do combo de perfeitos nesta rodada
    this.grazesRodada = [0, 0]
    this.rodadaAtual = null // o resultado da rodada (r.quadro: quem está no quadro, o escudo de cada um)
    this.intencaoVisual = null
    this.armadas = [null, null]
    this.inicioLuta = this.time.now
    velocidadeMusica(1)
    this.estatisticas = [0, 1].map(() => ({ danoCausado: 0, danoRecebido: 0, cartasJogadas: 0, maiorCarta: null, grazes: 0, ases: 0, passes: 0, perfeitos: 0, maiorSequencia: 0, supers: 0, maiorGolpe: 0, golpes: 0, criticos: 0 }))
    this.combos = 0
    // retomada (2D): alguém caiu e voltou; a luta volta ao começo da rodada (pvp/rede/ArenaRede.js)
    this.retomada = this.rede?.aplicarRetomada(this.sys.settings.data?.retomada) ?? false

    this.desenharFundo()
    this.criarChefe()
    this.criarPersonagens()
    this.criarQuadro()
    this.huds = [0, 1].map((j) => new HudPvp(this, { jogador: j, personagem: this.ids[j], hpMax: this.estado.jogadores[j].hpMax, rotulo: this.rotulo(j) }))
    this.criarTopo()
    if (this.cpu !== null) this.textoTreino.setText('COM CPU ALIADA')
    else if (!this.rede) this.textoTreino.setText('')
    this.montes = [0, 1].map((j) => this.criarMonte(j))
    this.maos = [0, 1].map(
      (j) => new Mao(this, { jogador: j, x: MAOS[j].x, y: MAOS[j].y, monte: MAOS[j].monte, larguraMax: 150, espacamento: 40, profundidade: 20 }),
    )
    this.botoesPassar = [0, 1].map((j) => this.criarBotaoPassar(j))
    this.criarTextos()
    this.ajustarTextos()

    this.controles.onBotao((j, botao) => {
      if (this.pausado || this.saindo) return
      if (botao === 'A') this.apertarA(j)
      else this.apertarB(j)
    })
    this.controles.onPausa(() => this.pausar())
    this.controles.onPerdaDeFoco((motivo) => this.pausar(motivo))
    this.events.on('postupdate', this.filtrarCaixas, this)

    if (import.meta.env.DEV) window.coopArena = this
    entrarNoJogo() // joystick: GAME e o HP no OLED
    this.events.once('shutdown', () => {
      this.saindo = true
      voltarAoMenu()
      this.events.off('postupdate', this.filtrarCaixas, this)
      this.rede?.destruir()
      this.pistas.forEach((p) => p.destruir())
      this.voltarDaMusicaEspecial()
      velocidadeMusica(1)
      if (window.coopArena === this) delete window.coopArena
    })

    musica(this.defChefe.musica)
    this.cameras.main.fadeIn(300)
    this.partida()
  }

  // ---------- montagem ----------

  // o fundo maluco do chefe, um pouco escurecido para as cartas aparecerem
  desenharFundo() {
    this.fundo = criarFundo(this, this.defChefe.fundo, this.nivel.fundo)
    this.add.rectangle(0, 0, LARGURA, ALTURA, 0x05030c, 0.22).setOrigin(0).setDepth(-4)
    // faixa escura embaixo, onde ficam as mãos
    const g = this.add.graphics().setDepth(-3)
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.75, 0.75)
    g.fillRect(0, 340, LARGURA, ALTURA - 340)
  }

  criarChefe() {
    const def = this.defChefe
    this.inimigo = new Inimigo(this, CHEFE.x, CHEFE.y, def)
    this.inimigo.nome.setFontSize(13).setStroke('#000000', 3)
    this.textoChefe = this.add
      .text(CHEFE.x, 115, '', { fontFamily: FONTE, fontSize: '9px', color: '#ffd23c', stroke: '#000000', strokeThickness: 3, align: 'center' })
      .setOrigin(0.5)
      .setDepth(30)
    this.balao = new Balao(this)
    this.balao.grafico.setDepth(62)
    this.balao.texto.setDepth(63)
    this.atualizarChefe()
  }

  // os dois personagens da party nos cantos, virados para o meio
  criarPersonagens() {
    this.personagens = [0, 1].map((j) => {
      const { x, y } = PERSONAGEM[j]
      const sprite = this.add.image(x, y, this.ids[j]).setScale(2.5).setFlipX(j === 1).setDepth(1)
      const idle = this.tweens.add({ targets: sprite, y: y - 3, duration: 700 + j * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      const aviso = this.add
        .text(x, y - 46, '', { fontFamily: FONTE, fontSize: '9px', color: TEXTO.caido, stroke: '#000000', strokeThickness: 3, align: 'center' })
        .setOrigin(0.5)
        .setDepth(2)
      return { sprite, idle, aviso, x, y }
    })
  }

  // O quadro único (coop/quadro.js): uma Pista com os dois corações, cada um na
  // cor do seu jogador; a borda é branca (é dos dois). Fica em this.pistas[0]
  // (a PvpArena e a ponte de rede andam pelas pistas)
  criarQuadro() {
    const def = this.defChefe
    const velocidadeMax = DIFICULDADES[def.dificuldade].velocidadeMaxBala * DESAFIO.velocidadeMax * this.nivel.velocidadeMax
    const quadro = new Pista(this, {
      x: QUADRO.x,
      y: QUADRO.y,
      largura: QUADRO.largura,
      altura: QUADRO.altura,
      jogador: [0, 1],
      tema: def.tema,
      velocidadeMax,
      dinamica: { campo: QUADRO.campo },
      faixa: QUADRO.faixa,
    })
    // cada coração leva o próprio dano, com o próprio escudo (o dano da bala é o da carta)
    quadro.aoAcertar = (dano, bala, coracao) => this.acertou(coracao.jogador, this.danoNoCoracao(coracao.jogador, dano))
    quadro.aoGraze = (coracao) => this.grazeou(coracao.jogador)
    this.quadro = quadro
    this.pistas = [quadro]
  }

  // Os textos da PvpArena que ficam no lugar das caixas dela vão para o quadro e
  // para os cantos de cada um
  ajustarTextos() {
    this.infoPista[0].setPosition(QUADRO.x, INFO_QUADRO_Y)
    this.infoPista[1].setVisible(false)
    this.avisoPista.forEach((t, j) => t.setPosition(AVISO[j].x, AVISO[j].y))
  }

  // ritmo base da luta (o aperto geral DESAFIO, o do chefe, o do nível e o do quadro)
  get ritmoBase() {
    const d = this.defChefe.desafio ?? {}
    const q = QUADRO.ritmo ?? {}
    return {
      velocidade: DESAFIO.velocidade * this.nivel.velocidade * (d.velocidade ?? 1) * (q.velocidade ?? 1),
      densidade: DESAFIO.densidade * this.nivel.densidade * (d.densidade ?? 1) * (q.densidade ?? 1),
    }
  }

  rotulo(j) {
    return j === this.cpu ? 'CPU' : `P${j + 1}`
  }

  // os dois corações moram no mesmo quadro
  pistaDe() {
    return 0
  }

  coracaoDoLado(p) {
    return this.quadro?.coracoes[p] ?? null
  }

  // j está desviando no quadro desta rodada?
  noQuadro(j) {
    return Boolean(this.rodadaAtual?.quadro?.jogadores[j])
  }

  // dano de um acerto no coração j: o da bala, com o escudo de j nesta rodada
  danoNoCoracao(j, dano) {
    return danoComEscudo(dano, this.rodadaAtual?.quadro?.escudos[j] ?? null)
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

  // quem caiu: personagem deitado, placar apagado
  atualizarCaidos() {
    this.estado.jogadores.forEach((jog, j) => {
      const p = this.personagens[j]
      const caido = jog.caido
      if (caido !== p.caido) {
        p.caido = caido
        this.tweens.killTweensOf(p.sprite)
        if (caido) {
          p.idle.stop()
          this.tweens.add({ targets: p.sprite, angle: j ? -90 : 90, y: p.y + 16, alpha: 0.55, duration: 260, ease: 'Quad.easeIn' })
          p.sprite.setTint(0x8080a0)
        } else {
          p.sprite.clearTint()
          this.tweens.add({ targets: p.sprite, angle: 0, y: p.y, alpha: 1, duration: 260, ease: 'Back.easeOut' })
          p.idle = this.tweens.add({ targets: p.sprite, y: p.y - 3, duration: 700 + j * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 260 })
        }
        this.huds[j].container.setAlpha(caido ? 0.55 : 1)
      }
      const faltam = caido ? Math.max(1, jog.voltaEm - this.estado.rodada) : 0
      p.aviso.setText(caido ? `CAÍDO\nvolta em ${faltam}` : '')
    })
  }

  personagemPula(j) {
    const p = this.personagens[j]
    if (p.caido) return
    this.tweens.add({ targets: p.sprite, x: p.x + (j ? -14 : 14), duration: 90, yoyo: true, ease: 'Quad.easeOut' })
  }

  personagemDoi(j) {
    const p = this.personagens[j]
    p.sprite.setTint(0xff5050)
    this.time.delayedCall(120, () => !p.caido && p.sprite.clearTint())
    this.tweens.add({ targets: p.sprite, x: p.x + (j ? 4 : -4), duration: 40, yoyo: true, repeat: 2, onComplete: () => (p.sprite.x = p.x) })
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

  // o que a retomada (2D) guarda além do estado das regras (ArenaRede.guardarPonto)
  extrasRetomada() {
    return { estatisticas: this.estatisticas, combos: this.combos }
  }

  async partida() {
    if (this.retomada) this.mostrarFaseRetomada()
    else await this.abertura()
    while (!this.saindo) {
      await this.inicioDaRodada()
      if (this.saindo) return
      const jogadas = await this.escolha()
      if (this.saindo) return
      const r = await this.decidirRodadaCoop(jogadas)
      if (this.saindo || !r) return
      this.rodadaAtual = r
      this.contarJogadas(r)
      await this.revelacao(r)
      if (this.saindo) return
      await this.anunciarSupers(r)
      if (this.saindo) return
      await this.arremesso(r)
      if (this.saindo) return
      await this.esquiva(r)
      if (this.saindo) return
      await this.contraAtaque(r)
      if (this.saindo) return
      const vencedor = await this.terminarRodada()
      if (this.saindo) return
      if (vencedor) return this.resultado(vencedor)
    }
  }

  // A resolução da rodada (resolverRodadaCoop). Em rede só o host resolve (a
  // jogada que não vale lá vira passar) e manda; o convidado recebe
  async decidirRodadaCoop(jogadas) {
    if (this.rede && !this.rede.souHost) return this.rede.receberResolucao()
    if (this.rede) jogadas = this.rede.validarJogadas(jogadas)
    const r = resolverRodadaCoop(this.estado, jogadas[0], jogadas[1])
    this.rede?.enviarResolucao(jogadas, r)
    return r
  }

  async abertura() {
    this.fase = 'abertura'
    // a fenda da Entrada (lançada pela Dificuldade) abre primeiro
    for (let i = 0; i < 40 && this.scene.isActive('Entrada'); i++) await this.esperar(50)
    const nomes = this.ids.map((id) => PERSONAGENS[id]?.nome?.toUpperCase() ?? id.toUpperCase())
    const estilo = (tamanho, cor) => ({ fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 5 })
    const dupla = this.add
      .text(-200, 214, `${nomes[0]} & ${nomes[1]}`, estilo(24, '#ffffff'))
      .setOrigin(0.5)
      .setDepth(96)
    const vs = this.add.text(LARGURA / 2, 246, 'CONTRA', estilo(14, TEXTO.selecionado)).setOrigin(0.5).setDepth(96).setScale(0)
    const chefe = this.add
      .text(LARGURA + 200, 278, this.defChefe.nome.toUpperCase(), estilo(26, corTexto(this.defChefe.tema.cor)))
      .setOrigin(0.5)
      .setDepth(96)
    tocar(this, 'voo')
    await this.tween({ targets: dupla, x: LARGURA / 2, duration: 360, ease: 'Back.easeOut' })
    this.tween({ targets: vs, scale: 1, duration: 200, ease: 'Back.easeOut' })
    await this.tween({ targets: chefe, x: LARGURA / 2, duration: 360, ease: 'Back.easeOut' })
    tocar(this, 'impacto')
    shake(this, 180, 0.012)
    this.inimigo.dano(0.3)
    this.falar(this.defChefe.textoInicial, 1800)
    await this.esperar(1300)
    await this.tween({ targets: [dupla, vs, chefe], alpha: 0, duration: 260 })
    ;[dupla, vs, chefe].forEach((t) => t.destroy())
  }

  async inicioDaRodada() {
    this.fase = 'inicio'
    this.rodadaAtual = null
    // em rede o host começa a rodada (e tira a carta do chefe) e manda; o convidado espera
    const eventos = this.rede ? await this.rede.iniciarRodada() : iniciarRodadaCoop(this.estado)
    if (!eventos) return
    const acelerou = this.atualizarAceleracao()
    this.textoRodada.setText(`RODADA ${this.estado.rodada}`)
    this.tweens.add({ targets: this.textoRodada, scale: { from: 1.5, to: 1 }, duration: 260, ease: 'Back.easeOut' })
    this.mostrarBanner(`RODADA ${this.estado.rodada}`, TEXTO.normal, { y: 236, tamanho: 26, ms: 700 })
    tocar(this, 'rodada')
    this.time.delayedCall(260, () => tocar(this, 'energia'))
    this.atualizarHuds()
    for (const ev of eventos) {
      if (ev.tipo !== 'voltou') continue
      const p = this.personagens[ev.j]
      this.etiquetaEm(p.x + (ev.j ? -20 : 20), p.y - 60, 'VOLTOU!', TEXTO.cura, { tamanho: 13, ms: 1200 })
      tocar(this, 'cura')
    }
    this.atualizarCaidos()
    this.atualizarChefe()
    this.maos.forEach((m) => m.setAtiva(false))
    await this.sincronizarMaos()
    this.atualizarMontes()
    if (acelerou && !this.saindo) await this.avisarAceleracao()
    if (this.saindo) return
    if (eventos.some((e) => e.tipo === 'superChefe')) await this.anunciarSuperChefe()
    if (this.saindo) return
    await this.mostrarIntencao()
  }

  // O chefe joga UMA carta virada embaixo dele, com o naipe à vista: o ataque
  // dela vai no quadro, nos dois
  async mostrarIntencao() {
    const dados = this.estado.chefe.intencao
    if (!dados) return
    const cor = this.defChefe.tema.cor
    const { x, y } = INTENCAO
    const carta = new Carta(this, CHEFE.x, CHEFE.y, { ...dados }, { virada: true, largura: LARGURA_INTENCAO, cor }).setDepth(26).setScale(0.4)
    const sup = ehSuper(dados)
    const selo = this.add
      .text(x, y, sup ? '★' : SIMBOLOS[dados.naipe], {
        fontFamily: FONTE,
        fontSize: sup ? '22px' : '20px',
        color: sup ? '#ffd23c' : dados.naipe === 'copas' || dados.naipe === 'ouros' ? '#ff5a70' : '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(27)
      .setAlpha(0)
    const rotulo = this.add
      .text(ROTULO_INTENCAO.x, ROTULO_INTENCAO.y, sup ? 'SUPER!' : TIPOS_CHEFE[dados.naipe], {
        fontFamily: FONTE,
        fontSize: '9px',
        color: sup ? '#ff6a4a' : TEXTO.normal,
        stroke: '#000000',
        strokeThickness: 3,
        align: 'left',
      })
      .setOrigin(0, 0.5)
      .setDepth(27)
      .setAlpha(0)
    tocar(this, 'cartaArremessar')
    if (Math.random() < 0.6) this.falar(this.falaDaFase(), 1900)
    await this.tween({ targets: carta, x, y, scale: 1, rotation: 0, duration: 320, ease: 'Cubic.easeOut' })
    this.tweens.add({ targets: [selo, rotulo], alpha: 1, duration: 160 })
    if (sup) this.tweens.add({ targets: rotulo, scale: 1.25, duration: 260, yoyo: true, repeat: -1 })
    this.intencaoVisual = { carta, selo, rotulo }
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

  // SUPER do chefe: aviso grande antes da intenção
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
    this.etiquetaEm(LARGURA / 2, 268, 'O SUPER DO CHEFE VAI NO QUADRO DOS DOIS!', '#ff6a4a', { atraso: 250, tamanho: 12, ms: 1300 })
    await this.esperar(1900)
  }

  // ---------- escolha ----------

  escolha() {
    const fim = super.escolha()
    // quem está caído não joga: passa sozinho (sem som de PASSAR). Em rede o dono
    // daquele lado também manda o passar (o outro PC espera a jogada dele)
    for (const j of [0, 1]) {
      if (!this.estado.jogadores[j].caido || this.escolhas[j] !== undefined) continue
      this.escolhas[j] = null
      this.noPassar[j] = true
      this.botoesPassar[j].setEscolhido(true)
      if (this.rede?.meuLado === j) this.rede.enviarJogada(null)
    }
    this.atualizarEscolha()
    if (this.escolhas.every((e) => e !== undefined)) this.encerrarEscolha()
    return fim
  }

  atualizarEscolha() {
    super.atualizarEscolha()
    for (const j of [0, 1]) {
      if (!this.estado.jogadores[j].caido) continue
      this.maos[j].setAtiva(false)
      if (this.fase === 'escolha') this.status[j].setText('CAÍDO').setColor(TEXTO.caido)
    }
  }

  apertarA(j) {
    if (this.estado.jogadores[this.ladoDoControle(j)]?.caido) return
    super.apertarA(j)
  }

  apertarB(j) {
    if (this.estado.jogadores[this.ladoDoControle(j)]?.caido) return
    super.apertarB(j)
  }

  podeJogarAgora(j, id) {
    return podeJogarCoop(this.estado, j, id)
  }

  decidirJogadaCpu(j) {
    return escolherJogadaCoop(this.estado, j, { rng: this.rngBot })
  }

  // ---------- revelação ----------

  textosDoEfeitoCoop(r, j) {
    const jog = r.jogadas[j]
    const ef = r.efeitos[j]
    const lista = []
    if (jog.passou) {
      if (this.estado.jogadores[j].caido && !ef.levantou) return [['CAÍDO', TEXTO.caido]]
      lista.push(['PASSOU', TEXTO.desabilitado])
      if (ef.energia) lista.push([`+${ef.energia} ENERGIA`, '#7fd8ff'])
    } else {
      if (jog.super) lista.push(['★ SUPER! ★', '#ffe9a0'])
      if (NOMES_ESPECIAIS[jog.especial]) lista.push([NOMES_ESPECIAIS[jog.especial], '#ffe9a0'])
      const golpe = r.golpes[j]
      if (golpe) lista.push([`${NOMES_GOLPE[golpe.tipo] ?? 'GOLPE'} ${golpe.base}`, '#ffd23c'])
      if (ef.escudo) lista.push([`ESCUDO -${Math.round((1 - ef.escudo) * 100)}% (os dois)`, TEXTO.guarda])
      if (ef.energia) lista.push([`+${ef.energia} ENERGIA`, '#7fd8ff'])
      if (ef.compradas.length) lista.push([`+${ef.compradas.length} CARTA${ef.compradas.length > 1 ? 'S' : ''}`, TEXTO.normal])
    }
    if (ef.cura) lista.push([ef.levantou ? `LEVANTOU! +${ef.cura} HP` : `+${ef.cura} HP`, TEXTO.cura])
    return lista
  }

  async revelacao(r) {
    this.fase = 'revelacao'
    this.etiquetasMesa = []
    this.balao.esconder()
    this.atualizarEscolha()
    this.maos.forEach((m) => m.setAtiva(false))
    this.reveladas = [0, 1].map((j) => {
      const jog = r.jogadas[j]
      if (jog.passou) {
        const b = this.botoesPassar[j]
        b.setEscolhido(false)
        b.setFoco(false)
        return this.estado.jogadores[j].caido && !r.efeitos[j].levantou ? null : this.criarFichaPassar(j, b.c.x, b.c.y)
      }
      const mao = this.maos[j]
      const carta = mao.cartas.find((c) => c.dados.id === jog.carta.id)
      carta.focar(false)
      mao.retirar(carta)
      return carta.setDepth(80 + j)
    })
    this.maos.forEach((m) => m.setTravada(false))
    tocar(this, 'cartaDeslizar')
    await Promise.all(
      this.reveladas.map((c, j) => c && this.tween({ targets: c, x: MESA[j].x, y: MESA[j].y, rotation: 0, scaleX: ESCALA_MESA, scaleY: ESCALA_MESA, duration: 320, ease: 'Cubic.easeOut' })),
    )
    this.mostrarBanner('REVELAR!', TEXTO.selecionado, { y: 92 })
    await this.esperar(240)
    const v = this.intencaoVisual
    await Promise.all([
      ...this.reveladas.map((c) => (c instanceof Carta ? c.revelar() : c ? this.tween({ targets: c, scale: ESCALA_MESA * 1.15, duration: 110, yoyo: true }) : null)),
      v
        ? (() => {
            v.selo.setVisible(false)
            return v.carta.revelar().then(() => this.tween({ targets: v.carta, scale: 1.25, rotation: 0, duration: 160, ease: 'Back.easeOut' }))
          })()
        : null,
    ])

    // o que aconteceu com a carta do chefe (vale para os dois)
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

    // cada jogador: efeitos embaixo da carta, curas no placar
    for (const j of [0, 1]) {
      const carta = this.reveladas[j]
      const jog = r.jogadas[j]
      if (jog.especial && carta) {
        tocar(this, 'brilhoRank')
        particulas(this, carta.x, carta.y, { cor: 0xfff0a8, quantidade: 22, velocidade: 160 })
      }
      this.textosDoEfeitoCoop(r, j).forEach(([texto, cor], k) =>
        this.etiquetasMesa.push(this.etiquetaEm(MESA[j].x, MESA[j].y + 86 + k * 16, texto, cor, { atraso: 120 + k * 150, tamanho: 11, ms: 1600 })),
      )
      const ef = r.efeitos[j]
      const hud = this.huds[j]
      if (ef.cura) {
        tocar(this, 'cura')
        numero(this, hud.pontoHp.x, hud.pontoHp.y + 6, `+${ef.cura}`, TEXTO.cura, { tamanho: 16 })
      }
      if (ef.escudo) this.time.delayedCall(180, () => tocar(this, 'escudo'))
      if (ef.energia && !jog.passou) this.time.delayedCall(320, () => tocar(this, 'energia'))
      hud.setEscudo(r.quadro?.escudos[j] ?? this.estado.jogadores[j].escudo)
      hud.setProtegido(this.estado.jogadores[j].protegido)
    }
    // o chefe se curou (♥ dele)
    if (r.chefe.cura) {
      tocar(this, 'cura')
      numero(this, CHEFE.x, CHEFE.y - 70, `+${r.chefe.cura}`, TEXTO.cura, { tamanho: 18 })
      particulas(this, CHEFE.x, CHEFE.y, { cor: 0x7dff9a, quantidade: 20, velocidade: 120 })
    }
    if (r.chefe.guarda != null) this.etiquetasMesa.push(this.etiquetaEm(CHEFE.x, CHEFE.y + 4, 'GUARDA!', TEXTO.guarda, { atraso: 300, tamanho: 14, ms: 1300 }))
    this.atualizarHuds()
    this.atualizarCaidos()
    this.atualizarChefe()
    if (r.efeitos.some((ef) => ef.compradas.length)) {
      await this.esperar(400)
      await this.sincronizarMaos({ intervalo: 140 })
      this.atualizarMontes()
    }
    await this.esperar(1350)
  }

  // ---------- arremesso ----------

  async arremesso(r) {
    this.fase = 'arremesso'
    this.esconderBanner()
    for (const t of this.etiquetasMesa ?? []) if (t.scene) this.tweens.add({ targets: t, alpha: 0, duration: 150, onComplete: () => t.destroy() })
    this.etiquetasMesa = []

    // golpes: a carta fica carregando no canto de quem jogou; o resto sai da mesa
    for (const j of [0, 1]) {
      const carta = this.reveladas[j]
      if (!carta) continue
      if (r.golpes[j] && carta instanceof Carta) {
        this.armadas[j] = carta
        this.tween({ targets: carta, x: ARMADA[j].x, y: ARMADA[j].y, scaleX: ESCALA_ARMADA, scaleY: ESCALA_ARMADA, rotation: j ? 0.1 : -0.1, duration: 300, ease: 'Cubic.easeOut' })
        this.tweens.add({ targets: carta, y: ARMADA[j].y - 4, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 300 })
        carta.carga = this.add
          .text(ARMADA[j].x, ARMADA[j].y + 38, String(r.golpes[j].base), { fontFamily: FONTE, fontSize: '12px', color: '#ffd23c', stroke: '#000000', strokeThickness: 3 })
          .setOrigin(0.5)
          .setDepth(84)
      } else this.tirarDaMesa(carta)
    }
    this.reveladas = [null, null]

    const q = r.destino === 'quadro' ? r.quadro : null
    if (!q) {
      // a carta do chefe não vai para o quadro: roubada (vai para a energia de quem
      // roubou), refletida (volta nele) ou some (anulada, varrida)
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
    this.maos.forEach((m) => m.setPosicao({ y: MAO_FORA }))
    this.botoesPassar.forEach((b) => b.descer(true))
    this.status.forEach((s) => s.setText(''))
    this.montes.forEach((m) => this.tweens.add({ targets: [...m.cartas, m.texto], alpha: 0.25, duration: 200 }))
    tocar(this, 'caixaAbrir')
    await this.quadro.mostrar()
    if (this.saindo) return
    this.prepararCoracoes(q)
    const carta = this.limparIntencao({ manterCarta: true })
    if (carta) await carta.arremessar({ x: QUADRO.x, y: QUADRO.y }, { aoImpacto: () => this.impactoNoQuadro(q) })
    else this.impactoNoQuadro(q)
    await this.esperar(200)
  }

  // Quem está caído não está no quadro: o coração dele some. Sozinho, o
  // coração começa no meio; os dois, lado a lado
  prepararCoracoes(q) {
    const l = this.quadro.caixa.limites
    const sozinho = q.jogadores.filter(Boolean).length === 1
    this.quadro.coracoes.forEach((c, j) => {
      if (!q.jogadores[j]) return c.esconder()
      const p = sozinho ? { x: l.centerX, y: l.bottom - 30 } : inicioDoCoracao(l, j)
      c.mostrar(p.x, p.y)
    })
  }

  impactoNoQuadro(q) {
    const borda = this.quadro.caixa.retangulo
    borda.setStrokeStyle(6, CORES.selecionado ?? 0xffd23c)
    this.time.delayedCall(120, () => borda.scene && borda.setStrokeStyle(4, CORES.caixa))
    const extras = [q.lento ? 'ATRASADA' : null, q.inverter ? 'INVERTE!' : null].filter(Boolean).join(' · ')
    // o dano de cada um (com o escudo dele); igual nos dois, um número só
    const dentro = [0, 1].filter((j) => q.jogadores[j])
    const iguais = dentro.every((j) => q.danos[j] === q.danos[dentro[0]])
    const danos = iguais ? `${q.danos[dentro[0]]} de dano por acerto` : dentro.map((j) => `${this.rotulo(j)} ${q.danos[j]}`).join(' · ') + ' de dano por acerto'
    this.infoPista[0].setText(`${q.carta.nome}${extras ? ` · ${extras}` : ''} · ${danos}`).setColor(TEXTO.normal)
    for (const j of dentro) {
      if (q.escudos[j] == null) continue
      this.etiquetaEm(AVISO[j].x, AVISO[j].y - 22, `ESCUDO! -${Math.round((1 - q.escudos[j]) * 100)}%`, TEXTO.guarda, { tamanho: 11, ms: 1100 })
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
    this.perfeitoCoop = [false, false]
    this.esquivaBot?.reiniciar()
    const q = r.destino === 'quadro' ? r.quadro : null
    if (!q) return
    const ataque = ataqueDaCartaChefe(q.carta, { ataques })
    if (q.inverter) this.invertido[0] = { avisado: false }
    const base = this.ritmoBase
    const ritmo = { velocidade: base.velocidade * q.ritmo.velocidade, densidade: base.densidade * q.ritmo.densidade }
    // a mesma semente nos dois PCs (em rede): o mesmo ataque
    const promessa = this.quadro.rodar(ataque, { dano: q.dano, ritmo, semente: `${this.semente}:${this.estado.rodada}:quadro`, aceleracao: this.aceleracao })
    if (this.rede) {
      // o dano que o outro já mandou vale agora; termina quando o quadro acabou
      // aqui E o outro avisou que acabou o dele (aí já chegou todo dano/graze dele)
      this.rede.comecarLuta()
      await this.rede.esperarFimEsquiva([promessa])
    } else await promessa
    if (this.saindo) return
    // perfeitoCoop = CRÍTICO no contra-ataque (x1,5 fixo, o combo de perfeitos não mexe nele);
    // registrarPerfeitosNoQuadro = energia do perfeito x combo (festa da PvpArena)
    for (const j of [0, 1]) this.perfeitoCoop[j] = q.jogadores[j] && !this.acertosRodada[j] && !this.ko[j] && !this.estado.jogadores[j].caido
    const perfeitos = this.registrarPerfeitosNoQuadro(q)
    this.invertido = [0, 0]
    this.avisoPista.forEach((t) => t.setText(''))
    await this.esperar(250)
    if (this.saindo) return
    this.infoPista.forEach((t) => t.setText(''))
    tocar(this, 'caixaFechar')
    await this.quadro.esconder()
    if (this.saindo || !perfeitos.length) return
    await this.festejarPerfeitos(perfeitos)
  }

  // DESVIO PERFEITO de cada um no quadro: não levou acerto (e não caiu) num
  // ataque que dá energia (o fraquinho do ♥ não dá, mas o CRÍTICO vale)
  registrarPerfeitosNoQuadro(q) {
    const lista = []
    if (!energiaPerfeito(q.carta)) return lista
    for (const j of [0, 1]) {
      if (!this.perfeitoCoop[j]) continue
      const combo = registrarPerfeitoCombo(this.estado, j, q.carta)
      this.perfeitosRodada[j] = combo.ganho
      this.combosRodada[j] = combo.multiplicador
      this.estatisticas[j].perfeitos++
      this.estatisticas[j].maiorSequencia = Math.max(this.estatisticas[j].maiorSequencia ?? 0, combo.sequencia)
      lista.push({ pista: 0, dono: j, ...combo, ...FESTA[j] })
    }
    return lista
  }

  // Um frame do quadro: os dois corações andam juntos, cada um pelo seu
  // joystick (a CPU aliada pelo EsquivaBot). O ♦ Q/K do chefe inverte os dois
  atualizarPistas(delta) {
    const quadro = this.quadro
    const inv = this.invertido[0]
    const invertendo = Boolean(inv) && quadro.atacando
    if (invertendo) {
      if (!inv.avisado) {
        inv.avisado = true
        tocar(this, 'inverter')
      }
      const pisca = fatores().pulso > 1 || Math.floor(this.time.now / 180) % 2 ? 'CONTROLES\nINVERTIDOS!' : ''
      for (const j of [0, 1]) if (this.noQuadro(j) && !this.ko[j]) this.avisoPista[j].setText(pisca).setColor('#ff9a3a')
    } else if (inv?.avisado) {
      this.invertido[0] = 0
      for (const j of [0, 1]) if (!this.ko[j]) this.avisoPista[j].setText('')
    }
    const joys = [0, 1].map((j) => {
      const joy = j === this.cpu ? this.joyDaCpuNoQuadro(delta, invertendo) : this.controles.joy(j)
      return invertendo ? { x: -joy.x, y: -joy.y } : joy
    })
    quadro.atualizar(delta, (jogador) => joys[jogador] ?? { x: 0, y: 0 })
  }

  // joystick da CPU aliada no quadro (pvp/botEsquiva.js), no coração dela
  joyDaCpuNoQuadro(delta, invertido) {
    const quadro = this.quadro
    const coracao = quadro.coracoes[this.cpu]
    if (this.fase !== 'esquiva' || !quadro.rodando || !coracao?.ativo || this.ko[this.cpu]) return { x: 0, y: 0 }
    return this.esquivaBot.joy(delta, {
      coracao,
      limites: quadro.caixa.limites,
      balas: quadro.balas.lista,
      zonas: quadro.balas.zonas,
      velocidade: quadro.velocidadeCoracao,
      fatorVelocidade: quadro.balas.fatorVelocidade,
      velocidadeMax: quadro.balas.velocidadeMax,
      invertido,
    })
  }

  // Um acerto no coração do jogador j (o dano já vem com o escudo dele). Em
  // rede a PvpArena.acertou só deixa chegar aqui o coração daqui (e manda o dano
  // para o outro PC); o do outro chega pela rede e entra direto aqui
  aplicarAcerto(j, dano) {
    if (this.fase !== 'esquiva' || this.ko[j] || debug.invencivel) return false
    this.acertosRodada[j]++
    const sequenciaAntes = this.estado.jogadores[j].sequencia ?? 0
    const efetivo = aplicarDanoCoop(this.estado, j, dano) // também quebra o combo de perfeitos
    this.comboQuebrou(j, sequenciaAntes)
    const jog = this.estado.jogadores[j]
    this.estatisticas[j].danoRecebido += efetivo
    const hud = this.huds[j]
    hud.setHp(jog.hp)
    hud.tremer()
    const joystick = this.joystickDoLado(j)
    if (joystick >= 0) levouGolpe(joystick) // buzzer no joystick de quem levou
    numero(this, hud.pontoHp.x, hud.pontoHp.y + 4, efetivo ? `-${efetivo}` : '0', TEXTO.caido, { tamanho: 16, desvio: 12 })
    this.quadro.caixa.tremer(110, 2)
    this.personagemDoi(j)
    // a borda pisca na cor de quem levou (o quadro é dos dois)
    const borda = this.quadro.caixa.retangulo
    borda.setStrokeStyle(4, CORES.almas[j])
    this.time.delayedCall(140, () => borda.scene && borda.setStrokeStyle(4, CORES.caixa))
    if (jog.protegido && jog.hp === 1 && dano > 0) this.etiquetaEm(AVISO[j].x, AVISO[j].y - 22, 'SEGUNDA CHANCE:\nAGUENTA!', '#ffe9a0', { tamanho: 10, ms: 700 })
    if (jog.hp > 0 && jog.hp <= jog.hpMax * HP_BAIXO && !this.hpAvisado[j]) {
      this.hpAvisado[j] = true
      this.time.delayedCall(120, () => tocar(this, 'hpBaixo'))
    }
    if (jog.caido) this.nocaute(j)
    return true
  }

  // Caiu no meio da esquiva: o coração dele quebra e some do quadro e o golpe
  // que estava carregando se perde. O outro continua desviando; o quadro só
  // para quando não sobra ninguém nele
  nocaute(j) {
    this.ko[j] = true
    const coracao = this.coracaoDoLado(j)
    tocar(this, 'quebrar')
    flashTela(this, CORES.almas[j], 0.3, 220)
    this.quadro.caixa.tremer(260, 4)
    if (coracao?.ativo) particulas(this, coracao.x, coracao.y, { cor: CORES.almas[j], quantidade: 30, velocidade: 220, vida: 700 })
    coracao?.esconder()
    this.avisoPista[j].setText('CAIU!').setColor(TEXTO.caido).setFontSize(20)
    this.atualizarCaidos()
    const armada = this.armadas[j]
    if (armada) {
      armada.setIndisponivel?.(true)
      armada.carga?.setText('PERDIDO').setColor(TEXTO.caido)
    }
    const q = this.rodadaAtual?.quadro
    if (!q || [0, 1].every((k) => !q.jogadores[k] || this.ko[k])) this.time.delayedCall(700, () => this.quadro.parar())
  }

  // graze (daqui, ou do outro PC pela rede): energia (PvpArena) e a ♣ carregando
  aplicarGraze(j) {
    if (!super.aplicarGraze(j)) return false
    const armada = this.armadas[j]
    const jog = this.estado.jogadores[j]
    if (!armada?.carga || jog.caido || armada.dados.naipe !== 'paus' || armada.dados.valor === 1) return true
    const bonus = Math.min(COOP.grazeArmadilhaMax, this.grazesRodada[j] * COOP.grazeArmadilha)
    armada.carga.setText(`${armada.carga.text.split(' ')[0]} +${Math.round(bonus * 100)}%`)
    return true
  }

  // ---------- contra-ataque ----------

  // Os golpes da rodada: o host calcula (em rede manda para o convidado, com o combo)
  async golpesDaRodada(r) {
    if (this.rede && !this.rede.souHost) return this.rede.receberContra()
    const desempenho = [0, 1].map((j) => ({ perfeito: this.perfeitoCoop?.[j], grazes: this.grazesRodada[j] }))
    const golpes = calcularGolpes(this.estado, r.golpes, desempenho)
    const combo = comboDosGolpes(r.golpes.map((g, j) => (this.estado.jogadores[j].caido ? null : g)))
    this.rede?.enviarContra(golpes, combo)
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
        this.mostrarBanner(combo === 'par' ? 'PAR!  x1.5' : 'COMBO!  x1.25', '#ffd23c', { y: 236, tamanho: 30, ms: 900 })
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
    // sobrou alguma (o chefe caiu antes): some
    this.armadas.forEach((c) => {
      if (!c) return
      c.carga?.destroy()
      this.tirarDaMesa(c)
    })
    this.armadas = [null, null]
    await this.esperar(400)
  }

  mostrarMultiplicadores(g) {
    g.multiplicadores.forEach(([nome, fator], k) =>
      this.etiquetaEm(ARMADA[g.j].x, ARMADA[g.j].y + 56 + k * 15, `${nome} x${Number(fator.toFixed(2))}`, nome === 'GUARDA' ? TEXTO.guarda : '#ffd23c', { tamanho: 11, ms: 700 }),
    )
  }

  // Os dois jogaram SUPER: as duas cartas voam juntas, os dois efeitos
  // acontecem ao mesmo tempo em cima do chefe e fecham com uma explosão arco-íris
  async superCombo(lista) {
    this.combos++
    tocar(this, 'superAtivar')
    flashTela(this, 0xffffff, 0.5, 260)
    shake(this, 300, 0.012)
    this.mostrarBanner(`SUPER COMBO!!  ${Math.round(fracaoDoCombo(this.estado.nivel) * 100)}% DO HP`, '#ffe9a0', { y: 236, tamanho: 34, ms: 1300 })
    const arco = [0xff4a5a, 0xffa23a, 0xffe14a, 0x5ae06a, 0x4ab8ff, 0xa66bff]
    arco.forEach((cor, k) => this.time.delayedCall(k * 110, () => this.banner.setColor(corTexto(cor))))
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
        await superNoChefe(this, carta.dados.personagem, () => {
          total.dano += g.dano
          this.golpeNoChefe(g)
        })
      }),
    )
    if (this.saindo) return
    // o final: a explosão das duas forças juntas
    tocar(this, 'estouro')
    flashTela(this, 0xffffff, 0.7, 320)
    shake(this, 520, 0.03)
    arco.forEach((cor, k) => this.time.delayedCall(k * 60, () => particulas(this, CHEFE.x, CHEFE.y, { cor, quantidade: 22, velocidade: 360, vida: 800, escala: 1.8 })))
    numero(this, CHEFE.x, CHEFE.y - 90, `${total.dano}!!`, '#ffe9a0', { tamanho: 34 })
    this.inimigo.dano(1)
    if (lista.some((g) => g.limitado)) this.chefeAguentou()
    await this.esperar(900)
  }

  // O SUPER bateu no limite (limiteDoSuper): o chefe aguentou de pé
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
    numero(this, CHEFE.x + (g.j ? 16 : -16), CHEFE.y - 40, String(g.dano), forte ? '#ffd23c' : '#ffffff', { tamanho, desvio: 10 })
    particulas(this, CHEFE.x, CHEFE.y, { cor: CORES.almas[g.j], quantidade: forte ? 30 : 14, velocidade: forte ? 240 : 150 })
    shake(this, forte ? 220 : 110, forte ? 0.012 : 0.006)
    if (forte) flashTela(this, 0xffffff, 0.25, 160)
    this.atualizarChefe()
  }

  // ---------- fim da rodada ----------

  async terminarRodada() {
    this.fase = 'fim'
    this.voltarDaMusicaEspecial()
    // em rede o host decide (fase nova, vitória, derrota) e manda o estado
    const fim = this.rede ? await this.rede.fimDaRodada() : fimDaRodadaCoop(this.estado)
    if (this.saindo || !fim) return null
    const { vencedor, novaFase } = fim
    this.huds.forEach((hud, j) => {
      hud.setProtegido(false)
      hud.setEscudo(this.estado.jogadores[j].escudo)
    })
    this.atualizarHuds()
    this.atualizarChefe()
    this.atualizarCaidos()
    this.avisoPista.forEach((t) => t.setText('').setFontSize(12))
    if (vencedor) return vencedor
    if (novaFase != null) await this.trocarFase(novaFase)
    this.estado.jogadores.forEach((jog, j) => jog.hp > jog.hpMax * HP_BAIXO && (this.hpAvisado[j] = false))
    tocar(this, 'cartaDeslizar')
    this.maos.forEach((m, j) => m.setPosicao({ y: MAOS[j].y }))
    this.botoesPassar.forEach((b) => b.descer(false))
    this.montes.forEach((m) => this.tweens.add({ targets: [...m.cartas, m.texto], alpha: 1, duration: 200 }))
    await this.esperar(300)
    return null
  }

  // retomada (2D) numa fase do chefe depois da primeira: o fundo já na velocidade dela
  mostrarFaseRetomada() {
    const f = this.estado.chefe?.fase ?? 0
    if (!f) return
    const fase = this.defChefe.fases[f] ?? {}
    this.fundo?.setFase(f, fase.velocidadeFundo ?? 1 + f * 0.25)
  }

  // Fase nova: o chefe fica mais bravo, o fundo acelera e o baralho dele muda
  async trocarFase(f) {
    const fase = this.defChefe.fases[f] ?? {}
    this.fundo.setFase(f, fase.velocidadeFundo ?? 1 + f * 0.25)
    tocar(this, 'tensao')
    flashTela(this, this.defChefe.tema.cor, 0.3, 300)
    shake(this, 420, 0.012)
    this.inimigo.dano(0.8)
    this.mostrarBanner(`FASE ${f + 1}!`, corTexto(this.defChefe.tema.cor), { y: 236, tamanho: 30, ms: 1500 })
    this.etiquetaEm(LARGURA / 2, 268, 'cartas novas no baralho do chefe', TEXTO.normal, {
      atraso: 250,
      tamanho: 11,
      ms: 1400,
    })
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
    // em rede o host abre a tela do fim nos dois (depois da animação do convidado
    // acabar); o convidado avisa e fica aqui até a cena trocar
    if (this.rede && !(await this.rede.prontoParaResultado())) return
    if (this.saindo) return
    this.saindo = true
    this.cameras.main.fadeOut(400, 0, 0, 0)
    await new Promise((r) => this.time.delayedCall(420, r))
    const chave = vencedor === 'vitoria' ? 'Vitoria' : 'GameOver'
    // (o host recebeu o dano e os grazes dos dois: as estatísticas dele valem)
    if (this.rede) irParaCena(this, chave, dados)
    else this.scene.start(chave, dados)
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
      maiorSequencia: Math.max(...this.estatisticas.map((e) => e.maiorSequencia ?? 0)), // combo de perfeitos
      grazes: soma('grazes'),
      tempoMs: Math.max(0, this.time.now - this.inicioLuta),
      turnos: this.estado.rodada,
      nivel: this.idNivel,
      hpMaxParty: this.estado.jogadores.reduce((t, j) => t + j.hpMax, 0),
      caidosNoFim: this.estado.jogadores.filter((j) => j.caido).length,
    }
  }

  // ---------- pause ----------

  podePausar() {
    return ['inicio', 'escolha', 'revelacao', 'arremesso', 'esquiva', 'contra'].includes(this.fase) && !this.saindo && !this.pausado && !this.rede
  }

  pausar(motivo) {
    if (!this.podePausar() || this.time.now - this.retomadoEm < 200) return
    this.pausado = true
    this.scene.pause()
    pausarMusica()
    this.scene.launch('Pausa', {
      cena: 'CoopArena',
      nome: this.defChefe.nome,
      // a party vai junto: sem ela o Phaser repetiria os dados da última abertura da cena
      recomecar: { chefe: this.idChefe, nivel: this.idNivel, party: [...this.ids] },
      sair: 'Selecao',
      motivo,
    })
    this.scene.bringToTop('Pausa')
  }

  // ---------- frame ----------

  update(time, deltaReal) {
    super.update(time, deltaReal)
    const delta = deltaReal * debug.acelerar
    this.fundo.atualizar(delta)
    this.balao.atualizar(delta)
  }

  // ---------- testes (dev) ----------

  setHpChefe(hp) {
    this.rede?.espalhar('setHpChefe', [hp]) // em rede vale nos dois PCs
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
      cpu: this.cpu,
      rede: this.rede ? { meuLado: this.rede.meuLado, souHost: this.rede.souHost, espelhos: q.coracoes.map((x) => Boolean(x.espelho)) } : null,
      escolhas: this.escolhas.map((e) => (e === undefined ? 'escolhendo' : e)),
      vencedor: this.estado.vencedor,
      chefe: { id: c.id, hp: c.hp, hpMax: c.hpMax, fase: c.fase, carga: c.carga, guarda: c.guarda, intencao: c.intencao?.id ?? null },
      quadro: {
        rodando: q.ataque?.nome ?? null,
        aberta: q.aberta,
        balas: q.balas.lista.length,
        carta: r?.quadro?.carta.id ?? null,
        destino: r?.destino ?? null,
        jogadores: r?.quadro ? [...r.quadro.jogadores] : [false, false],
        danos: r?.quadro ? [...r.quadro.danos] : [null, null],
        limites: { x: Math.round(q.caixa.limites.x), y: Math.round(q.caixa.limites.y), largura: Math.round(q.caixa.limites.width), altura: Math.round(q.caixa.limites.height) },
      },
      jogadores: this.estado.jogadores.map((jog, j) => {
        const cor = q.coracoes[j]
        return {
          personagem: jog.personagem,
          hp: jog.hp,
          hpMax: jog.hpMax,
          energia: jog.energia,
          escudo: jog.escudo,
          sequencia: jog.sequencia ?? 0,
          caido: jog.caido,
          mao: jog.baralho.mao.map((x) => x.id),
          coracao: { x: Math.round(cor.x), y: Math.round(cor.y), ativo: cor.ativo },
        }
      }),
      armadas: this.armadas.map((x) => x?.dados.id ?? null),
      perfeitos: [...this.perfeitosRodada],
      combos: [...this.combosRodada],
      acertosRodada: [...this.acertosRodada],
      grazesRodada: [...this.grazesRodada],
      estatisticas: this.resumo(),
    }
  }
}
