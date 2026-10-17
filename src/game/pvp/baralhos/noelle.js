// Noelle: suporte (♥) gélido. Neve lenta, anéis de gelo, estalactites, avalanche de bolas de neve.
// Ataques exclusivos das cartas: attacks/habilidades/noelle.js (A.noelle...).
// Formato: ver o comentário "formato de um baralho" em pvp/padroes.js.
import { P, r, apertar, lerp, duracaoDe } from '../padroes.js'

export default {
  tema: { formas: ['losango', 'hex'], cores: { losango: 0x9fe6ff, hex: 0xe0f8ff, barra: 0xc8f0ff, bola: 0x9fe6ff }, cor: 0x9fe6ff },
  principal: { espadas: 'neve', ouros: 'lasers', paus: 'colunas' },
  leve: (A) => A.rain({ duracao: 4000, intervalo: 560, velocidade: 90, partida: 0.7, cascata: 3, raio: 7, girar: 1, mirar: 0.3 }),
  receitas: {
    nevasca: r('Neve com um anel de gelo se fechando', (A, t) => A.juntos(P.neve(A, t, { esparso: 1.5, caixa: null }), P.anel(A, t, { esparso: 1.5 }))),
    flocoAfiado: r('Flocos de lâminas entram girando pelas bordas, afiam um instante, disparam no coração e se cravam na parede', (A, t) =>
      A.noelleFlocoAfiado({ duracao: duracaoDe(t), intervalo: lerp(1150, 720, t), quantidade: t >= 0.4 ? 2 : 1, velocidade: lerp(150, 210, t), afiar: lerp(340, 260, t) }),
    ),
    granizo: r('Pedras de granizo pesadas despencam de cima em instantes sorteados, algumas de viés, e estouram em lascas no chão', (A, t) =>
      A.noelleGranizo({ duracao: duracaoDe(t), intervalo: lerp(880, 600, t), quantidade: t >= 0.6 ? 4 : 3, velocidade: lerp(250, 320, t), lascas: t >= 0.6 ? 5 : 4, mirar: 0.5 + 0.35 * t, deriva: lerp(18, 34, t) }),
    ),
    ventoGelido: r('Rajadas de vento gelado de um lado sorteado empurram o coração e trazem estilhaços de geada', (A, t) =>
      apertar(A, t, A.noelleVentoGelido({ duracao: duracaoDe(t), periodo: lerp(2500, 2100, t), rajada: lerp(1100, 1300, t), empurrao: lerp(50, 75, t), tiros: lerp(260, 190, t), velocidade: lerp(150, 195, t) })),
    ),
    raio: r('Um cristal entra pela borda, mira o coração e dispara um raio que congela a linha por onde passa', (A, t) =>
      A.noelleRaioDeGelo({ duracao: duracaoDe(t), intervalo: lerp(1500, 1100, t), aviso: lerp(620, 520, t), congelado: lerp(500, 620, t) }),
    ),
    inverno: r('Cristais de gelo voam e, a cada sopro do inverno, tudo congela no ar antes de seguir', (A, t) =>
      apertar(A, t, A.noelleInvernoEterno({ duracao: duracaoDe(t), intervalo: lerp(760, 560, t), velocidade: lerp(85, 105, t), ciclo: lerp(1900, 1650, t) })),
    ),
    pingentes: r('Pingentes se soltam do teto ou das paredes laterais, disparam acelerando e ficam cravados do outro lado como espetos', (A, t) =>
      A.noellePingentes({ duracao: duracaoDe(t), intervalo: lerp(1150, 800, t), quantidade: t >= 0.5 ? 4 : 3, soltar: lerp(380, 300, t), gravidade: lerp(950, 1150, t), cravado: lerp(1100, 1500, t), mirar: 0.5 + 0.35 * t, laterais: 0.5 }),
    ),
    estalactites: r('Estalactites enormes crescem do teto, do chão ou das laterais, ficam um tempo e recolhem', (A, t) =>
      A.noelleEstalactites({ duracao: duracaoDe(t), intervalo: lerp(1700, 1200, t), quantidade: t >= 0.75 ? 4 : t >= 0.45 ? 3 : 2, aviso: lerp(650, 520, t), manter: lerp(900, 1150, t), mirar: 0.3 + 0.3 * t }),
    ),
    avalanche: r('Bolas de neve entram rolando por todos os lados, fazem curva atrás do coração crescendo e se espatifam na parede em torrões', (A, t) =>
      A.noelleAvalanche({
        duracao: duracaoDe(t),
        intervalo: lerp(1600, 1150, t),
        velocidade: lerp(100, 120, t),
        maxima: lerp(130, 160, t),
        curva: 1.3 + 0.5 * t,
        perseguir: lerp(1000, 850, t),
        raioFinal: lerp(15, 18, t),
        torroes: t >= 0.6 ? 7 : 5,
        velocidadeTorrao: lerp(105, 135, t),
      }),
    ),
  },
  super: {
    nome: 'SNOWGRAVE',
    texto: 'O frio chega: um selo de gelo gira soltando flocos, a nevasca atravessa a caixa em paredes de estilhaços e, no fim, colunas de gelo explodem do chão até só sobrar um lugar seguro',
    criar: (A) => A.superNoelle()
  },
  cartas: [
    ['espadas', 1, 'Espelho de Gelo'],
    ['espadas', 4, 'Floco Afiado', 'flocoAfiado'],
    ['espadas', 8, 'Granizo', 'granizo'],
    ['espadas', 12, 'Nevasca', 'nevasca'],
    ['ouros', 1, 'Congelar'],
    ['ouros', 5, 'Vento Gélido', 'ventoGelido'],
    ['ouros', 9, 'Raio de Gelo', 'raio'],
    ['ouros', 13, 'Inverno Eterno', 'inverno', { inverter: 2000 }],
    ['paus', 1, 'Mão Fria'],
    ['paus', 3, 'Pingentes', 'pingentes'],
    ['paus', 7, 'Estalactites', 'estalactites'],
    ['paus', 11, 'Avalanche', 'avalanche'],
    ['copas', 1, 'Milagre de Natal'],
    ['copas', 2, 'Chocolate Quente', ['cura']],
    ['copas', 4, 'Sino de Natal', ['energia']],
    ['copas', 6, 'Cura Gelada', ['cura']],
    ['copas', 8, 'Casaco de Lã', ['escudo']],
    ['copas', 10, 'Prece', ['cura', 'compra']],
    ['copas', 11, 'Anjo da Neve', ['escudo', 'cura']],
  ],
}
