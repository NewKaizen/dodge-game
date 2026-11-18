// BOSS SEMANAL · LADRA DE CARTAS (docs/boss-semanal.md). Formato: ver o comentário em coop/chefes/index.js.
// A cada rodada ela ROUBA uma carta da mão de um jogador (o alvo gira) e, a cada duas rodadas, JOGA a
// mais antiga contra o time (coop/semanal/ladra.js). As roubadas ficam viradas para cima em cima dela e a
// PRÉVIA mostra qual roubada ela vai jogar (coop2.js previaDoChefe, tipo 'roubada').
// Quem acerta a ♣ (armadilha) nela recupera a última roubada (volta para a mão do dono); um SUPER
// recupera todas. `roubadas` diz o que cada naipe roubado vira na mão dela (o efeito da carta do
// jogador, virado contra o time):
//   ♠ golpe        -> cartas bumerangue miradas nos corações (mais e mais rápidas quanto maior o valor)
//   ♦ atraso       -> ela ACELERA as balas (o ♦ do jogador atrasa o chefe; o dela adianta)
//   ♣ armadilha    -> cartas-bomba no espelho dos corações (mais bombas quanto maior o valor)
//   ♥ cura         -> ela se cura (4 × o valor, dobrado como toda cura de chefe) e manda o ataque fraquinho
//
// CO-OP 2.0: a regra PEGA LADRA! (coop/semanal/ladraRegra.js): na esquiva, a carta MARCADA (a roubada que ela vai
// jogar, a da prévia) FOGE pelo quadro; encostar nela devolve para a mão do dono e enche a QUEBRA. Fase 2: fogem
// duas; fase 3: elas correm mais.
//
// Os ataques de assinatura (attacks/ladra*.js): o TRUQUE DAS TRÊS CARTAS (sigam a dama; chove nas colunas das
// bombas), as CARTAS BUMERANGUE (vão pela trilha e voltam), o ALARME do cofre (feixes com um vão atravessando a
// caixa) e A CÓPIA (cartas-bomba no lado espelhado do coração).
// DIFICULDADE (docs/coop-cartas.md "Dificuldade do CO-OP"): boss semanal é o desafio da semana, fica na ponta dura.
import { REGRA_LADRA } from '../semanal/ladraRegra.js'

