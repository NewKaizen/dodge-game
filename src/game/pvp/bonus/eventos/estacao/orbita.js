import { tocar } from '../../../../audio.js'
import { fatores } from '../../../../acessibilidade.js'
import { ORBITA, aceleracaoOrbital, puxaoDoCoracao, engolida } from './planos.js'
import { criarCofre, avisoDoEvento, ehEspelho } from './util.js'

// ÓRBITA (ESTAÇÃO ESPACIAL): um planetinha no meio de cada caixa tem gravidade. As BALAS curvam em volta dele
// (e somem se caírem nele), o CORAÇÃO é puxado (um empurrão no joystick sempre menor que a velocidade dele: dá
// para sair) e encostar no planeta machuca (ele é uma bala redonda parada, com graze e tudo; a CPU enxerga).
// O planeta nasce com aviso (cresce e pisca por ORBITA.avisoMs) e a gravidade vai subindo até o máximo em
// ORBITA.subidaMs. Anéis de campo se fecham em direção a ele para mostrar o puxão.
// As contas de gravidade estão em planos.js. terminar() apaga o planeta (a bala some no fim do ataque).

const COR_ANEL = 0xb99cff

export default function criar(arena) {
  const cofre = criarCofre(arena)
  let ativo = false
  let t = 0
  let ultimoDelta = 16
  // por pista: { pista, g, bala }
  let lados = []

  const forca = () => Math.min(1, Math.max(0, t / ORBITA.subidaMs))

  const centro = (s) => {
    const l = s.pista.caixa.limites
    return { x: l.centerX, y: l.centerY }
  }

  const desenhar = (s) => {
    const { x, y } = centro(s)
    const g = s.g
    g.clear()
    const R = ORBITA.raio
    const nascendo = Math.min(1, t / ORBITA.avisoMs)
    const e = 0.35 + 0.65 * (1 - (1 - nascendo) ** 2) // o planeta cresce enquanto avisa
    // anéis do campo se fechando
    const campo = fatores().fundo === 'parado' ? 1 : 0
    for (let k = 0; k < 3; k++) {
      const fase = campo ? k / 3 : (t / 1900 + k / 3) % 1
      const r = ORBITA.alcancePuxa * (1 - fase)
      g.lineStyle(1, COR_ANEL, 0.28 * Math.sin(Math.PI * fase) * forca())
      g.strokeCircle(x, y, Math.max(R, r))
    }
    // aviso: anel vermelho piscando até a hora de valer
    if (t < ORBITA.avisoMs) {
      const pisca = Math.sin(t / 55) > 0
      g.lineStyle(2, 0xff5a4a, pisca ? 0.95 : 0.4)
      g.strokeCircle(x, y, R + 6 + (1 - nascendo) * 10)
    }
    // anel de trás (fica atrás do planeta)
    const inclinacao = -0.35
    const anel = (frente) => {
      g.lineStyle(2.5, 0xffd9a0, frente ? 0.9 : 0.5)
      const pontos = []
      for (let k = 0; k <= 20; k++) {
        const a = (frente ? 0 : Math.PI) + (k / 20) * Math.PI
        const px = Math.cos(a) * R * 1.9 * e
        const py = Math.sin(a) * R * 0.5 * e
        pontos.push({ x: x + px * Math.cos(inclinacao) - py * Math.sin(inclinacao), y: y + px * Math.sin(inclinacao) + py * Math.cos(inclinacao) })
      }
      g.strokePoints(pontos)
    }
    anel(false)
    // corpo: sombra, base e brilho (esfera)
    g.fillStyle(0x1b2a66, 1).fillCircle(x, y, R * e)
    g.fillStyle(0x3b62d8, 1).fillCircle(x - R * 0.12 * e, y - R * 0.12 * e, R * 0.86 * e)
    g.fillStyle(0x6f9dff, 0.9).fillCircle(x - R * 0.32 * e, y - R * 0.32 * e, R * 0.52 * e)
    g.lineStyle(1.5, 0x15204f, 0.7)
    for (const f of [-0.35, 0.1, 0.5]) g.lineBetween(x - Math.sqrt(Math.max(0, 1 - f * f)) * R * 0.95 * e, y + f * R * e, x + Math.sqrt(Math.max(0, 1 - f * f)) * R * 0.95 * e, y + f * R * e)
    g.fillStyle(0xeaf2ff, 0.55).fillCircle(x - R * 0.42 * e, y - R * 0.42 * e, R * 0.16 * e)
    anel(true)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      lados = arena.pistas.map((pista) => {
        const g = cofre.guardar(arena.add.graphics().setDepth(4.5))
        pista.caixa.recortar(g)
        const l = pista.caixa.limites
        // o planeta de verdade: bala redonda parada, invisível (quem desenha é o Graphics), que atravessa o coração
        const bala = pista.balas.criar({ x: l.centerX, y: l.centerY, raio: ORBITA.raio * 0.92, aviso: ORBITA.avisoMs, atravessa: true, dano: ORBITA.dano, pulso: 0, origem: 'bonus-orbita' })
        bala.sprite.setVisible(false)
        bala.marcaPlaneta = true
        return { pista, g, bala }
      })
      tocar(arena, 'gravidade')
      avisoDoEvento(arena, cofre, 'A GRAVIDADE PUXA TUDO!', { cor: '#c8b0ff' })
    },

    // o puxão do planeta no coração (a CPU também é puxada)
    joy(j, joy) {
      const s = lados[j]
      if (!ativo || !s || ehEspelho(arena, j) || arena.ko?.[arena.donoDaPista?.(j) ?? j]) return joy
      const c = s.pista.coracoes[0]
      if (!c?.ativo) return joy
      const { x, y } = centro(s)
      const p = puxaoDoCoracao(c.x, c.y, x, y, forca())
      return { x: Math.max(-100, Math.min(100, joy.x + p.x)), y: Math.max(-100, Math.min(100, joy.y + p.y)) }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      ultimoDelta = delta
      const f = forca()
      for (const s of lados) {
        const { x, y } = centro(s)
        s.bala.x = x
        s.bala.y = y
        s.bala.sprite.setPosition(x, y)
        const teto = Math.max(380, (s.pista.balas.velocidadeMax || 0) * 1.2)
        for (const b of s.pista.balas.lista) {
          if (b.marcaPlaneta || b.morta || b.segurada || b.idade < b.aviso) continue
          const a = aceleracaoOrbital(b.x, b.y, x, y, f)
          if (a.ax || a.ay) {
            b.vx += (a.ax * ultimoDelta) / 1000
            b.vy += (a.ay * ultimoDelta) / 1000
            const v = Math.hypot(b.vx, b.vy)
            if (v > teto) {
              b.vx *= teto / v
              b.vy *= teto / v
            }
          }
          if (engolida(b.x, b.y, b.raio ?? 6, x, y)) {
            b.morta = true
            if (fatores().particulas > 0.3) {
              const brilho = cofre.guardar(arena.add.circle(b.x, b.y, 3, 0xffffff, 0.8).setDepth(6))
              s.pista.caixa.recortar(brilho)
              arena.tweens.add({ targets: brilho, scale: 3, alpha: 0, duration: 220, onComplete: () => brilho.destroy() })
            }
          }
        }
        desenhar(s)
      }
    },

    estadoDebug() {
      return { forca: Number(forca().toFixed(2)), planetas: lados.map((s) => ({ x: Math.round(s.bala.x), y: Math.round(s.bala.y) })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const s of lados) s.bala.morta = true
      cofre.limpar()
      lados = []
    },
  }
}
