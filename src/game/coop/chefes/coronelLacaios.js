// Turma do Lixão: os LACAIOS do Coronel Caçamba (EXPEDIÇÃO, 1ª luta: ~2 min de aquecimento). Duas rodadas de
// guaxinins e um saco de lixo, num sprite só (a turma toda). Sem regra, pouca vida, dois ataques simples e avisados:
// o guaxinim joga lixo na direção do coração e o saco de lixo desaba em sombras que crescem.
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
  hp: 190,
  danoBala: 9,
  leve: (A) => A.coronelEntulho({ duracao: 3500, intervalo: 1600, maximo: 2, mirar: 0.2 }),
  fases: [
    {
      hp: 1,
      falas: ['Quem mexeu no meu lixo?!', 'Chi-chi-chi!', 'Esse lixo é nosso!'],
      cartas: [
        ['espadas', 3, 'Mão Leve', (A) => A.aimed({ forma: 'bola', velocidade: 130, intervalo: 1000, caixa: null })],
        ['paus', 4, 'Saco Furado', (A) => A.coronelEntulho({ intervalo: 1100, maximo: 2, mirar: 0.4 })],
        ['ouros', 5, 'Lixão Revirado', (A) => A.juntos(A.coronelEntulho({ intervalo: 1700, maximo: 2, mirar: 0.3 }), A.aimed({ forma: 'bola', velocidade: 120, intervalo: 1500, caixa: null }))],
        ['copas', 3, 'Lamber o Pote', null, { cura: 14 }],
      ],
    },
    {
      hp: 0.5,
      entrada: 'O saco de lixo acordou!',
      falas: ['Chi-chi! Mais lixo!', 'O saco vai rasgar!'],
      cartas: [
        ['espadas', 6, 'Mão Leve Dupla', (A) => A.aimed({ forma: 'bola', velocidade: 145, intervalo: 800, caixa: null })],
        ['paus', 7, 'Saco Estourado', (A) => A.coronelEntulho({ intervalo: 850, maximo: 3, mirar: 0.55 })],
        ['ouros', 8, 'Festa do Lixo', (A) => A.juntos(A.coronelEntulho({ intervalo: 1400, maximo: 2, mirar: 0.4 }), A.aimed({ forma: 'bola', velocidade: 135, intervalo: 1300, caixa: null }))],
        ['copas', 6, 'Sobra de Pizza', null, { cura: 12 }],
      ],
    },
  ],
  super: {
    nome: 'Rebuliço',
    texto: 'Todo mundo joga lixo ao mesmo tempo, mas cada sombra e cada tiro é avisado',
    criar: (A) => A.juntos(A.coronelEntulho({ duracao: 5500, intervalo: 1000, maximo: 3 }), A.aimed({ duracao: 5500, forma: 'bola', velocidade: 130, intervalo: 1300, caixa: null })),
  },
}
