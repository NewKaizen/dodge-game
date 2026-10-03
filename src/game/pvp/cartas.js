// Cartas do modo PvP e o mapeamento carta -> ataque. Lógica pura: este
// arquivo NÃO importa attacks/ (que puxa Phaser/áudio); quem chama passa a
// biblioteca de ataques em `contexto.ataques` (no jogo, use ataquesDasCartas.js).
//
// Formato da carta (o visual e as regras contam com exatamente estes campos):
//   { id, personagem, naipe, valor, nome, descricao, custo }
//   naipe: 'espadas' | 'copas' | 'ouros' | 'paus'
//   valor: 1..14 (1 = Ás, 11 = J, 12 = Q, 13 = K, 14 = SUPER)
//   id:    '<personagem>-<naipe>-<valor>' (ex.: 'kris-espadas-7')
//
// Naipe = tipo de carta:
//   ♠ espadas  ataque direto (mais dano por bala)
//   ♦ ouros    controle: balas mais rápidas (ritmo), caixa menor, controles invertidos (Q/K)
//   ♣ paus     armadilha: bombas, lasers, colunas, ondas, forcado
//   ♥ copas    suporte para QUEM JOGA (cura, escudo, energia, compra extra);
//              manda só um ataque fraquinho para o adversário
// Valor = força: quanto maior, mais rápido, denso e longo (4 a 7 s) e mais dano.
// Ás = carta especial (um por naipe em todo baralho; ver ESPECIAIS e regras.js).
// SUPER (valor 14, ★) = uma por baralho: ataque exclusivo do personagem, custa 10
// (a energia máxima), imparável (♦ Anular não cancela, ♠ Espelho não reflete).

// ---------- tabelas gerais ----------

export const NAIPES = ['espadas', 'copas', 'ouros', 'paus']
export const SIMBOLOS = { espadas: '♠', copas: '♥', ouros: '♦', paus: '♣' }
export const PERSONAGENS_PVP = ['kris', 'susie', 'ralsei', 'noelle', 'berdly', 'dess', 'asriel']

// Custo em energia por valor: 2-4 barato, 5-8 médio, 9-10/J alto, Q/K muito alto, Ás especial
export const CUSTOS = { 1: 3, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 2, 8: 2, 9: 3, 10: 3, 11: 3, 12: 4, 13: 5, 14: 10 }
export const custoDoValor = (valor) => CUSTOS[valor] ?? 99

export function nomeDoValor(valor) {
  return { 1: 'A', 11: 'J', 12: 'Q', 13: 'K', 14: '★' }[valor] ?? String(valor)
}

// Carta SUPER: uma por baralho (id '<personagem>-espadas-14'), sai na compra normal.
// Custa a energia máxima e é imparável (ver resolverRodada em regras.js).
export const SUPER = { valor: 14, custo: 10 }
export function ehSuper(carta) {
  return carta?.valor === SUPER.valor
}
// Dano por bala do SUPER (já com DIFICULDADE_PVP.dano; o mesmo de um K♠)
const DANO_SUPER = 13
// Cada SUPER tem 3 fases de FASE_SUPER ms ativos (~9 s no total, mais os respiros)
const FASE_SUPER = 3000
const fs = (o = {}) => ({ duracao: FASE_SUPER, ...o })

// Os quatro Ases especiais (mesmo efeito em todo personagem, nome temático muda)
//   espelho          ♠ o ataque que o adversário jogou volta para a caixa DELE
//                      (sem nada para refletir: manda um "eco", ataque de espadas de força 7)
//   anular           ♦ cancela a carta do adversário inteira (ataque, suporte e especial)
//                      e manda um ataque leve de ouros (força 5)
//   roubo            ♣ depois da rodada, rouba 1 carta sorteada da mão do adversário
//                      (ela passa a ser sua) e manda um ataque leve de paus (força 5)
//   segundaChance    ♥ cura 25% do HP máximo e, nesta rodada, o HP não passa de 1
//                      (não dá para perder na rodada em que foi jogada); não manda ataque
export const ESPECIAIS = { espadas: 'espelho', ouros: 'anular', paus: 'roubo', copas: 'segundaChance' }
export const especialDaCarta = (carta) => (carta?.valor === 1 ? ESPECIAIS[carta.naipe] : null)

// Força usada pelo ataque que o Ás manda (eco do espelho, anular, roubo)
const VALOR_DO_ESPECIAL = { espelho: 7, anular: 5, roubo: 5 }

