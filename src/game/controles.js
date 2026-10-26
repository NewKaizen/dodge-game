import Phaser from 'phaser'
import { partidaOnline } from './online.js'
import { emRede, meuLado } from './rede.js'

const LIMIAR = 50 // quanto o joystick precisa inclinar para contar como direção nos menus

// Quem quer os botões A/B antes das cenas (o aviso de convite de amigo, que se
// aceita com A e se recusa com B por cima de qualquer menu): interceptarBotao(fn)
// com fn(botao, jogador) -> true se tratou (a cena nem fica sabendo). Várias
// cenas ouvem o mesmo evento: o que já foi tratado não é tratado de novo.
const interceptadores = new Set()
const tratados = new WeakSet()
export function interceptarBotao(fn) {
  interceptadores.add(fn)
  return () => interceptadores.delete(fn)
}
function interceptado(evento) {
  if (tratados.has(evento)) return true
  for (const fn of interceptadores) {
    if (!fn(evento.botao, evento.jogador)) continue
    tratados.add(evento)
    return true
  }
  return false
}

// Entrada dos jogadores dentro do Phaser (os dados chegam pela bridge).
// Em modo 1 jogador, todos os controles comandam o jogador 1.
// Partida EM REDE (game/rede.js): são sempre 2 jogadores e todos os controles
// daqui comandam o MEU lado (meuLado(): 0 no host, 1 no convidado); o outro
// lado não tem controle aqui (joy zerado, sem botões): o que ele faz chega
// pelo canal da partida.
export default class Controles {
  constructor(scene) {
    this.scene = scene
    this.numJogadores = emRede() ? 2 : scene.registry.get('numJogadores') ?? 1
    this.ouvintes = []
    this.ouvintesPausa = []
    this.anterior = []
    this.toques = []

    const aoBotao = (evento) => {
      const { jogador, botao } = evento
      if (botao !== 'C' && typeof evento === 'object' && interceptado(evento)) return
      // o botão de pause vale para qualquer jogador (na partida online não tem pausa)
      if (botao === 'C') return partidaOnline() || emRede() ? undefined : this.ouvintesPausa.forEach((fn) => fn(jogador))
      const j = emRede() ? meuLado() : this.numJogadores === 1 ? 0 : jogador
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
    const rede = emRede()
    if (rede && jogador !== meuLado()) return { x: 0, y: 0 }
    const usados = this.numJogadores === 1 || rede ? controles : [controles[jogador]].filter(Boolean)
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
