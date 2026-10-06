// Jevil no CO-OP de cartas (DIFÍCIL). Formato: ver coop/chefes/index.js.
const CARROSSEL_RAPIDO = (giroDentro, giroFora) => [
  { raio: 42, quantidade: 8, giro: giroDentro },
  { raio: 112, quantidade: 18, giro: giroFora },
]

export default {
  hp: 500,
  danoBala: 13,
  leve: (A) => A.quicantes({ forma: 'ouros', duracao: 4000, intervalo: 1500, velocidade: 150 }),
  fases: [
    {
      hp: 1,
      cartas: [
        ['espadas', 5, 'Espadas Dançantes', (A) => A.colunas({ forma: 'espadas', quantidade: 3, velocidade: 200, intervalo: 1100 })],
        ['ouros', 6, 'Losangos Pulantes', (A) => A.quicantes({ forma: 'ouros', intervalo: 800, velocidade: 190 })],
        ['paus', 4, 'Anel de Copas', (A) => A.anel({ forma: 'copas' })],
        ['paus', 5, 'Divisão de Paus', (A) => A.divisores({ forma: 'paus' })],
        ['copas', 4, 'Pipoca', null, { cura: 26 }],
      ],
    },
    {
      hp: 0.75,
      cartas: [
        ['ouros', 8, 'Carrossel', (A) => A.carrossel()],
        ['espadas', 9, 'Foice Giratória', (A) => A.foice({ varridas: 3 })],
        ['paus', 8, 'Tique-Taque', (A) => A.bombas()],
        ['copas', 7, 'Pirueta', null, { cura: 20, guarda: 0.6 }],
      ],
    },
    {
      hp: 0.5,
      cartas: [
        ['ouros', 11, 'Carrossel Maluco', (A) => A.juntos(A.carrossel({ aneis: CARROSSEL_RAPIDO(1.5, -1.1) }), A.divisores({ intervalo: 1600, forma: 'paus' }))],
        ['espadas', 10, 'Lâmina Louca', (A) => A.foice({ varridas: 4, travessia: 1500 })],
        ['paus', 10, 'Chuva de Naipes', (A) => A.juntos(A.anel({ forma: 'copas', intervalo: 2200 }), A.rain({ forma: 'espadas', intervalo: 380, velocidade: 170 }))],
        ['paus', 9, 'BUM!', (A) => A.bombas({ intervalo: 1100, fragmentos: 10, velocidade: 160 })],
        ['copas', 9, 'Gargalhada', null, { cura: 22, guarda: 0.6 }],
      ],
    },
    {
      hp: 0.25,
      cartas: [
        ['espadas', 12, 'Naipes em Fila', (A) => A.sequencia(A.colunas({ forma: 'espadas', quantidade: 3, velocidade: 260, intervalo: 900, duracao: 3200 }), A.anel({ forma: 'copas', duracao: 3200, intervalo: 1500, tempoFechar: 1200 }))],
        ['espadas', 13, 'Caos Afiado', (A) => A.juntos(A.foice({ varridas: 3, travessia: 1400 }), A.bombas({ intervalo: 1600, fragmentos: 8 }))],
        ['ouros', 13, 'Para Sempre', (A) => A.juntos(A.carrossel({ aneis: CARROSSEL_RAPIDO(2.0, -1.5), duracao: 7000 }), A.divisores({ intervalo: 1300, velocidade: 140 })), { inverter: true }],
        ['ouros', 12, 'Losangos Loucos', (A) => A.quicantes({ forma: 'ouros', intervalo: 550, velocidade: 240, quiques: 5 })],
      ],
    },
  ],
  super: {
    nome: 'CAOS! CAOS!',
    texto: 'O carrossel dispara e depois a foice e as bombas giram juntas, nas duas caixas',
    criar: (A) => A.sequencia(A.carrossel({ aneis: CARROSSEL_RAPIDO(1.6, -1.2), duracao: 3600 }), A.juntos(A.foice({ duracao: 3600, varridas: 3, travessia: 1500 }), A.bombas({ duracao: 3600, intervalo: 1700, fragmentos: 8 }))),
  },
}
