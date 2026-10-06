// Coronel Caçamba no CO-OP de cartas (EXTREMO). Formato: ver coop/chefes/index.js.
export default {
  hp: 480,
  danoBala: 12,
  leve: (A) => A.brasas({ duracao: 4000, intervalo: 700 }),
  fases: [
    {
      hp: 1,
      cartas: [
        ['paus', 4, 'Churrasco', (A) => A.brasas()],
        ['espadas', 5, 'Forcado', (A) => A.forcado()],
        ['espadas', 6, 'Fom-Fom', (A) => A.caminhonete({ re: 0 })],
        ['ouros', 5, 'Faísca Mirada', (A) => A.aimed({ forma: 'chama', velocidade: 170, intervalo: 700 })],
        ['copas', 4, 'Pausa pro Café', null, { cura: 26 }],
      ],
    },
    {
      hp: 0.75,
      cartas: [
        ['espadas', 8, 'Olha a Ré!', (A) => A.caminhonete()],
        ['paus', 8, 'Brasa e Faísca', (A) => A.juntos(A.brasas({ intervalo: 320 }), A.aimed({ forma: 'chama', intervalo: 1100, velocidade: 180 }))],
        ['ouros', 8, 'Forcado Ligeiro', (A) => A.forcado({ intervalo: 1200, parada: 200 })],
        ['ouros', 9, 'Redemoinho de Fogo', (A) => A.spiral({ forma: 'chama', velocidade: 130 })],
        ['copas', 7, 'Chapéu de Palha', null, { cura: 20, guarda: 0.6 }],
      ],
    },
    {
      hp: 0.5,
      cartas: [
        ['espadas', 10, 'Pé na Tábua', (A) => A.caminhonete({ intervalo: 1500, velocidade: 440 })],
        ['paus', 11, 'Rodovia em Chamas', (A) => A.juntos(A.caminhonete({ intervalo: 2400, re: 0 }), A.brasas({ intervalo: 420 }))],
        ['espadas', 11, 'Atropela e Espeta', (A) => A.sequencia(A.forcado({ duracao: 3500, intervalo: 1000 }), A.caminhonete({ duracao: 3500 }))],
        ['ouros', 10, 'Fogo Cruzado', (A) => A.juntos(A.spiral({ velocidade: 140, bracos: 4 }), A.forcado({ intervalo: 1900 }))],
        ['copas', 9, 'Pit Stop', null, { cura: 22, guarda: 0.6 }],
      ],
    },
    {
      hp: 0.25,
      cartas: [
        ['espadas', 13, 'Engarrafamento', (A) => A.caminhonete({ faixas: 4, ocupar: 2, intervalo: 1500 })],
        ['ouros', 12, 'Primos de Caminhonete', (A) => A.juntos(A.caminhonete({ intervalo: 1700 }), A.aimed({ forma: 'chama', intervalo: 1300, velocidade: 190 })), { inverter: true }],
        ['paus', 13, 'Rodeio Completo', (A) => A.sequencia(A.brasas({ duracao: 3000, intervalo: 180 }), A.forcado({ duracao: 3000, intervalo: 900, parada: 180 }), A.caminhonete({ duracao: 3500, velocidade: 460 }))],
        ['paus', 12, 'Churrasqueira Turbo', (A) => A.juntos(A.forcado({ intervalo: 1300 }), A.brasas({ intervalo: 300, estouro: 3 }))],
      ],
    },
  ],
  super: {
    nome: 'Buzinaço',
    texto: 'Todos os primos de caminhonete passam buzinando enquanto chove brasa, nas duas caixas',
    criar: (A) => A.juntos(A.caminhonete({ duracao: 6500, intervalo: 1800 }), A.brasas({ duracao: 6500, intervalo: 380 })),
  },
}
