import Phaser from 'phaser'
import { distorcerEParar, tocar } from '../audio.js'
import { ajustarCamera } from '../resolucao.js'
import { ESCALA } from '../arte/texturas.js'
import { LARGURA, ALTURA, LAYOUT } from '../constants.js'
import { flashTela } from './flash.js'
import { ignorarNasCaixas } from '../recorte.js'

// O momento da derrota, dentro da Battle (quando o último membro cai):
//   o mundo congela e perde a cor, a música afunda e morre, o(s) coração(ões)
//   vai(vão) sozinho(s) para o centro, bate(m) fraco, treme(m), racha(m) e
//   se parte(m) em cacos. Depois um silêncio curto e aoTerminar().
//
// O coração é desenhado por uma câmera própria ("palco"), por cima da câmera
// principal: assim o filtro que tira a cor da tela não pega nele.
//
//   derrota(cena, aoTerminar)

// Momentos (ms desde a queda; seguem o relógio dos tweens, como Battle.esperar)
const T = {
  mover: 260, // corações começam a ir para o centro
  batida1: 1400,
  batida2: 2000,
  tremer: 2350,
  rachar: 2950,
  partir: 3750,
  explodir: 4080,
  escuro: 4800,
  fim: 5650, // ~1 s de silêncio depois dos cacos
}
const MUSICA_MS = 2700 // a música afunda até morrer
const CONGELA_MS = 650 // o resto da tela desacelera até quase parar
const LENTO = 0.04 // velocidade final das animações congeladas
const ESCALA_FINAL = 4.4 // tamanho do coração no centro (11x10 px de arte)
const CENTRO = { x: LARGURA / 2, y: 196 }
const SEPARACAO = 110 // distância entre os corações com 2 jogadores
const GRAVIDADE = 900 // px/s² dos cacos

