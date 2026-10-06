// CPU aliada do CO-OP de cartas (1 jogador: o P2 é a CPU). Lógica pura.
//
//   escolherJogadaCoop(estado, j, { rng })   -> id da carta ou null (passar)
//
// Dá uma nota a cada carta jogável pensando no time: levantar o parceiro
// caído vem antes de tudo; com o SUPER do chefe chegando, defesa; com HP
// baixo (dela ou do parceiro), cura; senão, o golpe que mais tira do chefe
// por energia. Guarda energia para o próprio SUPER quando está perto.
import { especialDaCarta, efeitosDaCarta, ehSuper } from '../pvp/cartas.js'
import { ENERGIA } from '../pvp/regras.js'
import { aleatorio } from '../pvp/baralho.js'
import { GOLPE } from './regras.js'

const fracao = (jog) => (jog.caido ? 0 : jog.hp / jog.hpMax)

export function notaDaCartaCoop(estado, j, carta) {
  const jog = estado.jogadores[j]
  const parceiro = estado.jogadores[1 - j]
  const intencao = estado.chefe.intencoes[j]
  const intParceiro = estado.chefe.intencoes[1 - j]
  const superVindo = ehSuper(intencao) || ehSuper(intParceiro)
  const apertado = fracao(jog) < 0.35 || (!parceiro.caido && fracao(parceiro) < 0.35)
  if (ehSuper(carta)) return 100
  const especial = especialDaCarta(carta)
  if (especial === 'segundaChance') return parceiro.caido ? 80 : superVindo || apertado ? 60 : 1
  if (especial === 'espelho') return intencao && !superVindo && intencao.naipe !== 'copas' ? 14 + intencao.valor * 2 : 6
  if (especial === 'anular') return intencao && !ehSuper(intencao) ? 8 + intencao.valor * 1.5 + (estado.chefe.carga >= estado.chefe.cargaMax - 1 ? 10 : 0) : 3
  if (especial === 'roubo') return intParceiro && !ehSuper(intParceiro) && !parceiro.caido ? 10 + intParceiro.valor * 1.5 : 4
  if (carta.naipe === 'copas') {
    const ef = efeitosDaCarta(carta) ?? {}
    let nota = 0
    if (ef.cura) nota += parceiro.caido ? 75 : apertado ? ef.cura * 1.6 : ef.cura * 0.25
    if (ef.escudo) nota += superVindo ? 40 : (1 - ef.escudo) * 18
    if (ef.energia) nota += ef.energia * 3
    if (ef.compra) nota += 4 * ef.compra
    return nota
  }
  const golpe = GOLPE[carta.naipe]
  if (!golpe) return 0
  return golpe(carta.valor) * (carta.naipe === 'paus' ? 1.1 : 1) - carta.custo * 1.2
}

export function escolherJogadaCoop(estado, j, { rng = null } = {}) {
  const jog = estado.jogadores[j]
  if (jog.caido) return null
  const jogaveis = jog.baralho.mao.filter((c) => c.custo <= jog.energia)
  const sorte = () => (rng ? aleatorio(rng) : Math.random())
  const notas = jogaveis.map((carta) => ({ carta, nota: notaDaCartaCoop(estado, j, carta) + sorte() * 3 }))
  notas.sort((a, b) => b.nota - a.nota)
  const melhor = notas[0]
  // com o SUPER na mão e perto da energia dele, junta energia (se não for emergência)
  const temSuper = jog.baralho.mao.some(ehSuper)
  const emergencia = melhor && melhor.nota >= 40
  if (temSuper && !ehSuper(melhor?.carta) && jog.energia >= ENERGIA.maxima - 4 && !emergencia) return null
  if (!melhor || melhor.nota < 5) return null
  return melhor.carta.id
}
