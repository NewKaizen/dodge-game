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
    notaSolta: r('Notas soltas escapam pelas bordas e flutuam até o coração, balançando', (A, t) => A.dessNotaSolta(notaSolta(t))),
    taco: r('Um taco preso na parede varre meia-volta na altura do coração; o alcance pisca antes', (A, t) =>
      A.dessTaco({ duracao: duracaoDe(t), intervalo: lerp(1500, 1050, t), comprimento: lerp(120, 145, t), aviso: lerp(650, 520, t), varrida: lerp(520, 400, t) }),
    ),
    homeRun: r('Bolas rebatidas do home plate cruzam a caixa voando, rápidas, pela linha que piscou', (A, t) =>
      A.dessHomeRun({ duracao: duracaoDe(t), intervalo: lerp(1250, 850, t), velocidade: lerp(280, 360, t), bolas: t >= 0.6 ? 2 : 1 }),
    ),
    solo: r('A guitarra corre pela parede tocando a melodia: filas de notas sobem e descem de corda', (A, t) =>
      A.dessSolo({ duracao: duracaoDe(t), batida: lerp(300, 230, t), cadencia: lerp(75, 58, t), velocidade: lerp(150, 195, t), frase: t >= 0.6 ? 8 : 6 }),
    ),
    show: r('A estrada de notas do show: acordes caem pelas 4 cordas no ritmo, sempre com uma corda livre; no refrão, labaredas sobem do palco', (A, t) =>
      A.dessShow({ duracao: duracaoDe(t), batida: lerp(520, 370, t), velocidade: lerp(140, 185, t), livres: t >= 0.6 ? 1 : 2, pirotecnia: t >= 0.5 ? 5 : 0, troca: lerp(0.6, 0.85, t), colcheias: t >= 0.6 }),
    ),
    microfonia: r('Um microfone encosta na parede e solta um agudo serrilhado pela faixa do coração, numa caixa apertada', (A, t) =>
      apertar(A, t, A.dessMicrofonia({ duracao: duracaoDe(t), intervalo: lerp(1300, 900, t), aviso: lerp(620, 500, t), velocidade: lerp(260, 340, t), faiscas: t >= 0.6 ? 12 : 10, quantidade: t >= 0.75 ? 2 : 1 })),
    ),
    palheta: r('Palhetada alternada: varridas de palhetas giratórias, de cima e de baixo, numa caixa apertada', (A, t) =>
      apertar(A, t, A.dessPalheta({ duracao: duracaoDe(t), intervalo: lerp(1100, 750, t), palhetas: t >= 0.6 ? 5 : 4, velocidade: lerp(150, 200, t) })),
    ),
    feedback: r('O som entra em loop entre duas caixas de som e volta cada vez mais alto, numa caixa apertada', (A, t) =>
      apertar(A, t, A.dessFeedback({ duracao: duracaoDe(t), intervalo: lerp(2000, 1500, t), velocidade: lerp(140, 180, t), altura: lerp(36, 44, t), passagens: t >= 0.6 ? 3 : 2 })),
    ),
    fumaca: r('Latas de fumaça cobrem a vista; escondidas na nuvem, brasas acendem e escapam', (A, t) =>
      A.dessFumaca({ duracao: duracaoDe(t), intervalo: lerp(1900, 1300, t), brasas: lerp(5, 8, t), velocidade: lerp(65, 100, t) }),
    ),
    amplificador: r('Amplificadores largados nas bordas batem o grave: ondas saem pelo cone e se abrem', (A, t) =>
      A.dessAmplificador({ duracao: duracaoDe(t), intervalo: lerp(1700, 1200, t), batida: lerp(420, 330, t), velocidade: lerp(115, 160, t), pulsos: t >= 0.6 ? 4 : 3 }),
    ),
    cabos: r('Cabos de guitarra se esticam de parede a parede e ficam serpenteando no chão', (A, t) =>
      A.dessCabos({ duracao: duracaoDe(t), intervalo: lerp(1500, 1050, t), aviso: lerp(650, 520, t), vida: lerp(2200, 2700, t), amplitude: lerp(9, 13, t), serpenteia: lerp(2, 3.2, t), maxCabos: t >= 0.6 ? 3 : 2 }),
    ),
    palco: r('Bombas e ondas sonoras', (A, t) => A.juntos(P.bombas(A, t, { esparso: 1.4 }), P.ondas(A, t, { esparso: 1.6 }))),
  },
  super: {
    nome: 'Último Bis',
    texto: 'Um show de ritmo: acordes nos trastes, um solo correndo pelo braço e o mergulho do whammy em onda de choque',
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
