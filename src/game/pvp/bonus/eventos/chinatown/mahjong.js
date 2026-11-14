import { tocar } from '../../../../audio.js'
import { particulas } from '../../../../effects/particulas.js'
import { MAHJONG, gerarTabuleiro, novoMahjong, pecaEm, pisarNaPeca, reporPeca, balasNaFileira } from './planos.js'
import { dono, escudar, criarVivos, instrucao, bolha, calmo, limitar } from './comum.js'

// MAHJONG: o chão das caixas vira um tabuleiro de peças de mahjong viradas para baixo (verde-jade).
// Pisar numa peça a VIRA (o símbolo aparece); pisar logo depois numa peça IGUAL forma um PAR: as
// duas somem num brilho, a FILEIRA de cada uma é varrida de balas e o coração ganha um escudo curto
// (MAHJONG.escudoMs). Peça diferente: a anterior desvira (é um jogo da memória: lembre onde estava
// cada símbolo). As peças somem e voltam viradas com símbolo novo depois de MAHJONG.reporMs.
// O tabuleiro é o mesmo nas duas caixas (semente); a CPU não pisa de verdade: de tempos em tempos
// "forma um par" sozinha (a mesma animação), para não ficar para trás.
// terminar() apaga tudo (o escudo é só i-frames do coração).

const SIMBOLO_COR = { pontos: 0x2a64d8, bambu: 0x1f9a4a, caractere: 0xd02828, vento: 0x2a9ad8, dragao: 0xc81830 }

