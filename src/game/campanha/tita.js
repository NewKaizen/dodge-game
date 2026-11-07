import Phaser from 'phaser'
import { menosMovimento } from '../preferencias.js'
import { fatores } from '../acessibilidade.js'

// O TITÃ (o chefe do Mundo 1 com regra.titan, docs/campanha.md): o Silêncio grudado no Asriel cresceu
// até atravessar o teto. Na arena ele é o próprio sprite do oponente, GIGANTE, em silhueta escura com
// uma aura violeta, atrás da caixa (só a cabeça e os ombros aparecem em volta dela), respirando
// devagar, com dois olhos que brilham. Só visual.
//
//   const t = criarTita(cena, 'asriel', { x, topo, escala, profundidade })
//   t.atualizar(tempo) · t.olhar(forca) (os olhos acendem: ataque, arremesso)
//   t.apanhar() (você acertou) · t.rachar() (a virada: rachaduras de luz) · t.furia() · t.olhos
// Os olhos do sprite (16×24, arte/sprites.js) ficam nas colunas 6 e 9 da linha 6.
export const OLHOS_NO_SPRITE = [
  { x: 6.5, y: 6.5 },
  { x: 9.5, y: 6.5 },
]
const LARGURA_SPRITE = 16

export function criarTita(cena, textura, { x = 362, topo = -60, escala = 24, profundidade = -5 } = {}) {
  const aura = cena.add.image(x, topo - 6, textura).setOrigin(0.5, 0).setScale(escala * 1.04).setTint(0x7a34c8).setAlpha(0.34).setBlendMode(Phaser.BlendModes.ADD).setDepth(profundidade - 0.2)
  const corpo = cena.add.image(x, topo, textura).setOrigin(0.5, 0).setScale(escala).setTint(0x2a1640).setAlpha(0.96).setDepth(profundidade)
  const luz = cena.add.graphics().setDepth(profundidade + 0.1).setBlendMode(Phaser.BlendModes.ADD)
  const olhos = OLHOS_NO_SPRITE.map((o) => ({ x: x + (o.x - LARGURA_SPRITE / 2) * escala, y: topo + o.y * escala }))
  let brilho = 0.6 // 0..1.5, cai devagar
  let cor = 0xd8b8ff
  let rachado = 0
  let fase = 0
  const rachaduras = []
  const t = {
    corpo,
    olhos,
    get centroDosOlhos() {
      return { x: (olhos[0].x + olhos[1].x) / 2, y: olhos[0].y }
    },
    atualizar(tempo) {
      fase = tempo / 1000
      const mov = !menosMovimento()
      const respira = mov ? Math.sin(fase * 0.9) : 0
      corpo.setScale(escala, escala * (1 + 0.008 * respira))
      aura.setScale(escala * 1.04, escala * 1.04 * (1 + 0.012 * respira)).setAlpha(0.3 + 0.08 * (mov ? Math.sin(fase * 1.7) : 0))
      brilho = Math.max(0.55, brilho - 0.012)
      luz.clear()
      for (const o of olhos) {
        const k = brilho * (mov ? 0.9 + 0.1 * Math.sin(fase * 6) : 1)
        luz.fillStyle(cor, 0.1 * k).fillCircle(o.x, o.y, 26)
        luz.fillStyle(cor, 0.25 * k).fillCircle(o.x, o.y, 15)
        luz.fillStyle(0xffffff, Math.min(1, 0.7 * k)).fillCircle(o.x, o.y, 6)
      }
      // a virada: rachaduras de luz quente no corpo (a luz dos amigos entrando)
      if (rachado > 0) {
        for (const r of rachaduras) {
          luz.lineStyle(3, 0xf2e2b0, 0.35 * rachado).beginPath()
          luz.moveTo(r[0].x, r[0].y)
          for (const p of r.slice(1)) luz.lineTo(p.x, p.y)
          luz.strokePath()
        }
      }
    },
    olhar(forca = 1.4) {
      brilho = Math.max(brilho, forca)
    },
    apanhar() {
      t.olhar(1.1)
      if (menosMovimento()) return
      cena.tweens.add({ targets: [corpo, aura], x: x + 8, duration: 45, yoyo: true, repeat: 3, onComplete: () => (corpo.setX(x), aura.setX(x)) })
      corpo.setTint(0x3a1030)
      cena.time.delayedCall(140, () => corpo.setTint(rachado ? 0x3a2450 : 0x2a1640))
    },
    rachar() {
      rachado = 1
      corpo.setTint(0x3a2450)
      // rachaduras saindo do peito, em zigue-zague (sorteio só visual)
      const cx = x
      const cy = topo + 13 * escala
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI / 2 + (k - 3) * 0.45
        const pts = [{ x: cx, y: cy }]
        let px = cx
        let py = cy
        for (let s = 0; s < 6; s++) {
          px += Math.cos(a) * 26 + (Math.random() - 0.5) * 22
          py += Math.sin(a) * 26 + (Math.random() - 0.5) * 22
          pts.push({ x: px, y: py })
        }
        rachaduras.push(pts)
      }
      t.olhar(1.6)
    },
    furia() {
      cor = 0xff3050
      aura.setTint(0xa01030)
      t.olhar(1.8)
      if (!menosMovimento() && fatores().tremor > 0) cena.cameras.main.shake(500, 0.008 * fatores().tremor)
    },
    destruir() {
      for (const o of [aura, corpo, luz]) o.destroy()
    },
  }
  t.atualizar(0)
  return t
}
