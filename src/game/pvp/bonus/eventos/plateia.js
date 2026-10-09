import Phaser from 'phaser'
import { ALTURA } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { particulas } from '../../../effects/particulas.js'
import { ignorarNasCaixas } from '../../../recorte.js'

// PLATEIA ARREMESSA: a galera empolgou e joga coisas no palco (tomate, flor,
// ursinho de pelúcia, balde de pipoca). Cada arremesso é avisado: uma SOMBRA
// aparece no chão da caixa, larga e clarinha, e vai ficando menor e mais forte
// conforme o objeto chega (VOO_MS, bem mais que o aviso mínimo). O objeto sobe
// da plateia (de baixo da tela) num arco, cai em cima da sombra e QUICA pela
// caixa (rebate nas paredes) até perder o embalo e sumir.
// O objeto é uma bala normal criada já no começo do voo, parada e inofensiva
// enquanto avisa (aviso = VOO_MS) e invisível: a CPU (botEsquiva) enxerga o
// ponto onde ele vai cair, como enxerga qualquer bala avisando.

const VOO_MS = 1000 // da sombra aparecer até o objeto bater no chão
const ALTURA_VOO = 150 // px que o arco sobe acima da reta
const INTERVALO = { inicio: 1000, fim: 640, rampaMs: 12000 } // ms entre arremessos em cada caixa
const MIRAR_CORACAO = 0.4 // chance de mirar onde o coração está
const RAIO = 7
const DANO = 4
const QUIQUE = { velocidade: 95, freio: 0.55, vidaMs: 1700, sumirMs: 260, periodoMs: 260 }
const COR_SOMBRA = 0xffb0c8
const OBJETOS = ['tomate', 'flor', 'ursinho', 'pipoca']

// texturas dos objetos (16x16, pixel art), geradas uma vez por jogo
function gerarTexturas(arena) {
  for (const nome of OBJETOS) {
    const chave = `bonus-plateia-${nome}`
    if (arena.textures.exists(chave)) continue
    const tex = arena.textures.createCanvas(chave, 16, 16)
    const ctx = tex.getContext()
    DESENHOS[nome]((cor, x, y, w = 1, h = 1) => {
      ctx.fillStyle = cor
      ctx.fillRect(x, y, w, h)
    })
    tex.refresh()
  }
}

