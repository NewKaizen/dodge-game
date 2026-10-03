// Susie: força bruta (♠). Machado (foice), pisões (colunas), investidas.
// Formato: ver o comentário "formato de um baralho" em pvp/padroes.js.
import { P, r, apertar, metade } from '../padroes.js'

export default {
  tema: { formas: ['hex', 'bola'], cores: { hex: 0xb05cff, bola: 0xd9a0ff, barra: 0xc890ff, foice: 0xe0c0ff }, cor: 0xb05cff },
  hp: 110,
  principal: { espadas: 'foice', ouros: 'mira', paus: 'bombas' },
  leve: (A) => A.colunas({ duracao: 4000, quantidade: 1, velocidade: 130, intervalo: 1700, mirar: 0 }),
  receitas: {
    rugido: r('Rajadas miradas numa caixa apertada', (A, t) => apertar(A, t, P.mira(A, t))),
    pressao: r('Estocadas numa caixa apertada', (A, t) => apertar(A, t, P.estocadas(A, t))),
    buster: r('Machado bumerangue com rajadas miradas', (A, t) =>
      A.juntos(P.foice(A, t, { faiscas: 1 }), P.mira(A, t, { esparso: 1.8, caixa: null }))),
    maluco: r('Pisões e depois o machado bumerangue', (A, t) =>
      A.sequencia(P.colunas(A, t, { duracao: metade(t) }), P.foice(A, t, { duracao: metade(t), varridas: 2, aviso: 600, avisoVolta: 450, faiscas: 3 }))),
    dinamite: r('Bombas e chão rachado', (A, t) => A.juntos(P.bombas(A, t, { esparso: 1.4 }), P.rachaduras(A, t, { esparso: 1.6 }))),
  },
  super: {
    nome: 'Machado Colossal',
    texto: 'Pisões, o machado gigante com faíscas e a dinamite que racha o chão',
    criar: (A) => A.superSusie()
  },
  cartas: [
    ['espadas', 1, 'Revide Selvagem'],
    ['espadas', 2, 'Cabeçada', 'colunas'],
    ['espadas', 4, 'Machadada', 'foice'],
    ['espadas', 6, 'Pisão', 'colunas'],
    ['espadas', 8, 'Giro do Machado', 'foice'],
    ['espadas', 10, 'Investida', 'estocadas'],
    ['espadas', 12, 'Rude Buster', 'buster'],
    ['espadas', 13, 'Machado Maluco', 'maluco'],
    ['ouros', 1, 'Grito'],
    ['ouros', 3, 'Encarar', 'mira'],
    ['ouros', 7, 'Rugido', 'rugido'],
    ['ouros', 11, 'Pressão', 'pressao', { inverter: 1200 }],
    ['paus', 1, 'Roubar Lanche'],
    ['paus', 5, 'Bomba de Giz', 'bombas'],
    ['paus', 9, 'Chão Rachado', 'rachaduras'],
    ['paus', 11, 'Dinamite', 'dinamite'],
    ['copas', 1, 'Teimosia'],
    ['copas', 5, 'Ultimate Heal', ['cura']],
    ['copas', 9, 'Bolo Roubado', ['cura', 'energia']],
  ],
}
