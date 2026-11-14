import { tocar } from '../../../../audio.js'
import { shake } from '../../../../effects/shake.js'
import { registrarZona } from '../../../../attacks/zonas.js'
import { planoHashi, geometriaHashi, aberturaHashi, HASHI } from './planos.js'
import { CORES, pistaViva, criarVivos, instrucao, calmo, limitar, mix } from './comum.js'

// HASHI: dois pauzinhos gigantes vêm de um lado da caixa e tentam BELISCAR o coração como se ele
// fosse um bolinho (dumpling). Para cada beliscão (plano igual nas duas caixas; a mira é de cada
// coração):
//   MIRA   os hashis entram abertos e seguem o coração (inofensivos; um bolinho fantasma aparece nele)
//   AVISO  travam: a faixa do beliscão pisca e a linha onde as pontas vão se encontrar fica tracejada
//          (a CPU lê a faixa como zona de perigo); ainda inofensivos: dá para sair para qualquer lado
//   FECHA  as pontas se juntam e machucam; SEGURA um instante; SOLTA: voltam, inofensivos
// As varetas de verdade são balas-segmento invisíveis (sprite escondido); quem aparece são os
// pauzinhos desenhados por cima (madeira com a ponta vermelha).

const DANO = 5
const SEGUE = 9 // 1/s: o quanto a mira persegue o coração

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const vivos = criarVivos()
  let ativo = false
  let t = 0
  let plano = []
  let proximo = [0, 0]
  let gs = []
  let ondas = [] // { j, pista, lado, alcance, t0, mira: {x, y}, travada, varetas: [bala, bala], zona }

  // ---------- desenho ----------

  // um pauzinho: do cabo (largo) até a ponta (fina); a ponta é vermelha
  const pauzinho = (g, x1, y1, x2, y2, alpha = 1) => {
    const dx = x2 - x1
    const dy = y2 - y1
    const n = Math.hypot(dx, dy) || 1
    const ux = dx / n
    const uy = dy / n
    const px = -uy
    const py = ux
    const ponto = (k, lado, larg) => ({ x: x1 + dx * k + px * lado * larg, y: y1 + dy * k + py * lado * larg })
    const corpo = (k0, k1, w0, w1, cor, a = 1) => {
      g.fillStyle(cor, a * alpha)
      g.fillPoints([ponto(k0, -1, w0), ponto(k1, -1, w1), ponto(k1, 1, w1), ponto(k0, 1, w0)], true)
    }
    // sombra no chão
    g.fillStyle(0x000000, 0.22 * alpha)
    g.fillPoints([ponto(0, -1, 4.5), ponto(1, -1, 2.4), ponto(1, 1, 2.4), ponto(0, 1, 4.5)].map((p) => ({ x: p.x + 2, y: p.y + 3 })), true)
    corpo(0, 1, 4, 2.2, 0x6a3a14)
    corpo(0, 0.9, 3.2, 1.9, 0xd8a45c)
    corpo(0, 0.9, 1.4, 0.9, 0xf0cc88, 0.9) // brilho
    corpo(0.05, 0.16, 3.4, 3.1, CORES.vermelho) // anel vermelho no cabo
    corpo(0.82, 1, 2.0, 1.4, 0x2a1408) // ponta escura
  }

  // o bolinho fantasma (dumpling) em volta do coração: cresce durante o aviso
  const bolinho = (g, x, y, k, alpha) => {
    const r = 11 + 4 * k
    g.fillStyle(0xfff4e0, 0.28 * alpha).fillEllipse(x, y + 1, r * 2.2, r * 1.5)
    g.lineStyle(1.5, 0xfff4e0, 0.8 * alpha).strokeEllipse(x, y + 1, r * 2.2, r * 1.5)
    for (let p = -2; p <= 2; p++) g.lineBetween(x + p * r * 0.38, y - r * 0.7, x + p * r * 0.3, y - r * 0.15) // preguinhas da massa
  }

  const desenhar = (onda, idade) => {
    const g = gs[onda.j]
    const l = onda.pista.caixa.limites
    const c = onda.pista.coracoes[0]
    const mira = onda.travada ? onda.mira : onda.aim ?? { x: c?.x ?? l.centerX, y: c?.y ?? l.centerY }
    const entrada = limitar(idade / 300, 0, 1)
    // fase do ciclo
    const noAviso = idade >= HASHI.miraMs
    const { gap, letal } = noAviso ? aberturaHashi(idade - HASHI.miraMs) : { gap: HASHI.abertura * 1.8, letal: false }
    const abertura = noAviso ? gap : mix(HASHI.abertura * 3, gap, entrada)
    const geo = geometriaHashi(onda.lado, l, onda.travada ? onda.mira : mira, onda.alcance, abertura)
    onda.geo = geo
    const alphaSaida = onda.saida ? limitar(1 - (idade - onda.saida) / 200, 0, 1) : 1
    // sai de dentro da borda: o cabo já está fora da caixa; a ponta desliza para dentro
    const desliza = noAviso ? 1 : entrada
    const mostrar = geo.varetas.map((v) => {
      const k = 1 - (1 - desliza) * 0.75
      return { x1: v.x1, y1: v.y1, x2: mix(v.x1, v.x2, k), y2: mix(v.y1, v.y2, k) }
    })
    if (noAviso && idade - HASHI.miraMs < HASHI.avisoMs) {
      const falta = HASHI.avisoMs - (idade - HASHI.miraMs)
      const pisca = calmo() ? 0.7 : 0.45 + 0.5 * (Math.sin(idade / (falta < 350 ? 38 : 85)) * 0.5 + 0.5)
      const f = geo.faixa
      g.fillStyle(0xff3a2a, 0.12 + 0.12 * pisca).fillRect(f.x, f.y, f.largura, f.altura)
      g.lineStyle(2, 0xff5a3a, 0.5 + 0.4 * pisca).strokeRect(f.x, f.y, f.largura, f.altura)
      // a linha onde as pontas vão se encontrar (tracejada)
      g.lineStyle(2, 0xffe060, 0.6 + 0.4 * pisca)
      const horizontal = onda.lado === 'esquerda' || onda.lado === 'direita'
      for (let s = 0; s < (horizontal ? f.largura : f.altura); s += 12) {
        if (horizontal) g.lineBetween(f.x + s, geo.eixo, f.x + Math.min(f.largura, s + 7), geo.eixo)
        else g.lineBetween(geo.eixo, f.y + s, geo.eixo, f.y + Math.min(f.altura, s + 7))
      }
      // setinhas dizendo "vai fechar"
      const m = HASHI.abertura + 5
      const a = 0.7 * pisca
      g.lineStyle(2, 0xffffff, a)
      const px = horizontal ? f.x + f.largura - 8 : geo.eixo
      const py = horizontal ? geo.eixo : f.y + f.altura - 8
      if (horizontal) {
        g.lineBetween(px, py - m, px, py - m + 8).lineBetween(px, py + m, px, py + m - 8)
      } else {
        g.lineBetween(px - m, py, px - m + 8, py).lineBetween(px + m, py, px + m - 8, py)
      }
    }
    if (!onda.travada || idade < HASHI.miraMs + HASHI.avisoMs + 120) bolinho(g, mira.x, mira.y, noAviso ? limitar((idade - HASHI.miraMs) / HASHI.avisoMs, 0, 1) : 0, noAviso ? 1 : 0.55)
    // as varetas
    mostrar.forEach((v) => pauzinho(g, v.x1, v.y1, v.x2, v.y2, alphaSaida))
    // fechou: faíscas na ponta
    if (letal && idade - HASHI.miraMs - HASHI.avisoMs < HASHI.fechaMs + 90) {
      const v = geo.varetas[0]
      g.fillStyle(0xffffff, 0.9).fillCircle(v.x2, (v.y2 + geo.varetas[1].y2) / 2, 5)
    }
  }

  // ---------- varetas (colisão) ----------

  const prender = (onda) => {
    const l = onda.pista.caixa.limites
    onda.mira = { x: onda.aim.x, y: onda.aim.y }
    onda.travada = true
    const geo = geometriaHashi(onda.lado, l, onda.mira, onda.alcance, HASHI.abertura)
    onda.varetas = geo.varetas.map(() => {
      const b = onda.pista.balas.criar({ x: l.centerX, y: l.centerY, comprimento: 10, espessura: HASHI.espessura + 3, angulo: 0, jaAvisada: true, atravessa: true, dano: DANO, pulso: 0, origem: 'bonus-hashi' })
      b.sprite.setVisible(false)
      b.inofensiva = true
      return b
    })
    // a CPU lê a faixa (a bala nasce parada e inofensiva, o aviso é a faixa)
    const f = geo.faixa
    onda.zona = registrarZona(onda.pista.balas, { tipo: 'area', x: f.x, y: f.y, largura: f.largura, altura: f.altura }, { ms: HASHI.avisoMs / aceleracao, dura: HASHI.fechaMs + HASHI.seguraMs + 60 })
    tocar(arena, 'aviso')
  }

  const moverVaretas = (onda, idade) => {
    const l = onda.pista.caixa.limites
    const { gap, letal } = aberturaHashi(idade - HASHI.miraMs)
    const geo = geometriaHashi(onda.lado, l, onda.mira, onda.alcance, gap)
    geo.varetas.forEach((v, i) => {
      const b = onda.varetas[i]
      if (!b || b.morta) return
      b.x = (v.x1 + v.x2) / 2
      b.y = (v.y1 + v.y2) / 2
      b.comprimento = Math.hypot(v.x2 - v.x1, v.y2 - v.y1)
      b.angulo = Math.atan2(v.y2 - v.y1, v.x2 - v.x1)
      b.inofensiva = !letal
    })
  }

  const lancar = (p) => {
    arena.pistas.forEach((pista, j) => {
      if (!pistaViva(arena, j)) return
      ondas.push({ j, pista, lado: p.lado, alcance: p.alcance, t0: t, mira: null, travada: false, varetas: [], geo: null })
    })
  }

  const encerrar = (onda) => {
    onda.varetas.forEach((b) => b && (b.morta = true))
    onda.zona && (onda.zona.cancelada = true)
    onda.feito = true
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoHashi(sorte)
      proximo = 0
      ondas = []
      gs = arena.pistas.map((pista) => {
        const g = vivos.guardar(arena.add.graphics().setDepth(8))
        pista.caixa.recortar(g)
        return g
      })
      instrucao(arena, vivos, 'FUJA DO BELISCÃO!', { cor: '#ffcf70' })
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      while (proximo < plano.length && t >= plano[proximo].em / aceleracao) lancar(plano[proximo++])
      gs.forEach((g) => g.clear())
      for (const onda of ondas) {
        const idade = (t - onda.t0) * aceleracao
        const c = onda.pista.coracoes[0]
        if (!onda.pista.atacando || onda.pista.ataque?.desarmado || !c?.ativo) {
          encerrar(onda)
          continue
        }
        onda.aim ??= { x: c.x, y: c.y }
        if (!onda.travada) {
          const k = Math.min(1, (SEGUE * delta) / 1000)
          onda.aim.x += (c.x - onda.aim.x) * k
          onda.aim.y += (c.y - onda.aim.y) * k
        }
        if (!onda.travada && idade >= HASHI.miraMs) prender(onda)
        if (onda.travada) {
          moverVaretas(onda, idade)
          const fecha = HASHI.miraMs + HASHI.avisoMs
          if (!onda.bateu && idade >= fecha) {
            onda.bateu = true
            tocar(arena, 'estalo')
            shake(arena, 90, 0.002)
          }
        }
        if (idade >= HASHI.miraMs + HASHI.avisoMs + HASHI.fechaMs + HASHI.seguraMs + HASHI.soltaMs) {
          encerrar(onda)
          continue
        }
        if (idade >= HASHI.miraMs + HASHI.avisoMs + HASHI.fechaMs + HASHI.seguraMs && !onda.saida) onda.saida = idade
        desenhar(onda, idade)
      }
      ondas = ondas.filter((o) => !o.feito)
    },

    estadoDebug() {
      return { t: Math.round(t), ondas: ondas.map((o) => ({ j: o.j, lado: o.lado, travada: o.travada, fase: Math.round((t - o.t0) * aceleracao) })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      ondas.forEach(encerrar)
      ondas = []
      vivos.limpar(arena)
      gs = []
    },
  }
}