// cada desenho é uma lista de retângulos (cor, x, y, w, h) num quadro 16x16
const disco = (p, cor, cx, cy, r) => {
  for (let y = -r; y <= r; y++) {
    const meia = Math.round(Math.sqrt(r * r - y * y))
    p(cor, cx - meia, cy + y, meia * 2 + 1, 1)
  }
}
const DESENHOS = {
  tomate(p) {
    disco(p, '#7a1010', 8, 9, 6)
    disco(p, '#d8281e', 8, 9, 5)
    disco(p, '#ff5a3a', 7, 8, 3)
    p('#ffd0c0', 5, 6, 2, 1)
    p('#ffd0c0', 5, 7, 1, 1)
    p('#2e8a2e', 6, 2, 5, 2)
    p('#4ac04a', 7, 1, 3, 1)
    p('#2e8a2e', 5, 3, 1, 1)
    p('#2e8a2e', 10, 3, 1, 1)
  },
  flor(p) {
    // caule e folha
    for (let k = 0; k < 7; k++) p('#2e8a2e', 9 + Math.floor(k / 3), 8 + k, 1, 1)
    p('#4ac04a', 11, 11, 3, 2)
    // pétalas em volta do miolo
    for (const [x, y] of [
      [6, 2],
      [9, 2],
      [4, 5],
      [11, 5],
      [6, 8],
      [9, 8],
    ])
      disco(p, '#ff6ab8', x, y, 2)
    disco(p, '#ffb0dc', 7, 4, 1)
    disco(p, '#ffd84a', 8, 5, 2)
    p('#fff0a0', 7, 4, 1, 1)
  },
  ursinho(p) {
    disco(p, '#5a3418', 4, 4, 2)
    disco(p, '#5a3418', 12, 4, 2)
    disco(p, '#c08a5a', 4, 4, 1)
    disco(p, '#c08a5a', 12, 4, 1)
    disco(p, '#5a3418', 8, 9, 6)
    disco(p, '#9a6232', 8, 9, 5)
    disco(p, '#e0b888', 8, 11, 2)
    p('#1a0e08', 5, 8, 2, 2)
    p('#1a0e08', 10, 8, 2, 2)
    p('#1a0e08', 7, 10, 3, 1)
    p('#ff8aa8', 3, 11, 2, 1)
    p('#ff8aa8', 12, 11, 2, 1)
  },
  pipoca(p) {
    // balde listrado (vermelho e branco), mais estreito embaixo
    for (let y = 6; y < 16; y++) {
      const recuo = Math.floor((y - 6) / 4)
      for (let x = 3 + recuo; x < 13 - recuo; x++) p((x >> 1) % 2 ? '#e02a2a' : '#fff4e8', x, y, 1, 1)
    }
    p('#a01818', 3, 6, 10, 1)
    // pipocas saindo por cima
    for (const [x, y] of [
      [4, 4],
      [7, 3],
      [10, 4],
      [6, 5],
      [9, 2],
      [12, 5],
    ])
      disco(p, '#fff8d0', x, y, 1)
    p('#ffd860', 7, 3, 1, 1)
    p('#ffd860', 10, 4, 1, 1)
  },
}

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + (b - a) * sorte()
  const vivos = new Set() // tudo o que foi criado (para o terminar)
  let voos = [] // { j, x, y, t, sombra, voador, x0, bala }
  let proxima = [0, 0]
  let t = 0
  let ativo = false
  let ultimoSom = -Infinity

  const guardar = (o) => {
    vivos.add(o)
    o.once?.('destroy', () => vivos.delete(o))
    return o
  }

  const intervalo = () => {
    const k = Math.min(1, t / INTERVALO.rampaMs)
    return (INTERVALO.inicio + (INTERVALO.fim - INTERVALO.inicio) * k) / aceleracao
  }

  const pistaViva = (j) => {
    const p = arena.pistas?.[j]
    return p && p.atacando && !arena.ko?.[j] ? p : null
  }

  // depois de cair: quica pela caixa, freando, e some piscando no fim
  const quicar = (b, dt) => {
    if (!b.caiu) {
      b.caiu = true
      b.ativoMs = 0
      b.sprite.setVisible(true)
    }
    b.ativoMs += dt
    const freio = Math.max(0, 1 - (QUIQUE.freio * dt) / 1000)
    b.vx *= freio
    b.vy *= freio
    // o "pulo" de cada quique (só visual: a sombra continua no chão)
    const pulo = Math.abs(Math.sin((b.ativoMs / QUIQUE.periodoMs) * Math.PI)) * Math.max(0, 1 - b.ativoMs / QUIQUE.vidaMs)
    b.sprite.setScale(b.escalaX * (1 + 0.35 * pulo), b.escalaY * (1 + 0.35 * pulo))
    b.sprite.rotation += (b.vx / 60) * (dt / 1000) * 4
    if (b.vida < QUIQUE.sumirMs) {
      b.sprite.setAlpha(Math.max(0, b.vida / QUIQUE.sumirMs) * (Math.sin(b.vida / 25) > 0 ? 1 : 0.5))
      if (b.vida < QUIQUE.sumirMs / 2) b.inofensiva = true // sumindo: não machuca mais
    }
  }

  const arremessar = (j) => {
    const pista = pistaViva(j)
    if (!pista) return
    const l = pista.caixa.limites
    const margem = RAIO + 6
    let x = entre(l.left + margem, l.right - margem)
    let y = entre(l.top + margem, l.bottom - margem)
    const c = pista.coracoes[0]
    if (c?.ativo && sorte() < MIRAR_CORACAO) {
      x = Phaser.Math.Clamp(c.x + entre(-12, 12), l.left + margem, l.right - margem)
      y = Phaser.Math.Clamp(c.y + entre(-12, 12), l.top + margem, l.bottom - margem)
    }
    const nome = OBJETOS[Math.floor(sorte() * OBJETOS.length)]
    const chave = `bonus-plateia-${nome}`
    // a bala já existe (avisando, parada, invisível): a CPU vê onde vai cair
    const ang = entre(0, Math.PI * 2)
    const bala = pista.balas.criar({
      x,
      y,
      raio: RAIO,
      textura: chave,
      tamanho: 18,
      aviso: VOO_MS,
      vx: Math.cos(ang) * QUIQUE.velocidade,
      vy: Math.sin(ang) * QUIQUE.velocidade,
      quicar: 4,
      vida: QUIQUE.vidaMs,
      pulso: 0,
      dano: DANO,
      atualizar: quicar,
      origem: 'bonus-plateia',
    })
    bala.sprite.setVisible(false)
    bala.nome = nome
    // a sombra no chão da caixa (o aviso)
    const sombra = guardar(arena.add.ellipse(x, y, RAIO * 4, RAIO * 2.4, COR_SOMBRA, 0.12).setDepth(4))
    sombra.setStrokeStyle(1, COR_SOMBRA, 0.5)
    pista.caixa.recortar(sombra)
    // o objeto voando, por cima de tudo (câmera principal)
    const voador = guardar(arena.add.image(x, ALTURA + 20, chave).setDepth(94))
    ignorarNasCaixas(arena, voador)
    const x0 = Phaser.Math.Clamp(x + entre(-70, 70), 20, 620)
    voos.push({ j, x, y, x0, t: 0, sombra, voador, bala, giro: entre(-10, 10) })
    if (t - ultimoSom > 140) {
      ultimoSom = t
      tocar(arena, 'arremesso')
    }
  }

  const cair = (v) => {
    v.sombra.destroy()
    v.voador.destroy()
    if (v.bala.morta || !pistaViva(v.j)) return
    tocar(arena, 'splat')
    particulas(arena, v.x, v.y, { cor: v.bala.nome === 'tomate' ? 0xff3a2a : v.bala.nome === 'flor' ? 0xff8ad0 : 0xfff0c0, quantidade: 8, velocidade: 90, vida: 350 })
    // tomate deixa uma mancha no chão (enfeite, não machuca)
    if (v.bala.nome === 'tomate') {
      const pista = arena.pistas[v.j]
      const mancha = guardar(arena.add.ellipse(v.x, v.y + 2, 22, 12, 0xc8201a, 0.55).setDepth(2))
      pista.caixa.recortar(mancha)
      arena.tweens.add({ targets: mancha, alpha: 0, delay: 1400, duration: 700, onComplete: () => mancha.destroy() })
    }
  }

  const atualizarVoos = (delta) => {
    for (const v of voos) {
      v.t += delta
      const k = Math.min(1, v.t / VOO_MS)
      // arco: sobe da plateia e cai em cima da sombra (fica maior no alto: mais perto da câmera)
      const x = v.x0 + (v.x - v.x0) * k
      const y = ALTURA + 20 + (v.y - ALTURA - 20) * k - Math.sin(k * Math.PI) * ALTURA_VOO
      v.voador.setPosition(x, y).setScale(1.2 + Math.sin(k * Math.PI) * 0.9).setRotation(v.voador.rotation + (v.giro * delta) / 1000)
      // a sombra encolhe e escurece conforme o objeto chega
      const s = 1.5 - 0.5 * k
      v.sombra.setScale(s).setFillStyle(COR_SOMBRA, 0.1 + 0.32 * k * k)
      v.sombra.setStrokeStyle(1, COR_SOMBRA, 0.35 + 0.5 * k * (0.6 + 0.4 * Math.sin(v.t / 45)))
      if (k >= 1) {
        v.feito = true
        cair(v)
      }
    }
    voos = voos.filter((v) => !v.feito)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      gerarTexturas(arena)
      proxima = [entre(500, 800), entre(800, 1150)]
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      for (let j = 0; j < 2; j++) {
        proxima[j] -= delta
        if (proxima[j] <= 0) {
          proxima[j] = intervalo() * entre(0.8, 1.2)
          arremessar(j)
        }
      }
      atualizarVoos(delta)
    },

    estadoDebug() {
      return { t: Math.round(t), voando: voos.length }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      voos = []
      for (const o of [...vivos]) {
        arena.tweens?.killTweensOf(o)
        o.destroy()
      }
      vivos.clear()
    },
  }
}
