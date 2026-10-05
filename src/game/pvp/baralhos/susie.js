// Susie: força bruta (♠). Machado (foice), pisões, cabeçadas, investidas.
// Formato: ver o comentário "formato de um baralho" em pvp/padroes.js.
// Ataques exclusivos (A.susie*): attacks/habilidades/susie.js
import { P, r, apertar, metade, duracaoDe, lerp } from '../padroes.js'

export default {
  tema: { formas: ['hex', 'bola'], cores: { hex: 0xb05cff, bola: 0xd9a0ff, barra: 0xc890ff, foice: 0xe0c0ff }, cor: 0xb05cff },
  hp: 110,
  principal: { espadas: 'foice', ouros: 'mira', paus: 'bombas' },
  leve: (A) => A.colunas({ duracao: 4000, quantidade: 1, velocidade: 130, intervalo: 1700, mirar: 0 }),
  receitas: {
    cabecada: r('Cabeçadas na parede: a caixa amassa na altura do coração e solta estrelinhas de tontura', (A, t) =>
      A.susieCabecada({ duracao: duracaoDe(t), intervalo: lerp(1400, 950, t), aviso: lerp(650, 500, t), estrelas: t >= 0.6 ? 5 : 4, velocidade: lerp(42, 62, t), voltaEstrela: lerp(70, 100, t) })),
    pisao: r('A pisada faz pilares de pedra subirem do chão em onda e o tremor derruba cascalho do teto', (A, t) =>
      A.susiePisao({ duracao: duracaoDe(t), intervalo: lerp(1450, 1000, t), aviso: lerp(650, 520, t), velocidade: lerp(130, 190, t), cascalhos: t >= 0.6 ? 2 : 1, velocidadeCascalho: lerp(80, 110, t) })),
    giro: r('O machado de cabo longo dá voltas inteiras em torno de um eixo perto do coração', (A, t) =>
      A.susieGiro({ duracao: duracaoDe(t), aviso: lerp(700, 560, t), raio: lerp(60, 70, t), volta: lerp(1300, 1000, t), voltas: t >= 0.6 ? 1.25 : 1.1, folga: lerp(260, 120, t) })),
    encarar: r('Marcas de raiva encaram o coração e, quando o olhar trava, disparam raios pela linha', (A, t) =>
      apertar(A, t, A.susieEncarar({ duracao: duracaoDe(t), olhos: t >= 0.6 ? 2 : 1, encarar: lerp(800, 600, t), trava: lerp(500, 420, t), rastrear: lerp(1.6, 2.4, t), tiros: t >= 0.6 ? 4 : 3, velocidade: lerp(170, 220, t) }))),
    rugido: r('Ondas sonoras com um vão atravessam a caixa apertada e o grito empurra o coração', (A, t) =>
      apertar(A, t, A.susieRugido({ duracao: duracaoDe(t), aviso: lerp(560, 450, t), velocidade: lerp(110, 150, t), empurrao: lerp(40, 65, t), lacuna: lerp(64, 56, t) }))),
    pressao: r('Estocadas numa caixa apertada', (A, t) => apertar(A, t, P.estocadas(A, t))),
    buster: r('Machado bumerangue com rajadas miradas', (A, t) =>
      A.juntos(P.foice(A, t, { faiscas: 1 }), P.mira(A, t, { esparso: 1.8, caixa: null }))),
    maluco: r('Pisões e depois o machado bumerangue', (A, t) =>
      A.sequencia(P.colunas(A, t, { duracao: metade(t) }), P.foice(A, t, { duracao: metade(t), varridas: 2, aviso: 600, avisoVolta: 450, faiscas: 3 }))),
    bombaGiz: r('Gizes amarrados com pavio explodem numa nuvem de pó de giz e espalham pedaços que ficam no chão', (A, t) =>
      A.susieBombaGiz({ duracao: duracaoDe(t), intervalo: lerp(1800, 1150, t), pavio: lerp(1200, 1000, t), fragmentos: t >= 0.6 ? 6 : 4, velocidade: lerp(120, 160, t), chao: lerp(1000, 1400, t) })),
    dinamite: r('Bombas e chão rachado', (A, t) => A.juntos(P.bombas(A, t, { esparso: 1.4 }), P.rachaduras(A, t, { esparso: 1.6 }))),
  },
  super: {
    nome: 'Machado Colossal',
    texto: 'Pisões, o machado gigante com faíscas e a dinamite que racha o chão',
    criar: (A) => A.superSusie()
  },
  cartas: [
    ['espadas', 1, 'Revide Selvagem'],
    ['espadas', 2, 'Cabeçada', 'cabecada'],
    ['espadas', 4, 'Machadada', 'foice'],
    ['espadas', 6, 'Pisão', 'pisao'],
    ['espadas', 8, 'Giro do Machado', 'giro'],
    ['espadas', 10, 'Investida', 'estocadas'],
    ['espadas', 12, 'Rude Buster', 'buster'],
    ['espadas', 13, 'Machado Maluco', 'maluco'],
    ['ouros', 1, 'Grito'],
    ['ouros', 3, 'Encarar', 'encarar'],
    ['ouros', 7, 'Rugido', 'rugido'],
    ['ouros', 11, 'Pressão', 'pressao', { inverter: 1200 }],
    ['paus', 1, 'Roubar Lanche'],
    ['paus', 5, 'Bomba de Giz', 'bombaGiz'],
    ['paus', 9, 'Chão Rachado', 'rachaduras'],
    ['paus', 11, 'Dinamite', 'dinamite'],
    ['copas', 1, 'Teimosia'],
    ['copas', 5, 'Ultimate Heal', ['cura']],
    ['copas', 9, 'Bolo Roubado', ['cura', 'energia']],
  ],
}
