import { tocar } from '../../../audio.js'
import { texturasPraiaCafe } from '../../../arte/praiaCafe.js'
import { BOLA, planejarBola, andarBola, empurraoDaBola } from './planosPraiaCafe.js'
import { contextoDoEvento } from './utilPraiaCafe.js'

// BOLA DE PRAIA (arena PRAIA): uma bola de praia cai do céu dentro de cada caixa
// (a sombra no chão cresce: BOLA.quedaMs) e fica quicando de parede em parede. Quem
// encosta nela é EMPURRADO para longe (entra no joystick: dá para resistir um pouco,
// mas não atravessar). Não machuca: o perigo é ser jogado nas balas ou contra a quina.
// A trajetória da bola não depende do coração (igual nos dois PCs em rede). Depois de
// ~6 s cai uma segunda bola em cada caixa. A CPU passa pelo mesmo empurrão.

const SEGUNDA_MS = 6500
const ESCALA = (BOLA.raio * 2.1) / 28 // a textura tem 28 px

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + (b - a) * sorte()
  const ctx = contextoDoEvento(arena)
  let ativo = false
  let t = 0
  // por caixa: { pista, g, bolas: [{ x, y, vx, vy, t0, sprite, sombra, giro, quicou }], segunda }
  let lados = []

  const novaBola = (v) => {
    const l = v.pista.caixa.limites
    const b = planejarBola(sorte, l)
    const giro = entre(-3, 3)
    const sombra = ctx.guardar(arena.add.ellipse(b.x, b.y + 12, 26, 9, 0x000000, 0.3).setDepth(3))
    const sprite = ctx.guardar(arena.add.image(b.x, b.y, 'praia-bola').setDepth(7).setScale(ESCALA))
    v.pista.caixa.recortar(sombra, sprite)
    v.bolas.push({ ...b, t0: t, sprite, sombra, giro })
    tocar(arena, 'poca')
  }

  // a bola só vale (empurra) depois de aterrissar
  const pousada = (b) => t - b.t0 >= BOLA.quedaMs / aceleracao

  const atualizarBola = (v, b, delta) => {
    const l = v.pista.caixa.limites
    const queda = BOLA.quedaMs / aceleracao
    const idade = t - b.t0
    if (idade < queda) {
      // caindo: a sombra cresce e a bola vem de cima
      const k = idade / queda
      b.sombra.setPosition(b.x, b.y + 12).setScale(0.3 + 0.7 * k, 0.3 + 0.7 * k).setAlpha(0.15 + 0.2 * k)
      b.sprite.setPosition(b.x, b.y - (1 - k * k) * 150).setScale(ESCALA)
      return
    }
    const quicou = andarBola(b, delta, l)
    if (quicou) {
      tocar(arena, 'poca')
    }
    // salto visual (a bola "pula" em cima da sombra a cada quique no chão)
    const salto = Math.abs(Math.sin((t - b.t0) / 210)) * 7
    b.sombra.setPosition(b.x, b.y + 12).setScale(1 - salto / 28, 1 - salto / 28).setAlpha(0.3)
    b.sprite.setPosition(b.x, b.y - salto).setRotation(b.sprite.rotation + (b.giro * delta) / 1000)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      texturasPraiaCafe(arena)
      lados = (arena.pistas ?? []).map((pista) => ({ pista, bolas: [], segunda: false }))
      lados.forEach((v) => novaBola(v))
    },

    // empurrão: a bola soma ao direcional do coração enquanto encosta
    joy(j, joy) {
      const v = lados[j]
      if (!ativo || !v || arena.ko?.[j]) return joy
      const c = v.pista.coracoes[0]
      if (!c?.ativo) return joy
      let x = joy.x
      let y = joy.y
      for (const b of v.bolas) {
        if (!pousada(b)) continue
        const p = empurraoDaBola(b, c.x, c.y, c.hitbox)
        x += p.x
        y += p.y
      }
      if (x === joy.x && y === joy.y) return joy
      return { x: Math.max(-100, Math.min(100, x)), y: Math.max(-100, Math.min(100, y)) }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      for (const v of lados) {
        if (!v.segunda && t >= SEGUNDA_MS / aceleracao) {
          v.segunda = true
          novaBola(v)
        }
        for (const b of v.bolas) atualizarBola(v, b, delta)
      }
    },

    estadoDebug() {
      return { t: Math.round(t), bolas: lados.map((v) => v.bolas.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), pousada: pousada(b) }))) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      lados = []
      ctx.limpar()
    },
  }
}
