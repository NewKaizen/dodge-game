import { LARGURA } from '../../../../constants.js'
import { tocar } from '../../../../audio.js'
import { particulas } from '../../../../effects/particulas.js'
import { ignorarNasCaixas } from '../../../../recorte.js'
import { LEAO, SETA_VETOR, planoLeao, lerSeta, novoLeitor, avancarSequencia } from './planos.js'
import { dono, pistaViva, escudar, criarVivos, instrucao, texto, bolha, calmo, limitar } from './comum.js'

// DANÇA DO LEÃO: o leão da festa mostra uma sequência de setas (3 ou 4), uma de cada vez (com
// tambor): é a hora de OLHAR. Depois é a sua vez: reproduza as setas mexendo o coração, na ordem
// (cada seta conta quando o direcional é segurado por um instante naquela direção; soltar entre
// duas iguais). Acertou a sequência toda: ESCUDO (i-frames locais) e o leão dança de alegria.
// Direção errada: a sequência recomeça (sem dano). Passou do tempo (LEAO.limiteMs): o leão muda.
// Os ataques continuam o tempo todo: espere uma folga para fazer as setas. Plano igual nas duas
// caixas; o progresso é de cada uma. A CPU "dança" sozinha depois de um tempinho.
// terminar() apaga o leão, as setas e o escudo.

const LEAO_POS = { x: LARGURA / 2, y: 206 }
const COR_SETA = { cima: 0xff6a5a, direita: 0xffd23a, baixo: 0x5ad8ff, esquerda: 0x8aff7a }

