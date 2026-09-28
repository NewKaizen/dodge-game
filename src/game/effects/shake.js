// Tremor de tela (em todas as câmeras, inclusive a da caixa)
export function shake(scene, duracao = 150, intensidade = 0.01) {
  scene.cameras.cameras.forEach((camera) => camera.shake(duracao, intensidade))
}
