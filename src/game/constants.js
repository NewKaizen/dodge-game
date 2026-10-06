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
  hpFundo: 0x5a0a14,
  hpChefe: 0x3cff6a,
  aviso: 0xff3048,
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
  caido: '#ff4050',
  guarda: '#6dd0ff',
}

// 0xff00ff -> '#ff00ff'
export const corTexto = (cor) => '#' + cor.toString(16).padStart(6, '0')

export const CAIXA = { largura: 240, altura: 160, borda: 4, tweenMs: 220 } // forma de referência dos ataques (a Pista escala para a dela)

// Caixa dinâmica (BattleBox.mudarPara): um ataque pode pedir outra forma,
// { largura, altura, x?, y? } (x e y deslocam o centro). Sempre com aviso antes.
//   avisoMs      pré-visualização antes de mudar (>= ATAQUE.telegrafoMs)
//   transicaoMs  tempo que a caixa leva para mudar; o coração é empurrado junto
//   *Min         tamanho mínimo (garante espaço para a rota de fuga); o máximo e o
//                campo onde a caixa cabe vêm de cada Pista
export const CAIXA_DINAMICA = {
  avisoMs: 450,
  transicaoMs: 260,
  larguraMin: 110,
  alturaMin: 100,
  deslocMax: 40,
}

// hitbox e graze são raios em px; velocidade em px/s
export const CORACAO = { tamanho: 16, hitbox: 5, graze: 22, velocidadePadrao: 180 }

export const TEMPOS = {
  invencivelMs: 850,
  letraMs: 22, // velocidade do texto digitado
  balaoMs: 1600, // tempo mínimo da fala do chefe na tela
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
// vale em cima de tudo. FÁCIL = o chefe como ele é (tudo 1).
//   velocidade, densidade   multiplicam o ritmo de todo ataque
//   velocidadeMax           multiplica o teto de velocidade das balas
//   dano, hp                multiplicam o dano das balas e o HP do chefe
//   fundo                   o fundo animado anda mais rápido (mais agitado)
export const NIVEIS = {
  facil: { rotulo: 'FÁCIL', cor: '#6dff8a', velocidade: 1, densidade: 1, velocidadeMax: 1, dano: 1, hp: 1, fundo: 1 },
  medio: {
    rotulo: 'MÉDIO',
    cor: '#ffd84a',
    velocidade: 1.1,
    densidade: 1.15,
    velocidadeMax: 1.05,
    dano: 1.25,
    hp: 1.2,
    fundo: 1.4,
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

export const FUNDO = { escurecer: 0.45 }
// musica: volume da música relativo ao geral (MIDI costuma ser alto)
export const AUDIO = { volume: 0.25, musica: 1.6 }

// Morte súbita: partida longa acelera TUDO. A cada `aCadaRodadas` rodadas
// (começo da 5ª, 10ª, 15ª, 20ª, 25ª) o nível sobe e o fator ganha `passo`, até `maximo`.
// Vale nas duas arenas de cartas (PvP e CO-OP).
//   passo, maximo   fator das balas: velocidade E densidade (ritmo) e o teto de velocidade
//   coracao         fração do bônus que o coração ganha (0.5 = metade: continua dá para desviar)
//   escolhaMinMs    o relógio da escolha de carta encolhe com o fator, até aqui
//   animacao        fração do bônus nas animações de carta e transições
//   musica          fração do bônus no andamento da música
export const ACELERACAO = { aCadaRodadas: 5, passo: 0.3, maximo: 2.5, coracao: 0.5, escolhaMinMs: 8000, animacao: 1, musica: 0.35 }

// Nível de aceleração na rodada `rodada` (1 = primeira): 0 nas 5 primeiras,
// 1 da 5ª à 9ª, 2 da 10ª à 14ª... (x2,5 na 25ª) (para de subir quando o fator chega ao máximo)
export function nivelAceleracao(rodada, cfg = ACELERACAO) {
  const nivel = Math.max(0, Math.floor(Math.max(0, rodada) / cfg.aCadaRodadas))
  const teto = Math.ceil((cfg.maximo - 1) / cfg.passo - 1e-9)
  return Math.min(nivel, teto)
}

// Fator de velocidade (1 = normal) na rodada `rodada`, arredondado em 2 casas
export function fatorAceleracao(rodada, cfg = ACELERACAO) {
  const f = Math.min(cfg.maximo, 1 + nivelAceleracao(rodada, cfg) * cfg.passo)
  return Math.round(f * 100) / 100
}

// Só uma fração do bônus (ex.: o coração ganha metade do que as balas ganham)
export const parteDoFator = (fator, fracao) => Math.round((1 + (fator - 1) * fracao) * 1000) / 1000
