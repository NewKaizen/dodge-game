// Liga pvp/nomes.js ao jogo de verdade: lê a sala (lan) e a conta logada.
//   nomesDaPartida({ rede, cpu, max? }) -> [nome do P1, nome do P2]
import { get } from 'svelte/store'
import { lan } from '../../lib/lan/rede.js'
import { conta } from '../../lib/conta.js'
import { nomeDoJogador } from './nomes.js'

export function nomesDaPartida({ rede = false, cpu = null, max } = {}) {
  const c = get(conta)
  const contaNome = c.estado === 'logado' ? c.perfil?.nome_exibicao ?? null : null
  const membros = get(lan).sala?.membros ?? []
  return [0, 1].map((lado) => nomeDoJogador(lado, { rede, membros, cpu, contaNome, max }))
}
