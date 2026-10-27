import { get } from 'svelte/store'
import { jogo } from '../lib/estado.js'
import { contarFontes, reagirAoBotaoP2, dicaP2, AVISO_P2_ENTRANDO } from './jogadores.js'
import { avisar } from './conta/avisos.js'

// Ponte entre as telas de escolha e o store (a regra pura está em jogadores.js).
//
//   estadoP2(algoConfirmado)     { acao, dica } para o botão/rodapé desta tela agora
//   pedirP2(botao, origem, algoConfirmado)   true se o botão era do jogador 2 entrando/saindo
//        (já trocou numJogadores: a tela recomeça sozinha, como com qualquer mudança)

export const fontesAgora = () => {
  const s = get(jogo)
  return { s, fontes: contarFontes({ teclado: s.fontes.teclado, pads: s.pads, serial: s.fontes.serial }) }
}

export function dicaDoP2(algoConfirmado, emRede = false) {
  const { s, fontes } = fontesAgora()
  return dicaP2({ numero: s.numJogadores, p2Teclado: s.p2Teclado, fontes, algoConfirmado, emRede })
}

export function pedirP2(botao, origem, algoConfirmado, emRede = false) {
  const { s, fontes } = fontesAgora()
  const acao = reagirAoBotaoP2({ numero: s.numJogadores, p2Teclado: s.p2Teclado, fontes, botao, origem, algoConfirmado, emRede })
  if (!acao) return false
  if (acao === 'entrar') {
    jogo.update((x) => ({ ...x, numJogadores: 2, p2Teclado: true }))
    avisar({ id: `p2:${Date.now()}`, tipo: 'info', ...AVISO_P2_ENTRANDO, ms: 4500 })
  } else {
    jogo.update((x) => ({ ...x, numJogadores: 1, p2Teclado: false }))
    avisar({ id: `p2:${Date.now()}`, tipo: 'info', titulo: 'JOGADOR 2 SAIU', texto: 'voltou a 1 jogador: confirme com ESPAÇO', ms: 3500 })
  }
  return true
}
