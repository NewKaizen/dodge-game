// Quantos jogadores locais há (1 ou 2), decidido sozinho pelo jogo: lógica pura,
// testada em Node (__tests__/jogadores.test.js). Não existe botão para escolher.
//
// De onde vem o número (`numJogadores` do store `jogo`, a única fonte da verdade):
//   1. Fontes distintas: com DUAS fontes de entrada diferentes ativas (2 controles;
//      controle + teclado; joystick serial + teclado ou + controle) são 2 jogadores,
//      na hora, com o aviso "JOGADOR 2 ENTROU (<dispositivo>)". O teclado inteiro
//      (WASD e setas) conta como UMA fonte.
//   2. Só teclado (duas pessoas no mesmo teclado): não dá para saber pelas teclas,
//      porque em modo 1 jogador os dois conjuntos comandam o jogador 1. Nas telas de
//      escolha do PVP e do CO-OP, o A do jogador 2 (Enter) entra e o B dele sai,
//      enquanto ninguém confirmou (reagirAoBotaoP2).
//
// Regras:
//   - Nunca muda no meio da partida: só nas CENAS_LIVRES (menu e telas de escolha).
//     Numa cena fora da lista a mudança espera até voltar a uma livre.
//   - Fonte que some (controle desligado, nada a fazer): NÃO derruba para 1 no meio
//     do fluxo. O número só volta a 1 no MENU PRINCIPAL, e só se não restarem duas
//     fontes. Quem entrou pelo teclado também volta a 1 ao passar pelo menu.
//   - Sala LAN/online: não mexe (a sala tem a sua regra, lib/lan/rede.js).
//
//   contarFontes({ teclado, pads, serial })        quantas fontes distintas
//   fonteNova(antes, depois)                       'controle' | 'joystick serial' | 'teclado' | null
//   decidirJogadores({ numero, p2Teclado, fontes, cenas, emSala })   { numero, p2Teclado, motivo }
//   reagirAoBotaoP2({ ... })                       'entrar' | 'sair' | null
//   criarDetector({ aplicar, avisar })             .avaliar(estado) a cada mudança de fonte ou de cena

export const CENA_MENU = 'Menu'
// cenas onde o número pode mudar: as que refazem os controles ao mudar (changedata-numJogadores)
export const CENAS_LIVRES = [CENA_MENU, 'PvpEscolha', 'EscolhaParty', 'Grimorio']

// Enter chama o P2 (não confirma): quem joga sozinho no teclado confirma com ESPAÇO
export const DICA_ENTRAR_P2 = 'ESPAÇO: confirmar     JOGADOR 2: ENTER (ou A no 2º controle) para entrar'
export const DICA_SAIR_P2 = 'JOGADOR 2: aperte B (Backspace) para sair e jogar sozinho'
// o toast do primeiro Enter: quem só queria confirmar sabe o que houve e como desfazer
export const AVISO_P2_ENTRANDO = { titulo: 'JOGADOR 2 ENTRANDO', texto: 'aperte B (Backspace) para cancelar' }

export function contarFontes({ teclado = false, pads = 0, serial = false } = {}) {
  return (teclado ? 1 : 0) + Math.max(0, Math.floor(pads) || 0) + (serial ? 1 : 0)
}

// o que foi ligado entre `antes` e `depois` (os dois no formato de contarFontes)
export function fonteNova(antes = {}, depois = {}) {
  if ((depois.pads ?? 0) > (antes.pads ?? 0)) return 'controle'
  if (depois.serial && !antes.serial) return 'joystick serial'
  if (depois.teclado && !antes.teclado) return 'teclado'
  return null
}

export const cenasLivres = (cenas) => Array.isArray(cenas) && cenas.length > 0 && cenas.every((c) => CENAS_LIVRES.includes(c))

// Próximo número de jogadores. `cenas` = chaves das cenas ativas agora.
// motivo: 'fontes' (duas fontes), 'menu' (voltou a 1 no menu) ou null (nada mudou)
export function decidirJogadores({ numero = 1, p2Teclado = false, fontes = 0, cenas = [], emSala = false } = {}) {
  const igual = { numero, p2Teclado: p2Teclado && numero === 2, motivo: null }
  if (emSala || !cenasLivres(cenas)) return igual // sala e partida têm a regra delas
  if (fontes >= 2) {
    if (numero === 2) return igual
    return { numero: 2, p2Teclado: false, motivo: 'fontes' }
  }
  if (cenas.includes(CENA_MENU) && numero !== 1) return { numero: 1, p2Teclado: false, motivo: 'menu' }
  return igual
}

// O B/A do jogador 2 numa tela de escolha (PVP, party do CO-OP). `origem` é de qual
// conjunto o botão veio (0 = jogador 1, 1 = jogador 2), que o modo 1 jogador esconde.
//   entrar  em 1 jogador, A do jogador 2, ninguém confirmou ainda
//   sair    em 2 jogadores entrados pelo teclado, B do jogador 2, ninguém confirmou
//           (com duas fontes de verdade o B não tira o jogador: ele continua lá)
export function reagirAoBotaoP2({ numero = 1, p2Teclado = false, fontes = 0, botao, origem, algoConfirmado = false, emRede = false } = {}) {
  if (emRede || algoConfirmado || origem !== 1) return null
  if (numero === 1 && botao === 'A') return 'entrar'
  if (numero === 2 && p2Teclado && fontes < 2 && botao === 'B') return 'sair'
  return null
}

// O que as telas de escolha mostram embaixo (null = nada)
export function dicaP2({ numero = 1, p2Teclado = false, fontes = 0, algoConfirmado = false, emRede = false } = {}) {
  if (emRede || algoConfirmado) return null
  if (numero === 1) return DICA_ENTRAR_P2
  return p2Teclado && fontes < 2 ? DICA_SAIR_P2 : null
}

export const textoJogador2 = (dispositivo) => `JOGADOR 2 ENTROU (${dispositivo})`

// Junta tudo: chame avaliar() quando uma fonte ou a cena mudar. `aplicar({ numero, p2Teclado })`
// grava no store; `avisar(texto)` mostra o toast (só quando o 2º jogador entra por uma fonte nova).
export function criarDetector({ aplicar, avisar = () => {} }) {
  let antes = { teclado: false, pads: 0, serial: false }
  let segundo = null // o dispositivo que passou de 1 para 2 fontes (o aviso fala dele, mesmo se esperou a cena)
  return {
    avaliar({ numero, p2Teclado = false, teclado = false, pads = 0, serial = false, cenas = [], emSala = false }) {
      const agora = { teclado: Boolean(teclado), pads, serial: Boolean(serial) }
      const fontes = contarFontes(agora)
      if (fontes < 2) segundo = null
      else if (contarFontes(antes) < 2) segundo = fonteNova(antes, agora) ?? segundo ?? 'outro controle'
      antes = agora

      const r = decidirJogadores({ numero, p2Teclado, fontes, cenas, emSala })
      if (r.numero !== numero || r.p2Teclado !== p2Teclado) aplicar({ numero: r.numero, p2Teclado: r.p2Teclado })
      if (r.motivo === 'fontes') avisar(textoJogador2(segundo ?? 'outro controle'))
      return r
    },
  }
}
