import { tocar } from '../../../../audio.js'
import { PIPA, planejarPipa, ancoraDaPipa, passoPipa, limitar } from './planos.js'
import { contexto, instrucao, rngsPorCaixa, mistura } from './util.js'

// PIPA (PRAIA): o coração está amarrado numa PIPA por uma corda de ~94 px e balança como um pêndulo:
// a pipa (a âncora) puxa o coração de volta como uma mola e o direcional só ACRESCENTA força, então o
// coração tem inércia e vai e volta em volta da pipa (um "balanço" de ~3 s). A corda é o limite (fica
// reta e brilha quando estica) e a pipa passeia devagar pela caixa (<= 22 px/s), levando o balanço junto.
// Dá para segurar qualquer ponto da corda com ~70% do direcional. A CPU desvia do mesmo jeito (o joystick
// dela vira força igual ao do jogador).

const COR_CORDA = 0xfff0c8

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  const ctx = contexto(arena)
  let ativo = false
  let t = 0
  let ultimoDelta = 16
  // por caixa: { pista, g, plano, est: {x,y,vx,vy}|null, ancora }
  let lados = []

  const desenharPipa = (g, x, y, giro, cor) => {
    // losango com cruzeta e rabiola de laços (por cima do coração, longe dele: fica na âncora)
    const w = 11
    const h = 15
    const c = Math.cos(giro)
    const s = Math.sin(giro)
    const p = (px, py) => ({ x: x + px * c - py * s, y: y + px * s + py * c })
    const topo = p(0, -h)
    const dir = p(w, -3)
    const base = p(0, h * 0.7)
    const esq = p(-w, -3)
    g.fillStyle(cor, 1).fillTriangle(topo.x, topo.y, dir.x, dir.y, esq.x, esq.y)
    g.fillStyle(mistura(cor, 0x000000, 0.25), 1).fillTriangle(base.x, base.y, dir.x, dir.y, esq.x, esq.y)
    g.lineStyle(1, 0xffffff, 0.9).lineBetween(topo.x, topo.y, base.x, base.y).lineBetween(dir.x, dir.y, esq.x, esq.y)
    // rabiola
    let rx = base.x
    let ry = base.y
    for (let i = 1; i <= 4; i++) {
      const nx = base.x + Math.sin(t / 220 + i) * 4 - i * 2 * s
      const ny = base.y + i * 5 * c
      g.lineStyle(1, 0xffffff, 0.8).lineBetween(rx, ry, nx, ny)
      g.fillStyle(i % 2 ? 0xffe040 : 0xff5a8a, 1).fillTriangle(nx - 2, ny - 2, nx + 2, ny - 2, nx, ny + 2)
      rx = nx
      ry = ny
    }
  }

  const desenhar = (v, j) => {
    const g = v.g
    const c = ctx.coracao(j)
    g.clear()
    if (!c) return
    const a = v.ancora
    const dx = c.x - a.x
    const dy = c.y - a.y
    const d = Math.hypot(dx, dy)
    const tenso = limitar(d / PIPA.corda, 0, 1)
    // corda com barriga (fica reta quando estica) e um brilho quando está no limite
    const sag = (1 - tenso) * 14
    const pts = []
    for (let k = 0; k <= 14; k++) {
      const f = k / 14
      pts.push({ x: a.x + dx * f, y: a.y + dy * f + Math.sin(f * Math.PI) * sag })
    }
    g.lineStyle(3, 0x000000, 0.35).strokePoints(pts.map((p) => ({ x: p.x + 1, y: p.y + 2 })))
    g.lineStyle(2, tenso > 0.92 ? 0xffffff : COR_CORDA, tenso > 0.92 ? 1 : 0.85).strokePoints(pts)
    // círculo do alcance da corda (tracejado fraquinho)
    for (let k = 0; k < 28; k += 2) {
      const a0 = (k / 28) * Math.PI * 2
      const a1 = ((k + 1) / 28) * Math.PI * 2
      g.lineStyle(1, 0xffffff, 0.2 + 0.25 * tenso).lineBetween(a.x + Math.cos(a0) * PIPA.corda, a.y + Math.sin(a0) * PIPA.corda, a.x + Math.cos(a1) * PIPA.corda, a.y + Math.sin(a1) * PIPA.corda)
    }
    // a pipa, balançando com o vento
    desenharPipa(g, a.x, a.y - 4, Math.sin(t / 380) * 0.18, j ? 0x6ad0ff : 0xff6a8a)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      instrucao(arena, ctx, 'VOCÊ É O PÊNDULO DA PIPA!', '#ffb0c8')
      tocar(arena, 'ventoAviso')
      const rngs = rngsPorCaixa(sorte, arena.pistas.length)
      lados = arena.pistas.map((pista, j) => {
        const plano = planejarPipa(rngs[j])
        return { pista, g: ctx.grafico(pista, 8), plano, est: null, ancora: ancoraDaPipa(plano, pista.caixa.limites, 0) }
      })
    },

    // o direcional vira FORÇA (não velocidade): a velocidade do coração é a do pêndulo
    joy(j, joy) {
      if (!ativo || arena.ko?.[ctx.dono(j)]) return joy
      const v = lados[j]
      const c = ctx.coracao(j)
      if (!v || !c) return joy
      const l = v.pista.caixa.limites
      v.ancora = ancoraDaPipa(v.plano, l, t)
      const vel = v.pista.velocidadeCoracao
      if (!v.est) v.est = { x: c.x, y: c.y, vx: 0, vy: 0 }
      // o coração de verdade manda na posição; encostou na parede, a velocidade que empurra para ela some
      v.est.x = c.x
      v.est.y = c.y
      const meio = 8.5
      if ((c.x <= l.left + meio && v.est.vx < 0) || (c.x >= l.right - meio && v.est.vx > 0)) v.est.vx = 0
      if ((c.y <= l.top + meio && v.est.vy < 0) || (c.y >= l.bottom - meio && v.est.vy > 0)) v.est.vy = 0
      const m = Math.hypot(joy.x, joy.y)
      const k = m > 100 ? 100 / m : 1
      passoPipa(v.est, v.ancora, { x: (joy.x * k) / 100, y: (joy.y * k) / 100 }, ultimoDelta, PIPA, vel)
      // o coração vai para onde o passo mandou (a corda já segurou)
      const dt = Math.max(1, ultimoDelta) / 1000
      return { x: limitar(((v.est.x - c.x) / dt / vel) * 100, -100, 100), y: limitar(((v.est.y - c.y) / dt / vel) * 100, -100, 100) }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      ultimoDelta = Math.min(50, delta)
      lados.forEach((v, j) => {
        v.ancora = ancoraDaPipa(v.plano, v.pista.caixa.limites, t)
        desenhar(v, j)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), lados: lados.map((v) => v.est && { x: Math.round(v.est.x), y: Math.round(v.est.y), vx: Math.round(v.est.vx), vy: Math.round(v.est.vy) }) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      lados = []
      ctx.limpar()
    },
  }
}
