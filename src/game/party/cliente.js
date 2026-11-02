// MODO PARTY no PC de cada um (docs/online.md "Modo Party"): o que as cenas perguntam sobre a party da
// sala. A party existe no servidor (sala.party); o fim dela (a sala caiu para 2, o host saiu, o dono
// encerrou) aparece aqui como `sala.party` = null e cada PC volta sozinho ao lobby (vigiarParty).
import { get } from 'svelte/store'
import { lan, partyAtiva } from '../../lib/lan/rede.js'
import { partySegue } from './regras.js'

export { partyAtiva }

const membros = () => get(lan).sala?.membros.length ?? 0

// depois do resultado de uma partida: a tela CONTINUAR/SAIR (party) ou o lobby
export const destinoDoFim = () => (partyAtiva() && partySegue(membros()) ? 'PartyFim' : 'Lan')

// a party acabou enquanto esta cena (votação, CONTINUAR/SAIR, escolha de personagem) estava aberta:
// todos voltam ao lobby com um aviso curto. Só vigia se a party existia quando a cena abriu
export function vigiarParty(cena) {
  if (!partyAtiva()) return
  let saiu = false
  const parar = lan.subscribe((s) => {
    if (saiu || (s.fase === 'sala' && s.sala?.party)) return
    saiu = true
    if (s.fase === 'sala') {
      const n = s.sala?.membros.length ?? 0
      const msg = n < 3 ? `a party acabou: só ${n === 1 ? 'você ficou' : `ficaram ${n}`} na sala` : 'a party acabou: o host da party saiu'
      // (fora de um callback do store: a troca de cena desliga esta assinatura)
      setTimeout(() => {
        lan.update((x) => ({ ...x, erro: msg }))
        if (cena.sys?.isActive()) cena.scene.start('Lan')
      }, 0)
    }
  })
  cena.events.once('shutdown', () => parar())
}
