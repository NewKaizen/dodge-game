import { ALTURA, LARGURA } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { flashTela } from '../../../effects/flash.js'

// Cinemática do SUPER de Berdly: PROVA IRREFUTÁVEL (~3,1 s)
//   1. a tela escurece; três lâminas de vento vêm de fora (do lado de quem
//      jogou) e se encaixam formando um pequeno redemoinho no centro
//   2. o redemoinho GIRA cada vez mais rápido (como o golpe de verdade) e
//      dispara páginas em leque enquanto acelera
//   3. clarão + tremor: o redemoinho se desfaz num estouro de luz, o nome de
//      quem jogou aparece, "SUPER!" carimbado e o nome do golpe embaixo
//   4. um feixe reto (dourado, "a resposta certa") atravessa a tela vindo do
//      lado de quem jogou e tudo some

const PRETO = 0x071a12

export default async function (arena, kit) {
  const { novo, texto, esperar, tween, vivo, depois, faiscas, lado, cy, nome, carta } = kit
  const cx = LARGURA / 2

  // ---------- 1. o redemoinho se monta ----------
  const veu = novo(arena.add.rectangle(0, 0, LARGURA, ALTURA, PRETO).setOrigin(0).setAlpha(0).setDepth(95))
  arena.tweens.add({ targets: veu, alpha: 0.86, duration: 160 })
  tocar(arena, 'super-berdly-vento')

  const lams = [0, 1, 2].map((i) => {
    const angDestino = (i / 3) * Math.PI * 2 - Math.PI / 2
    const de = { x: cx + lado * (340 + i * 50), y: cy - 100 + i * 90 }
    const img = novo(arena.add.image(de.x, de.y, 'super-berdly-lamina').setDepth(96).setScale(1.7).setAlpha(0).setRotation(angDestino))
    arena.tweens.add({ targets: img, alpha: 1, duration: 160, delay: i * 70 })
    depois(160 + i * 70, () => {
      if (!vivo()) return
      arena.tweens.add({ targets: img, x: cx + Math.cos(angDestino) * 44, y: cy + Math.sin(angDestino) * 44, duration: 260, ease: 'Back.easeOut' })
    })
    return { img, angDestino }
  })
  for (let i = 0; i < 4; i++) depois(60 + i * 70, () => tocar(arena, 'super-berdly-tique'))

  await esperar(620)
  if (!vivo()) return

  // ---------- 2. gira, acelerando, e dispara páginas ----------
  tocar(arena, 'super-berdly-giro')
  let giro = 0
  const girando = arena.time.addEvent({
    delay: 16,
    loop: true,
    callback: () => {
      giro += 0.052
      lams.forEach(({ img, angDestino }, i) => {
        const ang = angDestino + giro * (1 + i * 0.12)
        img.setPosition(cx + Math.cos(ang) * 44, cy + Math.sin(ang) * 44).setRotation(ang)
      })
    },
  })
  for (let i = 0; i < 9; i++) {
    depois(60 * i, () => {
      if (!vivo()) return
      const ang = (i / 9) * Math.PI * 2 + giro
      const p = novo(arena.add.image(cx, cy, 'super-berdly-pagina', i % 3).setDepth(97).setScale(1.5).setRotation(ang))
      arena.tweens.add({ targets: p, x: cx + Math.cos(ang) * 230, y: cy + Math.sin(ang) * 230, rotation: ang + 5, alpha: 0, duration: 620, ease: 'Quad.easeOut' })
    })
  }

  await esperar(820)
  girando.remove()
  if (!vivo()) return

  // ---------- 3. clarão: o redemoinho estoura em luz e o nome aparece ----------
  tocar(arena, 'superAtivar')
  novo(flashTela(arena, 0xe8ffb0, 0.72, 260))
  shake(arena, 260, 0.014)
  const impacto = novo(arena.add.image(cx, cy, 'super-berdly-impacto').setDepth(96).setScale(0.6).setAlpha(0.95))
  arena.tweens.add({ targets: impacto, scale: 3.8, alpha: 0, duration: 420, ease: 'Quad.easeOut' })
  faiscas(cx, cy, 0xd8f05a, 30)
  lams.forEach(({ img }) => arena.tweens.add({ targets: img, alpha: 0, scale: 2.4, duration: 280 }))

  const quem = texto(cx - lado * 40, cy - 78, nome, 20, '#d8f05a', { strokeThickness: 5 }).setAlpha(0)
  arena.tweens.add({ targets: quem, x: cx, alpha: 1, duration: 220, ease: 'Cubic.easeOut' })
  const grito = texto(cx, cy - 18, 'SUPER!', 56, '#fff2b0', { strokeThickness: 9 }).setScale(3).setAlpha(0)
  arena.tweens.add({ targets: grito, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' })
  arena.tweens.add({ targets: grito, scale: 1.08, delay: 260, duration: 180, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' })
  const golpeTxt = texto(cx, cy + 42, (carta?.nome ?? '').toUpperCase(), 22, '#ffffff', { strokeThickness: 6 }).setAlpha(0).setScale(0.6)
  arena.tweens.add({ targets: golpeTxt, alpha: 1, scale: 1, delay: 180, duration: 240, ease: 'Back.easeOut' })

  await esperar(950)
  if (!vivo()) return

  // ---------- 4. o feixe final ("a resposta certa") atravessa a tela ----------
  tocar(arena, 'super-berdly-estalo')
  const feixe = novo(
    arena.add
      .image(cx + lado * LARGURA, ALTURA / 2, 'super-berdly-feixe')
      .setDepth(99)
      .setDisplaySize(LARGURA * 1.35, 44)
      .setRotation(lado < 0 ? -0.16 : 0.16),
  )
  arena.tweens.add({ targets: feixe, x: cx - lado * LARGURA, duration: 260, ease: 'Cubic.easeIn' })
  await esperar(150)
  if (!vivo()) return
  novo(flashTela(arena, 0xffffff, 0.55, 220))
  await tween({ targets: [veu, impacto, quem, grito, golpeTxt, feixe, ...lams.map((l) => l.img)], alpha: 0, duration: 260 })
}
