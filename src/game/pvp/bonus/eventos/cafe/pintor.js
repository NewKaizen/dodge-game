import { tocar } from '../../../../audio.js'
import { particulas } from '../../../../effects/particulas.js'
import { contextoDoCafe, rngFilho, tom } from './util.js'
import { PINTOR, planejarPincelada, tintaRevelada, dentroDaTinta, entre } from './planos.js'

// PINTOR: um pintor de boina pinta partes da caixa. Primeiro o contorno tracejado da pincelada
// pisca (PINTOR.avisoMs); depois o pincel passa e a tinta aparece. TINTA MOLHADA CONGELA O QUE
// ENTRA NELA: a bala que encosta na tinta para no lugar, pintada, e vira um OBSTÁCULO (ainda
// machuca, mas fica parada). Quando a tinta seca (PINTOR.molhadoMs) a tinta e o que ficou
// preso nela se desfazem em lascas. A tinta em si não machuca nem prende o coração; a
// pincelada nunca cobre mais que PINTOR.areaMax da caixa e no máximo `maxAtivas` ao mesmo tempo.
// A CPU vê as balas congeladas como balas paradas. Cada caixa tem o seu sorteio (filho do rng
// da rodada), igual nos dois PCs. terminar() apaga a tinta, o pintor e solta nada (as balas
// já saem sozinhas quando o ataque acaba).

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const ctx = contextoDoCafe(arena)
  let ativo = false
  let t = 0
  // por pista: { pista, sorte, g, pintor (pincel, dentro da caixa), figura (o pintor, em cima dela), proximo, ativas: [{ p, t0, presas }] }
  let lados = []

  const fase = (a) => {
    const idade = t - a.t0
    if (idade < PINTOR.avisoMs) return { nome: 'aviso', k: idade / PINTOR.avisoMs }
    if (idade < PINTOR.avisoMs + PINTOR.pincelMs) return { nome: 'pincel', k: (idade - PINTOR.avisoMs) / PINTOR.pincelMs }
    if (idade < PINTOR.avisoMs + PINTOR.pincelMs + PINTOR.molhadoMs) return { nome: 'molhado', k: (idade - PINTOR.avisoMs - PINTOR.pincelMs) / PINTOR.molhadoMs }
    return { nome: 'seco', k: 1 }
  }

  const congelar = (a, b) => {
    b.congelada = true
    b.vx = 0
    b.vy = 0
    b.ax = 0
    b.ay = 0
    b.arranque = null
    b.atualizar = null
    b.girar = 0
    b.quicar = 0
    b.vida = Infinity
    b.sprite.setTint(tom(a.p.cor, 1.25)).setAlpha(1)
    a.presas.push(b)
    tocar(arena, 'congelar')
  }

  const secar = (s, a) => {
    for (const b of a.presas) {
      if (b.morta || !b.sprite?.scene) continue
      b.morta = true
      b.sprite.setVisible(false)
      particulas(arena, b.x, b.y, { cor: a.p.cor, quantidade: 5, velocidade: 50, vida: 420 })
    }
    a.presas = []
  }

  const desenharPintor = (g, x, y, dir) => {
    // boina, rosto, bigode, jaleco e o braço com o pincel
    g.fillStyle(0x000000, 0.3).fillEllipse(x, y + 18, 18, 5)
    g.fillStyle(0x3a5aa8, 1).fillRoundedRect(x - 6, y + 2, 12, 15, 3)
    g.fillStyle(0xf6d2b0, 1).fillCircle(x, y - 2, 6)
    g.fillStyle(0xc83a3a, 1).fillEllipse(x - dir * 1, y - 7, 14, 5)
    g.fillCircle(x - dir * 1, y - 10, 1.8)
    g.fillStyle(0x2a1810, 1).fillRect(x - 3, y, 6, 1.4)
    g.fillStyle(0x1a1010, 1).fillRect(x - 2.5, y - 3, 1.4, 1.4).fillRect(x + 1.2, y - 3, 1.4, 1.4)
  }

  const desenharPincel = (g, x, y, cor, dir) => {
    g.lineStyle(3, 0x8a5a2a, 1).lineBetween(x - dir * 2, y - 12, x, y)
    g.fillStyle(0xc8c8d8, 1).fillRect(x - 2, y - 3, 4, 4)
    g.fillStyle(cor, 1).fillCircle(x, y + 2, 3.4)
    g.fillStyle(0xffffff, 0.5).fillCircle(x - 1, y + 1, 1)
  }

  const desenharPincelada = (s, a) => {
    const g = s.g
    const f = fase(a)
    const p = a.p
    const cor = p.cor
    if (f.nome === 'aviso') {
      const pisca = Math.sin(t / 70) > 0 ? 0.9 : 0.4
      g.lineStyle(2, cor, pisca)
      g.fillStyle(cor, 0.1 + 0.1 * f.k)
      if (p.forma === 'mancha') {
        g.fillCircle(p.x, p.y, p.raio)
        const pedacos = 12
        for (let i = 0; i < pedacos; i++) {
          const a0 = (i / pedacos) * Math.PI * 2 + t / 500
          g.beginPath()
          g.arc(p.x, p.y, p.raio, a0, a0 + (Math.PI * 2) / pedacos / 1.7)
          g.strokePath()
        }
      } else {
        g.fillRect(p.x, p.y, p.largura, p.altura)
        const tracos = (x0, y0, x1, y1) => {
          const d = Math.hypot(x1 - x0, y1 - y0)
          for (let q = 0; q < d; q += 12) g.lineBetween(x0 + ((x1 - x0) * q) / d, y0 + ((y1 - y0) * q) / d, x0 + ((x1 - x0) * Math.min(d, q + 7)) / d, y0 + ((y1 - y0) * Math.min(d, q + 7)) / d)
        }
        tracos(p.x, p.y, p.x + p.largura, p.y)
        tracos(p.x, p.y + p.altura, p.x + p.largura, p.y + p.altura)
        tracos(p.x, p.y, p.x, p.y + p.altura)
        tracos(p.x + p.largura, p.y, p.x + p.largura, p.y + p.altura)
      }
      return
    }
    // tinta (revelada aos poucos enquanto o pincel passa)
    const r = tintaRevelada(p, f.nome === 'pincel' ? f.k : 1)
    let alfa = 0.62
    if (f.nome === 'molhado') alfa = f.k > 0.86 ? 0.62 * (1 - (f.k - 0.86) / 0.14) + 0.12 : 0.62
    const seca = f.nome === 'molhado' ? f.k : 0
    g.fillStyle(tom(cor, 1 - 0.25 * seca), alfa)
    if (r.forma === 'mancha') {
      g.fillCircle(r.x, r.y, r.raio)
      g.fillStyle(0xffffff, 0.22 * (1 - seca)).fillEllipse(r.x - r.raio * 0.3, r.y - r.raio * 0.35, r.raio * 0.7, r.raio * 0.4)
    } else {
      g.fillRoundedRect(r.x, r.y, r.largura, r.altura, 6)
      g.fillStyle(0xffffff, 0.2 * (1 - seca)).fillRect(r.x + 3, r.y + 3, Math.max(0, r.largura - 6), 3)
    }
    g.lineStyle(2, tom(cor, 0.7), 0.8 * alfa)
    if (r.forma === 'mancha') g.strokeCircle(r.x, r.y, r.raio)
    else g.strokeRoundedRect(r.x, r.y, r.largura, r.altura, 6)
    // escorridos
    if (f.nome === 'molhado' && r.forma !== 'mancha') {
      g.fillStyle(tom(cor, 0.9), alfa)
      for (let x = r.x + 8; x < r.x + r.largura - 4; x += 19) g.fillRect(x, r.y + r.altura, 3, 3 + ((x * 7) % 7) * (1 - seca))
    }
  }

  const mexerNaPista = (s, j, delta) => {
    const viva = ctx.pistaViva(j)
    const l = s.pista.caixa.limites
    // novas pinceladas só enquanto a caixa está em ataque
    if (viva) {
      s.proximo -= delta
      if (s.proximo <= 0) {
        const molhadas = s.ativas.filter((a) => fase(a).nome !== 'seco').map((a) => a.p)
        const p = s.ativas.length < PINTOR.maxAtivas ? planejarPincelada(s.sorte, l, molhadas) : null
        if (p) {
          s.ativas.push({ p, t0: t, presas: [], somEm: false })
          s.proximo = entre(s.sorte, PINTOR.intervaloMs.min, PINTOR.intervaloMs.max) / aceleracao
          tocar(arena, 'aviso')
        } else s.proximo = 500
      }
    }
    // congela o que encosta na tinta molhada
    for (const a of s.ativas) {
      const f = fase(a)
      if (f.nome === 'pincel' && !a.pintando) {
        a.pintando = true
        tocar(arena, 'patins')
      }
      if (f.nome !== 'pincel' && f.nome !== 'molhado') continue
      const r = tintaRevelada(a.p, f.nome === 'pincel' ? f.k : 1)
      for (const b of s.pista.balas.lista) {
        if (b.morta || b.congelada || b.idade < b.aviso || b.inofensiva) continue
        if (dentroDaTinta(r, b.x, b.y)) congelar(a, b)
      }
    }
    // secou: a tinta e as balas presas nela se desfazem
    const secas = s.ativas.filter((a) => fase(a).nome === 'seco' || !viva)
    for (const a of secas) secar(s, a)
    s.ativas = s.ativas.filter((a) => !secas.includes(a))
  }

  const desenharTudo = (s) => {
    s.g.clear()
    s.pintor.clear()
    s.figura.clear()
    const ultima = s.ativas.at(-1)
    for (const a of s.ativas) desenharPincelada(s, a)
    // as balas presas na tinta ganham um aro (viraram obstáculos parados)
    for (const a of s.ativas) {
      for (const b of a.presas) {
        if (b.morta || !b.sprite?.scene) continue
        s.g.lineStyle(2, 0xffffff, 0.85).strokeCircle(b.x, b.y, (b.raio ?? 6) + 3.5)
        s.g.lineStyle(1, tom(a.p.cor, 0.6), 0.9).strokeCircle(b.x, b.y, (b.raio ?? 6) + 5.5)
      }
    }
    // o pintor fica na borda de onde a pincelada começa, com o pincel na ponta da tinta
    if (!ultima) return
    const l = s.pista.caixa.limites
    const f = fase(ultima)
    const p = ultima.p
    const k = f.nome === 'pincel' ? f.k : f.nome === 'aviso' ? 0 : 1
    const r = tintaRevelada(p, k)
    let ponta
    let dir = 1
    if (p.forma === 'mancha') ponta = { x: p.x, y: p.y }
    else if (p.de === 'e') ponta = { x: r.x + r.largura, y: p.y + p.altura / 2 }
    else if (p.de === 'd') ponta = { x: r.x, y: p.y + p.altura / 2 }
    else if (p.de === 'c') ponta = { x: p.x + p.largura / 2, y: r.y + r.altura }
    else ponta = { x: p.x + p.largura / 2, y: r.y }
    if (p.de === 'd') dir = -1
    // pintor em cima da caixa, acompanhando o pincel (nunca fora da tela da caixa)
    const px = Math.min(l.right - 10, Math.max(l.left + 10, ponta.x))
    desenharPintor(s.figura, px, l.top - 28, dir)
    desenharPincel(s.pintor, ponta.x, ponta.y, p.cor, dir)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      lados = arena.pistas.map((pista) => {
        const filho = rngFilho(sorte)
        const g = ctx.naCaixa(pista, arena.add.graphics().setDepth(4))
        const pintor = ctx.naCaixa(pista, arena.add.graphics().setDepth(11.4))
        const figura = ctx.naTela(arena.add.graphics().setDepth(60))
        const s = { pista, sorte: filho, g, pintor, figura, proximo: entre(filho, PINTOR.primeira.min, PINTOR.primeira.max), ativas: [] }
        return s
      })
      ctx.instrucao('TINTA MOLHADA CONGELA BALAS!', { cor: '#ffd0e8' })
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((s, j) => {
        mexerNaPista(s, j, delta)
        desenharTudo(s)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), tintas: lados.map((s) => s.ativas.map((a) => ({ forma: a.p.forma, fase: fase(a).nome, presas: a.presas.length }))) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const s of lados) for (const a of s.ativas) secar(s, a)
      lados = []
      ctx.limpar()
    },
  }
}
