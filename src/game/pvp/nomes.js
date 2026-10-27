// Quem é cada lado na partida: o NOME DO JOGADOR, não o do personagem (lógica pura,
// testada em __tests__/nomes.test.js). Aparece no HUD, na abertura, no replay do K.O.
// e na tela de resultado; o personagem fica como linha pequena de apoio.
//
//   nomeDoJogador(lado, contexto) -> texto em CAIXA ALTA, filtrado e já encurtado
//     contexto: {
//       rede        true numa sala (LAN/online): os nomes vêm dos membros da sala
//       membros     lan.sala.membros: [{ nome, papel: 'host' | 'convidado' }] (host = lado 0).
//                   O servidor já manda o nome da conta (ou o de convidado, já filtrado)
//       cpu         lado que a CPU comanda (0, 1) ou null
//       contaNome   nome da conta logada neste PC (ou null): vale para o P1 no mesmo PC
//       max         limite de letras (padrão NOME_MAX_HUD)
//     }
//   Mesmo PC: o P1 usa a conta se houver, senão JOGADOR 1; o P2 é JOGADOR 2; a CPU, CPU.
//   Em rede sem o nome do membro (acabou de entrar): JOGADOR 1 / JOGADOR 2.
//   O filtro de palavras é o do resto do jogo (nomeSeguro): nome ofensivo vira JOGADOR.
import { nomeSeguro } from '../../lib/contaRegras.js'

export const NOME_MAX_HUD = 12

// corta com reticências sem passar de `max` letras (conta por letra, não por byte)
export function encurtar(nome, max = NOME_MAX_HUD) {
  const letras = [...String(nome ?? '').trim().replace(/\s+/g, ' ')]
  return letras.length <= max ? letras.join('') : `${letras.slice(0, Math.max(1, max - 1)).join('').trimEnd()}…`
}

export function nomeDoJogador(lado, { rede = false, membros = [], cpu = null, contaNome = null, max = NOME_MAX_HUD } = {}) {
  const padrao = `JOGADOR ${lado + 1}`
  let bruto
  if (rede) {
    const membro = membros.find((m) => m?.papel === (lado === 0 ? 'host' : 'convidado'))
    bruto = membro?.nome
  } else if (lado === cpu) bruto = 'CPU'
  else if (lado === 0) bruto = contaNome
  const nome = encurtar(nomeSeguro(String(bruto ?? '').trim() || padrao), max)
  return (nome || padrao).toUpperCase()
}

// Tamanho de fonte (px) para o nome caber em `larguraPx`: a Pixelify Sans ocupa ~0,6 do
// tamanho por letra. Nunca passa de `max` nem desce de `min`.
export const tamanhoQueCabe = (nome, { max, larguraPx, min = 12 }) => Math.max(min, Math.min(max, Math.floor(larguraPx / (Math.max(1, [...String(nome)].length) * 0.6))))
