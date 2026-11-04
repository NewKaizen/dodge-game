import { criarLicaoDeCartas } from './licaoDeCartas.js'
import { criarMesa, MAO_P3, CHUVA_P3 } from './cartasDoManual.js'

// Página 3 do Manual do Ralsei, "Sua primeira carta": UMA CARTA = UM ATAQUE.
// O Ralsei entrega três cartas baratas do baralho dele (as de verdade: manual/cartasDoManual.js) e o
// jogador vê cada uma "ganhar vida" e soltar o ataque REAL dela no boneco de treino:
//
//   conhecer  jogue qualquer carta: ela vira o ataque dela (qualquer escolha vale)
//   chuva     "qual carta faz CHOVER estrelas?": só a Estrela Gentil (as outras também atacam, de
//             verdade, e o Ralsei diz o que elas fazem; 3 erros: ajuda)
//
// A máquina de estados é a das páginas de cartas (manual/licaoDeCartas.js); a cena é scenes/ManualRalsei3.js.

export const FALAS_INTRO3 = [
  'Página 3! Sabia que cada carta da sua mão é um ATAQUE?',
  'Este é o meu boneco de treino. Ele adora ataques de mentirinha!',
]

// o que o Ralsei diz de cada carta (curtinho; a descrição completa é a da carta, no jogo)
export const SOBRE_A_CARTA = {
  'ralsei-espadas-5': { viva: 'Estrela Gentil! Estrelas caem lá de cima, miradas no boneco.', errou: '' },
  'ralsei-ouros-4': { viva: 'Canção de Ninar! As notas atravessam a caixa de lado.', errou: 'Essa toca notas que atravessam de lado. Chuva cai de CIMA: tente outra!' },
  'ralsei-paus-3': { viva: 'Bolinho Explosivo! Os bolinhos grudam na parede e estouram.', errou: 'Essa faz bolinhos estourarem nas paredes. Chuva cai de CIMA: tente outra!' },
}

export const PASSOS3 = [
  {
    id: 'conhecer',
    titulo: 'Uma carta, um ataque',
    certo: MAO_P3[0],
    instrucao: 'Escolha uma carta e confirme. Ela ganha vida!',
    demo: 'Olha: é só escolher uma e confirmar.',
    acertou: 'Viu? A carta virou o ataque dela. Cada carta tem o SEU ataque!',
    avaliar: (id) => ({ certo: true, acao: 'atacar', falaAcao: SOBRE_A_CARTA[id].viva }),
  },
  {
    id: 'chuva',
    titulo: 'Qual faz chover?',
    certo: CHUVA_P3,
    instrucao: 'Agora um desafio: qual carta faz CHOVER estrelas lá de cima?',
    demo: 'Olha: é a Estrela Gentil! Agora escolha você.',
    acertou: 'Isso! A Estrela Gentil faz chover estrelas. Você leu a carta!',
    avaliar: (id) => (id === CHUVA_P3 ? { certo: true, acao: 'atacar', falaAcao: SOBRE_A_CARTA[id].viva } : { certo: false, acao: 'atacar', falaAcao: SOBRE_A_CARTA[id].viva, fala: SOBRE_A_CARTA[id].errou }),
  },
]

export const TEXTOS3 = {
  concluida: 'Você jogou sua primeira carta! A página 3 está completa.',
  concluidaPulou: 'Página 3 completa! Volte quando quiser para pegar o adesivo que faltou.',
  fim: 'Vamos para a página 4!',
}

// op.passos: o progresso salvo ([null | 'feita' | 'pulada' x2])
export function criarPagina3({ passos = null } = {}) {
  return criarLicaoDeCartas({
    mesa: criarMesa({ mao: MAO_P3, energiaFixa: true, semente: 'manual:p3' }),
    slots: [...MAO_P3],
    passos: PASSOS3,
    falasIntro: FALAS_INTRO3,
    textos: TEXTOS3,
    salvos: passos,
  })
}
