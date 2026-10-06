import { PERSONAGENS } from './personagens.js'

// Party do CO-OP escolhida na EscolhaParty (registry 'party'; party[0] é do
// P1, party[1] do P2), sem ids que não existem mais. Sem escolha válida
// (cena aberta direto pelo console), Kris e Susie.
export function partyDe(registry) {
  const party = (registry.get('party') ?? []).filter((id) => PERSONAGENS[id])
  return party.length ? party : ['kris', 'susie']
}
