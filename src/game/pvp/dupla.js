// Regras do 2x2 (duas equipes de 2, 4 jogadores online; Fase 5E, docs/pvp-regras.md "2x2"). Lógica pura (sem
// Phaser), testada em __tests__/dupla.test.js. É o todos contra todos (pvp/ffa.js) com TIMES: as cartas, a
// energia, o dano, os grazes, o combo de perfeitos, a morte súbita e o limite de rodadas são os mesmos, e cada
// DUELO da rodada resolve como um 1x1 (os dois do par atacam um ao outro).
//
//   const estado = criarPartidaDupla({ personagens: [p0, p1, p2, p3], times: [0, 1, 0, 1], semente })
//   iniciarRodadaDupla(estado, { ausentes })    energia + mãos; estado.alvos = os DUELOS da rodada
//   podeJogarDupla(estado, j, jogada)            jogada = id | { carta, apoio } (apoio: em quem vai o ♥)
//   resolverRodadaDupla(estado, jogadas)         -> o resultado do ffa + { levantados, superDupla, semAlvo }
//   fimDaRodadaDupla(estado, { limpas })         -> { caidos, resgatados, fim, vencedorTime, eliminados, restam }
//
// DUELOS CRUZADOS (anunciados antes da escolha): com os 4 de pé, na rodada ímpar A1×B1 e A2×B2, na par A1×B2 e
// A2×B1 (A1/A2 = os do time A em ordem de vaga). Um time com UM de pé: ele enfrenta UM adversário (alternando a
// cada rodada) e o outro adversário fica SEM ALVO (ANTI-FOCO: ninguém recebe mais de um ataque por rodada): ganha
// +1 de energia no começo da rodada e só pode jogar ♥ (em si ou no parceiro) ou passar.
//
// CAÍDO: quem zera o HP no fim da rodada CAI (não sai): não joga, não é alvo, não ganha energia. O parceiro
// RESGATA: (1) RODADA LIMPA: ele tinha ataque na caixa e não levou nenhum acerto -> o caído (de uma rodada
// anterior) volta com 30% do HP; ou (2) um ♥ do parceiro com o caído como alvo -> levanta na hora com pelo
// menos 25% do HP (a carta vale: cura/escudo/Segunda chance nele). Volta a jogar na rodada seguinte.
// VITÓRIA: o time cujos DOIS adversários estão caídos (ou fora) no fim da rodada. Os dois times zerados no
// mesmo fim de rodada: EMPATE. No limite de rodadas: vence o time com mais HP somado (dos de pé); igual: empate.
// SEM CONEXÃO: como no ffa (não ataca, não ganha energia, leva o ataque inteiro); não voltou em 20 s: FORA
// (eliminado, não dá para resgatar).
// SUPER EM DUPLA: os dois do time jogam SUPER na mesma rodada -> as duas caixas de SUPER com +25% de dano.

import { criarPartidaFfa, resolverRodadaFfa, joga, FFA } from './ffa.js'
import { ENERGIA, podeJogar } from './regras.js'
import { ehSuper } from './cartas.js'
import { completarMao, MAO } from './baralho.js'
import { timesDoArranjo } from '../../lib/times2x2.js'

// resgate    o caído volta com esta fração do HP (rodada limpa do parceiro)
// levantar   o ♥ do parceiro levanta o caído com pelo menos esta fração
// superDupla multiplicador do dano por acerto das duas caixas de SUPER do mesmo time na mesma rodada
// cargaSemAlvo  energia extra de quem fica SEM ALVO (o adversário que sobra contra um time de um só)
export const DUPLA = { jogadores: 4, resgate: 0.3, levantar: 0.25, superDupla: 1.25, cargaSemAlvo: 1 }

const idDaJogada = (jogada) => (jogada == null ? null : typeof jogada === 'string' ? jogada : jogada.carta ?? null)
const apoioDaJogada = (jogada) => (jogada && typeof jogada === 'object' && Number.isInteger(jogada.apoio) ? jogada.apoio : null)

export function criarPartidaDupla({ personagens, times = timesDoArranjo(0), semente = '2x2' }) {
  if (personagens.length !== DUPLA.jogadores) throw new Error('2x2: são 4 jogadores')
  if (times.length !== 4 || times.filter((t) => t === 0).length !== 2 || times.filter((t) => t === 1).length !== 2) throw new Error('2x2: dois times de 2')
  const estado = criarPartidaFfa({ personagens, semente })
  estado.modo = '2x2'
  estado.times = [...times]
  estado.semAlvo = []
  estado.vencedorTime = null
  estado.quedas = 0
  for (const jog of estado.jogadores) jog.caido = null // { rodada, ordem }
  return estado
}

