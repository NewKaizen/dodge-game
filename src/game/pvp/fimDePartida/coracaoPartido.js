import { tocar } from '../../audio.js'
import { shake } from '../../effects/shake.js'

// O coração quebrando no golpe final (câmera lenta do fim da partida), como
// no Undertale: pisca branco, trinca em duas metades (corte em zigue-zague),
// as metades se afastam um pouco e estilhaçam em cacos que caem.
//
//   const quebra = quebrarCoracao(cena, { x, y, cor, escala, profundidade, vagar, tremer })
//   quebra.destruir()
//
// Tudo no relógio da cena (tweens/time/partículas): com a câmera lenta
// ligada (FimDePartida.fator) a quebra acontece devagar. Desenhado pela
// câmera principal (os cacos podem voar para fora da caixa). O replay
// (transmissao.js) usa a mesma quebra por cima da foto do golpe, esticada no
// tempo (vagar: 3 = três vezes mais devagar, cacos caindo em câmera lenta) e
// tremendo só a câmera dele (tremer). Tempos em ms de jogo (vagar = 1):
export const QUEBRA = { trincaMs: 30, estilhacaMs: 250, afastar: 2.4 }

// Texturas (uma vez por jogo): as duas metades do 'coracao' e o caco
export function prepararTexturasCoracao(cena) {
  const tex = cena.textures
  if (tex.exists('fim-coracao-esq')) return
  const fonte = tex.get('coracao').getSourceImage()
  const w = fonte.width
  const h = fonte.height
  // zigue-zague de cima a baixo pelo meio
  const passos = 5
  const corte = Array.from({ length: passos + 1 }, (_, i) => [w / 2 + (i % 2 ? 1 : -1) * Math.max(1, w * 0.12), (h * i) / passos])
  const metade = (chave, borda) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')
    g.imageSmoothingEnabled = false
    g.beginPath()
    g.moveTo(borda, 0)
    for (const [x, y] of corte) g.lineTo(x, y)
    g.lineTo(borda, h)
    g.closePath()
    g.clip()
    g.drawImage(fonte, 0, 0)
    tex.addCanvas(chave, c)
  }
  metade('fim-coracao-esq', 0)
  metade('fim-coracao-dir', w)
  // caco: lasquinha de 4x4
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 4
  const g = c.getContext('2d')
  g.fillStyle = '#ffffff'
  for (const [x, y] of [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2], [2, 3]]) g.fillRect(x, y, 1, 1)
  tex.addCanvas('fim-caco', c)
}

export function quebrarCoracao(cena, { x, y, cor, escala = 1.4, profundidade = 31, vagar = 1, tremer = () => shake(cena, 160, 0.006) }) {
  prepararTexturasCoracao(cena)
  const objetos = []
  const novo = (o) => (objetos.push(o), o)
  const inteiro = novo(cena.add.image(x, y, 'coracao').setTint(cor).setScale(escala).setDepth(profundidade))
  // o 'coracao' é branco: sem tint, por cima, é o clarão do golpe (mistura
  // normal: o ADD saía escuro numa câmera com fundo próprio, a do replay)
  const branco = novo(cena.add.image(x, y, 'coracao').setScale(escala * 1.15).setDepth(profundidade + 1))
  cena.tweens.add({ targets: branco, alpha: 0, scale: escala * 1.6, duration: 140 * vagar })
  // tremidinha antes de trincar
  cena.tweens.add({ targets: inteiro, x: x + 1.2, duration: 10 * vagar, yoyo: true, repeat: Math.round(vagar) })

  cena.time.delayedCall(QUEBRA.trincaMs * vagar, () => {
    if (!inteiro.scene) return
    inteiro.setVisible(false)
    tocar(cena, 'trincar')
    tremer()
    for (const [lado, chave] of [
      [-1, 'fim-coracao-esq'],
      [1, 'fim-coracao-dir'],
    ]) {
      const m = novo(cena.add.image(x, y, chave).setTint(cor).setScale(escala).setDepth(profundidade))
      cena.tweens.add({
        targets: m,
        x: x + lado * QUEBRA.afastar * escala,
        y: y + 0.6 * escala,
        angle: lado * 9,
        duration: (QUEBRA.estilhacaMs - QUEBRA.trincaMs) * vagar,
        ease: 'Quad.easeOut',
      })
    }
  })

  cena.time.delayedCall(QUEBRA.estilhacaMs * vagar, () => {
    if (!inteiro.scene) return
    objetos.forEach((o) => o.setVisible(false))
    tocar(cena, 'estilhacar')
    const cacos = cena.add.particles(x, y, 'fim-caco', {
      speed: { min: 60, max: 150 },
      angle: { min: 200, max: 340 },
      gravityY: 320,
      lifespan: { min: 900, max: 1300 },
      rotate: { min: 0, max: 360 },
      scale: escala * 1.1,
      tint: cor,
      emitting: false,
    })
    cacos.setDepth(profundidade)
    cacos.timeScale = 1 / vagar
    cacos.explode(9)
    objetos.push(cacos)
  })

  return {
    destruir() {
      objetos.forEach((o) => o.scene && o.destroy())
      objetos.length = 0
    },
  }
}
