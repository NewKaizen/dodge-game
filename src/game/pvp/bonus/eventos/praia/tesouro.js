import { tocar } from '../../../../audio.js'
import { particulas } from '../../../../effects/particulas.js'
import { TESOURO, planejarTesouro, intervaloDoBip, passoCava, dist, limitar } from './planos.js'
import { contexto, instrucao, rngsPorCaixa, irPara, criarAjustes } from './util.js'
import { etiqueta } from '../arteColiseu.js'

// CAÇA AO TESOURO (PRAIA): tem um tesouro ENTERRADO escondido em cada caixa (não aparece). O coração
// carrega um detector de metais que apita mais rápido quanto mais perto do tesouro (de ~1 s de intervalo
// a ~0,13 s, com ondas saindo do coração). Ficar em cima dele por 0,6 s CAVA: o baú sai da areia e cura
// 6% do HP máximo (com a vida cheia vale +1 de energia). Largou o buraco, o progresso desce depressa.
// Surgem até 3 por caixa, com 1,6 s de intervalo, sempre longe do coração. Tudo isso rola enquanto o
// ataque continua: cavar é um risco. A CPU anda até o tesouro nos momentos calmos (ela "escuta" o detector).

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  const ctx = contexto(arena)
  const ajustes = criarAjustes(arena)
  let ativo = false
  let t = 0
  // por caixa: { pista, g, rng, tesouro: {x,y}|null, prog, achados, esperaMs, bipEm, ondas: [{ x, y, t }], bau: {x,y,t}|null }
  let lados = []

  const novoTesouro = (v) => {
    const c = v.pista.coracoes[0]
    v.tesouro = planejarTesouro(v.rng, v.pista.caixa.limites, c?.ativo ? c : null, v.ultimo)
    v.ultimo = v.tesouro
    v.prog = 0
  }

  const achar = (v, j) => {
    const { x, y } = v.tesouro
    v.achados++
    v.bau = { x, y, t }
    v.tesouro = null
    v.esperaMs = TESOURO.esperaMs
    tocar(arena, 'clonar')
    particulas(arena, x, y, { cor: 0xffd24a, quantidade: 14, velocidade: 120 })
    const dono = ctx.dono(j)
    const hpMax = arena.estado?.jogadores?.[dono]?.hpMax ?? 100
    const cura = Math.max(2, Math.round(hpMax * TESOURO.cura))
    let feito = ajustes.ajustar(dono, { hp: cura })
    let texto = `+${feito.hp} HP`
    if (!feito.hp) {
      feito = ajustes.ajustar(dono, { energia: 1 })
      texto = feito.energia ? '+1 ENERGIA' : 'TESOURO!'
    }
    tocar(arena, 'tpMax')
    const l = v.pista.caixa.limites
    const txt = ctx.guardar(etiqueta(arena, limitar(x, l.left + 40, l.right - 40), Math.max(l.top + 14, y - 22), texto, { cor: '#ffe680', tamanho: 14, pista: v.pista }))
    arena.tweens.add({ targets: txt, y: txt.y - 14, alpha: 0, delay: 500, duration: 500, onComplete: () => txt.destroy() })
  }

  const desenhar = (v, j) => {
    const g = v.g
    const l = v.pista.caixa.limites
    const c = ctx.coracao(j)
    g.clear()
    // areia levemente remexida: montinhos
    g.fillStyle(0xe8c070, 0.1).fillRect(l.left, l.top, l.width, l.height)
    // ondas do detector (saem do coração a cada apito)
    for (const o of v.ondas) {
      const k = (t - o.t) / 420
      g.lineStyle(2, 0xffe680, 0.7 * (1 - k)).strokeCircle(o.x, o.y, 8 + 22 * k)
    }
    // detector: disco e haste ao lado do coração
    if (c) {
      const x = c.x + 11
      const y = c.y + 8
      g.lineStyle(2, 0x9aa0a8, 1).lineBetween(x, y - 10, x + 4, y + 3)
      g.fillStyle(0x606870, 1).fillEllipse(x + 6, y + 5, 14, 6)
      g.fillStyle(v.piscando ? 0xffe040 : 0x40e060, 1).fillCircle(x + 6, y + 5, 1.6)
    }
    // escavação: monte de areia crescendo e anel de progresso em volta do coração
    if (v.tesouro && c && v.prog > 0) {
      const k = limitar(v.prog / TESOURO.cavaMs, 0, 1)
      g.fillStyle(0xb08848, 0.9).fillEllipse(v.tesouro.x, v.tesouro.y + 4, 18 + 14 * k, 6 + 5 * k)
      g.lineStyle(3, 0xffe680, 0.9).beginPath()
      g.arc(c.x, c.y, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k)
      g.strokePath()
    }
    // o baú que acabou de sair da areia
    if (v.bau) {
      const k = (t - v.bau.t) / 1000
      if (k < 1) {
        const a = 1 - Math.max(0, k - 0.5) * 2
        const { x, y } = v.bau
        g.fillStyle(0x7a4a18, a).fillRect(Math.round(x - 9), Math.round(y - 12 - 5 * k), 18, 11)
        g.fillStyle(0xa86a28, a).fillRect(Math.round(x - 9), Math.round(y - 12 - 5 * k), 18, 4)
        g.fillStyle(0xffd24a, a).fillRect(Math.round(x - 2), Math.round(y - 10 - 5 * k), 4, 5)
        g.lineStyle(1, 0x3a2008, a).strokeRect(Math.round(x - 9), Math.round(y - 12 - 5 * k), 18, 11)
      } else v.bau = null
    }
    // termômetro frio/quente do detector (só uma dica, nunca mostra onde)
    if (v.tesouro && c) {
      const d = dist(c.x, c.y, v.tesouro.x, v.tesouro.y)
      const quente = limitar(1 - d / TESOURO.distLonge, 0, 1)
      const bx = l.left + 8
      const by = l.bottom - 10
      g.fillStyle(0x000000, 0.6).fillRect(bx - 1, by - 1, l.width - 14, 7)
      g.fillStyle(quente > 0.7 ? 0xff5a30 : quente > 0.35 ? 0xffc040 : 0x60b0ff, 1).fillRect(bx, by, (l.width - 16) * quente, 5)
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      instrucao(arena, ctx, 'PROCURE E CAVE!', '#ffe680')
      tocar(arena, 'areia')
      const rngs = rngsPorCaixa(sorte, arena.pistas.length)
      lados = arena.pistas.map((pista, j) => {
        const v = { pista, g: ctx.grafico(pista, 3), rng: rngs[j], tesouro: null, ultimo: null, prog: 0, achados: 0, esperaMs: 700, bipEm: 0, ondas: [], bau: null, piscando: false }
        return v
      })
    },

    // CPU: nos momentos calmos (o desvio dela quase parado) vai até o tesouro
    joy(j, joy) {
      if (!ativo || !ctx.ehCpu(j)) return joy
      const v = lados[j]
      const c = ctx.coracao(j)
      if (!v?.tesouro || !c) return joy
      if (Math.hypot(joy.x, joy.y) > 35) return joy
      const d = dist(c.x, c.y, v.tesouro.x, v.tesouro.y)
      if (d < 4) return { x: 0, y: 0 }
      return irPara(c, v.tesouro, Math.min(100, 30 + d * 2))
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((v, j) => {
        const c = ctx.coracao(j)
        const viva = Boolean(c && ctx.pistaViva(j))
        if (viva && !v.tesouro && v.achados < TESOURO.maxAchados) {
          v.esperaMs -= delta
          if (v.esperaMs <= 0) novoTesouro(v)
        }
        if (viva && v.tesouro) {
          const d = dist(c.x, c.y, v.tesouro.x, v.tesouro.y)
          // apito do detector: mais rápido perto do tesouro
          if (t >= v.bipEm) {
            v.bipEm = t + intervaloDoBip(d)
            v.ondas.push({ x: c.x, y: c.y, t })
            v.piscando = true
            tocar(arena, d < 40 ? 'taque' : 'tique')
          } else if (t - (v.bipEm - intervaloDoBip(d)) > 80) v.piscando = false
          const r = passoCava(v.prog, d <= TESOURO.raioCava, delta)
          v.prog = r.prog
          if (v.prog > 0 && Math.floor(t / 90) !== Math.floor((t - delta) / 90)) particulas(arena, v.tesouro.x, v.tesouro.y, { cor: 0xe8c070, quantidade: 2, velocidade: 50, vida: 300 })
          if (r.achou) achar(v, j)
        }
        v.ondas = v.ondas.filter((o) => t - o.t < 420)
        desenhar(v, j)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), lados: lados.map((v) => ({ tesouro: v.tesouro && { x: Math.round(v.tesouro.x), y: Math.round(v.tesouro.y) }, prog: Math.round(v.prog), achados: v.achados })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      ajustes.desligar()
      lados = []
      ctx.limpar()
    },
  }
}
