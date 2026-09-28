import king from './king.js'
import queen from './queen.js'
import jevil from './jevil.js'

// Chefes selecionáveis, na ordem da tela de seleção.
//
// Campos de um chefe (veja king.js como exemplo completo):
//   id, nome
//   dificuldade        chave de DIFICULDADES (constants.js): velocidade máxima das balas
//   sprite, fundo, musica   chaves de textura (assets.js), fundo (backgrounds/) e música
//   hp, defesa, danoBala    balanceamento (danoBala = dano de cada bala antes da defesa)
//   rotuloMercy        nome da barra de MERCY (ex.: 'CANSAÇO')
//   descricao          texto do Check
//   textoInicial       primeira mensagem da batalha
//   inventario         { idDoItem: quantidade } (itens em data/itens.js)
//   tema               { formas, cores, cor } das balas
//   acts               [{ nome, custoTP?, executar(ctx) }] (ctx em Battle.contextoAcao)
//   podePoupar(chefe)  condição do SPARE (padrão: MERCY >= 100)
//   textoNaoPoupa(chefe)   mensagem quando o SPARE falha
//   aoFimDoTurno(chefe, ctx)   opcional, roda depois de cada ataque
//   fases              [{ hp, entrada, falas, flavor, ataques, velocidadeFundo }]
//                      a fase vale quando HP/HP máx <= hp; ataques rodam em ordem, um por turno
export const CHEFES = { king, queen, jevil }
export const ORDEM_CHEFES = ['king', 'queen', 'jevil']
