// O ANÚNCIO DESENHADO do alvo de cada um (todos contra todos e 2x2): no começo da rodada, em vez de uma caixa
// de texto ("ANA → BETO"), os personagens aparecem num círculo (FFA) ou frente a frente (2x2) e setas animadas
// mostram quem ataca quem; a minha seta e a que vem para mim ganham destaque. Lógica pura (sem Phaser), testada
// em __tests__/anuncioAlvos.test.js; quem desenha é pvp/AnuncioAlvos.js. É SÓ apresentação: o rodízio vem de
// estado.alvos (pvp/ffa.js e pvp/dupla.js) e nenhuma regra nem mensagem de rede muda.
//
//   posicoesDoAnuncio({ n, dupla, times })            -> [{ x, y }] por vaga (relativo ao centro do anúncio)
//   estadoDoNo({ eliminado, caido, fora, semAlvo })   -> 'eliminado' | 'caido' | 'semConexao' | 'semAlvo' | 'vivo'
//   ICONE_DO_ESTADO                                   estado -> 'x' | 'desconectado' | 'energia' | null
//   quemDestacar({ meu, inativos, seguindo })         a vaga enfatizada (eu, ou quem o espectador segue)
//   modeloDoAnuncio({ n, dupla, times, alvos, estados, meu, destaque })
//        -> { nos, setas, elo }   nos[j] = { vaga, x, y, estado, icone, voce, destaque, time }
//                                 setas = [{ de, para, tipo: 'minha' | 'contraMim' | 'fraca', ordem }] (na ordem de desenho)
//                                 elo = [destaque, parceiro] (2x2) ou null
//   curvaDaSeta(p0, p1, { raio })  e  pontoNaCurva(curva, t) / tangenteNaCurva(curva, t)
//   linhaDoTempo(nSetas, { reduzir }) e quadroDoAnuncio(linha, t, { pular }) -> { sprites, setas[], pulso, fim }

import { CENTRO_X } from '../constants.js'

export const ANUNCIO = {
  ms: 1200, // o anúncio inteiro (depois dele o desenho fica pequeno no meio, lembrando os alvos)
  msReduzido: 800, // "reduzir animações": tudo de uma vez, parado, por este tempo
  entrada: 160, // os personagens aparecem
  passo: 130, // entre uma seta e a seguinte (~120-150 ms)
  desenho: 240, // quanto cada seta leva para viajar até o alvo
  periodoPulso: 480,
  centro: { x: CENTRO_X, y: 214 },
  raioNo: 32, // o anel de cor de cada personagem
  rx: 150,
  ry: 78,
  mini: { x: CENTRO_X, y: 262, escala: 0.62 },
}

// Posição de cada vaga, relativa ao centro. FFA: elipse com a vaga 0 em cima, no sentido horário (4: cima,
// direita, baixo, esquerda; 3: triângulo). 2x2: o time A à esquerda e o B à direita, dois de cada lado.
export function posicoesDoAnuncio({ n, dupla = false, times = [] } = {}) {
  if (dupla) {
    const dentro = [0, 0]
    return Array.from({ length: n }, (_, j) => {
      const t = times[j] === 1 ? 1 : 0
      const i = dentro[t]++
      return { x: (t === 0 ? -1 : 1) * ANUNCIO.rx, y: (i === 0 ? -1 : 1) * 62 }
    })
  }
  return Array.from({ length: n }, (_, j) => {
    const a = -Math.PI / 2 + (2 * Math.PI * j) / n
    return { x: Math.round(Math.cos(a) * ANUNCIO.rx * 1000) / 1000, y: Math.round(Math.sin(a) * ANUNCIO.ry * 1000) / 1000 }
  })
}

// o estado do personagem no anúncio (o mais forte vale)
export function estadoDoNo({ eliminado = false, caido = false, fora = false, semAlvo = false } = {}) {
  if (eliminado) return 'eliminado'
  if (caido) return 'caido'
  if (fora) return 'semConexao'
  if (semAlvo) return 'semAlvo'
  return 'vivo'
}
export const ICONE_DO_ESTADO = { eliminado: 'x', caido: 'x', semConexao: 'desconectado', semAlvo: 'energia', vivo: null }

// quem fica enfatizado: eu (se estou de pé); senão quem o espectador segue (se de pé); senão o primeiro de pé
export function quemDestacar({ meu, inativos = [], seguindo = null, n = inativos.length }) {
  const vivo = (j) => j != null && j >= 0 && j < n && !inativos[j]
  if (vivo(meu)) return meu
  if (vivo(seguindo)) return seguindo
  const primeiro = Array.from({ length: n }, (_, j) => j).find(vivo)
  return primeiro ?? null
}

