import Phaser from 'phaser'
import Controles, { interceptarBotao } from '../controles.js'
import { criarRoletaBau } from '../conta/roletaBau.js'

// O POP-UP "VOCÊ GANHOU UM BAÚ!" (docs/baus.md): uma cena transparente por cima do menu ou da tela de
// resultado onde o jogador está. Quem a abre (e pausa a cena de baixo) é conta/popupBau.js; ela só hospeda a
// roleta (conta/roletaBau.js): ABRIR AGORA gira ali mesmo, sem trocar de tela; DEPOIS fecha e o baú fica na
// aba BAÚS. Enquanto está aberta, os botões A/B/C são dela (interceptarBotao) e a cena de baixo fica parada.
//
//   game.scene.run('BauPopup', { fontes, fechados, aoAbrir, aoDepois, aoFechar })
const estadoInicial = () => ({
  roleta: null,
  controles: null,
  desligarBotoes: null,
  dados: null,
})

export default class BauPopup extends Phaser.Scene {
  constructor() {
    super('BauPopup')
  }

  init(dados) {
    Object.assign(this, estadoInicial())
    this.dados = dados ?? {}
  }

  create() {
    const d = this.dados
    this.controles = new Controles(this)
    // os botões (A, B e C) vão para a roleta e a cena de baixo nem fica sabendo
    this.desligarBotoes = interceptarBotao((botao) => {
      if (!this.roleta) return false
      this.roleta.botao(botao)
      return true
    })
    this.roleta = criarRoletaBau(this, {
      popup: true,
      fontes: d.fontes ?? [],
      fechados: d.fechados ?? 0,
      aoAbrir: () => d.aoAbrir?.(),
      aoDepois: () => d.aoDepois?.(),
      aoFechar: (info) => {
        this.roleta = null
        d.aoFechar?.(info)
      },
    })
    this.events.once('shutdown', () => {
      this.desligarBotoes?.()
      this.desligarBotoes = null
      this.roleta?.destruir()
      this.roleta = null
    })
  }

  update() {
    if (!this.roleta) return
    this.controles.atualizar()
    for (let j = 0; j < this.controles.numJogadores; j++) {
      const direcao = this.controles.toque(j)
      if (direcao) this.roleta.direcao(direcao)
    }
  }
}
