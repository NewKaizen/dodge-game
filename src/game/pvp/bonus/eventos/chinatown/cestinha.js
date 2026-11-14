import { tocar } from '../../../../audio.js'
import { shake } from '../../../../effects/shake.js'
import { CESTA, planoCestas, dentroDaCesta, empurraoDaTampa, faseDaCesta } from './planos.js'
import { pistaViva, escudar, criarVivos, instrucao, calmo, limitar, mix } from './comum.js'

// CESTINHA DE VAPOR: cestos de bambu (dim sum) brotam no chão das caixas. DENTRO de um cesto o
// coração está a salvo (a tampa o protege: i-frames). Mas a tampa vai esquentando: o vapor sobe,
// a tampa chacoalha e o anel pisca (CESTA.avisoPopMs de aviso) e ela ESTOURA, jogando o
// coração para fora (um empurrão curto) e dando CESTA.gracaMs de proteção para ninguém ser jogado
// direto numa bala. Há sempre uns 2 cestos por caixa, em turnos: dá para pular de um para o
// outro, mas é preciso sair a tempo. O plano (onde e quando brota cada cesto) é igual nas duas
// caixas. terminar() devolve a velocidade do coração.

const EMPURRAO_FORCA = 3.2 // pista.fatorCoracao × isto durante o empurrão
const POP_ANIM_MS = 480

