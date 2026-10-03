import Phaser from 'phaser'
import { ALTURA, LARGURA } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'

// Cinemática do SUPER de Susie: DEMOLIÇÃO TOTAL (~3,2 s)
//   1. a tela escurece e um MURO de tijolos roxos se ergue na frente de tudo,
//      fileira por fileira, de baixo para cima (tijolos caindo e encaixando)
//   2. a sombra do machado gigante cresce no meio do muro; o machado entra
//      girando do lado de quem jogou e ARREBENTA o muro: clarão, tremor,
//      estrela de impacto e os tijolos perto do golpe voam longe
//   3. pelo rombo aparecem o nome de quem jogou, "SUPER!" carimbado e o nome
//      do golpe; o machado fica cravado, vibrando
//   4. um Rude Buster gigante varre a tela de um lado ao outro e leva o que
//      sobrou do muro (e o machado) junto; tudo some

const TIJOLO = { largura: 64, altura: 32 } // 32x16 em escala 2
const ROXO_ESCURO = 0x12061f
const MAGENTA = 0xff6edc
const AMARELO = 0xffe14a

export default async function (arena, kit) {
  const { novo, texto, esperar, tween, vivo, depois, faiscas, lado, cy, nome, carta } = kit
  const cx = LARGURA / 2

  // ---------- 1. o muro se ergue ----------
  const veu = novo(arena.add.rectangle(0, 0, LARGURA, ALTURA, ROXO_ESCURO).setOrigin(0).setAlpha(0).setDepth(95))
  arena.tweens.add({ targets: veu, alpha: 0.9, duration: 160 })
  tocar(arena, 'superCorte')

  const linhas = 8
  const topo = cy - (linhas * TIJOLO.altura) / 2
  const tijolos = []
  for (let r = linhas - 1; r >= 0; r--) {
    const desloc = r % 2 ? TIJOLO.largura / 2 : 0 // fileiras desencontradas
    const ordemFileira = linhas - 1 - r
    for (let x = -desloc; x < LARGURA + TIJOLO.largura; x += TIJOLO.largura) {
      const px = x + TIJOLO.largura / 2
      const py = topo + r * TIJOLO.altura + TIJOLO.altura / 2
      const img = novo(arena.add.image(px, py - 60, 'super-susie-tijolo', Phaser.Math.Between(0, 2)).setScale(2).setDepth(96).setAlpha(0))
      arena.tweens.add({ targets: img, y: py, alpha: 1, delay: 40 + ordemFileira * 55 + Phaser.Math.Between(0, 40), duration: 140, ease: 'Bounce.easeOut' })
      tijolos.push({ img, x: px, y: py, foi: false })
    }
  }
  for (let i = 0; i < 4; i++) depois(60 + i * 110, () => shake(arena, 60, 0.003))

  // a sombra do machado cresce no meio do muro
  const sombra = novo(arena.add.image(cx, cy, 'super-susie-machado').setTint(0x000000).setAlpha(0).setScale(1.2).setDepth(97))
  arena.tweens.add({ targets: sombra, alpha: 0.55, scale: 3.4, delay: 420, duration: 380, ease: 'Quad.easeIn' })

  await esperar(560)
  if (!vivo()) return

  // ---------- 2. o machado arrebenta o muro ----------
  const machado = novo(arena.add.image(cx + lado * 420, cy - 140, 'super-susie-machado').setScale(3.6).setDepth(97).setAngle(lado * 160))
  tocar(arena, 'superCorte')
  await tween({ targets: machado, x: cx, y: cy, angle: lado * -8, duration: 240, ease: 'Quad.easeIn' })
  if (!vivo()) return

  sombra.setVisible(false)
  tocar(arena, 'super-susie-pancada')
  tocar(arena, 'super-susie-muro')
  shake(arena, 380, 0.02)
  const clarao = novo(arena.add.rectangle(0, 0, LARGURA, ALTURA, 0xffffff).setOrigin(0).setAlpha(0.85).setDepth(99))
  arena.tweens.add({ targets: clarao, alpha: 0, duration: 260, ease: 'Quad.easeOut' })
  const impacto = novo(arena.add.image(cx, cy, 'super-susie-impacto').setScale(1).setDepth(98))
  arena.tweens.add({ targets: impacto, scale: 6, alpha: 0, angle: 60, duration: 420, ease: 'Quad.easeOut' })
  const racha = novo(arena.add.image(cx, cy, 'super-susie-racha').setScale(9).setDepth(96).setAlpha(0.9))
  arena.tweens.add({ targets: racha, alpha: 0.4, duration: 90, yoyo: true, repeat: 5 })
  faiscas(cx, cy, MAGENTA, 30)
  faiscas(cx, cy, AMARELO, 16)
  arena.tweens.add({ targets: machado, angle: lado * -2, duration: 45, yoyo: true, repeat: 8 }) // vibra cravado

  // o rombo: tijolos perto do golpe voam para longe
  for (const t of tijolos) {
    const dx = t.x - cx
    const dy = (t.y - cy) * 1.6
    if (Math.hypot(dx, dy) < 190) voar(arena, t, Math.sign(dx) || 1, Math.atan2(t.y - cy, dx), 0)
  }

  // ---------- 3. SUPER! pelo rombo ----------
  const quem = texto(cx, cy - 92, nome, 22, '#d9a6ff', { strokeThickness: 6 }).setAlpha(0).setScale(0.4)
  arena.tweens.add({ targets: quem, alpha: 1, scale: 1, duration: 200, delay: 80, ease: 'Back.easeOut' })
  const grito = texto(cx, cy - 20, 'SUPER!', 64, '#ffe14a', { strokeThickness: 10 }).setAlpha(0).setScale(4).setAngle(lado * 6)
  arena.tweens.add({ targets: grito, alpha: 1, scale: 1, angle: lado * -4, duration: 170, delay: 120, ease: 'Quad.easeIn' })
  depois(290, () => {
    shake(arena, 160, 0.012)
    tocar(arena, 'superAtivar')
    arena.tweens.add({ targets: grito, scale: 1.1, duration: 140, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' })
  })
  const golpe = texto(cx, cy + 52, (carta?.nome ?? '').toUpperCase(), 24, '#ffffff', { strokeThickness: 7 }).setAlpha(0).setScale(1.6)
  arena.tweens.add({ targets: golpe, alpha: 1, scale: 1, delay: 420, duration: 200, ease: 'Back.easeOut' })

  await esperar(1250)
  if (!vivo()) return

  // ---------- 4. Rude Buster leva tudo ----------
  const sentido = -lado // vem do lado de quem jogou
  const inicio = sentido > 0 ? -120 : LARGURA + 120
  const fim = sentido > 0 ? LARGURA + 160 : -160
  const buster = novo(arena.add.sprite(inicio, cy, 'super-susie-buster', 0).setScale(4.2).setDepth(97).setFlipX(sentido < 0))
  tocar(arena, 'super-susie-buster')
  const duracao = 520
  arena.tweens.add({ targets: buster, x: fim, duration: duracao, ease: 'Sine.easeIn' })
  let quadro = 0
  const animar = arena.time.addEvent({ delay: 60, loop: true, callback: () => buster.active && buster.setFrame(++quadro % 3) })
  // rastro e o que estiver no caminho voa junto
  const varrer = arena.time.addEvent({
    delay: 30,
    loop: true,
    callback: () => {
      if (!vivo() || !buster.active) return
      const eco = novo(arena.add.image(buster.x, buster.y, 'super-susie-buster', buster.frame.name).setScale(4.2).setFlipX(sentido < 0).setTint(0xb05cff).setAlpha(0.4).setDepth(96))
      arena.tweens.add({ targets: eco, alpha: 0, duration: 200 })
      for (const t of tijolos) if (!t.foi && (t.x - buster.x) * sentido < 20) voar(arena, t, sentido, 0, 0)
      if (machado.visible && (cx - buster.x) * sentido < 20) {
        machado.visible = false
        const voo = novo(arena.add.image(machado.x, machado.y, 'super-susie-machado').setScale(3.6).setDepth(97).setAngle(machado.angle))
        arena.tweens.add({ targets: voo, x: machado.x + sentido * 380, y: machado.y - 220, angle: sentido * 720, duration: 520, ease: 'Quad.easeOut' })
      }
    },
  })
  depois(duracao * 0.45, () => {
    shake(arena, 220, 0.01)
    faiscas(cx, cy, 0xb05cff, 24)
  })
  arena.tweens.add({ targets: racha, alpha: 0, duration: 200, delay: duracao * 0.4 })

  await esperar(duracao + 120)
  animar.remove()
  varrer.remove()
  if (!vivo()) return

  await tween({ targets: [veu, quem, grito, golpe], alpha: 0, duration: 260 })
}

// um tijolo sai voando (para fora e girando, caindo com a "gravidade")
function voar(arena, t, sentido, angulo, atraso) {
  if (t.foi) return
  t.foi = true
  arena.tweens.killTweensOf(t.img)
  t.img.setAlpha(1).setY(t.y)
  const forca = Phaser.Math.Between(140, 320)
  const vx = angulo ? Math.cos(angulo) * forca : sentido * forca
  const vy = angulo ? Math.sin(angulo) * forca - 120 : Phaser.Math.Between(-160, -40)
  arena.tweens.add({ targets: t.img, x: t.x + vx, duration: 640, delay: atraso, ease: 'Linear' })
  arena.tweens.add({ targets: t.img, y: t.y + vy, duration: 260, delay: atraso, ease: 'Quad.easeOut' })
  arena.tweens.add({ targets: t.img, y: ALTURA + 60, duration: 420, delay: atraso + 260, ease: 'Quad.easeIn' })
  arena.tweens.add({ targets: t.img, angle: Phaser.Math.Between(-540, 540), scale: 2.4, duration: 680, delay: atraso })
}
