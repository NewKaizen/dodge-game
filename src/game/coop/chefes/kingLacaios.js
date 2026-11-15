// Os LACAIOS do Chaos King (Expedição, 1ª luta): a torre e dois peões, só o aquecimento. Sem regra: eles só
// mostram o tabuleiro (as casas piscando) e golpeiam. Fora da seleção de chefes (`expedicao: true`); abre com
// scene.start('CoopArena', { chefe: 'kingLacaios', ... }). As jogadas estão em kingCartas.js.
import { ataqueKing } from './kingCartas.js'

const carta = (nome) => () => ataqueKing('kingLacaios', nome)

export default {
  nome: 'Lacaios do Rei',
  expedicao: true,
  dificuldade: 'facil',
  sprite: 'king-lacaios',
  fundo: 'king',
  musica: 'king',
  textoInicial: 'A torre e os peões do rei barram o caminho!',
  tema: {
    formas: ['losango', 'coroa'],
    cores: { losango: 0xb48cff, coroa: 0xffd23c, barra: 0xd8c8ff, bola: 0xb48cff },
    cor: 0xd8c8ff,
  },
  hp: 260, // ~1,9 min no MÉDIO; o SUPER vale no mínimo COOP.superPiso (60): com menos HP o combo não passaria do SUPER sozinho
  danoBala: 5,
  leve: carta('leve'),
  fases: [
    {
      hp: 1,
      falas: ['Em frente, peões!', 'Ninguém passa!', 'Pelo rei!'],
      cartas: [
        ['espadas', 3, 'Peões Marchando', carta('Peões Marchando')],
        ['paus', 4, 'Torre de Guarda', carta('Torre de Guarda')],
        ['ouros', 4, 'Formação Fechada', carta('Formação Fechada')],
        ['copas', 3, 'Se Recompor', null, { cura: 14 }],
      ],
    },
    {
      hp: 0.5,
      entrada: 'A torre assume o comando!',
      velocidadeFundo: 1.3,
      falas: ['Tomem as casas!', 'Não recuem!', 'Xeque... quase!'],
      cartas: [
        ['espadas', 6, 'Torre e Peões', carta('Torre e Peões')],
        ['paus', 6, 'Avanço Geral', carta('Avanço Geral')],
        ['ouros', 6, 'Cerco Fechado', carta('Cerco Fechado')],
        ['copas', 5, 'Escudo de Peões', null, { cura: 10, guarda: 0.7 }],
      ],
    },
  ],
  super: {
    nome: 'Cerco do Tabuleiro',
    texto: 'Torres e peões cercando o quadro, jogada atrás de jogada',
    criar: () => ataqueKing('kingLacaios', 'super'),
  },
}
