import Phaser from 'phaser'
import { CORACAO } from '../../../constants.js'
import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { etiqueta, poeirinha, chaoDeAreia } from './arteColiseu.js'

// ARENA ENCOLHENDO: paliçadas de madeira com pontas de ferro entram pelas
// bordas das caixas, fecham devagar, seguram um tempo e abrem de novo. Cada
// fechada usa um molde (laterais, teto e chão, um canto, as quatro) e sempre
// sobra um miolo livre de pelo menos LIVRE_MIN px (o coração e as balas cabem).
// Antes de mexer, o aviso: a faixa que a parede vai ocupar pisca em vermelho
// com setas e "!" por ATENCAO_MS (e o ronco de pedra arrastando).
// As paredes NÃO machucam: só empurram. O coração passa a usar um retângulo
// interno como limite (coracao.caixa troca por { limites: interno } enquanto o
// evento roda: Heart.update/ajustar só leem caixa.limites); as balas continuam
// usando a caixa inteira (passam por cima das paredes).
// A CPU não enxerga as paredes: joy() a afasta delas quando encosta.
// terminar() devolve a caixa de verdade aos corações e apaga as paredes.

const ATENCAO_MS = 750 // aviso antes de fechar
const FECHA_MS = 1500
const SEGURA = { min: 1300, max: 2000 }
const ABRE_MS = 900
const PAUSA = { min: 500, max: 900 } // aberta, antes do próximo aviso
const PRIMEIRA_MS = 350
const LIVRE_MIN = { x: 84, y: 66 } // miolo mínimo (px) que nunca fecha
// moldes: quanto cada parede entra (fração da largura/altura da caixa)
const MOLDES = [
  { nome: 'lados', e: 0.24, d: 0.24, c: 0, b: 0 },
  { nome: 'teto', e: 0, d: 0, c: 0.22, b: 0.22 },
  { nome: 'tudo', e: 0.16, d: 0.16, c: 0.15, b: 0.15 },
  { nome: 'canto', e: 0.34, d: 0, c: 0.3, b: 0 },
  { nome: 'canto2', e: 0, d: 0.34, c: 0, b: 0.3 },
]
const MADEIRA = 0x7a4a24
const MADEIRA_ESCURA = 0x4a2a12
const MADEIRA_CLARA = 0xa86a36
const FERRO = 0xc8d0d8
const FERRO_ESCURO = 0x6a7078
const VERMELHO = 0xff3048

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + sorte() * (b - a)
  let ativo = false
  let chao = null // areia no chão das caixas
  let t = 0
  let fase = 'pausa' // pausa -> atencao -> fecha -> segura -> abre -> pausa
  let faseAte = 0
  let molde = null
  let ultimoMolde = -1
  // por pista: { pista, interno, proxy, g, aviso, atual: {e,d,c,b}, de, alvo }
  let lados = []
  let textos = []

  const zero = () => ({ e: 0, d: 0, c: 0, b: 0 })

  // insets em px do molde nesta caixa, respeitando o miolo mínimo
  const insetsDe = (m, l) => {
    const cabeX = Math.max(0, l.width - LIVRE_MIN.x)
    const cabeY = Math.max(0, l.height - LIVRE_MIN.y)
    const somaX = (m.e + m.d) * l.width
    const somaY = (m.c + m.b) * l.height
    const kx = somaX > cabeX ? cabeX / somaX : 1
    const ky = somaY > cabeY ? cabeY / somaY : 1
    return { e: m.e * l.width * kx, d: m.d * l.width * kx, c: m.c * l.height * ky, b: m.b * l.height * ky }
  }

  // o retângulo interno segue a caixa de verdade (ela pode mudar de forma no meio do ataque)
  const atualizarInterno = (s) => {
    const l = s.pista.caixa.limites
    const a = s.atual
    s.interno.setTo(l.left + a.e, l.top + a.c, Math.max(CORACAO.tamanho + 2, l.width - a.e - a.d), Math.max(CORACAO.tamanho + 2, l.height - a.c - a.b))
  }

  // ---------- visual ----------

  // paliçada: tábuas, cintas de ferro com rebites e pontas viradas para dentro
  const desenharParede = (g, x, y, w, h, lado) => {
    if (w < 1 || h < 1) return
    const vertical = lado === 'e' || lado === 'd'
    g.fillStyle(MADEIRA, 1).fillRect(x, y, w, h)
    g.fillStyle(MADEIRA_ESCURA, 1)
    if (vertical) for (let k = x + 7; k < x + w; k += 8) g.fillRect(k, y, 1, h)
    else for (let k = y + 7; k < y + h; k += 8) g.fillRect(x, k, w, 1)
    g.fillStyle(MADEIRA_CLARA, 1)
    if (vertical) for (let k = x + 1; k < x + w; k += 8) g.fillRect(k, y, 1, h)
    else for (let k = y + 1; k < y + h; k += 8) g.fillRect(x, k, w, 1)
    // cintas de ferro
    g.fillStyle(FERRO_ESCURO, 1)
    for (const f of [0.22, 0.78]) {
      if (vertical) g.fillRect(x, y + h * f - 2, w, 4)
      else g.fillRect(x + w * f - 2, y, 4, h)
    }
    g.fillStyle(FERRO, 1)
    for (const f of [0.22, 0.78]) {
      if (vertical) for (let k = x + 3; k < x + w - 1; k += 8) g.fillRect(k, y + h * f - 1, 2, 2)
      else for (let k = y + 3; k < y + h - 1; k += 8) g.fillRect(x + w * f - 1, k, 2, 2)
    }
    // pontas de ferro na borda de dentro
    const passo = 12
    const tam = 7
    if (vertical) {
      const bx = lado === 'e' ? x + w : x
      const s = lado === 'e' ? 1 : -1
      for (let k = y + 4; k < y + h - 4; k += passo) {
        g.fillStyle(FERRO_ESCURO, 1).fillTriangle(bx, k - 3, bx, k + 4, bx + s * tam, k + 0.5)
        g.fillStyle(FERRO, 1).fillTriangle(bx, k - 3, bx, k, bx + s * tam, k + 0.5)
      }
      g.fillStyle(MADEIRA_ESCURA, 1).fillRect(lado === 'e' ? bx - 2 : bx, y, 2, h)
    } else {
      const by = lado === 'c' ? y + h : y
      const s = lado === 'c' ? 1 : -1
      for (let k = x + 4; k < x + w - 4; k += passo) {
        g.fillStyle(FERRO_ESCURO, 1).fillTriangle(k - 3, by, k + 4, by, k + 0.5, by + s * tam)
        g.fillStyle(FERRO, 1).fillTriangle(k - 3, by, k, by, k + 0.5, by + s * tam)
      }
      g.fillStyle(MADEIRA_ESCURA, 1).fillRect(x, lado === 'c' ? by - 2 : by, w, 2)
    }
  }

  const desenhar = (s) => {
    const l = s.pista.caixa.limites
    const a = s.atual
    const g = s.g
    g.clear()
    // as paredes de cima/baixo ficam entre as laterais (cantos sem sobreposição estranha)
    desenharParede(g, l.left + a.e, l.top, l.width - a.e - a.d, a.c, 'c')
    desenharParede(g, l.left + a.e, l.bottom - a.b, l.width - a.e - a.d, a.b, 'b')
    desenharParede(g, l.left, l.top, a.e, l.height, 'e')
    desenharParede(g, l.right - a.d, l.top, a.d, l.height, 'd')

    // aviso: faixa vermelha piscando onde a parede vai chegar, com setas para dentro
    const v = s.aviso
    v.clear()
    if (fase !== 'atencao' || !s.alvo) return
    const pisca = Math.sin(t / 70) > 0 ? 0.42 : 0.18
    const al = s.alvo
    v.fillStyle(VERMELHO, pisca)
    if (al.e) v.fillRect(l.left, l.top, al.e, l.height)
    if (al.d) v.fillRect(l.right - al.d, l.top, al.d, l.height)
    if (al.c) v.fillRect(l.left + al.e, l.top, l.width - al.e - al.d, al.c)
    if (al.b) v.fillRect(l.left + al.e, l.bottom - al.b, l.width - al.e - al.d, al.b)
    v.lineStyle(2, VERMELHO, 0.9)
    const seta = (x, y, dx, dy) => {
      const px = -dy
      const py = dx
      v.lineBetween(x - dx * 5 + px * 5, y - dy * 5 + py * 5, x, y)
      v.lineBetween(x - dx * 5 - px * 5, y - dy * 5 - py * 5, x, y)
    }
    const anda = ((t / 12) % 10) - 5
    for (const f of [0.25, 0.5, 0.75]) {
      if (al.e) seta(l.left + al.e * 0.5 + anda, l.top + l.height * f, 1, 0)
      if (al.d) seta(l.right - al.d * 0.5 - anda, l.top + l.height * f, -1, 0)
      if (al.c) seta(l.left + al.e + (l.width - al.e - al.d) * f, l.top + al.c * 0.5 + anda, 0, 1)
      if (al.b) seta(l.left + al.e + (l.width - al.e - al.d) * f, l.bottom - al.b * 0.5 - anda, 0, -1)
    }
  }

  // ---------- ritmo ----------

  const irPara = (nova, ms) => {
    fase = nova
    faseAte = t + ms / aceleracao
  }

  const proximaFase = () => {
    if (fase === 'pausa') {
      let k
      do k = Math.floor(sorte() * MOLDES.length)
      while (k === ultimoMolde && MOLDES.length > 1)
      ultimoMolde = k
      molde = MOLDES[k]
      for (const s of lados) s.alvo = insetsDe(molde, s.pista.caixa.limites)
      tocar(arena, 'aviso')
      for (const s of lados) {
        const l = s.pista.caixa.limites
        const txt = etiqueta(arena, l.centerX, l.top - 12, 'AS PAREDES VÃO FECHAR!', { cor: '#ff7050', tamanho: 12 })
        textos.push(txt)
        arena.tweens.add({ targets: txt, alpha: 0, delay: ATENCAO_MS + 400, duration: 300, onComplete: () => txt.destroy() })
      }
      irPara('atencao', ATENCAO_MS)
    } else if (fase === 'atencao') {
      for (const s of lados) s.de = { ...s.atual }
      tocar(arena, 'muralha')
      shake(arena, 260, 0.003)
      irPara('fecha', FECHA_MS)
    } else if (fase === 'fecha') {
      irPara('segura', entre(SEGURA.min, SEGURA.max))
      tocar(arena, 'cravar')
      for (const s of lados) poeiraNasBordas(s)
    } else if (fase === 'segura') {
      for (const s of lados) {
        s.de = { ...s.atual }
        s.alvo = zero()
      }
      tocar(arena, 'muralha')
      irPara('abre', ABRE_MS)
    } else {
      irPara('pausa', entre(PAUSA.min, PAUSA.max))
    }
  }

  const poeiraNasBordas = (s) => {
    const l = s.pista.caixa.limites
    const a = s.atual
    if (a.e) for (const f of [0.2, 0.5, 0.8]) poeirinha(arena, s.pista, l.left + a.e + 4, l.top + l.height * f, { quantidade: 3 })
    if (a.d) for (const f of [0.2, 0.5, 0.8]) poeirinha(arena, s.pista, l.right - a.d - 4, l.top + l.height * f, { quantidade: 3 })
    if (a.c) for (const f of [0.3, 0.7]) poeirinha(arena, s.pista, l.left + l.width * f, l.top + a.c + 4, { quantidade: 3 })
    if (a.b) for (const f of [0.3, 0.7]) poeirinha(arena, s.pista, l.left + l.width * f, l.bottom - a.b - 4, { quantidade: 3 })
  }

  const mover = () => {
    if (fase !== 'fecha' && fase !== 'abre') return
    const total = (fase === 'fecha' ? FECHA_MS : ABRE_MS) / aceleracao
    const k = Phaser.Math.Clamp(1 - (faseAte - t) / total, 0, 1)
    const e = fase === 'fecha' ? k * k * (3 - 2 * k) : 1 - (1 - k) * (1 - k) // fecha suave; abre rápido no começo
    for (const s of lados) {
      for (const lado of ['e', 'd', 'c', 'b']) s.atual[lado] = s.de[lado] + (s.alvo[lado] - s.de[lado]) * e
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      chao = chaoDeAreia(arena)
      t = 0
      fase = 'pausa'
      faseAte = PRIMEIRA_MS
      lados = arena.pistas.map((pista) => {
        const interno = new Phaser.Geom.Rectangle(0, 0, 1, 1)
        const g = arena.add.graphics().setDepth(4) // por baixo das balas (5) e do coração
        const aviso = arena.add.graphics().setDepth(6)
        pista.caixa.recortar(g, aviso)
        const s = { pista, interno, proxy: { limites: interno }, g, aviso, atual: zero(), de: zero(), alvo: null }
        atualizarInterno(s)
        for (const c of pista.coracoes) c.caixa = s.proxy
        return s
      })
    },

    // CPU: encostou numa parede? sai de perto (ela não enxerga as paredes)
    joy(j, joy) {
      if (!ativo) return joy
      const s = lados[j]
      if (!s) return joy
      atualizarInterno(s) // antes do coração andar: o limite novo já vale neste frame
      const dono = arena.donoDaPista?.(j) ?? j
      if (dono !== arena.cpu) return joy
      const c = s.pista.coracoes[0]
      if (!c?.ativo) return joy
      const i = s.interno
      const perto = 14
      let { x, y } = joy
      if (c.x - i.left < perto) x = Math.max(x, 70)
      if (i.right - c.x < perto) x = Math.min(x, -70)
      if (c.y - i.top < perto) y = Math.max(y, 70)
      if (i.bottom - c.y < perto) y = Math.min(y, -70)
      return { x, y }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      chao.atualizar()
      if (t >= faseAte) proximaFase()
      mover()
      for (const s of lados) {
        atualizarInterno(s)
        for (const c of s.pista.coracoes) if (c.ativo) c.ajustar() // a parede empurra o coração
        desenhar(s)
      }
    },

    estadoDebug() {
      return { fase, molde: molde?.nome ?? null, paredes: lados.map((s) => ({ ...s.atual, livre: [Math.round(s.interno.width), Math.round(s.interno.height)] })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      chao?.destruir()
      chao = null
      for (const s of lados) {
        for (const c of s.pista.coracoes) {
          c.caixa = s.pista.caixa
          if (c.ativo) c.ajustar()
        }
        s.g.destroy()
        s.aviso.destroy()
      }
      lados = []
      textos.forEach((x) => x.scene && x.destroy())
      textos = []
    },
  }
}
