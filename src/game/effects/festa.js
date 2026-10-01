import Phaser from 'phaser'
import { LARGURA, ALTURA } from '../constants.js'

// Efeitos de comemoração (tela de vitória): fogos, confete e raios de luz.

export const CORES_FESTA = [0xffe040, 0xff4f8a, 0x3cff6a, 0x6dd0ff, 0xff8a1a, 0xc07dff, 0xffffff]

// Fogo de artifício: clarão + anel de faíscas que caem com a gravidade
export function fogoArtificio(scene, x, y, cor = Phaser.Utils.Array.GetRandom(CORES_FESTA), { quantidade = 36, profundidade = 3 } = {}) {
  const clarao = scene.add.image(x, y, 'brilho').setTint(cor).setBlendMode(Phaser.BlendModes.ADD).setDepth(profundidade).setScale(0.2)
  scene.tweens.add({ targets: clarao, scale: 1.6, alpha: 0, duration: 450, ease: 'Quad.easeOut', onComplete: () => clarao.destroy() })

  const emissor = scene.add.particles(x, y, 'faisca', {
    speed: { min: 90, max: 200 },
    angle: { min: 0, max: 360 },
    gravityY: 110,
    lifespan: { min: 800, max: 1200 },
    scale: { start: 1.3, end: 0 },
    alpha: { start: 1, end: 0.2 },
    tint: [cor, cor, 0xffffff],
    blendMode: 'ADD',
    emitting: false,
  })
  emissor.setDepth(profundidade)
  emissor.explode(quantidade)
  scene.time.delayedCall(1400, () => emissor.destroy())
}

// Canhões de confete nos dois cantos de baixo (explosão única)
export function canhoesConfete(scene, quantidade = 70, profundidade = 12) {
  const base = {
    speed: { min: 380, max: 620 },
    gravityY: 420,
    lifespan: { min: 2200, max: 3200 },
    rotate: { min: 0, max: 360 },
    scaleX: { start: 1.4, end: 0.3 },
    scaleY: 1.4,
    alpha: { start: 1, end: 0 },
    tint: CORES_FESTA,
    emitting: false,
  }
  const esquerdo = scene.add.particles(0, ALTURA + 8, 'confete', { ...base, angle: { min: -82, max: -52 } }).setDepth(profundidade)
  const direito = scene.add.particles(LARGURA, ALTURA + 8, 'confete', { ...base, angle: { min: -128, max: -98 } }).setDepth(profundidade)
  esquerdo.explode(quantidade)
  direito.explode(quantidade)
  scene.time.delayedCall(3400, () => {
    esquerdo.destroy()
    direito.destroy()
  })
}

// Chuvinha contínua de confete caindo do alto (fica até a cena acabar)
export function chuvaConfete(scene, profundidade = 2) {
  return scene.add
    .particles(0, -10, 'confete', {
      x: { min: 0, max: LARGURA },
      speedY: { min: 40, max: 90 },
      speedX: { min: -30, max: 30 },
      lifespan: 7000,
      rotate: { start: 0, end: 540 },
      scale: { min: 0.8, max: 1.2 },
      alpha: { start: 0.9, end: 0.4 },
      tint: CORES_FESTA,
      frequency: 110,
    })
    .setDepth(profundidade)
}

// Leque de raios de luz girando em volta de (x, y). Devolve o container
// (gire com container.rotation no update)
export function raiosDeLuz(scene, x, y, { quantidade = 12, cor = 0xffe040, alpha = 0.16, profundidade = -2 } = {}) {
  const raios = []
  for (let i = 0; i < quantidade; i++) {
    raios.push(
      scene.add
        .image(0, 0, 'raio')
        .setOrigin(0.5, 1)
        .setScale(1.5, 1.8)
        .setRotation((i / quantidade) * Math.PI * 2)
        .setTint(i % 2 ? cor : 0xffffff)
        .setBlendMode(Phaser.BlendModes.ADD),
    )
  }
  return scene.add.container(x, y, raios).setDepth(profundidade).setAlpha(0).setData('alpha', alpha)
}
