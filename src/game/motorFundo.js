import { TIQUE_MS } from '../lib/relogioFundo.js'

// O MOTOR DE FUNDO (game/segundoPlano.js): com a aba escondida o requestAnimationFrame para e o Phaser
// fica sem passos; o tique do relógio de fundo (lib/relogioFundo.js) dá o passo no lugar dele. Lógica
// pura (testada em __tests__/motorFundo.test.js):
//   const motor = criarMotor({ passo(t, delta), manter() })
//   motor.marcar(t)   o Phaser deu um passo agora (o requestAnimationFrame, ou o nosso)
//   motor.tique(t)    o tique: dá um passo se o Phaser está parado há LIMIAR_MS (com o rAF rodando não
//                     faz nada: nunca dois passos no mesmo quadro). delta = o tempo desde o último passo,
//                     no máximo MAX_DELTA_MS (um tique atrasado não vira um pulo: o jogo só fica um pouco
//                     mais lento, nunca mais rápido que o relógio de verdade). Devolve se deu o passo
export const LIMIAR_MS = 45 // sem passo do Phaser há mais que isto (o rAF parou): o tique dá um
export const MAX_DELTA_MS = 100 // um tique atrasado não vira um pulo grande (balas atravessando)

export function criarMotor({ passo, manter = () => true }) {
  let ultimoQuadro = null // o último passo do requestAnimationFrame
  let ultimoPasso = null // o último passo de qualquer um (o delta conta daqui)
  let passando = false // o passo é nosso: o POST_STEP dele não conta como quadro do rAF
  let erros = 0
  return {
    marcar(t) {
      ultimoPasso = t
      if (!passando) ultimoQuadro = t
    },
    tique(t) {
      if (!manter()) return false
      if (ultimoQuadro != null && t - ultimoQuadro < LIMIAR_MS) return false
      const delta = ultimoPasso == null ? TIQUE_MS : Math.min(MAX_DELTA_MS, Math.max(0, t - ultimoPasso))
      ultimoPasso = t
      passando = true
      try {
        passo(t, delta)
      } catch (e) {
        if (erros++ < 3) console.error('[segundo plano] o passo do jogo falhou', e)
      } finally {
        passando = false
      }
      return true
    },
  }
}
