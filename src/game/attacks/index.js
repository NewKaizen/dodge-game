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
// Regras (ver constants.js ATAQUE e attacks/validacao.js): toda bala pisca
// por ATAQUE.telegrafoMs antes de valer (ou vem depois de um a.aviso), toda
// parede declara suas lacunas com a.parede(), e a velocidade é limitada pela
// dificuldade do chefe.
//
// No console do navegador (modo dev, durante a batalha):
//   testarAtaque(ataques.spiral({ bracos: 5 }))
//   listarAtaques()
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
  juntos,
  sequencia,
  comCaixa,
}

export const PADROES = Object.keys(ataques).filter((nome) => !['juntos', 'sequencia', 'comCaixa'].includes(nome))
