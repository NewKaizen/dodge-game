import { TEMPOS } from '../../../../constants.js'
import { tocar } from '../../../../audio.js'
import { ignorarNasCaixas } from '../../../../recorte.js'
import { OXIGENIO, planoBolhas, drenarO2, recarregarO2, danoDoSufoco } from './planos.js'
import { criarCofre, avisoDoEvento, ehBot, ehEspelho, pistaViva, texto, dono } from './util.js'

// OXIGÊNIO (ESTAÇÃO ESPACIAL): a estação perdeu o ar. Cada caixa tem uma barra de O₂ que esvazia sozinha. Bolhas
// de oxigênio aparecem (primeiro só o contorno se fechando: AVISO, depois sólidas) e quem encostar o coração
// nelas RECARREGA a barra, em lugares que obrigam a sair da zona segura enquanto se desvia. Barra vazia = o
// coração engasga: dano PEQUENO a cada OXIGENIO.tickMs (2% do HP máximo, mínimo 1; com os i-frames de sempre),
// e as bordas da caixa escurecem. O plano das bolhas (planoBolhas) é o mesmo nas duas caixas e sempre tem uma
// bolha disponível. A CPU anda na direção da bolha quando o ar está acabando e não tem bala em cima dela.
// Em rede o dano só vale no coração daqui (arena.acertou cuida); na caixa espelho a barra é só para mostrar.

const BARRA = { largura: 120, altura: 7 }
const CIANO = 0x7fe8ff

