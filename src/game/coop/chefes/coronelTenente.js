// O Caminhão Compactador: o TENENTE do Coronel Caçamba (EXPEDIÇÃO, 2ª luta: ~3 min, a aula disfarçada). Apresenta a
// RECICLAGEM de leve: só lixo verde (nada de marrom), uma lixeira pequena (12 gomos) e um míssil que tira menos.
// Dificuldade do CO-OP: aperta mais que os lacaios (o `desafio` e mais dano): a MARCHA À RÉ e a TRIAGEM já na
// fase 1; na 2ª fase o compactador duas vezes, com latas caindo no vão. Não aparece na seleção de chefes (`oculto`/
// `expedicao`): quem abre é a Expedição, com scene.start('CoopArena', { chefe: 'coronelTenente', ... }).
import { criarRegraReciclagem } from '../coronelRegra.js'

export default {
  nome: 'Caminhão Compactador',
  oculto: true,
  expedicao: true,
  dificuldade: 'dificil',
  sprite: 'caminhaoCompactador',
  fundo: 'coronel',
  musica: 'coronel',
  textoInicial: 'O Caminhão Compactador roda na sua direção!',
  tema: {
    formas: ['bola', 'losango'],
    cores: { bola: 0xb0875a, losango: 0xa7adb8, barra: 0x9aa7b4 },
    cor: 0xe8892a,
  },
  hp: 440, // era 400: a 2ª luta da Expedição tem de apertar mais que os lacaios
  danoBala: 13, // era 10
  niveis: { medio: { dano: 1.8 }, dificil: { dano: 1.35 } }, // (dificuldade do CO-OP: o tenente aperta mais que os lacaios)
  desafio: { velocidade: 1.05, densidade: 1.15 }, // (a 2ª luta da Expedição aperta mais que os lacaios)
  // a versão leve da regra do Coronel: só verde, lixeira pequena, míssil menor
  regra: criarRegraReciclagem({
    max: 12,
    limpos: [4, 4],
    sujos: [0, 0],
    valor: [2, 2],
    velocidade: [1, 1],
    dano: 0.1,
    quebra: 20,
    hpMaxPadrao: 270,
    nome: 'RECICLAGEM',
    descricao: 'Lixo VERDE não machuca: peguem para encher a lixeira e lançar um míssil!',
    textosDasFases: { 1: { descricao: 'Mais lixo verde: a lixeira enche rápido!' } },
  }),
  leve: (A) => A.juntos(A.coronelEntulho({ duracao: 4200, intervalo: 1200, maximo: 2, mirar: 0.4 }), A.coronelLatas({ duracao: 4200, intervalo: 1800, rajada: 1 })),
  fases: [
    {
      hp: 1,
      falas: ['Rrrrrum!', 'Vou te compactar!', 'BIP! BIP! Dando ré!'],
      cartas: [
        ['espadas', 4, 'Caminhão de Lixo', (A) => A.juntos(A.coronelCaminhao({ velocidade: 165, intervalo: 1250, aviso: 850 }), A.coronelLatas({ intervalo: 1800, rajada: 1 }))],
        ['paus', 5, 'Chuva de Entulho', (A) => A.juntos(A.coronelEntulho({ intervalo: 550, maximo: 4, mirar: 0.6 }), A.coronelRatos({ intervalo: 1700, ratos: 4 }))],
        ['ouros', 6, 'Marcha à Ré', (A) => A.juntos(A.coronelRe({ intervalo: 1200, leque: 6, simultaneos: 2 }), A.coronelEntulho({ intervalo: 1200, maximo: 2, mirar: 0.5 }))],
        ['paus', 6, 'Coleta Seletiva', (A) => A.juntos(A.coronelTriagem({ intervalo: 300, velocidade: 105, deriva: 70, certo: 0.3 }), A.coronelLatas({ intervalo: 2000, rajada: 1 }))],
        ['copas', 4, 'Pausa pro Óleo', null, { cura: 22 }],
      ],
    },
    {
      hp: 0.5,
      entrada: 'Agora eu vou te amassar!',
      velocidadeFundo: 1.5,
      falas: ['Cabe um de cada vez!', 'Aperta que cabe!', 'Rrrrum!'],
      cartas: [
        ['espadas', 7, 'Caminhão Veloz', (A) => A.juntos(A.coronelCaminhao({ velocidade: 200, intervalo: 1000, aviso: 800 }), A.coronelLatas({ intervalo: 1500, rajada: 2 }))],
        ['paus', 8, 'Compactador', (A) => A.juntos(A.coronelCompactador({ vezes: 2, vao: 108, fecha: 1450 }), A.coronelLatas({ duracao: 7300, intervalo: 1700, rajada: 1, velocidade: 60 }))],
        ['ouros', 8, 'Ré e Triagem', (A) => A.juntos(A.coronelRe({ intervalo: 1300, leque: 7 }), A.coronelTriagem({ intervalo: 380, velocidade: 110, certo: 0.3 }))],
        ['copas', 6, 'Troca de Óleo', null, { cura: 16, guarda: 0.7 }],
      ],
    },
  ],
  super: {
    nome: 'Hora do Rush',
    texto: 'Dois caminhões cruzam as faixas acesas, um de cada vez no aviso',
    criar: (A) => A.juntos(A.coronelCaminhao({ duracao: 6500, simultaneos: 2, velocidade: 180, intervalo: 1200 }), A.coronelLatas({ duracao: 6500, intervalo: 1600, rajada: 2 })),
  },
}
