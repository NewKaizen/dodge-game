import { tocar } from '../../../../audio.js'
import { SOL, planejarGuardaSois, posicaoDoGuardaSol, naSombra, sombraMaisPerto, passoCalor, limitar } from './planos.js'
import { contexto, instrucao, ferir, rngsPorCaixa, pisca, irPara, mistura } from './util.js'
import { etiqueta } from '../arteColiseu.js'

// SOL DO MEIO-DIA (PRAIA): o sol a pino. SÓ a sombra dos guarda-sóis protege: fora dela o CALOR
// sobe (de 0 a cheio em ~2,6 s; passou da metade a caixa esquenta e a barra pisca) e cheio QUEIMA
// (dano pequeno, e o calor volta a 45%: a próxima queimadura demora ~1,4 s, nunca em rajada). Na
// sombra o calor desce em 1 s. Dois guarda-sóis passeiam em órbitas lentas e previsíveis (no máximo
// ~40 px/s, bem abaixo do coração). A CPU corre para a sombra mais perto quando esquenta.

const ONDULA = 5

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  const ctx = contexto(arena)
  let ativo = false
  let t = 0
  // por caixa: { pista, g, topo, guardaSois, calor, rotulo, queimouEm }
  let lados = []

  const guardaSol = (g, x, y) => {
    // cabo e capota listrada (vermelho e branco), por cima da sombra
    const cx = Math.round(x - 6)
    const cy = Math.round(y - 20)
    g.lineStyle(2, 0x8a5a2a, 1).lineBetween(cx, cy + 4, cx + 4, y + 8)
    for (let i = 0; i < 6; i++) {
      const a0 = Math.PI + (i * Math.PI) / 6
      const a1 = Math.PI + ((i + 1) * Math.PI) / 6
      g.fillStyle(i % 2 ? 0xffffff : 0xff4a4a, 1)
      g.fillTriangle(cx, cy + 4, cx + Math.cos(a0) * 22, cy + 4 + Math.sin(a0) * 13, cx + Math.cos(a1) * 22, cy + 4 + Math.sin(a1) * 13)
    }
    g.lineStyle(1, 0x7a2020, 0.9).strokeEllipse(cx, cy + 4, 44, 4)
    g.fillStyle(0xffe040, 1).fillCircle(cx, cy - 8, 2)
  }

  const desenhar = (v, j) => {
    const l = v.pista.caixa.limites
    const g = v.g
    const c = ctx.coracao(j)
    g.clear()
    // luz do sol: véu quente, com brilho de calor que ondula
    const quente = v.calor
    g.fillStyle(mistura(0xffd070, 0xff6a20, quente), 0.2 + 0.18 * quente).fillRect(l.left, l.top, l.width, l.height)
    for (let k = 0; k < 6; k++) {
      const y = l.top + 18 + k * 26
      const x0 = l.left + ((t * 0.03 + k * 41) % l.width)
      g.lineStyle(1, 0xfff0b0, 0.22).lineBetween(x0, y + Math.sin(t / 300 + k) * ONDULA, Math.min(l.right, x0 + 36), y + Math.sin(t / 300 + k + 1) * ONDULA)
    }
    // sombras (a luz do véu some dentro delas) e guarda-sóis
    const ps = v.guardaSois.map((gs) => posicaoDoGuardaSol(gs, t))
    for (const p of ps) {
      g.fillStyle(0x0a2a5a, 0.5).fillCircle(p.x, p.y, SOL.raio)
      g.fillStyle(0x0a2a5a, 0.22).fillCircle(p.x, p.y, SOL.raio + 5)
      g.lineStyle(1, 0xbfe0ff, 0.65).strokeCircle(p.x, p.y, SOL.raio)
    }
    for (const p of ps) guardaSol(g, p.x, p.y)
    // coração fora da sombra: halo quente
    if (c && v.calor > 0.02) {
      g.lineStyle(2, v.calor >= SOL.aviso ? 0xff5030 : 0xffc040, 0.5 + 0.4 * v.calor).strokeCircle(c.x, c.y, 11 + 5 * v.calor)
    }
    // barra de calor
    const bx = l.left + 8
    const by = l.bottom - 10
    const alerta = v.calor >= SOL.aviso
    g.fillStyle(0x000000, 0.6).fillRect(bx - 1, by - 1, l.width - 14, 7)
    g.fillStyle(alerta ? (pisca(t, 55) ? 0xff3a1a : 0xffb060) : mistura(0xffd860, 0xff8a20, v.calor / SOL.aviso), 1).fillRect(bx, by, (l.width - 16) * limitar(v.calor, 0, 1), 5)
    g.lineStyle(1, 0xffffff, 0.5).lineBetween(bx + (l.width - 16) * SOL.aviso, by - 1, bx + (l.width - 16) * SOL.aviso, by + 6)
    v.rotulo.setVisible(alerta).setPosition((l.left + l.right) / 2, l.top + 14)
    if (alerta) v.rotulo.setAlpha(pisca(t, 70) ? 1 : 0.55)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      instrucao(arena, ctx, 'SÓ A SOMBRA PROTEGE!', '#ffd860')
      tocar(arena, 'chiado')
      const rngs = rngsPorCaixa(sorte, arena.pistas.length)
      lados = arena.pistas.map((pista, j) => ({
        pista,
        g: ctx.grafico(pista, 3),
        guardaSois: planejarGuardaSois(rngs[j], pista.caixa.limites, 2),
        calor: 0,
        rotulo: ctx.guardar(etiqueta(arena, 0, 0, 'ESTÁ QUENTE!', { cor: '#ff9a50', tamanho: 11, pista })).setVisible(false),
      }))
    },

    // CPU: esquentou? vai para a sombra mais perto (e fica nela enquanto o calor não baixar)
    joy(j, joy) {
      if (!ativo || !ctx.ehCpu(j)) return joy
      const v = lados[j]
      const c = ctx.coracao(j)
      if (!v || !c || v.calor < 0.3) return joy
      const s = sombraMaisPerto(v.guardaSois, t + 200, c.x, c.y)
      if (!s || s.d < SOL.raio * 0.45) return joy
      const ir = irPara(c, s, 100)
      return { x: ir.x * 0.85 + joy.x * 0.15, y: ir.y * 0.85 + joy.y * 0.15 }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((v, j) => {
        const c = ctx.coracao(j)
        if (c && ctx.pistaViva(j)) {
          const antes = v.calor
          const r = passoCalor(v.calor, naSombra(v.guardaSois, t, c.x, c.y), delta)
          v.calor = r.calor
          if (antes < SOL.aviso && v.calor >= SOL.aviso) tocar(arena, 'chiado')
          if (r.queimou) {
            ferir(arena, ctx, j, SOL.dano, { som: 'queimou', cor: 0xffa030 })
          }
        } else v.calor = Math.max(0, v.calor - delta / SOL.desceMs)
        desenhar(v, j)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), calor: lados.map((v) => Math.round(v.calor * 100) / 100), sombras: lados.map((v) => v.guardaSois.map((gs) => posicaoDoGuardaSol(gs, t)).map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      lados = []
      ctx.limpar()
    },
  }
}
