import EscolhaPartyN from './EscolhaPartyN.js'
import { irParaCena } from '../rede.js'
import { ARENAS } from '../pvp/arenas.js'

// Escolha de lutador do TODOS CONTRA TODOS (3 e 4, online; Fase 5D, docs/pvp-regras.md "Todos contra
// todos"): a mesma tela da party do CO-OP de 3 e 4 (EscolhaPartyN: cada um escolhe o PRÓPRIO personagem na
// mesma grade, sem repetir, quem arbitra é o host; B antes de alguém confirmar volta todos ao lobby). Sem
// repetir para as 3–4 caixas ficarem fáceis de distinguir (cor da vaga + forma + nome + personagem).
// No fim o HOST sorteia a arena (fundo e música; no todos contra todos não há rodada bônus nem votação) e
// leva todos à PvpArenaN com os personagens por vaga.
export default class PvpEscolhaN extends EscolhaPartyN {
  constructor() {
    super('PvpEscolhaN')
  }

  tituloDaTela() {
    return 'TODOS CONTRA TODOS: ESCOLHA O LUTADOR'
  }

  textoPronto() {
    return 'LUTADORES PRONTOS!'
  }

  irParaLuta(lista) {
    const arena = ARENAS[Math.floor(Math.random() * ARENAS.length)].id // (só o host sorteia: vai nos dados da cena)
    irParaCena(this, 'PvpArenaN', { personagens: lista, arena, semente: `ffa:${Date.now()}` })
  }
}
