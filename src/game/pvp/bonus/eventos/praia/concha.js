import { tocar } from '../../../../audio.js'
import { particulas } from '../../../../effects/particulas.js'
import { CONCHA, faseDaConcha, planejarConcha, dist } from './planos.js'
import { contexto, instrucao, rngsPorCaixa, ferir, pisca, calmo } from './util.js'
import { registrarZona } from '../../../../attacks/zonas.js'

// CONCHA (PRAIA): uma concha gigante se abre na caixa (0,55 s abrindo, ainda sem proteger). Aberta, QUEM
// ESTÁ DENTRO FICA INVULNERÁVEL (as balas passam por cima, sem dano nem graze). Mas ela vai fechar: nos
// últimos 1,1 s as bordas piscam e a boca se fecha devagar (aviso) e, no ESTALO, quem ainda está dentro
// leva dano (5% do HP máximo). Depois fica 1,3 s fechada (inofensiva) e reabre em OUTRO lugar (>= 80 px
// do anterior). A CPU corre para a concha quando há folga de tempo e sai antes do estalo.

const ROSA = { fundo: 0xff9ac8, claro: 0xffd6e8, escuro: 0xc8508a, perola: 0xfff8f0 }

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  const ctx = contexto(arena)
  let ativo = false
  let t = 0
  // por caixa: { pista, g, rng, pos, idade, estalou, forcou, zonaDada }
  let lados = []

  const dentro = (v, c) => dist(c.x, c.y, v.pos.x, v.pos.y) <= CONCHA.raio - 3

  // as duas valvas (leques de gomos) se afastam quando ela abre
  const desenharConcha = (v, f) => {
    const g = v.g
    const { x, y } = v.pos
    const r = CONCHA.raio
    let abre = 1
    if (f.fase === 'abrindo') abre = f.p
    else if (f.fase === 'fechando') abre = 1 - f.p * f.p
    else if (f.fase === 'fechada') abre = 0
    const tremor = f.fase === 'fechando' && !calmo() ? Math.sin(t / 25) * 1.2 : 0
    const folga = abre * r * 0.34
    const cx = x + tremor
    g.fillStyle(0x000000, 0.25).fillEllipse(cx, y + r * 0.62, r * 2.1, r * 0.5)
    // dentro da boca: carne rosada e a pérola
    if (abre > 0.05) {
      g.fillStyle(0xd05a8a, 0.9).fillEllipse(cx, y, r * 1.8, folga * 2 + 4)
      g.fillStyle(ROSA.perola, 1).fillCircle(cx, y, 3 + 3 * abre)
      g.fillStyle(0xffffff, 0.9).fillCircle(cx - 1.5, y - 1.5, 1.2)
    }
    const valva = (sinal, ay) => {
      const n = 7
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI
        const a1 = ((i + 1) / n) * Math.PI
        g.fillStyle(i % 2 ? ROSA.fundo : ROSA.claro, 1).fillTriangle(cx, ay, cx + Math.cos(a0) * r, ay + sinal * Math.sin(a0) * r * 0.7, cx + Math.cos(a1) * r, ay + sinal * Math.sin(a1) * r * 0.7)
      }
      g.lineStyle(1, ROSA.escuro, 0.9)
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI
        g.lineBetween(cx, ay, cx + Math.cos(a) * r, ay + sinal * Math.sin(a) * r * 0.7)
      }
      g.lineStyle(2, ROSA.escuro, 1).beginPath()
      g.arc(cx, ay, r, sinal > 0 ? 0 : Math.PI, sinal > 0 ? Math.PI : Math.PI * 2)
      g.strokePath()
    }
    valva(1, y + folga)
    valva(-1, y - folga)
    if (f.fase === 'fechando') g.lineStyle(3, pisca(t, 55) ? 0xff3a5a : 0xffffff, 0.9).strokeCircle(x, y, r + 3 + (1 - f.p) * 6)
    else if (f.fase === 'aberta') g.lineStyle(2, 0xfff0a0, 0.55 + 0.2 * Math.sin(t / 200)).strokeCircle(x, y, r + 2)
    else if (f.fase === 'abrindo') g.lineStyle(2, 0xffffff, 0.4).strokeCircle(x, y, r * (0.5 + 0.5 * f.p))
  }

  const reabrir = (v) => {
    v.pos = planejarConcha(v.rng, v.pista.caixa.limites, v.pos)
    v.idade = 0
    v.estalou = false
    v.zonaDada = false
    tocar(arena, 'inspirar', { altura: 1.2 })
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      instrucao(arena, ctx, 'ENTRE NA CONCHA! (ELA FECHA)', '#ffc8e0')
      const rngs = rngsPorCaixa(sorte, arena.pistas.length)
      lados = arena.pistas.map((pista, j) => ({ pista, g: ctx.grafico(pista, 9), rng: rngs[j], pos: null, idade: -300, estalou: false, forcou: false, zonaDada: false }))
      lados.forEach((v) => {
        v.pos = planejarConcha(v.rng, v.pista.caixa.limites, null)
      })
    },

    // CPU: com tempo de sobra corre para a concha; perto do estalo, sai
    joy(j, joy) {
      if (!ativo || !ctx.ehCpu(j)) return joy
      const v = lados[j]
      const c = ctx.coracao(j)
      if (!v || !c || v.idade < 0) return joy
      const f = faseDaConcha(v.idade)
      const d = dist(c.x, c.y, v.pos.x, v.pos.y)
      const dentroAgora = d <= CONCHA.raio - 3
      if (dentroAgora && f.falta < 700 && f.falta > 0) {
        const fora = { x: c.x - v.pos.x, y: c.y - v.pos.y }
        const m = Math.hypot(fora.x, fora.y) || 1
        return { x: (fora.x / m) * 100, y: (fora.y / m) * 100 }
      }
      if (!dentroAgora && (f.fase === 'aberta' || f.fase === 'abrindo') && f.falta > ((d / v.pista.velocidadeCoracao) * 1000) + 1100) {
        const para = { x: v.pos.x - c.x, y: v.pos.y - c.y }
        const m = Math.hypot(para.x, para.y) || 1
        return { x: (para.x / m) * 100, y: (para.y / m) * 100 }
      }
      if (dentroAgora && f.protege && f.falta >= 700) return { x: joy.x * 0.2, y: joy.y * 0.2 }
      return joy
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((v, j) => {
        v.idade += delta
        if (v.idade < 0) return
        const f = faseDaConcha(v.idade)
        const c = ctx.coracao(j)
        const viva = Boolean(c && ctx.pistaViva(j))
        // a CPU enxerga o estalo como zona de perigo
        if (!v.zonaDada && f.falta > 0 && f.falta <= CONCHA.avisoMs) {
          v.zonaDada = true
          registrarZona(v.pista.balas, { tipo: 'circulo', x: v.pos.x, y: v.pos.y, raio: CONCHA.raio }, { ms: f.falta, dura: 160 })
          tocar(arena, 'cliquePlaca')
        }
        // protege: mantém os i-frames enquanto estiver dentro (sem piscar: só o contador)
        if (viva && f.protege && dentro(v, c)) {
          if (c.invencivelMs < 120) {
            c.invencivelMs = 120
            v.forcou = true
          }
        } else if (v.forcou && c) {
          if (c.invencivelMs <= 120) c.invencivelMs = 0
          v.forcou = false
        }
        // o estalo
        if (!v.estalou && f.fase === 'fechada') {
          v.estalou = true
          tocar(arena, 'cravar')
          particulas(arena, v.pos.x, v.pos.y, { cor: ROSA.claro, quantidade: 12, velocidade: 90 })
          if (viva && dentro(v, c)) {
            if (v.forcou) {
              c.invencivelMs = 0
              v.forcou = false
            }
            ferir(arena, ctx, j, CONCHA.dano, { som: 'queimou', cor: 0xff9ac8 })
          }
        }
        if (v.idade >= 5000 || (f.fase === 'fechada' && f.p >= 1)) reabrir(v)
        v.g.clear()
        desenharConcha(v, faseDaConcha(v.idade))
      })
    },

    estadoDebug() {
      return { t: Math.round(t), conchas: lados.map((v) => ({ x: Math.round(v.pos.x), y: Math.round(v.pos.y), ...faseDaConcha(Math.max(0, v.idade)) })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of lados) {
        const c = ctx.coracao(lados.indexOf(v))
        if (v.forcou && c && c.invencivelMs <= 120) c.invencivelMs = 0
      }
      lados = []
      ctx.limpar()
    },
  }
}