export const timeDe = (estado, j) => estado.times[j]
export const parceiroDe = (estado, j) => estado.times.findIndex((t, k) => k !== j && t === estado.times[j])
export const membros = (estado, t) => estado.times.map((x, j) => (x === t ? j : -1)).filter((j) => j >= 0)
export const adversarios = (estado, j) => membros(estado, 1 - estado.times[j])
// de pé: nem caído nem fora (eliminado)
export const dePe = (estado, j) => !estado.jogadores[j].eliminado && !estado.jogadores[j].caido
export const fora = (estado, j) => !dePe(estado, j)

// Os duelos da rodada. times[vaga], ativos = as vagas de pé, rodada >= 1. -> { alvos, semAlvo }
export function duelosDaRodada(times, ativos, rodada) {
  const alvos = Array(times.length).fill(null)
  const a = ativos.filter((j) => times[j] === 0).sort((x, y) => x - y)
  const b = ativos.filter((j) => times[j] === 1).sort((x, y) => x - y)
  const semAlvo = []
  const par = (x, y) => {
    alvos[x] = y
    alvos[y] = x
  }
  const r = Math.max(1, rodada)
  if (a.length === 2 && b.length === 2) {
    if (r % 2 === 1) {
      par(a[0], b[0])
      par(a[1], b[1])
    } else {
      par(a[0], b[1])
      par(a[1], b[0])
    }
  } else if (a.length && b.length) {
    // um time com um só de pé: ele enfrenta um adversário (alternando) e o outro fica sem alvo
    const [so, dupla] = a.length === 1 ? [a[0], b] : [b[0], a]
    const k = dupla.length === 2 ? (r - 1) % 2 : 0
    par(so, dupla[k])
    if (dupla.length === 2) semAlvo.push(dupla[1 - k])
  }
  return { alvos, semAlvo }
}

// Começo da rodada (o host). ausentes: quem está sem conexão (não ganha energia). Caídos e fora não ganham
export function iniciarRodadaDupla(estado, { ausentes = [] } = {}) {
  if (estado.fim) return estado
  estado.rodada++
  const lista = estado.jogadores.map((_, j) => j).filter((j) => !estado.jogadores[j].eliminado)
  estado.ausentes = lista.filter((j) => ausentes.includes(j))
  const ativos = lista.filter((j) => !estado.jogadores[j].caido)
  const { alvos, semAlvo } = duelosDaRodada(estado.times, ativos, estado.rodada)
  estado.alvos = alvos
  estado.semAlvo = semAlvo
  for (const j of lista) {
    const jog = estado.jogadores[j]
    jog.ausente = estado.ausentes.includes(j)
    jog.protegido = false
    if (!jog.ausente && !jog.caido) {
      const ganho = estado.rodada === 1 ? ENERGIA.inicial : jog.energia + ENERGIA.porRodada + (semAlvo.includes(j) ? DUPLA.cargaSemAlvo : 0)
      jog.energia = Math.min(ENERGIA.maxima, ganho)
    }
    completarMao(jog.baralho, MAO.tamanho) // (o caído também: volta com a mão cheia)
  }
  estado.fase = 'escolha'
  return estado
}

// Em quem o ♥ de j pode ir: ele mesmo e o parceiro (se não está fora de vez)
export function alvosDeApoio(estado, j) {
  const p = parceiroDe(estado, j)
  return p >= 0 && !estado.jogadores[p].eliminado ? [j, p] : [j]
}

const bloqueio = (motivo, curto) => ({ ok: false, motivo, bloqueio: { motivo, curto } })

// Pode jogar? Caído/fora só passa; SEM ALVO só ♥ ou passar; o apoio só em si ou no parceiro
export function podeJogarDupla(estado, j, jogada) {
  const id = idDaJogada(jogada)
  if (id === null) return { ok: true, motivo: null }
  if (!joga(estado, j)) return bloqueio('caído: não joga nesta rodada', 'CAÍDO')
  const carta = estado.jogadores[j].baralho.mao.find((c) => c.id === id)
  if (carta && estado.semAlvo.includes(j) && carta.naipe !== 'copas') return bloqueio('sem alvo nesta rodada: só ♥ (em você ou no parceiro) ou passar', 'SEM ALVO: só ♥')
  const apoio = apoioDaJogada(jogada)
  if (apoio != null && !alvosDeApoio(estado, j).includes(apoio)) return bloqueio('o ♥ vai em você ou no seu parceiro', 'APOIO INVÁLIDO')
  return podeJogar(estado, j, id)
}

