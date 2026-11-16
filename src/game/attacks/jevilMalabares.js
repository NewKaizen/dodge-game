import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'

// MALABARES do Jevil (dificuldade do CO-OP). Ele faz malabarismo com BOMBAS: cada bomba sobe de um canto de
// baixo num arco alto e cai no chão do quadro, perto de um coração. A sombra do pouso cresce no chão enquanto
// ela voa (o aviso); no pouso a bomba explode (o círculo vale) e solta naipes em estrela. Com `juntas` > 1 ele
// joga duas ou três de uma vez, cada uma num lugar.
//
// Justiça: a bomba no ar é só desenho (não machuca); a sombra cresce até o raio exato da explosão por todo o voo
// (`voo` ms, mín. 700); os pousos de um mesmo arremesso ficam a pelo menos 3 raios; os naipes saem do centro.
//
//   intervalo   ms entre arremessos · juntas  bombas por arremesso
//   voo         ms no ar · raio  raio da explosão
//   naipes      naipes por explosão · velocidadeNaipe px/s
const NAIPES = ['espadas', 'copas', 'ouros', 'paus']

export default definirAtaque({
  nome: 'jevilMalabares',
  padrao: { duracao: 6500, intervalo: 1200, juntas: 1, voo: 1000, raio: 26, naipes: 6, velocidadeNaipe: 140, impacto: 220, mirar: 0.6 },
  iniciar(a, cfg) {
    const voo = Math.max(700, cfg.voo)
    let mira = a.aleatorio(0, 1)
    a.aCadaEvento(
      cfg.intervalo,
      (i) => {
        const l = a.caixa
        const pousos = []
        for (let k = 0; k < cfg.juntas; k++) {
          mira += cfg.mirar
          const mirada = mira >= 1
          if (mirada) mira -= 1
          const alvo = mirada ? a.alvo() : null
          const m = cfg.raio + 2
          let px = alvo ? alvo.x : a.aleatorio(l.left + m, l.right - m)
          let py = alvo ? alvo.y : a.aleatorio(l.top + m, l.bottom - m)
          px = Math.min(l.right - m, Math.max(l.left + m, px))
          py = Math.min(l.bottom - m, Math.max(l.top + m, py))
          for (const o of pousos) {
            if (Math.hypot(px - o.x, py - o.y) < cfg.raio * 3) {
              px = o.x < l.centerX ? Math.min(l.right - m, o.x + cfg.raio * 3) : Math.max(l.left + m, o.x - cfg.raio * 3)
            }
          }
          pousos.push({ x: px, y: py })
          const lado = (i + k) % 2 ? 1 : -1
          const ox = lado > 0 ? l.right + 10 : l.left - 10
          const oy = l.bottom
          const g = a.decoracao(a.cena.add.graphics().setDepth(4))
          const bomba = a.decoracao(a.cena.add.graphics().setDepth(7))
          let t = 0
          a.aoAtualizar((dt) => {
            if (!g.scene || t > voo) return
            t += dt
            g.clear()
            bomba.clear()
            if (t > voo) return
            const f = Math.min(1, t / voo)
            const r = 5 + (cfg.raio - 5) * f
            g.fillStyle(0x000000, 0.2 + 0.3 * f).fillCircle(px, py, r)
            g.lineStyle(2, 0xff5f8a, 0.4 + 0.5 * f).strokeCircle(px, py, r)
            // o arco da bomba (sobe bem acima do pouso e desce nele)
            const bx = ox + (px - ox) * f
            const by = oy + (py - oy) * f - Math.sin(f * Math.PI) * 120
            bomba.fillStyle(0x2a2238, 1).fillCircle(bx, by, 8)
            bomba.lineStyle(2, 0xffd24c, 1).strokeCircle(bx, by, 8)
            bomba.fillStyle(t % 200 < 100 ? 0xff5f2a : 0xffd24c, 1).fillCircle(bx + 5, by - 7, 3)
          })
          a.zonaPerigo({ tipo: 'circulo', x: px, y: py, raio: cfg.raio }, { ms: voo, dura: cfg.impacto })
          a.depois(voo, () => {
            tocar(a.cena, 'explosao')
            a.tremer(120, 0.01)
            a.bala({ x: px, y: py, raio: cfg.raio, forma: 'bola', cor: 0xff5f8a, vida: cfg.impacto, atravessa: true, jaAvisada: true, pulso: 0.06 })
            const giro = ((i * 7 + k * 3) % 8) * 0.39
            a.depois(cfg.impacto * 0.6, () => {
              for (let n = 0; n < cfg.naipes; n++) {
                const ang = giro + (n / cfg.naipes) * Math.PI * 2
                a.bala({ x: px, y: py, vx: Math.cos(ang) * cfg.velocidadeNaipe, vy: Math.sin(ang) * cfg.velocidadeNaipe, raio: 6, forma: NAIPES[n % 4], jaAvisada: true, girar: 4 })
              }
            })
          })
        }
        tocar(a.cena, 'voo')
      },
      Infinity,
      200,
    )
  },
})
