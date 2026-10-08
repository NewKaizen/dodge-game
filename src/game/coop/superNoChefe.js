import Phaser from 'phaser'
import { tocar } from '../audio.js'
import { ignorarNasCaixas } from '../recorte.js'
import { particulas } from '../effects/particulas.js'
import { flashTela } from '../effects/flash.js'
import { shake } from '../effects/shake.js'
import { FONTE } from '../constants.js'
import { garantirTexturas } from '../attacks/super/noelle.js'

// O SUPER de cada personagem ACERTANDO o chefe no CO-OP: espadas cravando,
// machado colossal, fogo, gelo, lâminas, ondas de choque, buraco negro.
// Usa os sprites e sons do SUPER do PvP (pvp/super/sprites/).
//
//   await superNoChefe(arena, personagem, aoImpacto)
//     arena.inimigo   o chefe (entities/Inimigo.js)
//     aoImpacto()     chamado no auge do efeito (a CoopArena tira o HP aí)
// Resolve ~400 ms depois do auge. Tudo que o efeito cria some no fim.

const FRENTE = 40 // na frente do chefe (2) e atrás do texto da mesa
const ATRAS = 1 // atrás do chefe
const TAU = Math.PI * 2
const ARCO_IRIS = [0xff4a5a, 0xffa23a, 0xffe14a, 0x5ae06a, 0x4ab8ff, 0xa66bff]
const sorte = (a, b) => a + Math.random() * (b - a)

function palco(arena) {
  const chefe = arena.inimigo
  const sprite = chefe.sprite
  const objetos = []
  const escalaY = sprite.scaleY
  let vivo = true
  arena.events.once('shutdown', () => (vivo = false))
  const p = {
    arena,
    x: chefe.x,
    y: chefe.y,
    largura: sprite.displayWidth,
    altura: sprite.displayHeight,
    vivo: () => vivo && !arena.saindo,
    novo(obj, prof = FRENTE) {
      obj.setDepth(prof)
      ignorarNasCaixas(arena, obj)
      objetos.push(obj)
      return obj
    },
    grafico(prof = FRENTE) {
      return p.novo(arena.add.graphics(), prof)
    },
    imagem(x, y, chave, { quadro, escala = 1, prof = FRENTE } = {}) {
      return p.novo(arena.add.image(x, y, chave, quadro).setScale(escala), prof)
    },
    depois(ms, fn) {
      arena.time.delayedCall(ms, () => p.vivo() && fn())
    },
    esperar: (ms) => new Promise((r) => arena.time.delayedCall(ms, r)),
    tween: (config) => arena.tweens.add(config),
    som: (nome) => tocar(arena, nome),
    faiscas: (x, y, cor, quantidade = 16, velocidade = 200) => particulas(arena, x, y, { cor, quantidade, velocidade, vida: 600, escala: 1.4 }),
    // o chefe muda de cor por um tempo (queimando, congelado...)
    tingir(cor, ms) {
      sprite.setTintMode(Phaser.TintModes.MULTIPLY).setTint(cor)
      if (ms) arena.time.delayedCall(ms, () => sprite.scene && sprite.setTint(0xffffff))
    },
    // o chefe amassa e volta (só o eixo Y: o X tem a respiração do Inimigo)
    amassar(fator = 0.7, ms = 120) {
      arena.tweens.killTweensOf(sprite, ['scaleY'])
      sprite.scaleY = escalaY * fator
      arena.tweens.add({ targets: sprite, scaleY: escalaY, duration: ms * 3, ease: 'Elastic.easeOut' })
    },
    balancar(angulo = 12, ms = 60, vezes = 4) {
      arena.tweens.add({ targets: sprite, angle: { from: -angulo, to: angulo }, duration: ms, yoyo: true, repeat: vezes, onComplete: () => (sprite.angle = 0) })
    },
    // clarão em estrela no meio do chefe (o auge dos efeitos sem sprite de impacto)
    estouro(cor, escala = 9) {
      for (const [k, c] of [[1, cor], [0.55, 0xffffff]]) {
        const luz = p.imagem(p.x, p.y, 'faisca', { escala: 0.5 }).setTint(c)
        p.tween({ targets: luz, scale: escala * k, alpha: 0, angle: 90, duration: 380, ease: 'Quad.easeOut' })
      }
      const anel = p.grafico()
      anel.lineStyle(4, cor, 1).strokeCircle(0, 0, 20)
      anel.setPosition(p.x, p.y)
      p.tween({ targets: anel, scale: 6, alpha: 0, duration: 450, ease: 'Quad.easeOut' })
    },
    // o golpe de verdade: pisca, treme e a cena tira o HP
    impacto(aoImpacto, { cor = 0xffffff, forca = 0.018 } = {}) {
      chefe.dano(1)
      flashTela(arena, cor, 0.45, 220)
      shake(arena, 360, forca)
      aoImpacto?.()
    },
    limpar() {
      for (const o of objetos) if (o.scene) o.destroy()
      sprite.setTint(0xffffff)
      sprite.angle = 0
      sprite.scaleY = escalaY
    },
  }
  return p
}

