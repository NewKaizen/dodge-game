// Berdly: controle (♦). Vento, asas e "cálculos geniais".
// Formato: ver o comentário "formato de um baralho" em pvp/padroes.js.
import { P, r, apertar, lerp, caixaApertada, duracaoDe } from '../padroes.js'

export default {
  tema: { formas: ['losango', 'bola'], cores: { losango: 0x3fd0ff, bola: 0x8fe0ff, barra: 0xa0e8ff }, cor: 0x3fd0ff },
  hp: 90,
  principal: { espadas: 'mira', ouros: 'estocadas', paus: 'ondas' },
  leve: (A) => A.aimed({ duracao: 4000, intervalo: 1600, velocidade: 110, rajada: 2 }),
  receitas: {
    bicada: r('Um bico entra pela borda e bica o coração três vezes seguidas, mirando de novo a cada bicada', (A, t) =>
      A.berdlyBicada({ duracao: duracaoDe(t), intervalo: lerp(1900, 1400, t), cadencia: lerp(520, 420, t), velocidade: lerp(260, 360, t) })),
    penas: r('Um bater de asas solta um leque de penas que vêm flutuando até o coração', (A, t) =>
      A.berdlyPenas({ duracao: duracaoDe(t), intervalo: lerp(1250, 850, t), quantidade: t >= 0.6 ? 5 : 4, abertura: t >= 0.6 ? 0.3 : 0.34, velocidade: lerp(110, 150, t) })),
    mergulho: r('Mergulhos em diagonal do alto que passam pelo coração e arremetem no chão, num V', (A, t) =>
      A.berdlyMergulho({ duracao: duracaoDe(t), intervalo: lerp(1450, 1000, t), velocidade: lerp(300, 400, t) })),
    correcao: r('A caneta vermelha marca um X em cima do coração, numa caixa apertada; a tinta demora a secar', (A, t) =>
      apertar(A, t, A.berdlyCorrecao({ duracao: duracaoDe(t), intervalo: lerp(1500, 1050, t), tamanho: lerp(30, 40, t), tinta: lerp(900, 1300, t) }))),
    rajadaVento: r('Lufadas de vento atravessam a faixa do coração, numa caixa apertada', (A, t) =>
      apertar(A, t, A.berdlyRajada({ duracao: duracaoDe(t), intervalo: lerp(1250, 850, t), riscos: t >= 0.6 ? 6 : 5, velocidade: lerp(260, 340, t), eco: t >= 0.6 }))),
    calculo: r('Símbolos de matemática com trajetória calculada: ricocheteiam na parede direto no coração, numa caixa apertada', (A, t) =>
      apertar(A, t, A.berdlyCalculo({ duracao: duracaoDe(t), intervalo: lerp(1450, 1000, t), tiros: t >= 0.6 ? 3 : 2, velocidade: lerp(150, 200, t) }))),
    tornado: r('Um funil de vento atravessa a caixa apertada atrás do coração, cuspindo papel e lápis', (A, t) =>
      apertar(A, t, A.berdlyTornado({ duracao: duracaoDe(t), intervalo: lerp(2300, 1700, t), velocidade: lerp(70, 100, t), deriva: lerp(22, 38, t), detritos: lerp(520, 380, t) }))),
    qi: r('O gráfico do QI sobe em colunas, do chão e depois do teto, numa caixa apertada', (A, t) =>
      apertar(A, t, A.berdlyQI({ duracao: duracaoDe(t), intervalo: lerp(1900, 1500, t) }))),
    vendaval: r('A ventania carrega livros, folhas, lápis e óculos pela caixa apertada e vira de lado no meio', (A, t) =>
      A.comCaixa(caixaApertada(t * 0.5), A.berdlyVendaval({ duracao: duracaoDe(t), intervalo: lerp(380, 260, t), velocidade: lerp(150, 185, t) }))),
    penaArmada: r('Penas-dardo cravadas em volta do coração, apontando para ele, disparam depois de armadas', (A, t) =>
      A.berdlyPenaArmada({ duracao: duracaoDe(t), intervalo: lerp(1500, 1050, t), quantidade: t >= 0.6 ? 3 : 2, armar: lerp(1200, 950, t), velocidade: lerp(240, 320, t) })),
    corrente: r('Paredes de vento vindo da esquerda', (A, t) => P.ondas(A, t, { direcao: 'direita' })),
    ciclone: r('O olho de um ciclone se arma perto do coração e suga uma roda de folhas até o centro, que cospe tudo de volta', (A, t) =>
      A.berdlyCiclone({ duracao: duracaoDe(t), intervalo: lerp(1900, 1300, t), sugar: lerp(1700, 1300, t), estouro: t >= 0.75 ? 6 : 5 })),
  },
  super: {
    nome: 'Prova Irrefutável',
    texto: 'Um redemoinho de lâminas que passeia pela caixa num 8 e cresce a cada volta (o ego inflando), até o giro dourado e o corte final da resposta certa',
    criar: (A) => A.superBerdly()
  },
  cartas: [
    ['espadas', 1, 'Réplica Brilhante'],
    ['espadas', 3, 'Bicada', 'bicada'],
    ['espadas', 7, 'Penas Voadoras', 'penas'],
    ['espadas', 10, 'Mergulho Aéreo', 'mergulho'],
    ['ouros', 1, 'Objeção!'],
    ['ouros', 2, 'Correção', 'correcao'],
    ['ouros', 4, 'Rajada de Vento', 'rajadaVento'],
    ['ouros', 6, 'Cálculo Genial', 'calculo'],
    ['ouros', 8, 'Tornado', 'tornado'],
    ['ouros', 12, 'QI Elevado', 'qi', { inverter: 1500 }],
    ['ouros', 13, 'Vendaval Supremo', 'vendaval', { inverter: 2000 }],
    ['paus', 1, 'Cópia da Prova'],
    ['paus', 5, 'Pena Armada', 'penaArmada'],
    ['paus', 9, 'Corrente de Ar', 'corrente'],
    ['paus', 11, 'Ciclone', 'ciclone'],
    ['copas', 1, 'Ego Inabalável'],
    ['copas', 3, 'Pose Heroica', ['energia']],
    ['copas', 6, 'Autoconfiança', ['escudo']],
    ['copas', 9, 'Lanche da Cantina', ['cura']],
  ],
}
