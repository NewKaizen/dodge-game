// Berdly: controle (♦). Vento, asas e "cálculos geniais".
// Formato: ver o comentário "formato de um baralho" em pvp/padroes.js.
import { P, r, apertar, lerp, caixaApertada } from '../padroes.js'

export default {
  tema: { formas: ['losango', 'bola'], cores: { losango: 0x3fd0ff, bola: 0x8fe0ff, barra: 0xa0e8ff }, cor: 0x3fd0ff },
  hp: 90,
  principal: { espadas: 'mira', ouros: 'estocadas', paus: 'ondas' },
  leve: (A) => A.aimed({ duracao: 4000, intervalo: 1600, velocidade: 110, rajada: 2 }),
  receitas: {
    rajadaVento: r('Estocadas numa caixa apertada', (A, t) => apertar(A, t, P.estocadas(A, t))),
    calculo: r('Rajadas miradas numa caixa apertada', (A, t) => apertar(A, t, P.mira(A, t))),
    qi: r('Lasers cruzados', (A, t) => P.lasers(A, t, { orientacao: 'cruz', intervalo: lerp(1500, 1250, t) })),
    vendaval: r('Estocadas e rajadas miradas numa caixa apertada', (A, t) =>
      A.comCaixa(caixaApertada(t * 0.5), A.juntos(P.estocadas(A, t, { esparso: 1.5 }), P.mira(A, t, { esparso: 1.8 })))),
    corrente: r('Paredes de vento vindo da esquerda', (A, t) => P.ondas(A, t, { direcao: 'direita' })),
    ciclone: r('Paredes de vento que descem', (A, t) => P.ondas(A, t, { direcao: 'baixo', abertura: 72 })),
  },
  super: {
    nome: 'Prova Irrefutável',
    texto: 'Um redemoinho de lâminas que passeia pela caixa num 8 e cresce a cada volta (o ego inflando), até o giro dourado e o corte final da resposta certa',
    criar: (A) => A.superBerdly()
  },
  cartas: [
    ['espadas', 1, 'Réplica Brilhante'],
    ['espadas', 3, 'Bicada', 'mira'],
    ['espadas', 7, 'Penas Voadoras', 'mira'],
    ['espadas', 10, 'Mergulho Aéreo', 'estocadas'],
    ['ouros', 1, 'Objeção!'],
    ['ouros', 2, 'Correção', 'estocadas'],
    ['ouros', 4, 'Rajada de Vento', 'rajadaVento'],
    ['ouros', 6, 'Cálculo Genial', 'calculo'],
    ['ouros', 8, 'Tornado', 'espiral'],
    ['ouros', 12, 'QI Elevado', 'qi', { inverter: 1500 }],
    ['ouros', 13, 'Vendaval Supremo', 'vendaval', { inverter: 2000 }],
    ['paus', 1, 'Cópia da Prova'],
    ['paus', 5, 'Pena Armada', 'divisores'],
    ['paus', 9, 'Corrente de Ar', 'corrente'],
    ['paus', 11, 'Ciclone', 'ciclone'],
    ['copas', 1, 'Ego Inabalável'],
    ['copas', 3, 'Pose Heroica', ['energia']],
    ['copas', 6, 'Autoconfiança', ['escudo']],
    ['copas', 9, 'Lanche da Cantina', ['cura']],
  ],
}
