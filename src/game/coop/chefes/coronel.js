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
  // DIFÍCIL: o trânsito e o forcado já apertam bastante no ritmo base do
  // difícil; um pouco mais de dano (SUPER ~24 por acerto) e menos HP
  niveis: { dificil: { dano: 1.1, hp: 0.9 } },
  leve: (A) => A.brasas({ duracao: 4000, intervalo: 700 }),
  fases: [
    {
      hp: 1,
      falas: ['Sai da frente, sô!', 'Essa estrada é minha!', 'Fom-fom!'],
      cartas: [
        ['paus', 4, 'Churrasco', (A) => A.brasas()],
        ['espadas', 5, 'Forcado', (A) => A.forcado()],
        ['espadas', 6, 'Fom-Fom', (A) => A.caminhonete({ velocidade: 105, intervalo: 1700 })],
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
        ['espadas', 8, 'Olha a Ré!', (A) => A.caminhonete({ re: 0.45 })],
        ['paus', 8, 'Brasa e Faísca', (A) => A.juntos(A.brasas({ intervalo: 320 }), A.aimed({ forma: 'chama', intervalo: 1100, velocidade: 180 }))],
        ['ouros', 8, 'Forcado Ligeiro', (A) => A.forcado({ intervalo: 1150, parada: 200, palha: 2 })],
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
        ['espadas', 10, 'Pé na Tábua', (A) => A.caminhonete({ velocidade: 175, intervalo: 1300, vao: 90 })],
        ['paus', 11, 'Rodovia em Chamas', (A) => A.juntos(A.caminhonete({ velocidade: 100, intervalo: 2100, vao: 110 }), A.brasas({ intervalo: 560 }))],
        // o forcado estoca NO MEIO do trânsito: desvia do garfo sem cair na frente de uma caminhonete
        ['espadas', 11, 'Atropela e Espeta', (A) => A.juntos(A.caminhonete({ velocidade: 95, intervalo: 2300, vao: 120 }), A.forcado({ intervalo: 1800, palha: 0, pinca: 0 }))],
        ['ouros', 10, 'Fogo Cruzado', (A) => A.juntos(A.spiral({ velocidade: 130, bracos: 3 }), A.forcado({ intervalo: 2300, palha: 2 }))], // 3 braços: com o forcado, sempre sobra rota de fuga no DIFÍCIL
        ['copas', 9, 'Pit Stop', null, { cura: 22, guarda: 0.6 }],
      ],
    },
    {
      hp: 0.25,
      entrada: 'Chamei os primos! Todo mundo de caminhonete!',
      velocidadeFundo: 2.4,
      falas: ['BI-BI!', 'Última volta!', 'Primo, pela esquerda!'],
      cartas: [
        ['espadas', 13, 'Engarrafamento', (A) => A.caminhonete({ faixas: 4, velocidade: 85, intervalo: 1100, re: 0.25 })],
        ['ouros', 12, 'Primos de Caminhonete', (A) => A.juntos(A.caminhonete({ intervalo: 1700 }), A.aimed({ forma: 'chama', intervalo: 1300, velocidade: 190 })), { inverter: true }],
        ['paus', 13, 'Rodeio Completo', (A) => A.sequencia(A.brasas({ duracao: 2400, intervalo: 180 }), A.forcado({ duracao: 2400, intervalo: 900, parada: 180 }), A.caminhonete({ duracao: 2800, velocidade: 150, intervalo: 1400 }))],
        ['paus', 12, 'Churrasqueira Turbo', (A) => A.juntos(A.forcado({ intervalo: 1300 }), A.brasas({ intervalo: 300, estouro: 3 }))],
      ],
    },
  ],
  super: {
    nome: 'Buzinaço',
    texto: 'Todos os primos de caminhonete passam buzinando enquanto chove brasa, nas duas caixas',
    criar: (A) => A.juntos(A.caminhonete({ duracao: 6500, velocidade: 115, intervalo: 1700, vao: 100 }), A.brasas({ duracao: 6500, intervalo: 420 })),
  },
}
