// Expedição do Jevil, 2ª luta: o MESTRE DE PICADEIRO (tenente, ~3 min). Apresenta o DADO DO CAOS de leve: um dadinho
// de só 3 faces gentis (SORTE!, GRAVIDADE INVERTIDA, RÁPIDO E LEVE) com efeitos mais fracos (coop/jevilRegra.js).
// Fora da seleção de chefes (oculto: true): `scene.start('CoopArena', { chefe: 'jevil_tenente' })`.
import { criarRegraDoDado } from '../jevilRegra.js'
import { DADOS_DO_TENENTE } from '../jevilDado.js'

export default {
  nome: 'Mestre de Picadeiro',
  oculto: true,
  expedicao: true,
  dificuldade: 'medio',
  sprite: 'jevil-mestre',
  fundo: 'jevil',
  musica: 'jevil',
  textoInicial: 'O Mestre de Picadeiro estala o chicote!',
  regra: criarRegraDoDado({
    id: 'dadinho',
    nome: 'DADINHO DO PICADEIRO',
    descricao: 'Um dadinho de três faces muda a regra a cada rodada',
    fases: { 1: { descricao: 'O dadinho continua rolando' } },
    dados: DADOS_DO_TENENTE,
    forca: 0.6,
    pequeno: true,
  }),
  tema: {
    formas: ['espadas', 'copas', 'ouros', 'paus'],
    cores: { espadas: 0x9a8bff, copas: 0xff5f8a, ouros: 0xffd24c, paus: 0x5ff0b0, hex: 0xf4f0ff, bola: 0xffffff },
    cor: 0xff6a4a,
  },
  hp: 380,
  danoBala: 11,
  leve: (A) => A.quicantes({ forma: 'ouros', duracao: 4000, intervalo: 1500, velocidade: 140 }),
  fases: [
    {
      hp: 1,
      falas: ['Senhoras e senhores!', 'Bem-vindos ao picadeiro!', 'Rolem o dadinho!'],
      cartas: [
        ['espadas', 5, 'Chicote no Ar', (A) => A.colunas({ forma: 'espadas', quantidade: 3, velocidade: 180, intervalo: 1200 })],
        ['ouros', 5, 'Dadinhos Quicantes', (A) => A.quicantes({ forma: 'hex', intervalo: 950, velocidade: 170 })],
        ['paus', 5, 'Argola de Fogo', (A) => A.anel({ forma: 'copas' })],
        ['paus', 6, 'Número Duplo', (A) => A.divisores({ forma: 'paus' })],
        ['copas', 4, 'Pipoca', null, { cura: 22 }],
      ],
    },
    {
      hp: 0.5,
      entrada: 'Agora o número principal!',
      velocidadeFundo: 1.5,
      falas: ['Palmas para o dado!', 'Tique-taque, BUM!', 'Mais um truque!'],
      cartas: [
        ['ouros', 7, 'Mini Carrossel', (A) => A.carrossel({ aneis: [{ raio: 50, quantidade: 8, giro: 0.9 }, { raio: 115, quantidade: 16, giro: -0.7 }] })],
        ['espadas', 7, 'Chicote Giratório', (A) => A.foice({ varridas: 2 })],
        ['paus', 7, 'Bomba do Palhaço', (A) => A.bombas({ intervalo: 1600, fragmentos: 8, velocidade: 140 })],
        ['espadas', 8, 'Chuva de Naipes', (A) => A.rain({ forma: 'espadas', intervalo: 380, velocidade: 140 })],
        ['copas', 6, 'Reverência', null, { cura: 18, guarda: 0.7 }],
      ],
    },
  ],
  super: {
    nome: 'Gran Finale',
    texto: 'O carrossel gira e a foice varre a caixa',
    criar: (A) => A.sequencia(A.carrossel({ duracao: 3600 }), A.foice({ duracao: 3600, varridas: 2 })),
  },
}