export function derrota(cena, aoTerminar) {
  const principal = cena.cameras.main
  const em = (ms, fn) => cena.tweens.addCounter({ from: 0, to: 1, duration: ms, onComplete: fn })
  const animar = (ms, fn, ease = 'Linear') => cena.tweens.addCounter({ from: 0, to: 1, duration: ms, ease, onUpdate: (tw) => fn(tw.getValue()) })

  // o que já estava animando antes da queda (chefe, party, fundo...) vai congelar
  const congelados = cena.tweens.getTweens()

  // impacto (antes do palco existir: fica só na câmera principal)
  principal.shake(320, 0.016)
  flashTela(cena, 0xffffff, 0.45, 320)
  distorcerEParar(MUSICA_MS, { sombrio: true })

  // véu escuro por cima do campo de batalha
  const veu = cena.add.rectangle(0, 0, LARGURA, ALTURA, 0x000000).setOrigin(0).setDepth(95).setAlpha(0)
  ignorarNasCaixas(cena, veu)
  animar(1700, (p) => veu.setAlpha(0.62 * p), 'Quad.easeOut')

  // ---------- o mundo congela e perde a cor ----------
  const velocidadeFundo = cena.fundo?.estado.velocidade ?? 1
  animar(
    CONGELA_MS,
    (p) => {
      const v = 1 - (1 - LENTO) * p
      congelados.forEach((tw) => (tw.timeScale = v))
      if (cena.fundo) cena.fundo.estado.velocidade = velocidadeFundo * v
    },
    'Quad.easeOut',
  )
  const filtro = principal.filters?.internal.addColorMatrix?.()
  if (filtro) {
    animar(
      1500,
      (p) => {
        filtro.colorMatrix.reset()
        filtro.colorMatrix.saturate(-p)
        filtro.colorMatrix.brightness(1 - 0.35 * p, true)
      },
      'Sine.easeInOut',
    )
  }

  // ---------- palco: câmera só do coração ----------
  const palco = ajustarCamera(cena.cameras.add())
  palco.ignore(cena.children.list)
  const noPalco = (obj) => {
    principal.ignore(obj)
    ignorarNasCaixas(cena, obj)
    return obj
  }

  const lista = cena.coracoes ?? []
  const almas = lista.map((c, j) => {
    const x0 = c.x || LAYOUT.caixa.x
    const y0 = c.y || LAYOUT.caixa.y
    const halo = noPalco(cena.add.image(x0, y0, 'brilho').setTint(c.cor).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(0.5).setDepth(199))
    const sprite = noPalco(cena.add.image(x0, y0, 'coracao').setTint(c.cor).setScale(ESCALA.coracao).setDepth(200))
    return { halo, sprite, cor: c.cor, x: CENTRO.x + (j - (lista.length - 1) / 2) * SEPARACAO, y: CENTRO.y, tremor: 0 }
  })

  // "pop" no instante da queda
  for (const a of almas) {
    a.sprite.setScale(ESCALA.coracao * 2)
    cena.tweens.add({ targets: a.sprite, scale: ESCALA.coracao * 1.2, duration: 220, ease: 'Quad.easeOut' })
  }

  // cada quadro: halo segue o coração e o tremor sacode em volta da posição
  const cacos = []
  const aCadaQuadro = (_, delta) => {
    for (const a of almas) {
      if (a.tremor > 0) {
        a.sprite.x = a.base.x + Phaser.Math.FloatBetween(-a.tremor, a.tremor)
        a.sprite.y = a.base.y + Phaser.Math.FloatBetween(-a.tremor, a.tremor) * 0.6
      }
      a.halo.setPosition(a.sprite.x, a.sprite.y)
    }
    moverCacos(cacos, Math.min(delta, 50) / 1000)
  }
  cena.events.on('update', aCadaQuadro)
  cena.events.once('shutdown', () => cena.events.off('update', aCadaQuadro))

  // ---------- linha do tempo ----------
  em(T.mover, () => {
    for (const a of almas) {
      a.base = { x: a.x, y: a.y }
      cena.tweens.add({ targets: a.sprite, x: a.x, y: a.y, scale: ESCALA_FINAL, duration: 1050, ease: 'Cubic.easeInOut' })
      cena.tweens.add({ targets: a.halo, alpha: 0.55, scale: 2.2, duration: 1050, ease: 'Sine.easeOut' })
    }
  })

  // duas batidas, a segunda já mais fraca
  const bater = (forca, brilho) => {
    tocar(cena, 'batimento')
    for (const a of almas) {
      cena.tweens.add({ targets: a.sprite, scale: ESCALA_FINAL * (1 + forca), duration: 110, yoyo: true, ease: 'Quad.easeOut' })
      a.halo.setAlpha(brilho)
      cena.tweens.add({ targets: a.halo, alpha: brilho * 0.35, scale: 2.4 + forca * 3, duration: 520, ease: 'Quad.easeOut' })
    }
  }
  em(T.batida1, () => bater(0.16, 0.75))
  em(T.batida2, () => bater(0.07, 0.45))

  // tremor crescendo até rachar, e mais forte até partir
  em(T.tremer, () => animar(T.rachar - T.tremer, (p) => almas.forEach((a) => (a.tremor = 0.5 + 2.5 * p)), 'Quad.easeIn'))

  em(T.rachar, () => {
    tocar(cena, 'trincar')
    palco.shake(170, 0.012)
    for (const a of almas) {
      a.sprite.setTexture('coracao-rachado').setTintMode(Phaser.TintModes.FILL).setTint(0xffffff)
      cena.tweens.add({ targets: a.sprite, scale: ESCALA_FINAL * 1.12, duration: 70, yoyo: true })
      em(80, () => a.sprite.setTintMode(Phaser.TintModes.MULTIPLY).setTint(a.cor))
      a.halo.setAlpha(0.6)
      cena.tweens.add({ targets: a.halo, alpha: 0.12, duration: 600 })
      // lasquinhas soltando da rachadura
      for (let k = 0; k < 4; k++) cacos.push(novoCaco(cena, noPalco, a.base.x, a.base.y - 10 + k * 5, a.cor, 0.35))
    }
    animar(T.partir - T.rachar, (p) => almas.forEach((a) => (a.tremor = 1.5 + 3.5 * p)), 'Quad.easeIn')
  })

  em(T.partir, () => {
    tocar(cena, 'quebrar')
    for (const a of almas) {
      a.tremor = 0
      a.sprite.setVisible(false)
      a.metades = ['esq', 'dir'].map((lado, i) => {
        const metade = noPalco(cena.add.image(a.base.x, a.base.y, `coracao-${lado}`).setTint(a.cor).setScale(ESCALA_FINAL).setDepth(200))
        const s = i ? 1 : -1
        cena.tweens.add({ targets: metade, x: a.base.x + s * 13, y: a.base.y + 5, angle: s * 16, duration: 280, ease: 'Quad.easeOut' })
        return metade
      })
    }
  })

  em(T.explodir, () => {
    tocar(cena, 'estilhacar')
    palco.shake(260, 0.02)
    const clarao = noPalco(cena.add.rectangle(0, 0, LARGURA, ALTURA, 0xffffff).setOrigin(0).setDepth(190).setAlpha(0.22))
    cena.tweens.add({ targets: clarao, alpha: 0, duration: 260, onComplete: () => clarao.destroy() })
    for (const a of almas) {
      for (const metade of a.metades) {
        for (let k = 0; k < 11; k++) cacos.push(novoCaco(cena, noPalco, metade.x, metade.y, a.cor, 1))
        metade.destroy()
      }
      faiscas(cena, noPalco, a.base.x, a.base.y, a.cor)
      cena.tweens.add({ targets: a.halo, alpha: 0, scale: 5, duration: 700, ease: 'Quad.easeOut' })
    }
  })

  em(T.escuro, () => animar(600, (p) => veu.setAlpha(0.62 + 0.38 * p), 'Quad.easeIn'))

  em(T.fim, () => {
    cena.events.off('update', aCadaQuadro)
    cena.cameras.remove(palco)
    if (filtro) principal.filters.internal.remove(filtro)
    aoTerminar?.()
  })
}

