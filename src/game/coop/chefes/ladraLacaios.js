// EXPEDIÇÃO SEMANAL · 1ª luta da Ladra: os PIVETES (os lacaios). Aquecimento de ~2 minutos: o bando de pivetes de
// capuz (a vida somada), golpes simples com os ataques da Ladra em versão leve e SEM roubo nem regra (o roubo chega
// com o tenente). Fica fora da seleção de chefes (`expedicao`, `oculto`).
//   scene.start('CoopArena', { chefe: 'ladraLacaios', nivel, party })
// Formato: ver coop/chefes/index.js.
export default {
  nome: 'Pivetes',
  expedicao: true,
  oculto: true,
  dificuldade: 'facil',
  sprite: 'ladra-lacaios',
  fundo: 'ladra',
  musica: 'queen',
  textoInicial: 'Os pivetes da Ladra cercam a mesa!',
  tema: {
    formas: ['espadas', 'ouros', 'paus', 'copas'],
    cores: { espadas: 0xc8c0ff, ouros: 0xffb060, paus: 0x7fe0a0, copas: 0xff7a8a, barra: 0xff3a3a, bola: 0xffb060 },
    cor: 0xffb060,
  },
  hp: 260,
  danoBala: 11,
  niveis: { medio: { dano: 1.6 }, dificil: { dano: 1.25 } },
  leve: (A) => A.quicantes({ forma: 'ouros', duracao: 3600, intervalo: 1500, velocidade: 130 }),
  fases: [
    {
      hp: 1,
      falas: ['Passa o baralho!', 'A chefe vai adorar essas cartas!', 'Corre, corre!'],
      cartas: [
        ['espadas', 3, 'Bater Carteira', (A) => A.juntos(A.ladraBumerangue({ duracao: 5500, intervalo: 1300 }), A.aimed({ duracao: 5500, intervalo: 1900, velocidade: 115 }))],
        ['ouros', 4, 'Truquezinho', (A) => A.ladraTruque({ duracao: 6000, trocas: 2, troca: 480, gota: 190 })],
        ['paus', 4, 'Sirene', (A) => A.ladraAlarme({ duracao: 6000, intervalo: 2200, vao: 76, velocidade: 55 })],
        ['espadas', 5, 'Moedinhas', (A) => A.juntos(A.quicantes({ forma: 'ouros', duracao: 5500, intervalo: 1100, velocidade: 140 }), A.ladraBumerangue({ duracao: 5500, intervalo: 1800 }))],
        ['copas', 3, 'Dividir o Lucro', null, { cura: 12 }],
      ],
    },
  ],
  super: {
    nome: 'Arrastão',
    texto: 'Os pivetes jogam cartas e moedas de todo lado',
    criar: (A) => A.juntos(A.ladraBumerangue({ duracao: 5000, intervalo: 1000, rajada: 2 }), A.quicantes({ forma: 'ouros', duracao: 5000, intervalo: 1300, velocidade: 140 })),
  },
}
