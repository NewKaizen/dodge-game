// BOSS SEMANAL · LADRA DE CARTAS (docs/boss-semanal.md). Formato: ver o comentário em coop/chefes/index.js.
// A cada rodada ela ROUBA uma carta da mão de um jogador (o alvo gira) e, a cada duas rodadas, JOGA a
// mais antiga contra o time (coop/semanal/ladra.js). As roubadas ficam viradas para cima em cima dela.
// Quem acerta a ♣ (armadilha) nela recupera a última roubada (volta para a mão do dono); um SUPER
// recupera todas. `roubadas` diz o que cada naipe roubado vira na mão dela (o efeito da carta do
// jogador, virado contra o time):
//   ♠ golpe        -> tiros mirados nos corações (mais fortes quanto maior o valor)
//   ♦ atraso       -> ela ACELERA as balas (o ♦ do jogador atrasa o chefe; o dela adianta)
//   ♣ armadilha    -> bombas plantadas perto dos corações
//   ♥ cura         -> ela se cura (4 × o valor, dobrado como toda cura de chefe) e manda o ataque fraquinho
const forca = (valor) => Math.min(1, Math.max(0, (valor - 2) / 11))
export default {
  nome: 'Ladra de Cartas',
  dificuldade: 'medio',
  semanal: true,
  ladra: true,
  sprite: 'ladra',
  fundo: 'ladra',
  musica: 'queen',
  textoInicial: 'A Ladra de Cartas já está de olho nas suas mãos!',
  tema: {
    formas: ['espadas', 'ouros', 'paus', 'copas'],
    cores: { espadas: 0xc8c0ff, ouros: 0xffb060, paus: 0x7fe0a0, copas: 0xff7a8a, barra: 0xffe0c0, bola: 0xffb060 },
    cor: 0xffb060,
  },
  hp: 270,
  danoBala: 10,
  leve: (A) => A.quicantes({ forma: 'ouros', duracao: 4000, intervalo: 1500, velocidade: 140 }),
  roubadas: {
    espadas: (A, valor) => A.aimed({ intervalo: 1100 - 400 * forca(valor), velocidade: 120 + 50 * forca(valor), rajada: 2 + Math.round(forca(valor) * 2) }),
    ouros: (A, valor) => A.quicantes({ forma: 'ouros', intervalo: 900 - 300 * forca(valor), velocidade: 150 + 60 * forca(valor) }),
    paus: (A, valor) => A.bombas({ intervalo: 1700 - 500 * forca(valor), fragmentos: 6 + Math.round(forca(valor) * 4) }),
    copas: (A) => A.quicantes({ forma: 'copas', duracao: 4000, intervalo: 1500, velocidade: 140 }),
  },
  fases: [
    {
      hp: 1,
      falas: ['Que cartas bonitas...', 'Isso? Achei no chão.', 'Distração é tudo.'],
      cartas: [
        ['espadas', 5, 'Bater Carteira', (A) => A.aimed({ intervalo: 1000, velocidade: 125 })],
        ['ouros', 6, 'Embaralhar', (A) => A.quicantes({ forma: 'ouros', intervalo: 850, velocidade: 165 })],
        ['paus', 5, 'Alçapão', (A) => A.bombas({ intervalo: 1600, fragmentos: 7 })],
        ['espadas', 7, 'Leque de Facas', (A) => A.sides({ intervalo: 1100, velocidade: 165 })],
        ['copas', 5, 'Contar o Lucro', null, { cura: 20 }],
      ],
    },
    {
      hp: 0.5,
      entrada: 'Vocês não vão recuperar NADA!',
      velocidadeFundo: 1.5,
      falas: ['Achado não é roubado!', 'Mais uma pra coleção!', 'Cadê a sua carta? Hihi.'],
      cartas: [
        ['espadas', 10, 'Mão Leve', (A) => A.juntos(A.aimed({ intervalo: 1300, velocidade: 135 }), A.rain({ forma: 'paus', intervalo: 420, velocidade: 130 }))],
        ['ouros', 10, 'Truque de Mesa', (A) => A.sequencia(A.quicantes({ forma: 'ouros', duracao: 3000, intervalo: 750 }), A.sides({ duracao: 3000, intervalo: 1000, velocidade: 170 }))],
        ['paus', 11, 'Cofre Armado', (A) => A.bombas({ intervalo: 1300, fragmentos: 9 })],
        ['copas', 8, 'Esconderijo', null, { cura: 16, guarda: 0.6 }],
      ],
    },
  ],
  super: {
    nome: 'Grande Golpe',
    texto: 'Facas e bombas ao mesmo tempo, enquanto ela foge com o baralho',
    criar: (A) => A.juntos(A.sides({ duracao: 6000, intervalo: 1100, velocidade: 165 }), A.bombas({ duracao: 6000, intervalo: 1700, fragmentos: 8 })),
  },
}
