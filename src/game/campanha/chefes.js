// Os CHEFES da campanha, no MESMO formato dos chefes do CO-OP (coop/chefes/index.js): a luta da
// campanha usa as regras do CO-OP (coop/regras.js) e os ataques da biblioteca attacks/ (os mesmos do
// jogo; rodam no servidor sem Phaser). Ficam em CHEFES com `campanha: true` (fora da seleção do
// CO-OP, da votação da party e do semanal). Cada fase do Mundo 1 aponta para um destes
// (mundos/mundo1.js `chefe`).
//
// Os ataques de cada um combinam com o lugar e com quem está preso ali:
//   Ralsei (a sala de aula)   estrelas que caem, olhares, mariposas que giram; garras na 2ª fase
//   Noelle (o corredor)       gelo: losangos que quicam, o anel que fecha, cristais que se dividem
//   Berdly (o ginásio)        holofotes (feixes), colunas da arquibancada, a rajada dos olhares
//   Susie (a rua)             faróis, a caminhonete, a mandíbula, o forcado
//   Dess (a chuva)            tudo vem de cima: chuva, colunas, brasas que caem
//   O TITÃ (o último quarto)  a mandíbula, as garras, o carrossel, a foice e as bombas; o SUPER é o caos
// Formas de bala (arte/texturas.js): chama bola losango coroa hex espadas copas ouros paus.

const TEMA = (formas, cor, extra = {}) => ({ formas, cores: Object.fromEntries([...formas.map((f) => [f, cor]), ['barra', 0xf2e2b0], ['bola', cor]]), cor, ...extra })

