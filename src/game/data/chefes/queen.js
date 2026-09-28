import { ataques as A } from '../../attacks/index.js'

// Queen — MÉDIO. Três fases com ritmo: ondas neon, lasers com aviso e bolas
// quicando. "Pedir Calma" deixa o próximo ataque mais lento; o SPARE só
// funciona depois que ela entra na segunda fase.
export default {
  id: 'queen',
  nome: 'Queen',
  dificuldade: 'medio',
  sprite: 'queen',
  fundo: 'queen',
  musica: 'queen',

  hp: 360,
  defesa: 2,
  danoBala: 8,

  rotuloMercy: 'MERCY',
  descricao: 'Uma rainha digital obcecada por desempenho. Odeia ser ignorada.',
  textoInicial: '* Queen aparece num holograma gigante!',
  inventario: { bandagem: 2, cha: 2, doce: 2, pocao: 1 },

  tema: {
    formas: ['hex'],
    cores: { hex: 0x40f0ff, barra: 0xff4fc8, bola: 0x40f0ff },
    cor: 0x40f0ff,
  },

  acts: [
    {
      nome: 'Elogiar',
      executar(ctx) {
        ctx.texto(`* ${ctx.ator.nome} elogiou o penteado de Queen.`)
        ctx.texto('* "Finalmente alguém com bom gosto!"')
        ctx.mercy(ctx.alvo, 18)
      },
    },
    {
      nome: 'Pedir Calma',
      executar(ctx) {
        ctx.texto(`* ${ctx.ator.nome} pediu para Queen respirar fundo.`)
        ctx.texto('* O próximo ataque vai vir mais devagar.')
        ctx.proximoAtaque({ velocidade: 0.65, densidade: 0.8 })
        ctx.mercy(ctx.alvo, 8)
      },
    },
    {
      nome: 'Dançar',
      executar(ctx) {
        if (ctx.fase >= 1) {
          ctx.texto(`* ${ctx.ator.nome} dançou no ritmo do holograma!`)
          ctx.texto('* Queen não resiste e dança junto.')
          ctx.mercy(ctx.alvo, 25)
        } else {
          ctx.texto(`* ${ctx.ator.nome} tentou dançar...`)
          ctx.texto('* "Ainda não estou no clima."')
          ctx.mercy(ctx.alvo, 5)
        }
      },
    },
  ],

  podePoupar: (chefe) => chefe.mercy >= 100 && chefe.fase >= 1,
  textoNaoPoupa: (chefe) =>
    chefe.mercy >= 100
      ? '* Queen só vai te ouvir depois de ser desafiada. (Tire HP dela.)'
      : `* Queen ainda não quer parar. (MERCY ${chefe.mercy}%)`,

  fases: [
    {
      hp: 1,
      flavor: ['* O holograma pisca em neon.', '* Música eletrônica ao fundo.', '* Queen ajusta o visor.'],
      falas: ['Carregando... a sua derrota!', 'Ha! Ha! Ha!', 'Sintam o poder do Wi-Fi!'],
      ataques: [
        A.ondas({ velocidade: 130, intervalo: 850 }),
        A.quicantes({ intervalo: 1000, velocidade: 150 }),
        A.lasers({ quantidade: 1, intervalo: 1200 }),
      ],
    },
    {
      hp: 0.66,
      entrada: 'Atualizando para a versão 2.0!',
      velocidadeFundo: 1.4,
      flavor: ['* As linhas de dados aceleram.', '* Queen está suando pixels.'],
      falas: ['Versão 2.0! Muito melhor!', 'Vocês não têm memória suficiente!', 'Dancem, dancem!'],
      ataques: [
        A.lasers({ quantidade: 2, orientacao: 'alternar', intervalo: 1100 }),
        A.ondas({ velocidade: 170, intervalo: 700, amplitude: 50, direcao: 'direita' }),
        A.juntos(
          A.quicantes({ intervalo: 1500, gravidade: 220, quiques: 5 }),
          A.ondas({ velocidade: 120, intervalo: 1100, direcao: 'baixo', abertura: 72 }),
        ),
      ],
    },
    {
      hp: 0.33,
      entrada: 'Modo turbo ativado! Tentem acompanhar!',
      velocidadeFundo: 1.9,
      flavor: ['* O holograma está superaquecendo.', '* Queen perdeu a pose.'],
      falas: ['TURBO!', 'Eu não travo! Eu NÃO TRAVO!', 'Reiniciando... ataque!'],
      ataques: [
        A.sequencia(
          A.lasers({ orientacao: 'cruz', duracao: 3300, intervalo: 1100 }),
          A.ondas({ duracao: 3500, velocidade: 210, intervalo: 650, amplitude: 55 }),
        ),
        A.juntos(A.lasers({ intervalo: 1500 }), A.quicantes({ intervalo: 1200, velocidade: 180 })),
        A.ondas({ velocidade: 230, intervalo: 600, amplitude: 55, passo: 0.9 }),
      ],
    },
  ],
}
