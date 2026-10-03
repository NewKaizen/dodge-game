// Ralsei: suporte (♥). Magia gentil: anéis, estrelas, carrossel.
// Formato: ver o comentário "formato de um baralho" em pvp/padroes.js.
import { P, r, apertar } from '../padroes.js'

export default {
  tema: { formas: ['copas', 'bola'], cores: { copas: 0x4dd68a, bola: 0xa8f0c0, barra: 0x8fe8b0 }, cor: 0x4dd68a },
  hp: 80,
  principal: { espadas: 'anel', ouros: 'carrossel', paus: 'divisores' },
  leve: (A) => A.anel({ duracao: 4000, intervalo: 2800, quantidade: 16, abertura: 1.4, tempoFechar: 1700 }),
  receitas: {
    ninar: r('Carrossel lento numa caixa apertada', (A, t) => apertar(A, t, P.carrossel(A, t * 0.5))),
    sono: r('Anéis numa caixa apertada', (A, t) => apertar(A, t, P.anel(A, t, { mirar: 0.2 }))),
    laco: r('Divisores e anel', (A, t) => A.juntos(P.divisores(A, t, { esparso: 1.3 }), P.anel(A, t, { esparso: 1.6 }))),
  },
  super: {
    nome: 'Último Capítulo',
    texto: 'Sopros de fogo em leque pelos cantos, uma moldura de espinhos que vai fechando com brasas caindo pelo meio e, no fim, a sombra de um dragão ondulando fogo pela caixa',
    criar: (A) => A.superRalsei()
  },
  cartas: [
    ['espadas', 1, 'Lição Invertida'],
    ['espadas', 5, 'Estrela Gentil', 'anel'],
    ['espadas', 9, 'Coro de Estrelas', 'espiral'],
    ['ouros', 1, 'Pacifismo'],
    ['ouros', 4, 'Canção de Ninar', 'ninar'],
    ['ouros', 7, 'Passos de Dança', 'carrossel'],
    ['ouros', 11, 'Feitiço de Sono', 'sono', { inverter: 1500 }],
    ['paus', 1, 'Empréstimo Educado'],
    ['paus', 3, 'Bolinho Explosivo', 'bombas'],
    ['paus', 6, 'Fios de Lã', 'divisores'],
    ['paus', 10, 'Laço de Fita', 'laco'],
    ['copas', 1, 'Abraço Fofo'],
    ['copas', 2, 'Chá Quentinho', ['cura']],
    ['copas', 4, 'Proteção Mágica', ['escudo']],
    ['copas', 6, 'Heal Prayer', ['cura']],
    ['copas', 8, 'Biscoito de Gengibre', ['compra']],
    ['copas', 10, 'Cachecol Verde', ['escudo', 'cura']],
    ['copas', 12, 'Pacify', ['energia', 'compra']],
    ['copas', 13, 'Oração Maior', ['cura', 'escudo']],
  ],
}
