import Phaser from 'phaser'

const LIMIAR = 50 // quanto o joystick precisa inclinar para contar como direção nos menus

// Entrada dos jogadores dentro do Phaser (os dados chegam pela bridge).
// Em modo 1 jogador, todos os controles comandam o jogador 1.
export default class Controles {
  constructor(scene) {
    this.scene = scene
    this.numJogadores = scene.registry.get('numJogadores') ?? 1
    this.ouvintes = []
    this.ouvintesPausa = []
    this.anterior = []
    this.toques = []

    const aoBotao = ({ jogador, botao }) => {
      // o botão de pause vale para qualquer jogador
      if (botao === 'C') return this.ouvintesPausa.forEach((fn) => fn(jogador))
      const j = this.numJogadores === 1 ? 0 : jogador
      if (j >= this.numJogadores) return
      this.ouvintes.forEach((fn) => fn(j, botao))
    }
    scene.game.events.on('botao', aoBotao)
    scene.events.once('shutdown', () => scene.game.events.off('botao', aoBotao))
  }

  // fn(jogador, 'A' | 'B')
  onBotao(fn) {
    this.ouvintes.push(fn)
  }

  // fn(jogador): botão de pause (C no teclado / BTN C no joystick)
  onPausa(fn) {
    this.ouvintesPausa.push(fn)
  }

  // Direção analógica do jogador, -100..100 em cada eixo
  joy(jogador) {
    const controles = this.scene.registry.get('jogadores') ?? []
    const usados = this.numJogadores === 1 ? controles : [controles[jogador]].filter(Boolean)
    const x = usados.reduce((soma, c) => soma + c.joy.x, 0)
    const y = usados.reduce((soma, c) => soma + c.joy.y, 0)
    return { x: Phaser.Math.Clamp(x, -100, 100), y: Phaser.Math.Clamp(y, -100, 100) }
  }

  // Chamar uma vez por frame: detecta as direções recém-apertadas (para menus)
  atualizar() {
    for (let j = 0; j < this.numJogadores; j++) {
      const { x, y } = this.joy(j)
      let direcao = null
      if (Math.max(Math.abs(x), Math.abs(y)) >= LIMIAR) {
        if (Math.abs(x) > Math.abs(y)) direcao = x > 0 ? 'direita' : 'esquerda'
        else direcao = y > 0 ? 'baixo' : 'cima'
      }
      this.toques[j] = direcao !== this.anterior[j] ? direcao : null
      this.anterior[j] = direcao
    }
  }

  // 'cima' | 'baixo' | 'esquerda' | 'direita' | null
  toque(jogador) {
    return this.toques[jogador] ?? null
  }
}
