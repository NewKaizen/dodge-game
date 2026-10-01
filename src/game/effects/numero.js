import { FONTE, TEXTO } from '../constants.js'
import { ignorarNasCaixas } from '../recorte.js'

// Número flutuante (dano, cura, MISS...) que pula, sobe e some.
//   tamanho  fonte em px (padrão 20)
//   pop      escala máxima do salto de entrada (1 = sem exagero; crítico usa mais)
//   desvio   sorteia um deslocamento em x de até ±desvio px (golpes seguidos não se sobrepõem)
export function numero(scene, x, y, texto, cor = TEXTO.dano, { tamanho = 20, pop = 1, desvio = 0 } = {}) {
  x += desvio ? Math.round((Math.random() * 2 - 1) * desvio) : 0
  const t = scene.add
    .text(x, y, texto, { fontFamily: FONTE, fontSize: `${tamanho}px`, color: cor, stroke: '#000000', strokeThickness: 4 })
    .setOrigin(0.5)
    .setDepth(30)
    .setScale(0.4)
  ignorarNasCaixas(scene, t)
  scene.tweens.add({ targets: t, scale: pop, duration: 120, ease: 'Back.easeOut' })
  if (pop > 1) scene.tweens.add({ targets: t, scale: 1, delay: 120, duration: 140, ease: 'Sine.easeInOut' })
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
