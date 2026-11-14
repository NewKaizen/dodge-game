import { tocar } from '../../../../audio.js'
import { ABACO, hastesDoAbaco, portoesDoAbaco, hasteMaisPerto, noPortao, novoAbaco, passoAbaco } from './planos.js'
import { dono, criarVivos, instrucao, calmo } from './comum.js'

// ÁBACO: a caixa vira um ábaco. O coração é uma conta e só anda nas HASTES horizontais (ABACO.hastes
// delas): o joystick anda para os lados normalmente, mas a posição vertical gruda na haste. Para
// trocar de haste é preciso passar por um PORTÃO (os postes marcados, ABACO.portoes): ali ↑/↓ leva
// a conta à haste vizinha num pulinho (ABACO.pulinhoMs). A CPU troca de haste em qualquer lugar
// (ela não enxerga os portões). Quem manda no Y é este evento: joy() zera o vertical e passo()
// põe o coração na haste. terminar() solta o coração (nada para desfazer além dos desenhos).

export default function criar(arena) {
  const vivos = criarVivos()
  let ativo = false
  let t = 0
  let estados = [] // por caixa: estado do ábaco
  let gs = []
  let brutos = [{ x: 0, y: 0 }, { x: 0, y: 0 }] // joystick de cada caixa antes do ábaco
  let contas = [] // contas decorativas (por haste, posições em fração)

  const hastesDe = (l) => hastesDoAbaco(l.top, l.bottom)
  const portoesDe = (l) => portoesDoAbaco(l.left, l.right)

  // ---------- desenho ----------

  const desenhar = (j) => {
    const g = gs[j]
    const pista = arena.pistas[j]
    const l = pista.caixa.limites
    const c = pista.coracoes[0]
    const hastes = hastesDe(l)
    const portoes = portoesDe(l)
    g.clear()
    const est = estados[j]
    // fundo de madeira escura entre as hastes
    g.fillStyle(0x2a1208, 0.55).fillRect(l.left, l.top, l.width, l.height)
    // moldura do ábaco
    g.lineStyle(6, 0x7a3a14, 1).strokeRect(l.left + 2, l.top + 2, l.width - 4, l.height - 4)
    g.lineStyle(1.5, 0xc8782c, 0.9).strokeRect(l.left + 5, l.top + 5, l.width - 10, l.height - 10)
    // hastes (varetas de bambu) com as contas
    hastes.forEach((y, k) => {
      const atual = est && k === est.haste
      g.lineStyle(5, 0x000000, 0.35).lineBetween(l.left + 6, y + 2, l.right - 6, y + 2)
      g.lineStyle(3, atual ? 0xf0c860 : 0xc89a4a, atual ? 1 : 0.8).lineBetween(l.left + 6, y, l.right - 6, y)
      g.lineStyle(1, 0xfff0b0, 0.5).lineBetween(l.left + 6, y - 1, l.right - 6, y - 1)
      for (const fx of contas[k] ?? []) {
        const x = l.left + 12 + fx * (l.width - 24)
        g.fillStyle(0x000000, 0.3).fillEllipse(x + 1, y + 2, 11, 8)
        g.fillStyle(k % 2 ? 0xc02020 : 0x2a8a5a, 0.85).fillEllipse(x, y, 11, 8)
        g.fillStyle(0xffffff, 0.35).fillEllipse(x - 2, y - 1.5, 4, 2.4)
      }
    })
    // portões: postes entre a primeira e a última haste, com cabeça dourada
    const topo = hastes[0] - 7
    const base = hastes[hastes.length - 1] + 7
    const piscaPortao = calmo() ? 0.6 : 0.5 + 0.4 * Math.sin(t / 240)
    portoes.forEach((x) => {
      const perto = c?.ativo && Math.abs(c.x - x) <= ABACO.meiaLargura
      g.fillStyle(0x000000, 0.28).fillRect(x - 2, topo + 2, 6, base - topo)
      g.fillStyle(perto ? 0xffe27a : 0x8a4a1a, 1).fillRect(x - 3, topo, 5, base - topo)
      g.fillStyle(0xfff0b0, perto ? 0.9 : 0.35).fillRect(x - 3, topo, 1.5, base - topo)
      g.fillStyle(0xe0a020, 1).fillCircle(x - 0.5, topo - 2, 3.4).fillCircle(x - 0.5, base + 2, 3.4)
      // a faixa do portão (onde dá para trocar de haste), bem leve
      g.fillStyle(0xffe27a, perto ? 0.16 : 0.05 * (1 + piscaPortao)).fillRect(x - ABACO.meiaLargura, topo, ABACO.meiaLargura * 2, base - topo)
    })
    // seta de troca quando o coração está num portão
    if (c?.ativo && est && noPortao(portoes, c.x)) {
      const y0 = hastes[est.haste]
      g.fillStyle(0xffffff, 0.8)
      if (est.haste > 0) g.fillTriangle(c.x - 4, y0 - 14, c.x + 4, y0 - 14, c.x, y0 - 20)
      if (est.haste < hastes.length - 1) g.fillTriangle(c.x - 4, y0 + 14, c.x + 4, y0 + 14, c.x, y0 + 20)
    }
    // rastro do pulinho
    if (c?.ativo && est?.pulo) {
      const a = hastes[est.pulo.de]
      const b = hastes[est.pulo.para]
      g.lineStyle(4, 0xffe27a, 0.45).lineBetween(c.x, a, c.x, b)
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      estados = arena.pistas.map((pista) => {
        const hastes = hastesDe(pista.caixa.limites)
        const c = pista.coracoes[0]
        return novoAbaco(c?.ativo ? hasteMaisPerto(hastes, c.y) : Math.floor(hastes.length / 2))
      })
      // contas decorativas (ficam por baixo de tudo): sempre as mesmas
      contas = Array.from({ length: ABACO.hastes }, (_, k) => [0.12 + ((k * 0.37) % 0.2), 0.34 + ((k * 0.23) % 0.2), 0.72 + ((k * 0.31) % 0.18)])
      gs = arena.pistas.map((pista) => {
        const g = vivos.guardar(arena.add.graphics().setDepth(2))
        pista.caixa.recortar(g)
        return g
      })
      instrucao(arena, vivos, 'SÓ ANDA NAS HASTES!', { cor: '#ffe27a' })
    },

    // o vertical fica por conta do ábaco; o horizontal passa direto
    joy(j, joy) {
      if (!ativo) return joy
      brutos[j] = joy
      return { x: joy.x, y: 0 }
    },

    passo(j, delta) {
      if (!ativo) return delta
      const pista = arena.pistas[j]
      const c = pista.coracoes[0]
      if (!c?.ativo) return delta
      const l = pista.caixa.limites
      const hastes = hastesDe(l)
      const r = passoAbaco(estados[j], { joyY: brutos[j].y, noPortao: noPortao(portoesDe(l), c.x), livre: dono(arena, j) === arena.cpu, dt: delta, hastes })
      c.y = r.y
      c.posicionar()
      if (r.pulou) tocar(arena, 'tique')
      return delta
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      arena.pistas.forEach((_, j) => desenhar(j))
    },

    estadoDebug() {
      return { t: Math.round(t), hastes: estados.map((e) => e?.haste), pulando: estados.map((e) => Boolean(e?.pulo)) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      vivos.limpar(arena)
      estados = []
      gs = []
    },
  }
}
