// TABULEIRO REAL (Chaos King): o ataque das PEÇAS. A caixa do quadro vira um tabuleiro de xadrez e, a cada
// jogada, as peças piscam em vermelho as casas que vão golpear e só depois golpeiam (o aviso é o ícone da
// peça mais as casas piscando). O que cada peça golpeia e a justiça (sempre sobra um refúgio de 2 x 2
// casas ao alcance de cada coração) estão em kingTabuleiro.js (puro); aqui só se agenda e se desenha.
//
//   kingOnda({ duracao, jogadas, aviso, golpe, passo, intervalo, primeira, tabuleiro, caixa, protegidas,
//              aoIniciar })
//     jogadas    [[{ tipo, modo?, mirar?, promove? }]] a cada jogada sorteia uma lista de peças (que jogam juntas)
//     aviso      ms que as casas piscam antes do golpe (diminui um pouco com o ritmo)
//     intervalo  ms de calmaria entre uma jogada e a seguinte (diminui com a densidade)
//     tabuleiro  TABULEIRO (8 x 4) ou TABULEIRO_MINI (4 x 4, o Cavaleiro: use também `caixa`)
//     protegidas Set de casas onde nada cai (a gaiola do XEQUE, a casa da captura)
//     aoIniciar  (a, grade) => {}: gancho da regra do chefe (XEQUE, ROQUE: kingRegra.js); roda no 1º frame
import { definirAtaque } from '../../attacks/definir.js'
import { CORES, ATAQUE } from '../../constants.js'
import { tocar } from '../../audio.js'
import { criarGrade, retanguloDe, planejarJogada, mesclar, TABULEIRO, TEMPOS_PADRAO } from './kingTabuleiro.js'

const COR_CLARA = 0xd8c8ff
const iconeDe = (tipo) => `king-p-${tipo}`

// ---------- desenho ----------

// O tabuleiro: casas claras e escuras por baixo de tudo (some com o ataque)
export function desenharGrade(a, grade) {
  const g = a.cena.add.graphics().setDepth(3).setAlpha(0)
  for (let r = 0; r < grade.linhas; r++) {
    for (let c = 0; c < grade.colunas; c++) {
      const q = retanguloDe(grade, c, r)
      g.fillStyle(COR_CLARA, (c + r) % 2 ? 0.1 : 0.025)
      g.fillRect(q.x, q.y, q.largura, q.altura)
    }
  }
  g.lineStyle(1, COR_CLARA, 0.12)
  for (let c = 1; c < grade.colunas; c++) g.lineBetween(grade.left + c * grade.cw, grade.top, grade.left + c * grade.cw, grade.top + grade.height)
  for (let r = 1; r < grade.linhas; r++) g.lineBetween(grade.left, grade.top + r * grade.ch, grade.left + grade.width, grade.top + r * grade.ch)
  a.decoracao(g)
  a.cena.tweens.add({ targets: g, alpha: 1, duration: 280 })
  return g
}

// O ícone da peça numa casa (se a textura existe: nos testes não há)
export function criarIcone(a, grade, tipo, c, r, { escala = 0.74, alpha = 1 } = {}) {
  if (!a.cena.textures?.exists?.(iconeDe(tipo))) return null
  const q = retanguloDe(grade, c, r)
  const img = a.cena.add.image(q.cx, q.cy, iconeDe(tipo)).setDepth(4.6).setAlpha(0)
  const lado = Math.min(q.largura, q.altura) * escala
  img.setDisplaySize(lado * (img.width / img.height), lado)
  a.decoracao(img)
  a.cena.tweens.add({ targets: img, alpha, scaleX: img.scaleX, scaleY: img.scaleY, duration: 200, ease: 'Back.Out' })
  return img
}

export function apagarIcone(a, img) {
  if (!img?.scene) return
  a.cena.tweens.add({ targets: img, alpha: 0, duration: 160, onComplete: () => img.destroy?.() })
}

// Mostra as casas por `aviso` ms (pisca em vermelho) e golpeia: UMA barra por retângulo de casas. Os
// retângulos que cruzam o tabuleiro inteiro (a linha e a coluna da torre) entram na checagem da rota de fuga.
// Devolve { cancelar() }: some com o aviso e não golpeia (o XEQUE capturado)
export function golpearCasas(a, grade, casas, { aviso, golpe, aoGolpear = null }) {
  const folga = 3 // o golpe é um pouco menor que o aviso: encostar na borda da casa não pega
  const retangulos = mesclar(casas).map((m) => {
    const a0 = retanguloDe(grade, m.c0, m.r0)
    const a1 = retanguloDe(grade, m.c1, m.r1)
    return { x: a0.x, y: a0.y, largura: a1.x + a1.largura - a0.x, altura: a1.y + a1.altura - a0.y }
  })
  const faixasY = []
  const faixasX = []
  for (const q of retangulos) {
    if (q.largura >= grade.width - 1) faixasY.push([q.y, q.y + q.altura])
    if (q.altura >= grade.height - 1) faixasX.push([q.x, q.x + q.largura])
  }
  if (faixasY.length) a.parede({ eixo: 'y', ocupados: faixasY })
  if (faixasX.length) a.parede({ eixo: 'x', ocupados: faixasX })
  const avisos = []
  const zonas = []
  let cancelado = false
  retangulos.forEach((q, i) => {
    const antes = a.balas?.zonas?.length ?? 0
    const g = a.aviso({ tipo: 'area', x: q.x, y: q.y, largura: q.largura, altura: q.altura, ms: Math.max(aviso, ATAQUE.telegrafoMs), cor: CORES.aviso }, () => {
      if (cancelado) return
      if (i === 0) {
        tocar(a.cena, 'laser')
        a.tremer(120, 0.006)
        aoGolpear?.()
      }
      a.bala({
        x: q.x + q.largura / 2,
        y: q.y + q.altura / 2,
        largura: q.largura - folga * 2,
        altura: q.altura - folga * 2,
        forma: 'barra',
        vida: golpe,
        atravessa: true,
        jaAvisada: true,
        pulso: 0,
      })
    })
    avisos.push(g)
    zonas.push(...(a.balas?.zonas ?? []).slice(antes))
  })
  return {
    cancelar() {
      cancelado = true
      for (const z of zonas) z.cancelada = true
      for (const g of avisos) {
        a.cena.tweens.killTweensOf(g)
        g.destroy?.()
      }
    },
  }
}

