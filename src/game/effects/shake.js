import { fatores } from '../acessibilidade.js'

// Tremores passam TODOS por aqui (ou por BattleBox.tremer, que usa o mesmo
// fator): a preferência de tremor / "reduzir animações" (acessibilidade.js)
// diminui a intensidade (reduzido ~40%) ou desliga de vez.
//
//   shake(cena, ms, intensidade)                     a tela toda (todas as câmeras)
//   tremerCamera(camera, ms, intensidade, forcar)    uma câmera só (no lugar de camera.shake)

// Tremor de tela (em todas as câmeras, inclusive a da caixa)
export function shake(scene, duracao = 150, intensidade = 0.01) {
  scene.cameras.cameras.forEach((camera) => tremerCamera(camera, duracao, intensidade))
}

export function tremerCamera(camera, duracao = 150, intensidade = 0.01, forcar = false) {
  const f = fatores().tremor
  if (!camera || f <= 0) return
  camera.shake(duracao, intensidade * f, forcar)
}
