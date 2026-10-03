// Kris: equilibrado, puxado para controle (♦). Espada, mira e planos.
// Formato: ver o comentário "formato de um baralho" em pvp/padroes.js.
import { P, r, apertar } from '../padroes.js'

export default {
  tema: { formas: ['espadas', 'losango'], cores: { espadas: 0x4aa8ff, losango: 0x9fd0ff, barra: 0xbfe0ff, bola: 0x4aa8ff }, cor: 0x4aa8ff },
  hp: 90,
  principal: { espadas: 'estocadas', ouros: 'mira', paus: 'forcado' },
  leve: (A) => A.sides({ duracao: 4000, intervalo: 1500, velocidade: 140, eco: 0 }),
  receitas: {
    corte: r('Colunas em forma de espada', (A, t) => P.colunas(A, t, { forma: 'espadas' })),
    determinada: r('Estocadas e colunas ao mesmo tempo', (A, t) =>
      A.juntos(P.estocadas(A, t, { esparso: 1.5, caixa: null }), P.colunas(A, t, { esparso: 1.6, quantidade: 2, forma: 'espadas' }))),
    passo: r('Rajadas miradas numa caixa apertada', (A, t) => apertar(A, t, P.mira(A, t))),
    formacao: r('Lasers alternados numa caixa apertada', (A, t) => apertar(A, t, P.lasers(A, t, { orientacao: 'alternar', quantidade: 1 }))),
    alma: r('Rajadas miradas numa caixa apertada', (A, t) => apertar(A, t, P.mira(A, t))),
    emboscada: r('Forcado e chão rachado', (A, t) => A.juntos(P.forcado(A, t, { esparso: 1.4 }), P.rachaduras(A, t, { esparso: 1.9, ramos: 3 }))),
  },
  super: {
    nome: 'Alma Determinada',
    texto: 'Estocadas com colunas de espada, lasers alternados numa caixa apertada e o forcado com rajadas miradas',
    criar: (A) => A.superKris()
  },
  cartas: [
    ['espadas', 1, 'Reflexo da Lâmina'],
    ['espadas', 3, 'Golpe Rápido', 'estocadas'],
    ['espadas', 6, 'Corte Firme', 'corte'],
    ['espadas', 9, 'Estocada Dupla', 'estocadas'],
    ['espadas', 13, 'Lâmina Determinada', 'determinada'],
    ['ouros', 1, 'Silêncio'],
    ['ouros', 2, 'Olhar Vazio', 'mira'],
    ['ouros', 5, 'Passo Calculado', 'passo'],
    ['ouros', 8, 'Plano Tático', 'lasers'],
    ['ouros', 11, 'Formação', 'formacao'],
    ['ouros', 12, 'Controle da Alma', 'alma', { inverter: 1500 }],
    ['paus', 1, 'Mão Leve'],
    ['paus', 4, 'Armadilha de Espinhos', 'forcado'],
    ['paus', 7, 'Mina no Chão', 'bombas'],
    ['paus', 10, 'Emboscada', 'emboscada'],
    ['copas', 1, 'Determinação'],
    ['copas', 3, 'Respirar Fundo', ['energia']],
    ['copas', 7, 'Escudo Improvisado', ['escudo']],
    ['copas', 10, 'Torta de Caramelo', ['cura']],
  ],
}
