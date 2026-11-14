import { tocar } from '../../../../audio.js'
import { particulas } from '../../../../effects/particulas.js'
import { registrarZona } from '../../../../attacks/zonas.js'
import { GAIVOTA, planejarGaivota, faseDaGaivota, duracaoDoCiclo, gaivotaPegou, limitar } from './planos.js'
import { contexto, instrucao, rngsPorCaixa, ferir, criarAjustes, pisca, calmo } from './util.js'
import { etiqueta } from '../arteColiseu.js'

// GAIVOTA LADRA (PRAIA): uma gaivota ronda cada caixa em círculos, por cima (inofensiva). Depois TRAVA a
// mira: uma sombra e um anel vermelho fecham no chão no lugar onde o coração estava (0,8 s de aviso) e ela
// MERGULHA. Quem ainda estiver dentro do anel quando ela pousa tem 1 de ENERGIA roubada (sem energia: um
// arranhão). Basta sair do anel: ele não segue o coração. Cada caixa tem a sua gaivota e o seu ritmo.
// A CPU vê o anel como zona de perigo e sai dele.

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  const ctx = contexto(arena)
  const ajustes = criarAjustes(arena)
  let ativo = false
  let t = 0
  // por caixa: { pista, g (no chão), ceu (na tela), rng, plano, idade, alvo, zonaDada, pegou, roubou, primeira }
  let lados = []

  const novoCiclo = (v) => {
    v.plano = planejarGaivota(v.rng, v.primeira)
    v.primeira = false
    v.idade = 0
    v.alvo = null
    v.zonaDada = false
    v.pegou = false
    v.roubou = false
  }

  // a gaivota (vista de cima/de lado): corpo, asas que batem, bico. `escala` cresce quando ela desce
  const desenharGaivota = (g, x, y, escala, bate, dir, carregando) => {
    const s = escala
    const asa = Math.sin(bate) * 7 * s
    g.fillStyle(0x000000, 0.18).fillEllipse(x + 3, y + 12 * s, 20 * s, 5 * s)
    // asas (V arqueado) por trás do corpo
    for (const lado of [-1, 1]) {
      g.lineStyle(Math.max(2, 3.2 * s), 0xf4f6fa, 1).lineBetween(x, y, x + lado * 12 * s, y - 4 * s - asa)
      g.lineStyle(Math.max(2, 3 * s), 0xdfe4ec, 1).lineBetween(x + lado * 12 * s, y - 4 * s - asa, x + lado * 22 * s, y + 1 * s - asa * 1.4)
      g.lineStyle(Math.max(1.5, 2 * s), 0x222a38, 1).lineBetween(x + lado * 22 * s, y + 1 * s - asa * 1.4, x + lado * 26 * s, y + 3 * s - asa * 1.5)
    }
    g.fillStyle(0xffffff, 1).fillEllipse(x, y, 13 * s, 9 * s)
    g.fillStyle(0xf4f6fa, 1).fillCircle(x + dir * 6 * s, y - 2 * s, 3.4 * s)
    g.fillStyle(0xffa820, 1).fillTriangle(x + dir * 9 * s, y - 3 * s, x + dir * 14 * s, y - 1.5 * s, x + dir * 9 * s, y - 0.5 * s)
    g.fillStyle(0x000000, 1).fillCircle(x + dir * 7 * s, y - 3 * s, 0.9 * s)
    if (carregando) {
      g.fillStyle(0x6ae0ff, 1).fillCircle(x + dir * 14 * s, y + 3 * s, 2.2 * s)
      g.lineStyle(1, 0xffffff, 1).strokeCircle(x + dir * 14 * s, y + 3 * s, 2.2 * s)
    }
  }

  const desenhar = (v) => {
    const l = v.pista.caixa.limites
    const f = faseDaGaivota(v.idade, v.plano)
    v.g.clear()
    v.ceu.clear()
    const cx = (l.left + l.right) / 2
    const cy = (l.top + l.bottom) / 2
    // posição da gaivota
    let gx
    let gy
    let esc = 1
    let dir = v.plano.sentido
    if (f.fase === 'voa') {
      // roda em volta da caixa (elipse maior que ela), pequena e alta
      const a = v.plano.fase0 + v.plano.sentido * (v.idade / 520)
      gx = cx + Math.cos(a) * (l.width * 0.62)
      gy = cy + Math.sin(a) * (l.height * 0.62) - 6
      dir = -Math.sign(Math.sin(a)) * v.plano.sentido || 1
      v.ultimaPos = { x: gx, y: gy }
    } else if (f.fase === 'mira') {
      // pairando, cada vez mais perto do alvo
      const al = v.alvo ?? { x: cx, y: cy }
      const k = f.p
      gx = v.ultimaPos.x + (al.x - v.ultimaPos.x) * (0.35 * k)
      gy = v.ultimaPos.y + (al.y - 40 - v.ultimaPos.y) * (0.5 * k)
      esc = 1 + 0.35 * k
      dir = Math.sign(al.x - gx) || 1
      v.meio = { x: gx, y: gy, esc }
    } else if (f.fase === 'mergulha') {
      const al = v.alvo
      const m = v.meio ?? { x: al.x, y: al.y - 40, esc: 1.35 }
      const k = f.p * f.p
      gx = m.x + (al.x - m.x) * k
      gy = m.y + (al.y - 4 - m.y) * k
      esc = m.esc + 0.6 * k
      dir = Math.sign(al.x - m.x) || 1
    } else {
      // foge para cima e para o lado
      const al = v.alvo ?? { x: cx, y: cy }
      const k = f.p
      gx = al.x + v.plano.sentido * 120 * k
      gy = al.y - 4 - 130 * k
      esc = 1.95 - 0.9 * k
      dir = v.plano.sentido
    }
    // anel e sombra no chão (a mira travada)
    if (v.alvo && (f.fase === 'mira' || f.fase === 'mergulha')) {
      const al = v.alvo
      const k = f.fase === 'mira' ? f.p : 1
      const raio = GAIVOTA.raioAlvo
      const alerta = pisca(v.idade, 60)
      g2(v.g, al.x, al.y, raio, k, alerta, f.fase === 'mergulha')
    }
    const bate = v.idade / (f.fase === 'voa' ? 90 : f.fase === 'mira' ? 70 : 50)
    // a gaivota é objeto de tela, por cima das caixas
    desenharGaivota(v.ceu, gx, gy, esc, calmo() ? 0.8 : bate, dir, v.roubou && f.fase === 'foge')
    // sombra da gaivota no chão da caixa quando ela está sobre a caixa
    if (f.fase === 'voa' && gx > l.left - 4 && gx < l.right + 4 && gy > l.top - 4 && gy < l.bottom + 4) {
      v.g.fillStyle(0x000000, 0.22).fillEllipse(gx + 4, gy + 22, 18, 6)
    }
  }

  // anel e sombra do alvo travado
  const g2 = (g, x, y, raio, k, alerta, mergulhando) => {
    g.fillStyle(0x000000, 0.18 + 0.25 * k).fillEllipse(x, y + 1, raio * 2.2 * (0.4 + 0.6 * k), raio * 1.2 * (0.4 + 0.6 * k))
    g.fillStyle(0xff3a3a, mergulhando ? 0.4 : 0.12 + 0.18 * k).fillCircle(x, y, raio)
    g.lineStyle(2, alerta ? 0xff3a3a : 0xffd0c0, 0.95).strokeCircle(x, y, raio)
    // anel que fecha
    g.lineStyle(2, 0xffffff, 0.8).strokeCircle(x, y, raio + (1 - k) * 22)
    g.lineStyle(1, 0xffffff, 0.6).lineBetween(x - 5, y, x + 5, y).lineBetween(x, y - 5, x, y + 5)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      instrucao(arena, ctx, 'CUIDADO: GAIVOTA LADRA!', '#eaf2ff')
      tocar(arena, 'ventoAviso')
      const rngs = rngsPorCaixa(sorte, arena.pistas.length)
      lados = arena.pistas.map((pista, j) => {
        const v = { pista, g: ctx.grafico(pista, 6), ceu: ctx.graficoDeTela(92), rng: rngs[j], plano: null, idade: 0, alvo: null, zonaDada: false, pegou: false, roubou: false, primeira: true, ultimaPos: { x: 0, y: 0 }, meio: null }
        novoCiclo(v)
        return v
      })
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((v, j) => {
        const viva = Boolean(ctx.pistaViva(j))
        const c = ctx.coracao(j)
        v.idade += delta
        if (v.idade >= duracaoDoCiclo(v.plano)) novoCiclo(v)
        const f = faseDaGaivota(v.idade, v.plano)
        // trava a mira no começo do aviso (no coração, ou no centro se ele não está)
        if ((f.fase === 'mira' || f.fase === 'mergulha' || f.fase === 'foge') && !v.alvo) {
          const l = v.pista.caixa.limites
          v.alvo = c ? { x: c.x, y: c.y } : { x: (l.left + l.right) / 2, y: (l.top + l.bottom) / 2 }
          v.alvo.x = limitar(v.alvo.x, l.left + 10, l.right - 10)
          v.alvo.y = limitar(v.alvo.y, l.top + 10, l.bottom - 10)
          tocar(arena, 'assobio')
        }
        if (v.alvo && !v.zonaDada && f.fase === 'mira') {
          v.zonaDada = true
          registrarZona(v.pista.balas, { tipo: 'circulo', x: v.alvo.x, y: v.alvo.y, raio: GAIVOTA.raioAlvo + 4 }, { ms: GAIVOTA.avisoMs, dura: GAIVOTA.mergulhoMs * 0.5 + 120 })
        }
        if (f.golpe && !v.pegou && viva && c && v.alvo) {
          v.pegou = true
          if (gaivotaPegou(v.alvo, c)) {
            const dono = ctx.dono(j)
            const r = ajustes.ajustar(dono, { energia: -GAIVOTA.rouba })
            v.roubou = true
            tocar(arena, 'splat')
            particulas(arena, c.x, c.y, { cor: 0xeaf2ff, quantidade: 10, velocidade: 100 })
            if (r.energia < 0) {
              const l = v.pista.caixa.limites
              const txt = ctx.guardar(etiqueta(arena, limitar(c.x, l.left + 44, l.right - 44), Math.max(l.top + 14, c.y - 24), '-1 ENERGIA!', { cor: '#8adfff', tamanho: 13, pista: v.pista }))
              arena.tweens.add({ targets: txt, y: txt.y - 14, alpha: 0, delay: 500, duration: 500, onComplete: () => txt.destroy() })
            } else {
              ferir(arena, ctx, j, GAIVOTA.danoSemEnergia, { som: 'queimou', cor: 0xeaf2ff })
            }
          }
        }
        desenhar(v)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), gaivotas: lados.map((v) => ({ ...faseDaGaivota(v.idade, v.plano), alvo: v.alvo && { x: Math.round(v.alvo.x), y: Math.round(v.alvo.y) }, pegou: v.pegou, roubou: v.roubou })) }
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
