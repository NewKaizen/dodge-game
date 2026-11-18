// EXPEDIÇÃO SEMANAL · 2ª luta da Ladra: O RECEPTADOR, o tenente (~3 minutos). Ele compra o que a Ladra rouba: aqui
// o ROUBO já vale (`ladra`, coop/semanal/ladra.js: rouba uma carta por rodada e joga a mais antiga a cada duas) e a
// regra PEGA LADRA! aparece na versão LEVE (a carta marcada foge mais devagar e fica mais tempo no quadro). Os
// ataques da Ladra em versão leve. Fica fora da seleção de chefes (`expedicao`, `oculto`).
//   scene.start('CoopArena', { chefe: 'ladraTenente', nivel, party })
// Formato: ver coop/chefes/index.js.
import { criarRegraLadra } from '../semanal/ladraRegra.js'

const forca = (valor) => Math.min(1, Math.max(0, (valor - 2) / 11))
export default {
  nome: 'O Receptador',
  expedicao: true,
  oculto: true,
  ladra: true,
  dificuldade: 'facil',
  sprite: 'ladra-receptador',
  fundo: 'ladra',
  musica: 'queen',
  textoInicial: 'O Receptador abre o casaco: "Compro carta usada!"',
  tema: {
    formas: ['espadas', 'ouros', 'paus', 'copas'],
    cores: { espadas: 0xc8c0ff, ouros: 0xffb060, paus: 0x7fe0a0, copas: 0xff7a8a, barra: 0xff3a3a, bola: 0xffb060 },
    cor: 0xffb060,
  },
  hp: 420,
  desafio: { velocidade: 1.04, densidade: 1.06 },
  danoBala: 13,
  niveis: { medio: { dano: 1.8 }, dificil: { dano: 1.35 } },
  // a regra da Ladra, leve: só a marcada foge (nas duas fases), mais devagar e por mais tempo
  regra: criarRegraLadra({ porFase: [1, 1], velocidade: [70, 85], janela: [4300, 4000], fases: { 1: { descricao: 'A carta marcada corre mais rápido: cerquem a fujona!' } } }),
  leve: (A) => A.quicantes({ forma: 'ouros', duracao: 3800, intervalo: 1500, velocidade: 135 }),
  roubadas: {
    espadas: (A, valor) => A.ladraBumerangue({ intervalo: 1200 - 300 * forca(valor), rajada: 1 + Math.round(forca(valor)) }),
    ouros: (A, valor) => A.quicantes({ forma: 'ouros', intervalo: 1000 - 300 * forca(valor), velocidade: 145 + 50 * forca(valor) }),
    paus: (A, valor) => A.ladraEspelho({ intervalo: 1900 - 400 * forca(valor), rajada: 1 + Math.round(forca(valor)) }),
    copas: (A) => A.quicantes({ forma: 'copas', duracao: 4000, intervalo: 1500, velocidade: 135 }),
  },
  fases: [
    {
      hp: 1,
      falas: ['Bela carta. Quanto vale?', 'Tudo aqui tem dono... agora é meu.', 'Pegou? Então corre atrás!'],
      cartas: [
        ['espadas', 5, 'Mostruário', (A) => A.juntos(A.ladraBumerangue({ duracao: 6000, intervalo: 1100 }), A.aimed({ duracao: 6000, intervalo: 1700, velocidade: 120 }))],
        ['ouros', 6, 'Truque de Feira', (A) => A.juntos(A.ladraTruque({ duracao: 6500, trocas: 3, gota: 160 }), A.quicantes({ forma: 'ouros', duracao: 6500, intervalo: 1600, velocidade: 140 }))],
        ['paus', 5, 'Alarme da Loja', (A) => A.ladraAlarme({ duracao: 6500, intervalo: 1900, vao: 72 })],
        ['espadas', 6, 'Cópia Barata', (A) => A.ladraEspelho({ duracao: 6000, intervalo: 1600, rajada: 1 })],
        ['copas', 4, 'Contar as Moedas', null, { cura: 18 }],
      ],
    },
    {
      hp: 0.5,
      entrada: 'Liquidação! Tudo que é de vocês, pela metade do preço!',
      velocidadeFundo: 1.4,
      falas: ['Leva dois, paga três!', 'Essa carta? Já vendi.', 'Sem devolução!'],
      cartas: [
        ['ouros', 8, 'Truque Ligeiro', (A) => A.juntos(A.ladraTruque({ duracao: 6500, trocas: 4, troca: 400, gota: 140 }), A.ladraBumerangue({ duracao: 6500, intervalo: 1800 }))],
        ['paus', 8, 'Sirene Dupla', (A) => A.ladraAlarme({ duracao: 6500, intervalo: 2500, cruzado: true, vao: 72 })],
        ['espadas', 8, 'Cópia Pirata', (A) => A.juntos(A.ladraEspelho({ duracao: 6500, intervalo: 1600, rajada: 2 }), A.ladraBumerangue({ duracao: 6500, intervalo: 1700 }))],
        ['espadas', 9, 'Leque de Facas', (A) => A.ladraBumerangue({ duracao: 6500, intervalo: 1300, rajada: 3 })],
        ['copas', 6, 'Caixa Dois', null, { cura: 14, guarda: 0.7 }],
      ],
    },
  ],
  super: {
    nome: 'Queima de Estoque',
    texto: 'Cartas-bomba no espelho e cartas bumerangue saindo do casaco',
    criar: (A) => A.juntos(A.ladraEspelho({ duracao: 6000, intervalo: 1700, rajada: 2 }), A.ladraBumerangue({ duracao: 6000, intervalo: 1300, rajada: 2 })),
  },
}
