import king from './king.js'
import queen from './queen.js'
import jevil from './jevil.js'
import coronel from './coronel.js'

// Baralhos dos chefes no CO-OP de cartas (lógica pura: os ataques recebem a
// biblioteca attacks/ como parâmetro A, igual aos baralhos do PvP).
//
//   hp        HP do chefe no modo cartas (FÁCIL; o nível multiplica, NIVEIS.hp)
//   danoBala  dano por bala de base (o mesmo do modo clássico; as cartas escalam)
//   leve    (A) => ataque fraquinho que acompanha as cartas ♥ do chefe
//   fases   [{ hp, cartas }] a fase vale quando HP/HP máx <= hp (a 1ª é hp 1).
//           Ao entrar numa fase, o baralho do chefe passa a ser as cartas dela.
//           Carta: [naipe, valor, nome, (A) => ataque, extras?]
//             ♠/♦/♣ mandam o ataque na caixa do jogador mirado
//             ♥ (ataque null): extras { cura, guarda } — o chefe se cura e a
//               guarda reduz o próximo contra-ataque (fator do dano); manda `leve`
//             extras.inverter: inverte os controles durante o ataque
//   super   { nome, texto, criar: (A) => ataque } SUPER do chefe, da 2ª fase em
//           diante (barra de carga): vai nas duas caixas ao mesmo tempo
export const BARALHOS_CHEFES = { king, queen, jevil, coronel }
