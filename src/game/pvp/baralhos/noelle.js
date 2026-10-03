// Noelle: suporte (♥) gélido. Neve lenta, anéis de gelo, estalactites.
// Formato: ver o comentário "formato de um baralho" em pvp/padroes.js.
import { P, r, apertar } from '../padroes.js'

export default {
  tema: { formas: ['losango', 'hex'], cores: { losango: 0x9fe6ff, hex: 0xe0f8ff, barra: 0xc8f0ff, bola: 0x9fe6ff }, cor: 0x9fe6ff },
  hp: 85,
  principal: { espadas: 'neve', ouros: 'lasers', paus: 'colunas' },
  leve: (A) => A.rain({ duracao: 4000, intervalo: 560, velocidade: 90, partida: 0.7, cascata: 3, raio: 7, girar: 1, mirar: 0.3 }),
  receitas: {
    nevasca: r('Neve com um anel de gelo se fechando', (A, t) => A.juntos(P.neve(A, t, { esparso: 1.5, caixa: null }), P.anel(A, t, { esparso: 1.5 }))),
    ventoGelido: r('Neve numa caixa apertada', (A, t) => apertar(A, t, P.neve(A, t))),
    raio: r('Raios de gelo verticais', (A, t) => P.lasers(A, t, { orientacao: 'vertical' })),
    inverno: r('Raios de gelo cruzados numa caixa apertada', (A, t) => apertar(A, t, P.lasers(A, t, { orientacao: 'alternar' }))),
    pingentes: r('Pingentes de gelo despencam', (A, t) => P.colunas(A, t, { forma: 'losango' })),
    avalanche: r('Pingentes e neve', (A, t) => A.juntos(P.colunas(A, t, { esparso: 1.4, forma: 'losango' }), P.neve(A, t, { esparso: 1.8, caixa: null }))),
  },
  super: {
    nome: 'Zero Absoluto',
    texto: 'Pingentes que racham o chão em placas que nunca mais voltam, a nevasca que isola as últimas seguras e a estrela de gelo final',
    criar: (A) => A.superNoelle()
  },
  cartas: [
    ['espadas', 1, 'Espelho de Gelo'],
    ['espadas', 4, 'Floco Afiado', 'neve'],
    ['espadas', 8, 'Granizo', 'neve'],
    ['espadas', 12, 'Nevasca', 'nevasca'],
    ['ouros', 1, 'Congelar'],
    ['ouros', 5, 'Vento Gélido', 'ventoGelido'],
    ['ouros', 9, 'Raio de Gelo', 'raio'],
    ['ouros', 13, 'Inverno Eterno', 'inverno', { inverter: 2000 }],
    ['paus', 1, 'Mão Fria'],
    ['paus', 3, 'Pingentes', 'pingentes'],
    ['paus', 7, 'Estalactites', 'pingentes'],
    ['paus', 11, 'Avalanche', 'avalanche'],
    ['copas', 1, 'Milagre de Natal'],
    ['copas', 2, 'Chocolate Quente', ['cura']],
    ['copas', 4, 'Sino de Natal', ['energia']],
    ['copas', 6, 'Cura Gelada', ['cura']],
    ['copas', 8, 'Casaco de Lã', ['escudo']],
    ['copas', 10, 'Prece', ['cura', 'compra']],
    ['copas', 11, 'Anjo da Neve', ['escudo', 'cura']],
  ],
}
