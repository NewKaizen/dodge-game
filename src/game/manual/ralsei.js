import { aleatorio } from '../pvp/baralho.js'
import { circuloGiz, linhaGiz, poligonoGiz, estrelaGiz } from './giz.js'
import { PALETA } from './cera.js'

// O Ralsei do manual, desenhado a giz de cera (só DADOS: camadas para cera.pintarDesenho, sem Phaser).
// Desenho ORIGINAL (nada copiado): bichinho fofo de pelo branquinho, orelhas caídas, chapéu de mago
// verde de ponta mole, cachecol rosa e manto verde (as cores do sprite do jogo, arte/sprites.js), segurando
// um giz rosa, porque foi ele que fez o caderno, e de óculos redondos como na arte do menu. Em PARTES separadas para a respiração e o chapéu balançarem:
//
//   partesDoRalsei(rng)                 { corpo, cabeca, chapeu }: camadas em coordenadas locais (0,0 = pés)
//   rostoDoRalsei(rng, expressao, op)   camadas do rosto, centradas no meio da cabeça (op.piscando)
//   CABECA                              onde fica o meio da cabeça (para encaixar o rosto)
//   EXPRESSOES                          feliz, concentrado, surpreso, incentivo, animado
//   expressaoDoRalsei(etapa, ultimo)    qual cara fazer agora (ultimo = { tipo, ha } do último evento)
//   piscaEm(rng, agora)                 quando ele pisca da próxima vez (ms)

export const CABECA = { x: 0, y: -86 }
export const EXPRESSOES = ['feliz', 'concentrado', 'surpreso', 'incentivo', 'animado']
const SEM_PISCAR = new Set(['animado']) // olhos já fechadinhos de alegria

const traco = (tracos, cor, largura = 2.6, extra = {}) => ({ tipo: 'traco', tracos, cor, largura, ...extra })
const preencher = (poligono, cor, extra = {}) => ({ tipo: 'preencher', poligono, cor, ...extra })
const mancha = (poligono, cor, alpha = 1) => ({ tipo: 'mancha', poligono, cor, alpha })

export function elipse(cx, cy, rx, ry, n = 24, giro = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const x = Math.cos(a) * rx
    const y = Math.sin(a) * ry
    return { x: cx + x * Math.cos(giro) - y * Math.sin(giro), y: cy + x * Math.sin(giro) + y * Math.cos(giro) }
  })
}

// uma curva (lista de pontos) por uma quadrática a-c-b
function curva(a, c, b, n = 8) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    return { x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y }
  })
}

// cabeça fofinha: círculo com tufinhos (raio que sobe e desce), mais bagunçado em cima
function cabecaFofa(rng, cx, cy, r, n = 44) {
  const tufos = 9
  const fase = aleatorio(rng) * 6.28
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const emCima = Math.max(0, -Math.sin(a))
    const rr = r * (0.96 + 0.06 * Math.abs(Math.sin(a * tufos * 0.5 + fase)) + 0.05 * emCima * Math.abs(Math.sin(a * 6 + fase)))
    return { x: cx + Math.cos(a) * rr * 1.05, y: cy + Math.sin(a) * rr * 0.95 }
  })
}

