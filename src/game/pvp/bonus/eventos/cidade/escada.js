import { planoEscada, velocidadeDaFaixa, faixaDaEsteira, ESCADA, fatorDoPlano } from './planos.js'
import { avisoNasCaixas, coracaoDe, ehEspelho, pistaViva, texto, tocar } from './util.js'

// ESCADA ROLANTE (CIDADE GRANDE): o chão da caixa são 4 ESTEIRAS (faixas horizontais) de sentidos opostos.
// Quem está em cima de uma esteira é CARREGADO por ela (52 a 84 px/s, bem menos que os 180 do coração:
// sempre dá para andar contra). Os degraus mostram o sentido; de tempos em tempos TODAS invertem (aviso de
// 850 ms: as setas piscam e aparece "INVERTE!"). Não dá dano: o perigo é ser levado para dentro das balas
// (e contra a parede). Plano igual nas duas caixas (semente da rodada); a CPU recalcula a rota a cada
// decisão e compensa sozinha.

const COR_FAIXA = [0x5a6070, 0x474c5c]
const AMARELO = 0xffd23a

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const fator = fatorDoPlano(aceleracao)
  let ativo = false
  let t = 0
  let plano = null
  let proxima = 0
  let anunciada = -1
  let visuais = [] // por pista: { pista, g, aviso }
  let avisos = []

  const desenhar = (v) => {
    const l = v.pista.caixa.limites
    const g = v.g
    const h = l.height / ESCADA.faixas
    const avisando = plano.inversoes[proxima] && t >= plano.inversoes[proxima].avisoEm
    const pisca = avisando && Math.sin(t / 60) > 0
    g.clear()
    for (let k = 0; k < ESCADA.faixas; k++) {
      const y = l.top + h * k
      const vel = velocidadeDaFaixa(plano, k, t)
      const dir = Math.sign(vel) || 1
      g.fillStyle(COR_FAIXA[k % 2], 0.8).fillRect(l.left, y, l.width, h)
      // degraus: barras que andam com a esteira
      const passo = 18
      const deslocamento = (((t * vel) / 1000) % passo + passo) % passo
      g.fillStyle(0x000000, 0.32)
      for (let x = l.left - passo + deslocamento; x < l.right; x += passo) g.fillRect(Math.max(l.left, x), y + 2, Math.min(3, l.right - Math.max(l.left, x)), h - 4)
      // setinhas (chevrons) no sentido atual
      g.lineStyle(2, avisando ? (pisca ? 0xff5a4a : 0xffd23a) : 0xe8e8f0, avisando ? 0.95 : 0.55)
      for (let x = l.left - 36 + ((((t * vel) / 1000) % 36) + 36) % 36; x < l.right; x += 36) {
        const cx = x + 18
        if (cx < l.left + 4 || cx > l.right - 4) continue
        const cy = y + h / 2
        g.lineBetween(cx - dir * 4, cy - 6, cx + dir * 3, cy)
        g.lineBetween(cx + dir * 3, cy, cx - dir * 4, cy + 6)
      }
      // faixa amarela de segurança nas bordas da esteira
      g.fillStyle(AMARELO, 0.8).fillRect(l.left, y, l.width, 2).fillRect(l.left, y + h - 2, l.width, 2)
    }
    g.lineStyle(2, AMARELO, 0.9).strokeRect(l.left + 1, l.top + 1, l.width - 2, l.height - 2)
    v.aviso.setPosition(l.centerX, l.centerY).setText(avisando && pisca ? 'INVERTE!' : '').setAlpha(0.9)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoEscada(sorte)
      proxima = 0
      anunciada = -1
      visuais = arena.pistas.map((pista) => {
        const g = arena.add.graphics().setDepth(2)
        const aviso = texto(arena, 0, 0, '', { cor: '#ff7a6a', tamanho: 18, pista, profundidade: 12, borda: 5 })
        pista.caixa.recortar(g)
        return { pista, g, aviso }
      })
      avisos = avisoNasCaixas(arena, 'O CHÃO ANDA SOZINHO!', { cor: '#ffd23a', ms: 1300, atraso: 100 })
      tocar(arena, 'motor')
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta * fator
      const ev = plano.inversoes[proxima]
      if (ev) {
        if (anunciada < proxima && t >= ev.avisoEm) {
          anunciada = proxima
          tocar(arena, 'aviso')
        }
        if (t >= ev.em) {
          proxima++
          tocar(arena, 'trocar')
        }
      }
      // a esteira carrega o coração (soma ao que o jogador anda; fica preso à caixa como sempre)
      arena.pistas.forEach((pista, j) => {
        const c = coracaoDe(arena, j)
        if (!c?.ativo || ehEspelho(arena, j) || !pistaViva(arena, j)) return
        const k = faixaDaEsteira(pista.caixa.limites, c.y)
        c.x += (velocidadeDaFaixa(plano, k, t) * delta) / 1000
        c.ajustar()
      })
      for (const v of visuais) if (!v.pista.destruida) desenhar(v)
    },

    estadoDebug() {
      return { t: Math.round(t), proxima, velocidades: plano ? plano.faixas.map((_, k) => Math.round(velocidadeDaFaixa(plano, k, t))) : [] }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of visuais) {
        v.g.destroy()
        v.aviso.destroy()
      }
      visuais = []
      avisos.forEach((a) => a.scene && a.destroy())
      avisos = []
    },
  }
}
