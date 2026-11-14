import Phaser from 'phaser'
import { CORACAO } from '../../../../constants.js'
import { tocar } from '../../../../audio.js'
import { contextoDoCafe } from './util.js'
import { ACORDEAO, planejarFole, estadoDoFole, insetsEmPx } from './planos.js'

// ACORDEÃO: a caixa vira o fole de um acordeão tocando uma valsa (3 tempos). A cada compasso
// o fole recebe um ALVO novo (quanto cada lado fecha, nunca deixando menos que ACORDEAO.livreMin
// de largura): primeiro o alvo aparece tracejado, com setas e uma nota de aviso (ACORDEAO.avisoMs),
// depois o fole anda até lá (devagar o bastante para o coração correr mais que ele) e segura
// até o compasso seguinte. O fole só EMPURRA: o coração usa o miolo como limite
// (coracao.caixa vira { limites: interno } enquanto o evento roda; as balas continuam usando a
// caixa inteira, então um tiro pode acertar quem foi espremido: saia do lado que vai fechar).
// A CPU é afastada das paredes do fole no joy() (ela não enxerga o interno).
// terminar() devolve a caixa de verdade aos corações e apaga o fole.

const VERMELHO = 0xa8302a
const ESCURO = 0x5a1814
const OURO = 0xf0c860
const NOTAS = [262, 330, 392, 330]

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const ctx = contextoDoCafe(arena)
  let ativo = false
  let t = 0
  let plano = []
  let compassoVisto = -1
  let faseVista = ''
  // por pista: { pista, interno, proxy, g, aviso, e, d } (e, d = quanto cada lado entra, em px)
  let lados = []

  const insets = (s, estado) => {
    const l = s.pista.caixa.limites
    return { atual: insetsEmPx(estado, l.width), alvo: estado.aviso ? insetsEmPx(estado.aviso, l.width) : null }
  }

  const atualizarInterno = (s) => {
    const l = s.pista.caixa.limites
    s.interno.setTo(l.left + s.e, l.top, Math.max(CORACAO.tamanho + 2, l.width - s.e - s.d), l.height)
  }

  // lado do fole: tiras de pregas verticais claras e escuras, aro dourado na ponta de dentro
  const desenharFole = (g, x, w, l, deDentroParaFora) => {
    if (w < 1.5) return
    g.fillStyle(ESCURO, 1).fillRect(x, l.top, w, l.height)
    const prega = 9
    const n = Math.max(1, Math.round(w / prega))
    const pw = w / n
    for (let i = 0; i < n; i++) {
      const px = x + i * pw
      g.fillStyle(i % 2 ? VERMELHO : 0xc4443a, 1).fillRect(px, l.top, pw, l.height)
      g.fillStyle(0x000000, 0.22).fillRect(px + pw - 1.5, l.top, 1.5, l.height)
      g.fillStyle(0xffffff, 0.12).fillRect(px, l.top, 1.5, l.height)
    }
    const aro = deDentroParaFora ? x + w - 3 : x
    g.fillStyle(OURO, 1).fillRect(aro, l.top, 3, l.height)
    for (let y = l.top + 10; y < l.bottom - 4; y += 22) g.fillStyle(0xfff4c0, 1).fillCircle(aro + 1.5, y, 1.4)
  }

  const desenhar = (s, estado) => {
    const l = s.pista.caixa.limites
    const g = s.g
    g.clear()
    desenharFole(g, l.left, s.e, l, true)
    desenharFole(g, l.right - s.d, s.d, l, false)
    // aviso: a faixa que vai fechar pisca com setas e a linha do alvo é tracejada
    const v = s.aviso
    v.clear()
    const { alvo } = insets(s, estado)
    if (!alvo) return
    const k = estado.local / ACORDEAO.avisoMs
    const pisca = Math.sin(t / 70) > 0 ? 0.4 : 0.16
    const lado = (xa, xb, dir) => {
      if (Math.abs(xb - xa) < 2) return
      v.fillStyle(0xff3048, pisca).fillRect(Math.min(xa, xb), l.top, Math.abs(xb - xa), l.height)
      v.lineStyle(2, 0xffffff, 0.85)
      for (let y = l.top + 4; y < l.bottom; y += 14) v.lineBetween(xb, y, xb, y + 7)
      v.lineStyle(2, 0xff3048, 0.95)
      const anda = ((t / 14) % 10) - 5
      for (const f of [0.25, 0.5, 0.75]) {
        const x = (xa + xb) / 2 + dir * anda
        const y = l.top + l.height * f
        v.lineBetween(x - dir * 5, y - 5, x, y)
        v.lineBetween(x - dir * 5, y + 5, x, y)
      }
    }
    if (alvo.e > s.e + 2) lado(l.left + s.e, l.left + alvo.e, 1)
    if (alvo.d > s.d + 2) lado(l.right - s.d, l.right - alvo.d, -1)
    // as pontas que vão ABRIR também ficam avisadas (mais fracas)
    v.lineStyle(1, 0xffffff, 0.35 + 0.3 * k)
    if (alvo.e < s.e - 2) for (let y = l.top + 4; y < l.bottom; y += 14) v.lineBetween(l.left + alvo.e, y, l.left + alvo.e, y + 7)
    if (alvo.d < s.d - 2) for (let y = l.top + 4; y < l.bottom; y += 14) v.lineBetween(l.right - alvo.d, y, l.right - alvo.d, y + 7)
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      compassoVisto = -1
      faseVista = ''
      plano = planejarFole(sorte)
      lados = arena.pistas.map((pista) => {
        const interno = new Phaser.Geom.Rectangle(0, 0, 1, 1)
        const g = ctx.naCaixa(pista, arena.add.graphics().setDepth(4.5))
        const aviso = ctx.naCaixa(pista, arena.add.graphics().setDepth(6))
        const s = { pista, interno, proxy: { limites: interno }, g, aviso, e: 0, d: 0 }
        atualizarInterno(s)
        for (const c of pista.coracoes) c.caixa = s.proxy
        return s
      })
      ctx.instrucao('O FOLE EMPURRA: SIGA O AVISO!', { cor: '#ffd8c0' })
    },

    // CPU: encostou numa ponta do fole? sai de perto (ela não enxerga o miolo)
    joy(j, joy) {
      if (!ativo) return joy
      const s = lados[j]
      if (!s) return joy
      const estado = estadoDoFole(t, plano)
      const { atual } = insets(s, estado)
      s.e = atual.e
      s.d = atual.d
      atualizarInterno(s)
      if (ctx.dono(j) !== arena.cpu) return joy
      const c = s.pista.coracoes[0]
      if (!c?.ativo) return joy
      const i = s.interno
      let { x, y } = joy
      if (c.x - i.left < 14) x = Math.max(x, 70)
      if (i.right - c.x < 14) x = Math.min(x, -70)
      return { x, y }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta * aceleracao
      const estado = estadoDoFole(t, plano)
      if (estado.compasso !== compassoVisto) {
        compassoVisto = estado.compasso
        tocar(arena, 'karaoke', { freq: NOTAS[estado.compasso % NOTAS.length] })
      }
      if (estado.fase !== faseVista) {
        faseVista = estado.fase
        if (estado.fase === 'move') tocar(arena, 'batida', { forte: true })
      }
      for (const s of lados) {
        const { atual } = insets(s, estado)
        s.e = atual.e
        s.d = atual.d
        atualizarInterno(s)
        for (const c of s.pista.coracoes) if (c.ativo) c.ajustar() // o fole empurra o coração
        desenhar(s, estado)
      }
    },

    estadoDebug() {
      const estado = estadoDoFole(t, plano)
      return { fase: estado.fase, compasso: estado.compasso, fole: lados.map((s) => ({ e: Math.round(s.e), d: Math.round(s.d), livre: Math.round(s.interno.width) })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const s of lados) {
        for (const c of s.pista.coracoes) {
          c.caixa = s.pista.caixa
          if (c.ativo) c.ajustar()
        }
      }
      lados = []
      ctx.limpar()
    },
  }
}
