import { CORES } from './constants.js'
import { TEXTO_JOGADOR } from './pvp/perfil.js'

// Modo daltônico (preferência `daltonismo`, preferencias.js): troca as cores
// que IMPORTAM no jogo por uma paleta segura para cada tipo. Lógica pura, sem
// Phaser (testada em __tests__/daltonismo.test.js).
//
//   paletaDaltonismo(modo) -> { aviso, acerto, almas: [p1, p2], textoAlmas: ['#..', '#..'] }
//   aplicarDaltonismo(modo)   escreve a paleta em CORES (constants.js) e em
//                             TEXTO_JOGADOR (perfil.js); quem lê essas cores na
//                             hora (quase todo o jogo) já pega as novas. Devolve
//                             { antes, depois } (para recolorir o que já está na tela)
//   simularDaltonismo(cor, modo)   como a cor aparece para quem tem aquele tipo
//   distancia(a, b, modo)          diferença percebida (ΔE no CIELAB) entre duas cores
//
// O que entra na paleta:
//   aviso       avisos/perigo (CORES.aviso: pré-visualização da caixa, "!", lasers)
//   acerto      a borda da caixa piscando quando o coração leva um golpe
//   almas       o coração (e a cor) de cada jogador: P1 e P2
//   textoAlmas  as mesmas, claras, para texto em fundo escuro (TEXTO_JOGADOR)
//   vagasExtra  a cor do P3 e do P4 nas salas de N (Fase 5A; o lobby usa, game/vagas.js).
//               A forma e o nome do coração de cada um ficam para a 5B
//
// Como as paletas foram escolhidas: a partir das cores de Okabe & Ito (seguras
// para daltônicos), clareadas para aparecer no fundo preto, e conferidas com a
// simulação de Machado et al. (2009, severidade total). Protanopia e
// deuteranopia (vermelho/verde) só separam bem azul de amarelo e claro de
// escuro: P1 vira AZUL e P2 ÂMBAR; o aviso fica num rosa-magenta claro (longe
// do âmbar e mais claro que o azul). Na tritanopia (azul/amarelo) o amarelo do
// P2 se confunde com o branco das balas: P1 continua VERMELHO, P2 vira
// VERDE-ÁGUA e o aviso vira VIOLETA (não se confunde mais com o vermelho do P1).
export const MODOS = ['nenhum', 'protanopia', 'deuteranopia', 'tritanopia']

const PALETAS = {
  nenhum: { aviso: 0xff3048, acerto: 0xff3048, almas: [0xff2030, 0xffd23a], textoAlmas: ['#ff5a66', '#ffd23a'], vagasExtra: [0x4da6ff, 0x6dffb0] },
  protanopia: { aviso: 0xff8ae6, acerto: 0xff8ae6, almas: [0x3d9bff, 0xffc23a], textoAlmas: ['#6cb4ff', '#ffc23a'], vagasExtra: [0xf0f0f0, 0xb07cff] },
  deuteranopia: { aviso: 0xff8ae6, acerto: 0xff8ae6, almas: [0x3d9bff, 0xffc23a], textoAlmas: ['#6cb4ff', '#ffc23a'], vagasExtra: [0xf0f0f0, 0xb07cff] },
  tritanopia: { aviso: 0xe060ff, acerto: 0xe060ff, almas: [0xff3040, 0x30e0c0], textoAlmas: ['#ff6a74', '#4ee8cc'], vagasExtra: [0xffd0f0, 0x6a8cff] },
}

export function paletaDaltonismo(modo) {
  const p = PALETAS[modo] ?? PALETAS.nenhum
  return { ...p, almas: [...p.almas], textoAlmas: [...p.textoAlmas], vagasExtra: [...p.vagasExtra] }
}

export function aplicarDaltonismo(modo) {
  const antes = { aviso: CORES.aviso, acerto: CORES.acerto ?? CORES.aviso, almas: [...CORES.almas], textoAlmas: [...TEXTO_JOGADOR] }
  const depois = paletaDaltonismo(modo)
  CORES.aviso = depois.aviso
  CORES.acerto = depois.acerto
  depois.almas.forEach((c, i) => (CORES.almas[i] = c))
  depois.textoAlmas.forEach((c, i) => (TEXTO_JOGADOR[i] = c))
  depois.vagasExtra.forEach((c, i) => (CORES.vagasExtra[i] = c))
  return { antes, depois }
}

// ---------- simulação (Machado, Oliveira & Fernandes 2009, severidade 1) ----------
// matrizes no RGB linear
const MATRIZES = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
}

const linear = (c) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const gama = (v) => {
  const c = Math.max(0, Math.min(1, v))
  return Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055))
}
const canais = (cor) => [(cor >> 16) & 255, (cor >> 8) & 255, cor & 255].map(linear)

function simularLinear(cor, modo) {
  const v = canais(cor)
  const m = MATRIZES[modo]
  if (!m) return v
  return m.map((l) => Math.max(0, Math.min(1, l[0] * v[0] + l[1] * v[1] + l[2] * v[2])))
}

export function simularDaltonismo(cor, modo) {
  const [r, g, b] = simularLinear(cor, modo).map(gama)
  return (r << 16) | (g << 8) | b
}

function lab([r, g, b]) {
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047)
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b)
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

// ΔE76 entre as duas cores como `modo` as vê ('nenhum' = visão comum)
export function distancia(a, b, modo = 'nenhum') {
  const la = lab(simularLinear(a, modo))
  const lb = lab(simularLinear(b, modo))
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2])
}

// claridade (L* do CIELAB, 0 a 100) como `modo` vê a cor
export const claridade = (cor, modo = 'nenhum') => lab(simularLinear(cor, modo))[0]