export default function criar(arena, { rng } = {}) {
  const sorte = rng ?? Math.random
  const cofre = criarCofre(arena)
  let ativo = false
  let t = 0
  let plano = []
  // por pista: { pista, o2, tick, proxima, bolhas, g, vinheta, barra, rotulo, avisado }
  let lados = []

  const hpMaxDe = (j) => arena.estado?.jogadores?.[dono(arena, j)]?.hpMax ?? 100

  const nascer = (s, p) => {
    const l = s.pista.caixa.limites
    const x = l.left + p.fx * l.width
    const y = l.top + p.fy * l.height
    const rotulo = cofre.guardar(texto(arena, x, y, 'O2', { pista: s.pista, tamanho: 8, profundidade: 6 }))
    rotulo.setAlpha(0)
    s.bolhas.push({ fx: p.fx, fy: p.fy, x, y, nasceu: t, rotulo, fase: sorte() * 6.3 })
  }

  const coletar = (s, b, j) => {
    b.coletada = true
    s.o2 = recarregarO2(s.o2)
    s.tick = 0
    if (!ehEspelho(arena, j)) tocar(arena, 'cura')
    const anel = cofre.guardar(arena.add.circle(b.x, b.y, OXIGENIO.raio).setStrokeStyle(2, 0xffffff, 0.9).setDepth(11))
    s.pista.caixa.recortar(anel)
    arena.tweens.add({ targets: anel, scale: 3, alpha: 0, duration: 300, onComplete: () => anel.destroy() })
    const mais = cofre.guardar(texto(arena, b.x, b.y - 10, '+O2', { pista: s.pista, tamanho: 10, cor: '#aef4ff', profundidade: 12 }))
    arena.tweens.add({ targets: mais, y: mais.y - 14, alpha: 0, duration: 650, onComplete: () => mais.destroy() })
  }

  const sufocar = (s, j) => {
    const c = s.pista.coracoes[0]
    if (!c?.ativo || c.invencivel || ehEspelho(arena, j)) return
    if (!arena.acertou(dono(arena, j), danoDoSufoco(hpMaxDe(j)))) return
    c.tomarDano(TEMPOS.invencivelMs)
    tocar(arena, 'dano')
  }

  const desenhar = (s) => {
    const l = s.pista.caixa.limites
    const g = s.g
    g.clear()
    // bolhas
    for (const b of s.bolhas) {
      const idade = t - b.nasceu
      const flutua = Math.sin(t / 420 + b.fase) * 2
      const y = b.y + flutua
      b.rotulo.setPosition(b.x, y)
      if (idade < OXIGENIO.avisoMs) {
        // aviso: o contorno se fecha sobre o lugar (pisca)
        const k = idade / OXIGENIO.avisoMs
        const r = OXIGENIO.raio * (2.4 - 1.4 * k)
        g.lineStyle(2, 0xffffff, Math.sin(idade / 60) > 0 ? 0.85 : 0.3)
        g.strokeCircle(b.x, y, r)
        g.fillStyle(CIANO, 0.1 + 0.1 * k).fillCircle(b.x, y, OXIGENIO.raio)
        b.rotulo.setAlpha(0.4)
      } else {
        const resta = OXIGENIO.avisoMs + OXIGENIO.vidaMs - idade
        const some = resta < 1000 && Math.sin(idade / 70) > 0
        const a = some ? 0.35 : 1
        g.fillStyle(CIANO, 0.3 * a).fillCircle(b.x, y, OXIGENIO.raio)
        g.lineStyle(2, 0xdffaff, 0.95 * a).strokeCircle(b.x, y, OXIGENIO.raio)
        g.lineStyle(2, 0xffffff, 0.8 * a)
        g.strokePoints(Array.from({ length: 7 }, (_, k) => ({ x: b.x + Math.cos(Math.PI * (1.1 + 0.075 * k)) * (OXIGENIO.raio - 3.5), y: y + Math.sin(Math.PI * (1.1 + 0.075 * k)) * (OXIGENIO.raio - 3.5) })))
        b.rotulo.setAlpha(a)
      }
    }
    // vinheta: as bordas escurecem quando o ar acaba
    const aperto = Math.max(0, 1 - s.o2 / 0.3)
    if (aperto > 0.02) {
      const e = 26 + aperto * 18
      const a = (0.18 + 0.5 * aperto) * (s.o2 <= 0 ? 0.8 + 0.2 * Math.sin(t / 130) : 1)
      g.fillGradientStyle(0x001020, 0x001020, 0x001020, 0x001020, a, a, 0, 0).fillRect(l.left, l.top, l.width, e)
      g.fillGradientStyle(0x001020, 0x001020, 0x001020, 0x001020, 0, 0, a, a).fillRect(l.left, l.bottom - e, l.width, e)
      g.fillGradientStyle(0x001020, 0x001020, 0x001020, 0x001020, a, 0, a, 0).fillRect(l.left, l.top, e, l.height)
      g.fillGradientStyle(0x001020, 0x001020, 0x001020, 0x001020, 0, a, 0, a).fillRect(l.right - e, l.top, e, l.height)
    }
    // barra de O2 embaixo da caixa
    const x = l.centerX - BARRA.largura / 2
    const y = l.bottom + 10
    const baixo = s.o2 < 0.3
    const pisca = (baixo || s.o2 <= 0) && Math.sin(t / 90) > 0
    const cor = s.o2 <= 0 ? (pisca ? 0xffffff : 0xff3a3a) : baixo ? (pisca ? 0xffffff : 0xffa030) : CIANO
    s.barra.clear()
    s.barra.fillStyle(0x000000, 0.75).fillRect(x - 2, y - 2, BARRA.largura + 4, BARRA.altura + 4)
    s.barra.fillStyle(0x0a2a38, 1).fillRect(x, y, BARRA.largura, BARRA.altura)
    s.barra.fillStyle(cor, 1).fillRect(x, y, BARRA.largura * s.o2, BARRA.altura)
    s.rotulo.setPosition(x - 6, y + BARRA.altura / 2).setText(s.o2 <= 0 ? 'SEM AR!' : 'O2').setColor(s.o2 <= 0 ? (pisca ? '#ffffff' : '#ff5a5a') : '#9eeaff')
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoBolhas(sorte)
      lados = arena.pistas.map((pista) => {
        const g = cofre.guardar(arena.add.graphics().setDepth(6))
        pista.caixa.recortar(g)
        const barra = cofre.guardar(arena.add.graphics().setDepth(70))
        ignorarNasCaixas(arena, barra)
        const rotulo = cofre.guardar(texto(arena, 0, 0, 'O2', { tamanho: 10, cor: '#9eeaff' }).setOrigin(1, 0.5).setDepth(70))
        return { pista, o2: OXIGENIO.inicial, tick: 0, proxima: 0, bolhas: [], g, barra, rotulo }
      })
      tocar(arena, 'bolha')
      avisoDoEvento(arena, cofre, 'PEGUE AS BOLHAS DE AR!', { cor: '#9eeaff' })
    },

    // CPU: o ar está acabando e a bolha está livre? vai para ela
    joy(j, joy) {
      const s = lados[j]
      if (!ativo || !s || !ehBot(arena, j) || s.o2 > 0.45) return joy
      const c = s.pista.coracoes[0]
      if (!c?.ativo) return joy
      const b = s.bolhas.find((x) => t - x.nasceu >= OXIGENIO.avisoMs && !x.coletada)
      if (!b) return joy
      if (s.pista.balas.lista.some((x) => !x.morta && !x.inofensiva && Math.hypot(x.x - c.x, x.y - c.y) < 52)) return joy
      const dx = b.x - c.x
      const dy = b.y - c.y
      const d = Math.hypot(dx, dy)
      if (d < 4) return joy
      const k = s.o2 <= 0 ? 55 : 40
      return { x: Math.max(-100, Math.min(100, joy.x + (dx / d) * k)), y: Math.max(-100, Math.min(100, joy.y + (dy / d) * k)) }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((s, j) => {
        const c = s.pista.coracoes[0]
        const valendo = pistaViva(arena, j)
        // bolhas do plano (as vivas ao mesmo tempo são limitadas)
        while (s.proxima < plano.length && t >= plano[s.proxima].em) {
          if (valendo && s.bolhas.length < OXIGENIO.maxVivas) nascer(s, plano[s.proxima])
          s.proxima++
        }
        for (const b of s.bolhas) {
          const idade = t - b.nasceu
          if (!b.coletada && idade >= OXIGENIO.avisoMs && c?.ativo && Math.hypot(c.x - b.x, c.y - b.y) < OXIGENIO.raio + 6) coletar(s, b, j)
          if (idade >= OXIGENIO.avisoMs + OXIGENIO.vidaMs) b.coletada = true
        }
        s.bolhas = s.bolhas.filter((b) => {
          if (!b.coletada) return true
          b.rotulo.destroy()
          return false
        })
        if (valendo) {
          s.o2 = drenarO2(s.o2, delta)
          if (s.o2 <= 0) {
            s.tick += delta
            if (s.tick >= OXIGENIO.tickMs) {
              s.tick = 0
              sufocar(s, j)
            }
          } else s.tick = 0
        }
        desenhar(s)
      })
    },

    estadoDebug() {
      return { o2: lados.map((s) => Number(s.o2.toFixed(2))), bolhas: lados.map((s) => s.bolhas.length) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      cofre.limpar()
      lados = []
    },
  }
}
