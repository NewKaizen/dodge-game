import { criarLicaoDeCartas, PASSAR } from './licaoDeCartas.js'
import { criarMesa, cartaDoManual, MAO_P4, CARA_P4, ENERGIA_P4, ENERGIA } from './cartasDoManual.js'

// Página 4 do Manual do Ralsei, "Nem toda rodada pede ataque": ENERGIA, CUSTO e PASSAR.
// As gemas são a energia de verdade de uma partida (pvp/regras.js: ENERGIA, motivoBloqueio, resolverRodada,
// iniciarRodada), numa mão de custos diferentes (Bolinho 1, Coro de Estrelas 3, o SUPER 10):
//
//   caro     tente o Coro de Estrelas (3) com 2 de energia: a pílula "× falta energia (2/3)" e o porquê
//   passar   PASSAR: +ENERGIA.passar na hora e, na rodada nova, +ENERGIA.porRodada (as gemas enchem)
//   jogar    agora o Coro cabe: ele paga 3 gemas e solta o ataque real no boneco
//
// Errar (a carta que dá mas não é a pedida, o SUPER que ainda não cabe, PASSAR fora de hora) só traz
// uma fala curtinha; 3 erros no mesmo passo: ajuda. A máquina é a das páginas de cartas
// (manual/licaoDeCartas.js); a cena é scenes/ManualRalsei4.js.

const CARA = cartaDoManual(CARA_P4)
const SUPER_P4 = MAO_P4[2]
const BARATA_P4 = MAO_P4[0]

export const FALAS_INTRO4 = [
  'Página 4! Jogar uma carta custa ENERGIA: são estas gemas azuis.',
  `Você tem ${ENERGIA_P4} agora. O número na gema de cada carta é quanto ela custa.`,
]

export const PASSOS4 = [
  {
    id: 'caro',
    titulo: 'Falta energia',
    certo: CARA_P4,
    instrucao: `Tente jogar o ${CARA.nome}, o que custa ${CARA.custo}.`,
    demo: `Olha: é o ${CARA.nome}, com a gema ${CARA.custo}. Agora tente você!`,
    avaliar(id, { mesa }) {
      if (id === PASSAR) return { certo: false, fala: `Ainda não! Primeiro tente o ${CARA.nome}.` }
      if (mesa.bloqueio(id)) {
        const c = cartaDoManual(id)
        return { certo: true, acao: 'negar', fala: `Viu o aviso? Ele custa ${c.custo} e você só tem ${mesa.energia}: falta energia!` }
      }
      return { certo: false, fala: `Essa custa ${cartaDoManual(id).custo}, então dá! Mas experimente o ${CARA.nome}.` }
    },
  },
  {
    id: 'passar',
    titulo: 'Passar a vez',
    certo: PASSAR,
    instrucao: `Sem energia? PASSE a vez: você não joga nada e ganha +${ENERGIA.passar}. Vá até PASSAR.`,
    demo: 'Olha: PASSAR fica no fim da mão. Agora vá você!',
    avaliar(id, { mesa }) {
      if (id === PASSAR) return { certo: true, acao: 'passar', falaAcao: `+${ENERGIA.passar} por passar... e toda rodada nova dá +${ENERGIA.porRodada}!`, fala: () => `Agora você tem ${mesa.energia}! Passar também é uma jogada.` }
      if (mesa.bloqueio(id)) return { certo: false, acao: 'negar', fala: 'Essa ainda não cabe. Vá até PASSAR, no fim da mão.' }
      return { certo: false, fala: 'Essa dá, mas agora vamos juntar energia: escolha PASSAR.' }
    },
    // pulou (ou já tinha feito): o Ralsei passa por você, para a energia do próximo passo estar certa
    aoPular: (mesa) => mesa.passar(),
  },
  {
    id: 'jogar',
    titulo: 'Agora cabe!',
    certo: CARA_P4,
    instrucao: ({ mesa }) => `Agora você tem ${mesa.energia}. O ${CARA.nome} cabe: jogue ele!`,
    demo: `Olha: o ${CARA.nome} agora não tem mais o aviso. Jogue você!`,
    avaliar(id, { mesa }) {
      if (id === CARA_P4) return { certo: true, acao: 'atacar', falaAcao: `O ${CARA.nome} pagou ${CARA.custo} gemas e ganhou vida!`, fala: 'Isso! Nem toda rodada pede ataque: às vezes, passar faz a próxima valer mais.' }
      if (id === PASSAR) return { certo: false, fala: `Agora já dá para jogar: escolha o ${CARA.nome}!` }
      if (id === SUPER_P4 && mesa.bloqueio(id)) return { certo: false, acao: 'negar', fala: `O ★ custa ${cartaDoManual(id).custo}: guarde energia para outro dia. Jogue o ${CARA.nome}!` }
      if (id === BARATA_P4) return { certo: false, fala: `Essa também dá! Mas jogue o ${CARA.nome}, que agora cabe.` }
      return { certo: false, acao: 'negar', fala: `Jogue o ${CARA.nome}!` }
    },
  },
]

export const TEXTOS4 = {
  concluida: 'Você entendeu energia, custo e passar! A página 4 está completa.',
  concluidaPulou: 'Página 4 completa! Volte quando quiser para pegar o adesivo que faltou.',
  fim: 'A página 5 ainda está sendo desenhada… continua!',
}

export const SLOTS4 = [...MAO_P4, PASSAR]

// op.passos: o progresso salvo ([null | 'feita' | 'pulada' x3])
export function criarPagina4({ passos = null } = {}) {
  return criarLicaoDeCartas({
    mesa: criarMesa({ mao: MAO_P4, energia: ENERGIA_P4, semente: 'manual:p4' }),
    slots: SLOTS4,
    passos: PASSOS4,
    falasIntro: FALAS_INTRO4,
    textos: TEXTOS4,
    salvos: passos,
  })
}
