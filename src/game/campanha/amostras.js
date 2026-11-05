// As POSIÇÕES DO CORAÇÃO que o navegador manda ao servidor durante a esquiva da campanha
// (docs/campanha.md "Anti-trapaça"). Compactas: uma lista plana de inteiros [t, x, y, t, x, y, ...],
// t em ms desde o começo da esquiva (relógio da simulação) e x/y em décimos de px.
//
//   PASSO_MS          o passo fixo da simulação (cliente e servidor andam igual)
//   AMOSTRA_MS        de quanto em quanto tempo sai uma amostra (~20 Hz)
//   criarGravador()   { registrar(t, x, y) -> true se gravou · lista · tirar() (o pedaço novo) }
//   ler(lista)        [{ t, x, y }] (px) ou null se o formato não presta
//   alvoNoTempo(amostras, t, inicio)   a última amostra com t' <= t (o que os ataques miram)
//   posicaoNoTempo(amostras, t, inicio) posição interpolada (o coração no servidor)
//   validarAmostras(amostras, op)      { ok, motivo } a plausibilidade (velocidade, caixa, tempo)
import { CORACAO } from '../constants.js'

export const PASSO_MS = 16
export const AMOSTRA_MS = 50
export const MAX_INTERVALO_MS = 260 // buraco máximo entre duas amostras (uma travadinha do navegador)
export const MIN_INTERVALO_MS = 10
export const FOLGA_VELOCIDADE = 1.03 // 3% além da velocidade do coração
export const FOLGA_PX = 0.8 // arredondamento de décimos de px + ponto flutuante
export const FOLGA_FIM_MS = 160 // a última amostra pode ficar até isto antes do fim da esquiva
export const MAX_AMOSTRAS = 400 // ~20 s a 20 Hz: nenhuma esquiva da campanha passa disso
export const MEIO = CORACAO.tamanho / 2 // o centro do coração não chega mais perto da parede

const q = (v) => Math.round(v * 10)

// grava no passo da simulação: a primeira amostra em t=0 e depois a cada AMOSTRA_MS (no primeiro
// passo que passa da marca). Os ataques miram a última amostra gravada.
export function criarGravador() {
  const lista = []
  let enviados = 0
  let proxima = 0
  return {
    lista,
    registrar(t, x, y) {
      if (t < proxima) return false
      lista.push(Math.round(t), q(x), q(y))
      proxima = Math.floor(t / AMOSTRA_MS) * AMOSTRA_MS + AMOSTRA_MS
      return true
    },
    // a última amostra gravada ({ x, y } em px)
    ultima() {
      const n = lista.length
      return n ? { x: lista[n - 2] / 10, y: lista[n - 1] / 10 } : null
    },
    // o pedaço ainda não enviado
    tirar() {
      const pedaco = lista.slice(enviados)
      enviados = lista.length
      return pedaco
    },
  }
}

const inteiroSeguro = (v) => Number.isInteger(v) && Math.abs(v) < 1e7

export function ler(lista) {
  if (!Array.isArray(lista) || lista.length % 3 !== 0 || lista.length / 3 > MAX_AMOSTRAS) return null
  const saida = []
  for (let i = 0; i < lista.length; i += 3) {
    const [t, x, y] = [lista[i], lista[i + 1], lista[i + 2]]
    if (!inteiroSeguro(t) || !inteiroSeguro(x) || !inteiroSeguro(y)) return null
    saida.push({ t, x: x / 10, y: y / 10 })
  }
  return saida
}

// a última amostra com t' <= t (antes da primeira: o lugar onde o coração começa)
export function alvoNoTempo(amostras, t, inicio) {
  let a = null
  for (const s of amostras) {
    if (s.t > t) break
    a = s
  }
  return a ? { x: a.x, y: a.y } : { x: inicio.x, y: inicio.y }
}

// posição interpolada entre as amostras vizinhas (depois da última: parado nela)
export function posicaoNoTempo(amostras, t, inicio) {
  let antes = { t: 0, x: inicio.x, y: inicio.y }
  for (const s of amostras) {
    if (s.t >= t) {
      if (s.t === antes.t) return { x: s.x, y: s.y }
      const k = (t - antes.t) / (s.t - antes.t)
      return { x: antes.x + (s.x - antes.x) * k, y: antes.y + (s.y - antes.y) * k }
    }
    antes = s
  }
  return { x: antes.x, y: antes.y }
}

// Plausibilidade de uma esquiva (o servidor confere TODAS):
//   op: { caixa (formato do manual), velocidade (px/s), duracao (ms), inicio {x,y}, decorridoMs }
//   decorridoMs: quanto tempo passou no relógio do SERVIDOR desde que a esquiva foi entregue
// motivo: 'formato' | 'vazia' | 'tempo' | 'intervalo' | 'taxa' | 'fora_da_caixa' | 'velocidade'
//          | 'teleporte' | 'curta' | 'rapida_demais' | 'inicio'
export function validarAmostras(amostras, { caixa, velocidade = CORACAO.velocidadePadrao, duracao, inicio, decorridoMs = Infinity }) {
  if (!amostras) return { ok: false, motivo: 'formato' }
  if (duracao <= 0) return { ok: true, motivo: null } // rodada sem ataque na caixa: nada a conferir
  if (!amostras.length) return { ok: false, motivo: 'vazia' }
  const l = { left: caixa.esquerda + MEIO - FOLGA_PX, right: caixa.direita - MEIO + FOLGA_PX, top: caixa.topo + MEIO - FOLGA_PX, bottom: caixa.base - MEIO + FOLGA_PX }
  let antes = { t: 0, x: inicio.x, y: inicio.y }
  for (let i = 0; i < amostras.length; i++) {
    const s = amostras[i]
    if (s.t < 0 || (i > 0 && s.t <= antes.t) || (i === 0 && s.t > MAX_INTERVALO_MS)) return { ok: false, motivo: 'tempo' }
    const dt = s.t - antes.t
    if (i > 0 && dt > MAX_INTERVALO_MS) return { ok: false, motivo: 'intervalo' }
    if (i > 0 && dt < MIN_INTERVALO_MS) return { ok: false, motivo: 'taxa' }
    if (s.x < l.left || s.x > l.right || s.y < l.top || s.y > l.bottom) return { ok: false, motivo: 'fora_da_caixa' }
    const d = Math.hypot(s.x - antes.x, s.y - antes.y)
    const max = (velocidade * FOLGA_VELOCIDADE * dt) / 1000 + FOLGA_PX
    // muito acima do possível = pulou de um lugar para outro; um pouco acima = coração rápido demais
    if (d > max * 3 + 6) return { ok: false, motivo: i === 0 ? 'inicio' : 'teleporte' }
    if (d > max) return { ok: false, motivo: 'velocidade' }
    antes = s
  }
  if (antes.t < duracao - FOLGA_FIM_MS) return { ok: false, motivo: 'curta' }
  // a esquiva não pode ter acabado antes do tempo dela no relógio do servidor (câmera lenta não,
  // mas adiantar o relógio também não)
  if (decorridoMs < duracao - 300) return { ok: false, motivo: 'rapida_demais' }
  const media = (amostras.length - 1) / Math.max(1, antes.t / 1000)
  if (amostras.length > 3 && (media > 1000 / MIN_INTERVALO_MS || media < 1000 / MAX_INTERVALO_MS)) return { ok: false, motivo: 'taxa' }
  return { ok: true, motivo: null }
}
