import { ALTURA, LARGURA } from '../constants.js'
import { ignorarNasCaixas } from '../recorte.js'
import { fatores } from '../acessibilidade.js'

// Clarões passam TODOS por aqui: sem "clarões" (preferência flashes) não há
// clarão nenhum; com "reduzir animações" ficam bem fracos (acessibilidade.js).
//
//   flashTela(cena, cor, alpha, ms)          retângulo sobre a tela (atrás das caixas)
//   claraoCamera(camera, ms, r, g, b)        no lugar de camera.flash(ms, r, g, b)

// Flash colorido rápido sobre a tela toda (dano recebido). Fica atrás da
// caixa de batalha: balas e coração continuam legíveis por cima. Sempre
// devolve o retângulo (quem chama pode mudar a profundidade), mesmo apagado.
export function flashTela(scene, cor = 0xff2030, alpha = 0.32, duracao = 170) {
  const f = fatores().clarao
  const cobertura = scene.add.rectangle(0, 0, LARGURA, ALTURA, cor, alpha * f).setOrigin(0).setDepth(90)
  ignorarNasCaixas(scene, cobertura)
  if (f <= 0) cobertura.setVisible(false) // sem clarões: existe (quem chama mexe nele), mas não aparece
  scene.tweens.add({ targets: cobertura, alpha: 0, duration: duracao, ease: 'Quad.easeOut', onComplete: () => cobertura.destroy() })
  return cobertura
}

// Clarão da câmera (o efeito flash do Phaser), com o alpha da preferência
export function claraoCamera(camera, duracao = 160, r = 255, g = 255, b = 255) {
  const f = fatores().clarao
  if (!camera || f <= 0) return
  if (camera.flashEffect) camera.flashEffect.alpha = f
  camera.flash(duracao, r, g, b)
}

// Fade da câmera para BRANCO (a saída do menu para a luta): é um clarão de tela
// inteira, então segue "clarões": com eles desligados (ou "reduzir animações") sai
// para o PRETO, como as outras transições.
export function fadeParaBranco(camera, duracao = 200) {
  if (!camera) return
  if (fatores().clarao >= 1) camera.fadeOut(duracao, 255, 255, 255)
  else camera.fadeOut(Math.max(duracao, 260), 0, 0, 0)
}

// Fator de alpha dos clarões feitos à mão (retângulos/imagens que piscam branco)
export const alphaClarao = (alpha) => alpha * fatores().clarao

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
