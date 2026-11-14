import { SOMBRAS, posicaoAtrasada, registrarPosicao } from './planos.js'
import { CORES, criarVivos, instrucao, calmo } from './comum.js'

// SOMBRAS CHINESAS: teatro de sombras. As caixas viram telas de papel iluminadas por trás e as
// balas só aparecem como SILHUETAS de papel recortado: maiores (SOMBRAS.escala) e ATRASADAS
// (a sombra mostra onde a bala estava há SOMBRAS.atrasoMs: o atraso é sempre o mesmo, então dá
// para prever). A bala de verdade (hitbox) segue no lugar certo e aparece como um contorno fraco
// (visível também na faixa de fora da caixa, por onde ela entra). Balas ainda avisando (paradas,
// piscando) aparecem como sombra piscando no próprio lugar.
// terminar() mostra de novo os sprites das balas e apaga o papel.

export default function criar(arena) {
  const vivos = criarVivos()
  let ativo = false
  let t = 0
  let papeis = [] // por caixa: { pista, papel (g), dica (g) }
  const historicos = new WeakMap()

  const fibras = Array.from({ length: 46 }, (_, i) => [(i * 0.6180339) % 1, (i * 0.7548776 + 0.31) % 1, 6 + (i % 5) * 3, (i * 2.399) % 3.14])

  // ---------- o papel ----------

  const desenharPapel = (g, l) => {
    g.clear()
    // papel de arroz com a luz da lanterna atrás (mais claro no meio)
    g.fillGradientStyle(0xe9cf9c, 0xe9cf9c, 0xd2b27a, 0xd2b27a, 0.6, 0.6, 0.66, 0.66)
    g.fillRect(l.left, l.top, l.width, l.height)
    const piscada = calmo() ? 1 : 0.92 + 0.08 * Math.sin(t / 130) * Math.sin(t / 310)
    for (let k = 4; k >= 1; k--) {
      g.fillStyle(0xffe6a8, 0.075 * piscada).fillCircle(l.centerX, l.centerY + l.height * 0.08, (l.width * 0.2 * k) / 1.4 + 18)
    }
    g.lineStyle(1, 0x8a6a3a, 0.28)
    for (const [fx, fy, comp, ang] of fibras) {
      const x = l.left + fx * l.width
      const y = l.top + fy * l.height
      g.lineBetween(x, y, x + Math.cos(ang) * comp, y + Math.sin(ang) * comp * 0.6)
    }
    // ripas de bambu da moldura (cruz fina) e a borda de madeira
    g.lineStyle(1, 0x6a3a14, 0.25)
    g.lineBetween(l.centerX, l.top, l.centerX, l.bottom).lineBetween(l.left, l.centerY, l.right, l.centerY)
    g.lineStyle(5, 0x6a2e10, 0.95).strokeRect(l.left + 1, l.top + 1, l.width - 2, l.height - 2)
    g.lineStyle(1.5, 0xc8782c, 0.9).strokeRect(l.left + 3.5, l.top + 3.5, l.width - 7, l.height - 7)
  }

  // ---------- silhuetas ----------

  const tinta = (g, a = 0.9) => g.fillStyle(CORES.tinta, a)

  const sombraCircular = (g, x, y, r, giro) => {
    const pontas = 9
    const pts = []
    for (let k = 0; k < pontas * 2; k++) {
      const ang = giro + (k / (pontas * 2)) * Math.PI * 2
      const rr = k % 2 ? r * 0.78 : r * 1.08
      pts.push({ x: x + Math.cos(ang) * rr, y: y + Math.sin(ang) * rr })
    }
    tinta(g, 0.22).fillCircle(x, y, r * 1.25)
    tinta(g, 0.9).fillPoints(pts, true)
    // olhinho recortado (a luz passando pelo papel)
    g.fillStyle(0xf0d8a0, 0.55).fillCircle(x + r * 0.15, y - r * 0.12, Math.max(1.2, r * 0.18))
  }

  const sombraRetangular = (g, x, y, w, h) => {
    const m = SOMBRAS.escala * 0.8
    const W = w * m
    const H = h * m
    tinta(g, 0.22).fillRoundedRect(x - W / 2 - 3, y - H / 2 - 3, W + 6, H + 6, 4)
    tinta(g, 0.9).fillRoundedRect(x - W / 2, y - H / 2, W, H, 3)
    const n = Math.max(2, Math.round(Math.max(W, H) / 14))
    g.fillStyle(0xf0d8a0, 0.5)
    for (let k = 0; k < n; k++) {
      if (W >= H) g.fillRect(x - W / 2 + ((k + 0.5) * W) / n - 1, y - 1, 2, 2)
      else g.fillRect(x - 1, y - H / 2 + ((k + 0.5) * H) / n - 1, 2, 2)
    }
  }

  const sombraSegmento = (g, x, y, comp, esp, ang) => {
    const c = Math.cos(ang)
    const s = Math.sin(ang)
    const a = (comp / 2) * 1.15
    const b = Math.max(3, esp * SOMBRAS.escala * 0.7)
    const pts = [
      { x: x - c * a - s * b, y: y - s * a + c * b },
      { x: x + c * a * 0.7 - s * b, y: y + s * a * 0.7 + c * b },
      { x: x + c * a, y: y + s * a },
      { x: x + c * a * 0.7 + s * b, y: y + s * a * 0.7 - c * b },
      { x: x - c * a + s * b, y: y - s * a - c * b },
    ]
    tinta(g, 0.22).fillCircle(x, y, a * 0.9)
    tinta(g, 0.9).fillPoints(pts, true)
  }

  const raioDaBala = (b) => (b.tipo === 'circulo' ? b.raio : 6)

  const dica = (g, b) => {
    const a = SOMBRAS.dicaAlpha
    g.lineStyle(1.5, 0xff5a4a, a)
    if (b.tipo === 'circulo') g.strokeCircle(b.x, b.y, b.raio)
    else if (b.tipo === 'retangulo') g.strokeRect(b.x - b.largura / 2, b.y - b.altura / 2, b.largura, b.altura)
    else {
      const c = Math.cos(b.angulo)
      const s = Math.sin(b.angulo)
      g.lineBetween(b.x - (c * b.comprimento) / 2, b.y - (s * b.comprimento) / 2, b.x + (c * b.comprimento) / 2, b.y + (s * b.comprimento) / 2)
    }
  }

  const desenharBalas = (p) => {
    const g = p.papel
    const gd = p.dica
    gd.clear()
    const l = p.pista.caixa.limites
    for (const b of p.pista.balas.lista) {
      if (b.morta) continue
      b.sprite.setVisible(false)
      let hist = historicos.get(b)
      if (!hist) historicos.set(b, (hist = []))
      registrarPosicao(hist, t, b.x, b.y)
      const avisando = b.idade < b.aviso
      if (avisando && Math.sin(b.idade / 60) < 0) continue
      const pos = avisando ? { x: b.x, y: b.y } : posicaoAtrasada(hist, t)
      // só desenha o que está (em parte) dentro do papel
      if (pos.x < l.left - 40 || pos.x > l.right + 40 || pos.y < l.top - 40 || pos.y > l.bottom + 40) {
        if (!avisando) dica(gd, b)
        continue
      }
      // a varinha do bonequeiro
      g.lineStyle(1.2, CORES.tinta, 0.28).lineBetween(pos.x, pos.y, pos.x + 0.15 * (pos.y - l.centerY), l.bottom)
      const giro = calmo() ? 0.4 : t / 600 + b.fase
      if (b.tipo === 'circulo') sombraCircular(g, pos.x, pos.y, raioDaBala(b) * SOMBRAS.escala, giro)
      else if (b.tipo === 'retangulo') sombraRetangular(g, pos.x, pos.y, b.largura, b.altura)
      else sombraSegmento(g, pos.x, pos.y, b.comprimento, b.espessura, b.angulo)
      if (!avisando) dica(gd, b)
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      papeis = arena.pistas.map((pista) => {
        const papel = vivos.guardar(arena.add.graphics().setDepth(7))
        pista.caixa.recortar(papel)
        const dicaG = vivos.guardar(arena.add.graphics().setDepth(8))
        pista.caixa.aproximar(dicaG)
        return { pista, papel, dica: dicaG }
      })
      instrucao(arena, vivos, 'SÓ SOMBRAS NO PAPEL!', { cor: '#ffe0a0' })
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      for (const p of papeis) {
        const l = p.pista.caixa.limites
        desenharPapel(p.papel, l)
        desenharBalas(p)
      }
    },

    estadoDebug() {
      return { t: Math.round(t), balas: papeis.map((p) => p.pista.balas.lista.length) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const p of papeis) for (const b of p.pista.balas.lista) b.sprite?.scene && b.sprite.setVisible(true)
      vivos.limpar(arena)
      papeis = []
    },
  }
}
