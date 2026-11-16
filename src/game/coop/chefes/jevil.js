// Jevil (DIFÍCIL). Formato: ver o comentário em coop/chefes/index.js.
// CO-OP 2.0: a regra dele é o DADO DO CAOS (coop/jevilRegra.js, docs/coop-cartas.md "Jevil"): no começo de toda
// rodada um dado gigante rola e a face que cair muda UMA coisa da rodada para todos; a face da rodada de depois já
// aparece na prévia. Fase 1: faces leves; fase 2: as malucas; fase 3: CAOS CAOS (dois dados).
//
// DIFICULDADE DO CO-OP (docs/coop-cartas.md "Dificuldade do CO-OP"): os ataques de assinatura dele: a ROLETA (lâminas
// girando e a bolinha que para numa fatia e solta um leque de naipes), os MALABARES (bombas em arco que caem onde a
// sombra cresce e explodem em naipes) e o CARROSSEL DE OUROS (um anel de losangos que fecha em volta do coração).
import { REGRA_DO_JEVIL } from '../jevilRegra.js'

const CARROSSEL_RAPIDO = (giroDentro, giroFora) => [
  { raio: 42, quantidade: 8, giro: giroDentro },
  { raio: 112, quantidade: 18, giro: giroFora },
]

export default {
  nome: 'Jevil',
  dificuldade: 'dificil',
  sprite: 'jevil',
  fundo: 'jevil',
  musica: 'jevil',
  desafio: { velocidade: 1.08, densidade: 1.12 },
  textoInicial: 'Jevil gira no meio do carrossel!',
  regra: REGRA_DO_JEVIL,
  tema: {
    formas: ['espadas', 'copas', 'ouros', 'paus'],
    cores: {
      espadas: 0x9a8bff,
      copas: 0xff5f8a,
      ouros: 0xffd24c,
      paus: 0x5ff0b0,
      hex: 0xf4f0ff, // os dados que quicam
      barra: 0xffffff,
      foice: 0xe8e0ff,
      bola: 0xffffff,
    },
    cor: 0xffffff,
  },
  hp: 410, // CO-OP 2.0: era 310; o dado do caos pesa na luta (simularCoop: ~3,3 min no MÉDIO misto)
  danoBala: 15, // era 13 (dificuldade do CO-OP)
  // DIFÍCIL: padrões mais rápidos e densos (os dele são os mais fáceis de ler),
  // um pouco mais de dano (SUPER ~27 por acerto)
  niveis: { medio: { dano: 1.8 }, dificil: { velocidade: 1.15, densidade: 1.25, velocidadeMax: 1.1, dano: 1.3, hp: 1.1 } },
  leve: (A) => A.quicantes({ forma: 'ouros', duracao: 4000, intervalo: 1500, velocidade: 150 }),
  fases: [
    {
      // 1: a mesa de jogo. O dado só sorteia faces leves (SORTE, GRAVIDADE, RÁPIDO E LEVE); as cartas são as mais fáceis de ler
      hp: 1,
      falas: ['Vamos brincar! Brincar!', 'Um, dois, três, naipes!', 'Hehehe! Role o dado!'],
      cartas: [
        ['espadas', 5, 'Espadas Dançantes', (A) => A.colunas({ forma: 'espadas', quantidade: 3, velocidade: 200, intervalo: 1100 })],
        ['ouros', 6, 'Dados Quicantes', (A) => A.quicantes({ forma: 'hex', intervalo: 850, velocidade: 185 })],
        ['paus', 4, 'Anel de Copas', (A) => A.anel({ forma: 'copas' })],
        ['paus', 5, 'Divisão de Paus', (A) => A.divisores({ forma: 'paus' })],
        ['ouros', 6, 'Malabares', (A) => A.jevilMalabares({ intervalo: 1050, naipes: 6 })],
        ['espadas', 6, 'Roleta', (A) => A.jevilRoleta({ bola: 1400, leque: 4 })],
        ['espadas', 6, 'Chuva de Naipes', (A) => A.rain({ forma: 'espadas', intervalo: 360, velocidade: 125 })],
        ['copas', 4, 'Pipoca', null, { cura: 26 }],
      ],
    },
    {
      // 2: o carrossel e a foice (a marca dele) com as faces malucas (TROCADOS, ESPELHADOS, UM POR VEZ, MESA INCLINADA)
      hp: 0.75,
      entrada: 'Hehe! Vamos girar mais rápido!',
      velocidadeFundo: 1.4,
      falas: ['Gira, gira, gira!', 'Cuidado com a lâmina!', 'Tique-taque, BUM!'],
      cartas: [
        ['ouros', 8, 'Carrossel', (A) => A.carrossel()],
        ['espadas', 9, 'Foice Giratória', (A) => A.foice({ varridas: 3 })],
        ['paus', 8, 'Tique-Taque', (A) => A.juntos(A.bombas(), A.jevilMalabares({ intervalo: 1700, juntas: 1, naipes: 5 }))],
        ['ouros', 7, 'Dados Loucos', (A) => A.quicantes({ forma: 'hex', intervalo: 650, velocidade: 205 })],
        ['ouros', 9, 'Carrossel de Ouros', (A) => A.juntos(A.jevilOrbita({ intervalo: 2200, pontos: 12 }), A.rain({ forma: 'paus', intervalo: 950, velocidade: 130 }))],
        ['espadas', 8, 'Roleta Russa', (A) => A.jevilRoleta({ laminas: 2, bola: 1250, leque: 5, giro: 1.4 })],
        ['copas', 7, 'Pirueta', null, { cura: 20, guarda: 0.6 }],
      ],
    },
    {
      // 3: CAOS CAOS: dois dados por rodada
      hp: 0.5,
      entrada: 'CAOS! CAOS! Dois dados! Hehehehe!',
      velocidadeFundo: 1.9,
      falas: ['Mais! MAIS!', 'Vocês são divertidos!', 'Nenhuma regra! Hehe!'],
      cartas: [
        ['ouros', 11, 'Carrossel Maluco', (A) => A.juntos(A.carrossel({ aneis: CARROSSEL_RAPIDO(1.5, -1.1) }), A.divisores({ intervalo: 1600, forma: 'paus' }))],
        ['espadas', 10, 'Lâmina Louca', (A) => A.juntos(A.foice({ varridas: 4, travessia: 1500 }), A.jevilOrbita({ intervalo: 1900, pontos: 12 }))],
        ['ouros', 11, 'Malabares de Fogo', (A) => A.jevilMalabares({ intervalo: 1150, juntas: 2, naipes: 7, velocidadeNaipe: 150 })],
        ['paus', 10, 'Chuva de Naipes', (A) => A.juntos(A.anel({ forma: 'copas', intervalo: 2400 }), A.rain({ forma: 'espadas', intervalo: 460, velocidade: 170 }))], // chuva espaçada: com o anel, sempre sobra rota de fuga no DIFÍCIL
        ['paus', 9, 'BUM!', (A) => A.juntos(A.bombas({ intervalo: 1100, fragmentos: 10, velocidade: 160 }), A.jevilMalabares({ intervalo: 2000, naipes: 5 }))],
        ['copas', 9, 'Gargalhada', null, { cura: 22, guarda: 0.6 }],
      ],
    },
    {
      // 4: o último truque: dois dados e só faces malucas
      hp: 0.25,
      entrada: 'Eu posso brincar PARA SEMPRE!!',
      velocidadeFundo: 2.4,
      falas: ['PARA SEMPRE!', 'Hahahahaha!', 'Último truque! Ou não!', 'Role! Role! ROLE!'],
      cartas: [
        ['espadas', 12, 'Naipes em Fila', (A) => A.sequencia(A.colunas({ forma: 'espadas', quantidade: 3, velocidade: 260, intervalo: 900, duracao: 3200 }), A.anel({ forma: 'copas', duracao: 3200, intervalo: 1500, tempoFechar: 1200 }))],
        ['espadas', 13, 'Caos Afiado', (A) => A.juntos(A.foice({ varridas: 3, travessia: 1400 }), A.bombas({ intervalo: 1600, fragmentos: 8 }))],
        ['ouros', 13, 'Para Sempre', (A) => A.juntos(A.carrossel({ aneis: CARROSSEL_RAPIDO(2.0, -1.5), duracao: 7000 }), A.divisores({ intervalo: 1300, velocidade: 140 }))],
        ['ouros', 12, 'Dados Malucos', (A) => A.quicantes({ forma: 'hex', intervalo: 550, velocidade: 240, quiques: 5 })],
        ['espadas', 13, 'Roleta do Caos', (A) => A.juntos(A.jevilRoleta({ laminas: 2, bola: 1100, leque: 6, giro: 1.6, duracao: 7000 }), A.rain({ forma: 'copas', intervalo: 700, velocidade: 140, duracao: 7000 }))],
        ['paus', 13, 'Malabarismo Infinito', (A) => A.juntos(A.jevilMalabares({ duracao: 7000, intervalo: 1000, juntas: 2, naipes: 8 }), A.rain({ forma: 'espadas', intervalo: 520, velocidade: 150, duracao: 7000 }))],
      ],
    },
  ],
  super: {
    nome: 'CAOS! CAOS!',
    texto: 'O carrossel dispara e depois a foice e as bombas giram juntas, nas duas caixas',
    criar: (A) => A.sequencia(A.juntos(A.carrossel({ aneis: CARROSSEL_RAPIDO(1.6, -1.2), duracao: 3600 }), A.jevilMalabares({ duracao: 3600, intervalo: 1300 })), A.juntos(A.jevilRoleta({ duracao: 3800, laminas: 2, bola: 1100, leque: 6 }), A.bombas({ duracao: 3800, intervalo: 1700, fragmentos: 8 }))),
  },
}
