import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'
import { particulas } from '../effects/particulas.js'

// CHUVA DE ENTULHO do Coronel Caçamba (CO-OP 2.0). O contrário de uma chuva de balas: o chão MOSTRA onde vai cair.
// Uma sombra escura aparece no chão e CRESCE até o tamanho do estrago (`aviso` ms); no fim ela vira o pedregulho
// que bate, machuca só ali e some. Cada sombra é uma coisa que dá para ler de longe e sair de baixo; nunca
// há mais que `maximo` ao mesmo tempo e elas não se sobrepõem.
//
// Justiça: a sombra cheia É a área do estrago (raio igual ao do impacto); cresce por `aviso` ms (mín. 700); as sombras
// de agora ficam a pelo menos 2 raios umas das outras; o estrago dura `impacto` ms e some.
//
//   intervalo   ms entre uma sombra e a próxima
//   aviso       ms que a sombra leva para crescer
//   raio        raio do estrago (px)
//   mirar       fração das sombras que nascem EM CIMA de um coração (parado não fica seguro)
//   maximo      sombras ao mesmo tempo
//   impacto     ms do pedregulho valendo
export default definirAtaque({
  nome: 'coronelEntulho',
  padrao: { duracao: 6000, intervalo: 800, aviso: 1000, raio: 24, mirar: 0.5, maximo: 3, impacto: 380 },
  iniciar(a, cfg) {
    const aviso = Math.max(700, cfg.aviso)
    const ativas = []
    let mira = a.aleatorio(0, 1) // acumulador: `mirar` vira a fração de sombras miradas (fase sorteada)

    const lugar = () => {
      const l = a.caixa
      const m = cfg.raio + 4
      mira += Number(cfg.mirar) || 0
      const miradas = mira >= 1
      if (miradas) mira -= 1
      const alvo = miradas ? a.alvo() : null
      // (isolado: as tentativas dependem de onde os corações estão; ver attacks/contexto.js)
      return a.isolado(() => {
        let melhor = null
        for (let tentativa = 0; tentativa < 10; tentativa++) {
          const x = alvo ? alvo.x + a.aleatorio(-10, 10) : a.aleatorio(l.left + m, l.right - m)
          const y = alvo ? alvo.y + a.aleatorio(-10, 10) : a.aleatorio(l.top + m, l.bottom - m)
          const p = { x: Math.min(Math.max(x, l.left + m), l.right - m), y: Math.min(Math.max(y, l.top + m), l.bottom - m) }
          const folga = Math.min(Infinity, ...ativas.map((o) => Math.hypot(o.x - p.x, o.y - p.y)))
          if (folga >= cfg.raio * 2) return p
          if (!melhor || folga > melhor.folga) melhor = { ...p, folga }
        }
        return melhor
      })
    }

    a.aCada(cfg.intervalo, () => {
      if (ativas.length >= cfg.maximo) return
      const p = lugar()
      if (!p || ativas.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < cfg.raio * 1.2)) return
      const sombra = { x: p.x, y: p.y }
      ativas.push(sombra)
      const g = a.decoracao(a.cena.add.graphics().setDepth(4))
      let t = 0
      a.aoAtualizar((dt) => {
        if (!g.scene || t >= aviso) return
        t += dt
        const f = Math.min(1, t / aviso)
        const r = 4 + (cfg.raio - 4) * f
        g.clear()
        g.fillStyle(0x000000, 0.25 + 0.3 * f).fillCircle(sombra.x, sombra.y, r)
        g.lineStyle(2, 0xff8a3c, 0.35 + 0.55 * f).strokeCircle(sombra.x, sombra.y, r)
        // o pedregulho "desce" no meio da sombra: sobe de tamanho no fim
        if (f > 0.55) g.fillStyle(0xd0a060, (f - 0.55) * 1.8).fillCircle(sombra.x, sombra.y - (1 - f) * 40, cfg.raio * 0.35)
      })
      a.zonaPerigo({ tipo: 'circulo', x: p.x, y: p.y, raio: cfg.raio }, { ms: aviso, dura: cfg.impacto })
      a.depois(aviso, () => {
        g.clear()
        tocar(a.cena, 'explosao')
        particulas(a.cena, p.x, p.y, { cor: 0xd0a060, quantidade: 12, velocidade: 120 })
        a.tremer(120, 0.01)
        a.bala({ x: p.x, y: p.y, raio: cfg.raio, forma: 'bola', cor: 0xb0875a, vida: cfg.impacto, atravessa: true, jaAvisada: true, pulso: 0.06 })
        a.depois(cfg.impacto + 60, () => {
          const i = ativas.indexOf(sombra)
          if (i >= 0) ativas.splice(i, 1)
        })
      })
    })
  },
})
