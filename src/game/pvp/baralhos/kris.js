// Kris: equilibrado, puxado para controle (♦). Espada, mira e planos.
// Formato: ver o comentário "formato de um baralho" em pvp/padroes.js.
import { P, r, apertar, duracaoDe, lerp } from '../padroes.js'

export default {
  tema: { formas: ['espadas', 'losango'], cores: { espadas: 0x4aa8ff, losango: 0x9fd0ff, barra: 0xbfe0ff, bola: 0x4aa8ff }, cor: 0x4aa8ff },
  principal: { espadas: 'estocadas', ouros: 'mira', paus: 'forcado' },
  leve: (A) => A.sides({ duracao: 4000, intervalo: 1500, velocidade: 140, eco: 0 }),
  receitas: {
    corte: r('Uma espada larga presa na parede gira meia volta e corta a meia-lua do lado do coração', (A, t) =>
      A.krisCorteFirme({ duracao: duracaoDe(t), intervalo: lerp(1500, 1050, t), aviso: lerp(800, 650, t), giro: lerp(540, 420, t), vertical: t >= 0.45 })),
    dupla: r('Um florete estoca na fileira do coração, recua, mira de novo e estoca outra vez', (A, t) =>
      A.krisEstocadaDupla({ duracao: duracaoDe(t), intervalo: lerp(1750, 1150, t), aviso: lerp(600, 460, t), avisoVolta: lerp(480, 400, t), velocidade: lerp(480, 680, t), alcance: lerp(0.6, 0.7, t) })),
    determinada: r('Estocadas e colunas ao mesmo tempo', (A, t) =>
      A.juntos(P.estocadas(A, t, { esparso: 1.5, caixa: null }), P.colunas(A, t, { esparso: 1.6, quantidade: 2, forma: 'espadas' }))),
    olhar: r('Um olho vazio segue o coração devagar, fixa o olhar e pisca num clarão que solta faíscas', (A, t) =>
      apertar(A, t, A.krisOlharVazio({ duracao: duracaoDe(t), intervalo: lerp(1600, 1050, t), velocidade: lerp(55, 85, t), aviso: lerp(650, 480, t), cilios: t >= 0.6 ? 6 : 4, velocidadeCilio: lerp(80, 115, t) }))),
    passo: r('Pegadas andam até onde o coração vai estar e pisam com força: mude de direção', (A, t) =>
      apertar(A, t, A.krisPassoCalculado({ duracao: duracaoDe(t), intervalo: lerp(1500, 1000, t), passos: t >= 0.6 ? 5 : 4, cadencia: lerp(220, 170, t), aviso: lerp(520, 430, t) }))),
    plano: r('Setas de um plano de batalha riscam a caixa e uma tropa de peões marcha por elas', (A, t) =>
      apertar(A, t, A.krisPlanoTatico({ duracao: duracaoDe(t), intervalo: lerp(2100, 1500, t), setas: t >= 0.8 ? 3 : 2, tropas: t >= 0.6 ? 4 : 3, velocidade: lerp(140, 190, t), aviso: lerp(800, 620, t) }))),
    formacao: r('Lasers alternados numa caixa apertada', (A, t) => apertar(A, t, P.lasers(A, t, { orientacao: 'alternar', quantidade: 1 }))),
    alma: r('A alma vermelha prende o coração por um fio e bate, soltando anéis de cacos com um só vão', (A, t) =>
      apertar(A, t, A.krisControleDaAlma({ duracao: duracaoDe(t), intervalo: lerp(1400, 1000, t), velocidade: lerp(70, 92, t), cacos: t >= 0.7 ? 18 : 16 }))),
    espinhos: r('Placas de espinhos no chão: pisou (ou demorou), clique, e os espinhos sobem', (A, t) =>
      A.krisArmadilhaEspinhos({ duracao: duracaoDe(t), intervalo: lerp(750, 480, t), maximo: lerp(5, 8, t), vidaPlaca: lerp(2600, 1900, t), aviso: lerp(520, 430, t), corrente: t >= 0.55 })),
    emboscada: r('Forcado e chão rachado', (A, t) => A.juntos(P.forcado(A, t, { esparso: 1.4 }), P.rachaduras(A, t, { esparso: 1.9, ramos: 3 }))),
  },
  super: {
    nome: 'Alma Determinada',
    texto: 'Estocadas com colunas de espada, lasers alternados numa caixa apertada e o forcado com rajadas miradas',
    criar: (A) => A.superKris()
  },
  cartas: [
    ['espadas', 1, 'Reflexo da Lâmina'],
    ['espadas', 3, 'Golpe Rápido', 'estocadas'],
    ['espadas', 6, 'Corte Firme', 'corte'],
    ['espadas', 9, 'Estocada Dupla', 'dupla'],
    ['espadas', 13, 'Lâmina Determinada', 'determinada'],
    ['ouros', 1, 'Silêncio'],
    ['ouros', 2, 'Olhar Vazio', 'olhar'],
    ['ouros', 5, 'Passo Calculado', 'passo'],
    ['ouros', 8, 'Plano Tático', 'plano'],
    ['ouros', 11, 'Formação', 'formacao'],
    ['ouros', 12, 'Controle da Alma', 'alma', { inverter: 1500 }],
    ['paus', 1, 'Mão Leve'],
    ['paus', 4, 'Armadilha de Espinhos', 'espinhos'],
    ['paus', 7, 'Mina no Chão', 'bombas'],
    ['paus', 10, 'Emboscada', 'emboscada'],
    ['copas', 1, 'Determinação'],
    ['copas', 3, 'Respirar Fundo', ['energia']],
    ['copas', 7, 'Escudo Improvisado', ['escudo']],
    ['copas', 10, 'Torta de Caramelo', ['cura']],
  ],
}
