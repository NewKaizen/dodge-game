import { tocar } from '../../../../audio.js'
import { particulas } from '../../../../effects/particulas.js'
import { contextoDoCafe } from './util.js'
import { LATTE, atualizarTinta, estenderTrilha, detectarLaco, pontoNoPoligono } from './planos.js'

// LATTE ART: o coração vira o pingo de leite de um barista. Por onde ele anda fica uma linha
// de espuma (que dura ~2,8 s) e FECHAR UM LAÇO com ela apaga todas as balas lá dentro (viram
// espuma). A regra nova: o jeito de se mexer importa, não só o lugar. A tinta é limitada:
// o tanque (a jarrinha embaixo da caixa) gasta com a linha, recarrega um pouco sempre e
// bem mais com o coração quase parado; cada bala apagada devolve um pouco. A linha nunca
// machuca o coração e as balas atravessam ela; só o laço fechado vale.
// A CPU não precisa saber: ela desvia como sempre (e os laços acontecem sozinhos nas curvas).
// terminar() apaga a linha, as jarrinhas e as espumas.

const ESPUMA = 0xfff3dc
const CONTORNO = 0x7a4a2a
const FLASH_MS = 520

export default function criar(arena) {
  const ctx = contextoDoCafe(arena)
  let ativo = false
  let t = 0
  // por pista: { pista, g, jarra, trilha, tinta, ultimo, semTinta, espumas }
  let lados = []

  const apagar = (s, poligono) => {
    let n = 0
    for (const b of s.pista.balas.lista) {
      if (b.morta || b.idade < b.aviso) continue
      if (!pontoNoPoligono(b.x, b.y, poligono)) continue
      b.morta = true
      b.sprite.setVisible(false)
      n++
      particulas(arena, b.x, b.y, { cor: 0xfff3dc, quantidade: 5, velocidade: 60, vida: 380 })
    }
    return n
  }

  const desenharTrilha = (s) => {
    const g = s.g
    g.clear()
    const { trilha } = s
    // laços recém-fechados: o miolo fica branco e some
    s.espumas = s.espumas.filter((e) => t - e.t0 < FLASH_MS)
    for (const e of s.espumas) {
      const k = 1 - (t - e.t0) / FLASH_MS
      g.fillStyle(ESPUMA, 0.55 * k)
      g.beginPath()
      g.moveTo(e.poligono[0].x, e.poligono[0].y)
      for (const p of e.poligono) g.lineTo(p.x, p.y)
      g.closePath()
      g.fillPath()
      g.lineStyle(4, 0xffffff, 0.9 * k)
      g.strokePoints(e.poligono, true)
    }
    for (let i = 1; i < trilha.length; i++) {
      if (trilha[i].q) continue
      const a = trilha[i - 1]
      const b = trilha[i]
      const idade = Math.min(1, (t - b.t) / LATTE.vidaMs)
      const alfa = 1 - idade * idade
      g.lineStyle(9 - 3 * idade, CONTORNO, 0.6 * alfa)
      g.lineBetween(a.x, a.y, b.x, b.y)
      g.lineStyle(6 - 2.6 * idade, ESPUMA, 0.98 * alfa)
      g.lineBetween(a.x, a.y, b.x, b.y)
    }
  }

  const desenharJarra = (s) => {
    const l = s.pista.caixa.limites
    const g = s.jarra
    const larg = 110
    const x = l.centerX - larg / 2
    const y = l.bottom + 9
    const baixa = s.tinta < 0.15
    const pisca = baixa && Math.sin(t / 90) > 0
    g.clear()
    g.fillStyle(0x000000, 0.7).fillRoundedRect(x - 3, y - 3, larg + 6, 12, 4)
    g.fillStyle(0x3a2418, 1).fillRoundedRect(x, y, larg, 6, 3)
    g.fillStyle(pisca ? 0xff6a50 : ESPUMA, 1).fillRoundedRect(x, y, Math.max(2, larg * s.tinta), 6, 3)
    g.lineStyle(1, 0xffffff, 0.5)
    for (const f of [0.25, 0.5, 0.75]) g.lineBetween(x + larg * f, y, x + larg * f, y + 6)
    s.rotulo.setPosition(l.centerX, y + 17).setText(baixa ? 'SEM LEITE! PARE UM POUCO' : 'LEITE').setColor(baixa ? '#ff9a80' : '#ffe9c8')
  }

  const mexer = (s, j, delta) => {
    const c = ctx.coracao(j)
    const valendo = Boolean(c) && ctx.pistaViva(j)
    if (!valendo) {
      s.ultimo = null
      s.tinta = atualizarTinta(s.tinta, { dtMs: delta, parado: true, desenhando: false })
      return
    }
    const andou = s.ultimo ? Math.hypot(c.x - s.ultimo.x, c.y - s.ultimo.y) : 0
    const velocidade = (andou * 1000) / Math.max(1, delta)
    const podia = s.tinta > 0.002
    const desenha = podia && andou > 0
    s.tinta = atualizarTinta(s.tinta, { distancia: andou, dtMs: delta, parado: velocidade < LATTE.paradoPxS, desenhando: desenha })
    if (podia) {
      estenderTrilha(s.trilha, { x: c.x, y: c.y }, t, { quebra: s.semTinta })
      s.semTinta = false
    } else s.semTinta = true // sem leite: a linha para e, quando voltar, o corte fica marcado
    s.ultimo = { x: c.x, y: c.y }
    const laco = detectarLaco(s.trilha)
    if (laco) {
      const n = apagar(s, laco.poligono)
      s.espumas.push({ poligono: laco.poligono, t0: t })
      s.trilha.length = laco.inicio + 1 // o laço fechou: a linha recomeça dali
      if (n) {
        s.tinta = Math.min(1, s.tinta + n * LATTE.tintaPorBala)
        tocar(arena, 'bolha')
        tocar(arena, 'confirmar')
      } else tocar(arena, 'bolha')
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      lados = arena.pistas.map((pista) => {
        const g = ctx.naCaixa(pista, arena.add.graphics().setDepth(9))
        const jarra = ctx.naTela(arena.add.graphics().setDepth(70))
        const rotulo = ctx.texto(0, 0, 'LEITE', { cor: '#ffe9c8', tamanho: 9, profundidade: 70 })
        return { pista, g, jarra, rotulo, trilha: [], tinta: 1, ultimo: null, semTinta: false, espumas: [] }
      })
      ctx.instrucao('FECHE UM LAÇO: APAGA BALAS!', { cor: '#fff3dc' })
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((s, j) => {
        mexer(s, j, delta)
        desenharTrilha(s)
        desenharJarra(s)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), tinta: lados.map((s) => Math.round(s.tinta * 100) / 100), pontos: lados.map((s) => s.trilha.length) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      lados = []
      ctx.limpar()
    },
  }
}