// Dificuldade geral do PvP (vale para TODAS as cartas, em cima do valor).
//   forcaMinima   piso da força: a carta 2 já ataca como se fosse mais alta
//                 (o teto continua 1, a força do K, que passou sem avisos de justiça)
//   dano          multiplica o dano por bala de todo ataque
//   velocidade    multiplicam o ritmo de todo ataque; 1,15 e 1,2 são o mesmo
//   densidade     aperto (DESAFIO) do co-op, com o qual as 134 cartas já foram validadas
// Tudo neutro (0, 1, 1, 1) = as cartas como eram antes.
export const DIFICULDADE_PVP = { forcaMinima: 0.3, dano: 1.3, velocidade: 1.15, densidade: 1.2 }

// 0 (valor 2) .. 1 (K): fração da força usada para escalar os ataques (com o piso de DIFICULDADE_PVP)
export const forca = (valor) => {
  const base = Math.min(1, Math.max(0, (valor - 2) / 11))
  const piso = DIFICULDADE_PVP.forcaMinima
  return piso + (1 - piso) * base
}

const lerp = (a, b, t) => Math.round(a + (b - a) * t)
const duracaoDe = (t) => lerp(4000, 7000, t) // tempo ativo do ataque (os respiros somam ~0,8 s)
const metade = (t) => Math.round(duracaoDe(t) / 2) // cada onda de uma sequência de duas

// ---------- efeitos de copas ----------

// Quanto cada efeito de copas vale, pelo valor da carta
export const EFEITOS_COPAS = {
  cura: (v) => ({ cura: Math.round(4 + v * 1.5) }), // 2 -> 7 HP, 10 -> 19, K -> 24
  escudo: (v) => ({ escudo: v <= 6 ? 0.6 : v <= 10 ? 0.5 : 0.35 }), // fator do dano do próximo ataque recebido
  energia: (v) => ({ energia: v <= 6 ? 1 : v <= 10 ? 2 : 3 }),
  compra: (v) => ({ compra: v <= 8 ? 1 : 2 }),
}

function textoEfeitos(efeitos) {
  const partes = []
  if (efeitos.cura) partes.push(`cura ${efeitos.cura} HP`)
  if (efeitos.escudo) partes.push(`o próximo ataque que você receber causa ${Math.round(efeitos.escudo * 100)}% do dano`)
  if (efeitos.energia) partes.push(`+${efeitos.energia} de energia`)
  if (efeitos.compra) partes.push(`compra ${efeitos.compra} carta${efeitos.compra > 1 ? 's' : ''} extra`)
  return partes.join('; ')
}

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

