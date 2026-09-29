import { ASSETS } from './assets.js'

export const LARGURA = 640
export const ALTURA = 480

// Fonte pixelada (arquivos em assets.js); monospace enquanto não carrega
export const FONTE = `"${ASSETS.fonte.familia}", monospace`

export const CORES = {
  fundo: 0x000000,
  caixa: 0xffffff,
  painel: 0x0b0914,
  bala: 0xffffff,
  almas: [0xff2030, 0xffd23a], // cor do coração de cada jogador
  tp: 0xff8a1a,
  tpMax: 0xffe040,
  tpPrevia: 0xfff4c8,
  hpFundo: 0x5a0a14,
  hpChefe: 0x3cff6a,
  mercy: 0xffe040,
  aviso: 0xff3048,
  comando: 0xff8a1a,
  selecionado: 0xffe040,
}

// Cores de texto (Phaser usa string CSS em textos)
export const TEXTO = {
  normal: '#ffffff',
  comando: '#ff8a1a',
  selecionado: '#ffe040',
  desabilitado: '#808080',
  dano: '#ffffff',
  cura: '#3cff6a',
  mercy: '#ffe040',
  caido: '#ff4050',
  guarda: '#6dd0ff',
}

// 0xff00ff -> '#ff00ff'
export const corTexto = (cor) => '#' + cor.toString(16).padStart(6, '0')

export const LAYOUT = {
  party: { x: 110, y: 128, espacamento: 82 },
  inimigo: { x: 528, y: 160 },
  caixa: { x: 320, y: 175 }, // centro da caixa de batalha
  tp: { x: 18, y: 78, largura: 20, altura: 196 },
  paineis: { x: 50, y: 290, largura: 584, altura: 74 },
  textbox: { x: 8, y: 370, largura: 624, altura: 104 },
}

export const CAIXA = { largura: 240, altura: 160, borda: 4, tweenMs: 220 }

// Caixa dinâmica (BattleBox.mudarPara): um ataque pode pedir outra forma,
// { largura, altura, x?, y? } (x e y deslocam o centro). Sempre com aviso antes.
//   avisoMs      pré-visualização antes de mudar (>= ATAQUE.telegrafoMs)
//   transicaoMs  tempo que a caixa leva para mudar; o coração é empurrado junto
//   *Min/*Max    limites de tamanho (o mínimo garante espaço para a rota de fuga)
//   campo        região da tela onde a caixa cabe (não cobre personagens nem painéis)
export const CAIXA_DINAMICA = {
  avisoMs: 450,
  transicaoMs: 260,
  larguraMin: 110,
  alturaMin: 100,
  larguraMax: 280,
  alturaMax: 190,
  deslocMax: 40,
  campo: { esquerda: 165, direita: 470, topo: 72, base: 274 },
}

// hitbox e graze são raios em px; velocidade em px/s
export const CORACAO = { tamanho: 16, hitbox: 5, graze: 22, velocidadePadrao: 180 }

export const TEMPOS = {
  invencivelMs: 850,
  letraMs: 22, // velocidade do texto digitado
  fimFightMs: 700, // pausa depois das barras do FIGHT
  balaoMs: 1600, // tempo mínimo da fala do chefe na tela
  vooMs: 320, // coração voando do personagem até a caixa/menu
  introMs: 700,
}

// porGolpe: TP de CADA acerto do combo do FIGHT (golpe fraco ganha só a metade;
// crítico ganha `critico` a mais; fechar o combo ganha `combo` a mais)
export const TP = { max: 100, porGraze: 3, porGolpe: 3, critico: 2, combo: 4 }
// DEFEND também enfraquece o PRÓXIMO ataque do chefe: balas mais lentas e a
// onda mais curta (ver Battle.modificarProximoAtaque e attacks/definir.js encurtar)
export const DEFEND = { ganhoTP: 16, multiplicadorDano: 0.5, proximoAtaque: { velocidade: 0.85, duracao: 0.7 } }
export const MERCY_MAX = 100

// Botões do menu (cada personagem pode ter os seus em `comandos`)
export const COMANDOS = ['FIGHT', 'ACT', 'ITEM', 'SPARE', 'DEFEND']

// Padrão do FIGHT (cada personagem pode sobrescrever em `fight`)
//   dano               dano base de um golpe cheio
//   velocidade         px/s das barras
//   critico            multiplicador do acerto perfeito
//   janela             distância máxima do alvo que ainda acerta (px)
//   perfeito           distância que conta como crítico (px)
// Combo (várias barras por lutador, ver battle/Fight.js):
//   golpes             barras por lutador (cada acerto é um golpe separado)
//   fatorGolpe         fração do dano cheio que cada acerto dá (a defesa do alvo conta na mesma fração)
//   bonusCombo         multiplica o último golpe quando TODAS as barras do lutador acertam
//   chegadaMs          quando a primeira barra de cada jogador chega ao alvo (+ até variacaoMs)
//   intervaloMinMs     menor intervalo entre chegadas seguidas do mesmo jogador
//   folgaMs            espaço extra entre as janelas de duas barras seguidas do mesmo jogador
//   variacaoMs         sorteio extra (0..variacaoMs) em cada intervalo: o frenesi
//   variacaoVelocidade cada linha anda ±essa fração da velocidade (sorteado a cada FIGHT)
export const FIGHT = {
  dano: 10,
  velocidade: 280,
  critico: 1.5,
  janela: 44,
  perfeito: 5,
  golpes: 3,
  fatorGolpe: 0.45,
  bonusCombo: 1.3,
  chegadaMs: 1000,
  intervaloMinMs: 190,
  folgaMs: 30,
  variacaoMs: 160,
  variacaoVelocidade: 0.1,
}

