// Expedição do Jevil, 1ª luta: os LACAIOS (cartas vivas e palhacinhos). Aquecimento curto (~2 min), sem regra:
// só ataques simples e fáceis de ler. Um "chefe" cujo sprite mostra o grupo e cujo baralho mistura as cartas deles.
// Fora da seleção de chefes (oculto: true): `scene.start('CoopArena', { chefe: 'jevilLacaios' })`.
export default {
  nome: 'Lacaios do Jevil',
  oculto: true,
  expedicao: true,
  dificuldade: 'facil',
  sprite: 'jevil-lacaios',
  fundo: 'jevil',
  musica: 'jevil',
  textoInicial: 'As cartas vivas e os palhacinhos do Jevil!',
  tema: {
    formas: ['espadas', 'copas', 'ouros', 'paus'],
    cores: { espadas: 0x9a8bff, copas: 0xff5f8a, ouros: 0xffd24c, paus: 0x5ff0b0, bola: 0xffffff },
    cor: 0xff9ad0,
  },
  hp: 250,
  danoBala: 9,
  leve: (A) => A.quicantes({ forma: 'ouros', duracao: 4000, intervalo: 1600, velocidade: 130 }),
  fases: [
    {
      // as cartas vivas
      hp: 1,
      falas: ['Somos as cartas do Jevil!', 'Espadas! Copas!', 'Passa a vez!'],
      cartas: [
        ['espadas', 4, 'Espadas Marchando', (A) => A.colunas({ forma: 'espadas', quantidade: 2, velocidade: 170, intervalo: 1300 })],
        ['copas', 5, 'Corações em Roda', (A) => A.anel({ forma: 'copas' })],
        ['paus', 4, 'Paus Cadentes', (A) => A.rain({ forma: 'paus', intervalo: 420, velocidade: 115 })],
        ['espadas', 5, 'Carta Marcada', (A) => A.aimed({ forma: 'espadas', intervalo: 1100, velocidade: 130 })],
        ['copas', 3, 'Descansar', null, { cura: 18 }],
      ],
    },
    {
      // os palhacinhos entram
      hp: 0.5,
      entrada: 'Os palhacinhos chegaram! Hihihi!',
      velocidadeFundo: 1.3,
      falas: ['Hihihi! Pega!', 'Pula-pula!', 'Palhaçada!'],
      cartas: [
        ['ouros', 5, 'Bolinhas Pulantes', (A) => A.quicantes({ forma: 'ouros', intervalo: 900, velocidade: 170 })],
        ['paus', 5, 'Palhaçada em Dois', (A) => A.divisores({ forma: 'paus' })],
        ['espadas', 6, 'Chuva de Confete', (A) => A.rain({ forma: 'espadas', intervalo: 380, velocidade: 125 })],
        ['copas', 5, 'Risadinha', null, { cura: 14, guarda: 0.7 }],
      ],
    },
  ],
  super: {
    nome: 'Cambalhota Geral',
    texto: 'Os palhacinhos jogam bolinhas pela caixa toda',
    criar: (A) => A.juntos(A.quicantes({ forma: 'ouros', duracao: 4500, intervalo: 800, velocidade: 150 }), A.rain({ forma: 'paus', duracao: 4500, intervalo: 520, velocidade: 110 })),
  },
}
