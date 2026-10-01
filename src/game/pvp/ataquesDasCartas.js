// Ponte para o jogo: ataqueDaCarta já com a biblioteca de attacks/ injetada.
// (cartas.js não importa attacks/ para continuar testável em Node.)
//
//   import { ataqueDaCartaNoJogo } from '../pvp/ataquesDasCartas.js'
//   const caixa = resultado.caixas[j]                    // de regras.resolverRodada
//   const ataque = ataqueDaCartaNoJogo(caixa.carta)      // null = caixa calma nesta rodada
//   new ContextoAtaque({ ..., tema: TEMAS[caixa.carta.personagem], dano: caixa.dano, ritmo: caixa.ritmo })
import { ataques } from '../attacks/index.js'
import { ataqueDaCarta } from './cartas.js'

export function ataqueDaCartaNoJogo(carta, opcoes = {}) {
  return ataqueDaCarta(carta, { ataques, ...opcoes })
}

export { ataques }