// Caco do coração: um "pixel" da arte (quadradinho ou triângulo) que voa e cai
function novoCaco(cena, noPalco, x, y, cor, forca) {
  const lado = ESCALA_FINAL * Phaser.Math.FloatBetween(0.7, 1.5)
  const triangulo = Math.random() < 0.45
  const forma = triangulo
    ? cena.add.triangle(x, y, 0, 0, lado * 1.4, lado * 0.3, lado * 0.4, lado * 1.3, cor)
    : cena.add.rectangle(x, y, lado, lado, cor)
  noPalco(forma.setDepth(201))
  const ang = Phaser.Math.FloatBetween(-Math.PI * 0.95, -Math.PI * 0.05) // para cima, abrindo
  const vel = Phaser.Math.FloatBetween(70, 260) * forca
  return {
    forma,
    vx: Math.cos(ang) * vel + Phaser.Math.FloatBetween(-40, 40) * forca,
    vy: Math.sin(ang) * vel,
    giro: Phaser.Math.FloatBetween(-540, 540),
    vida: 0,
  }
}

function moverCacos(cacos, dt) {
  for (let i = cacos.length - 1; i >= 0; i--) {
    const c = cacos[i]
    c.vida += dt
    c.vy += GRAVIDADE * dt
    c.forma.x += c.vx * dt
    c.forma.y += c.vy * dt
    c.forma.angle += c.giro * dt
    // apagam aos poucos depois de um tempo caindo
    if (c.vida > 0.7) c.forma.setAlpha(Math.max(0, 1 - (c.vida - 0.7) / 0.6))
    if (c.forma.y > ALTURA + 20 || c.vida > 1.3) {
      c.forma.destroy()
      cacos.splice(i, 1)
    }
  }
}

function faiscas(cena, noPalco, x, y, cor) {
  const emissor = cena.add.particles(x, y, 'faisca', {
    speed: { min: 60, max: 260 },
    angle: { min: 0, max: 360 },
    lifespan: { min: 350, max: 750 },
    scale: { start: 1.6, end: 0 },
    alpha: { start: 1, end: 0 },
    tint: [cor, 0xffffff],
    blendMode: 'ADD',
    emitting: false,
  })
  noPalco(emissor.setDepth(202))
  emissor.explode(26)
  cena.tweens.addCounter({ from: 0, to: 1, duration: 1000, onComplete: () => emissor.destroy() })
}
