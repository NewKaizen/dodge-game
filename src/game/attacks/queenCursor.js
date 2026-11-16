import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'

// O CURSOR da Queen (dificuldade do CO-OP). A setinha do mouse dela persegue um coração pelo quadro e, de
// tempos em tempos, PARA e CLICA: um anel encolhe na ponta da seta (o aviso), e o clique estoura ali (um
// círculo que vale) soltando pixels em volta. Com `cursores: 2` são duas setas, cada uma atrás de um coração.
// Ficar parado é levar o clique; correr demais para um canto deixa o cursor encurralar.
//
// Justiça: o cursor anda no máximo a velocidade de fuga (FUGA.perseguidor) e é inofensivo; o clique é avisado
// pelo anel na ponta por `aviso` ms (mín. 500), parado; os pixels nascem no fim do clique, no centro dele.
//
//   clique      ms entre os cliques de um cursor
//   velocidade  px/s pedidos do cursor (limitados à fuga)
//   raio        raio do clique · pixels quantos pixels no estouro · velocidadePixel px/s
export default definirAtaque({
  nome: 'queenCursor',
  padrao: { duracao: 6500, clique: 1300, velocidade: 150, aviso: 650, raio: 22, pixels: 6, velocidadePixel: 130, cursores: 1, impacto: 200 },
  iniciar(a, cfg) {
    const aviso = Math.max(500, cfg.aviso)
    const desenhar = (g, x, y, f, clicando) => {
      g.clear()
      // a seta (ponta em x, y)
      g.fillStyle(0xffffff, 1).lineStyle(2, 0x111122, 1)
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x, y + 22)
      g.lineTo(x + 6, y + 17)
      g.lineTo(x + 11, y + 26)
      g.lineTo(x + 15, y + 24)
      g.lineTo(x + 10, y + 15)
      g.lineTo(x + 17, y + 15)
      g.closePath()
      g.fillPath()
      g.strokePath()
      if (clicando) {
        g.lineStyle(2, 0xff4fc8, 0.95).strokeCircle(x, y, cfg.raio + (1 - f) * 26)
        g.fillStyle(0xff4fc8, 0.12 + 0.25 * f).fillCircle(x, y, cfg.raio)
      }
    }

    for (let k = 0; k < cfg.cursores; k++) {
      const l = a.caixa
      const g = a.decoracao(a.cena.add.graphics().setDepth(9))
      const cur = { x: k % 2 ? l.right - 20 : l.left + 20, y: l.top + 16, clicando: 0, mira: null }
      let ate = cfg.clique * (0.6 + 0.4 * k)
      const alvoDoCursor = () => {
        const ativos = a.coracoes.filter((c) => c.ativo)
        return ativos.length ? ativos[k % ativos.length] : null
      }
      a.aoAtualizar((dt) => {
        if (!g.scene) return
        const lc = a.caixa
        if (cur.clicando > 0) {
          cur.clicando -= dt
          desenhar(g, cur.x, cur.y, 1 - Math.max(0, cur.clicando) / aviso, true)
          return
        }
        const c = alvoDoCursor()
        if (c) {
          const v = a.tetoPerseguidor() * Math.min(1, cfg.velocidade / Math.max(1, a.velocidadeCoracao))
          const d = Math.hypot(c.x - cur.x, c.y - cur.y)
          const passo = Math.min(d, (v * dt) / 1000)
          if (d > 0.5) {
            cur.x += ((c.x - cur.x) / d) * passo
            cur.y += ((c.y - cur.y) / d) * passo
          }
        }
        cur.x = Math.min(lc.right - 4, Math.max(lc.left + 4, cur.x))
        cur.y = Math.min(lc.bottom - 4, Math.max(lc.top + 4, cur.y))
        desenhar(g, cur.x, cur.y, 0, false)
        ate -= dt * Math.sqrt(a.ritmo.densidade)
        if (ate <= 0) {
          ate = cfg.clique
          cur.clicando = aviso
          // a posição do clique fica arredondada (os dois PCs veem o mesmo ponto mesmo com o coração atrasado)
          const px = Math.round(cur.x / 4) * 4
          const py = Math.round(cur.y / 4) * 4
          cur.x = px
          cur.y = py
          tocar(a.cena, 'aviso')
          a.zonaPerigo({ tipo: 'circulo', x: px, y: py, raio: cfg.raio }, { ms: aviso, dura: cfg.impacto })
          a.depois(aviso, () => {
            tocar(a.cena, 'estalo')
            a.bala({ x: px, y: py, raio: cfg.raio, forma: 'bola', cor: 0xff4fc8, vida: cfg.impacto, atravessa: true, jaAvisada: true, pulso: 0.05 })
            const giro = (px + py) % 6.28
            for (let p = 0; p < cfg.pixels; p++) {
              const ang = giro + (p / cfg.pixels) * Math.PI * 2
              a.bala({ x: px, y: py, vx: Math.cos(ang) * cfg.velocidadePixel, vy: Math.sin(ang) * cfg.velocidadePixel, raio: 4.5, forma: 'hex', jaAvisada: true })
            }
          })
        }
      })
    }
  },
})
