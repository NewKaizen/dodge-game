// Pilotos e relógio para os testes das páginas extras do manual (7 a 9): rodam a máquina de manual/exercicio.js
// quadro a quadro, como a cena faria, com um jogador que desvia bem, que raspa nas balas ou que fica parado.
import { pilotoDeDesvio } from '../../padroes.js'
import { posicaoDeGraze } from '../../tiros.js'
import { CORACAO } from '../../../constants.js'

export const CAIXA = { esquerda: 440, direita: 780, topo: 148, base: 348 }
export const DT = 16

// anda a página `ms` (ou até `parar(p)` ficar verdadeiro); `joysDe(p)` dá o joystick de cada pessoa
export function rodar(p, ms, joysDe = () => [], parar = () => false) {
  const eventos = []
  for (let t = 0; t < ms && !parar(p); t += DT) {
    p.tick(DT, joysDe(p))
    eventos.push(...p.drenar())
  }
  return eventos
}

// ‹A› até a etapa pedida (ou até esgotar a tentativa)
export function ate(p, etapa, max = 40) {
  const eventos = []
  for (let i = 0; i < max && p.etapa !== etapa; i++) {
    p.avancar()
    eventos.push(...p.drenar())
  }
  return eventos
}

// quem desvia bem: o piloto da página 2 para o coração `i`
export const desviando = (i = 0) => (p) => pilotoDeDesvio(p.balas, p.alvos[i], CAIXA, CORACAO.velocidadePadrao, { hitbox: p.alvos[i].hitbox })

// quem raspa: leva o coração (teletransporte, só no teste) ao ponto a 17 px da linha do próximo tiro que se aproxima
export function raspando(p) {
  const a = p.alvos[0]
  let melhor = null
  for (const b of p.balas) {
    const l = b.extra?.linha
    if (!l) continue
    const t = (a.x - l.x) * l.dx + (a.y - l.y) * l.dy // onde o coração está ao longo da reta do tiro
    const proj = (b.x - l.x) * l.dx + (b.y - l.y) * l.dy // onde o tiro está
    if (t < proj - 2) continue // já passou
    const falta = t - proj
    if (!melhor || falta < melhor.falta) melhor = { b, falta }
  }
  if (melhor) {
    const q = posicaoDeGraze(melhor.b, a, CAIXA)
    if (q) Object.assign(a, q)
  }
  return []
}

export const parado = () => []
