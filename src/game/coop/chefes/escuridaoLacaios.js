// EXPEDIÇÃO SEMANAL · 1ª luta da Escuridão: as SOMBRINHAS (os lacaios). Aquecimento de ~2 minutos: o grupo de
// sombrinhas (a vida somada), golpes simples com os ataques dela em versão leve e SEM regra nem breu (a caixa
// fica clara: o escuro chega com o tenente). Fica fora da seleção de chefes (`expedicao`, `oculto`).
//   scene.start('CoopArena', { chefe: 'escuridaoLacaios', nivel, party })
// Formato: ver coop/chefes/index.js.
export default {
  nome: 'Sombrinhas',
  expedicao: true,
  oculto: true,
  dificuldade: 'facil',
  sprite: 'escuridao-lacaios',
  fundo: 'escuridao',
  musica: 'king',
  textoInicial: 'Sombrinhas saem das frestas: a luz está acabando!',
  tema: {
    formas: ['bola', 'losango'],
    cores: { bola: 0xb8b0ff, losango: 0x8a7cff, barra: 0xff5a7a },
    cor: 0xb8b0ff,
  },
  hp: 260,
  danoBala: 11,
  niveis: { medio: { dano: 1.6 }, dificil: { dano: 1.25 } },
  leve: (A) => A.rain({ duracao: 3600, intervalo: 750, velocidade: 95, caixa: null }),
  fases: [
    {
      hp: 1,
      falas: ['Hihi... está escurecendo.', 'A gente mora no canto do olho.', 'Psiu! Aqui atrás!'],
      cartas: [
        ['espadas', 3, 'Mãozinhas', (A) => A.juntos(A.escuridaoMaos({ duracao: 5500, intervalo: 1800, dedos: 0, alcance: 0.6 }), A.rain({ duracao: 5500, intervalo: 900, velocidade: 95, caixa: null }))],
        ['ouros', 4, 'Sininho', (A) => A.escuridaoEco({ duracao: 5500, intervalo: 2400, ecos: 0, notas: 14, velocidade: 85 })],
        ['paus', 4, 'Sopra a Vela', (A) => A.juntos(A.escuridaoVelas({ duracao: 5500, intervalo: 1500, estilhacos: 6 }), A.aimed({ duracao: 5500, intervalo: 1900, velocidade: 100, caixa: null }))],
        ['espadas', 5, 'Bando de Sombras', (A) => A.juntos(A.escuridaoMaos({ duracao: 6000, intervalo: 1500, dedos: 2, alcance: 0.66 }), A.escuridaoEco({ duracao: 6000, intervalo: 3000, ecos: 0 }))],
        ['copas', 3, 'Esconder no Canto', null, { cura: 12 }],
      ],
    },
  ],
  super: {
    nome: 'Breu de Bolso',
    texto: 'As sombrinhas apagam as velas e esticam as mãozinhas',
    criar: (A) => A.juntos(A.escuridaoVelas({ duracao: 5000, intervalo: 1200, estilhacos: 7 }), A.escuridaoMaos({ duracao: 5000, intervalo: 1600, dedos: 0, alcance: 0.66 })),
  },
}
