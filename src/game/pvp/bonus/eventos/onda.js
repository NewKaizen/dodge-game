import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { registrarZona } from '../../../attacks/zonas.js'
import { texturasPraiaCafe } from '../../../arte/praiaCafe.js'
import { ONDA, planejarOnda, blocosDaOnda } from './planosPraiaCafe.js'
import { contextoDoEvento, pistaEncerrada } from './utilPraiaCafe.js'

// ONDA GIGANTE (arena PRAIA): de tempos em tempos uma parede de água varre a caixa de
// um lado ao outro. Sempre tem um VÃO por onde a água "abre" (66 px) e o vão da onda
// seguinte fica perto do anterior (planejarOnda), então dá para chegar nele.
// O aviso (ONDA.avisoMs): a faixa da água pisca em azul com espuma e setas no sentido da
// onda, e o vão aparece marcado em verde. A água é feita de balas retangulares normais
// (dano, i-frames, graze, a CPU enxerga), uma acima e uma abaixo do vão, que nascem fora
// da caixa e ficam piscando durante o aviso; o desenho é deste evento.

const COR = 0x2a9fff
const ESPUMA = 0xf2fbff
const DANO = 5

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + (b - a) * sorte()
  const ctx = contextoDoEvento(arena)
  let ativo = false
  let t = 0
  // por caixa: { pista, g, proxima, anterior (plano), onda: { plano, balas, pista, t0, blocos } | null }
  let lados = []

  const vez = (v, j) => {
    // o sorteio sempre acontece (a semente anda igual nos dois PCs); só a criação depende da pista
    const plano = planejarOnda(sorte, v.pista.caixa.limites, v.anterior)
    const pista = ctx.pistaViva(j)
    if (!pista) return
    const l = pista.caixa.limites
    v.anterior = plano
    const x0 = plano.lado > 0 ? l.left - 46 : l.right + 46
    const aviso = ONDA.avisoMs / aceleracao
    const blocos = blocosDaOnda(l, plano.vaoY)
    const balas = blocos.map((b) => {
      const bala = pista.balas.criar({
        x: x0,
        y: (b.y0 + b.y1) / 2,
        vx: plano.lado * ONDA.velocidade,
        largura: ONDA.largura,
        altura: b.y1 - b.y0,
        aviso,
        atravessa: true,
        dano: DANO,
        cor: COR,
        origem: 'bonus-onda',
        atualizar: (bb) => {
          bb.inofensiva = pistaEncerrada(pista)
        },
      })
      bala.sprite.setVisible(false)
      // a CPU lê a faixa inteira
      registrarZona(pista.balas, { tipo: 'area', x: l.left, y: b.y0, largura: l.width, altura: b.y1 - b.y0 }, { ms: aviso, dura: ((l.width + 2 * ONDA.largura + 90) / ONDA.velocidade) * 1000 })
      return bala
    })
    v.onda = { plano, balas, pista, t0: t, blocos, chegou: false }
    tocar(arena, 'avisoOnda')
  }

  // ---------- desenho ----------

  const desenhar = (v) => {
    const g = v.g
    g.clear()
    const o = v.onda
    if (!o) return
    const l = o.pista.caixa.limites
    const aviso = ONDA.avisoMs / aceleracao
    const idade = t - o.t0
    const lado = o.plano.lado
    const metade = ONDA.largura / 2
    if (idade < aviso) {
      const k = idade / aviso
      const pisca = Math.sin(idade / 70) > 0 ? 1 : 0.55
      // a água que vem: faixas azuis piscando com tracejado de espuma na borda do vão
      for (const b of o.blocos) {
        g.fillStyle(COR, (0.12 + 0.2 * k) * pisca)
        g.fillRect(l.left, b.y0, l.width, b.y1 - b.y0)
        g.lineStyle(1, ESPUMA, 0.35 + 0.3 * k)
        const y = b.y0 < o.plano.vaoY ? b.y1 : b.y0
        for (let x = l.left + 3; x < l.right - 3; x += 12) g.lineBetween(x, y, x + 6, y)
      }
      // o vão: verde
      g.fillStyle(0x6aff9a, 0.07 + 0.06 * Math.sin(idade / 140))
      g.fillRect(l.left, o.plano.vaoY - ONDA.vao / 2, l.width, ONDA.vao)
      // setas no sentido da onda
      g.lineStyle(3, ESPUMA, 0.9 * pisca)
      for (let n = 0; n < 3; n++) {
        const avanco = ((idade / 5 + n * 24) % 72) - 8
        const cx = lado > 0 ? l.left + 12 + avanco : l.right - 12 - avanco
        const s = 7 * lado
        for (const b of o.blocos) {
          const cy = (b.y0 + b.y1) / 2
          g.lineBetween(cx - s, cy - 8, cx, cy)
          g.lineBetween(cx, cy, cx - s, cy + 8)
        }
      }
      return
    }
    // a onda andando: corpo azul, espuma na frente e fios de espuma
    const b0 = o.balas[0]
    if (!b0 || b0.morta) return
    const frente = b0.x + lado * metade
    const tras = b0.x - lado * metade
    const xa = Math.min(frente, tras)
    for (const b of o.blocos) {
      const h = b.y1 - b.y0
      g.fillStyle(0x1a6ad0, 0.75)
      g.fillRect(xa, b.y0, ONDA.largura, h)
      g.fillStyle(COR, 0.75)
      g.fillRect(xa + (lado > 0 ? 6 : 0), b.y0, ONDA.largura - 6, h)
      // rastro de água que fica para trás
      g.fillStyle(COR, 0.16)
      g.fillRect(lado > 0 ? tras - 38 : tras, b.y0, 38, h)
      // crista: bolas de espuma ao longo da frente
      for (let y = b.y0 + 3; y < b.y1; y += 7) {
        const bal = Math.sin(t / 90 + y * 0.35) * 2
        g.fillStyle(ESPUMA, 0.95)
        g.fillCircle(frente - lado * (3 + bal), y, 5.5)
        g.fillStyle(0xbfe8ff, 0.9)
        g.fillCircle(frente - lado * (9 + bal), y + 2, 4)
      }
      g.lineStyle(1, ESPUMA, 0.6)
      for (let k = 0; k < Math.floor(h / 14); k++) {
        const y = b.y0 + 7 + k * 14 + Math.sin(t / 130 + k) * 2
        g.lineBetween(xa + 4, y, xa + ONDA.largura - 6, y + 1)
      }
    }
    // espuma nas pontas do vão (a água "abre")
    for (const b of o.blocos) {
      const y = b.y0 < o.plano.vaoY ? b.y1 : b.y0
      g.fillStyle(ESPUMA, 0.9)
      g.fillCircle(frente - lado * 6, y, 4)
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      texturasPraiaCafe(arena)
      lados = (arena.pistas ?? []).map((pista, j) => ({ pista, g: ctx.graficoDaCaixa(pista, 4), proxima: entre(ONDA.primeira.min, ONDA.primeira.max) + j * 350, anterior: null, onda: null }))
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((v, j) => {
        const o = v.onda
        if (o) {
          const l = o.pista.caixa.limites
          const b0 = o.balas[0]
          if (!o.chegou && t - o.t0 >= ONDA.avisoMs / aceleracao) {
            o.chegou = true
            tocar(arena, 'onda')
            shake(arena, 180, 0.003)
          }
          const saiu = !b0 || b0.morta || (o.plano.lado > 0 ? b0.x - ONDA.largura / 2 > l.right + 10 : b0.x + ONDA.largura / 2 < l.left - 10)
          if (saiu && o.chegou) {
            for (const b of o.balas) b.morta = true
            v.onda = null
            v.proxima = entre(ONDA.pausaMs.min, ONDA.pausaMs.max) / aceleracao
          }
        } else {
          v.proxima -= delta
          if (v.proxima <= 0) {
            v.proxima = 9999 // só volta a contar depois que esta onda passar
            vez(v, j)
            if (!v.onda) v.proxima = entre(ONDA.pausaMs.min, ONDA.pausaMs.max) / aceleracao // caixa sem ataque: tenta de novo depois
          }
        }
        desenhar(v)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), ondas: lados.map((v) => (v.onda ? { lado: v.onda.plano.lado, vaoY: Math.round(v.onda.plano.vaoY), avisando: t - v.onda.t0 < ONDA.avisoMs / aceleracao } : null)) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of lados) for (const b of v.onda?.balas ?? []) b.morta = true
      lados = []
      ctx.limpar()
    },
  }
}
