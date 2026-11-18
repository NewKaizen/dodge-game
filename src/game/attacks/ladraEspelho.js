import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'

// A CÓPIA da Ladra (boss semanal). Um vulto da ladra aparece no lado ESPELHADO da caixa (o ponto do outro lado
// do centro, em frente a um coração) e larga uma CARTA-BOMBA ali; em `rajada` ela larga mais, uma atrás da
// outra, sempre no espelho do mesmo coração (andar para o meio puxa as bombas para perto de você). Cada carta
// tem o pavio queimando num anel que fecha; no fim ela explode em naipes nas 4 (ou 8) direções.
//
// Justiça: a carta aparece e queima `aviso` ms (mín. 800) antes de explodir, com o anel do estouro (zona
// circulo para a CPU); os naipes saem da carta e se afastam; entre dois naipes vizinhos sobra a diagonal
// inteira (com 4) ou 2πr/8 (com 8, a 80 px já passa de LACUNA_MINIMA; o pavio dá tempo de chegar lá).
//
//   intervalo   ms entre as rajadas · rajada  cartas por rajada · entre  ms entre as cartas da rajada
//   direcoes    4 (+) ou 8 (+ e x) · velocidade  px/s dos naipes
export default definirAtaque({
  nome: 'ladraEspelho',
  padrao: { duracao: 6500, intervalo: 1700, rajada: 2, entre: 320, aviso: 900, direcoes: 4, velocidade: 150, raio: 6 },
  iniciar(a, cfg) {
    const aviso = Math.max(800, cfg.aviso)
    const NAIPES = ['espadas', 'copas', 'ouros', 'paus']
    // (o pavio queima `aviso` ms: dá para estar a 80 px da carta quando ela explode)
    a.lacuna((2 * Math.PI * 80) / Math.max(4, cfg.direcoes) - cfg.raio * 2, 'entre os naipes da carta-bomba, a 80 px')

    const bomba = (x, y, giro) => {
      const g = a.decoracao(a.cena.add.graphics().setDepth(4))
      let t = 0
      a.zonaPerigo({ tipo: 'circulo', x, y, raio: 26 }, { ms: aviso, dura: 300 })
      // e as linhas dos naipes (a cruz) logo depois
      for (let k = 0; k < cfg.direcoes; k++) {
        const ang = giro + (k / cfg.direcoes) * Math.PI * 2
        a.zonaPerigo({ tipo: 'linha', x1: x, y1: y, x2: x + Math.cos(ang) * 120, y2: y + Math.sin(ang) * 120, espessura: cfg.raio * 2 + 4 }, { ms: aviso, dura: 600 })
      }
      a.aoAtualizar((dt) => {
        if (!g.scene || t > aviso) return
        t += dt
        g.clear()
        if (t > aviso) return
        const p = t / aviso
        // o vulto da ladra some enquanto a carta queima
        if (p < 0.45) {
          const s = 1 - p / 0.45
          g.fillStyle(0xff9a3d, 0.35 * s).fillEllipse(x, y - 8, 18, 26)
          g.fillStyle(0x16101e, 0.6 * s).fillRect(x - 6, y - 14, 12, 4)
        }
        // a cruz que vai sair, bem fraca
        g.lineStyle(1, 0xffb060, 0.15 + 0.3 * p)
        for (let k = 0; k < cfg.direcoes; k++) {
          const ang = giro + (k / cfg.direcoes) * Math.PI * 2
          g.lineBetween(x, y, x + Math.cos(ang) * 40, y + Math.sin(ang) * 40)
        }
        // a carta e o pavio
        g.fillStyle(0xfbf6ea, 1).fillRoundedRect(x - 7, y - 9, 14, 18, 2)
        g.lineStyle(1.5, 0xc8283a, 1).strokeRoundedRect(x - 7, y - 9, 14, 18, 2)
        g.fillStyle(0x1a1a2e, 1).fillCircle(x, y + 1, 3.5)
        g.lineStyle(2, 0xff5a3a, 0.5 + 0.5 * p).strokeCircle(x, y, 26 - 18 * p)
        g.fillStyle(0xffd040, 1).fillCircle(x + 4, y - 9 - 2 * Math.sin(t / 50), 1.8)
      })
      a.depois(aviso, () => {
        tocar(a.cena, 'estouro')
        for (let k = 0; k < cfg.direcoes; k++) {
          const ang = giro + (k / cfg.direcoes) * Math.PI * 2
          a.bala({ x: x + Math.cos(ang) * 6, y: y + Math.sin(ang) * 6, vx: Math.cos(ang) * cfg.velocidade, vy: Math.sin(ang) * cfg.velocidade, raio: cfg.raio, forma: NAIPES[k % 4], jaAvisada: true, girar: 4 })
        }
      })
    }

    a.aCadaEvento(
      cfg.intervalo,
      () => {
        // o coração da vez (o vulto copia sempre o mesmo durante a rajada)
        const alvo = a.alvo()
        const coracao = a.coracoes.filter((c) => c.ativo).sort((p, q) => Math.hypot(p.x - alvo.x, p.y - alvo.y) - Math.hypot(q.x - alvo.x, q.y - alvo.y))[0] ?? null
        const giro = a.escolher([0, Math.PI / 4])
        tocar(a.cena, 'roubo')
        for (let k = 0; k < cfg.rajada; k++) {
          a.depois(k * cfg.entre, () => {
            const l = a.caixa
            const c = coracao?.ativo ? coracao : alvo
            const m = 16
            const x = Math.min(l.right - m, Math.max(l.left + m, 2 * l.centerX - c.x))
            const y = Math.min(l.bottom - m, Math.max(l.top + m, 2 * l.centerY - c.y))
            bomba(x, y, giro + (k % 2) * (Math.PI / Math.max(4, cfg.direcoes)))
          })
        }
      },
      Infinity,
      250,
    )
  },
})