export default function criar(arena, { rng } = {}) {
  const sorte = rng ?? Math.random
  const vivos = criarVivos()
  let ativo = false
  let t = 0
  let plano = []
  let gp = null // painéis das setas e o leão (tela)
  let gb = [] // escudo dentro de cada caixa
  let lados = [] // estado de cada caixa
  let boca = 0 // 0..1 boca do leão aberta
  let alegria = 0 // ms de comemoração do leão
  let rotulos = []

  const novoLado = () => ({ seq: 0, fase: 'pausa', t0: 0, est: { indice: 0 }, leitor: novoLeitor(), flash: null, escudoAte: 0, demoBeat: -1, cpuEm: 0, certas: 0, espera: LEAO.primeiroMs })
  const sequencia = (L) => plano[L.seq % plano.length]

  // ---------- desenho ----------

  const seta = (g, x, y, dir, tam, cor, alpha = 1, contorno = true) => {
    const v = SETA_VETOR[dir]
    const px = -v.y
    const py = v.x
    const P = (a, b) => ({ x: x + v.x * a * tam + px * b * tam, y: y + v.y * a * tam + py * b * tam })
    const pts = [P(1, 0), P(0.1, 0.95), P(0.1, 0.38), P(-0.95, 0.38), P(-0.95, -0.38), P(0.1, -0.38), P(0.1, -0.95)]
    if (contorno) g.fillStyle(0x000000, 0.7 * alpha).fillPoints(pts.map((p) => ({ x: x + (p.x - x) * 1.28, y: y + (p.y - y) * 1.28 })), true)
    g.fillStyle(cor, alpha).fillPoints(pts, true)
  }

  const desenharLeao = () => {
    const g = gp
    const { x, y } = LEAO_POS
    const festa = alegria > 0
    const pulo = calmo() ? 0 : Math.sin(t / (festa ? 90 : 210)) * (festa ? 7 : 3)
    const cy = y + pulo
    const inclina = calmo() ? 0 : Math.sin(t / (festa ? 140 : 380)) * 0.12
    // sombra
    g.fillStyle(0x000000, 0.3).fillEllipse(x, y + 52, 74, 12)
    // juba de tiras vermelhas e brancas em volta
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + inclina
      const r0 = 33
      const r1 = 47 + (k % 2) * 5 + (calmo() ? 0 : Math.sin(t / 160 + k) * 2)
      g.lineStyle(7, k % 2 ? 0xf8f0e0 : 0xd8262a, 1).lineBetween(x + Math.cos(a) * r0, cy + Math.sin(a) * r0, x + Math.cos(a) * r1, cy + Math.sin(a) * r1)
    }
    // cabeça
    g.fillStyle(0x000000, 0.35).fillCircle(x + 2, cy + 3, 35)
    g.fillStyle(0xd8262a, 1).fillCircle(x, cy, 34)
    g.lineStyle(3, 0xf0c040, 1).strokeCircle(x, cy, 34)
    // testa dourada e chifre
    g.fillStyle(0xf0c040, 1).fillTriangle(x - 7, cy - 28, x + 7, cy - 28, x, cy - 46)
    g.fillStyle(0xfff0b0, 0.9).fillCircle(x, cy - 24, 4)
    // olhos grandes
    for (const lado of [-1, 1]) {
      const ex = x + lado * 14
      g.fillStyle(0xffffff, 1).fillCircle(ex, cy - 8, 10)
      g.lineStyle(2, 0x401010, 1).strokeCircle(ex, cy - 8, 10)
      if (festa) g.lineStyle(3, 0x201010, 1).beginPath().arc(ex, cy - 6, 6, Math.PI, 0).strokePath()
      else g.fillStyle(0x101010, 1).fillCircle(ex + (calmo() ? 0 : Math.sin(t / 700) * 2.5), cy - 7, 4.6)
      g.fillStyle(0xf0c040, 1).fillRect(ex - 9, cy - 22, 18, 3) // sobrancelha dourada
    }
    // focinho e boca
    g.fillStyle(0xf8f0e0, 1).fillEllipse(x, cy + 13, 36, 20)
    g.fillStyle(0x6a1010, 1).fillEllipse(x, cy + 15 + boca * 3, 24, 6 + boca * 14)
    g.fillStyle(0xffffff, 1).fillTriangle(x - 8, cy + 13, x - 4, cy + 13, x - 6, cy + 19).fillTriangle(x + 4, cy + 13, x + 8, cy + 13, x + 6, cy + 19)
    g.fillStyle(0xff8a4a, 1).fillCircle(x, cy + 8, 3) // nariz
    // barba de tiras
    for (let k = -4; k <= 4; k++) g.lineStyle(3, 0xf8f0e0, 0.95).lineBetween(x + k * 6, cy + 24, x + k * 7, cy + 36 + (calmo() ? 0 : Math.sin(t / 150 + k) * 2))
  }

  const painel = (j) => {
    const g = gp
    const L = lados[j]
    const pista = arena.pistas[j]
    const l = pista.caixa.limites
    const seq = sequencia(L)
    const n = seq.length
    const passo = 27
    const x0 = l.centerX - ((n - 1) * passo) / 2
    const y = l.top - 15
    g.fillStyle(0x000000, 0.55).fillRoundedRect(x0 - 20, y - 14, (n - 1) * passo + 40, 28, 8)
    g.lineStyle(2, 0xf0c040, 0.8).strokeRoundedRect(x0 - 20, y - 14, (n - 1) * passo + 40, 28, 8)
    const flashErro = L.flash?.tipo === 'erro' && t - L.flash.t < 360
    seq.forEach((dir, k) => {
      const x = x0 + k * passo
      let cor = 0x6a5a30
      let escala = 8
      let alpha = 0.7
      if (L.fase === 'demo') {
        const beat = Math.floor((t - L.t0) / LEAO.demoPorSetaMs)
        if (k === beat) {
          cor = COR_SETA[dir]
          escala = 10.5
          alpha = 1
        } else if (k < beat) cor = 0x9a8040
      } else if (L.fase === 'jogo' || L.fase === 'ok') {
        if (k < L.est.indice || L.fase === 'ok') {
          cor = 0x5aff8a
          alpha = 1
        } else if (k === L.est.indice) {
          cor = COR_SETA[dir]
          alpha = calmo() ? 1 : 0.65 + 0.35 * Math.sin(t / 110)
          escala = 9.5
        } else cor = 0xc8a850
        if (flashErro) cor = 0xff3a3a
      }
      seta(g, x, y, dir, escala, cor, alpha)
    })
    // tempo que resta
    if (L.fase === 'jogo') {
      const f = limitar(1 - (t - L.t0) / LEAO.limiteMs, 0, 1)
      g.fillStyle(0x000000, 0.6).fillRect(x0 - 16, y + 16, (n - 1) * passo + 32, 4)
      g.fillStyle(f < 0.25 ? 0xff5a4a : 0xf0c040, 1).fillRect(x0 - 16, y + 16, ((n - 1) * passo + 32) * f, 4)
    }
  }

  const rotulo = (j, conteudo, cor) => {
    const l = arena.pistas[j].caixa.limites
    const c = arena.pistas[j].coracoes[0]
    const tx = vivos.guardar(texto(arena, limitar(c?.x ?? l.centerX, l.left + 36, l.right - 36), Math.max(l.top + 22, (c?.y ?? l.centerY) - 24), conteudo, { cor, tamanho: 12, contorno: 4, pista: arena.pistas[j], profundidade: 12 }))
    arena.tweens.add({ targets: tx, y: tx.y - 14, alpha: 0, delay: 350, duration: 450, onComplete: () => tx.destroy() })
    rotulos.push(tx)
  }

  // ---------- regras ----------

  const comecarDemo = (L) => {
    L.fase = 'demo'
    L.t0 = t
    L.demoBeat = -1
    L.est.indice = 0
  }

  const acertou = (j) => {
    const L = lados[j]
    const c = arena.pistas[j].coracoes[0]
    L.fase = 'ok'
    L.t0 = t
    L.certas++
    if (c?.ativo) {
      escudar(c, LEAO.escudoMs)
      L.escudoAte = t + LEAO.escudoMs
      particulas(arena, c.x, c.y, { cor: 0x5aff8a, quantidade: 12, velocidade: 120, vida: 500 })
    }
    alegria = 900
    tocar(arena, 'escudo')
    rotulo(j, 'ESCUDO!', '#8aff9a')
  }

  const tocarSeta = (j, dir) => {
    const L = lados[j]
    const r = avancarSequencia(L.est, sequencia(L), dir)
    if (r.tipo === 'completou') acertou(j)
    else if (r.tipo === 'errou') {
      L.flash = { tipo: 'erro', t }
      tocar(arena, 'taque')
    } else tocar(arena, 'tique')
  }

  return {
    comecar() {
      if (ativo) return
      ativo = true
      t = 0
      plano = planoLeao(sorte)
      gp = vivos.guardar(arena.add.graphics().setDepth(94))
      ignorarNasCaixas(arena, gp)
      gb = arena.pistas.map((pista) => {
        const g = vivos.guardar(arena.add.graphics().setDepth(9))
        pista.caixa.recortar(g)
        return g
      })
      lados = arena.pistas.map(() => novoLado())
      instrucao(arena, vivos, 'REPITA AS SETAS DO LEÃO!', { cor: '#ffd23a' })
    },

    // as setas vêm do joystick de cada caixa (só quem desvia nela, nunca a CPU nem o espelho)
    passo(j, delta, joy) {
      if (!ativo) return delta
      const L = lados[j]
      if (L?.fase !== 'jogo' || dono(arena, j) === arena.cpu || arena.pistas[j].espelho || !pistaViva(arena, j)) return delta
      const dir = lerSeta(L.leitor, joy, delta)
      if (dir) tocarSeta(j, dir)
      return delta
    },

    atualizar(delta) {
      if (!ativo) return
      t += delta
      alegria = Math.max(0, alegria - delta)
      boca = limitar(boca - delta / 160, 0, 1)
      gp.clear()
      gb.forEach((g) => g.clear())
      lados.forEach((L, j) => {
        const pista = arena.pistas[j]
        const viva = pistaViva(arena, j)
        if (L.fase === 'pausa' && viva && t - L.t0 >= L.espera) comecarDemo(L)
        if (L.fase === 'demo') {
          const beat = Math.floor((t - L.t0) / LEAO.demoPorSetaMs)
          const seq = sequencia(L)
          if (beat !== L.demoBeat && beat < seq.length) {
            L.demoBeat = beat
            boca = 1
            tocar(arena, 'batida', { forte: beat === 0 })
          }
          if ((t - L.t0) / LEAO.demoPorSetaMs >= seq.length + 0.45) {
            L.fase = 'jogo'
            L.t0 = t
            L.est.indice = 0
            L.leitor = novoLeitor()
            L.cpuEm = t + 2400 + sorte() * 2600
          }
        } else if (L.fase === 'jogo') {
          if (dono(arena, j) === arena.cpu && t >= L.cpuEm && viva) acertou(j)
          else if (t - L.t0 >= LEAO.limiteMs) {
            L.fase = 'pausa'
            L.t0 = t
            L.espera = LEAO.pausaMs
            L.seq++
            rotulo(j, 'TEMPO!', '#ffb0a0')
          }
        } else if (L.fase === 'ok' && t - L.t0 >= LEAO.pausaMs) {
          L.fase = 'pausa'
          L.t0 = t
          L.espera = LEAO.pausaMs
          L.seq++
        }
        painel(j)
        const c = pista.coracoes[0]
        if (c?.ativo && t < L.escudoAte) bolha(gb[j], c.x, c.y, 15, 0x7aff9a, t, Math.min(1, (L.escudoAte - t) / 400))
      })
      desenharLeao()
    },

    // testes: a caixa j faz a seta `dir` (como se o jogador tivesse mexido o coração)
    forcarSeta(j, dir) {
      if (lados[j]?.fase === 'jogo') tocarSeta(j, dir)
    },

    estadoDebug() {
      return { t: Math.round(t), lados: lados.map((L) => ({ fase: L.fase, seq: L.seq, indice: L.est.indice, sequencia: sequencia(L), certas: L.certas })) }
    },

    terminar() {
      if (!ativo) return
      ativo = false
      vivos.limpar(arena)
      lados = []
      gb = []
      rotulos = []
      gp = null
    },
  }
}
