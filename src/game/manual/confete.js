import { aleatorio } from '../pvp/baralho.js'
import { PALETA } from './cera.js'

// Confete de coraçõezinhos de papel (página concluída). Lógica PURA, sem Phaser (testada em
// __tests__/confete.test.js): a cena só cria uma imagem por peça e copia x/y/giro/virada.
// "Reduzir animações" ou clarões desligados: a cena nem chama isto.
//
//   gerarConfete(rng, n, x, y)   as peças saindo de (x, y) para cima, em leque
//   passoConfete(pecas, dt)      anda dt ms: gravidade, ar segurando, o vai-e-vem da folhinha caindo;
//                                devolve só as peças que ainda estão na tela

export const CORES_CONFETE = [PALETA.rosa, PALETA.coracao, PALETA.amarelo, PALETA.azul, PALETA.lavanda, PALETA.verde]
export const GRAVIDADE = 420 // px/s²
export const CHAO = 520 // passou daqui (abaixo da tela), some

export function gerarConfete(rng, n, x, y) {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (aleatorio(rng) - 0.5) * 2.2
    const v = 220 + aleatorio(rng) * 260
    return {
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      giro: aleatorio(rng) * 6.28,
      vgiro: (aleatorio(rng) - 0.5) * 8,
      fase: aleatorio(rng) * 6.28,
      t: 0,
      cor: CORES_CONFETE[i % CORES_CONFETE.length],
      escala: 0.7 + aleatorio(rng) * 0.6,
    }
  })
}

export function passoConfete(pecas, dt) {
  const s = Math.min(Math.max(dt, 0), 50) / 1000
  for (const p of pecas) {
    p.t += s
    p.vy += GRAVIDADE * s
    // o ar segura (folha de papel cai devagar) e balança de um lado para o outro
    const ar = Math.exp(-2.6 * s)
    p.vx *= ar
    p.vy = Math.min(p.vy * ar, 150)
    p.x += (p.vx + Math.sin(p.t * 5 + p.fase) * 40) * s
    p.y += p.vy * s
    p.giro += p.vgiro * s
  }
  return pecas.filter((p) => p.y < CHAO)
}

// a "virada" da folhinha (escala x de -1 a 1): dá a impressão de papel girando no ar
export const viradaDaPeca = (p) => Math.cos(p.t * 7 + p.fase)