export function partesDoRalsei(rng) {
  const corpo = []
  // manto (um sino com a barra ondulada)
  const manto = [
    { x: -13, y: -60 }, { x: 13, y: -60 }, { x: 27, y: -52 }, { x: 36, y: -30 }, { x: 44, y: -6 },
    { x: 40, y: 1 }, { x: 26, y: -2 }, { x: 13, y: 2 }, { x: 0, y: -1 }, { x: -13, y: 2 }, { x: -26, y: -2 }, { x: -40, y: 1 },
    { x: -44, y: -6 }, { x: -36, y: -30 }, { x: -27, y: -52 },
  ]
  corpo.push(preencher(manto, PALETA.verde, { angulo: 0.9, espaco: 3.4 }))
  corpo.push(traco([curva({ x: -40, y: -9 }, { x: 0, y: -4 }, { x: 40, y: -9 })], PALETA.verdeEscuro, 3.2, { alpha: 0.6 })) // barra
  corpo.push(traco(poligonoGiz(rng, manto, { tremor: 0.8 }), PALETA.verdeEscuro, 2.6))
  corpo.push(traco([curva({ x: 0, y: -50 }, { x: -2, y: -26 }, { x: 1, y: -6 })], PALETA.verdeEscuro, 1.8, { alpha: 0.5 })) // pregas
  // pezinhos aparecendo
  for (const lado of [-1, 1]) {
    const pe = elipse(lado * 15, 2, 9, 5, 14)
    corpo.push(preencher(pe, PALETA.pelo, { espaco: 2.4, alpha: 0.9 }))
    corpo.push(traco(poligonoGiz(rng, pe, { tremor: 0.5 }), PALETA.peloSombra, 2))
  }
  // cachecol rosa: a volta no pescoço e a ponta caindo
  const volta = [{ x: -25, y: -68 }, { x: 25, y: -68 }, { x: 27, y: -56 }, { x: 0, y: -52 }, { x: -27, y: -56 }]
  const ponta = [{ x: 8, y: -58 }, { x: 22, y: -58 }, { x: 25, y: -30 }, { x: 18, y: -26 }, { x: 12, y: -30 }]
  for (const p of [ponta, volta]) {
    corpo.push(preencher(p, PALETA.rosa, { angulo: -0.4, espaco: 2.8 }))
    corpo.push(traco(poligonoGiz(rng, p, { tremor: 0.6 }), PALETA.rosaEscuro, 2.2))
  }
  corpo.push(traco([curva({ x: 10, y: -40 }, { x: 17, y: -41 }, { x: 24, y: -40 }, 4), curva({ x: 12, y: -34 }, { x: 18, y: -35 }, { x: 24, y: -34 }, 4)], 0xffffff, 1.6, { alpha: 0.7 }))
  // mãozinhas e o giz rosa na mão direita
  const giz = [{ x: 30, y: -36 }, { x: 46, y: -54 }, { x: 50, y: -51 }, { x: 34, y: -33 }]
  corpo.push(preencher(giz, PALETA.rosa, { espaco: 2, alpha: 1 }))
  corpo.push(traco(poligonoGiz(rng, giz, { tremor: 0.3 }), PALETA.rosaEscuro, 1.8))
  corpo.push(mancha(elipse(48, -52.5, 2.6, 2.2, 8), PALETA.rosaEscuro, 0.9))
  for (const [x, y] of [[-30, -30], [32, -34]]) {
    const mao = elipse(x, y, 7, 6.4, 14)
    corpo.push(preencher(mao, PALETA.pelo, { espaco: 2.2 }))
    corpo.push(traco(circuloGiz(rng, x, y, 6.8, { tracos: 1, tremor: 0.5 }), PALETA.peloSombra, 2))
  }

  const cabeca = []
  const { x: cx, y: cy } = CABECA
  // orelhas caídas (atrás da cabeça), pelo por fora e rosinha por dentro
  for (const lado of [-1, 1]) {
    const orelha = [
      { x: cx + lado * 18, y: cy - 16 }, { x: cx + lado * 34, y: cy - 12 }, { x: cx + lado * 44, y: cy + 6 },
      { x: cx + lado * 46, y: cy + 24 }, { x: cx + lado * 40, y: cy + 30 }, { x: cx + lado * 32, y: cy + 18 }, { x: cx + lado * 22, y: cy + 2 },
    ]
    const dentro = [{ x: cx + lado * 26, y: cy - 6 }, { x: cx + lado * 36, y: cy + 4 }, { x: cx + lado * 41, y: cy + 20 }, { x: cx + lado * 32, y: cy + 10 }]
    cabeca.push(preencher(orelha, PALETA.pelo, { angulo: lado * 0.8, espaco: 2.8 }))
    cabeca.push(preencher(dentro, PALETA.rosa, { alpha: 0.55, espaco: 2.4 }))
    cabeca.push(traco(poligonoGiz(rng, orelha, { tremor: 0.6 }), PALETA.peloSombra, 2.2))
  }
  const rosto = cabecaFofa(rng, cx, cy, 27)
  cabeca.push(preencher(rosto, PALETA.pelo, { angulo: 0.5, espaco: 3, mancha: 0.6 }))
  cabeca.push(traco(poligonoGiz(rng, rosto, { tremor: 0.5, passo: 5 }), PALETA.peloSombra, 2.4))
  // focinho mais clarinho
  cabeca.push(mancha(elipse(cx, cy + 10, 12, 8, 18), 0xffffff, 0.55))

  const chapeu = []
  const aba = elipse(cx, cy - 22, 42, 9, 28, -0.05)
  const cone = [
    { x: cx - 23, y: cy - 24 }, { x: cx - 17, y: cy - 46 }, { x: cx - 6, y: cy - 66 }, { x: cx + 8, y: cy - 80 },
    { x: cx + 26, y: cy - 86 }, { x: cx + 40, y: cy - 80 }, { x: cx + 44, y: cy - 70 }, { x: cx + 34, y: cy - 72 },
    { x: cx + 22, y: cy - 66 }, { x: cx + 18, y: cy - 46 }, { x: cx + 22, y: cy - 24 },
  ]
  chapeu.push(preencher(aba, PALETA.verde, { angulo: 0.2, espaco: 3 }))
  chapeu.push(traco(poligonoGiz(rng, aba, { tremor: 0.6 }), PALETA.verdeEscuro, 2.6))
  chapeu.push(preencher(cone, PALETA.verde, { angulo: -0.9, espaco: 3.2 }))
  chapeu.push(traco([curva({ x: cx - 12, y: cy - 30 }, { x: cx - 6, y: cy - 52 }, { x: cx + 6, y: cy - 72 })], 0xb8f0c8, 3, { alpha: 0.7, passadas: 2 })) // brilho
  chapeu.push(traco(poligonoGiz(rng, cone, { tremor: 0.7 }), PALETA.verdeEscuro, 2.6))
  chapeu.push(traco(estrelaGiz(rng, cx + 44, cy - 70, 5, { tremor: 0.3 }), PALETA.amarelo, 2.4))
  return { corpo, cabeca, chapeu }
}

