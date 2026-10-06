// Chaos King (FÁCIL). Formato: ver o comentário em coop/chefes/index.js.
export default {
  nome: 'Chaos King',
  dificuldade: 'facil',
  sprite: 'king',
  fundo: 'king',
  musica: 'king',
  desafio: { velocidade: 1.15, densidade: 1.2 },
  textoInicial: 'O Chaos King bloqueia o caminho!',
  tema: {
    formas: ['losango', 'coroa'],
    cores: { losango: 0xb48cff, coroa: 0xffd23c, barra: 0xd8c8ff, bola: 0xb48cff },
    cor: 0xb48cff,
  },
  hp: 240,
  danoBala: 7,
  leve: (A) => A.rain({ duracao: 4000, intervalo: 520, velocidade: 110 }),
  fases: [
    {
      hp: 1,
      falas: ['Ajoelhem-se diante da coroa!', 'Um peão ousa me desafiar?', 'Xeque! Hahaha!'],
      cartas: [
        ['espadas', 3, 'Chuva de Peões', (A) => A.rain({ intervalo: 260, velocidade: 120 })],
        ['paus', 4, 'Torres em Marcha', (A) => A.colunas({ quantidade: 2, velocidade: 140, intervalo: 1500 })],
        ['ouros', 5, 'Olhar Real', (A) => A.aimed({ intervalo: 950, velocidade: 120 })],
        ['espadas', 6, 'Investida do Cavalo', (A) => A.sides({ intervalo: 1150, velocidade: 160 })],
        ['copas', 4, 'Ajeitar a Coroa', null, { cura: 22 }],
      ],
    },
    {
      hp: 0.5,
      entrada: 'Chega de brincadeira! Agora é xeque-mate!',
      velocidadeFundo: 1.4,
      falas: ['Minhas torres vão esmagar vocês!', 'Curvem-se!', 'Isso é traição!'],
      cartas: [
        ['espadas', 9, 'Xeque', (A) => A.juntos(A.rain({ intervalo: 340, velocidade: 130 }), A.aimed({ intervalo: 1400, velocidade: 130 }))],
        ['paus', 10, 'Roque', (A) => A.colunas({ quantidade: 3, velocidade: 160, intervalo: 1200 })],
        ['ouros', 11, 'Tabuleiro Virado', (A) => A.sequencia(A.colunas({ duracao: 3000, intervalo: 1300 }), A.rain({ duracao: 3000, intervalo: 200, velocidade: 140 }))],
        ['espadas', 12, 'Fúria da Torre', (A) => A.sides({ intervalo: 1000, velocidade: 170 })],
        ['copas', 8, 'Guarda Real', null, { cura: 16, guarda: 0.6 }],
      ],
    },
  ],
  super: {
    nome: 'Xeque-Mate',
    texto: 'Torres e olhares reais ao mesmo tempo, nas duas caixas',
    criar: (A) => A.juntos(A.colunas({ duracao: 6500, quantidade: 3, velocidade: 165, intervalo: 1300 }), A.aimed({ duracao: 6500, intervalo: 1250, velocidade: 135 })),
  },
}
