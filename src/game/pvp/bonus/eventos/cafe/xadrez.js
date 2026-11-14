import { tocar } from '../../../../audio.js'
import { particulas } from '../../../../effects/particulas.js'
import { contextoDoCafe } from './util.js'
import { XADREZ, destinosDoCavalo, escolherSalto, centroDaCelula, celulaDoPonto, escolherSaltoDaCpu } from './planos.js'

// XADREZ: a caixa vira um tabuleiro (6 x 4 casas) e o coração vira um CAVALO: ele não anda
// livre, ele PULA em L (2 casas numa direção e 1 de lado, como no xadrez). Os até 8 destinos
// aparecem marcados na hora; o direcional escolhe o que aponta mais para onde você empurra
// (direcional reto entre dois pulos: o que fica mais perto do meio) e o pulo sai na hora, se o
// cavalo já recarregou (XADREZ.recargaMs; o anel em volta do coração enche). No ar (XADREZ.vooMs)
// o cavalo não leva dano: pular POR CIMA das balas é a defesa. Nunca fica preso: de qualquer
// casa há pelo menos 2 destinos e o tabuleiro todo é alcançável (planos.js confere).
// A CPU decide a cada ~130 ms: se a casa dela vai ficar perigosa pula para a mais segura.
// Em rede cada PC pula o SEU coração; na caixa espelho o coração anda pelas posições que chegam.
// terminar() apaga o tabuleiro e devolve o coração ao movimento livre (nada foi trocado nele).

const CLARA = 0xf0e2c4
const ESCURA = 0x5a3a28
const COR = 0xffd070

// silhueta de um cavalo de xadrez (cabeça), em pixels em volta do centro
const CAVALO = [[-5, 6], [-5, 3], [-1.5, 0.5], [-4, -1.5], [-3.4, -4.6], [0, -7], [3, -6.2], [5.2, -3], [5.2, 1.4], [3.6, 6]]

