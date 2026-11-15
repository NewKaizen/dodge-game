// EXPEDIÇÃO · 1ª luta da Queen: os LACAIOS (robozinhos e pop-ups). Aquecimento de ~2 minutos: um "chefe" só
// (o grupo, com a vida somada), poucos golpes simples e SEM regra. Fica fora da seleção de chefes (`expedicao`).
//   scene.start('CoopArena', { chefe: 'queenLacaios', nivel, party })
// Formato: ver coop/chefes/index.js.
export default {
  nome: 'Robozinhos',
  expedicao: true,
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
  hp: 230,
  danoBala: 8,
  leve: (A) => A.ondas({ duracao: 3600, velocidade: 100, intervalo: 1400 }),
  fases: [
    {
      hp: 1,
      falas: ['Bip! Bip! Invasão!', 'Pop-up! Pop-up! Pop-up!', 'Cadê o antivírus?'],
      cartas: [
        ['espadas', 3, 'Pacote de Dados', (A) => A.ondas({ duracao: 5000, velocidade: 110, intervalo: 1150 })],
        ['paus', 4, 'Pop-up Saltitante', (A) => A.quicantes({ duracao: 5000, intervalo: 1300, velocidade: 130 })],
        ['ouros', 4, 'Ping', (A) => A.lasers({ quantidade: 1, intervalo: 1500, duracao: 5000 })],
        ['copas', 3, 'Reiniciar', null, { cura: 12 }],
      ],
    },
  ],
  super: {
    nome: 'Pane Geral',
    texto: 'Uma enxurrada de pacotes e pop-ups',
    criar: (A) => A.juntos(A.ondas({ duracao: 4200, velocidade: 130, intervalo: 1000 }), A.quicantes({ duracao: 4200, intervalo: 1500, velocidade: 130 })),
  },
}
