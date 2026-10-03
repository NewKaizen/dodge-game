import { ALTURA, LARGURA } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { flashTela } from '../../../effects/flash.js'

// Cinemática do SUPER de Noelle: ZERO ABSOLUTO (~3,1 s)
//   1. a tela racha: linhas de gelo correm pela tela a partir do lado de quem
//      jogou e uma grade de placas de gelo se forma, uma a uma, em onda
//   2. um pingente gigante despenca do topo e crava bem no meio da grade:
//      clarão, tremor, a placa embaixo vira um abismo e as placas ao redor
//      racham num anel (tingem de ciano e tremem)
//   3. a nevasca toma a tela (whiteout) enquanto o nome de quem jogou e
//      "SUPER!" aparecem fracos através da neve; o nome do golpe se forma
//      em flocos que caem e se encaixam, letra por letra
//   4. a estrela final: lanças de gelo saem do pingente cravado varrendo a
//      tela (com uma brecha, como no ataque de verdade); tudo congela branco
//      e se estilhaça, sumindo

const CASA = 58
const NOITE = 0x0a1830

export default async function (arena, kit) {
  const { novo, texto, esperar, tween, vivo, depois, faiscas, lado, nome, carta } = kit
  const cx = LARGURA / 2
  const chao = 330 // onde o pingente crava
  const ESCALA_PINGENTE = 3.4

  // ---------- 1. a grade de gelo se forma ----------
  const veu = novo(arena.add.rectangle(0, 0, LARGURA, ALTURA, NOITE).setOrigin(0).setAlpha(0).setDepth(95))
  arena.tweens.add({ targets: veu, alpha: 0.86, duration: 180 })
  tocar(arena, 'super-noelle-vento')

  const colunas = Math.ceil(LARGURA / CASA)
  const linhas = Math.ceil(ALTURA / CASA) + 1
  const oy = (ALTURA - linhas * CASA) / 2
  const placas = []
  for (let r = 0; r < linhas; r++) {
    for (let c = 0; c < colunas; c++) {
      const x = c * CASA + CASA / 2
      const y = oy + r * CASA + CASA / 2
      const img = novo(arena.add.image(x, y, 'super-noelle-placa', (c + r) % 2).setDisplaySize(CASA, CASA).setDepth(95).setAlpha(0))
      const sy = img.scaleY
      img.scaleY = 0
      const ordem = lado < 0 ? c : colunas - 1 - c
      arena.tweens.add({ targets: img, scaleY: sy, alpha: 0.55, delay: 50 + ordem * 30 + r * 12, duration: 150, ease: 'Back.easeOut' })
      placas.push({ img, x, y })
    }
  }
  for (let i = 0; i < 4; i++) depois(80 + i * 85, () => tocar(arena, 'super-noelle-tique'))

  await esperar(820)
  if (!vivo()) return

  // ---------- 2. o pingente crava ----------
  const pingente = novo(arena.add.image(cx, -280, 'super-noelle-pingente').setScale(ESCALA_PINGENTE).setDepth(97).setOrigin(0.5, 1))
  const sombra = novo(arena.add.ellipse(cx, chao, 18, 6, 0x000000, 0.5).setDepth(96))
  arena.tweens.add({ targets: sombra, width: 110, height: 20, duration: 200 })
  await tween({ targets: pingente, y: chao + 14, duration: 230, ease: 'Cubic.easeIn' })
  if (!vivo()) return
  tocar(arena, 'super-noelle-quebra')
  novo(flashTela(arena, 0xeaf7ff, 0.78, 300)).setDepth(99)
  shake(arena, 320, 0.017)
  const estouro = novo(arena.add.image(cx, chao + 6, 'super-noelle-impacto').setDepth(96).setScale(0.6).setAlpha(0.95))
  arena.tweens.add({ targets: estouro, scale: 4.4, alpha: 0.5, duration: 260, ease: 'Cubic.easeOut' })
  const buraco = novo(arena.add.image(cx, chao + 8, 'super-noelle-buraco').setDepth(94).setScale(2.6).setAlpha(0))
  arena.tweens.add({ targets: buraco, alpha: 1, duration: 160 })
  faiscas(cx, chao, 0xbfe8ff, 34)
  // anel de geada: as placas ao redor racham e tremem
  for (const p of placas) {
    const d = Math.hypot(p.x - cx, p.y - chao)
    arena.tweens.add({ targets: p.img, alpha: 0.95, delay: d * 0.85, duration: 90, yoyo: true, hold: 60 })
    arena.tweens.add({ targets: p.img, scaleX: p.img.scaleX * 0.6, delay: d * 0.85, duration: 80, yoyo: true })
  }

  await esperar(260)
  if (!vivo()) return

  // ---------- 3. a nevasca toma a tela ----------
  const nevasca = novo(arena.add.rectangle(0, 0, LARGURA, ALTURA, 0xffffff).setOrigin(0).setAlpha(0).setDepth(96))
  arena.tweens.add({ targets: nevasca, alpha: 0.78, duration: 420 })
  tocar(arena, 'super-noelle-vento')
  const neve = novo(
    arena.add.particles(0, -10, 'faisca', {
      x: { min: 0, max: LARGURA },
      y: -10,
      quantity: 3,
      frequency: 30,
      lifespan: 2200,
      speedY: { min: 40, max: 90 },
      speedX: { min: -30, max: 30 },
      scale: { start: 1, end: 0.4 },
      alpha: { start: 0.9, end: 0 },
      tint: 0xffffff,
      blendMode: 'ADD',
    }),
  )
  neve.setDepth(97)

  const quem = texto(cx, 64, nome, 20, '#dff4ff', { strokeThickness: 5 }).setAlpha(0)
  arena.tweens.add({ targets: quem, alpha: 0.9, y: 48, duration: 240 })
  const grito = texto(cx, 100, 'SUPER!', 46, '#ffffff', { strokeThickness: 8 }).setScale(2.4).setAlpha(0)
  arena.tweens.add({ targets: grito, scale: 1, alpha: 0.95, duration: 220, ease: 'Back.easeOut' })
  depois(260, () => tocar(arena, 'super-noelle-tique'))

  await esperar(420)
  if (!vivo()) return

  // nome do golpe: flocos que caem e se encaixam, letra por letra
  const golpe = (carta?.nome ?? '').toUpperCase()
  const letrasY = 400
  const letras = []
  for (let i = 0; i < golpe.length; i++) {
    const x = cx + (i - (golpe.length - 1) / 2) * 16
    if (golpe[i] === ' ') continue
    depois(60 + i * 48, () => {
      const l = texto(x, letrasY - 90, golpe[i], 22, '#eaf7ff', { strokeThickness: 5 }).setAlpha(0)
      arena.tweens.add({ targets: l, y: letrasY, alpha: 1, duration: 260, ease: 'Cubic.easeIn' })
      if (i % 2) tocar(arena, 'super-noelle-tique')
      letras.push(l)
    })
  }

  await esperar(Math.max(500, golpe.length * 48 + 260))
  if (!vivo()) return

  // ---------- 4. a estrela final estilhaça tudo ----------
  tocar(arena, 'super-noelle-estilhaco')
  shake(arena, 260, 0.013)
  const raios = 8
  const feixes = []
  for (let i = 0; i < raios; i++) {
    if (i === 0 || i === 1) continue // a brecha, do lado de quem jogou
    const ang = (i * Math.PI * 2) / raios + (lado < 0 ? 0 : Math.PI)
    const feixe = novo(
      arena.add.image(cx, chao, 'super-noelle-feixe').setDepth(98).setOrigin(0, 0.5).setRotation(ang).setScale(0.06, 0.5),
    )
    arena.tweens.add({ targets: feixe, scaleX: 3.3, scaleY: 1.5, duration: 260, ease: 'Cubic.easeOut' })
    feixes.push(feixe)
  }
  novo(flashTela(arena, 0xffffff, 0.55, 240)).setDepth(99)

  await esperar(360)
  if (!vivo()) return
  neve.stop?.()

  await tween({
    targets: [veu, pingente, sombra, estouro, buraco, nevasca, neve, quem, grito, ...letras, ...feixes, ...placas.map((p) => p.img)],
    alpha: 0,
    duration: 280,
  })
}