export default function criar(arena, { rng } = {}) {
  const sorte = rng ?? Math.random
  const vivos = criarVivos()
  let ativo = false
  let t = 0
  let est = [] // por caixa: estado do mahjong
  let vis = [] // por caixa: [{ flip, alvo, aparece, somem, brilho }] por peça
  let gs = []
  let ultima = [-1, -1] // peça pisada no frame anterior
  let escudoAte = [0, 0]
  let repor = [] // { j, i, em }
  let varridas = [] // { j, y0, h, t0 }
  let cpuProx = 0
  let cpuPar = null // { j, a, b, em }
  let repostos = []
  let cursor = 0

  const geom = (j) => {
    const l = arena.pistas[j].caixa.limites
    return { l, w: l.width / MAHJONG.colunas, h: l.height / MAHJONG.linhas }
  }

  // ---------- peças ----------

  const simbolo = (g, id, cx, cy, s) => {
    const nome = ['pontos', 'bambu', 'caractere', 'vento', 'dragao'][id % 5]
    const cor = SIMBOLO_COR[nome]
    if (nome === 'pontos') {
      for (const [dx, dy, c] of [[-0.55, -0.5, 0x2a64d8], [0, 0, 0xd02828], [0.55, 0.5, 0x1f9a4a]]) {
        g.fillStyle(c, 1).fillCircle(cx + dx * s, cy + dy * s, s * 0.34)
        g.lineStyle(1, 0xffffff, 0.8).strokeCircle(cx + dx * s, cy + dy * s, s * 0.17)
      }
    } else if (nome === 'bambu') {
      for (const dx of [-0.55, 0, 0.55]) {
        g.fillStyle(cor, 1).fillRoundedRect(cx + dx * s - s * 0.13, cy - s * 0.85, s * 0.26, s * 1.7, 2)
        g.fillStyle(0xd8f8c8, 0.9).fillRect(cx + dx * s - s * 0.13, cy - s * 0.1, s * 0.26, 1.5)
      }
    } else if (nome === 'caractere') {
      g.lineStyle(Math.max(2, s * 0.22), cor, 1)
      g.lineBetween(cx - s * 0.8, cy - s * 0.35, cx + s * 0.8, cy - s * 0.35)
      g.lineBetween(cx - s * 0.6, cy + s * 0.2, cx + s * 0.6, cy + s * 0.2)
      g.lineBetween(cx, cy - s * 0.85, cx, cy + s * 0.85)
      g.lineBetween(cx - s * 0.55, cy + s * 0.85, cx + s * 0.55, cy + s * 0.55)
    } else if (nome === 'vento') {
      g.lineStyle(Math.max(2, s * 0.2), cor, 1).strokeCircle(cx, cy, s * 0.7)
      g.fillStyle(cor, 1).fillTriangle(cx, cy - s * 1.0, cx - s * 0.3, cy - s * 0.4, cx + s * 0.3, cy - s * 0.4)
      g.fillStyle(0x203a58, 1).fillTriangle(cx, cy + s * 0.75, cx - s * 0.28, cy, cx + s * 0.28, cy)
    } else {
      g.fillStyle(cor, 1).fillPoints([{ x: cx, y: cy - s }, { x: cx + s * 0.85, y: cy }, { x: cx, y: cy + s }, { x: cx - s * 0.85, y: cy }], true)
      g.fillStyle(0xf0c040, 1).fillCircle(cx, cy, s * 0.3)
      g.lineStyle(1, 0xfff0b0, 0.9).strokeCircle(cx, cy, s * 0.52)
    }
  }

  const desenharPeca = (g, j, i) => {
    const { l, w, h } = geom(j)
    const v = vis[j][i]
    const e = est[j]
    const sumida = e.sumidas.has(i)
    if (sumida && v.somem <= 0) return
    if (!sumida && v.aparece <= 0) return
    const col = i % MAHJONG.colunas
    const lin = Math.floor(i / MAHJONG.colunas)
    const cx = l.left + (col + 0.5) * w
    const cy = l.top + (lin + 0.5) * h
    const escala = sumida ? v.somem : v.aparece
    const tw = (w - 6) * 0.5 * escala
    const th = (h - 6) * 0.5 * escala
    const virada = v.flip
    const larg = Math.max(1.5, tw * Math.abs(Math.cos(Math.PI * virada)))
    const frente = virada > 0.5
    // sombra grossa (a espessura da peça)
    g.fillStyle(0x000000, 0.35).fillRoundedRect(cx - larg, cy - th + 3, larg * 2, th * 2, 4)
    g.fillStyle(frente ? 0xcfc09a : 0x13553a, 1).fillRoundedRect(cx - larg, cy - th + 2, larg * 2, th * 2, 4)
    g.fillStyle(frente ? 0xf4ead0 : 0x2a8a62, frente ? 1 : 0.92).fillRoundedRect(cx - larg, cy - th, larg * 2, th * 2, 4)
    g.lineStyle(1.5, frente ? 0xffffff : 0xf0e6c8, 0.8).strokeRoundedRect(cx - larg, cy - th, larg * 2, th * 2, 4)
    if (larg > 6) {
      if (frente) simbolo(g, e.pecas[i], cx, cy, Math.min(larg, th) * 0.62)
      else {
        // costas: losangos de bambu
        g.lineStyle(1, 0xf0e6c8, 0.5)
        const r = Math.min(larg, th) * 0.5
        g.strokePoints([{ x: cx, y: cy - r }, { x: cx + r, y: cy }, { x: cx, y: cy + r }, { x: cx - r, y: cy }], true)
        g.fillStyle(0xf0e6c8, 0.35).fillCircle(cx, cy, 2)
      }
    }
    if (v.brilho > 0) {
      g.fillStyle(0xffe27a, 0.55 * v.brilho).fillRoundedRect(cx - larg, cy - th, larg * 2, th * 2, 4)
      g.lineStyle(2, 0xfff0a0, v.brilho).strokeRoundedRect(cx - larg - 2, cy - th - 2, larg * 2 + 4, th * 2 + 4, 5)
    }
  }

  // ---------- jogadas ----------

  const estourar = (j, i) => {
    const { l, w, h } = geom(j)
    const cx = l.left + ((i % MAHJONG.colunas) + 0.5) * w
    const cy = l.top + (Math.floor(i / MAHJONG.colunas) + 0.5) * h
    particulas(arena, cx, cy, { cor: 0xffe27a, quantidade: 8, velocidade: 90, vida: 420 })
  }

  const formouPar = (j, par) => {
    const pista = arena.pistas[j]
    const { l, h } = geom(j)
    const c = pista.coracoes[0]
    const linhas = [...new Set(par.map((i) => Math.floor(i / MAHJONG.colunas)))]
    let limpas = 0
    for (const lin of linhas) {
      for (const b of balasNaFileira(pista.balas.lista, l, lin)) {
        b.morta = true
        limpas++
      }
      varridas.push({ j, y0: l.top + lin * h, h, t0: t })
    }
    for (const i of par) {
      vis[j][i].brilho = 1
      vis[j][i].somem = 1
      repor.push({ j, i, em: t + MAHJONG.reporMs })
      estourar(j, i)
    }
    if (c?.ativo) {
      escudar(c, MAHJONG.escudoMs)
      escudoAte[j] = t + MAHJONG.escudoMs
    }
    tocar(arena, 'copiado')
    return limpas
  }

  const pisar = (j, i) => {
    const r = pisarNaPeca(est[j], i)
    if (r.tipo === 'nada') return r
    if (r.desvirar !== null) vis[j][r.desvirar].alvo = 0
    if (r.tipo === 'virou') {
      vis[j][i].alvo = 1
      tocar(arena, 'tique')
    } else if (r.tipo === 'par') formouPar(j, r.par)
    return r
  }

  // a CPU "pisa" num par de verdade (por baixo dos panos), com a animação normal
  const jogadaDaCpu = (j) => {
    const e = est[j]
    const porSimbolo = new Map()
    e.pecas.forEach((s, i) => {
      if (e.sumidas.has(i)) return
      porSimbolo.set(s, [...(porSimbolo.get(s) ?? []), i])
    })
    const pares = [...porSimbolo.values()].filter((v) => v.length >= 2)
    if (!pares.length) return
    const v = pares[Math.floor(sorte() * pares.length)]
    cpuPar = { j, a: v[0], b: v[1], em: t + 650 }
    pisar(j, v[0])
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      const pecas = gerarTabuleiro(sorte)
      repostos = Array.from({ length: 48 }, () => Math.floor(sorte() * MAHJONG.simbolos))
      cursor = 0
      est = arena.pistas.map(() => novoMahjong(pecas))
      vis = arena.pistas.map(() => pecas.map(() => ({ flip: 0, alvo: 0, aparece: 0, somem: 0, brilho: 0 })))
      gs = arena.pistas.map((pista) => {
        const g = vivos.guardar(arena.add.graphics().setDepth(2))
        pista.caixa.recortar(g)
        return g
      })
      const gb = arena.pistas.map((pista) => {
        const g = vivos.guardar(arena.add.graphics().setDepth(9))
        pista.caixa.recortar(g)
        return g
      })
      gs.push(...gb)
      cpuProx = 2800 + sorte() * 1500
      // as peças aparecem em onda
      vis.forEach((lista) => lista.forEach((v, i) => (v.aparece = -((i % MAHJONG.colunas) + Math.floor(i / MAHJONG.colunas)) * 0.12)))
      instrucao(arena, vivos, 'PAR IGUAL LIMPA A FILEIRA!', { cor: '#9affc8' })
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      const dt = delta / 1000
      const n = arena.pistas.length
      // pisadas de verdade (a CPU joga por baixo dos panos)
      arena.pistas.forEach((pista, j) => {
        const c = pista.coracoes[0]
        if (!c?.ativo || dono(arena, j) === arena.cpu || !pista.atacando) return
        const i = pecaEm(pista.caixa.limites, c.x, c.y)
        if (i !== ultima[j]) {
          ultima[j] = i
          if (i >= 0) pisar(j, i)
        }
      })
      if (arena.cpu !== null && arena.cpu !== undefined) {
        const j = arena.pistas.findIndex((_, k) => dono(arena, k) === arena.cpu)
        if (j >= 0 && pistaPronta(j)) {
          if (cpuPar && t >= cpuPar.em) {
            pisar(cpuPar.j, cpuPar.b)
            cpuPar = null
            cpuProx = t + 4200 + sorte() * 2600
          } else if (!cpuPar && t >= cpuProx) jogadaDaCpu(j)
        }
      }
      for (const r of [...repor]) {
        if (t < r.em) continue
        repor.splice(repor.indexOf(r), 1)
        const v = repostos[cursor++ % repostos.length]
        reporPeca(est[r.j], r.i, () => (v + 0.5) / MAHJONG.simbolos)
        Object.assign(vis[r.j][r.i], { flip: 0, alvo: 0, aparece: 0.001, somem: 0, brilho: 0 })
      }
      varridas = varridas.filter((s) => t - s.t0 < 520)

      for (let j = 0; j < n; j++) {
        const g = gs[j]
        const g2 = gs[j + n]
        g.clear()
        g2.clear()
        const e = est[j]
        e.pecas.forEach((_, i) => {
          const v = vis[j][i]
          v.flip += limitar(v.alvo - v.flip, -1, 1) * Math.min(1, dt * 7)
          if (Math.abs(v.alvo - v.flip) < 0.02) v.flip = v.alvo
          if (!e.sumidas.has(i)) v.aparece = Math.min(1, v.aparece + dt * 3.2)
          else v.somem = Math.max(0, v.somem - dt * 2.4)
          v.brilho = Math.max(0, v.brilho - dt * 2.6)
          desenharPeca(g, j, i)
        })
        const { l } = geom(j)
        const c = arena.pistas[j].coracoes[0]
        // a peça sob o coração
        if (c?.ativo) {
          const i = pecaEm(l, c.x, c.y)
          if (i >= 0 && !e.sumidas.has(i)) {
            const { w, h } = geom(j)
            const x = l.left + (i % MAHJONG.colunas) * w
            const y = l.top + Math.floor(i / MAHJONG.colunas) * h
            g.lineStyle(2, 0xffe27a, calmo() ? 0.7 : 0.45 + 0.35 * Math.sin(t / 120)).strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 5)
          }
          if (t < escudoAte[j]) bolha(g2, c.x, c.y, 15, 0x9affc8, t, Math.min(1, (escudoAte[j] - t) / 350))
        }
        // varridas: faixa de luz com a fileira
        for (const s of varridas) {
          if (s.j !== j) continue
          const k = (t - s.t0) / 520
          g2.fillStyle(0xfff0a0, 0.5 * (1 - k)).fillRect(l.left, s.y0 + 2, l.width, s.h - 4)
          g2.lineStyle(2, 0xffffff, 0.9 * (1 - k)).lineBetween(l.left + k * l.width, s.y0, l.left + k * l.width, s.y0 + s.h)
        }
      }
    },

    estadoDebug() {
      return { t: Math.round(t), pecas: est.map((e) => [...e.pecas]), viradas: est.map((e) => [...e.viradas]), sumidas: est.map((e) => [...e.sumidas]), escudo: escudoAte.map((x) => x > t) }
    },

    // dev: força um par já na caixa j (testes)
    forcarPar(j) {
      jogadaDaCpu(j)
      if (cpuPar) {
        pisar(cpuPar.j, cpuPar.b)
        cpuPar = null
      }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      vivos.limpar(arena)
      est = []
      vis = []
      gs = []
      repor = []
      varridas = []
      cpuPar = null
    },
  }

  function pistaPronta(j) {
    const p = arena.pistas[j]
    return Boolean(p?.atacando) && !p.ataque?.desarmado && !arena.ko?.[dono(arena, j)]
  }
}
