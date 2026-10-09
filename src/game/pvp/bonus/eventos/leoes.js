import Phaser from 'phaser'
import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { etiqueta, poeirinha, texturaLeao, chaoDeAreia } from './arteColiseu.js'

// LEÕES!: soltaram as feras. De tempos em tempos um leão atravessa a caixa
// correndo numa linha reta horizontal. O aviso vem antes (AVISO_MS): rugido,
// a faixa por onde ele vai passar piscando em vermelho, patinhas e "!" no lado
// por onde ele entra. Às vezes ele SALTA no meio do caminho: no trecho do salto
// a faixa tem um buraco (tracejado em arco) e quem estiver ali embaixo não leva
// nada (o leão passa por cima). Mais para o fim, dois leões de uma vez, em
// faixas afastadas e sentidos opostos.
// O leão é uma bala retangular normal (dano, i-frames, graze, a CPU enxerga):
// criada já no começo do aviso com `aviso` = AVISO_MS, parada fora da caixa, e
// com o sprite escondido; quem desenha o leão (correndo, pulando, sombra,
// poeira) é este evento. No salto a bala fica `inofensiva`.

const AVISO_MS = 950
const VELOCIDADE = 290 // px/s
const DANO = 5
const CORPO = { largura: 30, altura: 16 } // hitbox (o sprite é um pouco maior)
const FAIXA = 24 // altura da faixa de aviso
const INTERVALO = { min: 1500, max: 2200 } // ms entre leões em cada caixa
const PRIMEIRO = [550, 1100] // as caixas começam defasadas
const SALTO = { chance: 0.35, largura: 64, altura: 22 }
const DUPLO = { aPartirDe: 2, chance: 0.45, distancia: 60 } // depois de N leões, chance de vir em dupla
const VERMELHO = 0xff3048

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + sorte() * (b - a)
  const vivos = new Set()
  let ativo = false
  let chao = null // areia no chão das caixas
  let t = 0
  let proximo = [...PRIMEIRO]
  let soltos = [0, 0]
  let leoes = [] // { j, pista, bala, sprite, sombra, faixa, y, dir, salto: {x0, x1}|null, t0, ultimaPoeira }
  let ultimoRugido = -Infinity

  const guardar = (o) => {
    vivos.add(o)
    o.once?.('destroy', () => vivos.delete(o))
    return o
  }

  const pistaViva = (j) => {
    const p = arena.pistas?.[j]
    return p && p.atacando && !p.ataque.desarmado && !arena.ko?.[arena.donoDaPista?.(j) ?? j] ? p : null
  }

  const soltarLeao = (j, pista, y, dir) => {
    const l = pista.caixa.limites
    const x0 = dir > 0 ? l.left - 26 : l.right + 26
    let salto = null
    if (sorte() < SALTO.chance) {
      const meio = entre(l.left + l.width * 0.35, l.right - l.width * 0.35)
      salto = { x0: meio - SALTO.largura / 2, x1: meio + SALTO.largura / 2 }
    }
    const bala = pista.balas.criar({
      x: x0,
      y,
      vx: dir * VELOCIDADE,
      largura: CORPO.largura,
      altura: CORPO.altura,
      aviso: AVISO_MS / aceleracao,
      atravessa: true,
      dano: DANO,
      cor: 0xe2a548,
      origem: 'bonus-leoes',
      // no trecho do salto o leão está no ar: não machuca (e no fim do
      // ataque a pista desarma as balas: continua inofensivo)
      atualizar: (b) => {
        const noAr = Boolean(salto) && b.x > salto.x0 && b.x < salto.x1
        b.inofensiva = noAr || !pista.ataque || pista.ataque.desarmado
      },
    })
    bala.sprite.setVisible(false)
    const sombra = guardar(arena.add.ellipse(x0, y + 9, 30, 7, 0x000000, 0.35).setDepth(4))
    const sprite = guardar(arena.add.sprite(x0, y, texturaLeao(arena), 'l0').setScale(1.2).setDepth(7).setFlipX(dir < 0))
    const faixa = guardar(arena.add.graphics().setDepth(3))
    pista.caixa.recortar(sombra, sprite, faixa)
    // (o "!" na borda por onde ele entra é o marcador normal da bala que nasce fora da caixa)
    leoes.push({ j, pista, bala, sprite, sombra, faixa, y, dir, salto, t0: t, ultimaPoeira: 0 })
  }

  const rugir = (pista, y, dir) => {
    if (t - ultimoRugido > 250) {
      ultimoRugido = t
      tocar(arena, 'rugido')
      shake(arena, 220, 0.003)
    }
    const l = pista.caixa.limites
    const txt = guardar(etiqueta(arena, dir > 0 ? l.left + 40 : l.right - 40, Phaser.Math.Clamp(y - 20, l.top + 10, l.bottom - 10), 'ROAAR!', { cor: '#ffb040', tamanho: 13, pista }))
    arena.tweens.add({ targets: txt, scale: { from: 1.6, to: 1 }, duration: 180, ease: 'Back.easeOut' })
    arena.tweens.add({ targets: txt, alpha: 0, y: txt.y - 6, delay: 500, duration: 300, onComplete: () => txt.destroy() })
  }

  // escolhe faixas (y) longe da borda e, em dupla, longe uma da outra
  const sortearFaixa = (l, longeDe = null) => {
    for (let k = 0; k < 10; k++) {
      const y = entre(l.top + FAIXA / 2 + 4, l.bottom - FAIXA / 2 - 4)
      if (longeDe === null || Math.abs(y - longeDe) >= DUPLO.distancia) return y
    }
    return longeDe < l.centerY ? l.bottom - FAIXA / 2 - 4 : l.top + FAIXA / 2 + 4
  }

  const vez = (j) => {
    const pista = pistaViva(j)
    if (!pista) return
    const l = pista.caixa.limites
    const dir = sorte() < 0.5 ? 1 : -1
    const y = sortearFaixa(l)
    soltarLeao(j, pista, y, dir)
    rugir(pista, y, dir)
    soltos[j]++
    if (soltos[j] > DUPLO.aPartirDe && sorte() < DUPLO.chance) soltarLeao(j, pista, sortearFaixa(l, y), -dir)
  }

  const desenharFaixa = (le, idade) => {
    const g = le.faixa
    g.clear()
    const aviso = AVISO_MS / aceleracao
    if (idade >= aviso + 150) return
    const l = le.pista.caixa.limites
    const a = idade < aviso ? (Math.sin(idade / 60) > 0 ? 0.34 : 0.14) : 0.34 * (1 - (idade - aviso) / 150)
    const y0 = le.y - FAIXA / 2
    const trechos = le.salto
      ? [
          [l.left, le.salto.x0],
          [le.salto.x1, l.right],
        ]
      : [[l.left, l.right]]
    g.fillStyle(VERMELHO, a)
    for (const [x0, x1] of trechos) if (x1 > x0) g.fillRect(x0, y0, x1 - x0, FAIXA)
    g.lineStyle(1, VERMELHO, Math.min(1, a * 2.4))
    for (const [x0, x1] of trechos) {
      g.lineBetween(x0, y0, x1, y0)
      g.lineBetween(x0, y0 + FAIXA, x1, y0 + FAIXA)
    }
    // salto: arco tracejado por cima do buraco (o caminho do pulo)
    if (le.salto) {
      const { x0, x1 } = le.salto
      g.lineStyle(2, 0xffe080, Math.min(1, a * 2.6))
      for (let k = 0; k < 8; k += 2) {
        const p0 = k / 8
        const p1 = (k + 1) / 8
        const yA = le.y - Math.sin(p0 * Math.PI) * SALTO.altura
        const yB = le.y - Math.sin(p1 * Math.PI) * SALTO.altura
        g.lineBetween(x0 + (x1 - x0) * p0, yA, x0 + (x1 - x0) * p1, yB)
      }
    }
    // patinhas andando no sentido da corrida
    if (idade < aviso) {
      g.fillStyle(0xffd0a0, a * 2)
      for (let k = 0; k < 4; k++) {
        const x = le.dir > 0 ? l.left + 26 + k * 16 : l.right - 26 - k * 16
        const pisa = Math.floor(idade / 120) % 4 >= k
        if (!pisa) continue
        const dy = k % 2 ? -4 : 4
        g.fillCircle(x, le.y + dy, 2.2)
        g.fillCircle(x + le.dir * 3, le.y + dy - 2, 1)
        g.fillCircle(x + le.dir * 3, le.y + dy + 2, 1)
      }
    }
  }

  const atualizarLeoes = () => {
    for (const le of leoes) {
      const idade = t - le.t0
      desenharFaixa(le, idade)
      const b = le.bala
      const l = le.pista.caixa.limites
      if (b.morta || (le.dir > 0 ? b.x > l.right + 60 : b.x < l.left - 60)) {
        le.feito = true
        continue
      }
      // fim do ataque: o leão some junto com as balas
      if (!le.sumindo && (!le.pista.ataque || le.pista.ataque.desarmado)) {
        le.sumindo = true
        arena.tweens.add({ targets: [le.sprite, le.sombra], alpha: 0, duration: 250 })
      }
      // no ar: sobe em arco, gira de leve e a sombra encolhe
      let alto = 0
      if (le.salto && b.x > le.salto.x0 && b.x < le.salto.x1) {
        const p = (b.x - le.salto.x0) / (le.salto.x1 - le.salto.x0)
        alto = Math.sin(p * Math.PI) * SALTO.altura
      }
      const correndo = idade >= AVISO_MS / aceleracao
      le.sprite.setFrame(alto > 0 ? 'l1' : correndo && Math.floor(t / 80) % 2 ? 'l1' : 'l0')
      le.sprite.setPosition(Math.round(b.x), Math.round(b.y - 3 - alto + (correndo && !alto ? (Math.floor(t / 80) % 2) : 0)))
      le.sprite.setRotation(alto > 0 ? -le.dir * 0.25 * Math.cos(((b.x - le.salto.x0) / (le.salto.x1 - le.salto.x0)) * Math.PI) : 0)
      le.sombra.setPosition(b.x, b.y + 9).setScale(1 - alto / 40)
      // poeira levantando atrás das patas
      if (correndo && !alto && t - le.ultimaPoeira > 70 && b.x > l.left - 10 && b.x < l.right + 10) {
        le.ultimaPoeira = t
        poeirinha(arena, le.pista, b.x - le.dir * 14, b.y + 8, { quantidade: 2, raio: 2.5, vivos })
      }
    }
    for (const le of leoes.filter((x) => x.feito)) for (const o of [le.sprite, le.sombra, le.faixa]) o.scene && o.destroy()
    leoes = leoes.filter((x) => !x.feito)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      chao = chaoDeAreia(arena)
      t = 0
      proximo = [...PRIMEIRO]
      soltos = [0, 0]
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      chao.atualizar()
      for (let j = 0; j < 2; j++) {
        proximo[j] -= delta
        if (proximo[j] <= 0) {
          proximo[j] = entre(INTERVALO.min, INTERVALO.max) / aceleracao
          vez(j)
        }
      }
      atualizarLeoes()
    },

    estadoDebug() {
      return { leoes: leoes.map((le) => ({ j: le.j, x: Math.round(le.bala.x), y: Math.round(le.y), salto: Boolean(le.salto), inofensiva: le.bala.inofensiva })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      chao?.destruir()
      chao = null
      for (const le of leoes) le.bala.morta = true // a pista recolhe no próximo passo (ou no parar())
      leoes = []
      for (const o of [...vivos]) {
        arena.tweens?.killTweensOf(o)
        o.destroy()
      }
      vivos.clear()
    },
  }
}
