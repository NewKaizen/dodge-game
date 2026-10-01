// Baralho do modo PvP de cartas: lógica pura (sem Phaser), testável em Node.
//
// Tudo aqui é objeto simples (serializável com JSON): o baralho guarda o
// monte, a mão, o descarte e o estado do RNG. As funções MUDAM o baralho
// recebido (quem quiser imutabilidade clona antes, como faz regras.js).
//
//   const b = criarBaralho('kris', 'partida-42')   monte embaralhado com semente
//   completarMao(b, 5)                             compra até ter 5 na mão
//   descartar(b, 'kris-espadas-7')                 mão -> descarte
//   comprar(b, 2)                                  compra extra (reembaralha o descarte se o monte acabar)
//
// Mesma semente = mesma ordem de cartas (partidas repetíveis e testes estáveis).

import { cartasDoPersonagem } from './cartas.js'

export const MAO = { tamanho: 5, maxima: 7 }

// ---------- RNG com semente (determinístico, estado num número) ----------

// Hash de texto -> inteiro de 32 bits (xmur3 simplificado)
function hashTexto(texto) {
  let h = 1779033703 ^ texto.length
  for (let i = 0; i < texto.length; i++) {
    h = Math.imul(h ^ texto.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) >>> 0
}

// RNG serializável: { s } (estado do mulberry32)
export function criarRng(semente = 'pvp') {
  return { s: hashTexto(String(semente)) }
}

// Número em [0, 1). Avança o estado do rng.
export function aleatorio(rng) {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0
  let t = rng.s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Inteiro em [min, max] (inclusive)
export function inteiro(rng, min, max) {
  return min + Math.floor(aleatorio(rng) * (max - min + 1))
}

// Cópia embaralhada (Fisher-Yates); a lista original não muda
export function embaralhar(lista, rng) {
  const copia = [...lista]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio(rng) * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

// ---------- baralho ----------

// Baralho novo de um personagem, já embaralhado. `cartas` permite passar
// outra lista (testes); o padrão são as cartas de cartas.js.
export function criarBaralho(personagem, semente = 'pvp', cartas = cartasDoPersonagem(personagem)) {
  const rng = criarRng(`${semente}:${personagem}`)
  return {
    personagem,
    monte: embaralhar(cartas.map((c) => ({ ...c })), rng),
    mao: [],
    descarte: [],
    rng,
    reembaralhos: 0,
  }
}

// Compra até `n` cartas para a mão (sem passar de MAO.maxima). Se o monte
// acabar, o descarte é embaralhado e vira o monte novo. Devolve as compradas.
export function comprar(baralho, n = 1, limite = MAO.maxima) {
  const compradas = []
  for (let k = 0; k < n && baralho.mao.length < limite; k++) {
    if (!baralho.monte.length) reembaralhar(baralho)
    if (!baralho.monte.length) break // tudo está na mão: não há o que comprar
    const carta = baralho.monte.shift()
    baralho.mao.push(carta)
    compradas.push(carta)
  }
  return compradas
}

// Compra até a mão ter `tamanho` cartas (começo de cada rodada)
export function completarMao(baralho, tamanho = MAO.tamanho) {
  return comprar(baralho, Math.max(0, tamanho - baralho.mao.length), tamanho)
}

// Descarte vira o monte (embaralhado com o rng do baralho)
export function reembaralhar(baralho) {
  if (!baralho.descarte.length) return false
  baralho.monte = [...baralho.monte, ...embaralhar(baralho.descarte, baralho.rng)]
  baralho.descarte = []
  baralho.reembaralhos++
  return true
}

// Tira uma carta da mão (pelo id) e devolve; null se não está na mão
export function tirarDaMao(baralho, idCarta) {
  const i = baralho.mao.findIndex((c) => c.id === idCarta)
  if (i < 0) return null
  return baralho.mao.splice(i, 1)[0]
}

// Mão -> descarte. Devolve a carta descartada (ou null)
export function descartar(baralho, idCarta) {
  const carta = tirarDaMao(baralho, idCarta)
  if (carta) baralho.descarte.push(carta)
  return carta
}

export function cartaNaMao(baralho, idCarta) {
  return baralho.mao.find((c) => c.id === idCarta) ?? null
}

// Total de cartas do baralho (monte + mão + descarte)
export function totalDeCartas(baralho) {
  return baralho.monte.length + baralho.mao.length + baralho.descarte.length
}
