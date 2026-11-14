import { particulas } from '../../../../effects/particulas.js'
import { planoEntrega, pacoteEm, ENTREGA, fatorDoPlano } from './planos.js'
import { avisoNasCaixas, coracaoDe, darEnergia, ehCpu, ehEspelho, numero, pistaViva, texto, tocar } from './util.js'
import { folgaBala } from '../../../botEsquiva.js'

// ENTREGA (CIDADE GRANDE): um PACOTE aparece na caixa (anel fechando = aviso), você o PEGA encostando o
// coração nele e LEVA até o ponto marcado ("ENTREGA", seta e tracejado) para ganhar ENERGIA (+1; o
// EXPRESSO dourado, a cada 3º pacote, vale +2) - tudo isso desviando dos ataques normais. Perdeu o prazo,
// o pacote some, sem castigo. Cada caixa tem o seu pacote (o do seu coração): quem entrega ganha. A
// energia entra pelo mesmo caminho do graze (vale nos dois PCs em rede). A CPU também tenta quando não
// há bala perto (decide por pacote, com a semente).

const RAIO_PEGAR = 13
const RAIO_ENTREGAR = 15
const COR_TRACO = 0x7affc0

export default function criar(arena, { rng, aceleracao = 1 } = {}) {
  const sorte = rng ?? Math.random
  const fator = fatorDoPlano(aceleracao)
  let ativo = false
  let t = 0
  let plano = []
  let estados = [] // por pista: { idx, fase, carregadoEm, interessada }
  let visuais = [] // por pista: { pista, g, rotulo }
  let entregas = [0, 0]
  let avisos = []

  const ponto = (l, p) => ({ x: l.left + p.fx * l.width, y: l.top + p.fy * l.height })

  // pacote de papelão (centro x, y) com fita; o expresso é dourado com um raio
  const desenharPacote = (g, x, y, expresso, escala = 1) => {
    const w = 20 * escala
    const h = 16 * escala
    g.fillStyle(0x000000, 0.35).fillRect(x - w / 2 + 1, y - h / 2 + 2, w, h)
    g.fillStyle(expresso ? 0xffc83a : 0xb98852, 1).fillRect(x - w / 2, y - h / 2, w, h)
    g.fillStyle(expresso ? 0xffe9a0 : 0xd8b078, 1).fillRect(x - w / 2, y - h / 2, w, 3 * escala)
    g.fillStyle(expresso ? 0xff6a2a : 0xe8dcc0, 1).fillRect(x - 1.5 * escala, y - h / 2, 3 * escala, h)
    if (expresso) {
      g.fillStyle(0xffffff, 1).fillTriangle(x + 4, y - 6, x - 1, y + 1, x + 2, y + 1).fillTriangle(x - 3, y + 6, x + 2, y - 1, x - 1, y - 1)
    }
  }

  const desenharAlvo = (g, x, y, pulso) => {
    g.lineStyle(2, COR_TRACO, 0.5 + 0.5 * pulso).strokeCircle(x, y, 13 + pulso * 3)
    g.fillStyle(COR_TRACO, 0.18 + 0.12 * pulso).fillCircle(x, y, 13)
    // casinha: telhado e porta
    g.fillStyle(0xe8f0ff, 1).fillRect(x - 6, y - 2, 12, 9)
    g.fillStyle(0xd05a4a, 1).fillTriangle(x - 8, y - 2, x + 8, y - 2, x, y - 10)
    g.fillStyle(0x4a3a2a, 1).fillRect(x - 2, y + 2, 4, 5)
  }

  const novoPacote = (j, idx) => {
    estados[j] = { idx, fase: 'aviso', carregadoEm: 0, interessada: sorte() < 0.75 }
    if (idx >= 0) tocar(arena, 'aviso')
  }

  const perigoPerto = (pista, c) => pista.balas.lista.some((b) => !b.morta && !b.inofensiva && folgaBala(b, c.x, c.y) < 52)

  const atualizarPista = (j, v) => {
    const pista = v.pista
    const c = coracaoDe(arena, j)
    const l = pista.caixa.limites
    const p = pacoteEm(plano, t)
    const idx = p ? plano.indexOf(p) : -1
    if (!estados[j] || estados[j].idx !== idx) novoPacote(j, idx)
    const est = estados[j]
    const g = v.g
    g.clear()
    v.rotulo.setText('')
    if (!p || !pistaViva(arena, j) || !c?.ativo) return
    const o = ponto(l, p.origem)
    const d = ponto(l, p.destino)
    const pulso = 0.5 + 0.5 * Math.sin(t / 110)

    if (est.fase === 'aviso') {
      const k = Math.max(0, (p.valeEm - t) / ENTREGA.avisoMs) // 1 -> 0
      g.lineStyle(2, p.expresso ? 0xffc83a : 0xffffff, 0.9).strokeCircle(o.x, o.y, 8 + 26 * k)
      g.fillStyle(0xffffff, 0.12).fillCircle(o.x, o.y, 8)
      v.rotulo.setText(p.expresso ? 'EXPRESSO!' : 'PACOTE!').setPosition(o.x, o.y - 24).setColor(p.expresso ? '#ffc83a' : '#ffffff')
      if (t >= p.valeEm) est.fase = 'ativo'
    }
    if (est.fase === 'ativo') {
      const bob = Math.sin(t / 150) * 1.5
      g.lineStyle(1, 0xffffff, 0.35 + 0.35 * pulso).strokeCircle(o.x, o.y, RAIO_PEGAR + 2)
      desenharPacote(g, o.x, o.y + bob, p.expresso)
      v.rotulo.setText(p.expresso ? '+2' : '+1').setPosition(o.x, o.y - 17).setColor('#7fd8ff')
      if (Math.hypot(c.x - o.x, c.y - o.y) <= RAIO_PEGAR) {
        est.fase = 'carregando'
        est.carregadoEm = t
        tocar(arena, 'confirmar')
        particulas(arena, o.x, o.y, { cor: 0xffd070, quantidade: 6, velocidade: 80, vida: 300 })
      } else if (t >= p.fimEm - 400) est.fase = 'perdido'
    }
    if (est.fase === 'carregando') {
      // o pacote vai em cima do coração; o alvo e o tracejado mostram para onde levar
      desenharPacote(g, c.x, c.y - 15, p.expresso, 0.8)
      desenharAlvo(g, d.x, d.y, pulso)
      g.lineStyle(1, COR_TRACO, 0.5)
      const dist = Math.hypot(d.x - c.x, d.y - c.y)
      const n = Math.floor(dist / 9)
      for (let k = 1; k < n; k += 2) {
        const a = (k * 9) / dist
        const b = Math.min(1, ((k + 1) * 9) / dist)
        g.lineBetween(c.x + (d.x - c.x) * a, c.y + (d.y - c.y) * a, c.x + (d.x - c.x) * b, c.y + (d.y - c.y) * b)
      }
      v.rotulo.setText('ENTREGUE AQUI').setPosition(d.x, d.y - 20).setColor('#7affc0')
      if (Math.hypot(c.x - d.x, c.y - d.y) <= RAIO_ENTREGAR) {
        est.fase = 'entregue'
        entregas[j]++
        tocar(arena, 'energia')
        particulas(arena, d.x, d.y, { cor: 0x7affc0, quantidade: 12, velocidade: 110, vida: 450 })
        if (!ehEspelho(arena, j)) darEnergia(arena, j, p.energia)
        numero(arena, pista.caixa.limites.centerX, l.top + 26, `+${p.energia} ENERGIA`, '#7fd8ff', { tamanho: 14 })
      } else if (t >= p.fimEm - 50) est.fase = 'perdido'
    }
    if (est.fase === 'perdido' && t < p.fimEm) {
      v.rotulo.setText('PERDEU O PRAZO').setPosition(l.centerX, l.top + 20).setColor('#ff9a8a')
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoEntrega(sorte)
      estados = arena.pistas.map(() => null)
      entregas = [0, 0]
      visuais = arena.pistas.map((pista) => {
        const g = arena.add.graphics().setDepth(9)
        const rotulo = texto(arena, 0, 0, '', { cor: '#ffffff', tamanho: 9, pista, profundidade: 12, borda: 3 })
        pista.caixa.recortar(g)
        return { pista, g, rotulo }
      })
      avisos = avisoNasCaixas(arena, 'LEVE O PACOTE ATÉ O ALVO!', { cor: '#ffd070', ms: 1300, atraso: 100 })
    },

    // a CPU, sem bala por perto, vai atrás do pacote (e do alvo)
    joy(j, joy) {
      if (!ativo || !ehCpu(arena, j)) return joy
      const est = estados[j]
      const c = coracaoDe(arena, j)
      const p = pacoteEm(plano, t)
      if (!est || !p || !est.interessada || !c?.ativo || ehEspelho(arena, j)) return joy
      const pista = arena.pistas[j]
      if (est.fase !== 'ativo' && est.fase !== 'carregando') return joy
      if (perigoPerto(pista, c)) return joy
      const alvo = ponto(pista.caixa.limites, est.fase === 'ativo' ? p.origem : p.destino)
      const dx = alvo.x - c.x
      const dy = alvo.y - c.y
      const m = Math.hypot(dx, dy) || 1
      return { x: Math.round((dx / m) * 100), y: Math.round((dy / m) * 100) }
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta * fator
      visuais.forEach((v, j) => {
        if (!v.pista.destruida) atualizarPista(j, v)
      })
    },

    estadoDebug() {
      return { t: Math.round(t), entregas: [...entregas], fases: estados.map((e) => e?.fase ?? null), pacote: plano.findIndex((p) => t >= p.em && t < p.fimEm) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      for (const v of visuais) {
        v.g.destroy()
        v.rotulo.destroy()
      }
      visuais = []
      avisos.forEach((a) => a.scene && a.destroy())
      avisos = []
    },
  }
}
