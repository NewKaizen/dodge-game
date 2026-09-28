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
