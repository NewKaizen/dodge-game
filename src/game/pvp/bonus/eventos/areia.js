import { tocar } from '../../../audio.js'

// AREIA MOVEDIÇA (TEMPLO): poças de areia movediça abrem no chão das caixas.
// Dentro de uma poça o coração fica LENTO (mais lento quanto mais perto do
// meio) e é PUXADO para o centro dela (as duas coisas entram no joystick,
// então valem para a CPU também). Sair sempre dá: mesmo na borda, andando
// para fora o coração anda a ~40% da velocidade. A poça não machuca: o
// perigo é ficar parado no meio enquanto o ataque continua.
// Cada poça avisa antes: primeiro surge (ondinhas crescendo, ainda sem
// efeito), fica ativa uns segundos e depois seca; outra abre em outro lugar
// (nunca em cima do coração). Visual: camadas de areia, um redemoinho
// girando, grãos escorrendo para o meio e areia espirrando em volta do
// coração preso.

const POCAS_POR_CAIXA = 2
const SURGE_MS = 850 // aviso: a poça aparece, mas ainda não prende
const ATIVA_MS = { min: 4600, max: 6200 }
const SECA_MS = 450
const ESPERA_MS = { min: 250, max: 700 } // até a próxima poça abrir
const TAMANHO = { rx: 36, ry: 26 } // numa caixa de 170 de altura (escala com a caixa)
const LENTO = { centro: 0.42, borda: 0.8 } // fração do joystick que vale dentro da poça
const PUXAO = 40 // força do redemoinho (joystick, -100..100)
const AREIA = [0xe2c07a, 0xc89e5a, 0xa47a40, 0x7a5628, 0x4e3418] // da borda para o meio

