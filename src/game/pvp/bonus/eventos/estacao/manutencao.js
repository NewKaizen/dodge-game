import { tocar } from '../../../../audio.js'
import { fatores } from '../../../../acessibilidade.js'
import { MANUTENCAO, planoPaineis, emCimaDoPainel, passoReparo, barradaPeloEscudo } from './planos.js'
import { criarCofre, avisoDoEvento, ehBot, pistaViva } from './util.js'

// MANUTENÇÃO (ESTAÇÃO ESPACIAL): painéis com defeito PISCAM em âmbar dentro de cada caixa (um por vez, nos tempos
// do plano, os mesmos nas duas caixas). Ficar com o coração EM CIMA de um painel por MANUTENCAO.repararMs (uma
// barrinha enche em cima dele) o CONSERTA. Sair antes faz o conserto regredir (mais rápido do que subiu).
// Painel consertado vira um ESCUDO fixo (azul, com hexágonos) até o fim da rodada: a bala que encosta nele some
// em faíscas (balas enormes, como feixes, passam). O coração pode ficar atrás/em cima do escudo. Painéis
// quebrados não machucam: o risco é ficar parado (1 s) no meio das balas. Os painéis nunca se encostam
// (sobra um vão de 20 px, planos.js). A CPU conserta quando não tem bala por perto.
// Na caixa espelho (online) o conserto é pelo coração espelhado: só para mostrar (o dano é de cada dono).

const AMBAR = 0xffb020
const AZUL = 0x4ad8ff
const ESCURO = 0x1d2430

