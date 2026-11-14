import { tocar } from '../../../audio.js'
import { ignorarNasCaixas } from '../../../recorte.js'
import { registrarZona } from '../../../attacks/zonas.js'
import { texturasPraiaCafe } from '../../../arte/praiaCafe.js'
import { BULE, planejarVapor } from './planosPraiaCafe.js'
import { contextoDoEvento, pistaEncerrada } from './utilPraiaCafe.js'

// BULE QUENTE (arena CAFÉ FRANCÊS): um bule de chá apita ao lado de cada caixa (balança
// e solta vapor) e 2 a 3 NUVENS DE VAPOR se formam em círculos avisados dentro da caixa:
// o círculo pulsa e enche de vapor durante BULE.avisoMs (fumacinhas subindo) e então
// ESTOURA, queimando por BULE.vidaMs. As nuvens ficam sempre afastadas umas das outras
// (planejarVapor), então há caminho livre. Cada nuvem é uma bala redonda normal (aviso,
// dano, i-frames; a CPU lê o círculo); o sprite dela fica escondido e o vapor é desenhado
// por este evento.

const DANO = 4
const COR = 0xff8a5a

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + (b - a) * sorte()
  const ctx = contextoDoEvento(arena)
  let ativo = false
  let t = 0
  // por caixa: { pista, g, proximo, nuvens: [{ bala, x, y, raio, fase }], bule: { cont, apito } }
  let lados = []

  // o bule: ao lado interno da caixa, no vão entre as duas (objeto de tela)
  const criarBule = (pista, j) => {
    const l = pista.caixa.limites
    const x = j === 0 ? l.right + 38 : l.left - 38
    const y = l.top + 46
    const cont = ctx.guardar(arena.add.container(x, y).setDepth(60))
    const g = arena.add.graphics()
    // corpo
    g.fillStyle(0x000000, 0.25).fillEllipse(0, 22, 40, 8)
    g.fillStyle(0xc8d0e0, 1).fillEllipse(0, 6, 36, 28)
    g.fillStyle(0xeef2fa, 1).fillEllipse(-5, 1, 16, 10)
    g.lineStyle(2, 0x5a6a8a, 1).strokeEllipse(0, 6, 36, 28)
    // faixa azul
    g.fillStyle(0x3a6ad8, 1).fillRect(-17, 6, 34, 4)
    // tampa e botão
    g.fillStyle(0xaeb8cc, 1).fillEllipse(0, -7, 20, 8)
    g.fillStyle(0x3a6ad8, 1).fillCircle(0, -12, 3)
    // bico (direita) e alça (esquerda)
    g.fillStyle(0xc8d0e0, 1).fillTriangle(15, 4, 28, -8, 20, 10)
    g.lineStyle(3, 0x5a6a8a, 1).beginPath().arc(-18, 4, 9, -Math.PI / 2, Math.PI / 2, true).strokePath()
    cont.add(g)
    ignorarNasCaixas(arena, cont)
    return { cont, x, y, apito: 0 }
  }

  const nascerNuvens = (v, j) => {
    const l0 = v.pista.caixa.limites
    const c0 = v.pista.coracoes?.[0]
    const plano = planejarVapor(sorte, l0, c0?.ativo ? { x: c0.x, y: c0.y } : null)
    const pista = ctx.pistaViva(j)
    if (!pista) return
    const aviso = BULE.avisoMs / aceleracao
    for (const n of plano) {
      const bala = pista.balas.criar({
        x: n.x,
        y: n.y,
        raio: n.raio,
        aviso,
        vida: BULE.vidaMs,
        atravessa: true,
        dano: DANO,
        cor: COR,
        pulso: 0,
        textura: 'arte-vazio',
        tamanho: 2,
        origem: 'bonus-bule',
        atualizar: (b) => {
          b.inofensiva = pistaEncerrada(pista)
        },
      })
      bala.sprite.setVisible(false)
      registrarZona(pista.balas, { tipo: 'circulo', x: n.x, y: n.y, raio: n.raio }, { ms: aviso, dura: BULE.vidaMs })
      v.nuvens.push({ bala, x: n.x, y: n.y, raio: n.raio, fase: entre(0, 6.28) })
    }
    v.bule.apito = t
    tocar(arena, 'fumaca')
  }

  const desenhar = (v) => {
    const g = v.g
    g.clear()
    for (const n of v.nuvens) {
      const b = n.bala
      if (b.morta) continue
      if (b.idade < b.aviso) {
        // vapor juntando: o círculo pulsa e vai enchendo; fumacinhas sobem de dentro
        const k = b.idade / b.aviso
        const pisca = Math.sin(b.idade / 65) > 0 ? 1 : 0.6
        g.fillStyle(0xffd8c8, (0.2 + 0.3 * k) * pisca)
        g.fillCircle(n.x, n.y, n.raio * (0.55 + 0.45 * k))
        g.lineStyle(3, COR, (0.7 + 0.3 * k) * pisca)
        g.strokeCircle(n.x, n.y, n.raio)
        g.lineStyle(1, 0xffffff, 0.8 * pisca)
        g.strokeCircle(n.x, n.y, n.raio - 4)
        g.lineStyle(2, 0xffffff, 0.55)
        for (let w = 0; w < 3; w++) {
          const ph = (t / 600 + w / 3 + n.fase) % 1
          const wx = n.x + (w - 1) * n.raio * 0.5 + Math.sin(ph * 9 + w) * 3
          const wy = n.y + n.raio * 0.5 - ph * n.raio * 1.3
          g.beginPath()
          g.arc(wx, wy, 3.5, 0, Math.PI * 1.4)
          g.strokePath()
        }
      } else {
        // estourou: nuvem cheia de vapor (várias bolas), some no fim
        const k = (b.idade - b.aviso) / BULE.vidaMs
        const alpha = k < 0.75 ? 0.85 : 0.85 * (1 - (k - 0.75) / 0.25)
        for (const [dx, dy, r, a] of [[0, 0, 1, 1], [-0.45, 0.2, 0.62, 0.9], [0.45, 0.15, 0.66, 0.9], [0.05, -0.45, 0.6, 0.9], [-0.15, 0.5, 0.5, 0.8]]) {
          g.fillStyle(0xffffff, alpha * a * 0.7)
          g.fillCircle(n.x + dx * n.raio + Math.sin(t / 70 + dx * 9) * 1.5, n.y + dy * n.raio, n.raio * r)
        }
        g.lineStyle(2, COR, alpha)
        g.strokeCircle(n.x, n.y, n.raio)
      }
    }
  }

  const animarBule = (v) => {
    const { cont, apito } = v.bule
    const apitando = t - apito < BULE.avisoMs / aceleracao
    cont.setAngle(apitando ? Math.sin(t / 25) * 5 : 0)
    cont.setScale(1, apitando ? 1 + Math.abs(Math.sin(t / 50)) * 0.05 : 1)
    // fumacinha do bico (sempre um pouquinho; muito enquanto apita)
    if (t - (v.bule.ultimaFumaca ?? 0) > (apitando ? 70 : 260)) {
      v.bule.ultimaFumaca = t
      const p = ctx.guardar(arena.add.circle(cont.x + 26, cont.y - 8, apitando ? 4 : 2.5, 0xffffff, apitando ? 0.7 : 0.4).setDepth(61))
      ignorarNasCaixas(arena, p)
      arena.tweens.add({ targets: p, x: p.x + entre(-6, 14), y: p.y - 26 - entre(0, 12), scale: 2.2, alpha: 0, duration: 650, onComplete: () => p.destroy() })
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      texturasPraiaCafe(arena)
      lados = (arena.pistas ?? []).map((pista, j) => ({ pista, g: ctx.graficoDaCaixa(pista, 4), proximo: entre(BULE.primeiro.min, BULE.primeiro.max) + j * 400, nuvens: [], bule: criarBule(pista, j) }))
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((v, j) => {
        v.proximo -= delta
        if (v.proximo <= 0) {
          v.proximo = entre(BULE.intervaloMs.min, BULE.intervaloMs.max) / aceleracao
          nascerNuvens(v, j)
        }
        v.nuvens = v.nuvens.filter((n) => !n.bala.morta)
        desenhar(v)
        animarBule(v)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), nuvens: lados.map((v) => v.nuvens.map((n) => ({ x: Math.round(n.x), y: Math.round(n.y), raio: Math.round(n.raio), avisando: n.bala.idade < n.bala.aviso }))) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of lados) for (const n of v.nuvens) n.bala.morta = true
      lados = []
      ctx.limpar()
    },
  }
}
