import { tocar } from '../../../audio.js'
import { shake } from '../../../effects/shake.js'
import { registrarZona } from '../../../attacks/zonas.js'
import { planoDragao, caminhoDoDragao, DRAGAO, REF_CAIXA } from './planosArenas.js'

// DRAGÃO (CHINATOWN): o dragão da festa SERPENTEIA pelas caixas, de um lado a outro, o
// corpo todo seguindo uma onda. Antes, o AVISO: um rugido e o caminho dele aparece no
// chão da caixa como um risco dourado ondulado (com uma faixa vermelha de leve e o "!"
// na borda de onde ele vem). O dragão é uma fila de balas redondas (cabeça + corpo +
// cauda: dano, graze e i-frames normais, a CPU enxerga) que seguem o caminho; cada pedaço
// nasce quando chega perto da caixa. O plano (planosArenas.js) é o mesmo nas duas caixas e
// a onda sempre deixa um corredor livre acima ou abaixo.

const DANO = 5
const COR_AVISO = 0xffc83a
const MARGEM_NASCER = 70 // o pedaço nasce a esta distância da borda (a bala fora da caixa não machuca)

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  let ativo = false
  let t = 0
  let plano = []
  let proxima = 0
  let dragoes = [] // { pista, j, p, x0, y0 (topo da caixa), em, pedacos: [{ bala|null }] }
  let gs = []

  const pistaViva = (j) => {
    const p = arena.pistas?.[j]
    return p && p.atacando && !p.ataque.desarmado && !arena.ko?.[arena.donoDaPista?.(j) ?? j] ? p : null
  }

  const raioDoPedaco = (k) => (k === 0 ? 12 : k > DRAGAO.segmentos - 3 ? 6.5 : 10)

  const lancar = (p) => {
    tocar(arena, 'rugido')
    shake(arena, 400, 0.002)
    arena.pistas.forEach((pista, j) => {
      if (!pistaViva(j)) return
      const l = pista.caixa.limites
      const aviso = DRAGAO.avisoMs / aceleracao
      const ref = { largura: l.width, altura: l.height }
      const centro = p.fy * l.height
      const faixaTopo = l.top + Math.max(0, centro - p.amp - 16)
      const faixaBaixo = l.top + Math.min(l.height, centro + p.amp + 16)
      const trecho = DRAGAO.segmentos * DRAGAO.espaco + l.width + 120
      registrarZona(pista.balas, { tipo: 'area', x: l.left, y: faixaTopo, largura: l.width, altura: faixaBaixo - faixaTopo }, { ms: aviso, dura: (trecho / DRAGAO.velocidade) * 1000 })
      dragoes.push({ pista, j, p, ref, em: t + aviso, pedacos: Array.from({ length: DRAGAO.segmentos }, () => null), visto: false })
    })
  }

  // posição (x relativo à borda esquerda da caixa) do pedaço k quando a cabeça está em `xc`
  const xDoPedaco = (d, xc, k) => xc - d.p.dir * k * DRAGAO.espaco

  const cabeca = (d) => {
    const l = d.pista.caixa.limites
    const andou = Math.max(0, t - d.em) * 0.001 * DRAGAO.velocidade
    return d.p.dir > 0 ? -40 + andou : l.width + 40 - andou
  }

  const atualizarDragao = (d) => {
    const l = d.pista.caixa.limites
    const xc = cabeca(d)
    const ocioso = !d.pista.atacando || d.pista.ataque?.desarmado
    let algum = false
    d.pedacos.forEach((bala, k) => {
      const xr = xDoPedaco(d, xc, k)
      const dentro = xr > -MARGEM_NASCER && xr < l.width + MARGEM_NASCER
      const x = l.left + xr
      const y = l.top + caminhoDoDragao(d.p, d.ref, xr)
      if (dentro) algum = true
      if (!bala && dentro && t >= d.em && !d.passou?.[k]) {
        d.pedacos[k] = d.pista.balas.criar({ x, y, raio: raioDoPedaco(k) * 0.9, jaAvisada: true, atravessa: true, dano: DANO, pulso: 0, origem: 'bonus-dragao' })
        d.pedacos[k].sprite.setVisible(false)
      } else if (bala && !bala.morta) {
        if (!dentro) {
          bala.morta = true
          ;(d.passou ??= [])[k] = true
        } else {
          bala.x = x
          bala.y = y
          bala.inofensiva = ocioso
        }
      }
    })
    d.feito = t > d.em && !algum && d.pedacos.every((b) => !b || b.morta)
    // fim do trajeto: a cauda saiu pelo outro lado
    if (t > d.em + 500 && (d.p.dir > 0 ? xDoPedaco(d, xc, DRAGAO.segmentos) > l.width + MARGEM_NASCER : xDoPedaco(d, xc, DRAGAO.segmentos) < -MARGEM_NASCER)) d.feito = true
  }

  const desenhar = () => {
    gs.forEach((g, j) => {
      g.clear()
      for (const d of dragoes) {
        if (d.j !== j) continue
        const l = d.pista.caixa.limites
        const falta = d.em - t
        if (falta > 0) {
          // o caminho: faixa de leve + risco dourado ondulado, pulsando perto da hora
          const pulso = 0.5 + 0.5 * Math.sin(t / (falta < 350 ? 40 : 90))
          g.fillStyle(0xff3a20, 0.03 + 0.05 * pulso)
          g.fillRect(l.left, l.top + Math.max(0, d.p.fy * l.height - d.p.amp - 16), l.width, Math.min(l.height, 2 * (d.p.amp + 16)))
          g.lineStyle(3, COR_AVISO, 0.4 + 0.4 * pulso)
          g.beginPath()
          for (let x = 0; x <= l.width; x += 4) {
            const y = l.top + caminhoDoDragao(d.p, d.ref, x)
            if (x === 0) g.moveTo(l.left + x, y)
            else g.lineTo(l.left + x, y)
          }
          g.strokePath()
          // pontinhas correndo no sentido do dragão
          g.fillStyle(0xffffff, 0.8)
          for (let s = (t * 0.12) % 26; s < l.width; s += 26) {
            const x = d.p.dir > 0 ? s : l.width - s
            g.fillCircle(l.left + x, l.top + caminhoDoDragao(d.p, d.ref, x), 2)
          }
          continue
        }
        desenharCorpo(g, d, l)
      }
    })
  }

  // o dragão chinês: cauda fina, corpo vermelho com barriga dourada, cabeça com chifres e bigodes
  const desenharCorpo = (g, d, l) => {
    const xc = cabeca(d)
    const pontos = d.pedacos.map((_, k) => {
      const xr = xDoPedaco(d, xc, k)
      return { x: l.left + xr, y: l.top + caminhoDoDragao(d.p, d.ref, xr), r: raioDoPedaco(k) }
    })
    // o corpo contínuo: um traço grosso ligando os pedaços (cauda mais fina)
    for (let k = pontos.length - 1; k > 0; k--) {
      const q = pontos[k]
      const p = pontos[k - 1]
      g.lineStyle((q.r + p.r) + 1, k % 2 ? 0xb01418 : 0xc81c20, 1)
      g.lineBetween(q.x, q.y, p.x, p.y)
    }
    for (let k = pontos.length - 1; k >= 0; k--) {
      const q = pontos[k]
      if (q.x < l.left - 30 || q.x > l.right + 30) continue
      g.fillStyle(k % 2 ? 0xb01418 : 0xd42020, 1).fillCircle(q.x, q.y, q.r + 0.5)
      g.fillStyle(0xf0b428, 1).fillRect(q.x - q.r * 0.7, q.y + q.r * 0.35, q.r * 1.4, q.r * 0.4)
      g.fillStyle(0x30a850, 1).fillTriangle(q.x - 3, q.y - q.r, q.x + 3, q.y - q.r, q.x, q.y - q.r - 5) // espinho
      if (k === pontos.length - 1) {
        // a ponta da cauda com uma chama
        g.fillStyle(0xff8a20, 0.9).fillTriangle(q.x - d.p.dir * 14, q.y, q.x - d.p.dir * 2, q.y - 5, q.x - d.p.dir * 2, q.y + 5)
      }
    }
    // cabeça
    const h = pontos[0]
    const s = d.p.dir
    g.fillStyle(0xe42a24, 1).fillCircle(h.x, h.y, 13)
    g.fillStyle(0xe42a24, 1).fillRoundedRect(h.x + (s > 0 ? 4 : -24), h.y - 6, 20, 13, 5) // focinho
    g.fillStyle(0xffe8a0, 1).fillRect(h.x + (s > 0 ? 18 : -22), h.y + 2, 4, 3) // dente
    g.fillStyle(0xffffff, 1).fillCircle(h.x + s * 4, h.y - 5, 3.4)
    g.fillStyle(0x101010, 1).fillCircle(h.x + s * 5, h.y - 5, 1.7)
    g.fillStyle(0xf0c030, 1).fillTriangle(h.x - s * 2, h.y - 11, h.x - s * 9, h.y - 22, h.x + s * 3, h.y - 12) // chifre
    g.lineStyle(2, 0xf0c030, 0.9)
    const bal = Math.sin(t / 120) * 3
    g.lineBetween(h.x + s * 16, h.y + 4, h.x + s * 30, h.y + 12 + bal) // bigode
    g.lineBetween(h.x + s * 16, h.y + 2, h.x + s * 32, h.y - 2 + bal)
    g.fillStyle(0xff8a20, 0.9).fillCircle(h.x - s * 8, h.y - 4, 4) // juba
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoDragao(sorte, REF_CAIXA)
      proxima = 0
      gs = arena.pistas.map((pista) => {
        const g = arena.add.graphics().setDepth(6)
        pista.caixa.recortar(g)
        return g
      })
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      while (proxima < plano.length && t >= plano[proxima].em / aceleracao) lancar(plano[proxima++])
      for (const d of dragoes) atualizarDragao(d)
      for (const d of dragoes.filter((x) => x.feito)) d.pedacos.forEach((b) => b && (b.morta = true))
      dragoes = dragoes.filter((d) => !d.feito)
      desenhar()
    },

    estadoDebug() {
      return { dragoes: dragoes.map((d) => ({ j: d.j, cabecaX: Math.round(cabeca(d)), avisando: d.em > t, pedacos: d.pedacos.filter((b) => b && !b.morta).length })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const d of dragoes) d.pedacos.forEach((b) => b && (b.morta = true))
      dragoes = []
      for (const g of gs) g.destroy()
      gs = []
    },
  }
}
