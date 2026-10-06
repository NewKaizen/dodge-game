// Padrões de ataque escalados pela força e ajudantes que os baralhos
// (pvp/baralhos/<personagem>.js) usam para montar as receitas. Lógica pura:
// não importa attacks/ (quem chama passa a biblioteca A).

export const lerp = (a, b, t) => Math.round(a + (b - a) * t)
export const duracaoDe = (t) => lerp(4000, 7000, t) // tempo ativo do ataque (os respiros somam ~0,8 s)
export const metade = (t) => Math.round(duracaoDe(t) / 2) // cada onda de uma sequência de duas

// ---------- padrões de ataque escalados pela força (t de 0 a 1) ----------
//
// Cada um: (A, t, o) => ataque. A = biblioteca attacks/index.js; o = ajustes
// extras (o.esparso multiplica o intervalo, para usar em `juntos`).
// Os números ficam dentro das faixas já usadas pelos chefes (king fácil em
// t = 0 até jevil/queen difícil em t = 1), sem avisos de justiça.

const esp = (o) => o.esparso ?? 1
const sem = (o) => {
  const { esparso, ...resto } = o
  return resto
}

export const P = {
  chuva: (A, t, o = {}) =>
    A.rain({ duracao: duracaoDe(t), intervalo: lerp(320, 200, t) * esp(o), velocidade: lerp(115, 165, t), mirar: 0.35 + 0.3 * t, ...sem(o) }),
  // neve: chuva lenta, gotas que já saem quase na velocidade final (flocos)
  neve: (A, t, o = {}) =>
    A.rain({ duracao: duracaoDe(t), intervalo: lerp(360, 240, t) * esp(o), velocidade: lerp(90, 130, t), partida: 0.7, cascata: 3, raio: 7, girar: 1, ...sem(o) }),
  estocadas: (A, t, o = {}) =>
    A.sides({ duracao: duracaoDe(t), intervalo: lerp(1150, 720, t) * esp(o), velocidade: lerp(160, 230, t), ...sem(o) }),
  mira: (A, t, o = {}) =>
    A.aimed({ duracao: duracaoDe(t), intervalo: lerp(1050, 680, t) * esp(o), velocidade: lerp(115, 175, t), rajada: t >= 0.6 ? 4 : 3, ...sem(o) }),
  espiral: (A, t, o = {}) =>
    A.spiral({ duracao: duracaoDe(t), velocidade: lerp(95, 130, t), bracos: t >= 0.7 ? 4 : 3, intervalo: lerp(170, 140, t) * esp(o), deriva: lerp(16, 30, t), ...sem(o) }),
  colunas: (A, t, o = {}) =>
    A.colunas({ duracao: duracaoDe(t), quantidade: t >= 0.5 ? 3 : 2, velocidade: lerp(140, 230, t), intervalo: lerp(1500, 1000, t) * esp(o), mirar: 0.4 + 0.3 * t, ...sem(o) }),
  ondas: (A, t, o = {}) =>
    A.ondas({ duracao: duracaoDe(t), velocidade: lerp(120, 205, t), intervalo: lerp(900, 660, t) * esp(o), amplitude: lerp(35, 55, t), mirar: 0.4 + 0.3 * t, ...sem(o) }),
  lasers: (A, t, o = {}) =>
    A.lasers({ duracao: duracaoDe(t), quantidade: t >= 0.6 ? 2 : 1, intervalo: lerp(1450, 1100, t) * esp(o), ...sem(o) }),
  quicantes: (A, t, o = {}) =>
    A.quicantes({ duracao: duracaoDe(t), intervalo: lerp(1150, 620, t) * esp(o), velocidade: lerp(140, 215, t), quiques: t >= 0.6 ? 5 : 4, mirar: 0.4 + 0.3 * t, ...sem(o) }),
  anel: (A, t, o = {}) =>
    A.anel({ duracao: duracaoDe(t), intervalo: lerp(2500, 1600, t) * esp(o), tempoFechar: lerp(1500, 1250, t), mirar: 0.25 + 0.25 * t, ...sem(o) }),
  divisores: (A, t, o = {}) =>
    A.divisores({ duracao: duracaoDe(t), intervalo: lerp(1600, 1150, t) * esp(o), velocidade: lerp(100, 135, t), ...sem(o) }),
  carrossel: (A, t, o = {}) => {
    const { sentido = 1, ...resto } = sem(o)
    return A.carrossel({
      duracao: duracaoDe(t),
      aneis: [
        { raio: 42, quantidade: 8, giro: (lerp(100, 160, t) / 100) * sentido },
        { raio: 112, quantidade: 18, giro: (-lerp(70, 115, t) / 100) * sentido },
      ],
      respira: lerp(16, 24, t),
      inverte: lerp(3200, 2200, t),
      persegue: lerp(14, 30, t),
      tiros: lerp(2300, 1300, t) * esp(o),
      ...resto,
    })
  },
  foice: (A, t, o = {}) =>
    A.foice({
      duracao: duracaoDe(t),
      varridas: Math.ceil(duracaoDe(t) / 2100),
      travessia: lerp(1900, 1450, t),
      aviso: lerp(750, 600, t),
      faiscas: t >= 0.6 ? 3 : 2,
      vertical: t >= 0.45, // fraca: só horizontal (ainda mira e volta)
      ...sem(o),
    }),
  bombas: (A, t, o = {}) =>
    A.bombas({ duracao: duracaoDe(t), intervalo: lerp(1800, 1150, t) * esp(o), fragmentos: t >= 0.6 ? 10 : 8, velocidade: lerp(120, 160, t), mirar: 0.4 + 0.3 * t, ...sem(o) }),
  forcado: (A, t, o = {}) =>
    A.forcado({ duracao: duracaoDe(t), intervalo: lerp(1800, 1200, t) * esp(o), parada: lerp(300, 200, t), rastrear: lerp(40, 75, t), profundidade: t >= 0.4 ? 0.2 : 0.1, pinca: t >= 0.55 ? 3 : 0, ...sem(o) }),
  rachaduras: (A, t, o = {}) =>
    A.rachaduras({ duracao: duracaoDe(t), intervalo: lerp(1350, 850, t) * esp(o), ramos: t >= 0.75 ? 5 : t >= 0.45 ? 4 : 3, comprimento: lerp(85, 110, t), aviso: lerp(700, 560, t), fragmentos: t >= 0.6 ? 3 : 0, velocidade: lerp(100, 140, t), ...sem(o) }),
  // finalização em 3 fases; pensado para t alto (com duracao < ~6000 o colapso não chega a explodir)
  caosFinal: (A, t, o = {}) =>
    A.caosFinal({
      duracao: duracaoDe(t),
      estrelas: { intervalo: lerp(400, 300, t) * esp(o), velocidade: lerp(130, 160, t) },
      cruz: { giro: lerp(80, 110, t) / 100, inverte: lerp(1800, 1300, t), tiro: lerp(1300, 900, t) * esp(o) },
      colapso: { tempoFechar: lerp(1350, 1200, t), fragmentos: t >= 0.6 ? 10 : 8, velocidade: lerp(105, 125, t) },
      ...sem(o),
    }),
}

