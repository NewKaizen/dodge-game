import { CORACAO } from '../../../../constants.js'
import { tocar } from '../../../../audio.js'
import { contextoDoCafe } from './util.js'
import { MIMICO, planejarMuros, retangulosDosMuros, empurrarDaParede, quicarNaParede, cancelarJoyNaParede } from './planos.js'

// MÍMICO: um mímico trancou as caixas num labirinto de PAREDES INVISÍVEIS. No começo o
// labirinto aparece fraquinho por ~2 s (dá para ver onde as paredes estão); depois some. Quem
// ENCOSTA numa parede a revela por um instante (a luva branca do mímico marca o ponto) e
// escorrega ao longo dela. As BALAS também quicam nas paredes (e as revelam): um tiro que
// parecia passar reto volta. Não machuca: só empurra e desvia as balas. O labirinto nunca
// fecha o caminho (planos.js confere que a caixa continua um pedaço só, com corredores largos).
// A CPU desliza nas paredes (o joy() tira dela só o que empurra para dentro).
// terminar() apaga as paredes, as luvas e devolve tudo como era.

const AZUL = 0xcfeaff
const LUVA = 0xffffff

export default function criar(arena, { rng } = {}) {
  const sorte = rng ?? Math.random
  const ctx = contextoDoCafe(arena)
  let ativo = false
  let t = 0
  let muros = []
  // por pista: { pista, g, rects, vistoEm: [t da última revelação de cada parede], luvas, somEm }
  let lados = []

  const raioDoCoracao = (c) => (CORACAO.tamanho * (c.tamanho ?? 1)) / 2

  const revelar = (s, i, x, y, forte = 1) => {
    s.vistoEm[i] = t
    const ultima = s.luvas.at(-1)
    if (!ultima || t - ultima.t0 > 260 || Math.hypot(ultima.x - x, ultima.y - y) > 14) s.luvas.push({ x, y, t0: t, forte })
    if (t - s.somEm > 160) {
      s.somEm = t
      tocar(arena, 'cravar')
    }
  }

  const recalcular = (s) => {
    s.rects = retangulosDosMuros(muros, s.pista.caixa.limites)
  }

  const desenhar = (s) => {
    const g = s.g
    g.clear()
    const aviso = t < MIMICO.avisoInicialMs
    s.luvas = s.luvas.filter((l) => t - l.t0 < MIMICO.revelaMs)
    s.rects.forEach((r, i) => {
      let alfa = 0
      if (aviso) {
        const sai = Math.min(1, (MIMICO.avisoInicialMs - t) / 600) // some no fim do aviso
        alfa = (0.28 + 0.12 * Math.sin(t / 140)) * sai
      }
      const visto = t - s.vistoEm[i]
      if (visto < MIMICO.revelaMs) alfa = Math.max(alfa, 0.85 * (1 - visto / MIMICO.revelaMs))
      if (alfa <= 0.01) return
      g.fillStyle(AZUL, alfa * 0.45).fillRect(r.left, r.top, r.right - r.left, r.bottom - r.top)
      g.lineStyle(2, 0xffffff, alfa).strokeRect(r.left, r.top, r.right - r.left, r.bottom - r.top)
      // brilho de vidro: uma listra clara na parede
      g.lineStyle(1, 0xffffff, alfa * 0.8)
      const horizontal = r.right - r.left > r.bottom - r.top
      if (horizontal) for (let x = r.left + 8; x < r.right - 6; x += 16) g.lineBetween(x, r.bottom - 1, x + 6, r.top + 1)
      else for (let y = r.top + 8; y < r.bottom - 6; y += 16) g.lineBetween(r.left + 1, y + 6, r.right - 1, y)
    })
    // a luva do mímico no ponto do esbarrão: palma e quatro dedinhos
    for (const l of s.luvas) {
      const k = 1 - (t - l.t0) / MIMICO.revelaMs
      const a = Math.min(1, k * 1.6) * l.forte
      g.fillStyle(0x000000, 0.35 * a).fillCircle(l.x + 1, l.y + 1.5, 6.4)
      g.fillStyle(LUVA, a).fillCircle(l.x, l.y, 6)
      for (const d of [-4.5, -1.5, 1.5, 4.5]) g.fillCircle(l.x + d, l.y - 6.5 - (Math.abs(d) < 3 ? 1 : 0), 2)
      g.lineStyle(1, 0x8a90a8, a).strokeCircle(l.x, l.y, 6)
    }
  }

  const quicarBalas = (s) => {
    for (const b of s.pista.balas.lista) {
      if (b.morta || b.idade < b.aviso) continue
      const raio = b.tipo === 'circulo' ? b.raio : b.tipo === 'retangulo' ? Math.min(b.largura, b.altura) / 2 : (b.espessura ?? 6) / 2
      const i = quicarNaParede(s.rects, b, raio)
      if (i >= 0) revelar(s, i, b.x, b.y, 0.7)
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      muros = planejarMuros(sorte)
      lados = arena.pistas.map((pista) => {
        const g = ctx.naCaixa(pista, arena.add.graphics().setDepth(11.5))
        const s = { pista, g, rects: [], vistoEm: muros.map(() => -1e9), luvas: [], somEm: -1e9 }
        recalcular(s)
        return s
      })
      ctx.instrucao('MURO INVISÍVEL: ENCOSTE E VEJA!', { cor: '#d8f0ff' })
    },

    // desliza nas paredes: só perde a parte do joystick que empurra para dentro
    joy(j, joy) {
      if (!ativo) return joy
      const s = lados[j]
      const c = ctx.coracao(j)
      if (!s || !c || !ctx.ehMeu(j)) return joy
      recalcular(s)
      const { joy: livre, tocou } = cancelarJoyNaParede(s.rects, c.x, c.y, raioDoCoracao(c), joy)
      if (tocou >= 0 && (livre.x !== joy.x || livre.y !== joy.y) && Math.hypot(joy.x - livre.x, joy.y - livre.y) > 25) revelar(s, tocou, c.x, c.y)
      return livre
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      for (const s of lados) {
        recalcular(s)
        const c = ctx.coracao(lados.indexOf(s))
        if (c) {
          const r = empurrarDaParede(s.rects, c.x, c.y, raioDoCoracao(c))
          if (r.tocou >= 0) {
            c.x = r.x
            c.y = r.y
            c.ajustar()
            revelar(s, r.tocou, c.x, c.y)
          }
        }
        quicarBalas(s)
        desenhar(s)
      }
    },

    estadoDebug() {
      return { t: Math.round(t), paredes: lados.map((s) => s.rects.map((r) => [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)])) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      lados = []
      ctx.limpar()
    },
  }
}
