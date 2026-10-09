import { tocar } from '../../../audio.js'
import { ignorarNasCaixas } from '../../../recorte.js'

// NO RITMO: o coração só anda NA BATIDA. A cada batida (BATIDA_MS) abre uma
// janela curta em que o direcional vale; entre uma batida e outra o coração
// fica parado no lugar (joy zerado, para a CPU também). Para ficar justo:
//   - o coração anda mais rápido dentro da janela (fatorCoracao × CORACAO_RAPIDO)
//     e as caixas inteiras andam um pouco mais devagar (passo × LENTO): no fim
//     das contas o coração percorre, em média, o mesmo que percorreria normal
//     em relação às balas;
//   - a batida é bem visível: um anel encolhe até o coração e "bate" quando a
//     janela abre (o coração brilha enquanto pode andar), a borda da caixa
//     pulsa, quatro luzinhas em cima da caixa contam o compasso, e cada
//     batida tem som de bumbo (acento no 1).
// terminar() devolve a velocidade do coração.

const BATIDA_MS = 60000 / 140 // ~429 ms
const JANELA = 0.5 // fração da batida em que o coração anda (começa NA batida)
const CORACAO_RAPIDO = 2 // multiplica a velocidade do coração durante o evento
const LENTO = 0.85 // relógio das caixas (balas e ataque um pouco mais lentos)
const ANEL = { de: 30, ate: 9 } // raio do anel que encolhe até a batida
const COR = 0xff4fa8
const CLARO = 0xffb0dc

export default function criar(arena) {
  let ativo = false
  let t = 0
  let batidaAnterior = -1
  let fatores = [] // fatorCoracao de cada pista antes do evento
  let visuais = [] // por pista: { pista, g (dentro da caixa), borda (tela), compasso (tela) }

  const fase = () => (t / BATIDA_MS) % 1 // 0 = batida agora
  const naJanela = () => fase() < JANELA

  const criarVisual = (pista) => {
    const g = arena.add.graphics().setDepth(9)
    pista.caixa.recortar(g)
    // halo da borda da caixa e o compasso em cima dela: objetos de tela, por baixo das cartas
    const borda = arena.add.graphics().setDepth(0.5)
    const compasso = arena.add.graphics().setDepth(19)
    ignorarNasCaixas(arena, borda, compasso)
    return { pista, g, borda, compasso, rastro: [] }
  }

  const desenhar = (v) => {
    const l = v.pista.caixa.limites
    const f = fase()
    const pancada = Math.pow(1 - f, 4) // 1 na batida e cai rápido
    const andando = naJanela()
    const numero = Math.floor(t / BATIDA_MS) % 4

    // halo pulsando em volta da caixa (por baixo da borda)
    v.borda.clear()
    v.borda.lineStyle(6, COR, 0.15 + 0.55 * pancada)
    v.borda.strokeRect(l.left - 4, l.top - 4, l.width + 8, l.height + 8)
    v.borda.lineStyle(2, CLARO, 0.5 * pancada)
    v.borda.strokeRect(l.left - 7, l.top - 7, l.width + 14, l.height + 14)

    // compasso: 4 luzinhas em cima da caixa (a da batida atual acesa)
    v.compasso.clear()
    for (let k = 0; k < 4; k++) {
      const x = l.centerX + (k - 1.5) * 16
      const y = l.top - 11
      const acesa = k === numero
      v.compasso.fillStyle(acesa ? CLARO : 0x3a1030, acesa ? 0.6 + 0.4 * pancada : 0.9)
      v.compasso.fillRect(x - 4, y - 3, 8, 6)
      v.compasso.lineStyle(1, COR, 0.9)
      v.compasso.strokeRect(x - 4, y - 3, 8, 6)
    }

    const g = v.g
    g.clear()
    const c = v.pista.coracoes[0]
    if (!c?.ativo) return
    // anel que encolhe até o coração: chega nele exatamente na batida
    const r = ANEL.ate + (ANEL.de - ANEL.ate) * f
    g.lineStyle(2, COR, 0.25 + 0.6 * f)
    g.strokeCircle(c.x, c.y, r)
    // na janela: o coração brilha (pode andar) e deixa um rastro
    if (andando) {
      const k = 1 - f / JANELA
      g.lineStyle(3, CLARO, 0.85 * k)
      g.strokeCircle(c.x, c.y, ANEL.ate + (1 - k) * 6)
      g.fillStyle(COR, 0.18 * k)
      g.fillCircle(c.x, c.y, ANEL.ate + 2)
    }
    v.rastro.push({ x: c.x, y: c.y, t })
    v.rastro = v.rastro.filter((p) => t - p.t < 220)
    for (const p of v.rastro) {
      const a = 1 - (t - p.t) / 220
      g.fillStyle(COR, 0.35 * a)
      g.fillCircle(p.x, p.y, 2 + 3 * a)
    }
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      batidaAnterior = -1
      fatores = arena.pistas.map((p) => p.fatorCoracao)
      arena.pistas.forEach((p) => (p.fatorCoracao *= CORACAO_RAPIDO))
      visuais = arena.pistas.map(criarVisual)
    },

    // entre as batidas o coração (de gente ou da CPU) fica parado
    joy(j, joy) {
      if (!ativo || naJanela()) return joy
      return { x: 0, y: 0 }
    },

    passo(j, delta) {
      return ativo ? delta * LENTO : delta
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      const batida = Math.floor(t / BATIDA_MS)
      if (batida !== batidaAnterior) {
        batidaAnterior = batida
        tocar(arena, 'batida', { forte: batida % 4 === 0 })
      }
      visuais.forEach(desenhar)
    },

    estadoDebug() {
      return { t: Math.round(t), janela: naJanela(), fatores: arena.pistas.map((p) => p.fatorCoracao) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      arena.pistas.forEach((p, j) => (p.fatorCoracao = fatores[j] ?? 1))
      for (const v of visuais) {
        v.g.destroy()
        v.borda.destroy()
        v.compasso.destroy()
      }
      visuais = []
    },
  }
}