export const CHEFES_CAMPANHA = {
  c_ralsei: {
    nome: 'Eco do Ralsei',
    campanha: true,
    dificuldade: 'facil',
    sprite: 'ralsei',
    fundo: 'escuridao',
    musica: 'campanha_luta',
    textoInicial: 'O eco do Ralsei ergue o cachecol. A sombra fala por ele.',
    tema: TEMA(['losango'], 0x7fe0b0),
    hp: 260,
    danoBala: 8,
    leve: (A) => A.rain({ duracao: 4000, intervalo: 560, velocidade: 100 }),
    fases: [
      {
        hp: 1,
        falas: ['Desculpa! É ele que ataca!', 'Isso não sou eu, Kris!', 'Só mais um pouco...'],
        cartas: [
          ['espadas', 3, 'Estrela Cadente', (A) => A.rain({ intervalo: 300, velocidade: 115 })],
          ['ouros', 4, 'Olhar de Giz', (A) => A.aimed({ intervalo: 1000, velocidade: 115 })],
          ['paus', 4, 'Cachecol', (A) => A.sides({ intervalo: 1300, velocidade: 140 })],
          ['espadas', 5, 'Lição pela Metade', (A) => A.colunas({ quantidade: 2, velocidade: 140, intervalo: 1600 })],
          ['copas', 4, 'Chá Morno', null, { cura: 16 }],
        ],
      },
      {
        hp: 0.5,
        entrada: 'SHHH. A AULA AINDA NÃO ACABOU.',
        velocidadeFundo: 1.4,
        falas: ['Ele está apertando!', 'Kris, cuidado!', 'Eu lembro... quase...'],
        cartas: [
          ['espadas', 7, 'Garras no Quadro', (A) => A.garras({ intervalo: 1500, velocidade: 170, dupla: false })],
          ['ouros', 7, 'Rajada de Giz', (A) => A.juntos(A.rain({ intervalo: 420, velocidade: 120 }), A.aimed({ intervalo: 1500, velocidade: 120 }))],
          ['paus', 6, 'Carteiras no Teto', (A) => A.quicantes({ forma: 'losango', intervalo: 1300, velocidade: 140 })],
          ['copas', 6, 'Curativo', null, { cura: 14, guarda: 0.7 }],
        ],
      },
    ],
    super: {
      nome: 'Sinal da Escola',
      texto: 'Estrelas e olhares ao mesmo tempo, até o sinal tocar',
      criar: (A) => A.juntos(A.rain({ duracao: 6000, intervalo: 280, velocidade: 125 }), A.aimed({ duracao: 6000, intervalo: 1300, velocidade: 125 })),
    },
  },

  c_noelle: {
    nome: 'Eco da Noelle',
    campanha: true,
    dificuldade: 'facil',
    sprite: 'noelle',
    fundo: 'escuridao',
    musica: 'campanha_luta',
    textoInicial: 'O corredor congela. As paredes chegam mais perto.',
    tema: TEMA(['hex'], 0xa8e8ff),
    hp: 340,
    danoBala: 10,
    leve: (A) => A.quicantes({ forma: 'hex', duracao: 4000, intervalo: 1500, velocidade: 120 }),
    fases: [
      {
        hp: 1,
        falas: ['Não chega perto! O gelo...', 'Eu não controlo isso!', 'Desculpa, desculpa!'],
        cartas: [
          ['ouros', 4, 'Floco que Quica', (A) => A.quicantes({ forma: 'hex', intervalo: 950, velocidade: 150 })],
          ['espadas', 5, 'Anel de Gelo', (A) => A.anel({ forma: 'hex', intervalo: 2300 })],
          ['paus', 5, 'Cristal que se Parte', (A) => A.divisores({ forma: 'hex', intervalo: 1300 })],
          ['espadas', 4, 'Armários', (A) => A.sides({ intervalo: 1200, velocidade: 150 })],
          ['copas', 5, 'Respirar Fundo', null, { cura: 20 }],
        ],
      },
      {
        hp: 0.5,
        entrada: 'ELA FICA PEQUENA. EU SÓ AJUDO.',
        velocidadeFundo: 1.5,
        falas: ['Tá derretendo...', 'Fica perto!', 'Mais um pouco, Kris!'],
        cartas: [
          ['espadas', 8, 'Nevasca', (A) => A.juntos(A.anel({ forma: 'hex', intervalo: 2600 }), A.rain({ forma: 'hex', intervalo: 520, velocidade: 130 }))],
          ['ouros', 9, 'Estalactites', (A) => A.garras({ forma: 'hex', intervalo: 1350, velocidade: 185 })],
          ['paus', 8, 'Gelo Rachado', (A) => A.divisores({ forma: 'hex', intervalo: 1000, filhos: 4 })],
          ['copas', 7, 'Cartão em Branco', null, { cura: 16, guarda: 0.65 }],
        ],
      },
    ],
    super: {
      nome: 'Inverno Inteiro',
      texto: 'O anel fecha e os cristais se partem ao mesmo tempo',
      criar: (A) => A.juntos(A.anel({ forma: 'hex', duracao: 6500, intervalo: 2100 }), A.divisores({ forma: 'hex', duracao: 6500, intervalo: 1400 })),
    },
  },

  c_berdly: {
    nome: 'Eco do Berdly',
    campanha: true,
    dificuldade: 'medio',
    sprite: 'berdly',
    fundo: 'escuridao',
    musica: 'campanha_luta',
    textoInicial: 'Os holofotes do ginásio acendem todos de uma vez.',
    tema: TEMA(['losango'], 0x7aa8ff),
    hp: 370,
    danoBala: 11,
    leve: (A) => A.aimed({ duracao: 4000, intervalo: 1400, velocidade: 110 }),
    fases: [
      {
        hp: 1,
        falas: ['Aplausos! Para mim!', 'Física básica, Kris!', 'Ninguém veio... ninguém...'],
        cartas: [
          ['espadas', 5, 'Holofote', (A) => A.lasers({ intervalo: 1400 })],
          ['ouros', 5, 'Olhares da Arquibancada', (A) => A.aimed({ intervalo: 850, velocidade: 135 })],
          ['paus', 6, 'Arquibancada', (A) => A.colunas({ quantidade: 2, velocidade: 165, intervalo: 1300 })],
          ['espadas', 6, 'Discurso', (A) => A.ondas({ intervalo: 900, velocidade: 125 })],
          ['copas', 5, 'Troféu', null, { cura: 22 }],
        ],
      },
      {
        hp: 0.5,
        entrada: 'O ECO SEMPRE FALA POR ÚLTIMO.',
        velocidadeFundo: 1.5,
        falas: ['Minha mente está voltando!', 'Pela ciência!', 'Mais um golpe!'],
        cartas: [
          ['espadas', 9, 'Todos os Holofotes', (A) => A.juntos(A.lasers({ intervalo: 1500, orientacao: 'vertical' }), A.aimed({ intervalo: 1600, velocidade: 130 }))],
          ['ouros', 9, 'Eco do Ginásio', (A) => A.sequencia(A.colunas({ duracao: 3000, intervalo: 1100 }), A.colunas({ duracao: 3000, intervalo: 1100, velocidade: 190 }))],
          ['paus', 8, 'Bola Perdida', (A) => A.quicantes({ forma: 'losango', intervalo: 800, velocidade: 170, quiques: 5 })],
          ['copas', 8, 'Medalha', null, { cura: 18, guarda: 0.6 }],
        ],
      },
    ],
    super: {
      nome: 'Premiação',
      texto: 'Holofotes cruzados e olhares de todos os lados',
      criar: (A) => A.juntos(A.lasers({ duracao: 6500, intervalo: 1300 }), A.lasers({ duracao: 6500, intervalo: 1700, orientacao: 'vertical' })),
    },
  },

  c_susie: {
    nome: 'Eco da Susie',
    campanha: true,
    dificuldade: 'medio',
    sprite: 'susie',
    fundo: 'escuridao',
    musica: 'campanha_luta',
    textoInicial: 'Os faróis cortam a névoa. A Susie levanta do ponto de ônibus.',
    tema: TEMA(['chama'], 0xd070ff),
    hp: 400,
    danoBala: 12,
    leve: (A) => A.sides({ duracao: 4000, intervalo: 1500, velocidade: 130 }),
    fases: [
      {
        hp: 1,
        falas: ['Desculpa adiantado!', 'Vai doer!', 'Sai da frente!'],
        cartas: [
          ['espadas', 6, 'Faróis', (A) => A.lasers({ intervalo: 1200 })],
          ['espadas', 7, 'Investida', (A) => A.sides({ intervalo: 1000, velocidade: 175 })],
          ['ouros', 6, 'Mordida', (A) => A.mandibula({ intervalo: 2500 })],
          ['paus', 6, 'Cascalho', (A) => A.bombas({ intervalo: 1600 })],
          ['copas', 6, 'Sentar no Meio-Fio', null, { cura: 24 }],
        ],
      },
      {
        hp: 0.5,
        entrada: 'ELA NÃO PRECISA DE VOCÊ!',
        velocidadeFundo: 1.6,
        falas: ['Bate mais!', 'Não consigo parar!', 'Kris, cuidado!'],
        cartas: [
          ['espadas', 10, 'Último Ônibus', (A) => A.caminhonete()],
          ['ouros', 9, 'Boca da Rua', (A) => A.juntos(A.mandibula({ intervalo: 2400 }), A.aimed({ intervalo: 1700, velocidade: 130 }))],
          ['paus', 9, 'Garras do Asfalto', (A) => A.garras({ forma: 'chama', intervalo: 1200, velocidade: 195 })],
          ['copas', 8, 'Segura Firme', null, { cura: 18, guarda: 0.6 }],
        ],
      },
    ],
    super: {
      nome: 'Pé na Estrada',
      texto: 'A caminhonete passa e a rua morde logo depois',
      criar: (A) => A.sequencia(A.caminhonete({ duracao: 3500 }), A.mandibula({ duracao: 3500, intervalo: 1700 })),
    },
  },

  c_dess: {
    nome: 'Eco da Dess',
    campanha: true,
    dificuldade: 'medio',
    sprite: 'dess',
    fundo: 'escuridao',
    musica: 'campanha_luta',
    textoInicial: 'Chove dentro da sala. Tudo vem de cima.',
    tema: TEMA(['bola'], 0x8ab0ff),
    hp: 420,
    danoBala: 12,
    leve: (A) => A.rain({ duracao: 4000, intervalo: 480, velocidade: 110 }),
    fases: [
      {
        hp: 1,
        falas: ['Olha pro alto!', 'A música não toca...', 'Molhou? Não molha.'],
        cartas: [
          ['espadas', 6, 'Chuva Grossa', (A) => A.rain({ intervalo: 200, velocidade: 140 })],
          ['ouros', 6, 'Goteiras', (A) => A.colunas({ quantidade: 3, velocidade: 160, intervalo: 1300 })],
          ['paus', 7, 'Faíscas do Amplificador', (A) => A.brasas({ intervalo: 300 })],
          ['espadas', 7, 'Refrão Perdido', (A) => A.juntos(A.rain({ intervalo: 380, velocidade: 130 }), A.colunas({ quantidade: 1, intervalo: 1700 }))],
          ['copas', 6, 'Afinar o Violão', null, { cura: 24 }],
        ],
      },
      {
        hp: 0.5,
        entrada: 'A CHUVA NÃO PARA. NUNCA PARA.',
        velocidadeFundo: 1.6,
        falas: ['O som está voltando!', 'Continua!', 'Quase lá, Kris!'],
        cartas: [
          ['espadas', 10, 'Tempestade', (A) => A.juntos(A.rain({ intervalo: 240, velocidade: 150 }), A.brasas({ intervalo: 500 }))],
          ['ouros', 9, 'Calhas', (A) => A.colunas({ quantidade: 3, velocidade: 195, intervalo: 1000 })],
          ['paus', 9, 'Granizo', (A) => A.rain({ intervalo: 160, velocidade: 165, mirar: 0.7 })],
          ['copas', 8, 'Último Acorde', null, { cura: 18, guarda: 0.6 }],
        ],
      },
    ],
    super: {
      nome: 'Dilúvio',
      texto: 'Chuva, goteiras e faíscas, tudo de cima',
      criar: (A) => A.juntos(A.rain({ duracao: 6500, intervalo: 230, velocidade: 145 }), A.colunas({ duracao: 6500, quantidade: 2, intervalo: 1500 })),
    },
  },

  c_tita: {
    nome: 'O Titã do Silêncio',
    campanha: true,
    titan: true,
    dificuldade: 'dificil',
    sprite: 'asriel',
    fundo: 'escuridao',
    musica: 'campanha_chefe',
    textoInicial: 'O TITÃ DO SILÊNCIO abre os olhos.',
    tema: TEMA(['losango', 'hex'], 0xb070e8, { cores: { losango: 0xb070e8, hex: 0xd8b8ff, barra: 0xf2e2b0, bola: 0xb070e8, foice: 0xe8e0ff } }),
    hp: 520,
    danoBala: 13,
    leve: (A) => A.garras({ duracao: 4000, intervalo: 1700, velocidade: 160, dupla: false }),
    fases: [
      {
        hp: 1,
        falas: ['QUIETO.', 'EU VEJO A SUA MÃO.', 'NINGUÉM VEM.'],
        cartas: [
          ['espadas', 7, 'Mandíbula', (A) => A.mandibula({ intervalo: 2100 })],
          ['ouros', 7, 'Garras do Teto', (A) => A.garras({ intervalo: 1150, velocidade: 200 })],
          ['paus', 7, 'Estrelas Mortas', (A) => A.divisores({ intervalo: 1100 })],
          ['espadas', 8, 'Olhos de Janela', (A) => A.juntos(A.lasers({ intervalo: 1500 }), A.aimed({ intervalo: 1500, velocidade: 140 }))],
          ['copas', 6, 'Engolir uma Voz', null, { cura: 26 }],
        ],
      },
      {
        hp: 0.6,
        entrada: 'VOCÊ AINDA ESTÁ AÍ? QUE PENA.',
        velocidadeFundo: 1.6,
        falas: ['CALA.', 'CADA CARTA SUA É MINHA.', 'FICA. PARA SEMPRE.'],
        cartas: [
          ['espadas', 10, 'Boca e Garras', (A) => A.juntos(A.mandibula({ intervalo: 2400 }), A.garras({ intervalo: 1700, velocidade: 190, dupla: false }))],
          ['ouros', 10, 'Carrossel do Quarto', (A) => A.carrossel()],
          ['paus', 10, 'Lâmina da Porta', (A) => A.foice({ varridas: 3 })],
          ['copas', 8, 'Fechar a Porta', null, { cura: 22, guarda: 0.6 }],
        ],
      },
      {
        hp: 0.3,
        entrada: 'EU NÃO VOU VOLTAR PARA O ESCURO SOZINHO!',
        velocidadeFundo: 2.2,
        falas: ['NÃO!', 'SILÊNCIO!', 'FICA!'],
        cartas: [
          ['espadas', 12, 'Tudo o que Ninguém Disse', (A) => A.juntos(A.foice({ varridas: 3, travessia: 1500 }), A.garras({ intervalo: 1500, velocidade: 210 }))],
          ['ouros', 12, 'A Boca Inteira', (A) => A.juntos(A.mandibula({ intervalo: 1900 }), A.bombas({ intervalo: 1700, fragmentos: 8 }))],
          ['paus', 11, 'Estrelas Caindo', (A) => A.juntos(A.divisores({ intervalo: 1000, filhos: 4 }), A.rain({ intervalo: 420, velocidade: 150 }))],
          ['copas', 9, 'Último Fôlego', null, { cura: 18, guarda: 0.55 }],
        ],
      },
    ],
    super: {
      nome: 'SILÊNCIO ABSOLUTO',
      texto: 'A boca fecha, as garras atacam e o carrossel gira, tudo de uma vez',
      criar: (A) => A.sequencia(A.juntos(A.mandibula({ duracao: 3500, intervalo: 1700 }), A.garras({ duracao: 3500, intervalo: 1400, dupla: false })), A.carrossel({ duracao: 3500 })),
    },
  },
}
