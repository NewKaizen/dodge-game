import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'

// CAVALGADA do Chaos King (dificuldade do CO-OP). Os cavalos saltam em L e caem ONDE O CORAÇÃO ESTAVA: o cavalo
// aparece numa casa a um L de distância (duas para um lado, uma para o outro), a casa de pouso acende com um
// alvo que fecha, e ele salta num arco. Na queda, o casco racha o chão: o impacto vale na casa e quatro lascas
// saem em L (as oito direções do cavalo, alternadas). Parado, você leva o salto; correndo, leva as lascas se
// correr na direção errada.
//
// Justiça: a casa de pouso acende `aviso` ms antes (mín. 600) e é o raio exato do impacto; as lascas nascem no
// fim do impacto e andam a `velocidadeLasca`; com `simultaneos` > 1 os pousos ficam a pelo menos 3 raios.
//
//   intervalo        ms entre um salto e o próximo (alterna os corações)
//   raio             raio do impacto
//   lascas           0 | 4 | 8 lascas por pouso (as direções do L)
//   velocidadeLasca  px/s das lascas
export default definirAtaque({
  nome: 'kingCavalgada',
  padrao: { duracao: 6500, intervalo: 1100, aviso: 850, raio: 24, lascas: 4, velocidadeLasca: 150, impacto: 220 },
  iniciar(a, cfg) {
    const aviso = Math.max(600, cfg.aviso)
    const temIcone = Boolean(a.cena.textures?.exists?.('king-p-cavalo'))
    // as 8 direções do L (normalizadas)
    const L = [
      [2, 1], [1, 2], [-1, 2], [-2, 1], [-2, -1], [-1, -2], [1, -2], [2, -1],
    ].map(([x, y]) => {
      const d = Math.hypot(x, y)
      return [x / d, y / d]
    })
    let alterna = 0
    const pousos = []

    a.aCadaEvento(
      cfg.intervalo,
      () => {
        const l = a.caixa
        const alvo = a.alvo()
        const m = cfg.raio + 2
        let px = Math.min(l.right - m, Math.max(l.left + m, alvo.x))
        let py = Math.min(l.bottom - m, Math.max(l.top + m, alvo.y))
        // dois pousos muito perto: o segundo anda para longe do primeiro
        for (const o of pousos) {
          const d = Math.hypot(px - o.x, py - o.y)
          if (d < cfg.raio * 3) {
            const ux = d > 0 ? (px - o.x) / d : 1
            const uy = d > 0 ? (py - o.y) / d : 0
            px = Math.min(l.right - m, Math.max(l.left + m, o.x + ux * cfg.raio * 3))
            py = Math.min(l.bottom - m, Math.max(l.top + m, o.y + uy * cfg.raio * 3))
          }
        }
        const pouso = { x: px, y: py }
        pousos.push(pouso)
        // de onde ele salta: um L antes do pouso (fora da caixa, se cair fora)
        const [dx, dy] = a.escolher(L)
        const passo = cfg.raio * 3.2
        const ox = px - dx * passo
        const oy = py - dy * passo
        const g = a.decoracao(a.cena.add.graphics().setDepth(4))
        const cavalo = temIcone ? a.decoracao(a.cena.add.image(ox, oy, 'king-p-cavalo').setDepth(7).setAlpha(0.9)) : null
        if (cavalo) cavalo.setDisplaySize(cfg.raio * 1.5 * (cavalo.width / cavalo.height), cfg.raio * 1.5)
        let t = 0
        a.aoAtualizar((dt) => {
          if (!g.scene || t > aviso) return
          t += dt
          const f = Math.min(1, t / aviso)
          g.clear()
          if (t > aviso) return
          // o alvo que fecha na casa de pouso + o arco do salto
          g.fillStyle(0xff5a6a, 0.15 + 0.2 * f).fillCircle(px, py, cfg.raio)
          g.lineStyle(2, 0xff5a6a, 0.9).strokeCircle(px, py, cfg.raio + (1 - f) * 18)
          g.lineBetween(px - 6, py, px + 6, py).lineBetween(px, py - 6, px, py + 6)
          if (cavalo?.scene) {
            // sobe e desce num arco do ponto de saída ao pouso
            const s = Math.max(0, (f - 0.35) / 0.65)
            cavalo.setPosition(ox + (px - ox) * s, oy + (py - oy) * s - Math.sin(s * Math.PI) * 34)
          }
        })
        a.zonaPerigo({ tipo: 'circulo', x: px, y: py, raio: cfg.raio }, { ms: aviso, dura: cfg.impacto })
        a.depois(aviso, () => {
          cavalo?.destroy()
          pousos.splice(pousos.indexOf(pouso), 1)
          tocar(a.cena, 'impacto')
          a.tremer(110, 0.008)
          a.bala({ x: px, y: py, raio: cfg.raio, forma: 'bola', cor: 0xb48cff, vida: cfg.impacto, atravessa: true, jaAvisada: true, pulso: 0.05 })
          if (!cfg.lascas) return
          const dirs = cfg.lascas >= 8 ? L : L.filter((_, k) => k % 2 === alterna % 2)
          alterna++
          a.depois(cfg.impacto * 0.6, () => {
            for (const [ux, uy] of dirs) {
              a.bala({ x: px, y: py, vx: ux * cfg.velocidadeLasca, vy: uy * cfg.velocidadeLasca, raio: 5, forma: 'losango', jaAvisada: true, girar: 6 })
            }
          })
        })
      },
      Infinity,
      300,
    )
  },
})
