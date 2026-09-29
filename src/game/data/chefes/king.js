import { ataques as A } from '../../attacks/index.js'

// Chaos King — FÁCIL. Serve de tutorial: chuva, colunas e tiro mirado, tudo
// lento e com muito espaço livre. MERCY sobe rápido com os ACTs certos.
export default {
  id: 'king',
  nome: 'Chaos King',
  dificuldade: 'facil',
  sprite: 'king',
  fundo: 'king',
  musica: 'king',

  hp: 200,
  defesa: 0,
  danoBala: 7,
  desafio: { velocidade: 1.15, densidade: 1.2 }, // mais bravo que o padrão (em cima de DESAFIO)

  rotuloMercy: 'MERCY',
  descricao: 'Um rei de xadrez que exige respeito. Adora elogios à coroa.',
  textoInicial: '* O Chaos King bloqueia o caminho!',
  inventario: { bandagem: 3, doce: 2, cha: 1 },

  tema: {
    formas: ['losango', 'coroa'],
    cores: { losango: 0xb48cff, coroa: 0xffd23c, barra: 0xd8c8ff, bola: 0xb48cff },
    cor: 0xb48cff,
  },

  acts: [
    {
      nome: 'Elogiar Coroa',
      executar(ctx) {
        ctx.texto(`* ${ctx.ator.nome} elogiou a coroa do rei.`)
        ctx.texto('* O Chaos King ajeita a coroa, todo satisfeito.')
        ctx.mercy(ctx.alvo, 35)
      },
    },
    {
      nome: 'Reverência',
      executar(ctx) {
        ctx.texto(`* ${ctx.ator.nome} fez uma reverência exagerada.`)
        ctx.texto('* O rei se distrai com a plateia... O próximo ataque vai ser mais fraco!')
        ctx.proximoAtaque({ velocidade: 0.8, densidade: 0.85 })
        ctx.mercy(ctx.alvo, 30)
      },
    },
    {
      nome: 'Provocar',
      executar(ctx) {
        ctx.texto(`* ${ctx.ator.nome} chamou o rei de "peão".`)
        ctx.texto('* Ele ficou furioso e baixou a guarda! (DEF -1)')
        ctx.alvo.defesa = Math.max(0, ctx.alvo.defesa - 1)
        ctx.mercy(ctx.alvo, -10)
      },
    },
  ],

  textoNaoPoupa: (chefe) => `* O rei ainda não aceita a derrota. (MERCY ${chefe.mercy}%)`,

  fases: [
    {
      hp: 1,
      flavor: ['* O Chaos King ergue o cetro.', '* Cheiro de tabuleiro velho.', '* O rei espera uma reverência.'],
      falas: ['Ajoelhem-se diante da coroa!', 'Um peão ousa me desafiar?', 'Xeque! Hahaha!'],
      ataques: [
        A.rain({ intervalo: 260, velocidade: 120 }),
        A.colunas({ quantidade: 2, velocidade: 140, intervalo: 1500 }),
        A.aimed({ intervalo: 950, velocidade: 120 }),
      ],
    },
    {
      hp: 0.5,
      entrada: 'Chega de brincadeira! Agora é xeque-mate!',
      velocidadeFundo: 1.4,
      flavor: ['* A coroa do rei treme de raiva.', '* O tabuleiro inteiro range.'],
      falas: ['Minhas torres vão esmagar vocês!', 'Curvem-se!', 'Isso é traição!'],
      ataques: [
        A.juntos(A.rain({ intervalo: 340, velocidade: 130 }), A.aimed({ intervalo: 1400, velocidade: 130 })),
        A.colunas({ quantidade: 3, velocidade: 160, intervalo: 1200 }),
        A.sequencia(A.colunas({ duracao: 3000, intervalo: 1300 }), A.rain({ duracao: 3000, intervalo: 200, velocidade: 140 })),
        A.sides({ intervalo: 1000, velocidade: 170 }),
      ],
    },
  ],
}
