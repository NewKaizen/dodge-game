import Phaser from 'phaser'
import { tocar } from '../../../audio.js'

// GELO SECO: a máquina de fumaça exagerou. Uma fumaça densa sobe do chão das
// caixas e cobre a METADE DE BAIXO (com a superfície ondulando e subindo e
// descendo um pouco). Lá dentro as balas viram SILHUETAS escuras (sem cor nem
// brilho, como vultos na névoa): dá para desviar, mas tem que prestar atenção.
// O coração fica sempre por cima da fumaça (você nunca se perde).
// De tempos em tempos um jato de CO2 sai do chão (chiado) e a fumaça incha
// um pouco naquele trecho. Nada de dano novo: é só visual.
//
// Camadas dentro da caixa: balas normais (5) < corpo da fumaça (6) <
// silhuetas (6.5, a bala que entrou na fumaça) < tufos macios por cima (7) <
// coração (10).

const SOBE_MS = 1400 // a fumaça sobe do chão até a metade
const NIVEL = { base: 0.5, oscila: 0.05, periodoMs: 4200 } // fração da caixa coberta (de baixo para cima)
const ONDA = { amp: 4, comprimento: 46, velocidade: 0.9 } // ondulação da superfície
const JATO = { min: 2200, max: 3600, ms: 1300, altura: 0.16, largura: 0.3 } // jatos de CO2
const COR = { corpo: 0x6e5c8e, claro: 0xc8b8ec, silhueta: 0x1c0c2a }
const TUFOS = 9 // tufos macios rolando na superfície, por caixa

// metade da altura da bala (formas de Bullets.js)
const meiaAltura = (b) =>
  b.tipo === 'circulo' ? b.raio : b.tipo === 'retangulo' ? b.altura / 2 : (Math.abs(Math.sin(b.angulo)) * b.comprimento) / 2 + b.espessura / 2

