import { juntos, sequencia, comCaixa } from './definir.js'
import rain from './rain.js'
import sides from './sides.js'
import spiral from './spiral.js'
import aimed from './aimed.js'
import colunas from './colunas.js'
import ondas from './ondas.js'
import lasers from './lasers.js'
import quicantes from './quicantes.js'
import anel from './anel.js'
import divisores from './divisores.js'
import carrossel from './carrossel.js'
import foice from './foice.js'
import bombas from './bombas.js'
import caminhonete from './caminhonete.js'
import brasas from './brasas.js'
import forcado from './forcado.js'
import rachaduras from './rachaduras.js'
import caosFinal from './caosFinal.js'
import garras from './garras.js'
import mandibula from './mandibula.js'
import arremesso from './arremesso.js'
import coronelCaminhao from './coronelCaminhao.js'
import coronelEntulho from './coronelEntulho.js'
import coronelBuzinaco from './coronelBuzinaco.js'
import coronelCompactador from './coronelCompactador.js'
import coronelLatas from './coronelLatas.js'
import coronelRatos from './coronelRatos.js'
import coronelTriagem from './coronelTriagem.js'
import coronelRe from './coronelRe.js'
import kingXeque from './kingXeque.js'
import kingMuralha from './kingMuralha.js'
import kingCavalgada from './kingCavalgada.js'
import queenPopup from './queenPopup.js'
import queenCarregando from './queenCarregando.js'
import queenCursor from './queenCursor.js'
import queenPulso from './queenPulso.js'
import jevilRoleta from './jevilRoleta.js'
import jevilMalabares from './jevilMalabares.js'
import jevilOrbita from './jevilOrbita.js'
import escuridaoMaos from './escuridaoMaos.js'
import escuridaoEco from './escuridaoEco.js'
import escuridaoOlhar from './escuridaoOlhar.js'
import escuridaoVelas from './escuridaoVelas.js'
import ladraTruque from './ladraTruque.js'
import ladraBumerangue from './ladraBumerangue.js'
import ladraAlarme from './ladraAlarme.js'
import ladraEspelho from './ladraEspelho.js'
import { ataquesSuper } from './super/index.js'
import { ataquesHabilidades } from './habilidades/index.js'

// Todos os ataques disponíveis. Para criar um novo, copie um arquivo desta
// pasta, mude nome/padrao/iniciar e adicione aqui.
//
//   ataques.rain()                                    valores padrão
//   ataques.rain({ velocidade: 300, intervalo: 60 })  configurado
//   ataques.juntos(ataques.rain(), ataques.aimed())   ao mesmo tempo
//   ataques.sequencia(ataques.sides(), ataques.spiral())  um depois do outro
//   ataques.rain({ caixa: null })                     sem mudar a caixa (rain, sides, aimed, spiral e caminhonete mudam por padrão)
//   ataques.comCaixa({ largura: 180, altura: 180 }, ataques.juntos(...))  outra caixa para um grupo
//
// Regras (ver docs/ataques.md, constants.js ATAQUE e attacks/validacao.js):
// projéteis nascem fora da caixa e entram (`entrando: true`; a entrada é o
// aviso); senão a bala pisca por ATAQUE.telegrafoMs antes de valer (ou vem
// depois de um a.aviso). Toda parede declara suas lacunas com a.parede(), os
// sorteios usam a semente do contexto, e a velocidade é limitada pela
// dificuldade do chefe.
export const ataques = {
  rain,
  sides,
  spiral,
  aimed,
  colunas,
  ondas,
  lasers,
  quicantes,
  anel,
  divisores,
  carrossel,
  foice,
  bombas,
  caminhonete,
  brasas,
  forcado,
  rachaduras,
  caosFinal,
  garras, // (campanha) garras do Silêncio
  mandibula, // (campanha) a boca que fecha
  arremesso, // (campanha) o titã joga as cartas da sua mão
  coronelCaminhao, // (Coronel Caçamba) o caminhão de lixo cruzando as faixas acesas
  coronelEntulho, // (Coronel Caçamba) a chuva de entulho com a sombra crescendo
  coronelBuzinaco, // (Coronel Caçamba) a onda de som que empurra
  coronelCompactador, // (Coronel Caçamba) as placas que fecham, com um vão
  // os ataques de assinatura do CO-OP difícil (docs/coop-cartas.md "Dificuldade do CO-OP")
  coronelLatas, // (Coronel Caçamba) latas que caem e quicam no chão
  coronelRatos, // (Coronel Caçamba) bandos de ratos avisados pelos olhinhos na borda
  coronelTriagem, // (Coronel Caçamba) coleta seletiva: o lixo só machuca na coluna da cor errada
  coronelRe, // (Coronel Caçamba) o caminhão de ré que despeja a caçamba
  kingXeque, // (Chaos King) as linhas de xeque da torre e do bispo cruzando no coração
  kingMuralha, // (Chaos King) a muralha de peões que marcha e é promovida
  kingCavalgada, // (Chaos King) cavalos que saltam em L e caem onde o coração estava
  queenPopup, // (Queen) janelas de pop-up que fecham e estouram
  queenCarregando, // (Queen) a barra de progresso que vira laser
  queenCursor, // (Queen) a setinha que persegue e clica
  queenPulso, // (Queen) anéis de sinal que só machucam na batida
  jevilRoleta, // (Jevil) a roleta com lâminas e o leque da bolinha
  jevilMalabares, // (Jevil) bombas em malabarismo que explodem em naipes
  jevilOrbita, // (Jevil) o anel de ouros que fecha em volta do coração
  escuridaoMaos, // (Escuridão, semanal) a mão da sombra que sai da poça na borda pela faixa acesa
  escuridaoEco, // (Escuridão, semanal) o sino que toca um anel com brecha e ecoa do lado espelhado
  escuridaoOlhar, // (Escuridão, semanal) o olho na borda que varre um leque com o olhar
  escuridaoVelas, // (Escuridão, semanal) velas que tremem e apagam estourando em estilhaços
  ladraTruque, // (Ladra, semanal) o truque das três cartas: sigam a dama, chove nas colunas das bombas
  ladraBumerangue, // (Ladra, semanal) cartas que vão pela trilha pontilhada e voltam
  ladraAlarme, // (Ladra, semanal) feixes do alarme que atravessam a caixa com um vão
  ladraEspelho, // (Ladra, semanal) a cópia larga cartas-bomba no espelho do coração
  ...ataquesSuper, // superKris, superSusie... (cartas SUPER)
  ...ataquesHabilidades, // krisEstocadaDupla, susieCabecada... (cartas normais, ver habilidades/)
  juntos,
  sequencia,
  comCaixa,
}
