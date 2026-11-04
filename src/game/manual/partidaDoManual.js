import { NIVEIS_BOT } from '../pvp/bot.js'
import { CARTAS } from '../pvp/cartas.js'
import { ARENA } from '../pvp/arenas.js'

// A partida da página 5 do Manual do Ralsei ("Uma partida de verdade"): uma PvpArena de verdade contra a
// CPU, só que curta e mansa (lógica pura; testada em __tests__/partidaDoManual.test.js). As regras são as
// de sempre (pvp/regras.js); aqui só se escolhe COMO a partida começa:
//   p1 / p2      você é a Kris; o Ralsei é a CPU (as cartas mansas dele, com a Estrela Gentil que chove)
//   nivel        o nível mais fácil da CPU (bot.js e botEsquiva.js: NIVEIS_BOT)
//   fatorHp      as duas vidas menores (3/4): a partida dura uns 2 a 3 minutos
//   semente      fixa: as mãos e as escolhas da CPU são sempre as mesmas (na 1ª rodada a CPU joga a
//                Estrela Gentil, e na sua mão há uma carta que ainda não cabe: as dicas têm onde aparecer)
//   tempo        0: sem relógio para escolher a carta (dá para pensar com calma)
//   bonus        sem rodada bônus (a roleta e os eventos ficam para a partida normal)
//   aceleracao   sem morte súbita
//   arena        o jardim (calminho)
export const PARTIDA_DO_MANUAL = {
  p1: 'kris',
  p2: 'ralsei',
  nivel: 'facil',
  fatorHp: 0.75,
  semente: 'manual:p5:12',
  tempo: 0,
  bonus: false,
  aceleracao: false,
  arena: 'jardim',
}

// o nível mais fácil que existe (o primeiro de NIVEIS_BOT)
export const NIVEL_MAIS_FACIL = Object.keys(NIVEIS_BOT)[0]

export const hpDaPartida = (hp, fator = PARTIDA_DO_MANUAL.fatorHp) => Math.max(1, Math.round(hp * fator))

// o estado de criarPartida com as vidas da partida do manual (vida cheia, só menor)
export function ajustarPartida(estado, cfg = PARTIDA_DO_MANUAL) {
  for (const jog of estado.jogadores) {
    jog.hpMax = hpDaPartida(jog.hpMax, cfg.fatorHp)
    jog.hp = jog.hpMax
  }
  return estado
}

// os dados com que a cena da partida começa (scenes/ManualRalsei5Partida.js)
export function dadosDaPartida(extra = {}) {
  const c = PARTIDA_DO_MANUAL
  return { p1: c.p1, p2: c.p2, arena: c.arena, semente: c.semente, tempo: c.tempo, ...extra }
}

// confere a configuração (o teste e o DEV usam)
export function configValida(c = PARTIDA_DO_MANUAL) {
  return Boolean(CARTAS[c.p1] && CARTAS[c.p2] && NIVEIS_BOT[c.nivel] && ARENA[c.arena] && c.fatorHp > 0 && c.fatorHp <= 1)
}
