// EXPEDIÇÃO SEMANAL · 2ª luta da Escuridão: O APAGA-VELAS, o tenente (~3 minutos). Aqui a caixa já fica no BREU
// (`escuro`, coop/semanal/escuridao.js: as pistas de som e os clarões) e a regra OLHOS NO BREU aparece na versão
// LEVE (o tutorial disfarçado): um olho por esquiva na fase 1 (dois na 2), que fecha mais rápido. Os ataques dela em
// versão leve. Fica fora da seleção de chefes (`expedicao`, `oculto`).
//   scene.start('CoopArena', { chefe: 'escuridaoTenente', nivel, party })
// Formato: ver coop/chefes/index.js.
import { criarRegraEscuridao } from '../semanal/escuridaoRegra.js'

export default {
  nome: 'O Apaga-Velas',
  expedicao: true,
  oculto: true,
  escuro: true,
  dificuldade: 'facil',
  sprite: 'escuridao-apagavelas',
  fundo: 'escuridao',
  musica: 'king',
  textoInicial: 'O Apaga-Velas sopra a última luz. Escutem!',
  tema: {
    formas: ['bola', 'losango'],
    cores: { bola: 0xb8b0ff, losango: 0x8a7cff, barra: 0xff5a7a },
    cor: 0xb8b0ff,
  },
  hp: 420,
  desafio: { velocidade: 0.92, densidade: 0.9 },
  danoBala: 13,
  niveis: { medio: { dano: 1.8 }, dificil: { dano: 1.35 } },
  // a regra dela, leve: 1 olho (2 na fase 2), fecha em 0,95 s sozinho
  regra: criarRegraEscuridao({ porFase: [1, 2], fecharMs: 950, entre: [1500, 1500], quebra: 15 }),
  leve: (A) => A.rain({ duracao: 3800, intervalo: 700, velocidade: 95, caixa: null }),
  fases: [
    {
      hp: 1,
      falas: ['Shhh. Uma vela a menos.', 'No escuro, escutem os sinos.', 'Fechem os olhos dela, se acharem!'],
      cartas: [
        ['espadas', 5, 'Mão no Pavio', (A) => A.juntos(A.escuridaoMaos({ duracao: 6000, intervalo: 1700, dedos: 2 }), A.rain({ duracao: 6000, intervalo: 850, velocidade: 95, caixa: null }))],
        ['paus', 5, 'Apagar as Velas', (A) => A.escuridaoVelas({ duracao: 6000, intervalo: 1100, simultaneas: 2, estilhacos: 7 })],
        ['ouros', 6, 'Sino Velho', (A) => A.juntos(A.escuridaoEco({ duracao: 6000, intervalo: 2300, ecos: 1 }), A.aimed({ duracao: 6000, intervalo: 2000, velocidade: 100, caixa: null }))],
        ['espadas', 6, 'Zumbido Baixo', (A) => A.juntos(A.lasers({ duracao: 6000, intervalo: 2100, aviso: 900 }), A.escuridaoVelas({ duracao: 6000, intervalo: 2000, estilhacos: 6 }))],
        ['copas', 4, 'Pavio Novo', null, { cura: 18 }],
      ],
    },
    {
      hp: 0.5,
      entrada: 'Agora até o olho dela pisca... e vocês?',
      velocidadeFundo: 1.3,
      falas: ['Mais uma vela. Puf.', 'Escutaram o sino?', 'O breu é meu ofício.'],
      cartas: [
        ['espadas', 8, 'Olhar de Relance', (A) => A.juntos(A.escuridaoOlhar({ duracao: 6500, intervalo: 3800, giro: 0.7 }), A.rain({ duracao: 6500, intervalo: 750, velocidade: 100, caixa: null }))],
        ['paus', 8, 'Fileira de Velas', (A) => A.escuridaoVelas({ duracao: 6500, intervalo: 950, simultaneas: 2, estilhacos: 8 })],
        ['ouros', 8, 'Dois Sinos', (A) => A.juntos(A.escuridaoEco({ duracao: 6500, intervalo: 2400, ecos: 2 }), A.escuridaoMaos({ duracao: 6500, intervalo: 2300, dedos: 0 }))],
        ['espadas', 9, 'Mãos Compridas', (A) => A.escuridaoMaos({ duracao: 6500, intervalo: 1500, maos: 2, dedos: 2 })],
        ['copas', 6, 'Cera Quente', null, { cura: 14, guarda: 0.7 }],
      ],
    },
  ],
  super: {
    nome: 'Apagão Geral',
    texto: 'Todas as velas apagam de uma vez enquanto o olho espia',
    criar: (A) => A.juntos(A.escuridaoVelas({ duracao: 6000, intervalo: 900, simultaneas: 3, estilhacos: 7 }), A.escuridaoOlhar({ duracao: 6000, intervalo: 4000, giro: 0.7 })),
  },
}
