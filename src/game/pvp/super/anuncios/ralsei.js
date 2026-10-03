import { ALTURA, LARGURA } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { flashTela } from '../../../effects/flash.js'

// Cinemática do SUPER de Ralsei: ÚLTIMO CAPÍTULO (~3,3 s)
//   1. a tela escurece e as páginas do livro viram bem rápido, voando de um
//      lado a outro (como alguém folheando até o fim)
//   2. elas param: duas asas de dragão (silhueta) se abrem dos dois lados e
//      o nome de quem jogou aparece
//   3. a sombra do dragão sobe atrás das asas, os olhos acendem: tremor
//   4. uma língua de fogo verde corta a tela na diagonal; "SUPER" carimba e o
//      nome do golpe aparece embaixo
//   5. o livro se fecha (as páginas batem) e tudo some

const CX = LARGURA / 2

export default async function (arena, kit) {
  const { novo, texto, esperar, tween, vivo, depois, faiscas, lado, cy, nome, carta } = kit

  // ---------- 1. o livro é folheado ----------
  const veu = novo(arena.add.rectangle(0, 0, LARGURA, ALTURA, 0x05140c).setOrigin(0).setAlpha(0).setDepth(95))
  arena.tweens.add({ targets: veu, alpha: 0.88, duration: 160 })
  tocar(arena, 'superCorte')

  const folhas = []
  for (let i = 0; i < 7; i++) {
    const deLado = i % 2 ? 1 : -1
    const img = novo(
      arena.add
        .image(CX + deLado * (LARGURA * 0.6), cy + ((i % 3) - 1) * 26, 'super-ralsei-pagina')
        .setDepth(96)
        .setScale(1.6)
        .setAlpha(0)
        .setAngle(deLado * 50),
    )
    folhas.push(img)
    depois(40 + i * 70, () => {
      tocar(arena, 'super-ralsei-pagina')
      arena.tweens.add({ targets: img, x: CX - deLado * (LARGURA * 0.6), angle: -deLado * 70, alpha: 0.95, duration: 260, ease: 'Sine.easeIn' })
      arena.tweens.add({ targets: img, alpha: 0, delay: 200, duration: 180 })
    })
  }

  await esperar(560)
  if (!vivo()) return

  // ---------- 2. as asas se abrem ----------
  const asaE = novo(arena.add.image(CX, cy + 30, 'super-ralsei-asa').setOrigin(0.05, 0.92).setFlipX(true).setDepth(96).setAlpha(0).setScale(0.3))
  const asaD = novo(arena.add.image(CX, cy + 30, 'super-ralsei-asa').setOrigin(0.05, 0.92).setDepth(96).setAlpha(0).setScale(0.3))
  const escalaAsa = (LARGURA * 0.62) / Math.max(1, asaE.width)
  arena.tweens.add({ targets: [asaE, asaD], alpha: 0.6, scale: escalaAsa, duration: 320, ease: 'Back.easeOut' })
  tocar(arena, 'super-ralsei-sopro')

  const quem = texto(CX, cy - 70, nome, 22, '#c8ffd8', { strokeThickness: 5 }).setAlpha(0)
  arena.tweens.add({ targets: quem, alpha: 1, y: cy - 86, duration: 220 })

  await esperar(420)
  if (!vivo()) return

  // ---------- 3. a sombra do dragão sobe ----------
  tocar(arena, 'super-ralsei-dragao')
  const sombra = novo(arena.add.image(CX, ALTURA + 40, 'super-ralsei-sombra-dragao').setDepth(95).setAlpha(0).setScale(0.6))
  const escalaSombra = (LARGURA * 1.02) / Math.max(1, sombra.width)
  await tween({ targets: sombra, y: cy + 48, alpha: 0.92, scale: escalaSombra, duration: 360, ease: 'Quad.easeOut' })
  if (!vivo()) return
  shake(arena, 260, 0.013)
  novo(flashTela(arena, 0x6be08a, 0.35, 220))
  faiscas(CX, cy + 10, 0x6be08a, 24)

  // ---------- 4. a língua de fogo corta a tela ----------
  await esperar(160)
  if (!vivo()) return
  tocar(arena, 'super-ralsei-sopro')
  const lamina = novo(
    arena.add
      .image(CX - lado * LARGURA * 0.7, cy - lado * 60, 'super-ralsei-lamina-fogo')
      .setDepth(97)
      .setDisplaySize(LARGURA * 1.5, 60)
      .setRotation(lado * 0.3),
  )
  await tween({ targets: lamina, x: CX + lado * LARGURA * 0.7, y: cy + lado * 60, duration: 260, ease: 'Cubic.easeIn' })
  if (!vivo()) return
  tocar(arena, 'superAtivar')
  novo(flashTela(arena, 0xe9f8ee, 0.75, 240))
  shake(arena, 240, 0.015)
  faiscas(CX, cy, 0xffe14a, 18)

  const grito = texto(CX, cy - 4, 'SUPER!', 56, '#ffe14a', { strokeThickness: 9 }).setAlpha(0).setScale(3).setAngle(lado * 5)
  arena.tweens.add({ targets: grito, alpha: 1, scale: 1, angle: 0, duration: 180, ease: 'Back.easeOut' })
  arena.tweens.add({ targets: grito, scale: 1.08, delay: 220, duration: 160, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' })
  const golpe = texto(CX, cy + 56, (carta?.nome ?? '').toUpperCase(), 22, '#ffffff', { strokeThickness: 6 }).setAlpha(0).setScale(0.6)
  arena.tweens.add({ targets: golpe, alpha: 1, scale: 1, delay: 220, duration: 220, ease: 'Back.easeOut' })

  await esperar(780)
  if (!vivo()) return

  // ---------- 5. o livro se fecha ----------
  tocar(arena, 'superCorte')
  arena.tweens.add({ targets: [asaE, asaD], scaleX: 0, alpha: 0, duration: 220, ease: 'Cubic.easeIn' })
  arena.tweens.add({ targets: sombra, alpha: 0, y: sombra.y + 20, duration: 240 })
  await tween({ targets: [veu, quem, lamina, grito, golpe], alpha: 0, duration: 260 })
}
