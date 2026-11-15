// O Caminhão Compactador: o TENENTE do Coronel Caçamba (EXPEDIÇÃO, 2ª luta: ~3 min, a aula disfarçada). Apresenta a
// RECICLAGEM de leve: só lixo verde (nada de marrom), uma lixeira pequena (8 gomos) e um míssil que tira menos.
// Na 2ª fase aparece o compactador, uma vez e com um vão grande. Não aparece na seleção de chefes (`oculto`/
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
  hp: 270,
  danoBala: 10,
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
  leve: (A) => A.coronelEntulho({ duracao: 3800, intervalo: 1500, maximo: 2, mirar: 0.25 }),
  fases: [
    {
      hp: 1,
      falas: ['Rrrrrum!', 'Vou te compactar!', 'Fom-fom!'],
      cartas: [
        ['espadas', 4, 'Caminhão de Lixo', (A) => A.coronelCaminhao({ velocidade: 130, intervalo: 1800 })],
        ['paus', 5, 'Chuva de Entulho', (A) => A.coronelEntulho({ intervalo: 1000, maximo: 2 })],
        ['ouros', 6, 'Buzinaço', (A) => A.juntos(A.coronelBuzinaco({ ondas: 2 }), A.coronelEntulho({ intervalo: 1800, maximo: 2, mirar: 0.3 }))],
        ['copas', 4, 'Pausa pro Óleo', null, { cura: 22 }],
      ],
    },
    {
      hp: 0.5,
      entrada: 'Agora eu vou te amassar!',
      velocidadeFundo: 1.5,
      falas: ['Cabe um de cada vez!', 'Aperta que cabe!', 'Rrrrum!'],
      cartas: [
        ['espadas', 7, 'Caminhão Veloz', (A) => A.coronelCaminhao({ velocidade: 165, intervalo: 1500 })],
        ['paus', 8, 'Compactador', (A) => A.coronelCompactador({ vezes: 1, vao: 124, duracao: 3700 })],
        ['ouros', 8, 'Caminhão e Entulho', (A) => A.juntos(A.coronelCaminhao({ velocidade: 140, intervalo: 2000 }), A.coronelEntulho({ intervalo: 1700, maximo: 2, mirar: 0.4 }))],
        ['copas', 6, 'Troca de Óleo', null, { cura: 16, guarda: 0.7 }],
      ],
    },
  ],
  super: {
    nome: 'Hora do Rush',
    texto: 'Dois caminhões cruzam as faixas acesas, um de cada vez no aviso',
    criar: (A) => A.coronelCaminhao({ duracao: 6000, simultaneos: 2, velocidade: 140, intervalo: 1600 }),
  },
}
