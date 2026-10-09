import { FONTE } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { texturasJardim } from '../../../arte/jardim.js'

// ENXAME (arena JARDIM): cada caixa ganha uma colmeia no canto e um enxame de
// abelhas que passeia pela caixa, longe do coração e inofensivo. Mas se o
// coração ficar PARADO (quase no mesmo lugar) por um tempo, as abelhas
// percebem: primeiro um "?" (curiosas: é a hora de se mexer), depois "!" com
// zumbido (o aviso) e então o enxame PERSEGUE o coração, mais devagar que
// ele. Andar um bom pedaço DESPISTA o enxame ("?" e ele volta a passear);
// encostar nele é uma picada: dano pequeno, com os i-frames de sempre (o
// enxame é uma bala invisível que só machuca enquanto ataca), e depois da
// picada as abelhas se dão por satisfeitas e vão embora.
// A CPU enxerga o enxame atacando como uma bala qualquer (e foge dele).

const RAIO = 12 // raio da área que pica (px)
const DANO = 3
const PARADO = { raio: 18, curiosaMs: 600, alertaMs: 1150 } // "parado" = não sair de um círculo de 18 px
const ALERTA_MS = 480 // "!" antes de atacar (>= telegrafo)
const ATAQUE = { velocidade: 118, maxMs: 2800, despista: 110 } // px/s; px andados para despistar
const CONFUSA_MS = 950
const RONDA = { velocidade: 55, longe: 70 } // passeio: longe do coração pelo menos isso
const NUM_ABELHAS = 6
const LARANJA = 0xff8a3a

