import { ataques as A } from '../../attacks/index.js'

const CARROSSEL_RAPIDO = (giroDentro, giroFora) => [
  { raio: 42, quantidade: 8, giro: giroDentro },
  { raio: 112, quantidade: 18, giro: giroFora },
]

// Jevil — DIFÍCIL. Quatro fases com os quatro naipes, carrossel, foice e
// bombas, cada vez mais rápido. "Hipnotizar" reduz a agressividade (e deixa
// "Contar Piada" funcionar). SPARE quando o CANSAÇO chega a 100%.
export default {
  id: 'jevil',
  nome: 'Jevil',
  dificuldade: 'dificil',
  sprite: 'jevil',
  fundo: 'jevil',
  musica: 'jevil',

  hp: 480,
  defesa: 3,
  danoBala: 10,

  rotuloMercy: 'CANSAÇO',
  descricao: 'Um bobo da corte que só quer brincar. Hipnotizá-lo deixa tudo mais lento.',
  textoInicial: '* Jevil gira no meio do carrossel!',
  inventario: { bandagem: 2, cha: 2, pocao: 2, doce: 1, cristal: 1 },

  tema: {
    formas: ['espadas', 'copas', 'ouros', 'paus'],
    cores: {
      espadas: 0x9a8bff,
      copas: 0xff5f8a,
      ouros: 0xffd24c,
      paus: 0x5ff0b0,
      barra: 0xffffff,
      foice: 0xe8e0ff,
      bola: 0xffffff,
    },
    cor: 0xffffff,
  },

  acts: [
    {
      nome: 'Pirueta',
      executar(ctx) {
        ctx.texto(`* ${ctx.ator.nome} rodopiou até ficar tonto.`)
        ctx.texto('* Jevil rodopiou junto e cansou um pouco.')
        ctx.mercy(ctx.alvo, 10)
      },
    },
    {
      nome: 'Hipnotizar',
      executar(ctx) {
        ctx.texto(`* ${ctx.ator.nome} balançou um relógio na frente dele...`)
        ctx.texto('* Os ataques de Jevil ficaram mais lentos!')
        ctx.agressividade({ velocidade: 0.92, densidade: 0.9 })
        ctx.mercy(ctx.alvo, 6)
      },
    },
    {
      nome: 'Contar Piada',
      executar(ctx) {
        if (ctx.alvo.ritmo.velocidade <= 0.85) {
          ctx.texto(`* ${ctx.ator.nome} contou uma piada.`)
          ctx.texto('* Jevil riu... e bocejou.')
          ctx.mercy(ctx.alvo, 14)
        } else {
          ctx.texto(`* ${ctx.ator.nome} contou uma piada.`)
          ctx.texto('* Jevil riu alto demais e ficou ainda mais agitado!')
          ctx.agressividade({ velocidade: 1.05 })
          ctx.mercy(ctx.alvo, 4)
        }
      },
    },
  ],

  podePoupar: (chefe) => chefe.mercy >= 100,
  textoNaoPoupa: (chefe) => `* Jevil ainda quer brincar! (CANSAÇO ${chefe.mercy}%)`,
  aoFimDoTurno: (chefe, ctx) => ctx.mercy(chefe, 3),

  fases: [
    {
      hp: 1,
      flavor: ['* Jevil ri sem parar.', '* O carrossel range.', '* Cheiro de pipoca e caos.'],
      falas: ['Vamos brincar! Brincar!', 'Um, dois, três, naipes!', 'Hehehe! Pegue se puder!'],
      ataques: [
        A.colunas({ forma: 'espadas', quantidade: 3, velocidade: 200, intervalo: 1100 }),
        A.quicantes({ forma: 'ouros', intervalo: 800, velocidade: 190 }),
        A.anel({ forma: 'copas' }),
        A.divisores({ forma: 'paus' }),
      ],
    },
    {
      hp: 0.75,
      entrada: 'Hehe! Vamos girar mais rápido!',
      velocidadeFundo: 1.4,
      flavor: ['* O carrossel acelera.', '* Jevil equilibra uma foice no nariz.'],
      falas: ['Gira, gira, gira!', 'Cuidado com a lâmina!', 'Tique-taque, BUM!'],
      ataques: [A.carrossel(), A.foice({ varridas: 3 }), A.bombas()],
    },
    {
      hp: 0.5,
      entrada: 'CAOS! CAOS! Agora é brincadeira de verdade!',
      velocidadeFundo: 1.9,
      flavor: ['* Os naipes zumbem no ar.', '* Jevil não para de rir.'],
      falas: ['Mais! MAIS!', 'Vocês são divertidos!', 'Nenhuma regra! Hehe!'],
      ataques: [
        A.juntos(A.carrossel({ aneis: CARROSSEL_RAPIDO(1.5, -1.1) }), A.divisores({ intervalo: 1600, forma: 'paus' })),
        A.foice({ varridas: 4, travessia: 1500 }),
        A.juntos(A.anel({ forma: 'copas', intervalo: 2200 }), A.rain({ forma: 'espadas', intervalo: 380, velocidade: 170 })),
        A.bombas({ intervalo: 1100, fragmentos: 10, velocidade: 160 }),
      ],
    },
    {
      hp: 0.25,
      entrada: 'Eu posso brincar PARA SEMPRE!!',
      velocidadeFundo: 2.4,
      flavor: ['* O mundo gira.', '* Jevil está no auge da loucura.'],
      falas: ['PARA SEMPRE!', 'Hahahahaha!', 'Último truque! Ou não!'],
      ataques: [
        A.sequencia(
          A.colunas({ forma: 'espadas', quantidade: 3, velocidade: 260, intervalo: 900, duracao: 3200 }),
          A.anel({ forma: 'copas', duracao: 3200, intervalo: 1500, tempoFechar: 1200 }),
        ),
        A.juntos(A.foice({ varridas: 3, travessia: 1400 }), A.bombas({ intervalo: 1600, fragmentos: 8 })),
        A.juntos(A.carrossel({ aneis: CARROSSEL_RAPIDO(2.0, -1.5), duracao: 7000 }), A.divisores({ intervalo: 1300, velocidade: 140 })),
        A.quicantes({ forma: 'ouros', intervalo: 550, velocidade: 240, quiques: 5 }),
      ],
    },
  ],
}
