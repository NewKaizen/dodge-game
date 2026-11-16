import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'

// LINHAS DE XEQUE do Chaos King (dificuldade do CO-OP). O rei dá xeque no coração: as linhas de uma TORRE
// (+, horizontal e vertical) ou de um BISPO (x, as diagonais) se cruzam bem onde um coração está agora. As
// linhas acendem finas (o aviso) e depois viram raios de verdade por um instante. Com `pecas: 'dama'` são as
// duas juntas (a estrela de 8 pontas da rainha). O `eco` repete o xeque logo depois, onde o coração estiver
// indo (quem só deu um passo para o lado leva o segundo).
//
// Justiça: cada linha acende `aviso` ms antes (mín. 500) e tem `espessura` px (sobra a caixa inteira fora
// dela); o raio dura `dura` ms; o eco também é avisado (mín. 450 ms).
//
//   intervalo   ms entre um xeque e o próximo (alterna os corações)
//   pecas       'torre' | 'bispo' | 'alterna' | 'dama'
//   eco         0..1: fração dos xeques com o segundo xeque
export default definirAtaque({
  nome: 'kingXeque',
  padrao: { duracao: 6500, intervalo: 1500, aviso: 800, espessura: 12, dura: 320, pecas: 'alterna', eco: 0, avisoEco: 520 },
  iniciar(a, cfg) {
    const aviso = Math.max(500, cfg.aviso)
    const avisoEco = Math.max(450, cfg.avisoEco)
    let eco = a.aleatorio(0, 1)
    // a velocidade de cada coração (para o eco mirar para onde ele vai)
    const ultimo = new Map()
    const velocidade = new Map()
    a.aoAtualizar((dt) => {
      for (const c of a.coracoes) {
        const p = ultimo.get(c)
        if (p && dt > 0) velocidade.set(c, { vx: ((c.x - p.x) / dt) * 1000, vy: ((c.y - p.y) / dt) * 1000 })
        ultimo.set(c, { x: c.x, y: c.y })
      }
    })

    // a linha que passa por (px, py) com o ângulo `ang`, cortada na caixa
    const linha = (px, py, ang) => {
      const l = a.caixa
      const dx = Math.cos(ang)
      const dy = Math.sin(ang)
      const ts = []
      if (Math.abs(dx) > 1e-6) ts.push((l.left - px) / dx, (l.right - px) / dx)
      if (Math.abs(dy) > 1e-6) ts.push((l.top - py) / dy, (l.bottom - py) / dy)
      const dentro = ts.map((t) => ({ t, x: px + dx * t, y: py + dy * t })).filter((q) => q.x >= l.left - 0.5 && q.x <= l.right + 0.5 && q.y >= l.top - 0.5 && q.y <= l.bottom + 0.5)
      dentro.sort((p, q) => p.t - q.t)
      const p1 = dentro[0] ?? { x: px, y: py }
      const p2 = dentro[dentro.length - 1] ?? { x: px, y: py }
      return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }
    }

    const xeque = (px, py, angulos, ms) => {
      tocar(a.cena, 'aviso')
      for (const ang of angulos) {
        const s = linha(px, py, ang)
        a.aviso({ tipo: 'linha', ...s, espessura: cfg.espessura, ms, cor: 0xffd23c }, () => {
          const comp = Math.hypot(s.x2 - s.x1, s.y2 - s.y1)
          if (comp < 2) return
          a.bala({ x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2, comprimento: comp, espessura: cfg.espessura / 2, angulo: ang, forma: 'barra', cor: 0xffd23c, vida: cfg.dura, atravessa: true, jaAvisada: true, pulso: 0 })
        })
      }
      a.depois(ms, () => {
        tocar(a.cena, 'laser')
        a.tremer(90, 0.006)
      })
    }

    const TORRE = [0, Math.PI / 2]
    const BISPO = [Math.PI / 4, -Math.PI / 4]
    a.aCadaEvento(
      cfg.intervalo,
      (i) => {
        const l = a.caixa
        const alvo = a.alvo()
        const px = Math.min(l.right - 6, Math.max(l.left + 6, alvo.x))
        const py = Math.min(l.bottom - 6, Math.max(l.top + 6, alvo.y))
        const peca = cfg.pecas === 'alterna' ? (i % 2 ? 'bispo' : 'torre') : cfg.pecas
        const angulos = peca === 'dama' ? [...TORRE, ...BISPO] : peca === 'bispo' ? BISPO : TORRE
        xeque(px, py, angulos, aviso)
        eco += cfg.eco
        if (eco >= 1) {
          eco -= 1
          // o segundo xeque: onde o coração mirado estará quando o primeiro bater, com as outras linhas
          a.depois(aviso - avisoEco + cfg.dura + 120, () => {
            const c = a.coracoes.filter((x) => x.ativo).sort((p, q) => Math.hypot(p.x - px, p.y - py) - Math.hypot(q.x - px, q.y - py))[0]
            if (!c) return
            const v = velocidade.get(c) ?? { vx: 0, vy: 0 }
            const lc = a.caixa
            const ex = Math.min(lc.right - 6, Math.max(lc.left + 6, c.x + v.vx * 0.25))
            const ey = Math.min(lc.bottom - 6, Math.max(lc.top + 6, c.y + v.vy * 0.25))
            xeque(Math.round(ex), Math.round(ey), peca === 'torre' ? BISPO : TORRE, avisoEco)
          })
        }
      },
      Infinity,
      300,
    )
  },
})
