import { tocar } from '../../../audio.js'
import { registrarZona } from '../../../attacks/zonas.js'
import { texturasPraiaCafe } from '../../../arte/praiaCafe.js'
import { POMBOS, planejarBando } from './planosPraiaCafe.js'
import { contextoDoEvento, pistaEncerrada } from './utilPraiaCafe.js'

// POMBOS (arena CAFÉ FRANCÊS): um bando de pombos cruza a caixa em cunha (os do meio na
// frente), voando reto e batendo asas. Sempre sobra um VÃO por onde passar (62 px) e o
// vão do bando seguinte fica perto do anterior (planejarBando). O aviso (POMBOS.avisoMs):
// uma linha de voo pálida em cada fileira, setas na borda de entrada e o vão marcado em
// verde; cada pombo nasce fora da caixa, piscando com "!" na borda, e só sai voando
// quando acaba o aviso (+ o escalonamento da cunha). Cada pombo é uma bala redonda cujo
// sprite é o próprio pombo (com as asas batendo).

const DANO = 4
const FORA = 38

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + (b - a) * sorte()
  const ctx = contextoDoEvento(arena)
  let ativo = false
  let t = 0
  // por caixa: { pista, g, proximo, anterior (plano), bandos: [{ plano, pista, t0, pombos: [bala] }] }
  let lados = []

  const soltar = (v, j) => {
    const plano = planejarBando(sorte, v.pista.caixa.limites, v.anterior)
    const pista = ctx.pistaViva(j)
    if (!pista) return
    v.anterior = plano
    const l = pista.caixa.limites
    const x0 = plano.lado > 0 ? l.left - FORA : l.right + FORA
    const aviso = POMBOS.avisoMs / aceleracao
    const bando = { plano, pista, t0: t, pombos: [] }
    for (const p of plano.pombos) {
      const bala = pista.balas.criar({
        x: x0 - plano.lado * p.atraso * 0.4,
        y: p.y,
        vx: plano.lado * POMBOS.velocidade,
        raio: POMBOS.raio,
        aviso: aviso + p.atraso,
        atravessa: true,
        dano: DANO,
        pulso: 0,
        textura: 'cafe-pombo',
        quadro: 'p0',
        tamanho: 22,
        origem: 'bonus-pombos',
        atualizar: (b) => {
          b.inofensiva = pistaEncerrada(pista)
          // bate as asas e sobe e desce de leve (só o desenho; a colisão fica na linha)
          b.sprite.setFrame(Math.floor(b.idade / 90) % 2 ? 'p1' : 'p0')
          b.sprite.setFlipX(plano.lado < 0)
        },
      })
      bala.sprite.setFlipX(plano.lado < 0)
      bando.pombos.push(bala)
    }
    // a CPU lê as duas faixas cheias (acima e abaixo do vão)
    const zonas = [
      [l.top, plano.vaoY - POMBOS.vao / 2],
      [plano.vaoY + POMBOS.vao / 2, l.bottom],
    ]
    for (const [y0, y1] of zonas) if (y1 - y0 > 2) registrarZona(pista.balas, { tipo: 'area', x: l.left, y: y0, largura: l.width, altura: y1 - y0 }, { ms: aviso, dura: ((l.width + 2 * FORA) / POMBOS.velocidade) * 1000 + 400 })
    v.bandos.push(bando)
    tocar(arena, 'assobio')
  }

  const desenhar = (v) => {
    const g = v.g
    g.clear()
    for (const bando of v.bandos) {
      const idade = t - bando.t0
      const aviso = POMBOS.avisoMs / aceleracao
      if (idade >= aviso) continue
      const l = bando.pista.caixa.limites
      const k = idade / aviso
      const pisca = Math.sin(idade / 70) > 0 ? 1 : 0.55
      const lado = bando.plano.lado
      // linhas de voo (uma por pombo)
      g.lineStyle(1, 0xdde4f0, (0.18 + 0.25 * k) * pisca)
      for (const p of bando.plano.pombos) {
        for (let x = l.left + 2; x < l.right - 2; x += 10) g.lineBetween(x, p.y, x + 5, p.y)
      }
      // o vão
      g.fillStyle(0x6aff9a, 0.14 + 0.08 * Math.sin(idade / 120))
      g.fillRect(l.left, bando.plano.vaoY - POMBOS.vao / 2, l.width, POMBOS.vao)
      // setas na entrada
      g.lineStyle(3, 0xeef2ff, 0.9 * pisca)
      for (let n = 0; n < 3; n++) {
        const avanco = ((idade / 5 + n * 24) % 72) - 8
        const cx = lado > 0 ? l.left + 12 + avanco : l.right - 12 - avanco
        const s = 7 * lado
        const cy = (l.top + l.bottom) / 2
        g.lineBetween(cx - s, cy - 9, cx, cy)
        g.lineBetween(cx, cy, cx - s, cy + 9)
      }
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      texturasPraiaCafe(arena)
      lados = (arena.pistas ?? []).map((pista, j) => ({ pista, g: ctx.graficoDaCaixa(pista, 4), proximo: entre(POMBOS.primeiro.min, POMBOS.primeiro.max) + j * 350, anterior: null, bandos: [] }))
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((v, j) => {
        v.proximo -= delta
        if (v.proximo <= 0) {
          v.proximo = entre(POMBOS.intervaloMs.min, POMBOS.intervaloMs.max) / aceleracao
          soltar(v, j)
        }
        v.bandos = v.bandos.filter((b) => b.pombos.some((p) => !p.morta))
        desenhar(v)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), bandos: lados.map((v) => v.bandos.map((b) => ({ lado: b.plano.lado, vaoY: Math.round(b.plano.vaoY), pombos: b.pombos.filter((p) => !p.morta).length }))) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of lados) for (const b of v.bandos) for (const p of b.pombos) p.morta = true
      lados = []
      ctx.limpar()
    },
  }
}
