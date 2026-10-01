import { ALTURA, LARGURA } from '../constants.js'
import { ignorarNasCaixas } from '../recorte.js'

// Flash colorido rápido sobre a tela toda (dano recebido). Fica atrás da
// caixa de batalha: balas e coração continuam legíveis por cima.
export function flashTela(scene, cor = 0xff2030, alpha = 0.32, duracao = 170) {
  const cobertura = scene.add.rectangle(0, 0, LARGURA, ALTURA, cor, alpha).setOrigin(0).setDepth(90)
  ignorarNasCaixas(scene, cobertura)
  scene.tweens.add({ targets: cobertura, alpha: 0, duration: duracao, ease: 'Quad.easeOut', onComplete: () => cobertura.destroy() })
  return cobertura
}

// Pisca o objeto ao levar dano
export function flash(scene, alvo, duracao = 1000) {
  scene.tweens.add({
    targets: alvo,
    alpha: 0.2,
    duration: 100,
    yoyo: true,
    repeat: Math.max(0, Math.floor(duracao / 200) - 1),
    onComplete: () => alvo.setAlpha(1),
  })
}