export default function criar(arena, { rng }) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + sorte() * (b - a)
  let ativo = false
  let t = 0
  let ultimoBravo = 0
  let enxames = []

  const colmeia = (pista) => {
    const g = arena.add.graphics().setDepth(2)
    // galho, colmeia em gomos e o buraquinho
    g.fillStyle(0x6a4a2a, 1).fillRect(-16, -2, 24, 3)
    g.fillStyle(0x6a4a2a, 1).fillRect(-1, 0, 2, 4)
    const gomos = [[0, 6, 14, 6], [0, 11, 20, 7], [0, 17, 22, 7], [0, 23, 18, 7], [0, 28, 10, 5]]
    for (const [x, y, w, h] of gomos) {
      g.fillStyle(0xd89a2a, 1).fillEllipse(x, y, w, h)
      g.fillStyle(0xf0c04a, 1).fillEllipse(x - 1, y - 1, w - 4, h - 3)
    }
    g.fillStyle(0x2a1a0a, 1).fillCircle(1, 19, 2.5)
    pista.caixa.recortar(g)
    return g
  }

  const criarEnxame = (pista) => {
    const l = pista.caixa.limites
    const abelhas = Array.from({ length: NUM_ABELHAS }, () => {
      const img = arena.add.image(0, 0, 'jardim-abelha').setScale(1.6).setDepth(6)
      return { img, w: entre(5, 8), p: entre(0, 6.3), r: entre(6, 13) }
    })
    const aro = arena.add.graphics().setDepth(6)
    const icone = arena.add.text(0, 0, '', { fontFamily: FONTE, fontSize: '14px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5).setDepth(14)
    const casa = colmeia(pista)
    pista.caixa.recortar(aro, icone, ...abelhas.map((a) => a.img))
    const e = {
      pista, abelhas, aro, icone, casa, bala: null,
      x: l.right - 18, y: l.top + 22, vx: 0, vy: 0,
      estado: 'ronda', desde: 0, alvo: null, ancora: null, paradoMs: 0, andou: 0, ultimo: null, picou: false,
    }
    return e
  }

  const mudar = (e, estado) => {
    e.estado = estado
    e.desde = t
    if (estado === 'alerta') tocar(arena, 'zumbido')
    if (estado === 'ataque') {
      e.andou = 0
      e.picou = false
    }
    if (estado === 'ronda') {
      e.alvo = null
      e.paradoMs = 0
    }
  }

  // ponto de passeio longe do coração
  const novoAlvo = (e, l, c) => {
    let melhor = null
    for (let k = 0; k < 6; k++) {
      const p = { x: entre(l.left + 20, l.right - 20), y: entre(l.top + 20, l.bottom - 20) }
      p.d = c?.ativo ? Math.hypot(p.x - c.x, p.y - c.y) : 999
      if (!melhor || p.d > melhor.d) melhor = p
      if (p.d > RONDA.longe * 1.5) break
    }
    e.alvo = melhor
  }

  // o enxame é uma bala da pista (colisão, i-frames e a CPU enxergando), mas
  // invisível (o visual são as abelhas) e só machuca atacando
  const garantirBala = (e) => {
    const { pista } = e
    if (!pista.rodando) return null
    if (e.bala && pista.balas.lista.includes(e.bala)) return e.bala
    e.bala = pista.balas.criar({ x: e.x, y: e.y, raio: RAIO, textura: 'jardim-vazio', dano: DANO, atravessa: true, jaAvisada: true, pulso: 0, origem: 'bonus-abelhas' })
    return e.bala
  }

  const voar = (e, alvoX, alvoY, velocidade, delta) => {
    const dx = alvoX - e.x
    const dy = alvoY - e.y
    const d = Math.hypot(dx, dy) || 1
    const freia = Math.min(1, d / 30) // chega devagarinho
    const k = Math.min(1, delta / 260)
    e.vx += ((dx / d) * velocidade * freia - e.vx) * k
    e.vy += ((dy / d) * velocidade * freia - e.vy) * k
    e.x += (e.vx * delta) / 1000
    e.y += (e.vy * delta) / 1000
    return d
  }

  const atualizarEnxame = (e, j, delta) => {
    const { pista } = e
    const l = pista.caixa.limites
    const c = pista.coracoes[0]
    const vivo = c?.ativo && !arena.ko?.[arena.donoDaPista?.(j) ?? j]

    // quanto o coração andou neste frame / está parado?
    const andouAgora = vivo && e.ultimo ? Math.hypot(c.x - e.ultimo.x, c.y - e.ultimo.y) : 0
    e.ultimo = vivo ? { x: c.x, y: c.y } : null
    if (vivo) {
      if (!e.ancora || Math.hypot(c.x - e.ancora.x, c.y - e.ancora.y) > PARADO.raio) {
        e.ancora = { x: c.x, y: c.y }
        e.paradoMs = 0
      } else e.paradoMs += delta
    }

    if (e.estado === 'ronda') {
      if (!e.alvo || Math.hypot(e.alvo.x - e.x, e.alvo.y - e.y) < 10 || t - e.desde > 2400) {
        novoAlvo(e, l, c)
        e.desde = t
      }
      voar(e, e.alvo.x, e.alvo.y, RONDA.velocidade, delta)
      if (vivo && e.paradoMs >= PARADO.alertaMs && pista.atacando) mudar(e, 'alerta')
    } else if (e.estado === 'alerta') {
      // vira para o coração e chega um pouquinho mais perto, zumbindo
      if (vivo) voar(e, c.x, c.y, 30, delta)
      if (t - e.desde >= ALERTA_MS) mudar(e, vivo ? 'ataque' : 'confusa')
    } else if (e.estado === 'ataque') {
      if (vivo) voar(e, c.x, c.y, ATAQUE.velocidade, delta)
      e.andou += andouAgora
      if (t - ultimoBravo > 420) {
        ultimoBravo = t
        tocar(arena, 'zumbidoBravo')
      }
      // picou? (o coração ficou invencível com o enxame em cima)
      if (vivo && c.invencivel && Math.hypot(c.x - e.x, c.y - e.y) <= RAIO + c.hitbox + 3) e.picou = true
      if (!vivo || e.picou || e.andou >= ATAQUE.despista || t - e.desde > ATAQUE.maxMs) mudar(e, 'confusa')
    } else if (e.estado === 'confusa') {
      e.vx *= 0.9
      e.vy *= 0.9
      e.x += (e.vx * delta) / 1000 + Math.sin(t / 90) * 0.4
      e.y += (e.vy * delta) / 1000
      if (t - e.desde >= CONFUSA_MS) mudar(e, 'ronda')
    }
    e.x = Math.max(l.left + 6, Math.min(l.right - 6, e.x))
    e.y = Math.max(l.top + 6, Math.min(l.bottom - 6, e.y))

    const b = garantirBala(e)
    if (b) {
      b.x = e.x
      b.y = e.y
      b.vx = e.vx // a CPU prevê o enxame pela velocidade
      b.vy = e.vy
      b.inofensiva = e.estado !== 'ataque' || Boolean(pista.ataque?.desarmado)
      b.sprite.setPosition(e.x, e.y)
    }
    desenharEnxame(e, vivo && e.estado === 'ronda' && e.paradoMs >= PARADO.curiosaMs)
  }

  const desenharEnxame = (e, curiosa) => {
    const bravo = e.estado === 'ataque' || e.estado === 'alerta'
    const vel = bravo ? 1.8 : 1
    for (const a of e.abelhas) {
      const r = a.r * (bravo ? 0.75 : 1)
      const x = e.x + Math.cos((t / 1000) * a.w * vel + a.p) * r
      const y = e.y + Math.sin((t / 1000) * a.w * vel * 1.3 + a.p) * r * 0.7 + Math.sin(t / 45 + a.p) * 0.8
      a.img.setPosition(x, y).setFlipX(e.vx < -5).setTint(bravo ? 0xffb090 : 0xffffff)
    }
    e.aro.clear()
    if (e.estado === 'ataque') {
      e.aro.lineStyle(1.5, LARANJA, 0.8)
      for (let k = 0; k < 10; k++) {
        const a0 = (k / 10) * Math.PI * 2 + t / 300
        e.aro.beginPath()
        e.aro.arc(e.x, e.y, RAIO, a0, a0 + Math.PI / 10)
        e.aro.strokePath()
      }
    } else if (e.estado !== 'alerta') {
      e.aro.fillStyle(0xffe680, 0.08).fillCircle(e.x, e.y, RAIO + 3) // o enxame calmo: só um brilho fraquinho
    } else {
      e.aro.lineStyle(1.5, 0xffe040, Math.sin(t / 50) > 0 ? 0.9 : 0.3).strokeCircle(e.x, e.y, RAIO)
    }
    const icone = e.estado === 'alerta' ? '!' : e.estado === 'confusa' ? '?' : curiosa ? '?' : ''
    const cor = e.estado === 'alerta' ? '#ff6a3a' : curiosa ? '#ffe680' : '#ffffff'
    e.icone.setText(icone).setColor(cor).setPosition(e.x, e.y - 20 + Math.sin(t / 120) * 1.5).setScale(e.estado === 'alerta' ? 1.3 : 1)
    const l = e.pista.caixa.limites
    e.casa.setPosition(l.right - 18, l.top)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      texturasJardim(arena)
      enxames = arena.pistas.map(criarEnxame)
      tocar(arena, 'zumbido')
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      enxames.forEach((e, j) => atualizarEnxame(e, j, delta))
    },

    estadoDebug() {
      return { enxames: enxames.map((e) => ({ estado: e.estado, paradoMs: Math.round(e.paradoMs), x: Math.round(e.x), y: Math.round(e.y), perigosa: Boolean(e.bala && !e.bala.inofensiva) })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const e of enxames) {
        e.abelhas.forEach((a) => a.img.destroy())
        e.aro.destroy()
        e.icone.destroy()
        e.casa.destroy()
        if (e.bala) e.bala.morta = true // se a pista ainda roda, Balas recolhe no próximo passo
      }
      enxames = []
    },
  }
}
