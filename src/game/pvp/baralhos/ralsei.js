// Ralsei: suporte (♥). Magia gentil e fofa: estrelas, música de ninar, bolinhos, lã e fitas.
// Formato: ver o comentário "formato de um baralho" em pvp/padroes.js.
import { r, apertar, duracaoDe, lerp } from '../padroes.js'

export default {
  tema: { formas: ['copas', 'bola'], cores: { copas: 0x4dd68a, bola: 0xa8f0c0, barra: 0x8fe8b0 }, cor: 0x4dd68a },
  principal: { espadas: 'anel', ouros: 'carrossel', paus: 'divisores' },
  leve: (A) => A.anel({ duracao: 4000, intervalo: 2800, quantidade: 16, abertura: 1.4, tempoFechar: 1700 }),
  receitas: {
    estrela: r('Estrelas cadentes miradas no coração que deixam um rastro de brilhos parado no ar', (A, t) =>
      A.ralseiEstrelaGentil({ duracao: duracaoDe(t), intervalo: lerp(1250, 800, t), velocidade: lerp(150, 200, t), rastro: lerp(450, 650, t), porVez: t >= 0.7 ? 2 : 1 }),
    ),
    coro: r('Um coro de estrelinhas canta em onda, vai e volta, cada uma soltando estrelas miradas; no fim da volta, o coro inteiro canta junto', (A, t) =>
      A.ralseiCoroEstrelas({ duracao: duracaoDe(t), cantores: t >= 0.5 ? 5 : 4, intervalo: lerp(560, 420, t), velocidade: lerp(125, 170, t), voz: t >= 0.6 ? 3 : 1, coroCheio: t >= 0.6 }),
    ),
    ninar: r('Numa caixa apertada, as notas de uma canção de ninar atravessam a pauta subindo e descendo com a melodia', (A, t) =>
      apertar(A, t, A.ralseiCancaoNinar({ duracao: duracaoDe(t), velocidade: lerp(95, 125, t), espaco: lerp(72, 64, t), vozes: t >= 0.4 ? 2 : 1 })),
    ),
    sono: r('Numa caixa apertada, trios de "Z" brotam do chão e sobem em zigue-zague, crescendo', (A, t) =>
      apertar(A, t, A.ralseiFeiticoSono({ duracao: duracaoDe(t), intervalo: lerp(1000, 720, t), velocidade: lerp(55, 80, t) })),
    ),
    bolinho: r('Cupcakes no chão: a vela queima e eles estouram num chafariz de granulado, com a cereja voando no coração', (A, t) =>
      A.ralseiBolinho({ duracao: duracaoDe(t), intervalo: lerp(1800, 1200, t), granulos: t >= 0.6 ? 10 : 8, velocidade: lerp(170, 210, t) }),
    ),
    fios: r('Novelos de lã rolam quicando e desenrolam um fio preso na parede', (A, t) =>
      A.ralseiFiosLa({ duracao: duracaoDe(t), intervalo: lerp(2100, 1500, t), velocidade: lerp(115, 150, t), quiques: t >= 0.6 ? 3 : 2, comprimento: lerp(80, 120, t) }),
    ),
    laco: r('Uma fita dá um laço em volta do coração e se aperta: fuja pelo vão antes que feche; o lacinho fica no chão', (A, t) =>
      A.ralseiLacoFita({ duracao: duracaoDe(t), intervalo: lerp(2600, 2000, t), raio: lerp(54, 62, t), tempoApertar: lerp(1500, 1200, t) }),
    ),
  },
  super: {
    nome: 'Último Capítulo',
    texto: 'Sopros de fogo em leque pelos cantos, uma moldura de espinhos que vai fechando com brasas caindo pelo meio e, no fim, a sombra de um dragão ondulando fogo pela caixa',
    criar: (A) => A.superRalsei()
  },
  cartas: [
    ['espadas', 1, 'Lição Invertida'],
    ['espadas', 5, 'Estrela Gentil', 'estrela'],
    ['espadas', 9, 'Coro de Estrelas', 'coro'],
    ['ouros', 1, 'Pacifismo'],
    ['ouros', 4, 'Canção de Ninar', 'ninar'],
    ['ouros', 7, 'Passos de Dança', 'carrossel'],
    ['ouros', 11, 'Feitiço de Sono', 'sono', { inverter: 1500 }],
    ['paus', 1, 'Empréstimo Educado'],
    ['paus', 3, 'Bolinho Explosivo', 'bolinho'],
    ['paus', 6, 'Fios de Lã', 'fios'],
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
