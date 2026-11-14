import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { registrarZona } from '../../../attacks/zonas.js'
import { texturaViga, faixaListrada, rotulo } from './arteArenasNovas.js'
import { planoObra, OBRA, REF_CAIXA } from './planosArenas.js'

// OBRA (CIDADE GRANDE): o guindaste da obra balança vigas de aço sobre as caixas. O AVISO
// é uma coluna listrada de amarelo e preto no chão (a sombra da viga, piscando mais
// rápido perto da hora) com a viga pendurada no cabo, balançando, e o aviso "CUIDADO!".
// Aí o cabo solta: a viga despenca e bate (a coluna toda machuca, só por um instante) e
// fica deitada no chão por um tempo, sem machucar. É uma bala retangular normal (dano,
// graze, i-frames; a CPU enxerga a coluna pela zona avisada) que desce junto com a viga.
// O plano (planosArenas.js) é o mesmo nas duas caixas e sempre sobra um corredor livre.

const DANO = 6
const ALTURA_VIGA = 22
const FICA_MS = 1300 // a viga deitada some depois disto

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const vivos = new Set()
  let ativo = false
  let t = 0
  let plano = []
  let proxima = 0
  let vigas = [] // { pista, j, x, w, em, img, bala, bateu, fimEm }
  let gs = []
  let cuidado = []

  const guardar = (o) => {
    vivos.add(o)
    o.once?.('destroy', () => vivos.delete(o))
    return o
  }
  const pistaViva = (j) => {
    const p = arena.pistas?.[j]
    return p && p.atacando && !p.ataque.desarmado && !arena.ko?.[arena.donoDaPista?.(j) ?? j] ? p : null
  }

  const baixar = (onda) => {
    tocar(arena, 'ventoAviso')
    const aviso = OBRA.avisoMs / aceleracao
    arena.pistas.forEach((pista, j) => {
      if (!pistaViva(j)) return
      const l = pista.caixa.limites
      for (const v of onda.vigas) {
        const x = l.left + v.fx * l.width
        const img = guardar(arena.add.image(x, l.top + 16, texturaViga(arena)).setDepth(7).setDisplaySize(v.largura + 12, ALTURA_VIGA))
        pista.caixa.recortar(img)
        registrarZona(pista.balas, { tipo: 'area', x: x - v.largura / 2, y: l.top, largura: v.largura, altura: l.height }, { ms: aviso, dura: OBRA.quedaMs + 200 })
        vigas.push({ pista, j, x, w: v.largura, em: t + aviso, img, bala: null, bateu: false })
      }
    })
  }

  const poeira = (pista, x, y, w) => {
    for (let k = 0; k < 7; k++) {
      const px = x + (Math.random() - 0.5) * w
      const p = guardar(arena.add.circle(px, y - 2, 3 + Math.random() * 3, k % 3 ? 0xb8b0a0 : 0xffd060, 0.85).setDepth(8))
      pista.caixa.recortar(p)
      arena.tweens.add({ targets: p, x: px + (px - x) * 0.8, y: y - 10 - Math.random() * 16, alpha: 0, scale: 1.8, duration: 380 + Math.random() * 240, onComplete: () => p.destroy() })
    }
  }

  const atualizarViga = (v) => {
    const l = v.pista.caixa.limites
    const falta = v.em - t
    const topo = l.top + 16
    const chao = l.bottom - ALTURA_VIGA / 2 - 2
    const ocioso = !v.pista.atacando || v.pista.ataque?.desarmado
    if (falta > 0) {
      // pendurada no cabo, balançando mais perto da hora
      const bal = Math.sin(t / 110 + v.x) * (3 + 6 * (1 - falta / (OBRA.avisoMs / aceleracao)))
      v.img.setPosition(v.x + bal * 0.4, topo).setRotation(bal * 0.012)
      return
    }
    const idade = t - v.em
    if (!v.bala && !ocioso && idade < OBRA.quedaMs) {
      v.bala = v.pista.balas.criar({ x: v.x, y: topo, largura: v.w * 0.92, altura: ALTURA_VIGA + 8, jaAvisada: true, atravessa: true, dano: DANO, vida: OBRA.quedaMs + 120, pulso: 0, origem: 'bonus-obra' })
      v.bala.sprite.setVisible(false)
      tocar(arena, 'assobio')
    }
    const p = Math.min(1, idade / OBRA.quedaMs)
    const y = topo + (chao - topo) * p * p
    v.img.setPosition(v.x, y).setRotation(0)
    if (v.bala && !v.bala.morta) {
      v.bala.x = v.x
      v.bala.y = y
      v.bala.inofensiva = ocioso
    }
    if (p >= 1 && !v.bateu) {
      v.bateu = true
      v.fimEm = t + FICA_MS
      tocar(arena, 'cravar')
      shake(arena, 140, 0.004)
      poeira(v.pista, v.x, l.bottom - 4, v.w)
    }
    if (v.bateu && t > v.fimEm - 300) v.img.setAlpha(Math.max(0, (v.fimEm - t) / 300))
    if (v.bateu && (t >= v.fimEm || ocioso)) v.feito = true
  }

  const desenhar = () => {
    gs.forEach((g, j) => {
      const l = arena.pistas[j].caixa.limites
      g.clear()
      let alerta = false
      for (const v of vigas) {
        if (v.j !== j) continue
        const falta = v.em - t
        if (falta > 0) {
          alerta = true
          const pulso = 0.5 + 0.5 * Math.sin(t / (falta < 350 ? 38 : 80))
          faixaListrada(g, v.x - v.w / 2, l.top, v.w, l.height, { alpha: 0.12 + 0.2 * pulso, deslocamento: t * 0.03 })
          g.lineStyle(2, 0xf4c61a, 0.5 + 0.4 * pulso)
          g.strokeRect(v.x - v.w / 2, l.top, v.w, l.height)
          // cabo do guindaste
          g.lineStyle(2, 0x2a2e36, 0.95).lineBetween(v.x, l.top - 2, v.img.x, v.img.y - ALTURA_VIGA / 2)
        } else if (!v.bateu) {
          g.lineStyle(2, 0x2a2e36, 0.8).lineBetween(v.x, l.top - 2, v.x, v.img.y - ALTURA_VIGA / 2)
        }
      }
      cuidado[j]?.setVisible(alerta).setPosition(l.centerX, l.centerY).setAlpha(0.35 + 0.35 * (Math.sin(t / 90) > 0 ? 1 : 0))
    })
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoObra(sorte, REF_CAIXA)
      proxima = 0
      gs = arena.pistas.map((pista) => {
        const g = guardar(arena.add.graphics().setDepth(2))
        pista.caixa.recortar(g)
        return g
      })
      cuidado = arena.pistas.map((pista) => guardar(rotulo(arena, 0, 0, 'CUIDADO!', { cor: '#f4c61a', tamanho: 18, pista, profundidade: 9 }).setVisible(false)))
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      while (proxima < plano.length && t >= plano[proxima].em / aceleracao) baixar(plano[proxima++])
      for (const v of vigas) atualizarViga(v)
      for (const v of vigas.filter((x) => x.feito)) {
        if (v.bala) v.bala.morta = true
        v.img.destroy()
      }
      vigas = vigas.filter((v) => !v.feito)
      desenhar()
    },

    estadoDebug() {
      return { vigas: vigas.map((v) => ({ j: v.j, x: Math.round(v.x), largura: v.w, avisando: v.em > t, bateu: v.bateu })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of vigas) if (v.bala) v.bala.morta = true
      vigas = []
      gs = []
      cuidado = []
      for (const o of [...vivos]) {
        arena.tweens?.killTweensOf(o)
        o.destroy()
      }
      vivos.clear()
    },
  }
}
