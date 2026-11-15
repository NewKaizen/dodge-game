// Coronel Caçamba (EXTREMO). Formato: ver o comentário em coop/chefes/index.js.
//
// CO-OP 2.0 (docs/coop-cartas.md "Coronel Caçamba"): a luta toda gira em volta da regra RECICLAGEM (coop/coronelRegra.js):
// parte do lixo que ele joga é VERDE e não machuca, enche a LIXEIRA da dupla e, cheia, lança o MÍSSIL RECICLADO nele.
// As cartas são poucas, longas de ler e todas AVISADAS (a faixa acende antes do caminhão, a sombra cresce antes do
// entulho, o vão do compactador aparece antes das placas andarem): nada de trânsito cheio nem de parede de brasa.
// Fase 1: o básico, com muito verde. Fase 2: caminhão mais rápido e o lixo MARROM (contaminado, machuca) misturado.
// Fase 3: caminhão duplo e o COMPACTADOR; a lixeira enche mais rápido.
import { criarRegraReciclagem } from '../coronelRegra.js'

export default {
  nome: 'Coronel Caçamba',
  dificuldade: 'extremo',
  sprite: 'coronel',
  fundo: 'coronel',
  musica: 'coronel',
  textoInicial: 'O Coronel Caçamba chegou para a coleta!',
  tema: {
    // o lixo que machuca é papelão e lata (nunca verde: o verde é só da reciclagem)
    formas: ['bola', 'losango'],
    cores: { bola: 0xb0875a, losango: 0xa7adb8, barra: 0x9aa7b4 },
    cor: 0xe8892a,
  },
  hp: 400, // CO-OP 2.0: era 320; o míssil reciclado tira uma boa parte (docs/coop-cartas.md "Coronel Caçamba")
  danoBala: 12,
  // DIFÍCIL: o caminhão e o entulho já apertam no ritmo base do difícil; um pouco mais de dano e menos HP
  niveis: { dificil: { dano: 1.1, hp: 0.9 } },
  regra: criarRegraReciclagem(),
  leve: (A) => A.coronelEntulho({ duracao: 4000, intervalo: 1500, maximo: 2, mirar: 0.3 }),
  fases: [
    {
      hp: 1,
      falas: ['Hora da coleta!', 'Separa o lixo, hein?', 'Fom-fom! Sai da frente!'],
      cartas: [
        ['espadas', 5, 'Caminhão de Lixo', (A) => A.coronelCaminhao({ velocidade: 140, intervalo: 1700 })],
        ['paus', 4, 'Chuva de Entulho', (A) => A.coronelEntulho({ intervalo: 900 })],
        ['ouros', 6, 'Buzinaço', (A) => A.juntos(A.coronelBuzinaco(), A.coronelEntulho({ intervalo: 1600, maximo: 2, mirar: 0.35 }))],
        ['copas', 4, 'Pausa pro Café', null, { cura: 26 }],
      ],
    },
    {
      hp: 0.66,
      entrada: 'Tá misturando o lixo! Quem separou errado?!',
      velocidadeFundo: 1.4,
      falas: ['Esse marrom não é reciclável!', 'Olha a buzina!', 'Quem pôs esse coração aí?!'],
      cartas: [
        ['espadas', 8, 'Caminhão Turbo', (A) => A.coronelCaminhao({ velocidade: 185, intervalo: 1300, aviso: 900 })],
        ['paus', 8, 'Entulho Mirado', (A) => A.coronelEntulho({ intervalo: 700, mirar: 0.7 })],
        ['ouros', 9, 'Buzinaço Forte', (A) => A.juntos(A.coronelBuzinaco({ ondas: 3, intervalo: 2300, empurrao: 130 }), A.coronelEntulho({ intervalo: 1400, maximo: 2 }))],
        ['espadas', 9, 'Caminhão e Entulho', (A) => A.juntos(A.coronelCaminhao({ velocidade: 150, intervalo: 2000 }), A.coronelEntulho({ intervalo: 1700, maximo: 2, mirar: 0.4 }))],
        ['copas', 7, 'Chapéu de Palha', null, { cura: 20, guarda: 0.6 }],
      ],
    },
    {
      hp: 0.33,
      entrada: 'COMPACTAÇÃO TOTAL! Chamei o outro caminhão!',
      velocidadeFundo: 2,
      falas: ['BI-BI! Segura o vão!', 'Última coleta!', 'Aperta que cabe!'],
      cartas: [
        ['espadas', 11, 'Caminhão Duplo', (A) => A.coronelCaminhao({ simultaneos: 2, velocidade: 165, intervalo: 1300, aviso: 950 })],
        ['paus', 11, 'Compactador', (A) => A.coronelCompactador()],
        ['ouros', 10, 'Buzinaço Final', (A) => A.juntos(A.coronelBuzinaco({ ondas: 3, intervalo: 2200, empurrao: 135 }), A.coronelEntulho({ intervalo: 1100, maximo: 2, mirar: 0.55 }))],
        ['espadas', 12, 'Caminhão e Entulho', (A) => A.juntos(A.coronelCaminhao({ velocidade: 170, intervalo: 1800 }), A.coronelEntulho({ intervalo: 1300, maximo: 2, mirar: 0.55 }))],
        ['copas', 9, 'Pit Stop', null, { cura: 22, guarda: 0.6 }],
      ],
    },
  ],
  super: {
    nome: 'Dia de Coleta',
    texto: 'Dois caminhões cruzam as faixas acesas enquanto o entulho cai, tudo avisado',
    criar: (A) => A.juntos(A.coronelCaminhao({ duracao: 6500, simultaneos: 2, velocidade: 150, intervalo: 1500 }), A.coronelEntulho({ duracao: 6500, intervalo: 1300, maximo: 2 })),
  },
}
