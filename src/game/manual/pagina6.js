import { criarLicaoDeCartas } from './licaoDeCartas.js'
import { criarMesa, MAO_P6, ESPADAS_P6, COPAS_P6, OUROS_P6, PAUS_P6 } from './cartasDoManual.js'

// Página 6 do Manual do Ralsei (EXTRA), "Os quatro naipes": o naipe diz o que a carta faz.
// Uma carta de cada naipe do baralho do Ralsei (as de verdade: manual/cartasDoManual.js), cada uma solta o
// ataque REAL dela no boneco de treino (a mesma máquina das páginas 3 e 4: manual/licaoDeCartas.js):
//
//   espadas   (PVP)   ♠ ataque direto: o que mais dá dano por bala
//   ouros     (PVP)   ♦ controle: balas mais rápidas e a caixa do adversário menor (Q e K invertem os controles)
//   paus      (PVP)   ♣ armadilha: bombas, lasers, colunas, ondas
//   copas     (PVP)   ♥ suporte em QUEM JOGA: cura, escudo, energia ou compra (manda só um ataque fraquinho)
//   coop      (CO-OP) contra o chefe: qual naipe ATRASA o ataque dele, para os dois? (♦)
//
// Os números das falas vêm das regras (docs/pvp-regras.md e docs/coop-cartas.md). A cena é a das páginas de
// cartas (scenes/ManualRalsei3.js, com a página 6 em scenes/ManualRalsei6.js).

export const FALAS_INTRO6 = [
  'Página 6, um extra! Toda carta tem um NAIPE, e o naipe diz o que ela faz.',
  'São quatro: ♠ espadas, ♦ ouros, ♣ paus e ♥ copas. Vamos conhecer um por um!',
]

const outroNaipe = (nome) => `Essa é de outro naipe. Procure ${nome}!`

export const PASSOS6 = [
  {
    id: 'espadas',
    titulo: '♠ Espadas',
    certo: ESPADAS_P6,
    instrucao: 'Comece pelo ♠ ESPADAS, o ataque direto. Escolha a Estrela Gentil.',
    demo: 'Olha: a Estrela Gentil é a de ♠ espadas. Agora escolha você!',
    acertou: 'Espadas batem forte: é o ataque direto. No PVP, quanto maior o valor da carta, mais dano por bala.',
    avaliar: (id) => (id === ESPADAS_P6 ? { certo: true, acao: 'atacar', falaAcao: '♠ Espadas: ataque direto! É o naipe que mais dá dano por bala.' } : { certo: false, fala: outroNaipe('o ♠ ESPADAS, a Estrela Gentil') }),
  },
  {
    id: 'ouros',
    titulo: '♦ Ouros',
    certo: OUROS_P6,
    instrucao: 'Agora o ♦ OUROS, o controle. Escolha a Canção de Ninar.',
    demo: 'Olha: a Canção de Ninar é a de ♦ ouros. Agora escolha você!',
    acertou: 'Ouros controlam: deixam as balas mais rápidas e a caixa do adversário menor. As cartas altas (Q e K) ainda invertem os controles dele!',
    avaliar: (id) => (id === OUROS_P6 ? { certo: true, acao: 'atacar', falaAcao: '♦ Ouros: controle! Balas mais rápidas e uma caixa menor para o adversário.' } : { certo: false, fala: outroNaipe('o ♦ OUROS, a Canção de Ninar') }),
  },
  {
    id: 'paus',
    titulo: '♣ Paus',
    certo: PAUS_P6,
    instrucao: 'O ♣ PAUS é a armadilha. Escolha o Bolinho Explosivo.',
    demo: 'Olha: o Bolinho Explosivo é o de ♣ paus. Agora escolha você!',
    acertou: 'Paus armam ciladas: bombas, lasers, colunas e ondas que pegam quem não olha o cenário.',
    avaliar: (id) => (id === PAUS_P6 ? { certo: true, acao: 'atacar', falaAcao: '♣ Paus: armadilha! Bolinhos que grudam nas paredes e estouram.' } : { certo: false, fala: outroNaipe('o ♣ PAUS, o Bolinho Explosivo') }),
  },
  {
    id: 'copas',
    titulo: '♥ Copas',
    certo: COPAS_P6,
    instrucao: 'O ♥ COPAS é diferente: ajuda quem joga. Escolha o Chá Quentinho.',
    demo: 'Olha: o Chá Quentinho é o de ♥ copas. Agora escolha você!',
    acertou: 'Copas cuidam de você: curam, dão escudo, energia ou cartas extras. Em troca, mandam só um ataque fraquinho.',
    avaliar: (id) => (id === COPAS_P6 ? { certo: true, acao: 'atacar', falaAcao: '♥ Copas: suporte! Este chá cura 7 de vida em quem jogou e manda só um ataque fraquinho.' } : { certo: false, fala: outroNaipe('o ♥ COPAS, o Chá Quentinho') }),
  },
  {
    id: 'coop',
    titulo: 'No CO-OP',
    certo: OUROS_P6,
    instrucao: 'No CO-OP vocês enfrentam um chefe. Qual naipe ATRASA o ataque dele, para os dois?',
    demo: 'Olha: o naipe de CONTROLE é o ♦ ouros. Agora escolha você!',
    acertou: 'No CO-OP, ♦ atrasa o ataque do chefe para a dupla toda. Os outros: ♠ golpe forte, ♣ bate mais a cada graze e ♥ cura os dois!',
    avaliar: (id) => {
      if (id === OUROS_P6) return { certo: true, acao: 'atacar', falaAcao: 'Isso! Contra o chefe, ♦ deixa o ataque dele 15% mais lento, para os dois.' }
      const fala = {
        [ESPADAS_P6]: 'Espadas dão um golpe forte no chefe, mas não atrasam o ataque dele. Qual naipe é o de CONTROLE?',
        [COPAS_P6]: 'No CO-OP a cura de ♥ vale para os DOIS, mas não atrasa nada. Procure o naipe de controle!',
        [PAUS_P6]: 'Paus batem mais a cada graze no CO-OP, mas não atrasam o ataque. Procure o naipe de controle!',
      }[id]
      return { certo: false, fala }
    },
  },
]

export const TEXTOS6 = {
  concluida: 'Você conhece os quatro naipes! A página 6 está completa.',
  concluidaPulou: 'Página 6 completa! Volte quando quiser para pegar o adesivo que faltou.',
  fim: 'Vamos para a página 7!',
}

// op.passos: o progresso salvo ([null | 'feita' | 'pulada' x5])
export function criarPagina6({ passos = null } = {}) {
  return criarLicaoDeCartas({
    mesa: criarMesa({ mao: MAO_P6, energiaFixa: true, semente: 'manual:p6' }),
    slots: [...MAO_P6],
    passos: PASSOS6,
    falasIntro: FALAS_INTRO6,
    textos: TEXTOS6,
    salvos: passos,
  })
}
