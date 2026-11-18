// BOSS SEMANAL · ESCURIDÃO (docs/boss-semanal.md). Formato: ver o comentário em coop/chefes/index.js.
// A caixa fica quase preta: cada um vê só o PRÓPRIO coração e desvia pelo SOM (coop/semanal/escuridao.js:
// panorâmica = posição horizontal, altura do som = posição vertical, um tique que acelera quando a bala
// chega perto, um timbre por tipo de ataque, coop/semanal/pistas.js TIMBRES).
//
// CO-OP 2.0: a regra OLHOS NO BREU (coop/semanal/escuridaoRegra.js): olhos se abrem no escuro (brilham e
// sussurram do lado deles); um coração parado em cima fecha o olho (dois juntos fecham no dobro da velocidade)
// e cada olho fechado enche a QUEBRA e fere a sombra. Fechar todos acende um clarão; olho que fica aberto no fim
// da esquiva esconde a próxima carta dela no escuro (a prévia vira "?"). Fase 2: os olhos piscam; fase 3: andam.
//
// Os ataques de assinatura (attacks/escuridao*.js) avisam com a LUZ DA PRÓPRIA SOMBRA, por cima do breu: a poça
// e a faixa da MÃO DA SOMBRA, o sino do ECO (o anel com brecha e o eco do lado espelhado), o leque do OLHAR (um
// olho na borda que varre metade da caixa) e as VELAS que tremem e estouram ao apagar. As balas ficam no escuro.
// DIFICULDADE (docs/coop-cartas.md "Dificuldade do CO-OP"): boss semanal é desafio da semana, fica na ponta dura;
// o ritmo (desafio) é um pouco menor que o dos outros chefes porque no escuro só os avisos aparecem.
import { REGRA_ESCURIDAO } from '../semanal/escuridaoRegra.js'

export default {
  nome: 'Escuridão',
  dificuldade: 'medio',
  semanal: true,
  escuro: true,
  sprite: 'escuridao',
  fundo: 'escuridao',
  musica: 'king',
  desafio: { velocidade: 0.98, densidade: 0.95 }, // era 0,72 / 0,62
  textoInicial: 'As luzes se apagam. Ouça. Os olhos dela se abrem no breu.',
  tema: {
    formas: ['bola', 'losango'],
    cores: { bola: 0xb8b0ff, losango: 0x8a7cff, barra: 0xff5a7a },
    cor: 0xb8b0ff,
  },
  hp: 520, // era 280 (a regra dos olhos fere a sombra e enche a QUEBRA)
  danoBala: 15, // era 9 (no escuro quem joga só vê os avisos: um pouco menos que a Ladra)
  // MÉDIO: um pouco mais de ritmo também (o semanal é o desafio da semana); DIFÍCIL: o ritmo do nível já aperta
  niveis: { medio: { velocidade: 1.08, densidade: 1.12, dano: 2.5, hp: 1.25 }, dificil: { dano: 1.8, hp: 1.15 } },
  regra: REGRA_ESCURIDAO,
  leve: (A) => A.juntos(A.rain({ duracao: 4500, intervalo: 650, velocidade: 95, caixa: null }), A.escuridaoVelas({ duracao: 4500, intervalo: 1700, estilhacos: 6 })),
  fases: [
    {
      hp: 1,
      falas: ['Você me ouve?', 'Feche os olhos. Escute.', 'O silêncio também corta.'],
      cartas: [
        ['espadas', 5, 'Mão da Sombra', (A) => A.juntos(A.escuridaoMaos({ intervalo: 1350 }), A.rain({ intervalo: 700, velocidade: 100, caixa: null }))],
        ['ouros', 5, 'Sino no Escuro', (A) => A.juntos(A.escuridaoEco({ intervalo: 2100, ecos: 1 }), A.aimed({ intervalo: 1700, velocidade: 105, caixa: null }))],
        ['paus', 6, 'Velas', (A) => A.juntos(A.escuridaoVelas({ intervalo: 950, simultaneas: 2 }), A.rain({ intervalo: 720, velocidade: 95, caixa: null }))],
        ['espadas', 6, 'Zumbido', (A) => A.juntos(A.lasers({ intervalo: 1900, aviso: 850 }), A.escuridaoMaos({ intervalo: 1900, dedos: 0 }))],
        ['copas', 4, 'Respirar Fundo', null, { cura: 22 }],
      ],
    },
    {
      hp: 0.6,
      entrada: 'Agora... nem a sua sombra vai te ajudar.',
      velocidadeFundo: 1.3,
      falas: ['Mais perto. Mais perto.', 'Conte as batidas.', 'Esquerda? Direita?'],
      cartas: [
        ['espadas', 9, 'O Olhar', (A) => A.juntos(A.escuridaoOlhar({ intervalo: 3400 }), A.rain({ intervalo: 520, velocidade: 105, caixa: null }))],
        ['paus', 9, 'Velório', (A) => A.juntos(A.escuridaoVelas({ intervalo: 900, simultaneas: 2, estilhacos: 9 }), A.bombas({ intervalo: 2200, fragmentos: 6, velocidade: 100 }))],
        ['ouros', 10, 'Eco Duplo', (A) => A.juntos(A.escuridaoEco({ intervalo: 2400, ecos: 2, notas: 18 }), A.escuridaoMaos({ intervalo: 2000, dedos: 2 }))],
        ['espadas', 10, 'Mãos no Breu', (A) => A.escuridaoMaos({ duracao: 7000, intervalo: 1500, maos: 2, dedos: 3 })],
        ['copas', 8, 'Silêncio', null, { cura: 18, guarda: 0.6 }],
      ],
    },
    {
      hp: 0.3,
      entrada: 'BREU TOTAL! Eu vejo vocês... vocês não me veem!',
      velocidadeFundo: 1.8,
      falas: ['Shhh...', 'Os meus olhos estão em toda parte.', 'A última vela vai apagar.'],
      cartas: [
        ['espadas', 12, 'Olhar Fixo', (A) => A.juntos(A.escuridaoOlhar({ duracao: 7500, intervalo: 4200, vaivem: true, lagrimas: 420 }), A.escuridaoVelas({ duracao: 7500, intervalo: 1100, estilhacos: 7 }))],
        ['paus', 12, 'Apagão', (A) => A.escuridaoVelas({ duracao: 7000, intervalo: 800, simultaneas: 3, estilhacos: 9, segunda: 0.6 })],
        ['ouros', 12, 'Coro de Sinos', (A) => A.juntos(A.escuridaoEco({ duracao: 7000, intervalo: 1800, ecos: 2, notas: 18, velocidade: 105 }), A.rain({ duracao: 7000, intervalo: 700, velocidade: 110, caixa: null }))],
        ['espadas', 13, 'Abraço da Sombra', (A) => A.juntos(A.escuridaoMaos({ duracao: 7000, intervalo: 1500, maos: 2, dedos: 4, alcance: 0.82 }), A.escuridaoEco({ duracao: 7000, intervalo: 3000, ecos: 0 }))],
        ['copas', 10, 'Breu Eterno', null, { cura: 20, guarda: 0.5 }],
      ],
    },
  ],
  super: {
    nome: 'Breu Total',
    texto: 'O olho varre, as mãos saem da poça e as velas apagam, tudo no escuro',
    criar: (A) => A.juntos(A.escuridaoOlhar({ duracao: 7000, intervalo: 3800 }), A.escuridaoMaos({ duracao: 7000, intervalo: 1700, dedos: 2 }), A.escuridaoVelas({ duracao: 7000, intervalo: 1600 })),
  },
}
