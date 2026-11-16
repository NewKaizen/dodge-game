// Coronel Caçamba (EXTREMO). Formato: ver o comentário em coop/chefes/index.js.
//
// CO-OP 2.0 (docs/coop-cartas.md "Coronel Caçamba"): a luta toda gira em volta da regra RECICLAGEM (coop/coronelRegra.js):
// parte do lixo que ele joga é VERDE e não machuca, enche a LIXEIRA da dupla e, cheia, lança o MÍSSIL RECICLADO nele.
//
// DIFICULDADE DO CO-OP (docs/coop-cartas.md "Dificuldade do CO-OP"): ele volta a ser um TERROR, como antes do CO-OP 2.0
// (4 fases, o trânsito, a chuva e o engarrafamento dos primos), agora com os ataques de assinatura do lixão, todos
// avisados: as LATAS que quicam no chão, as RATAZANAS que saem da borda (os olhinhos avisam), a TRIAGEM (o lixo só
// machuca na coluna da cor errada) e a MARCHA À RÉ (o caminhão entra de ré e despeja a caçamba). O lixo verde da
// regra cai no meio de tudo isso: pegar o verde é desviar ao mesmo tempo.
// Fase 1: caminhão, entulho, latas e ratos. Fase 2: a triagem e a ré, o lixo MARROM aparece. Fase 3: caminhão duplo
// e o COMPACTADOR com latas. Fase 4: os primos de caminhonete, sem pausa para o café.
import { criarRegraReciclagem } from '../coronelRegra.js'