// ---------- Kris: espadas cravam em volta e o corte em X ----------
async function kris(p, aoImpacto) {
  const alma = p.imagem(p.x, p.y, 'coracao', { escala: 0, prof: ATRAS }).setTint(0xff2030).setAlpha(0.85)
  p.tween({ targets: alma, scale: 7, duration: 260, ease: 'Back.easeOut' })
  p.tween({ targets: alma, scale: 6, delay: 280, duration: 180, yoyo: true, repeat: 3 })
  p.som('super-kris-pulso')
  const posicoes = [-0.9, 0.9, -0.5, 0.5, -0.15, 0.15]
  posicoes.forEach((f, i) =>
    p.depois(160 + i * 110, () => {
      const x = p.x + f * p.largura * 0.6
      const espada = p.imagem(x, p.y - 220, 'super-kris-espada', { escala: 1.6 }).setAngle(180 + f * 20)
      p.tween({
        targets: espada,
        y: p.y + sorte(-10, 30),
        duration: 140,
        ease: 'Quad.easeIn',
        onComplete: () => {
          p.som('super-kris-crava')
          p.faiscas(x, espada.y + 40, 0x9fd0ff, 10, 160)
          p.balancar(4, 30, 1)
        },
      })
    }),
  )
  await p.esperar(980)
  // corte em X por cima de tudo
  for (const ang of [-35, 35]) {
    const corte = p.imagem(p.x, p.y, 'super-kris-corte', { escala: 2.2 }).setAngle(ang).setScale(0, 2.2)
    p.tween({ targets: corte, scaleX: 2.2, duration: 90, ease: 'Quad.easeOut' })
    p.tween({ targets: corte, alpha: 0, scaleY: 5, delay: 220, duration: 300 })
  }
  p.som('super-kris-corte')
  p.impacto(aoImpacto, { cor: 0xff2030 })
  p.estouro(0xff2030)
  p.faiscas(p.x, p.y, 0xffffff, 30, 300)
  p.faiscas(p.x, p.y, 0xff2030, 20, 220)
  p.tween({ targets: alma, scale: 12, alpha: 0, duration: 400 })
}

// ---------- Susie: o machado colossal desce no chefe ----------
async function susie(p, aoImpacto) {
  const machado = p.imagem(p.x + 40, p.y - 190, 'super-susie-machado', { escala: 2.4 }).setAngle(-70).setAlpha(0)
  p.tween({ targets: machado, alpha: 1, angle: -110, duration: 420, ease: 'Sine.easeOut' })
  p.som('super-susie-buster')
  await p.esperar(560)
  p.tween({ targets: machado, angle: 20, x: p.x + 10, y: p.y - 40, duration: 180, ease: 'Quad.easeIn' })
  await p.esperar(180)
  p.som('super-susie-pancada')
  p.amassar(0.55, 160)
  p.impacto(aoImpacto, { cor: 0xb05cff, forca: 0.028 })
  p.imagem(p.x, p.y + 10, 'super-susie-impacto', { escala: 3.5 })
  for (let i = 0; i < 4; i++) {
    const racha = p.imagem(p.x + (i - 1.5) * 34, p.y + p.altura / 2 - 6, 'super-susie-racha', { escala: 2.2, prof: ATRAS + 2 })
    racha.setAngle(sorte(-30, 30))
  }
  for (let i = 0; i < 12; i++) {
    const pedra = p.imagem(p.x + sorte(-30, 30), p.y + 20, 'super-susie-pedra', { quadro: i % 4, escala: 2 })
    const ang = sorte(-Math.PI * 0.95, -Math.PI * 0.05)
    const dist = sorte(80, 180)
    p.tween({ targets: pedra, x: pedra.x + Math.cos(ang) * dist, y: pedra.y + Math.sin(ang) * dist * 0.6 + 90, angle: sorte(-360, 360), alpha: 0, duration: 700, ease: 'Quad.easeOut' })
  }
  p.faiscas(p.x, p.y, 0xffd23c, 26, 260)
  p.som('super-susie-desaba')
  p.tween({ targets: machado, alpha: 0, angle: 40, delay: 260, duration: 300 })
}

