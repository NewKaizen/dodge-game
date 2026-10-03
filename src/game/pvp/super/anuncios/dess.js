import { ALTURA, LARGURA } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { flashTela } from '../../../effects/flash.js'

// Cinemática do SUPER de Dess: ÚLTIMO BIS (~3,1 s)
//   1. o palco escurece; holofotes entram do lado de quem jogou e varrem a
//      tela; os trastes da guitarra se acendem em leque, no mesmo lado
//   2. a guitarra entra girando e CRAVA no meio como uma adaga: clarão,
//      tremor, notas voando longe; os trastes piscam em onda a partir dela
//   3. o nome de quem jogou aparece; "SUPER!" pulsa junto com as luzes do
//      palco, no tempo do show; o nome do golpe sobe embaixo
//   4. uma corda de luz se estica de um lado a outro da tela e tudo some

const PRETO = 0x0d0408
const CORES = [0xff5070, 0xffb03a, 0xffe14a]

export default async function (arena, kit) {
  const { novo, texto, esperar, tween, vivo, depois, faiscas, lado, cy, nome, carta } = kit
  const cx = LARGURA / 2

  // ---------- 1. o palco escurece e os holofotes varrem ----------
  const veu = novo(arena.add.rectangle(0, 0, LARGURA, ALTURA, PRETO).setOrigin(0).setAlpha(0).setDepth(95))
  arena.tweens.add({ targets: veu, alpha: 0.88, duration: 160 })
  tocar(arena, 'superCorte')

  const luzes = CORES.map((corLuz, k) => {
    const x0 = lado < 0 ? -100 : LARGURA + 100
    const xf = lado < 0 ? LARGURA * (0.22 + k * 0.28) : LARGURA * (0.78 - k * 0.28)
    const g = novo(arena.add.graphics().setDepth(96).setPosition(x0, -20).setAlpha(0.85))
    g.fillStyle(corLuz, 0.32)
    g.fillTriangle(0, 0, -150, ALTURA + 50, 150, ALTURA + 50)
    arena.tweens.add({ targets: g, x: xf, duration: 420, delay: k * 60, ease: 'Cubic.easeOut' })
    arena.tweens.add({ targets: g, rotation: 0.22, delay: 420 + k * 60, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    return g
  })

  // trastes do braço se acendendo em leque a partir do lado de quem jogou
  const n = 7
  const trastes = []
  for (let i = 0; i < n; i++) {
    const ordem = lado < 0 ? i : n - 1 - i
    const x = (i + 0.5) * (LARGURA / n)
    const img = novo(arena.add.rectangle(x, cy, LARGURA / n - 6, 230, CORES[i % CORES.length], 0.85).setDepth(95).setAlpha(0))
    arena.tweens.add({ targets: img, alpha: 0.9, duration: 110, delay: 60 + ordem * 55, yoyo: true, hold: 70 })
    trastes.push(img)
  }
  for (let i = 0; i < 3; i++) depois(90 + i * 140, () => tocar(arena, 'super-dess-tique'))

  await esperar(650)
  if (!vivo()) return

  // ---------- 2. a guitarra entra girando e crava ----------
  const guitarra = novo(arena.add.image(cx + lado * 260, -50, 'super-dess-guitarra').setDepth(97).setScale(2.6).setAngle(lado * 150))
  const sombra = novo(arena.add.ellipse(cx, cy + 70, 16, 6, 0x000000, 0.5).setDepth(96))
  arena.tweens.add({ targets: sombra, width: 130, height: 26, duration: 220 })
  await tween({ targets: guitarra, x: cx, y: cy + 60, angle: 0, duration: 240, ease: 'Cubic.easeIn' })
  if (!vivo()) return
  tocar(arena, 'super-dess-mergulho')
  novo(flashTela(arena, 0xffdf8a, 0.72, 280)).setDepth(99)
  shake(arena, 320, 0.016)
  faiscas(cx, cy + 60, 0xffe14a, 30)
  faiscas(cx, cy + 60, 0xff5070, 18)
  arena.tweens.add({ targets: guitarra, angle: 5, duration: 45, yoyo: true, repeat: 8 })
  // os trastes piscam em onda a partir do ponto da cravada
  for (const img of trastes) {
    const d = Math.abs(img.x - cx)
    arena.tweens.add({ targets: img, alpha: 0.9, delay: d * 0.6, duration: 90, yoyo: true })
  }

  await esperar(260)
  if (!vivo()) return

  // ---------- 3. nome + SUPER pulsando no tempo do show ----------
  const quem = texto(cx, cy - 90, nome, 20, '#ffe9c8', { strokeThickness: 5 }).setAlpha(0)
  arena.tweens.add({ targets: quem, alpha: 1, y: cy - 104, duration: 200 })
  const grito = texto(cx, cy - 42, 'SUPER!', 56, '#ffe14a', { strokeThickness: 9 }).setScale(3).setAlpha(0)
  arena.tweens.add({ targets: grito, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' })
  tocar(arena, 'superAtivar')
  for (let b = 0; b < 4; b++) {
    depois(240 + b * 180, () => {
      tocar(arena, 'super-dess-acorde')
      arena.tweens.add({ targets: grito, scale: 1.12, duration: 90, yoyo: true, ease: 'Sine.easeOut' })
      for (const g of luzes) arena.tweens.add({ targets: g, alpha: 0.35, duration: 70, yoyo: true })
    })
  }
  const golpe = texto(cx, cy + 16, (carta?.nome ?? '').toUpperCase(), 22, '#ffffff', { strokeThickness: 6 }).setAlpha(0).setScale(0.6)
  arena.tweens.add({ targets: golpe, alpha: 1, scale: 1, delay: 260, duration: 220, ease: 'Back.easeOut' })

  await esperar(950)
  if (!vivo()) return

  // ---------- 4. a corda estica de um lado a outro e tudo some ----------
  tocar(arena, 'superCorte')
  const corda = novo(arena.add.rectangle(cx + lado * LARGURA, cy, LARGURA * 1.6, 4, 0xffe14a, 0.95).setDepth(99))
  arena.tweens.add({ targets: corda, x: cx - lado * LARGURA, duration: 260, ease: 'Cubic.easeIn' })
  await esperar(160)
  if (!vivo()) return
  novo(flashTela(arena, 0xffffff, 0.62, 220)).setDepth(99)
  shake(arena, 160, 0.01)
  await tween({ targets: [veu, guitarra, sombra, quem, grito, golpe, corda, ...luzes, ...trastes], alpha: 0, duration: 260 })
}
