import { tocar } from '../../../audio.js'
import { registrarZona } from '../../../attacks/zonas.js'
import { texturasPraiaCafe } from '../../../arte/praiaCafe.js'
import { CARANGUEJO, planejarCaranguejo, faseDoCaranguejo } from './planosPraiaCafe.js'
import { contextoDoEvento, pistaEncerrada } from './utilPraiaCafe.js'

// CARANGUEJOS (arena PRAIA): caranguejos entram pelos lados e andam DE LADO por uma
// fileira da caixa (de 58 a 80 px/s). De tempos em tempos um deles PARA, ergue e abre as
// pinças (aviso: anel que fecha no alcance da pinça, CARANGUEJO.abreMs) e BELISCA: por
// um instante a pinça alcança o anel todo. O corpo e a pinça são a mesma bala redonda
// (o raio cresce no beliscão); o sprite da bala é o próprio caranguejo.
// No máximo 2 por caixa ao mesmo tempo, em fileiras separadas.

const DANO = 4
const MAXIMO = 2
const ENTRADA = 62 // px fora da caixa onde ele nasce (a caminhada até entrar é o aviso)
const COR_AVISO = 0xff5a3a

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + (b - a) * sorte()
  const ctx = contextoDoEvento(arena)
  let ativo = false
  let t = 0
  // por caixa: { pista, g, proximo, caranguejos: [{ plano, bala, pista, fase }] }
  let lados = []

  const nascer = (v, j) => {
    const l0 = v.pista.caixa.limites
    // sorteia sempre (a semente anda igual nos dois PCs)
    const plano = planejarCaranguejo(sorte, l0, v.caranguejos.map((c) => c.bala.y))
    const pista = ctx.pistaViva(j)
    if (!pista || v.caranguejos.length >= MAXIMO) return
    const l = pista.caixa.limites
    const x0 = plano.lado > 0 ? l.left - ENTRADA : l.right + ENTRADA
    const bala = pista.balas.criar({
      x: x0,
      y: plano.y,
      vx: plano.lado * plano.vel,
      raio: CARANGUEJO.raioCorpo,
      dano: DANO,
      atravessa: true,
      pulso: 0,
      textura: 'praia-caranguejo',
      quadro: 'c0',
      tamanho: 28,
      origem: 'bonus-caranguejos',
    })
    const c = { plano, bala, pista, idade: 0, fase: 'anda', zonaDada: -1, somDado: -1 }
    v.caranguejos.push(c)
  }

  const passoDoCaranguejo = (c, dt, l) => {
    const b = c.bala
    if (b.morta) return
    c.idade += dt
    const f = faseDoCaranguejo(c.plano, c.idade)
    c.fase = f.fase
    // anda ou para (corpo)
    b.vx = f.fase === 'anda' ? c.plano.lado * c.plano.vel : 0
    b.inofensiva = pistaEncerrada(c.pista)
    // pinça: raio do corpo; no beliscão alcança o anel
    b.raio = f.fase === 'belisca' ? CARANGUEJO.raioPinca : CARANGUEJO.raioCorpo
    // quadro: andando bate as perninhas (alterna c0/c1 de leve), parado abre as pinças
    b.sprite.setFrame(f.fase === 'anda' ? 'c0' : 'c1')
    b.sprite.setY(b.y + (f.fase === 'anda' ? Math.sin(c.idade / 55) * 1.2 : 0))
    if (f.fase === 'abre' && c.zonaDada !== f.k) {
      c.zonaDada = f.k
      // a CPU enxerga o anel do beliscão
      registrarZona(c.pista.balas, { tipo: 'circulo', x: b.x, y: b.y, raio: CARANGUEJO.raioPinca }, { ms: CARANGUEJO.abreMs / aceleracao, dura: CARANGUEJO.beliscaMs + 80 })
      tocar(arena, 'cliquePlaca')
    }
    if (f.fase === 'belisca' && c.somDado !== f.k) {
      c.somDado = f.k
      tocar(arena, 'cliquePlaca')
    }
    // saiu pelo outro lado
    const passou = c.plano.lado > 0 ? b.x > l.right + ENTRADA : b.x < l.left - ENTRADA
    if (passou && c.idade > 600) b.morta = true
  }

  const desenhar = (v) => {
    const g = v.g
    g.clear()
    for (const c of v.caranguejos) {
      const b = c.bala
      if (b.morta) continue
      const f = faseDoCaranguejo(c.plano, c.idade)
      if (f.fase === 'abre') {
        // o anel do alcance da pinça fecha em cima do corpo; pisca perto do fim
        const pisca = Math.sin(c.idade / 55) > 0 ? 1 : 0.6
        g.fillStyle(COR_AVISO, (0.1 + 0.16 * f.p) * pisca)
        g.fillCircle(b.x, b.y, CARANGUEJO.raioPinca)
        g.lineStyle(2, 0xffd0b0, (0.5 + 0.4 * f.p) * pisca)
        g.strokeCircle(b.x, b.y, CARANGUEJO.raioPinca)
        g.lineStyle(2, COR_AVISO, 0.9)
        g.strokeCircle(b.x, b.y, CARANGUEJO.raioCorpo + (CARANGUEJO.raioPinca - CARANGUEJO.raioCorpo) * (1 - f.p))
      } else if (f.fase === 'belisca') {
        g.fillStyle(0xffe0c0, 0.35)
        g.fillCircle(b.x, b.y, CARANGUEJO.raioPinca)
        g.lineStyle(3, 0xffffff, 0.9)
        g.strokeCircle(b.x, b.y, CARANGUEJO.raioPinca)
      }
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      texturasPraiaCafe(arena)
      lados = (arena.pistas ?? []).map((pista, j) => ({ pista, g: ctx.graficoDaCaixa(pista, 4), proximo: entre(300, 700) + j * 350, caranguejos: [] }))
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((v, j) => {
        const l = v.pista.caixa.limites
        for (const c of v.caranguejos) passoDoCaranguejo(c, delta, l)
        v.caranguejos = v.caranguejos.filter((c) => !c.bala.morta)
        v.proximo -= delta
        if (v.proximo <= 0) {
          v.proximo = entre(CARANGUEJO.intervaloMs.min, CARANGUEJO.intervaloMs.max) / aceleracao
          nascer(v, j)
        }
        desenhar(v)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), caranguejos: lados.map((v) => v.caranguejos.map((c) => ({ x: Math.round(c.bala.x), y: Math.round(c.bala.y), fase: c.fase, raio: c.bala.raio }))) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of lados) for (const c of v.caranguejos) c.bala.morta = true
      lados = []
      ctx.limpar()
    },
  }
}
