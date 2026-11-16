// EXPEDIÇÃO · 1ª luta da Queen: os LACAIOS (robozinhos e pop-ups). Aquecimento de ~2 minutos: um "chefe" só
// (o grupo, com a vida somada), poucos golpes simples e SEM regra. Fica fora da seleção de chefes (`expedicao`).
//   scene.start('CoopArena', { chefe: 'queenLacaios', nivel, party })
// Formato: ver coop/chefes/index.js.
export default {
  nome: 'Robozinhos',
  expedicao: true,
  oculto: true,
  dificuldade: 'facil',
  sprite: 'queen-lacaios',
  fundo: 'queen',
  musica: 'queen',
  textoInicial: 'Robozinhos e pop-ups invadem a tela!',
  tema: {
    formas: ['hex'],
    cores: { hex: 0x40f0ff, barra: 0xff4fc8, bola: 0x40f0ff },
    cor: 0x40f0ff,
  },
  hp: 260, // era 230
  danoBala: 10, // era 8 (dificuldade do CO-OP: os lacaios não são aquecimento de graça)
  niveis: { medio: { dano: 1.6 }, dificil: { dano: 1.25 } }, // (dificuldade do CO-OP: os lacaios já gastam o HP que o time leva para o tenente)
  leve: (A) => A.ondas({ duracao: 3600, velocidade: 100, intervalo: 1400 }),
  fases: [
    {
      hp: 1,
      falas: ['Bip! Bip! Invasão!', 'Pop-up! Pop-up! Pop-up!', 'Cadê o antivírus?'],
      cartas: [
        ['espadas', 3, 'Pacote de Dados', (A) => A.juntos(A.ondas({ duracao: 5500, velocidade: 125, intervalo: 1000 }), A.queenCursor({ duracao: 5500, clique: 1800 }))],
        ['paus', 4, 'Pop-up Saltitante', (A) => A.juntos(A.quicantes({ duracao: 5500, intervalo: 1300, velocidade: 140 }), A.queenPopup({ duracao: 5500, intervalo: 1300 }))],
        ['ouros', 4, 'Ping', (A) => A.juntos(A.lasers({ quantidade: 1, intervalo: 1400, duracao: 5500 }), A.queenCarregando({ duracao: 5500, intervalo: 1500, carga: 1200 }))],
        ['espadas', 5, 'Janelas Demais', (A) => A.queenPopup({ duracao: 6000, intervalo: 850 })],
        ['copas', 3, 'Reiniciar', null, { cura: 12 }],
      ],
    },
  ],
  super: {
    nome: 'Pane Geral',
    texto: 'Uma enxurrada de pacotes e pop-ups',
    criar: (A) => A.juntos(A.ondas({ duracao: 5000, velocidade: 140, intervalo: 900 }), A.queenPopup({ duracao: 5000, intervalo: 1000 }), A.queenCursor({ duracao: 5000, clique: 1700 })),
  },
}
