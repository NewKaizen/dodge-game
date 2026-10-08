// Coronel Caçamba (EXTREMO). Formato: ver o comentário em coop/chefes/index.js.
export default {
  nome: 'Coronel Caçamba',
  dificuldade: 'extremo',
  sprite: 'coronel',
  fundo: 'coronel',
  musica: 'coronel',
  textoInicial: 'O Coronel Caçamba buzina e acelera na sua direção!',
  tema: {
    formas: ['chama', 'bola'],
    cores: { chama: 0xff8a1c, bola: 0xffd24c, barra: 0xd8d8e0 },
    cor: 0xff8a1c,
  },
  hp: 320,
  danoBala: 12,
  // DIFÍCIL: padrões mais rápidos e densos, um pouco mais de dano (SUPER ~26 por acerto)
  niveis: { dificil: { velocidade: 1.15, densidade: 1.3, velocidadeMax: 1.1, dano: 1.2, hp: 1.05 } },
  leve: (A) => A.brasas({ duracao: 4000, intervalo: 700 }),
  fases: [
    {
      hp: 1,
      falas: ['Sai da frente, sô!', 'Essa estrada é minha!', 'Fom-fom!'],
      cartas: [
        ['paus', 4, 'Churrasco', (A) => A.brasas()],
        ['espadas', 5, 'Forcado', (A) => A.forcado()],
        ['espadas', 6, 'Fom-Fom', (A) => A.caminhonete({ re: 0 })],
        ['ouros', 5, 'Faísca Mirada', (A) => A.aimed({ forma: 'chama', velocidade: 170, intervalo: 700 })],
        ['copas', 4, 'Pausa pro Café', null, { cura: 26 }],
      ],
    },
    {
      hp: 0.75,
      entrada: 'Espera aí que eu vou dar a volta!',
      velocidadeFundo: 1.4,
      falas: ['Olha a ré!', 'Eu dirijo muito bem!', 'Quem pôs esse coração aí?!'],
      cartas: [
        ['espadas', 8, 'Olha a Ré!', (A) => A.caminhonete()],
        ['paus', 8, 'Brasa e Faísca', (A) => A.juntos(A.brasas({ intervalo: 320 }), A.aimed({ forma: 'chama', intervalo: 1100, velocidade: 180 }))],
        ['ouros', 8, 'Forcado Ligeiro', (A) => A.forcado({ intervalo: 1200, parada: 200 })],
        ['ouros', 9, 'Redemoinho de Fogo', (A) => A.spiral({ forma: 'chama', velocidade: 130 })],
        ['copas', 7, 'Chapéu de Palha', null, { cura: 20, guarda: 0.6 }],
      ],
    },
    {
      hp: 0.5,
      entrada: 'AGORA EU PISO FUNDO!',
      velocidadeFundo: 1.9,
      falas: ['Segura o chapéu!', 'Fom-fom! FOM-FOM!', 'Não tem freio não!'],
      cartas: [
        ['espadas', 10, 'Pé na Tábua', (A) => A.caminhonete({ intervalo: 1500, velocidade: 440 })],
        ['paus', 11, 'Rodovia em Chamas', (A) => A.juntos(A.caminhonete({ intervalo: 2400, re: 0 }), A.brasas({ intervalo: 420 }))],
        ['espadas', 11, 'Atropela e Espeta', (A) => A.sequencia(A.forcado({ duracao: 3500, intervalo: 1000 }), A.caminhonete({ duracao: 3500 }))],
        ['ouros', 10, 'Fogo Cruzado', (A) => A.juntos(A.spiral({ velocidade: 140, bracos: 3 }), A.forcado({ intervalo: 1900 }))], // 3 braços: com o forcado, sempre sobra rota de fuga no DIFÍCIL
        ['copas', 9, 'Pit Stop', null, { cura: 22, guarda: 0.6 }],
      ],
    },
    {
      hp: 0.25,
      entrada: 'Chamei os primos! Todo mundo de caminhonete!',
      velocidadeFundo: 2.4,
      falas: ['BI-BI!', 'Última volta!', 'Primo, pela esquerda!'],
      cartas: [
        ['espadas', 13, 'Engarrafamento', (A) => A.caminhonete({ faixas: 4, ocupar: 2, intervalo: 1500 })],
        ['ouros', 12, 'Primos de Caminhonete', (A) => A.juntos(A.caminhonete({ intervalo: 1700 }), A.aimed({ forma: 'chama', intervalo: 1300, velocidade: 190 })), { inverter: true }],
        ['paus', 13, 'Rodeio Completo', (A) => A.sequencia(A.brasas({ duracao: 2400, intervalo: 180 }), A.forcado({ duracao: 2400, intervalo: 900, parada: 180 }), A.caminhonete({ duracao: 2800, velocidade: 460 }))],
        ['paus', 12, 'Churrasqueira Turbo', (A) => A.juntos(A.forcado({ intervalo: 1300 }), A.brasas({ intervalo: 300, estouro: 3 }))],
      ],
    },
  ],
  super: {
    nome: 'Buzinaço',
    texto: 'Todos os primos de caminhonete passam buzinando enquanto chove brasa, nas duas caixas',
    criar: (A) => A.juntos(A.caminhonete({ duracao: 6500, intervalo: 1800 }), A.brasas({ duracao: 6500, intervalo: 380 })),
  },
}