export default function criar(arena) {
  const ctx = contextoDoCafe(arena)
  let ativo = false
  let t = 0
  // por pista: { pista, g, marcas, cel: {c,r}, pronto, voo, sel, cpuAlvo, cpuEm }
  let lados = []

  const geometria = (s) => {
    const l = s.pista.caixa.limites
    return { l, w: l.width / XADREZ.colunas, h: l.height / XADREZ.linhas }
  }

  const destinos = (s) => {
    const { l } = geometria(s)
    return destinosDoCavalo(s.cel.c, s.cel.r).map((d) => ({ ...d, ...centroDaCelula(d.c, d.r, l) }))
  }

  const saltar = (s, c, d) => {
    const { l } = geometria(s)
    const de = { x: c.x, y: c.y }
    s.cel = { c: d.c, r: d.r }
    const para = centroDaCelula(d.c, d.r, l)
    c.x = para.x
    c.y = para.y
    c.invencivelMs = Math.max(c.invencivelMs, XADREZ.vooMs) // no ar ninguém acerta o cavalo
    c.posicionar()
    s.pronto = t + XADREZ.recargaMs
    s.voo = { de, para, t0: t }
    tocar(arena, 'cravar')
    particulas(arena, para.x, para.y + 6, { cor: 0xf0e2c4, quantidade: 4, velocidade: 50, vida: 300 })
  }

  const balasSimples = (pista) =>
    pista.balas.lista
      .filter((b) => !b.morta && !b.inofensiva)
      .map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, raio: b.tipo === 'circulo' ? b.raio : Math.max(b.largura ?? 0, b.altura ?? 0, b.comprimento ?? 0) / 2, aviso: b.aviso, idade: b.idade }))

  const desenharTabuleiro = (s, c, meu) => {
    const { l, w, h } = geometria(s)
    const g = s.g
    g.clear()
    for (let r = 0; r < XADREZ.linhas; r++) {
      for (let k = 0; k < XADREZ.colunas; k++) {
        g.fillStyle((k + r) % 2 ? ESCURA : CLARA, (k + r) % 2 ? 0.5 : 0.28).fillRect(l.left + k * w, l.top + r * h, w, h)
      }
    }
    g.lineStyle(1, 0xffffff, 0.12)
    for (let k = 1; k < XADREZ.colunas; k++) g.lineBetween(l.left + k * w, l.top, l.left + k * w, l.bottom)
    for (let r = 1; r < XADREZ.linhas; r++) g.lineBetween(l.left, l.top + r * h, l.right, l.top + r * h)
    if (!c) return
    const pronto = t >= s.pronto
    // os destinos do cavalo
    if (meu) {
      const lista = destinos(s)
      for (const d of lista) {
        const escolhido = s.sel && s.sel.c === d.c && s.sel.r === d.r
        const pisca = 0.55 + 0.25 * Math.sin(t / 130)
        g.fillStyle(COR, (escolhido ? 0.55 : 0.1) * (pronto ? 1 : 0.5)).fillRect(l.left + d.c * w + 1, l.top + d.r * h + 1, w - 2, h - 2)
        g.lineStyle(escolhido ? 3 : 1.5, escolhido ? 0xffffff : COR, (escolhido ? 1 : pisca) * (pronto ? 1 : 0.4)).strokeRect(l.left + d.c * w + 2, l.top + d.r * h + 2, w - 4, h - 4)
        g.fillStyle(escolhido ? 0xffffff : COR, (pronto ? 0.95 : 0.4)).fillCircle(d.x, d.y, escolhido ? 4.2 : 2.6)
      }
      // o L do pulo escolhido: duas casas e uma de lado
      if (s.sel) {
        const d = lista.find((o) => o.c === s.sel.c && o.r === s.sel.r)
        if (d) {
          const longoX = Math.abs(d.dc) === 2
          const meio = longoX ? { x: d.x, y: c.y } : { x: c.x, y: d.y }
          g.lineStyle(2, 0xffffff, 0.8)
          g.lineBetween(c.x, c.y, meio.x, meio.y)
          g.lineBetween(meio.x, meio.y, d.x, d.y)
        }
      }
    }
    // anel de recarga em volta do coração
    if (!pronto) {
      const k = 1 - (s.pronto - t) / XADREZ.recargaMs
      g.lineStyle(2.5, COR, 0.9)
      g.beginPath()
      g.arc(c.x, c.y, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, k))
      g.strokePath()
    }
    // o cavalinho em cima do coração (sobe e desce no pulo)
    const sobe = s.voo && t - s.voo.t0 < XADREZ.vooMs ? Math.sin(((t - s.voo.t0) / XADREZ.vooMs) * Math.PI) * 12 : 0
    const px = c.x
    const py = c.y - 13 - sobe
    const pts = CAVALO.map(([x, y]) => ({ x: px + x * 0.9, y: py + y * 0.9 }))
    g.fillStyle(0x000000, 0.35).fillEllipse(c.x, c.y + 8, 12, 4)
    g.fillStyle(0xfafafa, 1).fillPoints(pts, true)
    g.lineStyle(1.2, 0x2a2030, 1).strokePoints(pts, true)
    g.fillStyle(0x2a2030, 1).fillCircle(px + 1.6, py - 3.6, 0.9)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      lados = arena.pistas.map((pista) => {
        const l = pista.caixa.limites
        const c = pista.coracoes[0]
        const cel = celulaDoPonto(c?.ativo ? c.x : l.centerX, c?.ativo ? c.y : l.bottom, l)
        return { pista, g: ctx.naCaixa(pista, arena.add.graphics().setDepth(2.5)), cel, pronto: 0, voo: null, sel: null, cpuAlvo: null, cpuEm: 0, snap: false }
      })
      ctx.instrucao('CAVALO: PULE EM L!', { cor: '#fff0c0' })
    },

    // o direcional não anda: ele ESCOLHE o pulo. A CPU escolhe sozinha
    joy(j, joy) {
      if (!ativo) return joy
      const s = lados[j]
      const c = ctx.coracao(j)
      if (!s || !c || !ctx.ehMeu(j)) return joy
      const { l, w, h } = geometria(s)
      const lista = destinos(s)
      let entrada = joy
      if (ctx.dono(j) === arena.cpu) {
        if (t - s.cpuEm >= XADREZ.cpuDecideMs) {
          s.cpuEm = t
          s.cpuAlvo = ctx.pistaViva(j) ? escolherSaltoDaCpu(lista, { x: c.x, y: c.y }, balasSimples(s.pista)) : null
        }
        entrada = s.cpuAlvo ? { x: (s.cpuAlvo.dc * w) * 10, y: (s.cpuAlvo.dr * h) * 10 } : { x: 0, y: 0 }
      }
      s.sel = escolherSalto(lista, entrada, { w, h }, { centro: { x: l.centerX, y: l.centerY } })
      if (s.sel && t >= s.pronto) {
        const alvo = lista.find((d) => d.c === s.sel.c && d.r === s.sel.r)
        if (alvo) {
          saltar(s, c, alvo)
          s.cpuAlvo = null
        }
      }
      return { x: 0, y: 0 }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((s, j) => {
        const c = ctx.coracao(j)
        const meu = ctx.ehMeu(j)
        if (c && meu) {
          // o coração fica sempre no centro da casa (a caixa pode mudar de tamanho)
          const { l } = geometria(s)
          if (!s.snap) {
            s.snap = true
            s.cel = celulaDoPonto(c.x, c.y, l)
          }
          const p = centroDaCelula(s.cel.c, s.cel.r, l)
          c.x = p.x
          c.y = p.y
          const no = s.voo && t - s.voo.t0 < XADREZ.vooMs
          if (no) {
            const k = (t - s.voo.t0) / XADREZ.vooMs
            c.sprite.setPosition(s.voo.de.x + (p.x - s.voo.de.x) * k, s.voo.de.y + (p.y - s.voo.de.y) * k - Math.sin(k * Math.PI) * 12)
          } else c.posicionar()
        }
        desenharTabuleiro(s, c, meu)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), casas: lados.map((s) => ({ ...s.cel })), pronto: lados.map((s) => t >= s.pronto), escolha: lados.map((s) => (s.sel ? { c: s.sel.c, r: s.sel.r } : null)) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const s of lados) {
        const c = s.pista.coracoes[0]
        if (c?.ativo) c.ajustar()
      }
      lados = []
      ctx.limpar()
    },
  }
}
