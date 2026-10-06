import Phaser from 'phaser'
import { LARGURA, FONTE, CORES } from '../constants.js'
import Controles from '../controles.js'
import Pista from '../pvp/Pista.js'
import { ataques } from '../attacks/index.js'
import { CHEFES } from '../coop/chefes/index.js'
import { debug } from '../debug.js'

// Protótipo do modo PvP (cena de teste, sem fluxo de jogo): duas pistas
// lado a lado, cada jogador desvia na sua. Os ataques são fixos e diferentes
// em cada lado, e mudam a forma de cada caixa de jeito independente. A rodada
// se repete; o HP volta a 100 quando zera.
//
// No console (modo dev): debugJogo.jogo.scene.start('PvpArenaTeste')
// Com 1 jogador no painel, os controles do P1 movem os dois corações.

const HP_MAX = 100
const PISTA = { largura: 260, altura: 180, y: 200 }
const CENTROS = [LARGURA / 4 + 5, (LARGURA * 3) / 4 - 5]
const DANO = 8
// região de cada pista: a caixa muda de forma sem invadir a metade da outra
const CAMPOS = [
  { esquerda: 8, direita: LARGURA / 2 - 8, topo: 64, base: 330 },
  { esquerda: LARGURA / 2 + 8, direita: LARGURA - 8, topo: 64, base: 330 },
]

// O que cada pista recebe a cada rodada (P1 desvia do ataque "do P2" e vice-versa)
const RODADAS = [
  [() => ataques.sequencia(ataques.rain({ duracao: 3500 }), ataques.sides({ duracao: 3500 })), () => ataques.sequencia(ataques.aimed({ duracao: 3500 }), ataques.spiral({ duracao: 3500 }))],
  [() => ataques.sequencia(ataques.sides({ duracao: 3500 }), ataques.colunas({ duracao: 3500 })), () => ataques.sequencia(ataques.caminhonete({ duracao: 3500 }), ataques.rain({ duracao: 3500 }))],
]

export default class PvpArenaTeste extends Phaser.Scene {
  constructor() {
    super('PvpArenaTeste')
  }

  create() {
    this.controles = new Controles(this)
    this.rodada = 0
    this.saindo = false

    this.add.text(LARGURA / 2, 22, 'ARENA PvP (teste)', { fontFamily: FONTE, fontSize: '18px' }).setOrigin(0.5)
    this.textoRodada = this.add.text(LARGURA / 2, 44, '', { fontFamily: FONTE, fontSize: '12px', color: '#888888' }).setOrigin(0.5)

    const temas = [CHEFES.king.tema, CHEFES.coronel.tema]
    this.jogadores = CENTROS.map((x, j) => {
      const pista = new Pista(this, { x, y: PISTA.y, largura: PISTA.largura, altura: PISTA.altura, jogador: j, cor: CORES.almas[j], tema: temas[j], velocidadeMax: 260, dinamica: { campo: CAMPOS[j] } })
      const rotulo = this.add.text(x, 352, '', { fontFamily: FONTE, fontSize: '16px', color: j ? '#ffd23a' : '#ff2030' }).setOrigin(0.5, 0)
      const fundoBarra = this.add.rectangle(x, 380, 160, 10, 0x401010).setOrigin(0.5, 0)
      const barra = this.add.rectangle(x - 80, 380, 160, 10, CORES.almas[j]).setOrigin(0, 0)
      const jogador = { j, pista, rotulo, fundoBarra, barra, hp: HP_MAX, acertos: 0, grazes: 0 }
      pista.aoAcertar = (dano) => {
        jogador.hp = Math.max(0, jogador.hp - dano)
        jogador.acertos++
        this.atualizarRotulos()
      }
      pista.aoGraze = () => jogador.grazes++
      return jogador
    })
    this.atualizarRotulos()

    if (import.meta.env.DEV) window.arenaPvp = this // inspeção nos testes
    this.events.once('shutdown', () => {
      this.saindo = true
      this.jogadores.forEach((jg) => jg.pista.destruir())
      if (window.arenaPvp === this) delete window.arenaPvp
    })

    this.loop()
  }

  async loop() {
    await Promise.all(this.jogadores.map((jg) => jg.pista.mostrar()))
    while (!this.saindo) {
      const lados = RODADAS[this.rodada % RODADAS.length]
      this.rodada++
      this.textoRodada.setText(`rodada ${this.rodada}`)
      await Promise.all(this.jogadores.map((jg, k) => jg.pista.rodar(lados[k](), { dano: DANO, semente: `pvp:${this.rodada}:${k}` })))
      if (this.saindo) return
      for (const jg of this.jogadores) if (jg.hp <= 0) jg.hp = HP_MAX
      this.atualizarRotulos()
    }
  }

  atualizarRotulos() {
    for (const jg of this.jogadores) {
      jg.rotulo.setText(`P${jg.j + 1}  HP ${jg.hp}/${HP_MAX}`)
      jg.barra.width = (160 * jg.hp) / HP_MAX
    }
  }

  update(_, deltaReal) {
    const delta = deltaReal * debug.acelerar
    this.tweens.timeScale = debug.acelerar
    for (const jg of this.jogadores) jg.pista.atualizar(delta, this.controles.joy(jg.j))
  }

  // estado resumido para os testes automáticos
  estadoDebug() {
    return {
      rodada: this.rodada,
      jogadores: this.jogadores.map((jg) => {
        const l = jg.pista.caixa.limites
        return {
          hp: jg.hp,
          acertos: jg.acertos,
          grazes: jg.grazes,
          rodando: jg.pista.ataque?.nome ?? null,
          caixa: { x: l.x, y: l.y, largura: l.width, altura: l.height, emTransicao: jg.pista.caixa.emTransicao },
          balas: jg.pista.balas.lista.length,
          coracao: { x: Math.round(jg.pista.coracoes[0].x), y: Math.round(jg.pista.coracoes[0].y) },
        }
      }),
    }
  }
}
