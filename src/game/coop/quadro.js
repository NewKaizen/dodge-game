import { CENTRO_X } from '../constants.js'

// O QUADRO ÚNICO do CO-OP de cartas (docs/coop-cartas.md): a caixa onde os
// dois jogadores desviam juntos do MESMO ataque do chefe. Lógica pura (sem
// Phaser): a CoopArena monta a Pista com isto, e scripts/balanceamento/
// medirChefes.mjs (modo quadro) mede as cartas do chefe nesta mesma caixa.
//
// Fica no meio da mesa, embaixo do chefe (o sprite dele termina por volta de
// y 250): mais larga que a caixa de um jogador (220 x 170 no PvP) para os dois
// corações caberem com espaço. Durante a esquiva as mãos descem até sumir, então
// a parte de baixo da mesa é do quadro (e, embaixo dele, o nome do ataque).
//   x, y, largura, altura   centro e tamanho padrão
//   campo                   até onde a caixa dinâmica pode ir (não passa do chefe,
//                           nem dos personagens nos cantos, nem da pontinha das mãos)
//   faixa                   onde aparece o que vem chegando de fora (BattleBox.aproximar)
//   ritmo                   aperto extra do ataque no quadro (multiplica o ritmo da luta).
//                           Os ataques se espalham pela caixa toda e os mirados alternam
//                           entre os dois corações: no quadro maior, sem isto, cada coração
//                           levava em média 23% menos acertos que na caixa de um jogador
//                           (medirChefes.mjs); com mais 30% de densidade volta ao de antes
export const QUADRO = {
  x: CENTRO_X,
  y: 350,
  largura: 336,
  altura: 180,
  ritmo: { velocidade: 1, densidade: 1.3 },
  campo: { esquerda: CENTRO_X - 228, direita: CENTRO_X + 228, topo: 252, base: 448 },
  faixa: { esquerda: CENTRO_X - 248, direita: CENTRO_X + 248, topo: 244, base: 456 },
}

// Onde cada coração aparece quando o quadro abre (os dois lado a lado, embaixo):
// k = 0 (P1, à esquerda) ou 1 (P2, à direita); limites = retângulo da caixa
export function inicioDoCoracao(limites, k) {
  return { x: limites.x + (limites.width * (k + 1)) / 3, y: limites.bottom - 30 }
}
