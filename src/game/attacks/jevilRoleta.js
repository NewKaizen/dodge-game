import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'

// ROLETA do Jevil (dificuldade do CO-OP). Uma roleta gigante gira no quadro: as LÂMINAS (raios de carta, de
// ponta a ponta) giram em volta do miolo, que passeia devagar de um lado para o outro. A cada `bola` ms a
// bolinha para numa casa: a fatia acende (o aviso) e do miolo sai um leque de naipes pela fatia, até as
// bordas. Longe das lâminas é seguro... até a fatia da bolinha apontar para lá.
//
// Justiça: as lâminas nascem piscando (`aviso` ms) e a ponta delas anda no máximo a velocidade de fuga; a fatia
// acende `avisoFatia` ms antes do leque; o miolo anda devagar (bem menos que o coração).
//
//   laminas     1 = um bastão (2 raios), 2 = uma cruz (4 raios)
//   giro        rad/s pedidos (limitados pela fuga na ponta) · inverte: troca o sentido a cada bola
//   bola        ms entre uma parada da bolinha e a próxima
//   leque       naipes por leque · velocidadeLeque px/s · aberturaLeque rad
//   passeio     px/s do miolo
export default definirAtaque({
  nome: 'jevilRoleta',
  padrao: { duracao: 7000, laminas: 1, giro: 1.6, inverte: true, aviso: 600, bola: 1500, avisoFatia: 550, leque: 4, velocidadeLeque: 170, aberturaLeque: 0.5, passeio: 26, espessura: 7 },
  iniciar(a, cfg) {
    const l0 = a.caixa
    const raio = Math.min(l0.height * 0.4, 72) // (os cantos e as pontas da caixa ficam fora do alcance das lâminas)
    // a ponta não passa da velocidade de fuga
    const giroMax = a.tetoPerseguidor() / raio
    let w = Math.min(cfg.giro, giroMax / (a.balas.fatorVelocidade || 1)) * (a.aleatorio(0, 1) < 0.5 ? 1 : -1)
    let cx = l0.centerX
    let dir = a.aleatorio(0, 1) < 0.5 ? 1 : -1
    let ang = a.aleatorio(0, Math.PI)
    const laminas = []
    const NAIPES = ['espadas', 'copas', 'ouros', 'paus']
    for (let k = 0; k < Math.max(1, cfg.laminas); k++) {
      laminas.push(a.bala({ x: cx, y: l0.centerY, comprimento: raio * 2, espessura: cfg.espessura, angulo: ang + (k * Math.PI) / Math.max(1, cfg.laminas), forma: 'foice', cor: 0xe8e0ff, aviso: Math.max(400, cfg.aviso), atravessa: true, pulso: 0 }))
    }
    const g = a.decoracao(a.cena.add.graphics().setDepth(3))
    let fatia = null // { ang, t }
    a.aoAtualizar((dt) => {
      const l = a.caixa
      const f = a.balas.fatorVelocidade || 1
      const s = (dt / 1000) * f
      // o miolo passeia (quica nas bordas, deixando o raio dentro da caixa no eixo x)
      cx += dir * cfg.passeio * s
      if (cx > l.right - raio * 0.6) dir = -1
      if (cx < l.left + raio * 0.6) dir = 1
      if (laminas[0].idade >= laminas[0].aviso) ang += w * s
      laminas.forEach((b, k) => {
        b.x = cx
        b.y = l.centerY
        b.angulo = ang + (k * Math.PI) / laminas.length
      })
      if (!g.scene) return
      g.clear()
      // o prato da roleta
      g.lineStyle(2, 0xffd24c, 0.35).strokeCircle(cx, l.centerY, raio)
      g.fillStyle(0xffd24c, 0.9).fillCircle(cx, l.centerY, 6)
      if (fatia) {
        fatia.t += dt
        const p = Math.min(1, fatia.t / cfg.avisoFatia)
        g.fillStyle(0xff5f8a, 0.12 + 0.25 * p)
        g.slice(cx, l.centerY, 400, fatia.ang - cfg.aberturaLeque, fatia.ang + cfg.aberturaLeque, false)
        g.fillPath()
        g.fillStyle(0xffffff, 1).fillCircle(cx + Math.cos(fatia.ang) * raio, l.centerY + Math.sin(fatia.ang) * raio, 4)
      }
    })
    a.aCadaEvento(
      cfg.bola,
      () => {
        const alvoAng = a.aleatorio(0, Math.PI * 2)
        fatia = { ang: alvoAng, t: 0 }
        tocar(a.cena, 'cartaVirar')
        a.zonaPerigo({ tipo: 'leque', x: cx, y: a.caixa.centerY, raio: 400, angulo: alvoAng, abertura: cfg.aberturaLeque * 2 }, { ms: cfg.avisoFatia, dura: 900 })
        a.depois(cfg.avisoFatia, () => {
          const y0 = a.caixa.centerY
          tocar(a.cena, 'estalo')
          for (let k = 0; k < cfg.leque; k++) {
            const t = cfg.leque > 1 ? k / (cfg.leque - 1) - 0.5 : 0
            const an = alvoAng + t * cfg.aberturaLeque * 1.6
            const forma = NAIPES[k % 4]
            a.bala({ x: cx + Math.cos(an) * 8, y: y0 + Math.sin(an) * 8, vx: Math.cos(an) * cfg.velocidadeLeque, vy: Math.sin(an) * cfg.velocidadeLeque, raio: 7, forma, jaAvisada: true, girar: 5 })
          }
          fatia = null
          if (cfg.inverte) w = -w
        })
      },
      Infinity,
      700,
    )
  },
})
