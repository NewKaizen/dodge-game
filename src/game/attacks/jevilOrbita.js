import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'

// CARROSSEL DE OUROS do Jevil (dificuldade do CO-OP). Um anel de losangos (ouros) aparece EM VOLTA de um
// coração, girando, e FECHA devagar sobre o ponto onde ele estava. Dá para sair por entre os losangos enquanto o
// anel ainda está largo, ou pela BRECHA (umas casas sem losango). Quando chega no centro, o anel se desfaz e
// os losangos saem voando para fora, girando. Os anéis alternam os corações; com `aneis: 2` o segundo gira ao
// contrário, mais largo.
//
// Justiça: o anel nasce largo (`raio` px, longe do coração) e piscando por `aviso` ms (mín. 500) antes de valer;
// tem uma brecha de `brecha` losangos (mais que LACUNA_MINIMA); fecha em `fecha` ms (o coração atravessa o
// raio inteiro em bem menos tempo).
//
//   intervalo  ms entre um anel e o próximo · pontos losangos no anel · brecha losangos que faltam
//   raio       raio inicial · fecha  ms para fechar · giro rad/s · solta px/s dos losangos no fim
export default definirAtaque({
  nome: 'jevilOrbita',
  padrao: { duracao: 6500, intervalo: 1700, pontos: 14, brecha: 3, raio: 88, fecha: 1700, giro: 1.4, aviso: 600, solta: 120, aneis: 1 },
  iniciar(a, cfg) {
    const aviso = Math.max(500, cfg.aviso)
    const anel = (cx, cy, raio, sentido) => {
      const comeco = a.aleatorio(0, Math.PI * 2)
      const passo = (Math.PI * 2) / cfg.pontos
      const contas = []
      for (let k = cfg.brecha; k < cfg.pontos; k++) {
        const ang = comeco + k * passo
        contas.push({ ang, b: a.bala({ x: cx + Math.cos(ang) * raio, y: cy + Math.sin(ang) * raio, raio: 6, forma: 'ouros', cor: 0xffd24c, aviso, girar: 3, pulso: 0.05 }) })
      }
      let t = 0
      let solto = false
      a.aoAtualizar((dt) => {
        if (solto) return
        const f = a.balas.fatorVelocidade || 1
        const vivo = contas.find((c) => !c.b.morta)
        if (!vivo) return
        if (vivo.b.idade < vivo.b.aviso) return
        t += dt * f
        const p = Math.min(1, t / cfg.fecha)
        const r = raio * (1 - p) + 4 * p
        for (const c of contas) {
          c.ang += sentido * cfg.giro * (dt / 1000) * f
          c.b.x = cx + Math.cos(c.ang) * r
          c.b.y = cy + Math.sin(c.ang) * r
        }
        if (p >= 1) {
          solto = true
          tocar(a.cena, 'estouro')
          for (const c of contas) {
            c.b.vx = Math.cos(c.ang) * cfg.solta
            c.b.vy = Math.sin(c.ang) * cfg.solta
          }
        }
      })
    }
    a.aCadaEvento(
      cfg.intervalo,
      () => {
        const l = a.caixa
        const alvo = a.alvo()
        const cx = Math.round(Math.min(l.right - 20, Math.max(l.left + 20, alvo.x)))
        const cy = Math.round(Math.min(l.bottom - 20, Math.max(l.top + 20, alvo.y)))
        tocar(a.cena, 'cartaVirar')
        anel(cx, cy, cfg.raio, 1)
        if (cfg.aneis >= 2) anel(cx, cy, cfg.raio * 1.45, -1)
      },
      Infinity,
      250,
    )
  },
})