// ---------- Ralsei: a sombra do dragão e o chefe pegando fogo ----------
async function ralsei(p, aoImpacto) {
  const dragao = p.imagem(p.x, p.y - 30, 'super-ralsei-sombra-dragao', { escala: 1.8, prof: ATRAS }).setAlpha(0)
  p.tween({ targets: dragao, alpha: 0.85, scale: 2.1, duration: 500 })
  p.som('super-ralsei-dragao')
  p.tingir(0xffa060)
  // labaredas subindo em volta do chefe
  for (let i = 0; i < 22; i++) {
    p.depois(i * 45, () => {
      const x = p.x + sorte(-p.largura / 2, p.largura / 2)
      const chama = p.imagem(x, p.y + p.altura / 2, 'super-ralsei-chama', { quadro: i % 3, escala: sorte(2, 3.2) })
      p.tween({ targets: chama, y: chama.y - sorte(80, 150), alpha: 0, scale: 0.6, duration: 600, ease: 'Quad.easeOut' })
    })
    if (i % 6 === 0) p.depois(i * 45, () => p.som('super-ralsei-sopro'))
  }
  p.depois(400, () => p.tingir(0xff7030))
  await p.esperar(1050)
  // o sopro do dragão atravessa o chefe
  for (const [dy, atraso] of [[-20, 0], [20, 90]]) {
    p.depois(atraso, () => {
      const lamina = p.imagem(p.x - 260, p.y + dy, 'super-ralsei-lamina-fogo', { escala: 2.4 })
      p.tween({ targets: lamina, x: p.x + 260, duration: 260, ease: 'Quad.easeIn' })
      p.tween({ targets: lamina, alpha: 0, delay: 200, duration: 120 })
    })
  }
  await p.esperar(140)
  p.impacto(aoImpacto, { cor: 0xff8a30, forca: 0.022 })
  p.faiscas(p.x, p.y, 0xff8a30, 34, 300)
  p.faiscas(p.x, p.y, 0xffe14a, 24, 220)
  p.depois(140, () => p.tingir(0x5a3020, 700)) // tostado
  p.tween({ targets: dragao, alpha: 0, scale: 2.6, delay: 150, duration: 400 })
}

// ---------- Noelle: SNOWGRAVE (o selo, a nevasca e o túmulo de gelo) ----------
async function noelle(p, aoImpacto) {
  garantirTexturas(p.arena)
  p.som('snowgraveFrio')
  // o selo de gelo se abre atrás do chefe, girando
  const selo = p.imagem(p.x, p.y, 'super-noelle-selo', { escala: 0.1, prof: ATRAS }).setTint(0xbfe8ff).setAlpha(0.85)
  p.tween({ targets: selo, scale: 2.6, duration: 700, ease: 'Back.easeOut' })
  p.tween({ targets: selo, angle: -120, duration: 2000 })
  // nevasca em volta do chefe
  for (let i = 0; i < 40; i++) {
    const floco = p.imagem(p.x + sorte(-200, 200), p.y - sorte(100, 220), 'super-noelle-floco', { escala: sorte(0.6, 1.4) }).setTint(0xeaf7ff)
    p.tween({ targets: floco, y: floco.y + sorte(220, 340), x: floco.x - sorte(30, 90), angle: sorte(-180, 180), alpha: 0, duration: sorte(900, 1500), delay: i * 18 })
  }
  p.depois(300, () => p.tingir(0x9fd8ff))
  await p.esperar(620)
  // o nome, em gelo, por cima do chefe
  p.som('snowgrave')
  const nome = p.novo(
    p.arena.add.text(p.x, p.y - p.altura / 2 - 34, 'SNOWGRAVE', { fontFamily: FONTE, fontSize: '22px', color: '#eaf7ff', stroke: '#0b2a55', strokeThickness: 6 }).setOrigin(0.5).setAlpha(0).setScale(1.8),
    FRENTE + 2,
  )
  p.tween({ targets: nome, alpha: 1, scale: 1, duration: 360, ease: 'Back.easeOut' })
  p.tingir(0x7fc8ff)
  // colunas de gelo explodem do chão em volta e por baixo do chefe
  for (let k = 0; k < 9; k++) {
    p.depois(k * 55, () => {
      const x = p.x + (k - 4) * (p.largura / 5)
      const cristal = p.imagem(x, p.y + p.altura / 2 + 20, 'super-noelle-pingente', { escala: 1 }).setFlipY(true).setOrigin(0.5, 1).setScale(1.4, 0.1)
      p.tween({ targets: cristal, scaleY: 2.6 + Math.abs(4 - k) * -0.25 + 1, duration: 130, ease: 'Back.easeOut' })
      p.faiscas(x, p.y + p.altura / 2, 0xffffff, 6, 160)
      if (k % 3 === 0) p.som('super-noelle-estilhaco')
    })
  }
  await p.esperar(9 * 55 + 260)
  // o túmulo se fecha e estilhaça
  p.som('snowgraveFim')
  p.impacto(aoImpacto, { cor: 0xffffff, forca: 0.026 })
  p.imagem(p.x, p.y, 'super-noelle-impacto', { escala: 5.5 })
  p.faiscas(p.x, p.y, 0xbfefff, 44, 340)
  p.faiscas(p.x, p.y, 0xffffff, 30, 260)
  p.tween({ targets: selo, scale: 4, alpha: 0, duration: 500 })
  p.tween({ targets: nome, alpha: 0, delay: 300, duration: 300 })
  p.depois(140, () => p.tingir(0xa8e0ff, 700)) // congelado ainda
}