// Ouros: a caixa encolhe (mais forte = menor). Mínimos acima de CAIXA_DINAMICA.
export const caixaApertada = (t) => ({ largura: lerp(210, 160, t), altura: lerp(170, 135, t) })
export const apertar = (A, t, ataque) => A.comCaixa(caixaApertada(t), ataque)

// Texto curto de cada padrão (vai para a descrição da carta)
export const TEXTOS = {
  chuva: 'Chuva de balas que acelera ao cair',
  neve: 'Flocos gelados caindo devagar em cascata',
  estocadas: 'Lanças pelas laterais, na fileira do coração',
  mira: 'Rajadas miradas no coração',
  espiral: 'Espiral que inverte o giro e vem atrás do coração',
  colunas: 'Colunas despencam do alto',
  ondas: 'Paredes com uma abertura que ondula',
  lasers: 'Lasers que piscam e queimam a faixa',
  quicantes: 'Bolas que quicam nas paredes',
  anel: 'Anel que se fecha com um vão',
  divisores: 'Projéteis que se dividem em leque',
  carrossel: 'Anéis que giram, invertem e perseguem o coração',
  foice: 'Machado bumerangue mira a faixa do coração e volta',
  bombas: 'Bombas com contagem que explodem em estilhaços',
  forcado: 'Forcado entra pela lateral e persegue sua fileira',
  rachaduras: 'O chão racha sob o coração e solta espinhos',
  caosFinal: 'Estrelas, cruz do caos e colapso final',
}

// ---------- formato de um baralho (pvp/baralhos/<personagem>.js) ----------
//
// Cada personagem:
//   tema        formas/cores das balas (a cena passa para o ContextoAtaque)
//   hp          HP de reserva caso PERSONAGENS (data/personagens.js) não tenha o personagem
//   principal   padrão usado pelos Ases que mandam ataque ({ espadas, ouros, paus })
//   leve        ataque fraquinho das cartas de copas
//   super       { nome, texto, criar(A) } -> a carta SUPER ('<personagem>-espadas-14'),
//               3 fases de ~3 s com força 1 (padrões de P com duracao: FASE_SUPER)
//   receitas    { chave: { texto, criar(A, t) } } -> ataques próprios
//   cartas      [naipe, valor, nome, receita | efeitos de copas, extras?]
//               extras: { inverter: ms }  (controles invertidos na caixa do adversário;
//                         qualquer valor > 0 = durante o ataque todo, ver PvpArena)
//
// Receita simples: o nome de um padrão de P. Receita composta: um objeto em `receitas`.

export const r = (texto, criar) => ({ texto, criar })