const forca = (valor) => Math.min(1, Math.max(0, (valor - 2) / 11))
export default {
  nome: 'Ladra de Cartas',
  dificuldade: 'medio',
  semanal: true,
  ladra: true,
  sprite: 'ladra',
  fundo: 'ladra',
  musica: 'queen',
  desafio: { velocidade: 1.12, densidade: 1.12 },
  textoInicial: 'A Ladra de Cartas já está de olho nas suas mãos!',
  tema: {
    formas: ['espadas', 'ouros', 'paus', 'copas'],
    cores: { espadas: 0xc8c0ff, ouros: 0xffb060, paus: 0x7fe0a0, copas: 0xff7a8a, barra: 0xff3a3a, bola: 0xffb060 },
    cor: 0xffb060,
  },
  hp: 520, // era 270 (pegar a carta marcada enche a QUEBRA)
  danoBala: 16, // era 10
  // MÉDIO: um pouco mais de ritmo também (o semanal é o desafio da semana); DIFÍCIL: o ritmo do nível já aperta
  niveis: { medio: { velocidade: 1.05, densidade: 1.12, dano: 2.7, hp: 1.25 }, dificil: { dano: 1.9, hp: 1.15 } },
  regra: REGRA_LADRA,
  leve: (A) => A.juntos(A.quicantes({ forma: 'ouros', duracao: 4500, intervalo: 1600, velocidade: 140 }), A.ladraBumerangue({ duracao: 4500, intervalo: 1700 })),
  roubadas: {
    espadas: (A, valor) => A.ladraBumerangue({ intervalo: 1100 - 300 * forca(valor), rajada: 1 + Math.round(forca(valor) * 2), velocidade: 280 + 60 * forca(valor) }),
    ouros: (A, valor) => A.quicantes({ forma: 'ouros', intervalo: 900 - 300 * forca(valor), velocidade: 150 + 60 * forca(valor) }),
    paus: (A, valor) => A.ladraEspelho({ intervalo: 1800 - 400 * forca(valor), rajada: 1 + Math.round(forca(valor) * 2) }),
    copas: (A) => A.quicantes({ forma: 'copas', duracao: 4000, intervalo: 1500, velocidade: 140 }),
  },
  fases: [
    {
      hp: 1,
      falas: ['Que cartas bonitas...', 'Isso? Achei no chão.', 'Distração é tudo.'],
      cartas: [
        ['espadas', 5, 'Bater Carteira', (A) => A.juntos(A.ladraBumerangue({ intervalo: 850 }), A.aimed({ intervalo: 1300, velocidade: 125 }))],
        ['ouros', 6, 'Truque das Três Cartas', (A) => A.juntos(A.ladraTruque({ trocas: 3, gota: 130 }), A.quicantes({ forma: 'ouros', intervalo: 1100, velocidade: 150 }))],
        ['paus', 5, 'Alarme', (A) => A.juntos(A.ladraAlarme({ intervalo: 1700 }), A.aimed({ intervalo: 1800, velocidade: 120 }))],
        ['espadas', 7, 'Leque de Facas', (A) => A.ladraBumerangue({ intervalo: 1100, rajada: 3 })],
        ['copas', 5, 'Contar o Lucro', null, { cura: 22 }],
      ],
    },
    {
      hp: 0.6,
      entrada: 'Vocês não vão recuperar NADA!',
      velocidadeFundo: 1.5,
      falas: ['Achado não é roubado!', 'Mais uma pra coleção!', 'Cadê a sua carta? Hihi.'],
      cartas: [
        ['ouros', 9, 'Truque Rápido', (A) => A.juntos(A.ladraTruque({ trocas: 5, troca: 360, gota: 120 }), A.ladraBumerangue({ intervalo: 1300 }))],
        ['paus', 10, 'Alarme Cruzado', (A) => A.ladraAlarme({ intervalo: 2300, cruzado: true, velocidade: 66 })],
        ['espadas', 10, 'A Cópia', (A) => A.juntos(A.ladraEspelho({ intervalo: 1400, rajada: 2 }), A.ladraBumerangue({ intervalo: 1200 }))],
        ['espadas', 11, 'Mão Leve', (A) => A.juntos(A.ladraBumerangue({ intervalo: 800, rajada: 2 }), A.ladraEspelho({ intervalo: 1700, rajada: 1 }))],
        ['copas', 8, 'Esconderijo', null, { cura: 18, guarda: 0.6 }],
      ],
    },
    {
      hp: 0.3,
      entrada: 'Hora do GRANDE GOLPE! Sigam a dama, se conseguirem!',
      velocidadeFundo: 2,
      falas: ['Mãos ao alto!', 'O cofre é meu!', 'Quatro cartas, uma dama. Boa sorte!'],
      cartas: [
        ['ouros', 12, 'Quatro Cartas', (A) => A.juntos(A.ladraTruque({ duracao: 7500, cartas: 4, trocas: 6, troca: 330, gota: 110 }), A.ladraBumerangue({ duracao: 7500, intervalo: 1500 }))],
        ['paus', 12, 'Cofre Blindado', (A) => A.juntos(A.ladraAlarme({ intervalo: 1800, deriva: 34, velocidade: 68 }), A.ladraEspelho({ intervalo: 2300, rajada: 1 }))],
        ['espadas', 13, 'Grande Cópia', (A) => A.ladraEspelho({ duracao: 7000, intervalo: 1300, rajada: 3, direcoes: 8, velocidade: 140 })],
        // (o alarme não entra junto com o bumerangue: a carta mirada no coração passaria pelo único vão do feixe)
        ['espadas', 12, 'Chuva de Cartas', (A) => A.juntos(A.ladraBumerangue({ duracao: 7000, intervalo: 1100, rajada: 3, lados: ['left', 'right', 'top', 'bottom'] }), A.ladraEspelho({ duracao: 7000, intervalo: 2600, rajada: 1 }))],
        ['copas', 9, 'Fuga', null, { cura: 20, guarda: 0.5 }],
      ],
    },
  ],
  super: {
    nome: 'Grande Golpe',
    texto: 'A cópia larga cartas-bomba no seu espelho enquanto as cartas bumerangue voam',
    criar: (A) => A.juntos(A.ladraEspelho({ duracao: 7000, intervalo: 1500, rajada: 3 }), A.ladraBumerangue({ duracao: 7000, intervalo: 1100, rajada: 2 })),
  },
}