// ---------- Berdly: lâminas em espiral e o raio da resposta certa ----------
async function berdly(p, aoImpacto) {
  const laminas = Array.from({ length: 5 }, (_, i) => p.imagem(p.x, p.y, 'super-berdly-lamina', { escala: 1.1 }).setData('a', (i / 5) * TAU))
  p.som('super-berdly-giro')
  const giro = p.tween({
    targets: { t: 0 },
    t: 1,
    duration: 1100,
    ease: 'Sine.easeIn',
    onUpdate: (tw, alvo) => {
      const raio = 150 - 110 * alvo.t
      laminas.forEach((l) => {
        const a = l.getData('a') + alvo.t * TAU * 2.5
        l.setPosition(p.x + Math.cos(a) * raio, p.y + Math.sin(a) * raio * 0.6).setRotation(a + Math.PI / 2)
      })
    },
  })
  for (let i = 0; i < 10; i++) {
    p.depois(i * 100, () => {
      const pagina = p.imagem(p.x + sorte(-160, 160), p.y + sorte(-90, 90), 'super-berdly-pagina', { quadro: i % 3, escala: 2 })
      p.tween({ targets: pagina, x: p.x, y: p.y, alpha: 0, angle: sorte(-180, 180), duration: 500, ease: 'Quad.easeIn' })
    })
  }
  p.depois(550, () => p.som('super-berdly-vento'))
  await p.esperar(1100)
  giro.stop()
  laminas.forEach((l) => p.tween({ targets: l, scale: 0, alpha: 0, duration: 150 }))
  // o raio desce do céu
  const raio = p.imagem(p.x, p.y - 140, 'super-berdly-feixe', { escala: 2 }).setAngle(90).setScale(2, 0)
  p.tween({ targets: raio, scaleY: 3, duration: 80 })
  p.tween({ targets: raio, alpha: 0, delay: 240, duration: 260 })
  p.som('super-berdly-estalo')
  p.impacto(aoImpacto, { cor: 0xffe14a })
  p.imagem(p.x, p.y, 'super-berdly-impacto', { escala: 4.5 })
  p.faiscas(p.x, p.y, 0xd8f05a, 32, 300)
  p.faiscas(p.x, p.y, 0xffffff, 18, 220)
  p.balancar(10, 50, 5)
}

