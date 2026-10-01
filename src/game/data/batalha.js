import { PERSONAGENS } from './personagens.js'

// Party da batalha (ids de personagens.js), na ordem dos painéis.
// Com 2 jogadores, party[0] é do jogador 1, party[1] do jogador 2, e assim por diante.
// Com 1 jogador, o jogador 1 controla todos.
// A party de verdade vem da tela EscolhaParty (registry 'party'); esta é a
// reserva quando ninguém passou por lá.
// O chefe é escolhido na tela de seleção (data/chefes/).
export const BATALHA = {
  party: ['kris', 'susie'],
  chefePadrao: 'king',
}

// Party escolhida (registry 'party'), sem ids que não existem mais; sem
// escolha válida, BATALHA.party
export function partyDe(registry) {
  const party = (registry.get('party') ?? []).filter((id) => PERSONAGENS[id])
  return party.length ? party : BATALHA.party
}