export default function criar(arena, { rng } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + (b - a) * sorte()
  let ativo = false
  let t = 0
  let visuais = [] // por pista: { pista, corpo, tufos, jatos, proximoJato, sombreadas: Map(sprite -> { tint, modo, depth }) }

  const texturaTufo = () => (arena.textures.exists('bonus-holofote') ? 'bonus-holofote' : null)

  // altura (y) da superfície da fumaça no x, na caixa l
  const superficie = (v, l, x) => {
    const sobe = Math.min(1, t / SOBE_MS)
    const nivel = (NIVEL.base + Math.sin((t / NIVEL.periodoMs) * Math.PI * 2) * NIVEL.oscila) * (1 - Math.pow(1 - sobe, 3))
    let y = l.bottom - l.height * nivel
    y += Math.sin(x / ONDA.comprimento + (t / 1000) * ONDA.velocidade * Math.PI) * ONDA.amp
    y += Math.sin(x / (ONDA.comprimento * 0.47) - (t / 1000) * 1.7) * ONDA.amp * 0.5
    for (const jato of v.jatos) {
      const k = jato.t / JATO.ms
      const forca = Math.sin(Math.min(1, k) * Math.PI) // incha e volta
      const d = (x - jato.x) / (l.width * JATO.largura * 0.5)
      if (Math.abs(d) < 1) y -= l.height * JATO.altura * forca * (1 - d * d)
    }
    return Math.max(l.top - 10, y)
  }

  const criarVisual = (pista) => {
    const corpo = arena.add.graphics().setDepth(6)
    const chave = texturaTufo()
    const tufos = Array.from({ length: TUFOS }, (_, k) => {
      const img = chave ? arena.add.image(0, 0, chave).setTint(COR.claro) : arena.add.circle(0, 0, 14, COR.claro)
      img.setDepth(7).setAlpha(0)
      return { img, fx: k / TUFOS, v: entre(0.025, 0.06) * (k % 2 ? 1 : -1), escala: entre(0.7, 1.2), fase: entre(0, 6) }
    })
    pista.caixa.recortar(corpo, tufos.map((u) => u.img))
    return { pista, corpo, tufos, jatos: [], proximoJato: entre(1400, 2200), sombreadas: new Map() }
  }

  const desenhar = (v, delta) => {
    const l = v.pista.caixa.limites
    const alfa = Math.min(1, t / 500)
    // corpo: polígono da superfície ondulada até o chão
    const g = v.corpo
    g.clear()
    const pontos = []
    for (let x = l.left - 4; x <= l.right + 4; x += 6) pontos.push({ x, y: superficie(v, l, x) })
    pontos.push({ x: l.right + 4, y: l.bottom + 4 }, { x: l.left - 4, y: l.bottom + 4 })
    g.fillStyle(COR.corpo, 0.86 * alfa)
    g.fillPoints(pontos, true)
    // faixa clara na crista (a luz do palco batendo na fumaça)
    g.lineStyle(3, COR.claro, 0.55 * alfa)
    g.strokePoints(pontos.slice(0, -2))
    // mais densa no fundo: degradê em faixas
    for (let k = 0; k < 4; k++) {
      const y0 = l.bottom - (l.height * 0.12 * (k + 1))
      g.fillStyle(0x4a3a66, 0.18 * alfa)
      g.fillRect(l.left, y0, l.width, l.bottom - y0)
    }
    // tufos macios rolando pela superfície
    for (const u of v.tufos) {
      u.fx = (u.fx + (u.v * delta) / 1000 + 1.2) % 1.2
      const x = l.left - l.width * 0.1 + u.fx * l.width
      const y = superficie(v, l, x) + 6 + Math.sin(t / 700 + u.fase) * 3
      u.img.setPosition(x, y).setAlpha(0.42 * alfa)
      if (u.img.setDisplaySize) u.img.setDisplaySize(52 * u.escala, 30 * u.escala)
    }
  }

  // bala dentro da fumaça vira silhueta (pintura FILL escura, por cima do corpo);
  // saiu, volta ao que era
  const sombrear = (v) => {
    const l = v.pista.caixa.limites
    const dentro = new Set()
    for (const b of v.pista.balas.lista) {
      const s = b.sprite
      if (!s?.active) continue
      // só a bala INTEIRA dentro da fumaça vira vulto (uma barra comprida que
      // sai por cima continua normal: escura em cima do fundo preto sumiria)
      if (b.y - meiaAltura(b) < superficie(v, l, b.x)) continue
      dentro.add(s)
      if (!v.sombreadas.has(s)) {
        v.sombreadas.set(s, { tint: s.tintTopLeft, modo: s.tintMode, depth: s.depth })
        s.setTint(COR.silhueta).setTintMode(Phaser.TintModes.FILL).setDepth(6.5)
      }
    }
    for (const [s, antes] of v.sombreadas) {
      if (dentro.has(s)) continue
      if (s.active) s.setTint(antes.tint).setTintMode(antes.modo).setDepth(antes.depth)
      v.sombreadas.delete(s)
    }
  }

  const soltarJato = (v) => {
    const l = v.pista.caixa.limites
    v.jatos.push({ x: entre(l.left + l.width * 0.15, l.right - l.width * 0.15), t: 0 })
    tocar(arena, 'fumaca')
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      tocar(arena, 'fumaca')
      visuais = arena.pistas.map(criarVisual)
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      for (const v of visuais) {
        for (const jato of v.jatos) jato.t += delta
        v.jatos = v.jatos.filter((jato) => jato.t < JATO.ms)
        v.proximoJato -= delta
        if (v.proximoJato <= 0 && t > SOBE_MS) {
          v.proximoJato = entre(JATO.min, JATO.max)
          soltarJato(v)
        }
        desenhar(v, delta)
        sombrear(v)
      }
    },

    estadoDebug() {
      return { t: Math.round(t), silhuetas: visuais.map((v) => v.sombreadas.size) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of visuais) {
        for (const [s, antes] of v.sombreadas) if (s.active) s.setTint(antes.tint).setTintMode(antes.modo).setDepth(antes.depth)
        v.sombreadas.clear()
        v.corpo.destroy()
        v.tufos.forEach((u) => u.img.destroy())
      }
      visuais = []
    },
  }
}