export function modeloDoAnuncio({ n, dupla = false, times = [], alvos = [], estados = [], meu = -1, destaque = null }) {
  const pos = posicoesDoAnuncio({ n, dupla, times })
  const alvo = destaque ?? meu
  const nos = pos.map((p, j) => {
    const estado = estados[j] ?? 'vivo'
    return { vaga: j, x: p.x, y: p.y, estado, icone: ICONE_DO_ESTADO[estado], voce: j === meu, destaque: j === alvo, time: dupla ? times[j] ?? 0 : null }
  })
  // só ataca quem está de pé e conectado; o alvo pode estar sem conexão (leva o ataque inteiro)
  const tipoDe = (de, para) => (de === alvo ? 'minha' : para === alvo ? 'contraMim' : 'fraca')
  const brutas = []
  for (let de = 0; de < n; de++) {
    const para = alvos[de]
    if (para == null || para === de || para < 0 || para >= n) continue
    if (nos[de].estado !== 'vivo') continue
    if (nos[para].estado === 'eliminado' || nos[para].estado === 'caido') continue
    brutas.push({ de, para, tipo: tipoDe(de, para) })
  }
  // as fracas primeiro, depois a que vem para mim, e a minha por último (a que fecha o anúncio)
  const peso = { fraca: 0, contraMim: 1, minha: 2 }
  const setas = brutas
    .map((s, i) => ({ s, i }))
    .sort((a, b) => peso[a.s.tipo] - peso[b.s.tipo] || a.i - b.i)
    .map(({ s }, ordem) => ({ ...s, ordem }))
  let elo = null
  if (dupla && alvo != null) {
    const parceiro = times.findIndex((t, k) => k !== alvo && t === times[alvo])
    if (parceiro >= 0) elo = [alvo, parceiro]
  }
  return { nos, setas, elo }
}

// A seta é uma curva quadrática de a até b, encurtada pelo anel dos dois lados. A curva sempre entorta para o
// mesmo lado da direção, então as setas de ida e de volta (A→B e B→A) não se sobrepõem
export function curvaDaSeta(p0, p1, { raio = ANUNCIO.raioNo + 5, entorta = 0.2 } = {}) {
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  const dist = Math.hypot(dx, dy) || 1
  const ux = dx / dist
  const uy = dy / dist
  const nx = -uy
  const ny = ux
  const curva = dist * entorta
  const a = { x: p0.x + ux * raio + nx * curva * 0.35, y: p0.y + uy * raio + ny * curva * 0.35 }
  const b = { x: p1.x - ux * raio + nx * curva * 0.35, y: p1.y - uy * raio + ny * curva * 0.35 }
  const c = { x: (p0.x + p1.x) / 2 + nx * curva, y: (p0.y + p1.y) / 2 + ny * curva }
  return { a, c, b }
}
export function pontoNaCurva({ a, c, b }, t) {
  const k = 1 - t
  return { x: k * k * a.x + 2 * k * t * c.x + t * t * b.x, y: k * k * a.y + 2 * k * t * c.y + t * t * b.y }
}
export function tangenteNaCurva({ a, c, b }, t) {
  const dx = 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x)
  const dy = 2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y)
  const m = Math.hypot(dx, dy) || 1
  return { x: dx / m, y: dy / m }
}

// ---------- tempo ----------

export function linhaDoTempo(nSetas, { reduzir = false } = {}) {
  if (reduzir) return { reduzir: true, total: ANUNCIO.msReduzido, entrada: 0, inicios: Array(nSetas).fill(0), duracao: 0 }
  return { reduzir: false, total: ANUNCIO.ms, entrada: ANUNCIO.entrada, inicios: Array.from({ length: nSetas }, (_, i) => ANUNCIO.entrada + i * ANUNCIO.passo), duracao: ANUNCIO.desenho }
}

const limitar = (v) => Math.max(0, Math.min(1, v))
// 0..1 de cada parte no instante t (ms). `pular` (A ou B): o quadro final de uma vez. Sem animação: tudo já desenhado
export function quadroDoAnuncio(linha, t, { pular = false } = {}) {
  const agora = pular ? linha.total : Math.max(0, t)
  const fim = agora >= linha.total
  if (linha.reduzir) return { sprites: 1, setas: linha.inicios.map(() => 1), pulso: 0, fim }
  const sprites = limitar(agora / Math.max(1, linha.entrada))
  const setas = linha.inicios.map((ini) => limitar((agora - ini) / Math.max(1, linha.duracao)))
  const pulso = pular || fim ? 0 : 0.5 + 0.5 * Math.sin((2 * Math.PI * agora) / ANUNCIO.periodoPulso)
  return { sprites, setas, pulso, fim }
}
