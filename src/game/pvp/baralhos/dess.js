// Dess: ataque (♠) com guitarra e taco. Ondas sonoras e bolas rebatidas.
// Formato: ver o comentário "formato de um baralho" em pvp/padroes.js.
import { P, r, apertar } from '../padroes.js'

export default {
  tema: { formas: ['ouros', 'bola'], cores: { ouros: 0xff8a4a, bola: 0xffc08a, barra: 0xffa86a }, cor: 0xff8a4a },
  hp: 100,
  principal: { espadas: 'quicantes', ouros: 'lasers', paus: 'bombas' },
  leve: (A) => A.quicantes({ duracao: 4000, intervalo: 1700, velocidade: 120, quiques: 3 }),
  receitas: {
    solo: r('Paredes sonoras que vêm da esquerda', (A, t) => P.ondas(A, t, { direcao: 'direita' })),
    show: r('Ondas sonoras e bolas rebatidas', (A, t) => A.juntos(P.ondas(A, t, { esparso: 1.4 }), P.quicantes(A, t, { esparso: 1.7 }))),
    palheta: r('Ondas numa caixa apertada', (A, t) => apertar(A, t, P.ondas(A, t, { abertura: 60 }))),
    feedback: r('Bolas rebatidas numa caixa apertada', (A, t) => apertar(A, t, P.quicantes(A, t))),
    amplificador: r('Paredes sonoras que descem', (A, t) => P.ondas(A, t, { direcao: 'baixo', abertura: 72 })),
    palco: r('Bombas e ondas sonoras', (A, t) => A.juntos(P.bombas(A, t, { esparso: 1.4 }), P.ondas(A, t, { esparso: 1.6 }))),
  },
  super: {
    nome: 'Último Bis',
    texto: 'Um show de ritmo: acordes nos trastes, um solo correndo pelo braço e o mergulho do whammy em onda de choque',
    criar: (A) => A.superDess()
  },
  cartas: [
    ['espadas', 1, 'Rebatida'],
    ['espadas', 2, 'Nota Solta', 'quicantes'],
    ['espadas', 5, 'Taco de Beisebol', 'quicantes'],
    ['espadas', 7, 'Riff Distorcido', 'ondas'],
    ['espadas', 9, 'Home Run', 'quicantes'],
    ['espadas', 11, 'Solo de Guitarra', 'solo'],
    ['espadas', 13, 'Show de Rock', 'show'],
    ['ouros', 1, 'Corta o Som'],
    ['ouros', 4, 'Microfonia', 'lasers'],
    ['ouros', 8, 'Palheta', 'palheta'],
    ['ouros', 12, 'Feedback', 'feedback', { inverter: 1500 }],
    ['paus', 1, 'Pegou Emprestado'],
    ['paus', 3, 'Bomba de Fumaça', 'bombas'],
    ['paus', 6, 'Amplificador', 'amplificador'],
    ['paus', 10, 'Cabos Enrolados', 'lasers'],
    ['paus', 12, 'Palco Explosivo', 'palco'],
    ['copas', 1, 'Bis!'],
    ['copas', 6, 'Refrigerante', ['energia']],
    ['copas', 10, 'Fone de Ouvido', ['escudo']],
  ],
}
