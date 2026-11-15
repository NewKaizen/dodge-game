// O CAVALEIRO, tenente do Chaos King (Expedição, 2ª luta): um tabuleiro 4 x 4 pequeno e só movimentos de
// cavalo. É a regra TABULEIRO REAL em versão leve (a aula disfarçada): as casas piscando são as que o cavalo
// vai golpear; o XEQUE e o ROQUE ficam para o chefão. Fora da seleção de chefes (`expedicao: true`); abre com
// scene.start('CoopArena', { chefe: 'kingTenente', ... }). As jogadas estão em kingCartas.js.
import { criarRegraKing } from './kingRegra.js'
import { ESPEC, ataqueKing } from './kingCartas.js'

const carta = (nome) => () => ataqueKing('kingTenente', nome)

export default {
  nome: 'O Cavaleiro',
  expedicao: true,
  dificuldade: 'facil',
  sprite: 'king-cavaleiro',
  fundo: 'king',
  musica: 'king',
  textoInicial: 'O Cavaleiro do rei salta em L no tabuleiro!',
  tema: {
    formas: ['losango', 'coroa'],
    cores: { losango: 0xa98be8, coroa: 0xffd23c, barra: 0xd8c8ff, bola: 0xa98be8 },
    cor: 0xa98be8,
  },
  hp: 430, // ~3 min no MÉDIO (simularCoop.mjs)
  danoBala: 6,
  leve: carta('leve'),
  regra: criarRegraKing({
    id: 'tabuleiro-leve',
    nome: 'O TABULEIRO',
    descricao: 'O cavalo pisca as casas do salto em L: saiam delas antes do golpe.',
    fases: { 1: { descricao: 'Agora ele salta em dobro.' } },
    espec: ESPEC,
  }),
  fases: [
    {
      hp: 1,
      falas: ['Em L! Sempre em L!', 'O rei mandou.', 'Salto!'],
      cartas: [
        ['espadas', 4, 'Salto Curto', carta('Salto Curto')],
        ['paus', 5, 'Dois Saltos', carta('Dois Saltos')],
        ['ouros', 5, 'Galope', carta('Galope')],
        ['copas', 4, 'Relinchar', null, { cura: 18 }],
      ],
    },
    {
      hp: 0.5,
      entrada: 'Agora eu galopo de verdade!',
      velocidadeFundo: 1.3,
      falas: ['Ninguém me alcança!', 'Pelo rei!', 'Meu casco é de ferro!'],
      cartas: [
        ['espadas', 8, 'Salto Duplo', carta('Salto Duplo')],
        ['paus', 8, 'Carga do Cavaleiro', carta('Carga do Cavaleiro')],
        ['ouros', 7, 'Galope', carta('Galope')],
        ['copas', 6, 'Armadura', null, { cura: 12, guarda: 0.65 }],
      ],
    },
  ],
  super: {
    nome: 'Cavalgada Real',
    texto: 'Saltos em L, dois a dois, por todo o tabuleirinho',
    criar: () => ataqueKing('kingTenente', 'super'),
  },
}
