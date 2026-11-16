// Turma do Lixão: os LACAIOS do Coronel Caçamba (EXPEDIÇÃO, 1ª luta: ~2 min de aquecimento). Duas rodadas de
// guaxinins e um saco de lixo, num sprite só (a turma toda). Sem regra; ataques avisados mas que já pedem desvio de
// verdade (dificuldade do CO-OP): o guaxinim joga lixo na direção do coração, o saco desaba em sombras que crescem,
// as latas quicam e os ratos saem em bando da borda.
// Não aparece na seleção de chefes (`oculto`/`expedicao`): quem abre é a Expedição, com
// scene.start('CoopArena', { chefe: 'coronelLacaios', ... }). Formato: ver coop/chefes/index.js.
export default {
  nome: 'Turma do Lixão',
  oculto: true,
  expedicao: true,
  dificuldade: 'medio',
  sprite: 'lacaios',
  fundo: 'coronel',
  musica: 'coronel',
  textoInicial: 'Os guaxinins do Coronel reviram o lixo!',
  tema: {
    formas: ['bola', 'losango'],
    cores: { bola: 0xb0875a, losango: 0xa7adb8, barra: 0x9aa7b4 },
    cor: 0xa7adb8,
  },
  hp: 230, // era 190 (com os ataques ralos era um aquecimento de graça)
  danoBala: 11, // era 9
  niveis: { medio: { dano: 1.6 }, dificil: { dano: 1.25 } }, // (dificuldade do CO-OP: os lacaios já gastam o HP que o time leva para o tenente)
  leve: (A) => A.juntos(A.coronelEntulho({ duracao: 4000, intervalo: 1300, maximo: 2, mirar: 0.4 }), A.coronelRatos({ duracao: 4000, intervalo: 2000, ratos: 3 })),
  fases: [
    {
      hp: 1,
      falas: ['Quem mexeu no meu lixo?!', 'Chi-chi-chi!', 'Esse lixo é nosso!'],
      cartas: [
        ['espadas', 3, 'Mão Leve', (A) => A.juntos(A.aimed({ forma: 'bola', velocidade: 150, intervalo: 800, caixa: null }), A.coronelLatas({ intervalo: 1900, rajada: 1 }))],
        ['paus', 4, 'Saco Furado', (A) => A.coronelEntulho({ intervalo: 700, maximo: 3, mirar: 0.55 })],
        ['ouros', 5, 'Bando de Ratos', (A) => A.coronelRatos({ intervalo: 1150, ratos: 4, velocidade: 150 })],
        ['ouros', 5, 'Lixão Revirado', (A) => A.juntos(A.coronelLatas({ intervalo: 1200, rajada: 2 }), A.aimed({ forma: 'bola', velocidade: 140, intervalo: 1200, caixa: null }))],
        ['copas', 3, 'Lamber o Pote', null, { cura: 14 }],
      ],
    },
    {
      hp: 0.5,
      entrada: 'O saco de lixo acordou!',
      falas: ['Chi-chi! Mais lixo!', 'O saco vai rasgar!'],
      cartas: [
        ['espadas', 6, 'Mão Leve Dupla', (A) => A.juntos(A.aimed({ forma: 'bola', velocidade: 165, intervalo: 650, caixa: null }), A.coronelRatos({ intervalo: 1700, ratos: 3 }))],
        ['paus', 7, 'Saco Estourado', (A) => A.juntos(A.coronelEntulho({ intervalo: 600, maximo: 3, mirar: 0.6 }), A.coronelLatas({ intervalo: 1600, rajada: 2 }))],
        ['ouros', 8, 'Festa do Lixo', (A) => A.juntos(A.coronelRatos({ intervalo: 1000, ratos: 5, dois: 0.4 }), A.coronelEntulho({ intervalo: 1300, maximo: 2, mirar: 0.5 }))],
        ['copas', 6, 'Sobra de Pizza', null, { cura: 12 }],
      ],
    },
  ],
  super: {
    nome: 'Rebuliço',
    texto: 'Todo mundo joga lixo ao mesmo tempo, mas cada sombra e cada tiro é avisado',
    criar: (A) => A.juntos(A.coronelEntulho({ duracao: 6000, intervalo: 800, maximo: 3 }), A.coronelRatos({ duracao: 6000, intervalo: 1300, ratos: 4, dois: 0.5 }), A.coronelLatas({ duracao: 6000, intervalo: 1800, rajada: 2 })),
  },
}
