// Queen (MÉDIO). Formato: ver o comentário em coop/chefes/index.js.
export default {
  nome: 'Queen',
  dificuldade: 'medio',
  sprite: 'queen',
  fundo: 'queen',
  musica: 'queen',
  desafio: { velocidade: 1.12, densidade: 1.15 },
  textoInicial: 'Queen aparece num holograma gigante!',
  tema: {
    formas: ['hex'],
    cores: { hex: 0x40f0ff, barra: 0xff4fc8, bola: 0x40f0ff },
    cor: 0x40f0ff,
  },
  hp: 270,
  danoBala: 11,
  // DIFÍCIL: os padrões da Queen já ficam muito densos no difícil: ritmo um
  // pouco mais calmo que o dos outros e menos HP (fica entre o King e o Jevil)
  niveis: { dificil: { velocidade: 0.97, densidade: 0.95, hp: 0.85 } },
  leve: (A) => A.ondas({ duracao: 4000, velocidade: 110, intervalo: 1300 }),
  fases: [
    {
      hp: 1,
      falas: ['Carregando... a sua derrota!', 'Ha! Ha! Ha!', 'Sintam o poder do Wi-Fi!'],
      cartas: [
        ['espadas', 4, 'Onda de Dados', (A) => A.ondas({ velocidade: 130, intervalo: 850 })],
        ['paus', 5, 'Pop-up Saltitante', (A) => A.quicantes({ intervalo: 1000, velocidade: 150 })],
        ['ouros', 6, 'Firewall', (A) => A.lasers({ quantidade: 1, intervalo: 1200 })],
        ['copas', 4, 'Reiniciar', null, { cura: 26 }],
      ],
    },
    {
      hp: 0.66,
      entrada: 'Atualizando para a versão 2.0!',
      velocidadeFundo: 1.4,
      falas: ['Versão 2.0! Muito melhor!', 'Vocês não têm memória suficiente!', 'Dancem, dancem!'],
      cartas: [
        ['ouros', 8, 'Feixe Duplo', (A) => A.lasers({ quantidade: 2, orientacao: 'alternar', intervalo: 1100 })],
        ['espadas', 9, 'Banda Larga', (A) => A.ondas({ velocidade: 170, intervalo: 700, amplitude: 50, direcao: 'direita' })],
        ['paus', 10, 'Spam', (A) => A.juntos(A.quicantes({ intervalo: 1500, gravidade: 220, quiques: 5 }), A.ondas({ velocidade: 120, intervalo: 1100, direcao: 'baixo', abertura: 72 }))],
        ['copas', 9, 'Antivírus', null, { cura: 18, guarda: 0.6 }],
      ],
    },
    {
      hp: 0.33,
      entrada: 'Modo turbo ativado! Tentem acompanhar!',
      velocidadeFundo: 1.9,
      falas: ['TURBO!', 'Eu não travo! Eu NÃO TRAVO!', 'Reiniciando... ataque!'],
      cartas: [
        ['ouros', 12, 'Cruz de Dados', (A) => A.sequencia(A.lasers({ orientacao: 'cruz', duracao: 3300, intervalo: 1100 }), A.ondas({ duracao: 3500, velocidade: 210, intervalo: 650, amplitude: 55 })), { inverter: true }],
        ['paus', 11, 'Sobrecarga', (A) => A.juntos(A.lasers({ intervalo: 1500 }), A.quicantes({ intervalo: 1200, velocidade: 180 }))],
        ['espadas', 13, 'Modo Turbo', (A) => A.ondas({ velocidade: 230, intervalo: 600, amplitude: 55, passo: 0.9 })],
        ['copas', 10, 'Backup na Nuvem', null, { cura: 22, guarda: 0.5 }],
      ],
    },
  ],
  super: {
    nome: 'Tela Azul',
    texto: 'Lasers em cruz e ondas de dados no modo turbo, nas duas caixas',
    criar: (A) => A.sequencia(A.lasers({ orientacao: 'cruz', duracao: 3200, intervalo: 1050 }), A.juntos(A.ondas({ duracao: 3600, velocidade: 200, intervalo: 700, amplitude: 50 }), A.quicantes({ duracao: 3600, intervalo: 1500, velocidade: 170 }))),
  },
}