export default function criar(arena, { rng } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + (b - a) * sorte()
  let ativo = false
  let t = 0
  let caixas = [] // por pista: { pista, g, pocas: [], esperas: [], preso, somEm, respingoEm }

  const escala = (l) => Math.max(0.7, Math.min(1.15, Math.min(l.height, l.width * 0.78) / 170))

  // a poça: centro em fração da caixa (acompanha a caixa se ela mudar de forma)
  const abrirPoca = (cx) => {
    const l = cx.pista.caixa.limites
    const k = escala(l)
    const rx = TAMANHO.rx * k
    const ry = TAMANHO.ry * k
    const c = cx.pista.coracoes[0]
    for (let tentativa = 0; tentativa < 24; tentativa++) {
      const x = entre(l.left + rx + 4, l.right - rx - 4)
      const y = entre(l.top + ry + 4, l.bottom - ry - 4)
      if (c?.ativo && Math.hypot((c.x - x) / rx, (c.y - y) / ry) < 1.9) continue
      if (cx.pocas.some((p) => Math.hypot(p.fx * l.width + l.left - x, p.fy * l.height + l.top - y) < rx * 2.3)) continue
      cx.pocas.push({ fx: (x - l.left) / l.width, fy: (y - l.top) / l.height, rx, ry, nasceu: t, ativaAte: t + SURGE_MS + entre(ATIVA_MS.min, ATIVA_MS.max), giro: sorte() < 0.5 ? -1 : 1, fase: sorte() * 6 })
      tocar(arena, 'areia')
      return true
    }
    return false
  }

  const centro = (p, l) => ({ x: l.left + p.fx * l.width, y: l.top + p.fy * l.height })
  // 0..1: quanto a poça está "valendo" (0 surgindo ou já seca)
  const forca = (p) => (t - p.nasceu < SURGE_MS ? 0 : t > p.ativaAte ? 0 : 1)
  const tamanhoVisual = (p) => {
    const surgir = Math.min(1, (t - p.nasceu) / SURGE_MS)
    const secar = t > p.ativaAte ? Math.max(0, 1 - (t - p.ativaAte) / SECA_MS) : 1
    return Math.sin((surgir * Math.PI) / 2) * secar
  }

  // a poça em que o coração está (a mais funda), com r = distância normalizada (0 meio, 1 borda)
  const pocaDoCoracao = (cx) => {
    const c = cx.pista.coracoes[0]
    if (!c?.ativo) return null
    const l = cx.pista.caixa.limites
    let melhor = null
    for (const p of cx.pocas) {
      if (!forca(p)) continue
      const m = centro(p, l)
      const r = Math.hypot((c.x - m.x) / p.rx, (c.y - m.y) / p.ry)
      if (r < 1 && (!melhor || r < melhor.r)) melhor = { p, r, m, c }
    }
    return melhor
  }

  const desenhar = (cx) => {
    const g = cx.g
    const l = cx.pista.caixa.limites
    g.clear()
    for (const p of cx.pocas) {
      const k = tamanhoVisual(p)
      if (k <= 0.02) continue
      const { x, y } = centro(p, l)
      const rx = p.rx * k
      const ry = p.ry * k
      // camadas de areia, cada vez mais escuras para o meio
      AREIA.forEach((cor, i) => {
        const f = 1 - i * 0.19
        g.fillStyle(cor, i === 0 ? 0.85 : 1).fillEllipse(x, y + i * 0.6, rx * 2 * f, ry * 2 * f)
      })
      // redemoinho: dois braços de grãos em espiral girando para dentro
      const rot = (t / 900) * p.giro + p.fase
      for (let braco = 0; braco < 2; braco++) {
        for (let s = 0.15; s < 0.95; s += 0.07) {
          const a = rot + braco * Math.PI + s * 5.2 * p.giro
          const gx = x + Math.cos(a) * rx * s
          const gy = y + Math.sin(a) * ry * s
          g.fillStyle(s > 0.5 ? 0xf0d8a0 : 0xd8b878, 0.75).fillRect(Math.round(gx) - 1, Math.round(gy) - 1, 2, 2)
        }
      }
      // grãos escorrendo da borda para o meio
      for (let i = 0; i < 8; i++) {
        const v = ((t / 1400 + i / 8 + p.fase) % 1)
        const a = i * 0.785 + p.fase - v * 1.2 * p.giro
        g.fillStyle(0xfff0c0, 0.6 * (1 - v)).fillRect(Math.round(x + Math.cos(a) * rx * (1 - v)), Math.round(y + Math.sin(a) * ry * (1 - v)), 2, 2)
      }
      // surgindo: anéis de aviso crescendo
      if (t - p.nasceu < SURGE_MS) {
        const u = (t - p.nasceu) / SURGE_MS
        for (const d of [0, 0.33, 0.66]) {
          const q = (u * 2 + d) % 1
          g.lineStyle(2, 0xffe0a0, 0.7 * (1 - q)).strokeEllipse(x, y, p.rx * 2 * q * 1.2, p.ry * 2 * q * 1.2)
        }
      }
      // borda clarinha (onde começa a puxar)
      g.lineStyle(1, 0xf8e0a8, forca(p) ? 0.55 : 0.3).strokeEllipse(x, y, rx * 2, ry * 2)
    }
    // coração preso: anel de areia em volta dele
    if (cx.preso) {
      const { c, r } = cx.preso
      const a = 0.35 + 0.35 * (1 - r)
      g.lineStyle(2, 0x7a5628, a).strokeEllipse(c.x, c.y + 4, 22, 9)
      g.lineStyle(1, 0xe2c07a, a).strokeEllipse(c.x, c.y + 4, 26, 11)
    }
  }

  const respingar = (cx, c) => {
    for (let k = 0; k < 3; k++) {
      const p = arena.add.rectangle(c.x + entre(-6, 6), c.y + 5, 2, 2, AREIA[k % 3]).setDepth(3)
      cx.pista.caixa.recortar(p)
      cx.respingos.add(p)
      arena.tweens.add({
        targets: p,
        x: p.x + entre(-12, 12),
        y: p.y - entre(4, 12),
        alpha: 0,
        duration: 380,
        ease: 'Quad.easeOut',
        onComplete: () => {
          cx.respingos.delete(p)
          p.destroy()
        },
      })
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      caixas = arena.pistas.map((pista) => {
        const g = arena.add.graphics().setDepth(2)
        pista.caixa.recortar(g)
        return { pista, g, pocas: [], esperas: [200, 1100], preso: null, somEm: 0, respingoEm: 0, respingos: new Set() }
      })
    },

    // dentro da poça: joystick mais fraco e um puxão para o meio
    joy(j, joy) {
      const cx = caixas[j]
      if (!ativo || !cx) return joy
      if (arena.ko?.[j]) {
        cx.preso = null
        return joy
      }
      const preso = pocaDoCoracao(cx)
      cx.preso = preso
      if (!preso) return joy
      const { r, m, c, p } = preso
      const lento = LENTO.centro + (LENTO.borda - LENTO.centro) * r
      const dx = (m.x - c.x) / p.rx
      const dy = (m.y - c.y) / p.ry
      const d = Math.hypot(dx, dy) || 1
      const puxa = PUXAO * Math.min(1, r * 1.6)
      return { x: joy.x * lento + (dx / d) * puxa, y: joy.y * lento + (dy / d) * puxa }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      caixas.forEach((cx, j) => {
        const aberta = cx.pista.atacando && !arena.ko?.[j]
        cx.pocas = cx.pocas.filter((p) => t < p.ativaAte + SECA_MS)
        cx.esperas = cx.esperas.filter((em) => !(t >= em && aberta && abrirPoca(cx)))
        while (cx.pocas.length + cx.esperas.length < POCAS_POR_CAIXA) cx.esperas.push(t + entre(ESPERA_MS.min, ESPERA_MS.max))
        // coração afundando: chiado e areia espirrando
        if (cx.preso) {
          if (t >= cx.somEm) {
            cx.somEm = t + 900
            tocar(arena, 'areia')
          }
          if (t >= cx.respingoEm) {
            cx.respingoEm = t + 140
            respingar(cx, cx.preso.c)
          }
        }
        desenhar(cx)
      })
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const cx of caixas) {
        cx.g.destroy()
        for (const p of cx.respingos) {
          arena.tweens.killTweensOf(p)
          p.destroy()
        }
      }
      caixas = []
    },

    estadoDebug() {
      return { pocas: caixas.map((cx) => cx.pocas.map((p) => ({ fx: +p.fx.toFixed(2), fy: +p.fy.toFixed(2), valendo: Boolean(forca(p)) }))), presos: caixas.map((cx) => Boolean(cx.preso)) }
    },
  }
}
