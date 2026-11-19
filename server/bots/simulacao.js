// SIMULAÇÃO de partidas PVP inteiras sem tela (as regras de verdade, pvp/regras.js, e as caixas de
// verdade, server/bots/esquiva.js): mede quanto um jogador de nível q ganha de um bot de outro q.
// É com ela que as faixas (server/bots/habilidade.js) foram calibradas (docs/online.md "Bots do
// Jogar Rápido": a tabela das taxas de vitória) e que o teste confere que a faixa escolhida para
// cada jogador dá uma partida parelha.
//
//   simularPartida({ qJogador, qBot, semente }) -> { vencedor: 0 | 1 | null, rodadas }   (0 = o jogador)
//   taxaDeVitoria({ qJogador, qBot, partidas, semente }) -> { vitorias, derrotas, empates, taxa }
//
// Simplificações (são as mesmas para os dois lados): a rodada bônus vira uma rodada comum e o
// coração dos dois é o EsquivaBot (o "jogador" é o mesmo modelo do bot, com o q dele).
import { criarPartida, iniciarRodada, resolverRodada, aplicarDano, registrarGrazes, registrarPerfeitoCombo, energiaPerfeito, fimDaRodada } from '../../src/game/pvp/regras.js'
import { PERSONAGENS_PVP } from '../../src/game/pvp/cartas.js'
import { PERSONAGENS } from '../../src/game/data/personagens.js'
import { criarRng, aleatorio } from '../../src/game/pvp/baralho.js'
import { fatorAceleracao } from '../../src/game/constants.js'
import { criarCaixa, PASSO_MS } from './esquiva.js'
import { numerosDe } from './habilidade.js'
import { escolherCarta } from './decisoes.js'

export const MAX_RODADAS = 40
const FIM_KO_MS = 900 // a outra caixa ainda corre isso depois de um K.O. (PvpArena.nocaute)
const IDS = PERSONAGENS_PVP.filter((id) => PERSONAGENS[id])

export function simularPartida({ qJogador, qBot, semente = 'sim' }) {
  const rng = criarRng(`${semente}:bots`)
  const sorte = () => aleatorio(rng)
  const ids = [IDS[Math.floor(sorte() * IDS.length)], IDS[Math.floor(sorte() * IDS.length)]]
  const numeros = [numerosDe(qJogador), numerosDe(qBot)]
  const estado = criarPartida({ p1: ids[0], p2: ids[1], semente })
  while (!estado.vencedor && estado.rodada < MAX_RODADAS) {
    iniciarRodada(estado)
    const jogadas = [0, 1].map((j) => escolherCarta(estado, j, numeros[j].cartas, sorte))
    const r = resolverRodada(estado, jogadas[0], jogadas[1])
    const aceleracao = fatorAceleracao(estado.rodada)
    const caixas = r.caixas.map((cx, k) =>
      cx ? criarCaixa({ carta: cx.carta, dano: cx.dano, ritmo: cx.ritmo, inverterMs: cx.inverterMs, semente: `${semente}:${estado.rodada}:${k}`, k, aceleracao, esquiva: numeros[k].esquiva, sorte }) : null,
    )
    const acertos = [0, 0]
    const ko = [false, false]
    let fimKo = null
    for (let t = 0; caixas.some((c) => c && !c.acabou); t += PASSO_MS) {
      for (const [k, cx] of caixas.entries()) {
        if (!cx || cx.acabou) continue
        const n = cx.passo(PASSO_MS)
        for (let i = 0; i < n.grazes; i++) registrarGrazes(estado, k, 1)
        for (const dano of n.acertos) {
          if (ko[k]) break
          acertos[k]++
          aplicarDano(estado, k, dano)
          if (estado.jogadores[k].hp <= 0) {
            ko[k] = true
            cx.cair()
            fimKo ??= t + FIM_KO_MS
          }
        }
      }
      if (fimKo != null && t >= fimKo) caixas.forEach((c) => c?.parar())
    }
    for (const k of [0, 1]) if (r.caixas[k] && !acertos[k] && !ko[k] && energiaPerfeito(r.caixas[k].carta)) registrarPerfeitoCombo(estado, k, r.caixas[k].carta)
    fimDaRodada(estado)
  }
  const v = estado.vencedor
  return { vencedor: v === 'p1' ? 0 : v === 'p2' ? 1 : null, rodadas: estado.rodada, personagens: ids }
}

export function taxaDeVitoria({ qJogador, qBot, partidas = 40, semente = 'taxa' }) {
  let vitorias = 0
  let derrotas = 0
  let empates = 0
  for (let i = 0; i < partidas; i++) {
    const { vencedor } = simularPartida({ qJogador, qBot, semente: `${semente}:${i}` })
    if (vencedor === 0) vitorias++
    else if (vencedor === 1) derrotas++
    else empates++
  }
  return { vitorias, derrotas, empates, taxa: vitorias / Math.max(1, partidas) }
}
