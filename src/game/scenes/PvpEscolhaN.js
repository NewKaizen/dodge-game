import EscolhaPartyN from './EscolhaPartyN.js'
import { irParaCena } from '../rede.js'
import { ARENAS } from '../pvp/arenas.js'
import { get } from 'svelte/store'
import { lan } from '../../lib/lan/rede.js'
import { timesDoArranjo } from '../../lib/times2x2.js'

// Escolha de lutador do TODOS CONTRA TODOS (3 e 4, online; Fase 5D, docs/pvp-regras.md "Todos contra
// todos"): a mesma tela da party do CO-OP de 3 e 4 (EscolhaPartyN: cada um escolhe o PRÓPRIO personagem na
// mesma grade, sem repetir, quem arbitra é o host; B antes de alguém confirmar volta todos ao lobby). Sem
// repetir para as 3–4 caixas ficarem fáceis de distinguir (cor da vaga + forma + nome + personagem).
// No fim o HOST sorteia a arena (fundo e música; no todos contra todos não há rodada bônus nem votação) e
// leva todos à PvpArenaN com os personagens por vaga.
// 2x2 (Fase 5E): a mesma tela; o modo e os times (o arranjo da sala, TROCAR TIME) vão nos dados da arena.
export default class PvpEscolhaN extends EscolhaPartyN {
  constructor() {
    super('PvpEscolhaN')
  }

  get dupla() {
    return get(lan).sala?.modo === '2x2'
  }

  tituloDaTela() {
    return this.dupla ? '2x2: ESCOLHA O LUTADOR' : 'TODOS CONTRA TODOS: ESCOLHA O LUTADOR'
  }

  textoPronto() {
    return 'LUTADORES PRONTOS!'
  }

  irParaLuta(lista) {
    const arena = ARENAS[Math.floor(Math.random() * ARENAS.length)].id // (só o host sorteia: vai nos dados da cena)
    if (this.dupla && lista.length === 4) return irParaCena(this, 'PvpArenaN', { personagens: lista, arena, semente: `2x2:${Date.now()}`, modo: '2x2', times: timesDoArranjo(get(lan).sala?.arranjo) })
    irParaCena(this, 'PvpArenaN', { personagens: lista, arena, semente: `ffa:${Date.now()}` })
  }
}
