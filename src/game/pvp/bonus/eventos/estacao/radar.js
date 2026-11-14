import { tocar } from '../../../../audio.js'
import { foraDaCaixa } from '../../../../entities/fisica.js'
import { RADAR, anguloDoFeixe, feixeVarreu, brilhoDoPing } from './planos.js'
import { criarCofre, avisoDoEvento } from './util.js'

// RADAR (ESTAÇÃO ESPACIAL): a caixa vira a tela de um radar, toda escura. Um feixe verde GIRA (uma volta a cada
// RADAR.voltaMs) e as balas só aparecem quando o feixe passa por elas: um "blip" que vai se apagando (com um
// risquinho mostrando para onde a bala ia). No resto do tempo elas estão no escuro: é lembrar onde estavam e
// para onde iam. O coração é sempre visível, e uma bala coladinha nele também (RADAR.proximidade).
// Avisos continuam valendo: bala ainda piscando (aviso) e bala que ainda está TODA fora da caixa (chegando pela
// faixa de aproximação) aparecem normalmente; ao entrar na caixa elas somem no escuro.
// As balas só são escondidas (sprite.setVisible(false)): a física, o dano e o que a CPU enxerga não mudam.
// terminar() desfaz tudo. As contas do feixe estão em planos.js.

const VERDE = 0x6aff9a
const FUNDO = 0x03120a

export default function criar(arena) {
  const cofre = criarCofre(arena)
  let ativo = false
  let t = 0
  // por pista: { pista, fundo, blips, a0 }
  let lados = []

  const desenharFundo = (s, angulo) => {
    const l = s.pista.caixa.limites
    const cx = l.centerX
    const cy = l.centerY
    const g = s.fundo
    g.clear()
    g.fillStyle(FUNDO, 0.93).fillRect(l.left, l.top, l.width, l.height)
    // anéis e mira do radar
    g.lineStyle(1, VERDE, 0.2)
    for (const r of [34, 68, 102]) g.strokeCircle(cx, cy, r)
    g.lineBetween(l.left, cy, l.right, cy)
    g.lineBetween(cx, l.top, cx, l.bottom)
    // cauda do feixe (o "rastro" fosforescente)
    const alcance = Math.hypot(l.width, l.height)
    for (let k = 14; k >= 1; k--) {
      const a = angulo - k * 0.05
      g.fillStyle(VERDE, 0.2 * (1 - k / 15) ** 1.4)
      g.fillTriangle(cx, cy, cx + Math.cos(a) * alcance, cy + Math.sin(a) * alcance, cx + Math.cos(a + 0.06) * alcance, cy + Math.sin(a + 0.06) * alcance)
    }
    g.lineStyle(2, 0xd8ffe4, 0.95)
    g.lineBetween(cx, cy, cx + Math.cos(angulo) * alcance, cy + Math.sin(angulo) * alcance)
    g.fillStyle(VERDE, 0.9).fillCircle(cx, cy, 2.5)
  }

  // contorno do blip: círculo, retângulo ou segmento, no lugar onde o feixe pegou a bala
  const desenharBlip = (g, p, brilho) => {
    const a = 0.85 * brilho
    g.lineStyle(2, VERDE, a)
    g.fillStyle(VERDE, 0.28 * brilho)
    if (p.tipo === 'circulo') {
      g.fillCircle(p.x, p.y, p.raio + 1)
      g.strokeCircle(p.x, p.y, p.raio + 2.5 + (1 - brilho) * 5)
    } else if (p.tipo === 'retangulo') {
      g.fillRect(p.x - p.largura / 2, p.y - p.altura / 2, p.largura, p.altura)
      g.strokeRect(p.x - p.largura / 2 - 1, p.y - p.altura / 2 - 1, p.largura + 2, p.altura + 2)
    } else {
      const cos = Math.cos(p.angulo) * (p.comprimento / 2)
      const sin = Math.sin(p.angulo) * (p.comprimento / 2)
      g.lineStyle(Math.max(2, p.espessura), VERDE, 0.7 * brilho)
      g.lineBetween(p.x - cos, p.y - sin, p.x + cos, p.y + sin)
    }
    // risquinho: o caminho que a bala ia fazer (0,3 s)
    const v = Math.hypot(p.vx, p.vy)
    if (v > 8) {
      const comp = Math.min(34, v * 0.3)
      const dx = p.vx / v
      const dy = p.vy / v
      g.lineStyle(1.5, 0xd8ffe4, 0.7 * brilho)
      g.lineBetween(p.x, p.y, p.x + dx * comp, p.y + dy * comp)
      g.fillStyle(0xd8ffe4, 0.8 * brilho).fillCircle(p.x + dx * comp, p.y + dy * comp, 1.6)
    }
  }

  const atualizarBalas = (s, a0, a1) => {
    const l = s.pista.caixa.limites
    const c = s.pista.coracoes[0]
    const cx = l.centerX
    const cy = l.centerY
    s.blips.clear()
    for (const b of s.pista.balas.lista) {
      if (b.morta) continue
      const piscando = b.idade < b.aviso
      const fora = foraDaCaixa(b, l)
      const perto = c?.ativo && Math.hypot(b.x - c.x, b.y - c.y) - (b.raio ?? 6) < RADAR.proximidade
      if (!piscando && !fora && !b.inofensiva && feixeVarreu(a0, a1, Math.atan2(b.y - cy, b.x - cx))) {
        b.blip = { t, x: b.x, y: b.y, vx: b.vx * (s.pista.balas.fatorVelocidade ?? 1), vy: b.vy * (s.pista.balas.fatorVelocidade ?? 1), tipo: b.tipo, raio: b.raio, largura: b.largura, altura: b.altura, comprimento: b.comprimento, espessura: b.espessura, angulo: b.angulo }
      }
      const aparece = piscando || fora || b.inofensiva || perto
      b.sprite.setVisible(aparece)
      if (perto && !piscando && !fora) b.sprite.setAlpha(0.75)
      if (b.blip) desenharBlip(s.blips, b.blip, brilhoDoPing(t, b.blip.t))
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      lados = arena.pistas.map((pista) => {
        const fundo = cofre.guardar(arena.add.graphics().setDepth(3))
        const blips = cofre.guardar(arena.add.graphics().setDepth(5.5))
        pista.caixa.recortar(fundo, blips)
        return { pista, fundo, blips, a0: anguloDoFeixe(0) }
      })
      tocar(arena, 'ampulheta')
      avisoDoEvento(arena, cofre, 'O FEIXE MOSTRA AS BALAS!', { cor: '#8affb0' })
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      const a1 = anguloDoFeixe(t)
      for (const s of lados) {
        desenharFundo(s, a1)
        atualizarBalas(s, s.a0, a1)
        s.a0 = a1
      }
    },

    estadoDebug() {
      return { angulo: Number(anguloDoFeixe(t).toFixed(2)), escondidas: lados.map((s) => s.pista.balas.lista.filter((b) => !b.sprite.visible).length) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const s of lados) for (const b of s.pista.balas.lista) b.sprite.setVisible(true)
      cofre.limpar()
      lados = []
    },
  }
}