// ---------- uma peça ----------

function executarPeca(a, grade, peca, tempos) {
  let icone = criarIcone(a, grade, peca.tipo, peca.c, peca.r)
  const aoGolpear = () => {
    if (icone?.scene) a.cena.tweens.add({ targets: icone, scaleX: icone.scaleX * 1.25, scaleY: icone.scaleY * 1.25, duration: 90, yoyo: true })
  }
  for (const e of peca.eventos) {
    a.depois(e.t, () => {
      if (e.tipo === 'golpe') golpearCasas(a, grade, e.casas, { aviso: e.aviso, golpe: tempos.golpe, aoGolpear })
      else if (e.tipo === 'mover' && icone?.scene) a.cena.tweens.add({ targets: icone, y: retanguloDe(grade, e.para.c, e.para.r).cy, duration: tempos.passo + 80, ease: 'Sine.InOut' })
      else if (e.tipo === 'promover') {
        const q = retanguloDe(grade, peca.c, grade.linhas - 1)
        apagarIcone(a, icone)
        tocar(a.cena, 'sino')
        const brilho = a.cena.add.circle(q.cx, q.cy, 8, 0xffd23c, 0.9).setDepth(4.8)
        a.decoracao(brilho)
        a.cena.tweens.add({ targets: brilho, scale: 5, alpha: 0, duration: 420 })
        icone = criarIcone(a, grade, 'rainha', peca.c, grade.linhas - 1, { escala: 0.9 })
      }
    })
  }
  a.depois(peca.duracao, () => apagarIcone(a, icone))
}

// ---------- a onda ----------

export const kingOnda = definirAtaque({
  nome: 'tabuleiro',
  padrao: {
    duracao: 7000,
    jogadas: [[{ tipo: 'torre' }]],
    aviso: TEMPOS_PADRAO.aviso,
    golpe: TEMPOS_PADRAO.golpe,
    passo: TEMPOS_PADRAO.passo,
    intervalo: 700,
    primeira: 500,
    tabuleiro: TABULEIRO,
    protegidas: null,
    aoIniciar: null,
    caixa: null,
  },
  iniciar(a, cfg) {
    const grade0 = criarGrade(a.caixa, cfg.tabuleiro)
    desenharGrade(a, grade0)
    // o aviso encurta um pouco com o ritmo (morte súbita, ♦), nunca abaixo de 560 ms
    const aviso = Math.max(560, Math.round(cfg.aviso / Math.sqrt(Math.max(1, a.ritmo.velocidade))))
    const tempos = { aviso, golpe: cfg.golpe, passo: cfg.passo }
    cfg.aoIniciar?.(a, grade0)
    if (!cfg.jogadas?.length) return

    // a jogada inteira (aviso, golpe) cabe antes do fim da onda? (conta as pausas de respiro que vêm)
    const cabe = (ms) => {
      let extra = 0
      const r = a.respiro
      if (r) {
        const rel = a.tempo - r.origem
        for (const [ini, fim] of r.pausas) if (fim > rel) extra += fim - Math.max(ini, rel)
      }
      return a.tempo + ms + extra <= a.fim
    }
    const alvosDe = (grade) =>
      a.coracoes
        .filter((c) => c.ativo)
        .map((c) => ({ x: c.x, y: c.y }))
        // quem está preso numa gaiola (casas protegidas) não é alvo: lá nada cai
        .filter((p) => {
          const { c, r } = { c: Math.floor((p.x - grade.left) / grade.cw), r: Math.floor((p.y - grade.top) / grade.ch) }
          return !cfg.protegidas?.has(`${c},${r}`)
        })

    const jogar = () => {
      const grade = criarGrade(a.caixa, cfg.tabuleiro)
      const jogada = a.escolher(cfg.jogadas)
      const plano = a.isolado(() =>
        planejarJogada({ grade, jogada, alvos: alvosDe(grade), protegidas: cfg.protegidas ?? new Set(), sorteio: () => a.aleatorio(0, 1), tempos, velocidade: a.velocidadeCoracao }),
      )
      if (!plano.pecas.length) return 0
      if (!cabe(plano.duracao)) return null
      for (const peca of plano.pecas) executarPeca(a, grade, peca, tempos)
      return plano.duracao
    }
    const agendar = (espera) =>
      a.depois(espera, () => {
        const duracao = jogar()
        if (duracao === null) return
        agendar(duracao + Math.max(250, cfg.intervalo / Math.max(1, a.ritmo.densidade)))
      })
    agendar(cfg.primeira)
  },
})
