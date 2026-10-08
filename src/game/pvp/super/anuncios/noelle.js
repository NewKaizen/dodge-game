import { ALTURA, LARGURA } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { flashTela } from '../../../effects/flash.js'
import { garantirTexturas } from '../../../attacks/super/noelle.js'

// Cinemática do SUPER de Noelle: SNOWGRAVE (~3,2 s)
//   1. o frio: a tela escurece num azul de noite gelada e a geada entra pelas
//      bordas; um vento grave sopra
//   2. o selo: um floco de neve gigante se DESENHA no meio da tela, braço por
//      braço, e começa a girar; o nome de quem jogou aparece fraco em cima
//   3. SNOWGRAVE: as letras caem uma a uma, de gelo, enquanto a nevasca
//      engrossa e o selo brilha e cresce
//   4. o túmulo de gelo: colunas de gelo explodem do chão da tela numa onda
//      a partir do lado de quem jogou; clarão branco, tremor, e tudo estilhaça

const NOITE = 0x06142c
const GELO = 0xbfe8ff
const TAU = Math.PI * 2

export default async function (arena, kit) {
  const { novo, texto, esperar, tween, vivo, depois, faiscas, lado, nome, carta } = kit
  garantirTexturas(arena)
  const cx = LARGURA / 2
  const cy = ALTURA * 0.42
  const chao = ALTURA - 40

  // ---------- 1. o frio ----------
  const veu = novo(arena.add.rectangle(0, 0, LARGURA, ALTURA, NOITE).setOrigin(0).setAlpha(0).setDepth(95))
  arena.tweens.add({ targets: veu, alpha: 0.92, duration: 260 })
  tocar(arena, 'snowgraveFrio')
  for (let k = 0; k < 4; k++) {
    const e = 18 + k * 16
    const geada = novo(arena.add.graphics().setDepth(95).setAlpha(0))
    geada.fillStyle(0xdff6ff, 0.12)
    geada.fillRect(0, 0, LARGURA, e).fillRect(0, ALTURA - e, LARGURA, e).fillRect(0, 0, e, ALTURA).fillRect(LARGURA - e, 0, e, ALTURA)
    arena.tweens.add({ targets: geada, alpha: 1, delay: 120 + k * 110, duration: 380 })
  }
  // neve fina caindo o tempo todo
  const neve = novo(
    arena.add.particles(cx, -10, 'faisca', {
      x: { min: -cx, max: cx },
      quantity: 2,
      frequency: 40,
      lifespan: 2400,
      speedY: { min: 60, max: 140 },
      speedX: { min: -30, max: 10 },
      scale: { start: 0.8, end: 0.3 },
      alpha: { start: 0.8, end: 0 },
      tint: 0xeaf7ff,
    }),
  )
  neve.setDepth(96)
  await esperar(380)
  if (!vivo()) return

  // ---------- 2. o selo se desenha ----------
  const RAIO = 150
  const selo = novo(arena.add.graphics().setDepth(96).setPosition(cx, cy))
  const desenhar = (p) => {
    selo.clear()
    selo.lineStyle(4, GELO, 0.9)
    for (let b = 0; b < 6; b++) {
      const q = Math.max(0, Math.min(1, p * 6 - b)) // cada braço se desenha depois do anterior
      if (q <= 0) continue
      const ang = (b * TAU) / 6 - Math.PI / 2
      const r = RAIO * q
      selo.lineBetween(0, 0, Math.cos(ang) * r, Math.sin(ang) * r)
      if (q > 0.55) {
        const mx = Math.cos(ang) * RAIO * 0.55
        const my = Math.sin(ang) * RAIO * 0.55
        const rr = RAIO * 0.36 * Math.min(1, (q - 0.55) / 0.45)
        selo.lineBetween(mx, my, mx + Math.cos(ang + 0.75) * rr, my + Math.sin(ang + 0.75) * rr)
        selo.lineBetween(mx, my, mx + Math.cos(ang - 0.75) * rr, my + Math.sin(ang - 0.75) * rr)
      }
    }
    selo.lineStyle(2, GELO, 0.6).strokeCircle(0, 0, RAIO * 0.22 * p)
  }
  const progresso = { p: 0 }
  arena.tweens.add({ targets: progresso, p: 1, duration: 620, onUpdate: () => desenhar(progresso.p) })
  for (let b = 0; b < 6; b++) depois(b * 100, () => tocar(arena, 'super-noelle-tique'))
  arena.tweens.add({ targets: selo, rotation: -lado * 0.9, duration: 2600, ease: 'Sine.easeInOut' })
  const quem = texto(cx, 56, nome, 18, '#bfe8ff', { strokeThickness: 5 }).setAlpha(0)
  arena.tweens.add({ targets: quem, alpha: 0.85, duration: 300 })
  await esperar(660)
  if (!vivo()) return

  // ---------- 3. SNOWGRAVE ----------
  tocar(arena, 'snowgrave')
  shake(arena, 300, 0.006)
  arena.tweens.add({ targets: selo, scale: 1.25, duration: 900, ease: 'Cubic.easeOut' })
  neve.setFrequency(14, 4) // a nevasca engrossa
  const golpe = (carta?.nome ?? 'SNOWGRAVE').toUpperCase()
  const tamanho = 40
  const passo = tamanho * 0.62
  const x0 = cx - ((golpe.length - 1) * passo) / 2
  for (let i = 0; i < golpe.length; i++) {
    depois(i * 55, () => {
      if (!vivo()) return
      const letra = texto(x0 + i * passo, cy - 160, golpe[i], tamanho, '#eaf7ff', { strokeThickness: 7, stroke: '#0b2a55' }).setAlpha(0)
      arena.tweens.add({ targets: letra, y: cy, alpha: 1, duration: 260, ease: 'Bounce.easeOut' })
      faiscas(x0 + i * passo, cy, GELO, 4)
    })
  }
  await esperar(golpe.length * 55 + 520)
  if (!vivo()) return

  // ---------- 4. o túmulo de gelo ----------
  const colunas = 14
  const largura = LARGURA / colunas
  for (let k = 0; k < colunas; k++) {
    const ordem = lado < 0 ? k : colunas - 1 - k
    depois(ordem * 38, () => {
      if (!vivo()) return
      const x = (k + 0.5) * largura
      const alto = 2.6 + Math.sin(k * 1.7) * 0.6 + 1.2
      // pingente de cabeça para baixo: a ponta sobe do chão
      const cristal = novo(arena.add.image(x, chao + 40, 'super-noelle-pingente').setDepth(97).setFlipY(true).setOrigin(0.5, 1).setScale(1.6, 0.1).setTint(0xeaf7ff))
      arena.tweens.add({ targets: cristal, scaleY: alto, y: chao + 30, duration: 140, ease: 'Back.easeOut' })
      faiscas(x, chao, 0xffffff, 3)
      if (ordem % 3 === 0) tocar(arena, 'super-noelle-estilhaco')
    })
  }
  await esperar(colunas * 38 + 160)
  if (!vivo()) return
  tocar(arena, 'snowgraveFim')
  flashTela(arena, 0xffffff, 0.9, 420)
  shake(arena, 420, 0.02)
  for (let i = 0; i < 5; i++) faiscas(LARGURA * (0.1 + i * 0.2), cy + 80, i % 2 ? 0xffffff : GELO, 14)
  await esperar(380)
}