// O rosto, centrado em (0,0) = meio da cabeça
export function rostoDoRalsei(rng, expressao = 'feliz', { piscando = false } = {}) {
  const c = []
  const tinta = PALETA.tinta
  const fino = (tracos, largura = 2.2, cor = tinta) => c.push(traco(tracos, cor, largura, { passadas: 2 }))
  const arco = (x0, y0, xm, ym, x1, y1, n = 6) => curva({ x: x0, y: y0 }, { x: xm, y: ym }, { x: x1, y: y1 }, n)
  // bochechas (rosinhas, mais fortes quando ele está animado)
  for (const lado of [-1, 1]) c.push(mancha(elipse(lado * 15, 7, 5.5, 3.6, 14), PALETA.rosa, expressao === 'animado' ? 0.75 : 0.5))

  const olhoAberto = (x, y, r = 3.4, olhar = { x: 0, y: 0 }) => {
    c.push(mancha(elipse(x + olhar.x, y + olhar.y, r * 0.85, r, 12), tinta))
    c.push(mancha(elipse(x + olhar.x - r * 0.35, y + olhar.y - r * 0.4, r * 0.32, r * 0.32, 8), 0xffffff, 0.95))
  }
  const olhoFechado = (x, y, feliz = false) => fino([feliz ? arco(x - 4, y + 1, x, y - 4, x + 4, y + 1) : arco(x - 4, y, x, y + 2.5, x + 4, y)], 2.4)
  const olhos = (op = {}) => {
    for (const lado of [-1, 1]) {
      if (piscando && !SEM_PISCAR.has(expressao)) olhoFechado(lado * 9, -2)
      else if (op.piscadela && lado === 1) olhoFechado(lado * 9, -2, true)
      else olhoAberto(lado * 9, -2, op.r, op.olhar)
    }
  }

  // os óculos redondos (o Ralsei da arte do menu usa): por cima dos olhos, em toda cara
  const oculos = () => {
    for (const lado of [-1, 1]) {
      c.push(mancha(elipse(lado * 9.5, -2, 7.2, 6.8, 18), 0xffffff, 0.35))
      c.push(traco(circuloGiz(rng, lado * 9.5, -2, 7.4, { tracos: 1, tremor: 0.25, rabo: 0.04 }), PALETA.verdeEscuro, 1.9, { passadas: 2 }))
      c.push(traco([arco(lado * 13, -6.5, lado * 12, -7.5, lado * 10, -7.8, 3)], 0xffffff, 1.3, { passadas: 1, alpha: 0.9 }))
    }
    c.push(traco([arco(-2.4, -3, 0, -4.6, 2.4, -3, 3)], PALETA.verdeEscuro, 1.6, { passadas: 1 }))
  }

  if (expressao === 'feliz') {
    olhos()
    fino([arco(-5, 7, 0, 12, 5, 7)])
    for (const lado of [-1, 1]) fino([arco(lado * 14, -12.5, lado * 9.5, -15, lado * 5, -13)], 1.6)
  } else if (expressao === 'concentrado') {
    olhos({ olhar: { x: 1.4, y: 1.2 }, r: 3 })
    fino([arco(-4, 9, 0, 10, 4, 8.5)])
    c.push(preencher(elipse(4, 11, 2.6, 2.2, 10), PALETA.rosa, { espaco: 1.6 })) // a pontinha da língua
    for (const lado of [-1, 1]) fino([linhaGiz(rng, lado * 14, -14, lado * 5, -11.5, { tracos: 1, tremor: 0.2, excesso: 0 })[0]], 1.6)
  } else if (expressao === 'surpreso') {
    for (const lado of [-1, 1]) {
      if (piscando) olhoFechado(lado * 9, -2)
      else {
        c.push(traco(circuloGiz(rng, lado * 9, -2, 5, { tracos: 1, tremor: 0.3 }), tinta, 1.8, { passadas: 2 }))
        olhoAberto(lado * 9, -2, 2.6)
      }
      fino([arco(lado * 15, -14, lado * 9.5, -19, lado * 4, -15)], 1.6)
    }
    c.push(traco(circuloGiz(rng, 0, 10, 3.2, { tracos: 1, tremor: 0.3 }), tinta, 2.2, { passadas: 2 }))
  } else if (expressao === 'incentivo') {
    olhos({ piscadela: true })
    fino([arco(-6, 6, 0, 13, 6, 6)], 2.4)
    for (const lado of [-1, 1]) fino([arco(lado * 14, -12, lado * 9.5, -15.5, lado * 5, -15)], 1.6) // sobrancelhas de "você consegue"
  } else {
    // animado: olhinhos ^ ^, boca aberta com língua, brilhinhos
    for (const lado of [-1, 1]) olhoFechado(lado * 9, -2, true)
    const boca = [...arco(-7, 5, 0, 5.6, 7, 5, 6), ...arco(7, 5, 0, 18, -7, 5, 8).slice(1)]
    c.push(mancha(boca, 0x7a2440, 0.95))
    c.push(mancha(elipse(0, 12.5, 3.6, 2.4, 10), PALETA.rosa, 0.95))
    c.push(traco([boca], tinta, 1.8, { passadas: 2 }))
    for (const [x, y, r] of [[-30, -20, 4], [32, -16, 3]]) c.push(traco(estrelaGiz(rng, x, y, r, { tremor: 0.2 }), PALETA.amarelo, 2))
  }
  oculos()
  return c
}

// Qual cara fazer: o último evento manda por um instante (levou um acerto = susto; pegou uma marca = festa),
// depois vale a etapa. `ultimo` = { tipo: 'acerto' | 'marca' | ..., ha: ms desde que aconteceu } ou null.
export const SUSTO_MS = 900
export const FESTA_MS = 1100
export function expressaoDoRalsei(etapa, ultimo = null) {
  if (ultimo?.tipo === 'acerto' && ultimo.ha < SUSTO_MS) return 'surpreso'
  if (ultimo?.tipo === 'marca' && ultimo.ha < FESTA_MS) return 'animado'
  switch (etapa) {
    case 'desenhando':
      return 'concentrado'
    case 'tentarDeNovo':
      return 'incentivo'
    case 'concluida':
    case 'virando':
    case 'fim':
      return 'animado'
    default:
      return 'feliz'
  }
}

// a próxima piscada: de 2,6 a 5 s depois de agora (sorteado pelo rng da cena, determinístico)
export const piscaEm = (rng, agora) => agora + 2600 + aleatorio(rng) * 2400
export const PISCADA_MS = 130