export default function criar(arena, { rng } = {}) {
  const sorte = rng ?? Math.random
  const vivos = criarVivos()
  let ativo = false
  let t = 0
  let plano = []
  let proximo = 0
  let instancias = [] // { j, pista, cfg, t0, fase, vapor: [], pop: null, tique }
  let base = []
  let empurro = [null, null]
  let dentro = [false, false]
  let gb = []
  let gt = []

  // ---------- desenho ----------

  const posicao = (inst) => {
    const l = inst.pista.caixa.limites
    return { x: l.left + inst.cfg.fx * l.width, y: l.top + inst.cfg.fy * l.height }
  }

  const baseDoCesto = (g, x, y, r, k) => {
    g.fillStyle(0x000000, 0.28).fillEllipse(x + 1, y + 4, r * 2.1, r * 1.9)
    g.fillStyle(0x7a4a18, 1).fillCircle(x, y, r)
    g.fillStyle(0xcf9a4a, 1).fillCircle(x, y, r - 2.5)
    g.fillStyle(0xe8c277, 1).fillCircle(x, y, r - 7)
    // interior com bolinhos de massa (dumplings) à vista
    g.fillStyle(0x6a3c10, 0.8).fillCircle(x, y, r - 9)
    for (const [dx, dy] of [[-8, -5], [7, -6], [0, 7]]) {
      g.fillStyle(0xfff0dc, 0.9).fillEllipse(x + dx * k, y + dy * k, 11 * k, 8 * k)
      g.lineStyle(1, 0xd8c8a8, 0.9).lineBetween(x + (dx - 3) * k, y + (dy - 2) * k, x + (dx - 1) * k, y + (dy + 1) * k)
    }
    // trama do bambu
    g.lineStyle(1, 0x5a3010, 0.55)
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2
      g.lineBetween(x + Math.cos(ang) * (r - 7), y + Math.sin(ang) * (r - 7), x + Math.cos(ang) * (r - 1), y + Math.sin(ang) * (r - 1))
    }
    g.lineStyle(1.5, 0x8a5a24, 0.8).strokeCircle(x, y, r - 4.5)
  }

  const tampa = (g, x, y, r, alpha, tremor) => {
    const ox = tremor
    g.fillStyle(0xe0b266, alpha).fillCircle(x + ox, y, r + 1)
    g.lineStyle(3, 0x8a5a24, Math.min(1, alpha + 0.3)).strokeCircle(x + ox, y, r + 1)
    g.lineStyle(1.5, 0x8a5a24, alpha).strokeCircle(x + ox, y, r - 6).strokeCircle(x + ox, y, r - 12)
    g.lineStyle(1, 0xfff0b0, alpha * 0.8)
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2 + 0.2
      g.lineBetween(x + ox + Math.cos(ang) * (r - 14), y + Math.sin(ang) * (r - 14), x + ox + Math.cos(ang) * (r - 1), y + Math.sin(ang) * (r - 1))
    }
    g.fillStyle(0xb07a30, alpha).fillCircle(x + ox, y, 4)
  }

  const vapor = (g, inst, dt) => {
    for (const p of inst.vapor) {
      p.idade += dt
      p.y -= p.vy * (dt / 1000)
      p.x += p.vx * (dt / 1000)
      const k = p.idade / p.vida
      g.fillStyle(0xffffff, 0.5 * (1 - k)).fillCircle(p.x, p.y, p.r * (0.7 + k))
    }
    inst.vapor = inst.vapor.filter((p) => p.idade < p.vida)
  }

  const soltarVapor = (inst, x, y, n, forte) => {
    for (let k = 0; k < n; k++) {
      const a = sorte() * Math.PI * 2
      const d = sorte() * CESTA.raio * 0.8
      inst.vapor.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7, vx: (sorte() - 0.5) * (forte ? 50 : 14), vy: (forte ? 30 : 16) + sorte() * 22, r: 3 + sorte() * 3, idade: 0, vida: 520 + sorte() * 420 })
    }
  }

  const desenhar = (inst, dt) => {
    const gB = gb[inst.j]
    const gT = gt[inst.j]
    const { x, y } = posicao(inst)
    const idade = t - inst.t0
    const fase = inst.fase
    const r = CESTA.raio
    if (fase === 'brota') {
      const k = limitar(idade / CESTA.brotaMs, 0, 1)
      baseDoCesto(gB, x, y, r * (0.35 + 0.65 * k), k)
      gB.lineStyle(2, 0xffe27a, 0.5 + 0.4 * (calmo() ? 1 : Math.sin(t / 80))).strokeCircle(x, y, r + 3 + (1 - k) * 8)
      return
    }
    if (fase === 'estoura') {
      const k = limitar((idade - CESTA.brotaMs - CESTA.vidaMs) / POP_ANIM_MS, 0, 1)
      baseDoCesto(gB, x, y, r, 1)
      // a tampa voa e o vapor explode
      tampa(gT, x, y - k * 34, r * (1 + k * 0.5), 1 - k, 0)
      gT.lineStyle(3, 0xffffff, 0.7 * (1 - k)).strokeCircle(x, y, r + k * 36)
      vapor(gT, inst, dt)
      return
    }
    baseDoCesto(gB, x, y, r, 1)
    const vida = idade - CESTA.brotaMs
    const aviso = fase === 'aviso'
    const kAviso = aviso ? limitar((vida - (CESTA.vidaMs - CESTA.avisoPopMs)) / CESTA.avisoPopMs, 0, 1) : 0
    // anel de aviso (alaranjado pulsando mais rápido)
    if (aviso) {
      const pisca = calmo() ? 0.8 : 0.5 + 0.5 * Math.sin(t / mix(90, 35, kAviso))
      gT.lineStyle(3, 0xff6a2a, 0.35 + 0.55 * pisca).strokeCircle(x, y, r + 4 + kAviso * 2)
      gT.lineStyle(1.5, 0xffd060, 0.7 * pisca).strokeCircle(x, y, r + 8)
    } else {
      gT.lineStyle(2, 0xfff0b0, 0.45).strokeCircle(x, y, r + 4)
    }
    const tremor = aviso && !calmo() ? Math.sin(t / 22) * (0.8 + 2.4 * kAviso) : 0
    tampa(gT, x, y - (aviso ? Math.abs(Math.sin(t / 60)) * kAviso * 2 : 0), r, aviso ? 0.45 + 0.35 * kAviso : 0.3, tremor)
    // vapor saindo pelas frestas
    inst.tempoVapor = (inst.tempoVapor ?? 0) + dt
    const cadencia = aviso ? mix(110, 35, kAviso) : 300
    while (inst.tempoVapor >= cadencia) {
      inst.tempoVapor -= cadencia
      soltarVapor(inst, x, y - 2, aviso ? 2 : 1, aviso)
    }
    vapor(gT, inst, dt)
    // som de panela fervendo
    if (aviso && t - (inst.tique ?? 0) > mix(300, 110, kAviso)) {
      inst.tique = t
      tocar(arena, 'tique')
    }
  }

  // ---------- regras ----------

  const estourar = (inst) => {
    const { x, y } = posicao(inst)
    const c = inst.pista.coracoes[0]
    soltarVapor(inst, x, y, 16, true)
    tocar(arena, 'estouro')
    if (c?.ativo && dentroDaCesta(c, { x, y }, -1)) {
      empurro[inst.j] = { dir: empurraoDaTampa(c, { x, y }, inst.cfg.dir), ate: t + CESTA.empurraoMs, cx: x, cy: y }
      escudar(c, CESTA.gracaMs)
      shake(arena, 120, 0.003)
    }
  }

  const lancar = (cfg) => {
    arena.pistas.forEach((pista, j) => {
      if (!pistaViva(arena, j)) return
      instancias.push({ j, pista, cfg, t0: t, fase: 'brota', vapor: [], tique: 0 })
    })
    tocar(arena, 'bolha')
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoCestas(sorte)
      proximo = 0
      instancias = []
      base = arena.pistas.map((p) => p.fatorCoracao)
      gb = arena.pistas.map((pista) => {
        const g = vivos.guardar(arena.add.graphics().setDepth(3))
        pista.caixa.recortar(g)
        return g
      })
      gt = arena.pistas.map((pista) => {
        const g = vivos.guardar(arena.add.graphics().setDepth(11))
        pista.caixa.recortar(g)
        return g
      })
      instrucao(arena, vivos, 'ESCONDA-SE NO CESTO!', { cor: '#ffe9a0' })
    },

    // o empurrão da tampa estourando: o coração é jogado para longe do cesto
    joy(j, joy) {
      if (!ativo) return joy
      const e = empurro[j]
      const pista = arena.pistas[j]
      if (!e) return joy
      const c = pista.coracoes[0]
      const longe = c?.ativo && Math.hypot(c.x - e.cx, c.y - e.cy) > CESTA.raio + 16
      if (t >= e.ate || longe || !c?.ativo) {
        empurro[j] = null
        pista.fatorCoracao = base[j] ?? 1
        return joy
      }
      pista.fatorCoracao = (base[j] ?? 1) * EMPURRAO_FORCA
      return { x: e.dir.x * 100, y: e.dir.y * 100 }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      while (proximo < plano.length && t >= plano[proximo].em) lancar(plano[proximo++])
      gb.forEach((g) => g.clear())
      gt.forEach((g) => g.clear())
      dentro = [false, false]
      for (const inst of instancias) {
        const idade = t - inst.t0
        const nova = faseDaCesta(idade)
        if (nova !== inst.fase) {
          inst.fase = nova
          if (nova === 'estoura') estourar(inst)
        }
        const c = inst.pista.coracoes[0]
        if ((inst.fase === 'abrigo' || inst.fase === 'aviso') && c?.ativo && dentroDaCesta(c, posicao(inst), 2)) {
          escudar(c, 90)
          dentro[inst.j] = true
        }
        if (!inst.pista.atacando || inst.pista.ataque?.desarmado) inst.fim = true
        if (idade > CESTA.brotaMs + CESTA.vidaMs + POP_ANIM_MS) inst.fim = true
        desenhar(inst, delta)
      }
      // coração dentro do cesto: um brilho dourado por baixo da tampa
      arena.pistas.forEach((pista, j) => {
        const c = pista.coracoes[0]
        if (dentro[j] && c?.ativo) gt[j].fillStyle(0xffe27a, calmo() ? 0.2 : 0.14 + 0.08 * Math.sin(t / 90)).fillCircle(c.x, c.y, 13)
      })
      instancias = instancias.filter((i) => !i.fim)
    },

    estadoDebug() {
      return { t: Math.round(t), cestos: instancias.map((i) => ({ j: i.j, fase: i.fase, idade: Math.round(t - i.t0) })), dentro: [...dentro], empurro: empurro.map(Boolean) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      arena.pistas.forEach((p, j) => (p.fatorCoracao = base[j] ?? 1))
      empurro = [null, null]
      instancias = []
      vivos.limpar(arena)
      gb = []
      gt = []
    },
  }
}