// Resolve a rodada (o host). jogadas[vaga] = id | { carta, apoio } | null
export function resolverRodadaDupla(estado, jogadas) {
  const n = estado.n
  const ids = Array.from({ length: n }, (_, j) => (joga(estado, j) ? idDaJogada(jogadas[j]) : null))
  ids.forEach((id, j) => {
    const v = podeJogarDupla(estado, j, jogadas[j] && typeof jogadas[j] === 'object' ? { carta: id, apoio: apoioDaJogada(jogadas[j]) } : id)
    if (!v.ok) throw new Error(`jogada inválida do ${estado.jogadores[j].id}: ${v.motivo}`)
  })
  const cartaDe = (j) => (ids[j] ? estado.jogadores[j].baralho.mao.find((c) => c.id === ids[j]) ?? null : null)
  const apoio = Array.from({ length: n }, (_, j) => {
    const a = apoioDaJogada(jogadas[j])
    return a != null && cartaDe(j)?.naipe === 'copas' ? a : null
  })
  // SUPER em dupla: os dois do time jogaram SUPER
  const superDupla = [0, 1].filter((t) => membros(estado, t).every((j) => ehSuper(cartaDe(j))))
  const fatorDano = Array.from({ length: n }, (_, j) => (superDupla.includes(estado.times[j]) ? DUPLA.superDupla : 1))
  const caidosAntes = estado.jogadores.map((jog) => Boolean(jog.caido))
  const r = resolverRodadaFfa(estado, ids, { apoio, fatorDano })
  // o ♥ no parceiro caído levanta ele (com pelo menos DUPLA.levantar do HP); volta a jogar na próxima rodada
  const levantados = []
  r.efeitos.forEach((ef, j) => {
    const p = ef.apoiou
    if (p == null || !caidosAntes[p] || r.jogadas[j].anulada) return
    const jog = estado.jogadores[p]
    if (jog.eliminado) return
    jog.hp = Math.max(jog.hp, Math.ceil(jog.hpMax * DUPLA.levantar))
    jog.caido = null
    levantados.push({ j: p, por: j })
  })
  r.apoio = apoio
  r.levantados = levantados
  r.superDupla = superDupla
  r.semAlvo = [...estado.semAlvo]
  r.times = [...estado.times]
  return r
}

// Um time perdeu os dois (caídos ou fora)?
export const timeZerado = (estado, t) => membros(estado, t).every((j) => fora(estado, j) || estado.jogadores[j].hp <= 0)

// Fim da esquiva (o host). limpas[j] = j tinha ataque na caixa e passou sem levar NENHUM acerto
export function fimDaRodadaDupla(estado, { limpas = [] } = {}) {
  for (const jog of estado.jogadores) jog.protegido = false
  // 1. resgate pela rodada limpa do parceiro (só quem já estava caído antes desta rodada)
  const resgatados = []
  for (let j = 0; j < estado.n; j++) {
    const jog = estado.jogadores[j]
    if (!jog.caido || jog.eliminado || jog.caido.rodada >= estado.rodada) continue
    const p = parceiroDe(estado, j)
    if (p < 0 || !limpas[p] || !dePe(estado, p) || estado.jogadores[p].hp <= 0 || estado.jogadores[p].ausente) continue
    jog.hp = Math.max(1, Math.ceil(jog.hpMax * DUPLA.resgate))
    jog.caido = null
    resgatados.push({ j, por: p })
  }
  // 2. quem zerou nesta rodada cai
  const caidos = []
  const ordem = estado.quedas + 1
  for (let j = 0; j < estado.n; j++) {
    const jog = estado.jogadores[j]
    if (jog.eliminado || jog.caido || jog.hp > 0) continue
    jog.hp = 0
    jog.caido = { rodada: estado.rodada, ordem }
    jog.escudo = null
    caidos.push(j)
  }
  if (caidos.length) estado.quedas = ordem
  // 3. vitória / empate / limite
  const zerado = [0, 1].map((t) => timeZerado(estado, t))
  let fim = null
  let vencedorTime = null
  if (zerado[0] || zerado[1]) {
    fim = 'ko'
    vencedorTime = zerado[0] && zerado[1] ? null : zerado[0] ? 1 : 0
  } else if (estado.rodada >= FFA.limiteRodadas) {
    fim = 'limite'
    const hp = [0, 1].map((t) => membros(estado, t).reduce((s, j) => s + (dePe(estado, j) ? Math.max(0, estado.jogadores[j].hp) : 0), 0))
    vencedorTime = hp[0] === hp[1] ? null : hp[0] > hp[1] ? 0 : 1
  }
  estado.fim = fim
  estado.vencedorTime = vencedorTime
  estado.fase = fim ? 'fim' : 'inicio'
  if (fim) estado.vencedor = vencedorTime == null ? null : membros(estado, vencedorTime)[0]
  const restam = estado.jogadores.map((_, j) => j).filter((j) => dePe(estado, j))
  return { caidos, resgatados, fim, vencedorTime, eliminados: [], restam }
}

// A ordem da tela de resultado e do replay: o time vencedor primeiro (cada time pelo HP que sobrou, depois o
// dano causado); empate: o time A primeiro
export function classificacaoDupla(estado) {
  const primeiro = estado.vencedorTime ?? 0
  const chave = (j) => [estado.times[j] === primeiro ? 1 : 0, dePe(estado, j) ? 1 : 0, Math.max(0, estado.jogadores[j].hp), estado.jogadores[j].danoCausado, -j]
  return estado.jogadores
    .map((_, j) => j)
    .sort((a, b) => {
      const ka = chave(a)
      const kb = chave(b)
      for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i]
      return 0
    })
}