// Dificuldades (os chefes apontam para uma chave daqui)
//   velocidadeMaxBala  nenhuma bala anda mais rápido que isso (px/s)
export const DIFICULDADES = {
  facil: { rotulo: 'FÁCIL', cor: '#6dff8a', estrelas: 1, velocidadeMaxBala: 220 },
  medio: { rotulo: 'MÉDIO', cor: '#ffd84a', estrelas: 2, velocidadeMaxBala: 300 },
  dificil: { rotulo: 'DIFÍCIL', cor: '#ff5a6a', estrelas: 3, velocidadeMaxBala: 340 },
  extremo: { rotulo: 'EXTREMO', cor: '#ff8a1c', estrelas: 4, velocidadeMaxBala: 480 },
}

// Aperto geral, vale para TODOS os chefes (em cima do que cada chefe define).
//   velocidade, densidade   multiplicam o ritmo de todo ataque (balas mais rápidas, disparos mais frequentes)
//   dano                    multiplica o danoBala de cada chefe
//   velocidadeMax           multiplica o teto de velocidade da dificuldade
// Tudo 1 = jogo como era antes.
export const DESAFIO = { velocidade: 1.15, densidade: 1.2, dano: 1.5, velocidadeMax: 1.2 }

// Nível da luta, escolhido na tela Dificuldade (depois do chefe). NÃO é a
// mesma coisa que DIFICULDADES (a classificação base de cada chefe): o nível
// vale em cima de tudo. FÁCIL = o chefe como ele é (tudo 1, sem caos).
//   velocidade, densidade   multiplicam o ritmo de todo ataque
//   velocidadeMax           multiplica o teto de velocidade das balas
//   dano, hp                multiplicam o dano das balas e o HP do chefe
//   fundo                   o fundo animado anda mais rápido (mais agitado)
//   tremor                  tremor da tela no começo do turno inimigo (0 = nenhum)
//   caos                    camada extra junto de cada ataque (battle/nivel.js):
//                           chance por turno + config de um tiro mirado leve
export const NIVEIS = {
  facil: { rotulo: 'FÁCIL', cor: '#6dff8a', velocidade: 1, densidade: 1, velocidadeMax: 1, dano: 1, hp: 1, fundo: 1, tremor: 0, caos: null },
  medio: {
    rotulo: 'MÉDIO',
    cor: '#ffd84a',
    velocidade: 1.1,
    densidade: 1.15,
    velocidadeMax: 1.05,
    dano: 1.25,
    hp: 1.2,
    fundo: 1.4,
    tremor: 0.004,
    caos: { chance: 0.4, intervalo: 2600, velocidade: 110, rajada: 1 },
  },
  dificil: {
    rotulo: 'DIFÍCIL',
    cor: '#ff5a6a',
    velocidade: 1.2,
    densidade: 1.3,
    velocidadeMax: 1.1,
    dano: 1.5,
    hp: 1.4,
    fundo: 1.9,
    tremor: 0.008,
    caos: { chance: 1, intervalo: 1900, velocidade: 120, rajada: 2 },
  },
}
export const ORDEM_NIVEIS = ['facil', 'medio', 'dificil']

// Regras de justiça dos ataques (validadas no console em modo dev)
export const ATAQUE = {
  telegrafoMs: 400, // aviso visual mínimo antes de qualquer dano
  respiroMs: 300, // sem balas perigosas no início e no fim de cada ataque
  lacunaMinima: 3, // rota de fuga: lacuna >= 3x o tamanho do coração
  semente: 'dodge-deltarune', // semente fixa: padrões iguais a cada partida
  validarACadaMs: 100, // frequência da checagem de espaço livre (dev)
}

// Respiro de cada onda de ataque (ms): calmaria no início e no meio, sem nada
// novo nascendo (attacks/definir.js). Entre 300 e 500 ms para dar tempo de
// reposicionar sem virar tempo morto.
export const RESPIRO = { inicio: 350, meio: 450 }

// Quanto os ACTs podem mudar a agressividade de um chefe (multiplica a
// velocidade das balas e a frequência dos disparos)
// `proximoMinimo` limita o acúmulo de modificadores do próximo ataque (vários
// DEFEND + ACTs não deixam o ataque menos que isso do normal)
export const RITMO = { minimo: 0.7, maximo: 1.3, proximoMinimo: 0.5 }

// Feedback de impacto ao tomar dano (Battle.acertou). A força do tremor e do
// flash escala com o dano da bala (dano / IMPACTO.danoReferencia).
export const IMPACTO = { flashCor: 0xff2030, flashAlpha: 0.32, flashMs: 170, tremorMs: 140, tremorForca: 0.012, danoReferencia: 8 }

export const FUNDO = { escurecer: 0.45 }
// musica: volume da música relativo ao geral (MIDI costuma ser alto)
export const AUDIO = { volume: 0.25, musica: 1.6 }
