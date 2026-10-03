import Phaser from 'phaser'
import { ALTURA, LARGURA } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { flashTela } from '../../../effects/flash.js'

// Cinemática do SUPER de Asriel: SINGULARIDADE RADIANTE (~3,1 s)
//   1. a tela escurece e um pontinho negro nasce no centro; estrelas de
//      todas as cores nascem perto das bordas e são PUXADAS para dentro dele,
//      acelerando conforme chegam perto (o mesmo puxão do ataque de verdade),
//      enquanto o vazio cresce e gira
//   2. o vazio implode num instante: clarão, tremor e a supernova nasce no
//      lugar -- "SUPER!" e o nome do golpe aparecem sobre o clarão arco-íris
//   3. nós de constelação acendem num anel em volta da supernova e disparam
//      raios retos para as bordas, um para cada cor; tudo some

const ARCO = [0xff4a5a, 0xffa23a, 0xffe14a, 0x5ae06a, 0x4ab8ff, 0xa66bff]

export default async function (arena, kit) {
  const { novo, texto, esperar, tween, vivo, depois, faiscas, nome, carta } = kit
  const cx = LARGURA / 2
  const cy = ALTURA * 0.46
  const tudo = [] // o que ainda vai estar visível no fim (para o fade final)

  // ---------- 1. o vazio nasce e puxa as estrelas ----------
  const veu = novo(arena.add.rectangle(0, 0, LARGURA, ALTURA, 0x050310).setOrigin(0).setAlpha(0).setDepth(95))
  tudo.push(veu)
  arena.tweens.add({ targets: veu, alpha: 0.88, duration: 180 })
  tocar(arena, 'superCorte')

  const buraco = novo(arena.add.image(cx, cy, 'super-asriel-buraco', 0).setDepth(96).setScale(0).setAlpha(0))
  arena.tweens.add({ targets: buraco, alpha: 1, scale: 0.7, duration: 260, ease: 'Sine.easeOut' })
  arena.tweens.add({ targets: buraco, scale: 1.7, delay: 260, duration: 560, ease: 'Quad.easeIn' })
  let quadroBuraco = 0
  const giroBuraco = arena.time.addEvent({ delay: 90, loop: true, callback: () => buraco.active && buraco.setFrame(++quadroBuraco % 6) })

  const quem = texto(cx, cy - 86, nome, 20, '#ffd9f0', { strokeThickness: 5 }).setAlpha(0)
  tudo.push(quem)
  arena.tweens.add({ targets: quem, alpha: 1, y: cy - 96, duration: 220, delay: 120 })

  // estrelas nascendo nas bordas e caindo para o centro, acelerando (o puxão)
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2 + 0.3
    const raio = Math.max(LARGURA, ALTURA) * 0.62
    const x0 = cx + Math.cos(ang) * raio
    const y0 = cy + Math.sin(ang) * raio
    const img = novo(arena.add.image(x0, y0, 'super-asriel-estrelas', i % 6).setScale(1.3).setDepth(96).setAlpha(0))
    arena.tweens.add({ targets: img, alpha: 1, duration: 120, delay: i * 45 })
    arena.tweens.add({
      targets: img,
      x: cx,
      y: cy,
      scale: 0.5,
      rotation: 3,
      duration: 820,
      delay: 90 + i * 45,
      ease: 'Cubic.easeIn', // sai devagar, acelera forte perto do fim: o puxão
    })
  }
  for (let i = 0; i < 3; i++) depois(260 + i * 260, () => tocar(arena, 'super-asriel-pulso'))

  await esperar(980)
  if (!vivo()) return

  // ---------- 2. colapso -> supernova ----------
  tocar(arena, 'super-asriel-colapso')
  shake(arena, 300, 0.016)
  giroBuraco.remove()
  arena.tweens.killTweensOf(buraco)
  arena.tweens.add({ targets: buraco, scale: 0, angle: 300, duration: 220, ease: 'Cubic.easeIn' })
  novo(flashTela(arena, 0xffffff, 0.85, 320)).setDepth(99)

  const nova = novo(arena.add.image(cx, cy, 'super-asriel-nova').setDepth(97).setScale(0).setBlendMode(Phaser.BlendModes.ADD))
  tudo.push(nova)
  arena.tweens.add({ targets: nova, scale: 3.4, duration: 280, delay: 120, ease: 'Back.easeOut' })
  arena.tweens.add({ targets: nova, scale: 3, duration: 420, delay: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  faiscas(cx, cy, 0xffffff, 26)

  const grito = texto(cx, cy, 'SUPER!', 58, '#ffe14a', { strokeThickness: 9 }).setScale(3).setAlpha(0)
  tudo.push(grito)
  arena.tweens.add({ targets: grito, scale: 1, alpha: 1, duration: 200, delay: 160, ease: 'Back.easeOut' })
  arena.tweens.add({ targets: grito, scale: 1.08, delay: 420, duration: 180, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' })
  const golpe = texto(cx, cy + 46, (carta?.nome ?? '').toUpperCase(), 22, '#ffffff', { strokeThickness: 6 }).setAlpha(0).setScale(0.6)
  tudo.push(golpe)
  arena.tweens.add({ targets: golpe, alpha: 1, scale: 1, delay: 360, duration: 240, ease: 'Back.easeOut' })
  depois(260, () => tocar(arena, 'superAtivar'))

  await esperar(760)
  if (!vivo()) return

  // ---------- 3. a supernova dispara os raios ----------
  const raios = 8
  const nos = []
  for (let k = 0; k < raios; k++) {
    const ang = (k / raios) * Math.PI * 2
    const nx = cx + Math.cos(ang) * 46
    const ny = cy + Math.sin(ang) * 46
    const no = novo(arena.add.image(nx, ny, 'super-asriel-no', 0).setDepth(97).setTint(ARCO[k % ARCO.length]).setScale(0.5).setAlpha(0))
    arena.tweens.add({ targets: no, alpha: 1, scale: 1.6, duration: 160, delay: k * 35 })
    nos.push({ no, ang, nx, ny, cor: k % 6 })
  }
  await esperar(260)
  if (!vivo()) return

  tocar(arena, 'super-asriel-estoura')
  shake(arena, 160, 0.01)
  const comp = Math.hypot(LARGURA, ALTURA)
  for (const { no, ang, nx, ny, cor } of nos) {
    arena.tweens.add({ targets: no, alpha: 0, duration: 420, delay: 80 })
    const raio = novo(
      arena.add.image(nx, ny, 'super-asriel-estrelas', cor).setDepth(96).setRotation(ang).setScale(0.9, 2.6).setBlendMode(Phaser.BlendModes.ADD),
    )
    arena.tweens.add({
      targets: raio,
      x: nx + Math.cos(ang) * comp,
      y: ny + Math.sin(ang) * comp,
      scaleY: 0.4,
      alpha: 0,
      duration: 520,
      ease: 'Cubic.easeIn',
    })
  }
  faiscas(cx, cy, 0xffffff, 18)

  await esperar(420)
  if (!vivo()) return

  // ---------- fim: tudo some ----------
  await tween({ targets: tudo, alpha: 0, duration: 280 })
}
