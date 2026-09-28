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

// hitbox e graze são raios em px; velocidade em px/s
export const CORACAO = { tamanho: 16, hitbox: 5, graze: 22, velocidadePadrao: 180 }

export const TEMPOS = {
  invencivelMs: 1000,
  letraMs: 22, // velocidade do texto digitado
  fimFightMs: 700, // pausa depois das barras do FIGHT
  balaoMs: 1600, // tempo mínimo da fala do chefe na tela
  vooMs: 320, // coração voando do personagem até a caixa/menu
  introMs: 700,
}

export const TP = { max: 100, porGraze: 3 }
export const DEFEND = { ganhoTP: 16, multiplicadorDano: 0.5 }
export const MERCY_MAX = 100

// Botões do menu (cada personagem pode ter os seus em `comandos`)
export const COMANDOS = ['FIGHT', 'ACT', 'ITEM', 'SPARE', 'DEFEND']

// Padrão do FIGHT (cada personagem pode sobrescrever em `fight`)
//   dano        dano base de um acerto bom
//   velocidade  px/s da barra
//   critico     multiplicador do acerto perfeito
//   janela      distância máxima do alvo que ainda acerta (px)
//   perfeito    distância que conta como crítico (px)
export const FIGHT = { dano: 10, velocidade: 280, critico: 1.5, janela: 90, perfeito: 5 }

// Dificuldades (os chefes apontam para uma chave daqui)
//   velocidadeMaxBala  nenhuma bala anda mais rápido que isso (px/s)
export const DIFICULDADES = {
  facil: { rotulo: 'FÁCIL', cor: '#6dff8a', estrelas: 1, velocidadeMaxBala: 180 },
  medio: { rotulo: 'MÉDIO', cor: '#ffd84a', estrelas: 2, velocidadeMaxBala: 260 },
  dificil: { rotulo: 'DIFÍCIL', cor: '#ff5a6a', estrelas: 3, velocidadeMaxBala: 340 },
}

// Regras de justiça dos ataques (validadas no console em modo dev)
export const ATAQUE = {
  telegrafoMs: 400, // aviso visual mínimo antes de qualquer dano
  respiroMs: 300, // sem balas perigosas no início e no fim de cada ataque
  lacunaMinima: 3, // rota de fuga: lacuna >= 3x o tamanho do coração
  semente: 'dodge-deltarune', // semente fixa: padrões iguais a cada partida
  validarACadaMs: 100, // frequência da checagem de espaço livre (dev)
}

// Quanto os ACTs podem mudar a agressividade de um chefe (multiplica a
// velocidade das balas e a frequência dos disparos)
export const RITMO = { minimo: 0.7, maximo: 1.3 }

export const FUNDO = { escurecer: 0.45 }
export const AUDIO = { volume: 0.25 }