const P = {
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
const caixaApertada = (t) => ({ largura: lerp(210, 160, t), altura: lerp(170, 135, t) })
const apertar = (A, t, ataque) => A.comCaixa(caixaApertada(t), ataque)

// Texto curto de cada padrão (vai para a descrição da carta)
const TEXTOS = {
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

// ---------- baralhos ----------
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

const r = (texto, criar) => ({ texto, criar })

const BARALHOS = {
  // Kris: equilibrado, puxado para controle (♦). Espada, mira e planos.
  kris: {
    tema: { formas: ['espadas', 'losango'], cores: { espadas: 0x4aa8ff, losango: 0x9fd0ff, barra: 0xbfe0ff, bola: 0x4aa8ff }, cor: 0x4aa8ff },
    hp: 90,
    principal: { espadas: 'estocadas', ouros: 'mira', paus: 'forcado' },
    leve: (A) => A.sides({ duracao: 4000, intervalo: 1500, velocidade: 140, eco: 0 }),
    receitas: {
      corte: r('Colunas em forma de espada', (A, t) => P.colunas(A, t, { forma: 'espadas' })),
      determinada: r('Estocadas e colunas ao mesmo tempo', (A, t) =>
        A.juntos(P.estocadas(A, t, { esparso: 1.5, caixa: null }), P.colunas(A, t, { esparso: 1.6, quantidade: 2, forma: 'espadas' }))),
      passo: r('Rajadas miradas numa caixa apertada', (A, t) => apertar(A, t, P.mira(A, t))),
      formacao: r('Lasers alternados numa caixa apertada', (A, t) => apertar(A, t, P.lasers(A, t, { orientacao: 'alternar', quantidade: 1 }))),
      alma: r('Rajadas miradas numa caixa apertada', (A, t) => apertar(A, t, P.mira(A, t))),
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
      ['espadas', 9, 'Estocada Dupla', 'estocadas'],
      ['espadas', 13, 'Lâmina Determinada', 'determinada'],
      ['ouros', 1, 'Silêncio'],
      ['ouros', 2, 'Olhar Vazio', 'mira'],
      ['ouros', 5, 'Passo Calculado', 'passo'],
      ['ouros', 8, 'Plano Tático', 'lasers'],
      ['ouros', 11, 'Formação', 'formacao'],
      ['ouros', 12, 'Controle da Alma', 'alma', { inverter: 1500 }],
      ['paus', 1, 'Mão Leve'],
      ['paus', 4, 'Armadilha de Espinhos', 'forcado'],
      ['paus', 7, 'Mina no Chão', 'bombas'],
      ['paus', 10, 'Emboscada', 'emboscada'],
      ['copas', 1, 'Determinação'],
      ['copas', 3, 'Respirar Fundo', ['energia']],
      ['copas', 7, 'Escudo Improvisado', ['escudo']],
      ['copas', 10, 'Torta de Caramelo', ['cura']],
    ],
  },

  // Susie: força bruta (♠). Machado (foice), pisões (colunas), investidas.
  susie: {
    tema: { formas: ['hex', 'bola'], cores: { hex: 0xb05cff, bola: 0xd9a0ff, barra: 0xc890ff, foice: 0xe0c0ff }, cor: 0xb05cff },
    hp: 110,
    principal: { espadas: 'foice', ouros: 'mira', paus: 'bombas' },
    leve: (A) => A.colunas({ duracao: 4000, quantidade: 1, velocidade: 130, intervalo: 1700, mirar: 0 }),
    receitas: {
      rugido: r('Rajadas miradas numa caixa apertada', (A, t) => apertar(A, t, P.mira(A, t))),
      pressao: r('Estocadas numa caixa apertada', (A, t) => apertar(A, t, P.estocadas(A, t))),
      buster: r('Machado bumerangue com rajadas miradas', (A, t) =>
        A.juntos(P.foice(A, t, { faiscas: 1 }), P.mira(A, t, { esparso: 1.8, caixa: null }))),
      maluco: r('Pisões e depois o machado bumerangue', (A, t) =>
        A.sequencia(P.colunas(A, t, { duracao: metade(t) }), P.foice(A, t, { duracao: metade(t), varridas: 2, aviso: 600, avisoVolta: 450, faiscas: 3 }))),
      dinamite: r('Bombas e chão rachado', (A, t) => A.juntos(P.bombas(A, t, { esparso: 1.4 }), P.rachaduras(A, t, { esparso: 1.6 }))),
    },
    super: {
      nome: 'Machado Colossal',
      texto: 'Pisões, o machado gigante com faíscas e a dinamite que racha o chão',
      criar: (A) => A.superSusie()
    },
    cartas: [
      ['espadas', 1, 'Revide Selvagem'],
      ['espadas', 2, 'Cabeçada', 'colunas'],
      ['espadas', 4, 'Machadada', 'foice'],
      ['espadas', 6, 'Pisão', 'colunas'],
      ['espadas', 8, 'Giro do Machado', 'foice'],
      ['espadas', 10, 'Investida', 'estocadas'],
      ['espadas', 12, 'Rude Buster', 'buster'],
      ['espadas', 13, 'Machado Maluco', 'maluco'],
      ['ouros', 1, 'Grito'],
      ['ouros', 3, 'Encarar', 'mira'],
      ['ouros', 7, 'Rugido', 'rugido'],
      ['ouros', 11, 'Pressão', 'pressao', { inverter: 1200 }],
      ['paus', 1, 'Roubar Lanche'],
      ['paus', 5, 'Bomba de Giz', 'bombas'],
      ['paus', 9, 'Chão Rachado', 'rachaduras'],
      ['paus', 11, 'Dinamite', 'dinamite'],
      ['copas', 1, 'Teimosia'],
      ['copas', 5, 'Ultimate Heal', ['cura']],
      ['copas', 9, 'Bolo Roubado', ['cura', 'energia']],
    ],
  },

  // Ralsei: suporte (♥). Magia gentil: anéis, estrelas, carrossel.
  ralsei: {
    tema: { formas: ['copas', 'bola'], cores: { copas: 0x4dd68a, bola: 0xa8f0c0, barra: 0x8fe8b0 }, cor: 0x4dd68a },
    hp: 80,
    principal: { espadas: 'anel', ouros: 'carrossel', paus: 'divisores' },
    leve: (A) => A.anel({ duracao: 4000, intervalo: 2800, quantidade: 16, abertura: 1.4, tempoFechar: 1700 }),
    receitas: {
      ninar: r('Carrossel lento numa caixa apertada', (A, t) => apertar(A, t, P.carrossel(A, t * 0.5))),
      sono: r('Anéis numa caixa apertada', (A, t) => apertar(A, t, P.anel(A, t, { mirar: 0.2 }))),
      laco: r('Divisores e anel', (A, t) => A.juntos(P.divisores(A, t, { esparso: 1.3 }), P.anel(A, t, { esparso: 1.6 }))),
    },
    super: {
      nome: 'Valsa Real',
      texto: 'Carrossel de anéis, anel com projéteis que se dividem e uma espiral de copas',
      criar: (A) => A.superRalsei()
    },
    cartas: [
      ['espadas', 1, 'Lição Invertida'],
      ['espadas', 5, 'Estrela Gentil', 'anel'],
      ['espadas', 9, 'Coro de Estrelas', 'espiral'],
      ['ouros', 1, 'Pacifismo'],
      ['ouros', 4, 'Canção de Ninar', 'ninar'],
      ['ouros', 7, 'Passos de Dança', 'carrossel'],
      ['ouros', 11, 'Feitiço de Sono', 'sono', { inverter: 1500 }],
      ['paus', 1, 'Empréstimo Educado'],
      ['paus', 3, 'Bolinho Explosivo', 'bombas'],
      ['paus', 6, 'Fios de Lã', 'divisores'],
      ['paus', 10, 'Laço de Fita', 'laco'],
      ['copas', 1, 'Abraço Fofo'],
      ['copas', 2, 'Chá Quentinho', ['cura']],
      ['copas', 4, 'Proteção Mágica', ['escudo']],
      ['copas', 6, 'Heal Prayer', ['cura']],
      ['copas', 8, 'Biscoito de Gengibre', ['compra']],
      ['copas', 10, 'Cachecol Verde', ['escudo', 'cura']],
      ['copas', 12, 'Pacify', ['energia', 'compra']],
      ['copas', 13, 'Oração Maior', ['cura', 'escudo']],
    ],
  },

  // Noelle: suporte (♥) gélido. Neve lenta, anéis de gelo, estalactites.
  noelle: {
    tema: { formas: ['losango', 'hex'], cores: { losango: 0x9fe6ff, hex: 0xe0f8ff, barra: 0xc8f0ff, bola: 0x9fe6ff }, cor: 0x9fe6ff },
    hp: 85,
    principal: { espadas: 'neve', ouros: 'lasers', paus: 'colunas' },
    leve: (A) => A.rain({ duracao: 4000, intervalo: 560, velocidade: 90, partida: 0.7, cascata: 3, raio: 7, girar: 1, mirar: 0.3 }),
    receitas: {
      nevasca: r('Neve com um anel de gelo se fechando', (A, t) => A.juntos(P.neve(A, t, { esparso: 1.5, caixa: null }), P.anel(A, t, { esparso: 1.5 }))),
      ventoGelido: r('Neve numa caixa apertada', (A, t) => apertar(A, t, P.neve(A, t))),
      raio: r('Raios de gelo verticais', (A, t) => P.lasers(A, t, { orientacao: 'vertical' })),
      inverno: r('Raios de gelo cruzados numa caixa apertada', (A, t) => apertar(A, t, P.lasers(A, t, { orientacao: 'alternar' }))),
      pingentes: r('Pingentes de gelo despencam', (A, t) => P.colunas(A, t, { forma: 'losango' })),
      avalanche: r('Pingentes e neve', (A, t) => A.juntos(P.colunas(A, t, { esparso: 1.4, forma: 'losango' }), P.neve(A, t, { esparso: 1.8, caixa: null }))),
    },
    super: {
      nome: 'Inverno Absoluto',
      texto: 'Neve em cascata, raios de gelo verticais e pingentes com um anel de gelo',
      criar: (A) => A.superNoelle()
    },
    cartas: [
      ['espadas', 1, 'Espelho de Gelo'],
      ['espadas', 4, 'Floco Afiado', 'neve'],
      ['espadas', 8, 'Granizo', 'neve'],
      ['espadas', 12, 'Nevasca', 'nevasca'],
      ['ouros', 1, 'Congelar'],
      ['ouros', 5, 'Vento Gélido', 'ventoGelido'],
      ['ouros', 9, 'Raio de Gelo', 'raio'],
      ['ouros', 13, 'Inverno Eterno', 'inverno', { inverter: 2000 }],
      ['paus', 1, 'Mão Fria'],
      ['paus', 3, 'Pingentes', 'pingentes'],
      ['paus', 7, 'Estalactites', 'pingentes'],
      ['paus', 11, 'Avalanche', 'avalanche'],
      ['copas', 1, 'Milagre de Natal'],
      ['copas', 2, 'Chocolate Quente', ['cura']],
      ['copas', 4, 'Sino de Natal', ['energia']],
      ['copas', 6, 'Cura Gelada', ['cura']],
      ['copas', 8, 'Casaco de Lã', ['escudo']],
      ['copas', 10, 'Prece', ['cura', 'compra']],
      ['copas', 11, 'Anjo da Neve', ['escudo', 'cura']],
    ],
  },

  // Berdly: controle (♦). Vento, asas e "cálculos geniais".
  berdly: {
    tema: { formas: ['losango', 'bola'], cores: { losango: 0x3fd0ff, bola: 0x8fe0ff, barra: 0xa0e8ff }, cor: 0x3fd0ff },
    hp: 90,
    principal: { espadas: 'mira', ouros: 'estocadas', paus: 'ondas' },
    leve: (A) => A.aimed({ duracao: 4000, intervalo: 1600, velocidade: 110, rajada: 2 }),
    receitas: {
      rajadaVento: r('Estocadas numa caixa apertada', (A, t) => apertar(A, t, P.estocadas(A, t))),
      calculo: r('Rajadas miradas numa caixa apertada', (A, t) => apertar(A, t, P.mira(A, t))),
      qi: r('Lasers cruzados', (A, t) => P.lasers(A, t, { orientacao: 'cruz', intervalo: lerp(1500, 1250, t) })),
      vendaval: r('Estocadas e rajadas miradas numa caixa apertada', (A, t) =>
        A.comCaixa(caixaApertada(t * 0.5), A.juntos(P.estocadas(A, t, { esparso: 1.5 }), P.mira(A, t, { esparso: 1.8 })))),
      corrente: r('Paredes de vento vindo da esquerda', (A, t) => P.ondas(A, t, { direcao: 'direita' })),
      ciclone: r('Paredes de vento que descem', (A, t) => P.ondas(A, t, { direcao: 'baixo', abertura: 72 })),
    },
    super: {
      nome: 'Furacão Genial',
      texto: 'Vento da esquerda, estocadas numa caixa apertada e lasers em cruz com rajadas miradas',
      criar: (A) => A.superBerdly()
    },
    cartas: [
      ['espadas', 1, 'Réplica Brilhante'],
      ['espadas', 3, 'Bicada', 'mira'],
      ['espadas', 7, 'Penas Voadoras', 'mira'],
      ['espadas', 10, 'Mergulho Aéreo', 'estocadas'],
      ['ouros', 1, 'Objeção!'],
      ['ouros', 2, 'Correção', 'estocadas'],
      ['ouros', 4, 'Rajada de Vento', 'rajadaVento'],
      ['ouros', 6, 'Cálculo Genial', 'calculo'],
      ['ouros', 8, 'Tornado', 'espiral'],
      ['ouros', 12, 'QI Elevado', 'qi', { inverter: 1500 }],
      ['ouros', 13, 'Vendaval Supremo', 'vendaval', { inverter: 2000 }],
      ['paus', 1, 'Cópia da Prova'],
      ['paus', 5, 'Pena Armada', 'divisores'],
      ['paus', 9, 'Corrente de Ar', 'corrente'],
      ['paus', 11, 'Ciclone', 'ciclone'],
      ['copas', 1, 'Ego Inabalável'],
      ['copas', 3, 'Pose Heroica', ['energia']],
      ['copas', 6, 'Autoconfiança', ['escudo']],
      ['copas', 9, 'Lanche da Cantina', ['cura']],
    ],
  },

  // Dess: ataque (♠) com guitarra e taco. Ondas sonoras e bolas rebatidas.
  dess: {
    tema: { formas: ['ouros', 'bola'], cores: { ouros: 0xff8a4a, bola: 0xffc08a, barra: 0xffa86a }, cor: 0xff8a4a },
    hp: 100,
    principal: { espadas: 'quicantes', ouros: 'lasers', paus: 'bombas' },
    leve: (A) => A.quicantes({ duracao: 4000, intervalo: 1700, velocidade: 120, quiques: 3 }),
    receitas: {
      solo: r('Paredes sonoras que vêm da esquerda', (A, t) => P.ondas(A, t, { direcao: 'direita' })),
      show: r('Ondas sonoras e bolas rebatidas', (A, t) => A.juntos(P.ondas(A, t, { esparso: 1.4 }), P.quicantes(A, t, { esparso: 1.7 }))),
      palheta: r('Ondas numa caixa apertada', (A, t) => apertar(A, t, P.ondas(A, t, { abertura: 60 }))),
      feedback: r('Bolas rebatidas numa caixa apertada', (A, t) => apertar(A, t, P.quicantes(A, t))),
      amplificador: r('Paredes sonoras que descem', (A, t) => P.ondas(A, t, { direcao: 'baixo', abertura: 72 })),
      palco: r('Bombas e ondas sonoras', (A, t) => A.juntos(P.bombas(A, t, { esparso: 1.4 }), P.ondas(A, t, { esparso: 1.6 }))),
    },
    super: {
      nome: 'Turnê Final',
      texto: 'Ondas sonoras, bolas rebatidas e o palco explosivo',
      criar: (A) => A.superDess()
    },
    cartas: [
      ['espadas', 1, 'Rebatida'],
      ['espadas', 2, 'Nota Solta', 'quicantes'],
      ['espadas', 5, 'Taco de Beisebol', 'quicantes'],
      ['espadas', 7, 'Riff Distorcido', 'ondas'],
      ['espadas', 9, 'Home Run', 'quicantes'],
      ['espadas', 11, 'Solo de Guitarra', 'solo'],
      ['espadas', 13, 'Show de Rock', 'show'],
      ['ouros', 1, 'Corta o Som'],
      ['ouros', 4, 'Microfonia', 'lasers'],
      ['ouros', 8, 'Palheta', 'palheta'],
      ['ouros', 12, 'Feedback', 'feedback', { inverter: 1500 }],
      ['paus', 1, 'Pegou Emprestado'],
      ['paus', 3, 'Bomba de Fumaça', 'bombas'],
      ['paus', 6, 'Amplificador', 'amplificador'],
      ['paus', 10, 'Cabos Enrolados', 'lasers'],
      ['paus', 12, 'Palco Explosivo', 'palco'],
      ['copas', 1, 'Bis!'],
      ['copas', 6, 'Refrigerante', ['energia']],
      ['copas', 10, 'Fone de Ouvido', ['escudo']],
    ],
  },

  // Asriel: equilibrado, com mais figuras que os outros (6; eram 12 antes do
  // balanceamento de 2026-10-02). Estrelas, espadas do caos, galáxias.
  asriel: {
    tema: { formas: ['losango', 'copas', 'bola'], cores: { losango: 0xfff07a, copas: 0xff8ad8, bola: 0x9ad8ff, barra: 0xffffff }, cor: 0xfff07a },
    hp: 95,
    principal: { espadas: 'chuva', ouros: 'carrossel', paus: 'bombas' },
    leve: (A) => A.rain({ duracao: 4000, intervalo: 520, velocidade: 105, mirar: 0.3 }),
    receitas: {
      buster: r('Lâmina do caos vai e volta, depois chuva de estrelas', (A, t) =>
        A.sequencia(P.foice(A, t, { duracao: metade(t), varridas: 2, aviso: 600, avisoVolta: 450 }), P.chuva(A, t, { duracao: metade(t) }))),
      goner: r('Espiral de estrelas com chuva', (A, t) => A.juntos(P.espiral(A, t, { esparso: 1.5 }), P.chuva(A, t, { esparso: 2.6, caixa: null }))),
      shocker: r('Raios verticais numa caixa apertada', (A, t) => apertar(A, t, P.lasers(A, t, { orientacao: 'vertical', quantidade: 1 }))),
      tempo: r('Espiral que inverte com rajadas miradas numa caixa apertada', (A, t) =>
        apertar(A, t * 0.6, A.juntos(P.espiral(A, t * 0.6, { esparso: 1.5, caixa: null }), P.mira(A, t, { esparso: 2.6, caixa: null, rajada: 2 })))),
      final: r('Estrelas miradas, cruz giratória e colapso que explode', (A, t) => apertar(A, t * 0.3, P.caosFinal(A, t, { esparso: 1.2 }))),
      meteoros: r('Bombas com chuva de estrelas', (A, t) => A.juntos(P.bombas(A, t, { esparso: 1.3 }), P.chuva(A, t, { esparso: 2, caixa: null }))),
      raio: r('Lasers em cruz', (A, t) => P.lasers(A, t, { orientacao: 'cruz', intervalo: lerp(1500, 1250, t) })),
      supernova: r('Bombas e projéteis que se dividem', (A, t) => A.juntos(P.bombas(A, t, { esparso: 1.3 }), P.divisores(A, t, { esparso: 1.5 }))),
    },
    // a 3ª fase é o Caos Final encurtado (o colapso ainda explode: fica com 50% do tempo)
    super: {
      nome: 'Supernova Arco-Íris',
      texto: 'Chuva de estrelas, espiral com chuva e o Caos Final',
      criar: (A) => A.superAsriel()
    },
    cartas: [
      ['espadas', 1, 'Hiper Espelho'],
      ['espadas', 4, 'Star Blazing', 'chuva'],
      ['espadas', 8, 'Chaos Saber', 'foice'],
      ['espadas', 11, 'Chaos Buster', 'buster'],
      ['espadas', 13, 'Hyper Goner', 'goner'],
      ['ouros', 1, 'Apagar'],
      ['ouros', 3, 'Shocker Breaker', 'shocker'],
      ['ouros', 7, 'Galáxia', 'carrossel'],
      ['ouros', 12, 'Tempo Parado', 'tempo', { inverter: 1500 }],
      ['ouros', 13, 'Caos Final', 'final', { inverter: 2000 }],
      ['paus', 1, 'Pegar Alma'],
      ['paus', 4, 'Estrela Cadente', 'bombas'],
      ['paus', 8, 'Chuva de Meteoros', 'meteoros'],
      ['paus', 10, 'Raio Caótico', 'raio'],
      ['paus', 13, 'Supernova', 'supernova'],
      ['copas', 1, 'Salvar'],
      ['copas', 5, 'Lembrança', ['cura']],
      ['copas', 8, 'Amizade', ['escudo', 'energia']],
      ['copas', 10, 'Esperança', ['cura', 'compra']],
      ['copas', 12, 'Sonho', ['cura', 'escudo']],
    ],
  },
}

// ---------- montagem das cartas ----------

const TEXTO_ESPECIAL = {
  espelho: 'ESPECIAL: o ataque que o adversário jogou volta para a caixa dele. Sem nada para refletir, manda um eco.',
  anular: 'ESPECIAL: cancela a carta do adversário (ataque, suporte e especial) e manda um ataque leve.',
  roubo: 'ESPECIAL: rouba uma carta sorteada da mão do adversário e manda um ataque leve.',
  segundaChance: 'ESPECIAL: cura 25% do HP máximo e você não pode cair nesta rodada (fica com 1 HP). Não manda ataque.',
}

// Detalhes internos de cada carta (não fazem parte do formato da carta)
const DETALHES = {}

const idDe = (personagem, naipe, valor) => `${personagem}-${naipe}-${valor}`

function montar(personagem) {
  const def = BARALHOS[personagem]
  const normais = def.cartas.map(([naipe, valor, nome, receita, extras = {}]) => {
    const id = idDe(personagem, naipe, valor)
    const especial = valor === 1 ? ESPECIAIS[naipe] : null
    let descricao
    let efeitos = null
    if (especial) {
      descricao = TEXTO_ESPECIAL[especial]
    } else if (naipe === 'copas') {
      efeitos = Object.assign({}, ...receita.map((e) => EFEITOS_COPAS[e](valor)))
      descricao = `Suporte: ${textoEfeitos(efeitos)}. Manda só um ataque fraquinho.`
    } else {
      const texto = def.receitas[receita]?.texto ?? TEXTOS[receita]
      if (!texto) throw new Error(`carta ${id}: receita desconhecida "${receita}"`)
      descricao = `${texto}.`
      if (extras.inverter) descricao += ' Inverte os controles do adversário durante o ataque todo.'
    }
    DETALHES[id] = { receita: especial ? null : naipe === 'copas' ? null : receita, efeitos, especial, inverter: extras.inverter ?? 0 }
    return { id, personagem, naipe, valor, nome, descricao, custo: custoDoValor(valor) }
  })
  // a carta SUPER entra no baralho como as outras
  const id = idDe(personagem, 'espadas', SUPER.valor)
  DETALHES[id] = { receita: null, efeitos: null, especial: null, inverter: 0, super: true }
  const superCarta = { id, personagem, naipe: 'espadas', valor: SUPER.valor, nome: def.super.nome, descricao: `SUPER: ${def.super.texto}. Imparável: não pode ser anulada nem refletida.`, custo: SUPER.custo }
  return [...normais, superCarta]
}

export const CARTAS = Object.fromEntries(Object.keys(BARALHOS).map((p) => [p, montar(p)]))
export const TEMAS = Object.fromEntries(Object.entries(BARALHOS).map(([p, def]) => [p, def.tema]))
export const HP_RESERVA = Object.fromEntries(Object.entries(BARALHOS).map(([p, def]) => [p, def.hp]))

// { nome, descricao, cor } da carta SUPER do personagem (cor = cor do tema do baralho)
export function superDoPersonagem(personagem) {
  const carta = CARTAS[personagem]?.find(ehSuper)
  if (!carta) throw new Error(`personagem sem baralho: ${personagem}`)
  return { nome: carta.nome, descricao: carta.descricao, cor: BARALHOS[personagem].tema.cor }
}

export function cartasDoPersonagem(personagem) {
  const lista = CARTAS[personagem]
  if (!lista) throw new Error(`personagem sem baralho: ${personagem}`)
  return lista.map((c) => ({ ...c }))
}

// Detalhes de uma carta pelos campos (vale também para cópias com id trocado, ex. carta roubada)
export function detalhesDaCarta(carta) {
  return DETALHES[idDe(carta.personagem, carta.naipe, carta.valor)] ?? null
}

// Efeitos de copas da carta ({ cura?, escudo?, energia?, compra? }) ou null
export function efeitosDaCarta(carta) {
  return detalhesDaCarta(carta)?.efeitos ?? null
}

// ---------- carta -> ataque ----------

// Dano de cada bala do ataque da carta (antes do escudo de quem recebe)
//   com DIFICULDADE_PVP.dano 1,3: espadas 4..13, paus 4..12, ouros 4..10, copas 3, SUPER 13
export function danoDaCarta(carta) {
  if (ehSuper(carta)) return DANO_SUPER
  const especial = especialDaCarta(carta)
  const valor = especial ? VALOR_DO_ESPECIAL[especial] ?? 0 : carta.valor
  const naipe = especial === 'espelho' ? 'espadas' : carta.naipe
  if (!valor) return 0
  if (naipe === 'copas') return Math.round(2 * DIFICULDADE_PVP.dano)
  const porValor = { espadas: 0.6, paus: 0.55, ouros: 0.45 }[naipe]
  return Math.round((2 + valor * porValor) * DIFICULDADE_PVP.dano)
}

// Multiplicadores de ritmo do ataque (ouros deixa as balas mais rápidas)
// (todas levam o aperto de DIFICULDADE_PVP; ouros ainda acelera até 20% em cima)
export function ritmoDaCarta(carta) {
  const { velocidade, densidade } = DIFICULDADE_PVP
  if (carta.naipe !== 'ouros') return { velocidade, densidade }
  const valor = carta.valor === 1 ? VALOR_DO_ESPECIAL.anular : carta.valor
  return { velocidade: Math.round(velocidade * (1 + 0.2 * forca(valor)) * 100) / 100, densidade }
}

// ms de controles invertidos que o ataque causa na caixa de quem recebe
export function inverterDaCarta(carta) {
  return detalhesDaCarta(carta)?.inverter ?? 0
}

// Ataque (da linguagem de attacks/) que a carta manda para a caixa do adversário.
//   contexto.ataques     biblioteca de attacks/index.js (obrigatória; injetada para testar em Node)
//   contexto.caixaFixa   true: ignora as mudanças de caixa dos padrões (caixa sempre a padrão)
// Devolve null quando a carta não manda ataque (Ás de copas).
export function ataqueDaCarta(carta, contexto = {}) {
  const A = contexto.ataques
  if (!A) throw new Error('ataqueDaCarta: passe contexto.ataques (attacks/index.js)')
  const def = BARALHOS[carta.personagem]
  const det = detalhesDaCarta(carta)
  if (!def || !det) throw new Error(`carta desconhecida: ${carta.id}`)

  let ataque
  if (det.especial === 'segundaChance') return null
  if (det.super) {
    ataque = def.super.criar(A)
  } else if (det.especial) {
    const naipe = det.especial === 'espelho' ? 'espadas' : carta.naipe
    ataque = criarReceita(A, def, def.principal[naipe], forca(VALOR_DO_ESPECIAL[det.especial]))
  } else if (carta.naipe === 'copas') {
    ataque = def.leve(A)
  } else {
    ataque = criarReceita(A, def, det.receita, forca(carta.valor))
  }
  return contexto.caixaFixa ? A.comCaixa(null, ataque) : ataque
}

function criarReceita(A, def, chave, t) {
  const propria = def.receitas[chave]
  if (propria) return propria.criar(A, t)
  return P[chave](A, t)
}

// Tudo que a caixa do adversário precisa para rodar a carta, num objeto
// simples (o ataque em si é montado com ataqueDaCarta na hora de rodar)
export function resumoDoAtaque(carta) {
  return { dano: danoDaCarta(carta), ritmo: ritmoDaCarta(carta), inverterMs: inverterDaCarta(carta) }
}
