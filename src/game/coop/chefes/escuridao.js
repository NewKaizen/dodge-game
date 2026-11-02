// BOSS SEMANAL · ESCURIDÃO (docs/boss-semanal.md). Formato: ver o comentário em coop/chefes/index.js.
// A caixa fica quase preta: cada um vê só o PRÓPRIO coração e desvia pelo SOM (coop/semanal/escuridao.js:
// panorâmica = posição horizontal, altura do som = posição vertical, um tique que acelera quando a bala
// chega perto, um timbre por tipo de ataque). Por isso os padrões são MAIS LENTOS e espaçados que os dos
// outros chefes (desafio < 1) e os ataques usam poucos tipos de bala, um timbre cada:
//   chuva (rain)  -> chiado          laser (lasers) -> zumbido de serra
//   bomba (bombas)-> tambor grave    o resto (aimed, sides, colunas) -> sino
export default {
  nome: 'Escuridão',
  dificuldade: 'medio',
  semanal: true,
  escuro: true,
  sprite: 'escuridao',
  fundo: 'escuridao',
  musica: 'king',
  desafio: { velocidade: 0.72, densidade: 0.62 },
  textoInicial: 'As luzes se apagam. Ouça.',
  tema: {
    formas: ['bola', 'losango'],
    cores: { bola: 0xb8b0ff, losango: 0x8a7cff, barra: 0xd8d0ff },
    cor: 0xb8b0ff,
  },
  hp: 280,
  danoBala: 9,
  leve: (A) => A.rain({ duracao: 4000, intervalo: 700, velocidade: 90, caixa: null }),
  fases: [
    {
      hp: 1,
      falas: ['Você me ouve?', 'Feche os olhos. Escute.', 'O silêncio também corta.'],
      cartas: [
        ['espadas', 4, 'Garoa Surda', (A) => A.rain({ intervalo: 520, velocidade: 95, caixa: null })],
        ['ouros', 5, 'Olhar no Escuro', (A) => A.aimed({ intervalo: 1500, velocidade: 100, rajada: 2, caixa: null })],
        ['paus', 5, 'Tambor Distante', (A) => A.bombas({ intervalo: 2300, fragmentos: 6, velocidade: 95 })],
        ['espadas', 6, 'Zumbido', (A) => A.lasers({ intervalo: 2100, aviso: 900 })],
        ['copas', 4, 'Respirar Fundo', null, { cura: 20 }],
      ],
    },
    {
      hp: 0.5,
      entrada: 'Agora... nem a sua sombra vai te ajudar.',
      velocidadeFundo: 1.3,
      falas: ['Mais perto. Mais perto.', 'Conte as batidas.', 'Esquerda? Direita?'],
      cartas: [
        ['espadas', 9, 'Tempestade Muda', (A) => A.juntos(A.rain({ intervalo: 600, velocidade: 100, caixa: null }), A.lasers({ intervalo: 2600, aviso: 900 }))],
        ['paus', 9, 'Marcha dos Tambores', (A) => A.bombas({ intervalo: 1800, fragmentos: 7, velocidade: 100 })],
        ['ouros', 10, 'Lâminas no Breu', (A) => A.sides({ intervalo: 1500, velocidade: 120, caixa: null })],
        ['espadas', 11, 'Eco Cruzado', (A) => A.sequencia(A.aimed({ duracao: 3000, intervalo: 1300, velocidade: 105, caixa: null }), A.lasers({ duracao: 3000, intervalo: 1500, aviso: 900 }))],
        ['copas', 8, 'Silêncio', null, { cura: 16, guarda: 0.6 }],
      ],
    },
  ],
  super: {
    nome: 'Breu Total',
    texto: 'Chuva, tambores e zumbidos juntos, no escuro',
    criar: (A) => A.juntos(A.rain({ duracao: 6000, intervalo: 650, velocidade: 100, caixa: null }), A.bombas({ duracao: 6000, intervalo: 2200, fragmentos: 6, velocidade: 95 })),
  },
}
