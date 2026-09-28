import { FONTE, TEXTO } from '../constants.js'

// Número flutuante (dano, cura, MISS...) que pula, sobe e some
export function numero(scene, x, y, texto, cor = TEXTO.dano) {
  const t = scene.add
    .text(x, y, texto, { fontFamily: FONTE, fontSize: '20px', color: cor, stroke: '#000000', strokeThickness: 4 })
    .setOrigin(0.5)
    .setDepth(30)
    .setScale(0.4)
  scene.cameraCaixa?.ignore(t)
  scene.tweens.add({ targets: t, scale: 1, duration: 120, ease: 'Back.easeOut' })
  scene.tweens.add({
    targets: t,
    y: y - 34,
    alpha: 0,
    delay: 350,
    duration: 700,
    ease: 'Cubic.easeIn',
    onComplete: () => t.destroy(),
  })
}
