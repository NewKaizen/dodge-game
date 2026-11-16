// Chaos King (FÁCIL). Formato: ver o comentário em coop/chefes/index.js.
//
// CO-OP 2.0, regra TABULEIRO REAL (kingRegra.js, kingTabuleiro.js, kingAtaques.js): o quadro vira um
// tabuleiro de xadrez e cada peça PISCA as casas que vai golpear antes de golpear. Fase 1: peões e torres;
// fase 2: bispos e cavalos entram; fase 3: um peão vira RAINHA e o ROQUE troca os corações de lado. Nas
// cartas de XEQUE uma peça prende UM coração numa gaiola e o parceiro tem de CAPTURÁ-LA (pisar na casa
// dela). As jogadas de cada carta estão em kingCartas.js.
//
// DIFICULDADE DO CO-OP (docs/coop-cartas.md "Dificuldade do CO-OP"): as peças vêm junto com os ataques de
// assinatura dele (kingCartas.js `extra`): a MURALHA DE PEÕES que marcha e é promovida, as LINHAS DE XEQUE da
// torre e do bispo cruzando no coração e a CAVALGADA que cai onde o coração estava. Mais dano por acerto e o
// aperto do quadro de volta (`desafio`, que ele tinha antes do CO-OP 2.0).
import { criarRegraKing } from './kingRegra.js'
import { ESPEC, ataqueKing } from './kingCartas.js'

const carta = (nome) => (A) => ataqueKing('king', nome, A)

export default {
  nome: 'Chaos King',
  dificuldade: 'facil',
  sprite: 'king',
  fundo: 'king',
  musica: 'king',
  textoInicial: 'O Chaos King vira o quadro num tabuleiro de xadrez!',
  tema: {
    formas: ['losango', 'coroa'],
    cores: { losango: 0xb48cff, coroa: 0xffd23c, barra: 0xd8c8ff, bola: 0xb48cff },
    cor: 0xb48cff,
  },
  hp: 520, // CO-OP 2.0: era 240 (QUEBRA, finalização e cartas de dupla batem mais; as peças são legíveis, então a luta pede HP: ~3,3 min no MÉDIO, simularCoop.mjs)
  danoBala: 12, // era 7: com 7 e as peças sozinhas a dupla de bots passava 60% das rodadas sem levar nada (medirChefes.mjs)
  desafio: { velocidade: 1.15, densidade: 1.2 },
  // DIFÍCIL: o King é o chefe mais fraco de base (dano por bala baixo e padrões
  // fáceis de ler): no difícil ele aperta bem mais o ritmo (SUPER ~23 por acerto)
  niveis: { medio: { dano: 2.5, hp: 1.35 }, dificil: { velocidade: 1.1, densidade: 1.1, velocidadeMax: 1.2, dano: 1.8, hp: 1.25 } }, // (o DIFÍCIL era densidade 1,7: com os ataques de assinatura e o desafio de volta, apertava demais)
  leve: carta('leve'),
  regra: criarRegraKing({
    descricao: 'As peças piscam as casas que vão golpear; no XEQUE, capture a peça para soltar o parceiro.',
    fases: {
      1: { descricao: 'Bispos e cavalos entram no tabuleiro.' },
      2: { descricao: 'Um peão chega ao fim e vira RAINHA; o ROQUE troca vocês de lado.' },
    },
    espec: ESPEC,
  }),
  fases: [
    {
      hp: 1,
      falas: ['Ajoelhem-se diante da coroa!', 'Um peão ousa me desafiar?', 'Xeque! Hahaha!'],
      cartas: [
        ['espadas', 3, 'Peões em Marcha', carta('Peões em Marcha')],
        ['paus', 4, 'Torre à Vista', carta('Torre à Vista')],
        ['espadas', 6, 'Torres Gêmeas', carta('Torres Gêmeas')],
        ['ouros', 5, 'Xeque!', carta('Xeque!')],
        ['copas', 4, 'Ajeitar a Coroa', null, { cura: 22 }],
      ],
    },
    {
      hp: 0.66,
      entrada: 'Os bispos e os cavalos! Joguem o meu jogo!',
      velocidadeFundo: 1.3,
      falas: ['Minhas diagonais não perdoam!', 'Cavalo em L, morte em L!', 'O rei nunca perde!'],
      cartas: [
        ['espadas', 8, 'Bispos em V', carta('Bispos em V')],
        ['paus', 9, 'Salto do Cavalo', carta('Salto do Cavalo')],
        ['espadas', 11, 'Corte Real', carta('Corte Real')],
        ['espadas', 10, 'Cavalgada', carta('Cavalgada')],
        ['ouros', 10, 'Xeque Duplo', carta('Xeque Duplo')],
        ['copas', 8, 'Guarda Real', null, { cura: 16, guarda: 0.6 }],
      ],
    },
    {
      hp: 0.33,
      entrada: 'Chega! Meu peão vira RAINHA e o tabuleiro vira de lado!',
      velocidadeFundo: 1.6,
      falas: ['Promoção! Hahaha!', 'Roque! Troquem de lado!', 'Xeque-mate se aproxima!'],
      cartas: [
        ['espadas', 10, 'Promoção', carta('Promoção')],
        ['paus', 11, 'Roque', carta('Roque')],
        ['espadas', 13, 'Tabuleiro Virado', carta('Tabuleiro Virado')],
        ['espadas', 12, 'Mate Iminente', carta('Mate Iminente')],
        ['paus', 12, 'Muralha Real', carta('Muralha Real')],
        ['ouros', 12, 'Xeque da Rainha', carta('Xeque da Rainha')],
        ['copas', 9, 'Coroa Reforçada', null, { cura: 14, guarda: 0.55 }],
      ],
    },
  ],
  super: {
    nome: 'Xeque-Mate',
    texto: 'Torres, bispos, cavalos e uma rainha, jogada atrás de jogada',
    criar: (A) => ataqueKing('king', 'Xeque-Mate', A),
  },
}
