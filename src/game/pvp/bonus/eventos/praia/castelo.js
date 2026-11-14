import { tocar } from '../../../../audio.js'
import { particulas } from '../../../../effects/particulas.js'
import { CASTELO, novaTrilha, deixarRastro, duro, blocoQueBloqueia, golpearBloco, podarTrilha } from './planos.js'
import { contexto, instrucao, calmo } from './util.js'

// CASTELO DE AREIA (PRAIA): o coração deixa uma trilha de blocos de areia molhada atrás de si. Cada
// bloco endurece em ~0,45 s e aí BLOQUEIA balas (a bala some, o bloco aguenta 2 batidas e desmorona).
// A trilha é curta (12 blocos, o mais velho cai primeiro) e dura ~5,5 s: dá para construir uma
// muralha e ficar atrás dela, mas ela se gasta. O coração atravessa a areia, ela nunca prende.
// A CPU também deixa trilha andando e se esconde atrás dela sem saber: o desvio dela já faz o resto.

const AREIA = { molhada: 0x8a6a3a, molhadaBorda: 0x5a4020, dura: 0xe8c878, clara: 0xf8e6a8, sombra: 0xb48a48 }

export default function criar(arena) {
  const ctx = contexto(arena)
  let ativo = false
  let t = 0
  // por caixa: { pista, g, trilha, golpes: [{ x, y, t }], poeira }
  let lados = []

  const bloco = (g, b, agora) => {
    const idade = agora - b.t
    const x = Math.round(b.x)
    const y = Math.round(b.y)
    if (!duro(b, agora)) {
      // molhado: escuro e translúcido, endurecendo (a borda clareia)
      const k = Math.min(1, idade / CASTELO.endureceMs)
      g.fillStyle(AREIA.molhada, 0.5 + 0.2 * k).fillRoundedRect(x - 7, y - 6, 14, 12, 3)
      g.lineStyle(1, AREIA.molhadaBorda, 0.8).strokeRoundedRect(x - 7, y - 6, 14, 12, 3)
      return
    }
    // duro: pedra de areia com ameia em cima; some piscando nos últimos 700 ms
    const resta = CASTELO.vidaMs - idade
    if (resta < 700 && !calmo() && Math.floor(resta / 90) % 2) return
    const rachou = b.vida < CASTELO.aguenta
    g.fillStyle(AREIA.sombra, 1).fillRoundedRect(x - 8, y - 5, 16, 12, 3)
    g.fillStyle(AREIA.dura, 1).fillRoundedRect(x - 8, y - 7, 16, 12, 3)
    g.fillStyle(AREIA.dura, 1).fillRect(x - 8, y - 11, 4, 5).fillRect(x - 2, y - 11, 4, 5).fillRect(x + 4, y - 11, 4, 5)
    g.fillStyle(AREIA.clara, 0.9).fillRect(x - 6, y - 6, 12, 2)
    g.lineStyle(1, 0x7a5a28, 0.9).strokeRoundedRect(x - 8, y - 7, 16, 12, 3)
    if (rachou) g.lineStyle(1, 0x5a3e18, 1).lineBetween(x - 2, y - 7, x + 1, y - 2).lineBetween(x + 1, y - 2, x - 1, y + 4)
  }

  const desenhar = (v) => {
    const g = v.g
    g.clear()
    for (const b of v.trilha.blocos) bloco(g, b, t)
    // poeirinha de cada bala que bateu
    for (const p of v.golpes) {
      const k = (t - p.t) / 260
      g.fillStyle(0xf8e6a8, 0.8 * (1 - k))
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26 + p.fase
        g.fillRect(Math.round(p.x + Math.cos(a) * (3 + 10 * k)), Math.round(p.y + Math.sin(a) * (3 + 10 * k) - 6 * k), 2, 2)
      }
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      instrucao(arena, ctx, 'SUA TRILHA VIRA MURO!', '#f8e6a8')
      tocar(arena, 'areia')
      lados = arena.pistas.map((pista) => ({ pista, g: ctx.grafico(pista, 3), trilha: novaTrilha(), golpes: [] }))
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      lados.forEach((v, j) => {
        const pista = ctx.pistaViva(j)
        const c = ctx.coracao(j)
        if (pista && c) deixarRastro(v.trilha, c.x, c.y + 3, t)
        if (pista) {
          for (const b of v.pista.balas.lista) {
            if (b.morta || b.inofensiva || b.idade < b.aviso) continue
            const alvo = blocoQueBloqueia(v.trilha, t, (x, y) => v.pista.balas.folga(b, x, y))
            if (!alvo) continue
            b.morta = true
            v.golpes.push({ x: b.x, y: b.y, t, fase: b.x })
            if (golpearBloco(alvo)) {
              particulas(arena, alvo.x, alvo.y, { cor: 0xe8c878, quantidade: 6, velocidade: 60 })
              tocar(arena, 'cravar')
            }
          }
        }
        podarTrilha(v.trilha, t)
        v.golpes = v.golpes.filter((p) => t - p.t < 260)
        desenhar(v)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), blocos: lados.map((v) => v.trilha.blocos.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), duro: duro(b, t), vida: b.vida }))) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      lados = []
      ctx.limpar()
    },
  }
}
