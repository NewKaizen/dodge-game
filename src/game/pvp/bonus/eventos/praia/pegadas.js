import { tocar } from '../../../../audio.js'
import { PEGADAS, novoHistorico, gravarPasso, posicaoDoFantasma, dist, limitar } from './planos.js'
import { contexto, instrucao, pisca } from './util.js'

// PEGADAS (PRAIA): as pegadas do coração ficam marcadas na areia (somem em ~2,3 s) e, 2 s depois, um
// FANTASMA refaz exatamente o MESMO caminho, no mesmo ritmo (a posição dele agora é a do coração de
// 2 s atrás). Ele nasce translúcido e inofensivo por 0,7 s (dá para se afastar do caminho) e só então
// machuca (uma bala redonda atravessável que o evento põe no lugar certo todo frame). Parado, o
// fantasma chega até você pelas suas próprias pegadas: ande, e não volte pelo mesmo caminho.
// A CPU vê o fantasma como uma bala em movimento (a velocidade dele vai na bala).

const DANO = PEGADAS.dano
const COR = 0xcfd8ff

export default function criar(arena) {
  const ctx = contexto(arena)
  let ativo = false
  let t = 0
  // por caixa: { pista, g, hist, pegadas: [{ x, y, t, lado, ang }], ultimaPegada, lado, fantasma: { bala, nasceu } | null }
  let lados = []

  const pegada = (g, p, idade) => {
    const a = 1 - idade / PEGADAS.pegadaVidaMs
    if (a <= 0) return
    const c = Math.cos(p.ang)
    const s = Math.sin(p.ang)
    const ponto = (px, py) => ({ x: p.x + px * c - py * s, y: p.y + px * s + py * c })
    const sola = ponto(0, 1)
    g.fillStyle(0xe0c088, 0.75 * a).fillEllipse(sola.x, sola.y, 5, 8)
    for (let i = -1; i <= 1; i++) {
      const dedo = ponto(i * 1.8, -4.2 - (i === 0 ? 0.4 : 0))
      g.fillStyle(0xe0c088, 0.7 * a).fillCircle(dedo.x, dedo.y, 0.9)
    }
  }

  const fantasma = (g, x, y, p, vx) => {
    // um lençol de fantasma que flutua: corpo arredondado, barra ondulada, olhos e boca de "uuu"
    const a = 0.35 + 0.5 * p
    const bob = Math.sin(t / 160) * 1.5
    const cy = y - 1 + bob
    g.fillStyle(0x000000, 0.25 * p).fillEllipse(x, y + 10, 18, 5)
    g.fillStyle(COR, a).fillCircle(x, cy - 2, 9)
    g.fillStyle(COR, a).fillRect(x - 9, cy - 2, 18, 10)
    // barra ondulada
    for (let i = 0; i < 3; i++) g.fillStyle(COR, a).fillCircle(x - 6 + i * 6, cy + 8, 3)
    g.fillStyle(0x10204a, 0.95 * p).fillCircle(x - 3 + Math.sign(vx) * 1, cy - 3, 1.7).fillCircle(x + 3 + Math.sign(vx) * 1, cy - 3, 1.7)
    g.fillStyle(0x10204a, 0.9 * p).fillEllipse(x + Math.sign(vx), cy + 2, 3, 4)
    // anel de perigo quando já machuca
    if (p >= 1) g.lineStyle(1, 0xff7a8a, pisca(t, 120) ? 0.9 : 0.5).strokeCircle(x, cy + 1, PEGADAS.raio + 3)
  }

  const desenhar = (v) => {
    const g = v.g
    g.clear()
    for (const p of v.pegadas) pegada(g, p, t - p.t)
    const f = v.fantasma
    if (f && !f.bala.morta) {
      const nasce = limitar((t - f.nasceu) / PEGADAS.nasceMs, 0, 1)
      fantasma(g, f.bala.x, f.bala.y, nasce, f.bala.vx)
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      instrucao(arena, ctx, 'UM FANTASMA SEGUE SEUS PASSOS!', '#cfd8ff')
      tocar(arena, 'areia')
      lados = arena.pistas.map((pista) => ({ pista, g: ctx.grafico(pista, 4), hist: novoHistorico(), pegadas: [], ultima: null, lado: 1, fantasma: null }))
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((v, j) => {
        const c = ctx.coracao(j)
        const pista = ctx.pistaViva(j)
        if (c && pista) {
          gravarPasso(v.hist, t, c.x, c.y)
          // pegadas: uma a cada 16 px andados, pés alternados
          if (!v.ultima || dist(c.x, c.y, v.ultima.x, v.ultima.y) >= PEGADAS.passoPegada) {
            const ang = v.ultima ? Math.atan2(c.y - v.ultima.y, c.x - v.ultima.x) + Math.PI / 2 : 0
            v.lado = -v.lado
            v.pegadas.push({ x: c.x + Math.cos(ang) * 3 * v.lado, y: c.y + 6 + Math.sin(ang) * 3 * v.lado, t, ang })
            v.ultima = { x: c.x, y: c.y }
          }
        }
        v.pegadas = v.pegadas.filter((p) => t - p.t < PEGADAS.pegadaVidaMs)
        // o fantasma: a bala redonda inofensiva no começo, depois machuca
        const f = posicaoDoFantasma(v.hist, t)
        if (f && pista && !v.fantasma) {
          const bala = pista.balas.criar({ x: f.x, y: f.y, raio: PEGADAS.raio, dano: DANO, atravessa: true, jaAvisada: true, pulso: 0, textura: 'bala-bola', cor: COR, tamanho: 1, origem: 'bonus-pegadas' })
          bala.sprite.setVisible(false)
          bala.inofensiva = true
          bala.vida = Infinity
          v.fantasma = { bala, nasceu: t }
          tocar(arena, 'zumbido')
        }
        if (v.fantasma) {
          const b = v.fantasma.bala
          if (b.morta) v.fantasma = null
          else if (f && pista) {
            b.x = f.x
            b.y = f.y
            b.vx = f.vx
            b.vy = f.vy
            b.sprite.setPosition(f.x, f.y)
            b.inofensiva = t - v.fantasma.nasceu < PEGADAS.nasceMs
          } else b.inofensiva = true
        }
        desenhar(v)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), fantasmas: lados.map((v) => v.fantasma && { x: Math.round(v.fantasma.bala.x), y: Math.round(v.fantasma.bala.y), inofensiva: v.fantasma.bala.inofensiva }) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of lados) if (v.fantasma) v.fantasma.bala.morta = true
      lados = []
      ctx.limpar()
    },
  }
}
