import { tocar } from '../../../audio.js'
import { texturasPraiaCafe } from '../../../arte/praiaCafe.js'
import { CROISSANT, planejarCroissant, posicaoDoCroissant } from './planosPraiaCafe.js'
import { contextoDoEvento, pistaEncerrada } from './utilPraiaCafe.js'

// CROISSANTS VOADORES (arena CAFÉ FRANCÊS): a cozinha derrubou a bandeja e os croissants
// saem voando, cruzando a caixa de um lado ao outro ONDULANDO (seno). Cada um nasce fora
// da caixa e fica piscando CROISSANT.avisoMs com um "!" na borda; durante o aviso o
// trajeto inteiro aparece tracejado dentro da caixa (a mesma curva que a bala faz). A
// bala é redonda e o sprite dela é o próprio croissant, que gira ao voar.

const DANO = 4
const FORA = 34 // px fora da caixa onde nasce

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const entre = (a, b) => a + (b - a) * sorte()
  const ctx = contextoDoEvento(arena)
  let ativo = false
  let t = 0
  // por caixa: { pista, g, proximo, voos: [{ plano, bala, pista, x0, t0 }] }
  let lados = []

  const soltar = (v, j) => {
    const plano = planejarCroissant(sorte, v.pista.caixa.limites)
    const pista = ctx.pistaViva(j)
    if (!pista) return
    const l = pista.caixa.limites
    const x0 = plano.lado > 0 ? l.left - FORA : l.right + FORA
    const aviso = CROISSANT.avisoMs / aceleracao
    const inicio = posicaoDoCroissant(plano, x0, 0)
    const voo = { plano, pista, x0, t0: t, bala: null }
    voo.bala = pista.balas.criar({
      x: inicio.x,
      y: inicio.y,
      vx: plano.lado * CROISSANT.velocidade,
      raio: CROISSANT.raio,
      aviso,
      atravessa: true,
      dano: DANO,
      pulso: 0,
      girar: 5 * plano.lado,
      textura: 'cafe-croissant',
      tamanho: 28,
      origem: 'bonus-croissants',
      atualizar: (b) => {
        // a curva fechada no tempo: a bala anda exatamente por onde o aviso desenhou
        const p = posicaoDoCroissant(plano, x0, b.idade - b.aviso)
        b.x = p.x
        b.y = p.y
        b.inofensiva = pistaEncerrada(pista)
      },
    })
    v.voos.push(voo)
    if (t - (v.ultimoSom ?? -1e9) > 300) {
      v.ultimoSom = t
      tocar(arena, 'assobio')
    }
  }

  const desenhar = (v) => {
    const g = v.g
    g.clear()
    for (const voo of v.voos) {
      const b = voo.bala
      if (b.morta || b.idade >= b.aviso) continue
      const l = voo.pista.caixa.limites
      const k = b.idade / b.aviso
      const pisca = Math.sin(b.idade / 60) > 0 ? 1 : 0.5
      // o trajeto tracejado (só o trecho dentro da caixa) e uma sombra do croissant na entrada
      const duracao = ((l.width + 2 * FORA + 20) / CROISSANT.velocidade) * 1000
      g.lineStyle(2, 0xffd890, (0.35 + 0.4 * k) * pisca)
      let anterior = null
      for (let i = 0; i <= 28; i++) {
        const p = posicaoDoCroissant(voo.plano, voo.x0, (duracao * i) / 28)
        if (anterior && i % 2 === 0) g.lineBetween(anterior.x, anterior.y, p.x, p.y)
        anterior = p
      }
      const e = posicaoDoCroissant(voo.plano, voo.x0, 0)
      g.fillStyle(0xffd890, 0.25 * pisca)
      g.fillCircle(voo.plano.lado > 0 ? l.left + 10 : l.right - 10, e.y, 12)
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      texturasPraiaCafe(arena)
      lados = (arena.pistas ?? []).map((pista, j) => ({ pista, g: ctx.graficoDaCaixa(pista, 4), proximo: entre(CROISSANT.primeiro.min, CROISSANT.primeiro.max) + j * 300, voos: [] }))
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((v, j) => {
        v.proximo -= delta
        if (v.proximo <= 0) {
          v.proximo = entre(CROISSANT.intervaloMs.min, CROISSANT.intervaloMs.max) / aceleracao
          soltar(v, j)
        }
        v.voos = v.voos.filter((voo) => !voo.bala.morta)
        desenhar(v)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), voos: lados.map((v) => v.voos.map((voo) => ({ x: Math.round(voo.bala.x), y: Math.round(voo.bala.y), avisando: voo.bala.idade < voo.bala.aviso }))) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of lados) for (const voo of v.voos) voo.bala.morta = true
      lados = []
      ctx.limpar()
    },
  }
}
