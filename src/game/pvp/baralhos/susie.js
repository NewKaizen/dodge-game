// Susie: força bruta (♠). Machado (foice), pisões, cabeçadas, investidas.
// Formato: ver o comentário "formato de um baralho" em pvp/padroes.js.
// Ataques exclusivos (A.susie*): attacks/habilidades/susie.js
import { P, r, apertar, metade, duracaoDe, lerp } from '../padroes.js'

export default {
  tema: { formas: ['hex', 'bola'], cores: { hex: 0xb05cff, bola: 0xd9a0ff, barra: 0xc890ff, foice: 0xe0c0ff }, cor: 0xb05cff },
  principal: { espadas: 'foice', ouros: 'mira', paus: 'bombas' },
  leve: (A) => A.colunas({ duracao: 4000, quantidade: 1, velocidade: 130, intervalo: 1700, mirar: 0 }),
  receitas: {
    cabecada: r('Cabeçadas na parede: a caixa amassa na altura do coração e solta estrelinhas de tontura', (A, t) =>
      A.susieCabecada({ duracao: duracaoDe(t), intervalo: lerp(1400, 950, t), aviso: lerp(650, 500, t), estrelas: t >= 0.6 ? 5 : 4, velocidade: lerp(42, 62, t), voltaEstrela: lerp(70, 100, t) })),
    pisao: r('A pisada numa parede qualquer (chão, teto ou lados) faz pilares de pedra saírem dela em onda e o tremor solta cascalho da parede oposta', (A, t) =>
      A.susiePisao({ duracao: duracaoDe(t), intervalo: lerp(1450, 1000, t), aviso: lerp(650, 520, t), velocidade: lerp(130, 190, t), cascalhos: t >= 0.6 ? 2 : 1, velocidadeCascalho: lerp(80, 110, t) })),
    giro: r('O machado de cabo longo dá voltas inteiras em torno de um eixo perto do coração', (A, t) =>
      A.susieGiro({ duracao: duracaoDe(t), aviso: lerp(700, 560, t), raio: lerp(60, 70, t), volta: lerp(1300, 1000, t), voltas: t >= 0.6 ? 1.25 : 1.1, folga: lerp(260, 120, t) })),
    encarar: r('Marcas de raiva encaram o coração soltando olhadelas miradas e, quando o olhar trava, disparam raios pela linha e um leque', (A, t) =>
      apertar(A, t, A.susieEncarar({ duracao: duracaoDe(t), olhos: t >= 0.5 ? 3 : 2, encarar: lerp(700, 560, t), trava: lerp(460, 400, t), rastrear: lerp(2.2, 3, t), tiros: t >= 0.6 ? 4 : 3, velocidade: lerp(180, 230, t), olhadelas: t >= 0.6 ? 2 : 1, velocidadeOlhadela: lerp(160, 200, t), leque: 0.32 }))),
    rugido: r('Ondas sonoras entram por qualquer parede da caixa apertada com um vão escondido, e o grito empurra o coração', (A, t) =>
      apertar(A, t, A.susieRugido({ duracao: duracaoDe(t), aviso: lerp(560, 450, t), velocidade: lerp(120, 165, t), empurrao: lerp(40, 65, t), lacuna: lerp(64, 56, t) }))),
    pressao: r('Estocadas numa caixa apertada', (A, t) => apertar(A, t, P.estocadas(A, t))),
    buster: r('Machado bumerangue com rajadas miradas', (A, t) =>
      A.juntos(P.foice(A, t, { faiscas: 1 }), P.mira(A, t, { esparso: 1.8, caixa: null }))),
    maluco: r('Pisões e depois o machado bumerangue', (A, t) =>
      A.sequencia(P.colunas(A, t, { duracao: metade(t) }), P.foice(A, t, { duracao: metade(t), varridas: 2, aviso: 600, avisoVolta: 450, faiscas: 3 }))),
    bombaGiz: r('Gizes amarrados com pavio são arremessados para dentro da caixa, explodem numa nuvem de pó de giz e espalham pedaços (um no coração) que ficam no chão', (A, t) =>
      A.susieBombaGiz({ duracao: duracaoDe(t), intervalo: lerp(1400, 1000, t), porVez: t >= 0.6 ? 2 : 1, pavio: lerp(820, 680, t), fragmentos: t >= 0.6 ? 8 : 7, velocidade: lerp(175, 215, t), alcance: lerp(115, 135, t), chao: lerp(1300, 1700, t), mirar: lerp(0.65, 0.8, t), perto: 40 })),
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
