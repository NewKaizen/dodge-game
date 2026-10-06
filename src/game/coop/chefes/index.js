import king from './king.js'
import queen from './queen.js'
import jevil from './jevil.js'
import coronel from './coronel.js'

// Chefes do CO-OP de cartas, na ordem da tela de seleção. Lógica pura: os
// ataques recebem a biblioteca attacks/ como parâmetro A (como no PvP).
//
//   nome, dificuldade        DIFICULDADES (constants.js): teto de velocidade das balas
//   sprite, fundo, musica    textura, fundo animado (backgrounds/) e música (<musica>.mid)
//   desafio                  opcional { velocidade, densidade }: aperto só deste chefe
//   textoInicial             fala da abertura da luta
//   tema                     { formas, cores, cor } das balas e das cartas do chefe
//   hp                       HP no FÁCIL (o nível multiplica, NIVEIS.hp)
//   danoBala                 dano por bala de base (as cartas escalam pelo valor)
//   leve                     (A) => ataque fraquinho que acompanha as cartas ♥ do chefe
//   fases                    [{ hp, entrada?, velocidadeFundo?, falas, cartas }]
//                            a fase vale quando HP/HP máx <= hp (a 1ª é hp 1); ao entrar
//                            nela, o baralho do chefe passa a ser as cartas dela.
//                            Carta: [naipe, valor, nome, (A) => ataque, extras?]
//                              ♠/♦/♣ mandam o ataque na caixa do jogador mirado
//                              ♥ (ataque null): extras { cura, guarda } — o chefe se cura e a
//                                guarda reduz o próximo contra-ataque (fator do dano); manda `leve`
//                              extras.inverter: inverte os controles durante o ataque
//   super                    { nome, texto, criar: (A) => ataque } SUPER do chefe, da 2ª
//                            fase em diante (barra de carga): vai nas duas caixas
export const CHEFES = { king, queen, jevil, coronel }
export const ORDEM_CHEFES = ['king', 'queen', 'jevil', 'coronel']
