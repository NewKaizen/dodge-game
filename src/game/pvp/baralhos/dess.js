// Dess: ataque (♠) com guitarra e taco. Ondas sonoras, notas, beisebol e equipamento de palco
// (ataques exclusivos em attacks/habilidades/dess.js).
// Formato: ver o comentário "formato de um baralho" em pvp/padroes.js.
import { P, r, apertar, duracaoDe, lerp } from '../padroes.js'

// Nota Solta: colcheias que flutuam balançando até o coração
const notaSolta = (t) => ({ duracao: duracaoDe(t), intervalo: lerp(650, 420, t), velocidade: lerp(100, 140, t), balanco: lerp(10, 14, t), mirar: 0.6 + 0.3 * t })

export default {
  tema: { formas: ['ouros', 'bola'], cores: { ouros: 0xff8a4a, bola: 0xffc08a, barra: 0xffa86a }, cor: 0xff8a4a },
  principal: { espadas: 'quicantes', ouros: 'lasers', paus: 'bombas' },
  leve: (A) => A.quicantes({ duracao: 4000, intervalo: 1700, velocidade: 120, quiques: 3 }),
  receitas: {
    notaSolta: r('Notas soltas escapam por bordas sorteadas e flutuam até o coração, balançando', (A, t) => A.dessNotaSolta(notaSolta(t))),
    taco: r('Um taco preso na parede varre meia-volta na altura do coração, para cima ou para baixo; o alcance pisca antes', (A, t) =>
      A.dessTaco({ duracao: duracaoDe(t), intervalo: lerp(1500, 1050, t), comprimento: lerp(120, 145, t), aviso: lerp(650, 520, t), varrida: lerp(520, 400, t) }),
    ),
    homeRun: r('O taco se prepara no home plate e rebate: a bola sai de baixo, rápida, mirando onde o coração está na hora da tacada', (A, t) =>
      A.dessHomeRun({ duracao: duracaoDe(t), intervalo: lerp(1250, 900, t), velocidade: lerp(270, 340, t), preparo: lerp(560, 480, t), bolas: t >= 0.6 ? 2 : 1 }),
    ),
    solo: r('A guitarra corre pela parede tocando a melodia: filas de notas entram na corda do coração e sobem e descem de corda', (A, t) =>
      A.dessSolo({ duracao: duracaoDe(t), batida: lerp(300, 230, t), cadencia: lerp(75, 58, t), velocidade: lerp(150, 195, t), frase: t >= 0.6 ? 8 : 6 }),
    ),
    show: r('A estrada de notas do show: gemas caem pelas 4 cordas no ritmo, sempre com uma corda livre; no refrão, uma labareda sobe do palco seguindo o coração', (A, t) =>
      A.dessShow({ duracao: duracaoDe(t), batida: lerp(540, 440, t), velocidade: lerp(140, 170, t), livres: t >= 0.6 ? 1 : 2, pirotecnia: t >= 0.5 ? 6 : 0, troca: lerp(50, 62, t) / 100, colcheias: t >= 0.6, persegue: lerp(460, 400, t), seguir: lerp(90, 110, t) }),
    ),
    microfonia: r('Um microfone encosta na parede e solta um agudo serrilhado pela faixa do coração, numa caixa apertada', (A, t) =>
      apertar(A, t, A.dessMicrofonia({ duracao: duracaoDe(t), intervalo: lerp(1300, 900, t), aviso: lerp(620, 500, t), velocidade: lerp(260, 340, t), faiscas: t >= 0.6 ? 12 : 10, quantidade: t >= 0.75 ? 2 : 1 })),
    ),
    palheta: r('Palhetas que perseguem o coração: fileiras pelas laterais, um cerco que se fecha nele e uma chuva que escorrega atrás dele, numa caixa apertada', (A, t) =>
      apertar(A, t, A.dessPalheta({ duracao: duracaoDe(t), intervalo: lerp(1250, 950, t), palhetas: t >= 0.6 ? 5 : 4, velocidade: lerp(140, 175, t), giro: lerp(200, 260, t) / 100, cerco: t >= 0.6 ? 8 : 7, aneis: t >= 0.75 ? 2 : 1, tempoCerco: lerp(1250, 1050, t) })),
    ),
    feedback: r('O som entra em loop entre duas caixas de som e volta um pouco mais alto, numa caixa apertada', (A, t) =>
      apertar(A, t, A.dessFeedback({ duracao: duracaoDe(t), intervalo: lerp(2300, 1900, t), velocidade: lerp(120, 150, t), altura: lerp(32, 38, t), passagens: 2, preparo: lerp(620, 540, t) })),
    ),
    fumaca: r('Latas de fumaça são arremessadas na caixa e estouram num anel de brasas; a nuvem corre com o vento e solta brasas escondidas', (A, t) =>
      A.dessFumaca({ duracao: duracaoDe(t), intervalo: lerp(1900, 1400, t), brasas: lerp(4, 6, t), anel: lerp(6, 9, t), velocidade: lerp(65, 95, t), velocidadeAnel: lerp(90, 120, t) }),
    ),
    amplificador: r('Amplificadores entram pelas bordas, viram para o coração e batem o grave: ondas saem pelo cone e se abrem', (A, t) =>
      A.dessAmplificador({ duracao: duracaoDe(t), intervalo: lerp(1700, 1200, t), batida: lerp(440, 350, t), velocidade: lerp(110, 150, t), pulsos: t >= 0.6 ? 4 : 3 }),
    ),
    cabos: r('Cabos de guitarra se esticam de parede a parede e ficam serpenteando no chão', (A, t) =>
      A.dessCabos({ duracao: duracaoDe(t), intervalo: lerp(1500, 1050, t), aviso: lerp(650, 520, t), vida: lerp(2200, 2700, t), amplitude: lerp(9, 13, t), serpenteia: lerp(2, 3.2, t), maxCabos: t >= 0.6 ? 3 : 2 }),
    ),
    // mais espaçado que antes (era 1,4 e 1,6): dava dano demais para uma figura de paus
    palco: r('Bombas e ondas sonoras', (A, t) => A.juntos(P.bombas(A, t, { esparso: 1.9 }), P.ondas(A, t, { esparso: 2.1 }))),
  },
  super: {
    nome: 'Último Bis',
    texto: 'Um show de ritmo: notas despencam nos trastes e explodem no palco, um solo corre pelo braço e o mergulho do whammy solta ondas de choque',
    criar: (A) => A.superDess()
  },
  cartas: [
    ['espadas', 1, 'Rebatida'],
    ['espadas', 2, 'Nota Solta', 'notaSolta'],
    ['espadas', 5, 'Taco de Beisebol', 'taco'],
    ['espadas', 7, 'Riff Distorcido', 'ondas'],
    ['espadas', 9, 'Home Run', 'homeRun'],
    ['espadas', 11, 'Solo de Guitarra', 'solo'],
    ['espadas', 13, 'Show de Rock', 'show'],
    ['ouros', 1, 'Corta o Som'],
    ['ouros', 4, 'Microfonia', 'microfonia'],
    ['ouros', 8, 'Palheta', 'palheta'],
    ['ouros', 12, 'Feedback', 'feedback', { inverter: 1500 }],
    ['paus', 1, 'Pegou Emprestado'],
    ['paus', 3, 'Bomba de Fumaça', 'fumaca'],
    ['paus', 6, 'Amplificador', 'amplificador'],
    ['paus', 10, 'Cabos Enrolados', 'cabos'],
    ['paus', 12, 'Palco Explosivo', 'palco'],
    ['copas', 1, 'Bis!'],
    ['copas', 6, 'Refrigerante', ['energia']],
    ['copas', 10, 'Fone de Ouvido', ['escudo']],
  ],
}