// ---------- Dess: o solo de guitarra e a onda de choque do whammy ----------
async function dess(p, aoImpacto) {
  const gx = p.x - p.largura / 2 - 70
  const guitarra = p.imagem(gx, p.y + 20, 'super-dess-guitarra', { escala: 2.2 }).setAngle(-25).setAlpha(0)
  p.tween({ targets: guitarra, alpha: 1, angle: -10, duration: 240, ease: 'Back.easeOut' })
  p.tween({ targets: guitarra, angle: -30, delay: 260, duration: 140, yoyo: true, repeat: 3 })
  for (let i = 0; i < 12; i++) {
    p.depois(160 + i * 75, () => {
      if (i % 4 === 0) p.som('super-dess-acorde')
      const nota = p.imagem(gx + 20, p.y - 10, 'super-dess-nota', { escala: 2.2 }).setTint(ARCO_IRIS[i % ARCO_IRIS.length])
      const alto = sorte(60, 140)
      p.tween({ targets: nota, x: p.x + sorte(-30, 30), duration: 420, ease: 'Linear' })
      p.tween({ targets: nota, y: p.y - alto, duration: 210, yoyo: true, ease: 'Sine.easeOut', onComplete: () => nota.destroy() })
      p.depois(420, () => p.amassar(0.9, 60)) // o chefe "pula" no ritmo
    })
  }
  await p.esperar(1180)
  // mergulho do whammy: anéis de choque saindo do chefe
  p.som('super-dess-mergulho')
  for (let k = 0; k < 4; k++) {
    p.depois(k * 90, () => {
      const anel = p.grafico()
      anel.lineStyle(6, k % 2 ? 0xff5070 : 0xffffff, 1).strokeCircle(0, 0, 30)
      anel.setPosition(p.x, p.y)
      p.tween({ targets: anel, scale: 6, alpha: 0, duration: 600, ease: 'Quad.easeOut' })
    })
  }
  await p.esperar(120)
  p.som('super-dess-estouro')
  p.impacto(aoImpacto, { cor: 0xff5070 })
  p.estouro(0xff5070)
  p.faiscas(p.x, p.y, 0xff5070, 30, 300)
  p.balancar(14, 45, 6)
  p.tween({ targets: guitarra, alpha: 0, duration: 300, delay: 200 })
}

// ---------- Asriel: buraco negro engole o chefe e vira supernova ----------
async function asriel(p, aoImpacto) {
  const buraco = p.imagem(p.x, p.y, 'super-asriel-buraco', { quadro: 0, escala: 0, prof: ATRAS })
  p.tween({ targets: buraco, scale: 3.4, duration: 500, ease: 'Back.easeOut' })
  p.tween({ targets: buraco, angle: 360, duration: 1400 })
  let quadro = 0
  const anim = p.arena.time.addEvent({ delay: 90, repeat: 14, callback: () => buraco.scene && buraco.setFrame(++quadro % 6) })
  p.som('super-asriel-pulso')
  p.tingir(0xb08cff)
  // estrelas caindo em espiral para o centro
  for (let i = 0; i < 18; i++) {
    p.depois(i * 55, () => {
      const a = sorte(0, TAU)
      const r = sorte(150, 220)
      const estrela = p.imagem(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.7, 'super-asriel-estrelas', { quadro: i % 6, escala: 1.8 })
      p.tween({ targets: estrela, x: p.x, y: p.y, scale: 0.3, angle: 540, duration: 520, ease: 'Cubic.easeIn', onComplete: () => estrela.destroy() })
    })
  }
  p.balancar(6, 70, 8)
  p.depois(600, () => p.som('super-asriel-colapso'))
  await p.esperar(1150)
  anim.remove()
  p.tween({ targets: buraco, scale: 0, duration: 140, ease: 'Quad.easeIn' })
  await p.esperar(140)
  // supernova
  p.som('super-asriel-estoura')
  const nova = p.imagem(p.x, p.y, 'super-asriel-nova', { escala: 0.5 })
  p.tween({ targets: nova, scale: 6, alpha: 0, duration: 650, ease: 'Quad.easeOut' })
  ARCO_IRIS.forEach((cor, k) =>
    p.depois(k * 50, () => {
      const anel = p.grafico()
      anel.lineStyle(5, cor, 1).strokeCircle(0, 0, 24)
      anel.setPosition(p.x, p.y)
      p.tween({ targets: anel, scale: 8, alpha: 0, duration: 700, ease: 'Quad.easeOut' })
    }),
  )
  p.impacto(aoImpacto, { cor: 0xffffff, forca: 0.024 })
  p.faiscas(p.x, p.y, 0xffe14a, 30, 340)
  p.faiscas(p.x, p.y, 0xa66bff, 24, 260)
}

// ---------- outro personagem: estrela dourada ----------
async function padrao(p, aoImpacto) {
  const estrela = p.imagem(p.x, p.y - 160, 'faisca', { escala: 0 }).setTint(0xffe14a)
  p.tween({ targets: estrela, scale: 8, y: p.y, duration: 700, ease: 'Cubic.easeIn' })
  await p.esperar(700)
  p.impacto(aoImpacto, { cor: 0xffe14a })
  p.faiscas(p.x, p.y, 0xffe14a, 36, 300)
}

const EFEITOS = { kris, susie, ralsei, noelle, berdly, dess, asriel }

export async function superNoChefe(arena, personagem, aoImpacto) {
  const p = palco(arena)
  try {
    await (EFEITOS[personagem] ?? padrao)(p, aoImpacto)
    await p.esperar(420)
  } finally {
    p.limpar()
  }
}
