import { ALTURA, LARGURA } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { flashTela } from '../../../effects/flash.js'

// Cinemática do SUPER de Kris: XEQUE-MATE (~3,2 s)
//   1. a tela vira um tabuleiro: as casas viram uma a uma, em onda, a partir
//      do lado de quem jogou; três peças (cavalo, bispo, torre) pulam pelas casas
//   2. a espada gigante cai do céu e CRAVA no meio do tabuleiro: clarão,
//      tremor, rachadura, as peças voam longe e as casas em volta acendem
//   3. a alma vermelha desce até a guarda da espada e bate duas vezes
//      (anéis vermelhos varrendo o tabuleiro); o nome de quem jogou aparece
//   4. "SUPER" cai letra por letra, cada uma numa casa; o nome do golpe é
//      digitado embaixo, como no texto do jogo
//   5. um corte de luz atravessa a tela em diagonal e tudo some

const CASA = 64
const PRETO = 0x05060f

export default async function (arena, kit) {
  const { novo, texto, esperar, tween, vivo, depois, faiscas, lado, nome, carta } = kit
  const cx = LARGURA / 2
  const chao = 330 // onde a espada crava
  const ESCALA_ESPADA = 3

  // ---------- 1. tabuleiro ----------
  const veu = novo(arena.add.rectangle(0, 0, LARGURA, ALTURA, PRETO).setOrigin(0).setAlpha(0).setDepth(95))
  arena.tweens.add({ targets: veu, alpha: 0.88, duration: 180 })

  const colunas = Math.ceil(LARGURA / CASA)
  const linhas = Math.ceil(ALTURA / CASA) + 1
  const oy = (ALTURA - linhas * CASA) / 2
  const casas = []
  for (let r = 0; r < linhas; r++) {
    for (let c = 0; c < colunas; c++) {
      const x = c * CASA + CASA / 2
      const y = oy + r * CASA + CASA / 2
      const img = novo(arena.add.image(x, y, 'super-kris-casa', (c + r) % 2).setDisplaySize(CASA, CASA).setDepth(95).setAlpha(0))
      const sx = img.scaleX
      img.scaleX = 0
      // a onda vem do lado de quem jogou (P1 esquerda, P2 direita)
      const ordem = lado < 0 ? c : colunas - 1 - c
      arena.tweens.add({ targets: img, scaleX: sx, alpha: 0.5, delay: 60 + ordem * 32 + r * 14, duration: 150, ease: 'Back.easeOut' })
      casas.push({ img, x, y, sx })
    }
  }
  for (let i = 0; i < 4; i++) depois(80 + i * 90, () => tocar(arena, 'super-kris-tique'))

  // as três peças pulam pelo tabuleiro (cavalo em L, bispo na diagonal, torre reta)
  const pecas = [
    { quadro: 0, de: [cx - 3 * CASA, chao - CASA], passos: [[2, -1], [1, 0]] },
    { quadro: 1, de: [cx + 3 * CASA, chao - 2 * CASA], passos: [[-1, 1], [-1, 1]] },
    { quadro: 2, de: [cx + lado * 4 * CASA, chao + CASA * 0.5], passos: [[-lado * 2, 0]] },
  ].map((p) => {
    const img = novo(arena.add.image(p.de[0], p.de[1], 'super-kris-pecas', p.quadro).setScale(0).setDepth(96).setOrigin(0.5, 0.85))
    arena.tweens.add({ targets: img, scale: 2.4, duration: 200, delay: 250 + p.quadro * 70, ease: 'Back.easeOut' })
    let x = p.de[0]
    let y = p.de[1]
    p.passos.forEach(([dx, dy], i) => {
      x += dx * CASA * 0.5
      y += dy * CASA * 0.5
      const destino = { x, y }
      depois(480 + p.quadro * 60 + i * 210, () => {
        arena.tweens.add({ targets: img, x: destino.x, duration: 180, ease: 'Sine.easeInOut' })
        arena.tweens.add({ targets: img, y: destino.y - 22, duration: 90, yoyo: true, ease: 'Quad.easeOut', onComplete: () => vivo() && img.setY(destino.y) })
      })
    })
    return img
  })

  await esperar(950)
  if (!vivo()) return

  // ---------- 2. a espada crava ----------
  const espada = novo(arena.add.image(cx, -260, 'super-kris-espada').setScale(ESCALA_ESPADA).setDepth(97).setOrigin(0.5, 1))
  // sombra que cresce no chão antes da espada chegar
  const sombra = novo(arena.add.ellipse(cx, chao, 20, 6, 0x000000, 0.5).setDepth(96))
  arena.tweens.add({ targets: sombra, width: 120, height: 22, duration: 200 })
  await tween({ targets: espada, y: chao + 18, duration: 220, ease: 'Cubic.easeIn' })
  if (!vivo()) return
  tocar(arena, 'super-kris-crava')
  novo(flashTela(arena, 0xdff4ff, 0.75, 300)).setDepth(99)
  shake(arena, 340, 0.018)
  const racha = novo(arena.add.image(cx, chao + 8, 'super-kris-impacto').setDepth(96).setScale(0.5).setAlpha(0.95))
  arena.tweens.add({ targets: racha, scale: 4.2, alpha: 0.55, duration: 260, ease: 'Cubic.easeOut' })
  faiscas(cx, chao, 0x8fdcff, 34)
  // as casas acendem em anel a partir da espada
  for (const k of casas) {
    const d = Math.hypot(k.x - cx, k.y - chao)
    arena.tweens.add({ targets: k.img, alpha: 0.95, delay: d * 0.9, duration: 90, yoyo: true, hold: 60 })
    arena.tweens.add({ targets: k.img, scaleY: k.img.scaleY * 0.6, delay: d * 0.9, duration: 80, yoyo: true })
  }
  // xeque-mate: as peças voam longe girando
  pecas.forEach((img, i) => {
    const sentido = img.x < cx ? -1 : 1
    arena.tweens.add({ targets: img, x: img.x + sentido * (260 + i * 40), y: img.y - 160 - i * 30, rotation: sentido * (5 + i), alpha: 0, duration: 650, ease: 'Quad.easeOut' })
  })

  await esperar(240)
  if (!vivo()) return

  // ---------- 3. a alma desce até a guarda e bate ----------
  const guardaY = espada.y - (76 - 13) * ESCALA_ESPADA // guarda da espada (linha 13 do sprite de 76)
  const alma = novo(arena.add.image(cx, -40, 'coracao').setTint(0xff2438).setScale(3.2).setDepth(97))
  await tween({ targets: alma, y: guardaY, duration: 260, ease: 'Back.easeOut' })
  if (!vivo()) return
  const quem = texto(cx, 14, nome, 22, '#8fdcff', { strokeThickness: 5 }).setAlpha(0)
  arena.tweens.add({ targets: quem, alpha: 1, y: 26, duration: 220 })
  for (let b = 0; b < 2; b++) {
    depois(b * 330, () => {
      tocar(arena, 'super-kris-pulso')
      arena.tweens.add({ targets: alma, scale: 4.4, duration: 90, yoyo: true, ease: 'Quad.easeOut' })
      const anel = novo(arena.add.circle(cx, guardaY, 10).setStrokeStyle(6, 0xff2438, 0.9).setDepth(96))
      arena.tweens.add({ targets: anel, radius: 420, alpha: 0, duration: 650, ease: 'Cubic.easeOut' })
      // o anel tinge de vermelho as casas por onde passa
      for (const k of casas) {
        const d = Math.hypot(k.x - cx, k.y - guardaY)
        depois(d * 1.5, () => {
          k.img.setTint(0xff6a7a)
          depois(120, () => k.img.clearTint())
        })
      }
    })
  }

  // ---------- 4. SUPER letra por letra + nome do golpe digitado ----------
  const palavra = 'SUPER'
  const linhaY = 80
  const letras = []
  const placas = []
  for (let i = 0; i < palavra.length; i++) {
    const x = cx + (i - (palavra.length - 1) / 2) * CASA
    depois(120 + i * 85, () => {
      const casa = novo(arena.add.rectangle(x, linhaY, CASA - 6, CASA - 6, 0x1f48aa, 0.95).setStrokeStyle(3, 0x8fdcff).setDepth(97).setScale(0))
      arena.tweens.add({ targets: casa, scale: 1, duration: 120, ease: 'Back.easeOut' })
      placas.push(casa)
      const l = texto(x, linhaY - 70, palavra[i], 50, '#ffe14a', { strokeThickness: 8 }).setAlpha(0)
      arena.tweens.add({ targets: l, y: linhaY, alpha: 1, duration: 140, ease: 'Bounce.easeOut' })
      tocar(arena, 'super-kris-tique')
      letras.push(l)
    })
  }
  const golpe = (carta?.nome ?? '').toUpperCase()
  const digitado = texto(cx, 418, '', 24, '#ffffff', { strokeThickness: 6 })
  await esperar(560)
  if (!vivo()) return
  for (let i = 1; i <= golpe.length; i++) {
    digitado.setText(`* ${golpe.slice(0, i)}`)
    if (golpe[i - 1] !== ' ' && i % 2) tocar(arena, 'super-kris-tique')
    await esperar(32)
    if (!vivo()) return
  }
  // as letras de SUPER dão um pulinho juntas
  arena.tweens.add({ targets: letras, y: linhaY - 10, duration: 110, yoyo: true, repeat: 1, ease: 'Sine.easeOut' })

  await esperar(Math.max(260, 900 - golpe.length * 32))
  if (!vivo()) return

  // ---------- 5. o corte atravessa a tela e tudo some ----------
  tocar(arena, 'super-kris-corte')
  // vem do lado de quem jogou, subindo em diagonal
  const corte = novo(arena.add.image(cx + lado * 900, ALTURA / 2 + 220, 'super-kris-corte').setDepth(99).setDisplaySize(900, 60))
  corte.setRotation(lado < 0 ? -0.24 : 0.24)
  arena.tweens.add({ targets: corte, x: cx - lado * 900, y: ALTURA / 2 - 220, duration: 300, ease: 'Cubic.easeIn' })
  await esperar(150)
  if (!vivo()) return
  novo(flashTela(arena, 0xffffff, 0.6, 220)).setDepth(99)
  const resto = casas.map((k) => k.img)
  arena.tweens.add({ targets: resto, scaleY: 0, duration: 200, ease: 'Cubic.easeIn' })
  await tween({ targets: [veu, espada, alma, racha, sombra, quem, digitado, ...letras, ...placas], alpha: 0, duration: 260 })
}