export default {
  nome: 'Coronel Caçamba',
  dificuldade: 'extremo',
  sprite: 'coronelLixeiro',
  fundo: 'coronel',
  musica: 'coronel',
  textoInicial: 'O Coronel Caçamba chegou para a coleta!',
  tema: {
    // o lixo que machuca é papelão e lata (nunca verde: o verde é só da reciclagem)
    formas: ['bola', 'losango'],
    cores: { bola: 0xb0875a, losango: 0xa7adb8, barra: 0x9aa7b4, chama: 0xff8a1c },
    cor: 0xe8892a,
  },
  hp: 560, // CO-OP 2.0: era 320; medido no navegador: com 440 e lixeira de 24 a luta acabava em 5 rodadas (3 mísseis) (docs/coop-cartas.md "Coronel Caçamba")
  danoBala: 15, // era 12 (com 12 e as cartas ralas a dupla passava 3 de 4 rodadas sem levar nada)
  // o aperto do quadro só dele (como o da Queen e o do Jevil): o lixão é mais denso que os outros
  desafio: { velocidade: 1.1, densidade: 1.2 },
  // DIFÍCIL: o ritmo base do difícil já aperta muito os ataques dele; um pouco mais de dano
  niveis: { medio: { dano: 2.3, hp: 1.15 }, dificil: { dano: 1.6, hp: 1.15 } },
  regra: criarRegraReciclagem(),
  leve: (A) => A.juntos(A.coronelEntulho({ duracao: 4500, intervalo: 1000, maximo: 2, mirar: 0.5 }), A.coronelLatas({ duracao: 4500, intervalo: 1600, rajada: 1 })),
  fases: [
    {
      hp: 1,
      falas: ['Hora da coleta!', 'Separa o lixo, hein?', 'Fom-fom! Sai da frente!'],
      cartas: [
        ['espadas', 5, 'Caminhão de Lixo', (A) => A.juntos(A.coronelCaminhao({ velocidade: 175, intervalo: 950, aviso: 800 }), A.coronelLatas({ intervalo: 1300, rajada: 2 }), A.coronelEntulho({ intervalo: 1600, maximo: 2, mirar: 0.6 }))],
        ['paus', 5, 'Chuva de Entulho', (A) => A.juntos(A.coronelEntulho({ intervalo: 520, maximo: 4, mirar: 0.55, aviso: 900 }), A.coronelLatas({ intervalo: 1900, rajada: 1 }))],
        ['ouros', 6, 'Ratazanas', (A) => A.juntos(A.coronelRatos({ intervalo: 1050, ratos: 5, velocidade: 165 }), A.coronelEntulho({ intervalo: 1500, maximo: 2, mirar: 0.4 }))],
        ['paus', 6, 'Buzinaço', (A) => A.juntos(A.coronelBuzinaco({ ondas: 3, intervalo: 2100 }), A.coronelEntulho({ intervalo: 750, maximo: 3, mirar: 0.6 }))],
        ['copas', 4, 'Pausa pro Café', null, { cura: 26 }],
      ],
    },
    {
      hp: 0.75,
      entrada: 'Tá misturando o lixo! Quem separou errado?!',
      velocidadeFundo: 1.4,
      falas: ['Esse marrom não é reciclável!', 'BIP! BIP! BIP! Dando ré!', 'Papel no azul, lata no amarelo!'],
      cartas: [
        ['espadas', 8, 'Caminhão Turbo', (A) => A.juntos(A.coronelCaminhao({ velocidade: 215, intervalo: 950, aviso: 750 }), A.coronelRatos({ intervalo: 1300, ratos: 5, dois: 0.3 }))],
        ['paus', 8, 'Coleta Seletiva', (A) => A.juntos(A.coronelTriagem({ intervalo: 250, velocidade: 110, deriva: 80, certo: 0.25 }), A.coronelLatas({ intervalo: 2200, rajada: 1 }))],
        ['ouros', 9, 'Buzinaço Forte', (A) => A.juntos(A.coronelBuzinaco({ ondas: 3, intervalo: 1900, empurrao: 140 }), A.coronelEntulho({ intervalo: 650, maximo: 3, mirar: 0.65 }), A.coronelLatas({ intervalo: 1700, rajada: 1 }))],
        ['espadas', 9, 'Marcha à Ré', (A) => A.juntos(A.coronelRe({ intervalo: 1000, simultaneos: 2, leque: 7 }), A.coronelEntulho({ intervalo: 900, maximo: 3, mirar: 0.6 }), A.coronelLatas({ intervalo: 2000, rajada: 1 }))],
        ['copas', 7, 'Chapéu de Palha', null, { cura: 20, guarda: 0.6 }],
      ],
    },
    {
      hp: 0.5,
      entrada: 'COMPACTAÇÃO TOTAL! Chamei o outro caminhão!',
      velocidadeFundo: 2,
      falas: ['BI-BI! Segura o vão!', 'Aperta que cabe!', 'Separa direito ou vai pro compactador!'],
      cartas: [
        ['espadas', 11, 'Caminhão Duplo', (A) => A.juntos(A.coronelCaminhao({ simultaneos: 2, velocidade: 205, intervalo: 900, aviso: 800 }), A.coronelLatas({ intervalo: 1400, rajada: 2 }))],
        ['paus', 11, 'Compactador', (A) => A.juntos(A.coronelCompactador({ vezes: 2, vao: 100, fecha: 1350 }), A.coronelLatas({ duracao: 7300, intervalo: 1500, rajada: 2, velocidade: 70 }))],
        ['ouros', 10, 'Triagem Turbo', (A) => A.juntos(A.coronelTriagem({ intervalo: 220, velocidade: 125, deriva: 90, certo: 0.2 }), A.coronelRatos({ intervalo: 1800, ratos: 4 }))],
        ['espadas', 12, 'Atropela e Despeja', (A) => A.juntos(A.coronelRe({ intervalo: 1200, leque: 8, velocidadeLeque: 170 }), A.coronelCaminhao({ velocidade: 200, intervalo: 1200, aviso: 800 }), A.coronelEntulho({ intervalo: 1300, maximo: 2, mirar: 0.6 }))],
        ['copas', 9, 'Pit Stop', null, { cura: 22, guarda: 0.6 }],
      ],
    },
    {
      hp: 0.25,
      entrada: 'Chamei os primos! Todo mundo de caminhão!',
      velocidadeFundo: 2.4,
      falas: ['BI-BI! BI-BI!', 'Última coleta!', 'Primo, pela esquerda!'],
      cartas: [
        // (sem ♥: na última fase ele não para para o café)
        ['espadas', 13, 'Engarrafamento', (A) => A.juntos(A.caminhonete({ faixas: 4, velocidade: 90, intervalo: 1050, re: 0.3 }), A.coronelLatas({ intervalo: 1500, rajada: 2 }))],
        ['paus', 13, 'Lixão em Chamas', (A) => A.juntos(A.coronelEntulho({ intervalo: 450, maximo: 4, mirar: 0.6, aviso: 850 }), A.brasas({ intervalo: 480 }))],
        ['ouros', 12, 'Ratos no Compactador', (A) => A.juntos(A.coronelCompactador({ vezes: 2, vao: 104, fecha: 1300 }), A.coronelRatos({ duracao: 7300, intervalo: 1500, ratos: 4, velocidade: 150 }))],
        ['espadas', 12, 'Rodeio do Lixo', (A) => A.sequencia(A.coronelLatas({ duracao: 2600, intervalo: 650, rajada: 3 }), A.coronelRatos({ duracao: 2600, intervalo: 750, dois: 1 }), A.coronelCaminhao({ duracao: 3000, simultaneos: 2, velocidade: 215, intervalo: 850 }))],
      ],
    },
  ],
  super: {
    nome: 'Dia de Coleta',
    texto: 'Dois caminhões cruzam as faixas acesas enquanto o entulho e as latas caem, tudo avisado',
    criar: (A) => A.juntos(A.coronelCaminhao({ duracao: 7000, simultaneos: 2, velocidade: 195, intervalo: 1050 }), A.coronelEntulho({ duracao: 7000, intervalo: 700, maximo: 3 }), A.coronelLatas({ duracao: 7000, intervalo: 1700, rajada: 2 })),
  },
}