export default function criar(arena, { rng } = {}) {
  const sorte = rng ?? Math.random
  const cofre = criarCofre(arena)
  let ativo = false
  let t = 0
  let plano = []
  // por pista: { pista, g, paineis: [{ fx, fy, x, y, nasceu, prog, pronto, brilho }], proxima, faiscas }
  let lados = []

  const pos = (s, p) => {
    const l = s.pista.caixa.limites
    p.x = l.left + p.fx * l.width
    p.y = l.top + p.fy * l.height
  }

  const faiscar = (s, x, y) => {
    if (fatores().particulas < 0.2) return
    for (let n = 0; n < 4; n++) s.faiscas.push({ x, y, vx: (sorte() - 0.5) * 120, vy: (sorte() - 0.5) * 120, vida: 0 })
  }

  const consertar = (s, p) => {
    p.pronto = true
    p.prog = 1
    p.brilho = t
    if (!s.pista.espelho) tocar(arena, 'escudo')
    for (let n = 0; n < 10; n++) faiscar(s, p.x + (sorte() - 0.5) * MANUTENCAO.w, p.y + (sorte() - 0.5) * MANUTENCAO.h)
  }

  const desenharPainel = (g, s, p) => {
    const w = MANUTENCAO.w
    const h = MANUTENCAO.h
    const x = p.x - w / 2
    const y = p.y - h / 2
    const nascendo = Math.min(1, (t - p.nasceu) / 350)
    if (p.pronto) {
      // escudo: placa azul translúcida com hexágonos e brilho pulsando
      const pulso = 0.8 + 0.2 * Math.sin(t / 240 + p.fx * 9)
      const flash = Math.max(0, 1 - (t - p.brilho) / 420)
      g.fillStyle(AZUL, 0.18 * pulso + 0.3 * flash).fillRect(x, y, w, h)
      g.lineStyle(1, 0xbff4ff, 0.35)
      for (let hx = x + 5; hx < x + w; hx += 9) for (let hy = y + 4 + (((hx - x) / 9) % 2 ? 0 : 5); hy < y + h - 2; hy += 10) g.strokeCircle(hx, hy, 3.2)
      g.lineStyle(2, 0xdffaff, 0.95 * pulso).strokeRect(x, y, w, h)
      g.lineStyle(5, AZUL, 0.18 + 0.25 * flash).strokeRect(x - 2, y - 2, w + 4, h + 4)
      return
    }
    // painel quebrado: chapa escura com listras de aviso, lâmpada pisca (mais devagar com "reduzir animações")
    const periodo = 190 * fatores().pulso
    const pisca = Math.sin(t / periodo) > -0.2
    g.fillStyle(ESCURO, 0.92 * nascendo).fillRect(x, y, w, h)
    g.fillStyle(AMBAR, (pisca ? 0.28 : 0.08) * nascendo).fillRect(x, y, w, h)
    g.lineStyle(2, AMBAR, (pisca ? 1 : 0.4) * nascendo).strokeRect(x, y, w, h)
    // listras de perigo na borda de baixo e de cima
    g.fillStyle(AMBAR, 0.8 * nascendo)
    for (let k = 0; k < w; k += 8) {
      g.fillTriangle(x + k, y + h - 3, x + k + 4, y + h - 3, x + k + 2, y + h)
      g.fillTriangle(x + k, y, x + k + 4, y, x + k + 2, y + 3)
    }
    // chave inglesa estilizada (um "x" de fios soltos) e a lâmpada
    g.lineStyle(1.5, 0xff6a3a, 0.8 * nascendo)
    g.lineBetween(x + w * 0.3, y + h * 0.35, x + w * 0.5, y + h * 0.6)
    g.lineBetween(x + w * 0.5, y + h * 0.6, x + w * 0.45, y + h * 0.8)
    g.fillStyle(pisca ? 0xff4a2a : 0x552218, 1).fillCircle(x + w - 6, y + 6, 2.4)
    // barra do conserto em cima do painel
    if (p.prog > 0.01) {
      g.fillStyle(0x000000, 0.8).fillRect(x, y - 8, w, 5)
      g.fillStyle(AZUL, 1).fillRect(x + 1, y - 7, (w - 2) * p.prog, 3)
      g.fillStyle(AZUL, 0.18 * p.prog).fillRect(x, y, w, h)
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoPaineis(sorte)
      lados = arena.pistas.map((pista) => {
        const g = cofre.guardar(arena.add.graphics().setDepth(4.2))
        const fx = cofre.guardar(arena.add.graphics().setDepth(5.8))
        pista.caixa.recortar(g, fx)
        return { pista, g, fx, paineis: [], proxima: 0, faiscas: [] }
      })
      tocar(arena, 'aviso')
      avisoDoEvento(arena, cofre, 'CONSERTE OS PAINÉIS PISCANDO!', { cor: '#ffd070' })
    },

    // CPU: sem bala por perto, vai ao painel quebrado mais perto e fica em cima dele
    joy(j, joy) {
      const s = lados[j]
      if (!ativo || !s || !ehBot(arena, j) || s.pista.espelho) return joy
      const c = s.pista.coracoes[0]
      if (!c?.ativo) return joy
      const alvo = s.paineis.filter((p) => !p.pronto).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0]
      if (!alvo) return joy
      const perigo = s.pista.balas.lista.some((b) => !b.morta && !b.inofensiva && Math.hypot(b.x - alvo.x, b.y - alvo.y) < 70) || Math.hypot(joy.x, joy.y) > 55
      if (perigo) return joy
      if (emCimaDoPainel(c.x, c.y, alvo.x, alvo.y)) return { x: joy.x * 0.2, y: joy.y * 0.2 }
      const dx = alvo.x - c.x
      const dy = alvo.y - c.y
      const d = Math.hypot(dx, dy) || 1
      return { x: (dx / d) * 70, y: (dy / d) * 70 }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((s, j) => {
        const c = s.pista.coracoes[0]
        while (s.proxima < plano.length && t >= plano[s.proxima].em) {
          const p = { fx: plano[s.proxima].fx, fy: plano[s.proxima].fy, x: 0, y: 0, nasceu: t, prog: 0, pronto: false, brilho: 0 }
          s.paineis.push(p)
          s.proxima++
          if (j === 0) tocar(arena, 'aviso')
        }
        const valendo = pistaViva(arena, j)
        s.g.clear()
        for (const p of s.paineis) {
          pos(s, p)
          if (!p.pronto && c?.ativo && (valendo || s.pista.espelho)) {
            const dentro = emCimaDoPainel(c.x, c.y, p.x, p.y)
            p.prog = passoReparo(p.prog, dentro, delta)
            if (dentro && sorte() < 0.25) faiscar(s, p.x + (sorte() - 0.5) * MANUTENCAO.w, p.y + (sorte() - 0.5) * MANUTENCAO.h)
            if (p.prog >= 1) consertar(s, p)
          }
          desenharPainel(s.g, s, p)
        }
        // o escudo barra as balas
        for (const b of s.pista.balas.lista) {
          if (b.morta || b.segurada || b.marcaPlaneta || b.idade < b.aviso) continue
          for (const p of s.paineis) {
            if (!p.pronto || !barradaPeloEscudo(b, p.x, p.y)) continue
            b.morta = true
            p.brilho = t - 300 // um brilho curtinho onde bateu
            faiscar(s, b.x, b.y)
            break
          }
        }
        s.fx.clear()
        s.faiscas = s.faiscas.filter((f) => {
          f.vida += delta
          if (f.vida > 340) return false
          f.x += (f.vx * delta) / 1000
          f.y += (f.vy * delta) / 1000
          s.fx.fillStyle(0xcff6ff, 1 - f.vida / 340).fillRect(f.x, f.y, 2, 2)
          return true
        })
      })
    },

    estadoDebug() {
      return { paineis: lados.map((s) => s.paineis.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), prog: Number(p.prog.toFixed(2)), pronto: p.pronto }))) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      cofre.limpar()
      lados = []
    },
  }
}
