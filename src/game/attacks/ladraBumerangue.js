import { definirAtaque } from './definir.js'
import { tocar } from '../audio.js'

// CARTAS BUMERANGUE da Ladra (boss semanal). Ela arremessa cartas de fora da caixa, uma de cada vez, na
// direção de um coração: antes de cada carta a trilha pontilhada aparece da borda até onde ela vai parar. A
// carta entra girando, freia, para lá no fundo da trilha e VOLTA pelo mesmo caminho até a mão dela. Quem saiu
// da trilha na ida tem de continuar fora na volta.
//
// Justiça: a trilha acende `aviso` ms (mín. 500) antes da carta (zona `linha` para a CPU, valendo a ida e a
// volta); a carta entra pela borda (nasce fora) e nunca passa de `alcance` da caixa; uma trilha tem a largura
// de uma carta, o resto da caixa fica livre.
//
//   intervalo   ms entre uma carta e a próxima (alterna os corações) · rajada  cartas por arremesso (em leque)
//   velocidade  px/s da carta na entrada · alcance  fração da caixa até onde ela vai (0..1)
//   lados       bordas de onde ela joga
export default definirAtaque({
  nome: 'ladraBumerangue',
  padrao: { duracao: 6500, intervalo: 1100, aviso: 600, rajada: 1, leque: 0.32, velocidade: 300, alcance: 0.85, raio: 8, lados: ['left', 'right', 'top'] },
  iniciar(a, cfg) {
    const aviso = Math.max(500, cfg.aviso)
    const NAIPES = ['espadas', 'ouros', 'paus', 'copas']
    let n = 0

    const carta = (x0, y0, ang, distancia) => {
      const ux = Math.cos(ang)
      const uy = Math.sin(ang)
      const forma = NAIPES[n++ % 4]
      // a ida: freia até parar em `distancia` (v² = 2 a d); a volta: acelera pelo mesmo caminho
      // (o ritmo multiplica só a velocidade: a distância de parada é fator x v² / 2a)
      const v0 = cfg.velocidade
      const desac = ((a.balas.fatorVelocidade || 1) * v0 * v0) / (2 * distancia)
      const ida = (v0 / desac) * 1000
      a.zonaPerigo({ tipo: 'linha', x1: x0, y1: y0, x2: x0 + ux * distancia, y2: y0 + uy * distancia, espessura: cfg.raio * 2 + 6 }, { ms: aviso, dura: ida * 2 + 200 })
      const g = a.decoracao(a.cena.add.graphics().setDepth(4))
      let t = 0
      a.aoAtualizar((dt) => {
        if (!g.scene) return
        t += dt
        g.clear()
        if (t > aviso + ida * 2) return
        const p = Math.min(1, t / aviso)
        // a trilha pontilhada (some na volta, fica só o contorno fraco)
        const forte = t < aviso ? 0.4 + 0.5 * p : 0.25
        for (let d = 10; d < distancia; d += 11) g.fillStyle(0xffb060, forte).fillCircle(x0 + ux * d, y0 + uy * d, t < aviso ? 1.8 : 1.2)
        g.lineStyle(2, 0xffb060, forte).strokeCircle(x0 + ux * distancia, y0 + uy * distancia, 6)
      })
      a.depois(aviso, () => {
        tocar(a.cena, 'cartaArremessar')
        a.bala({
          x: x0 - ux * 10,
          y: y0 - uy * 10,
          vx: ux * v0,
          vy: uy * v0,
          ax: -ux * desac,
          ay: -uy * desac,
          raio: cfg.raio,
          forma,
          girar: 9,
          entrando: true,
          pulso: 0,
        })
      })
    }

    let alterna = 0
    a.aCadaEvento(
      cfg.intervalo,
      () => {
        const l = a.caixa
        const lado = cfg.lados[(alterna++ + a.inteiro(0, cfg.lados.length - 1)) % cfg.lados.length]
        const alvo = a.alvo()
        const vertical = lado === 'top' || lado === 'bottom'
        // ela joga da borda, na altura (ou na coluna) perto do coração, e mira nele
        const fr = vertical ? (alvo.x - l.left) / l.width : (alvo.y - l.top) / l.height
        const o = a.deFora(lado, Math.min(0.9, Math.max(0.1, fr + a.aleatorio(-0.25, 0.25))), 4)
        const base = Math.atan2(alvo.y - o.y, alvo.x - o.x)
        for (let k = 0; k < cfg.rajada; k++) {
          const t = cfg.rajada > 1 ? k / (cfg.rajada - 1) - 0.5 : 0
          const ang = base + t * cfg.leque * 2
          // até onde ela vai: `alcance` do caminho até a borda do outro lado
          const ux = Math.cos(ang)
          const uy = Math.sin(ang)
          const tx = ux > 1e-3 ? (l.right - o.x) / ux : ux < -1e-3 ? (l.left - o.x) / ux : Infinity
          const ty = uy > 1e-3 ? (l.bottom - o.y) / uy : uy < -1e-3 ? (l.top - o.y) / uy : Infinity
          const distancia = Math.max(60, Math.min(tx, ty) * cfg.alcance)
          carta(o.x, o.y, ang, distancia)
        }
      },
      Infinity,
      200,
    )
  },
})
