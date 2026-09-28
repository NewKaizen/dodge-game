// Explosão de faíscas (acertos, graze, cura...)
export function particulas(scene, x, y, { cor = 0xffffff, quantidade = 10, velocidade = 120, vida = 450, escala = 1 } = {}) {
  const emissor = scene.add.particles(x, y, 'faisca', {
    speed: { min: velocidade * 0.35, max: velocidade },
    angle: { min: 0, max: 360 },
    lifespan: vida,
    scale: { start: escala, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: cor,
    blendMode: 'ADD',
    emitting: false,
  })
  emissor.setDepth(25)
  scene.cameraCaixa?.ignore(emissor)
  emissor.explode(quantidade)
  scene.time.delayedCall(vida + 200, () => emissor.destroy())
}
