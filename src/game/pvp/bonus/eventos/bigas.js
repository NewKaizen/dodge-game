import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { poeirinha, texturaBiga, chaoDeAreia } from './arteColiseu.js'

// CORRIDA DE BIGAS: a caixa vira uma pista de corrida com FAIXAS horizontais
// (linhas de cal no chão) e cada faixa tem o seu sentido, alternado: a de cima
// corre para a direita, a de baixo para a esquerda, e assim por diante (setas
// no chão mostram). De tempos em tempos bigas (dois cavalos e a carruagem)
// atravessam a caixa numa faixa. O aviso: a faixa escurece e uma nuvem de
// POEIRA cresce na borda por onde a biga vai entrar, com o galope chegando
// (AVISO_MS). Nunca vêm bigas em todas as faixas ao mesmo tempo: sobra
// sempre pelo menos uma faixa livre (as que acabaram de passar ficam livres).
// Cada biga é uma bala retangular normal (dano, i-frames, graze, a CPU
// enxerga), criada no começo do aviso com `aviso` = AVISO_MS, parada fora da
// caixa; o desenho (cavalos galopando, roda girando, poeira) é deste evento.

const FAIXAS = 3
const AVISO_MS = 900
const VELOCIDADE = 330 // px/s
const DANO = 5
const CORPO = { largura: 56, alturaFrac: 0.62 } // hitbox: fração da altura da faixa
const LARGADA = { min: 1050, max: 1500 } // ms entre largadas em cada caixa
const PRIMEIRA = [500, 900]
const DUPLA = 0.4 // chance de largar em duas faixas juntas
const CAL = 0xf2ead8

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + sorte() * (b - a)
  const vivos = new Set()
  let ativo = false
  let chao = null // areia no chão das caixas
  let t = 0
  let proxima = [...PRIMEIRA]
  let bigas = [] // { j, pista, faixa, dir, bala, sprite, sombra, t0, poeira }
  let chaos = [] // por pista: Graphics das faixas
  let ultimaFaixa = [-1, -1]
  let ultimoGalope = -Infinity

  const guardar = (o) => {
    vivos.add(o)
    o.once?.('destroy', () => vivos.delete(o))
    return o
  }

  const pistaViva = (j) => {
    const p = arena.pistas?.[j]
    return p && p.atacando && !p.ataque.desarmado && !arena.ko?.[arena.donoDaPista?.(j) ?? j] ? p : null
  }

  // sentido de cada faixa: alterna (0 -> direita, 1 -> esquerda, ...)
  const sentido = (f) => (f % 2 === 0 ? 1 : -1)
  const alturaFaixa = (l) => l.height / FAIXAS
  const centroFaixa = (l, f) => l.top + alturaFaixa(l) * (f + 0.5)

  const ocupada = (j, f) => bigas.some((b) => b.j === j && b.faixa === f)

  const largar = (j, pista, f) => {
    const l = pista.caixa.limites
    const dir = sentido(f)
    const y = centroFaixa(l, f)
    const x0 = dir > 0 ? l.left - CORPO.largura / 2 - 8 : l.right + CORPO.largura / 2 + 8
    const bala = pista.balas.criar({
      x: x0,
      y,
      vx: dir * VELOCIDADE,
      largura: CORPO.largura,
      altura: alturaFaixa(l) * CORPO.alturaFrac,
      aviso: AVISO_MS / aceleracao,
      atravessa: true,
      dano: DANO,
      origem: 'bonus-bigas',
      atualizar: (b) => {
        if (!pista.ataque || pista.ataque.desarmado) b.inofensiva = true
      },
    })
    bala.sprite.setVisible(false)
    const sombra = guardar(arena.add.ellipse(x0, y + 13, 60, 8, 0x000000, 0.3).setDepth(4))
    const sprite = guardar(arena.add.sprite(x0, y, texturaBiga(arena), 'b0').setDepth(7).setFlipX(dir < 0))
    // nuvem de poeira na entrada (o aviso)
    const borda = dir > 0 ? l.left : l.right
    const poeira = [0, 1, 2, 3, 4].map((k) => guardar(arena.add.circle(borda + dir * (4 + k * 6), y + (k % 2 ? -6 : 6) * (k / 4), 6 + k, 0xd8b880, 0).setDepth(6)))
    pista.caixa.recortar(sombra, sprite, ...poeira)
    bigas.push({ j, pista, faixa: f, dir, bala, sprite, sombra, poeira, t0: t, y, ultimaPoeira: 0 })
  }

  const vez = (j) => {
    const pista = pistaViva(j)
    if (!pista) return
    const livres = [...Array(FAIXAS).keys()].filter((f) => !ocupada(j, f) && f !== ultimaFaixa[j])
    if (!livres.length) return
    // nunca todas: no máximo FAIXAS - 1 faixas com biga ao mesmo tempo
    const ocupadas = [...Array(FAIXAS).keys()].filter((f) => ocupada(j, f)).length
    const cabem = Math.min(livres.length, FAIXAS - 1 - ocupadas)
    if (cabem <= 0) return
    const quantas = cabem >= 2 && sorte() < DUPLA ? 2 : 1
    for (let k = 0; k < quantas; k++) {
      const i = Math.floor(sorte() * livres.length)
      const f = livres.splice(i, 1)[0]
      largar(j, pista, f)
      ultimaFaixa[j] = f
    }
    if (t - ultimoGalope > 300) {
      ultimoGalope = t
      tocar(arena, 'galope')
      if (sorte() < 0.35) tocar(arena, 'relincho')
    }
  }

  // linhas de cal entre as faixas, setas do sentido e a faixa escurecendo no aviso
  const desenharChao = (g, pista, j) => {
    const l = pista.caixa.limites
    const h = alturaFaixa(l)
    g.clear()
    for (let f = 0; f < FAIXAS; f++) {
      const y0 = l.top + h * f
      const vindo = bigas.find((b) => b.j === j && b.faixa === f && t - b.t0 < AVISO_MS / aceleracao)
      if (vindo) {
        const pisca = Math.sin((t - vindo.t0) / 70) > 0 ? 0.3 : 0.16
        g.fillStyle(0xff4030, pisca).fillRect(l.left, y0, l.width, h)
      } else if (f % 2) g.fillStyle(0x2a1a0a, 0.18).fillRect(l.left, y0, l.width, h)
      // setas do sentido, bem fracas, andando
      const dir = sentido(f)
      const yc = y0 + h / 2
      g.lineStyle(2, CAL, vindo ? 0.6 : 0.22)
      const anda = ((t * 0.05) % 40) * dir
      for (let x = l.left - 40 + anda; x < l.right + 40; x += 40) {
        g.lineBetween(x - dir * 5, yc - 5, x, yc)
        g.lineBetween(x - dir * 5, yc + 5, x, yc)
      }
      // linha tracejada de cal entre as faixas
      if (f > 0) {
        g.fillStyle(CAL, 0.4)
        for (let x = l.left + 3; x < l.right; x += 14) g.fillRect(x, y0 - 1, 8, 2)
      }
    }
  }

  const atualizarBigas = () => {
    const aviso = AVISO_MS / aceleracao
    for (const b of bigas) {
      const idade = t - b.t0
      const bala = b.bala
      const l = b.pista.caixa.limites
      if (bala.morta || (b.dir > 0 ? bala.x > l.right + 80 : bala.x < l.left - 80)) {
        b.feito = true
        continue
      }
      if (!b.sumindo && (!b.pista.ataque || b.pista.ataque.desarmado)) {
        b.sumindo = true
        arena.tweens.add({ targets: [b.sprite, b.sombra, ...b.poeira], alpha: 0, duration: 250 })
      }
      // poeira de aviso crescendo e tremendo na borda
      if (idade < aviso + 200) {
        const k = Math.min(1, idade / aviso)
        b.poeira.forEach((p, i) => {
          if (b.sumindo) return
          p.setFillStyle(0xd8b880, (idade < aviso ? 0.25 + 0.45 * k : 0.7 * (1 - (idade - aviso) / 200)) * (1 - i * 0.12))
          p.setScale(0.6 + k * 0.9 + Math.sin(idade / 50 + i) * 0.12)
        })
      }
      const correndo = idade >= aviso
      const quadro = correndo ? (Math.floor(t / 70) % 2 ? 'b1' : 'b0') : Math.floor(t / 140) % 2 ? 'b1' : 'b0'
      b.sprite.setFrame(quadro)
      const sacode = correndo ? (Math.floor(t / 70) % 2) : 0
      b.sprite.setPosition(Math.round(bala.x), Math.round(bala.y - 4 - sacode))
      b.sombra.setPosition(bala.x, bala.y + 12)
      if (correndo && t - b.ultimaPoeira > 60 && bala.x > l.left - 20 && bala.x < l.right + 20) {
        b.ultimaPoeira = t
        poeirinha(arena, b.pista, bala.x - b.dir * 30, bala.y + 10, { quantidade: 2, raio: 3, espalha: 10, vivos })
        if (Math.abs(bala.x - l.centerX) < 6) shake(arena, 80, 0.0025)
      }
    }
    for (const b of bigas.filter((x) => x.feito)) for (const o of [b.sprite, b.sombra, ...b.poeira]) o.scene && o.destroy()
    bigas = bigas.filter((x) => !x.feito)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      chao = chaoDeAreia(arena)
      t = 0
      proxima = [...PRIMEIRA]
      chaos = arena.pistas.map((pista) => {
        const g = guardar(arena.add.graphics().setDepth(2))
        pista.caixa.recortar(g)
        return g
      })
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      chao.atualizar()
      for (let j = 0; j < 2; j++) {
        proxima[j] -= delta
        if (proxima[j] <= 0) {
          proxima[j] = entre(LARGADA.min, LARGADA.max) / aceleracao
          vez(j)
        }
      }
      atualizarBigas()
      arena.pistas.forEach((pista, j) => chaos[j] && desenharChao(chaos[j], pista, j))
    },

    estadoDebug() {
      return { bigas: bigas.map((b) => ({ j: b.j, faixa: b.faixa, dir: b.dir, x: Math.round(b.bala.x) })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      chao?.destruir()
      chao = null
      for (const b of bigas) b.bala.morta = true
      bigas = []
      chaos = []
      for (const o of [...vivos]) {
        arena.tweens?.killTweensOf(o)
        o.destroy()
      }
      vivos.clear()
    },
  }
}
