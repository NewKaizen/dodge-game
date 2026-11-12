import { criarRng } from '../pvp/baralho.js'
import { CORACAO } from '../constants.js'
import { limitesDe } from './onda.js'
import { tiro, RAIO_TIRO } from './padroes.js'

// Os tiros mirados dos extras do Manual do Ralsei (páginas 7 a 9), SEM Phaser. É o mesmo "tiro" da
// página 2 (padroes.js: nasce fora da caixa, fica PARADO e inofensivo durante o aviso enquanto uma linha
// pontilhada mostra o caminho, depois vai reto), só que em cadência fixa e com a mira num coração à escolha.
//
//   roteiroDeTiros(caixa, op)    { gerar(t, alvo) -> opções de bala } · op: { semente, inicio, passo, ate, velocidade, aviso }
//   posicaoDeGraze(b, c, caixa)  onde o coração `c` raspa na bala `b` (parada, avisando): a 17 px da linha,
//                                dentro do anel de graze e fora do miolo (o "piloto de graze" dos testes)
//   FOLGA_DO_GRAZE               a folga (borda da bala ao centro do coração) que esse ponto tem

export const DISTANCIA_DO_GRAZE = 17
export const FOLGA_DO_GRAZE = DISTANCIA_DO_GRAZE - RAIO_TIRO // 10 px: > hitbox (4,2) e <= graze (22)

export function roteiroDeTiros(caixa, { semente, inicio = 500, passo = 1300, ate = Infinity, velocidade = 105, aviso } = {}) {
  const rng = criarRng(semente)
  const l = { ...limitesDe(caixa) }
  l.width = l.right - l.left
  l.height = l.bottom - l.top
  let proximo = inicio
  return {
    gerar(t, alvo) {
      const saida = []
      while (proximo <= t && proximo < ate) {
        saida.push(tiro(rng, l, alvo, aviso === undefined ? { velocidade } : { velocidade, aviso }))
        proximo += passo
      }
      return saida
    },
  }
}

// o ponto (dentro da caixa) a DISTANCIA_DO_GRAZE da reta do tiro, do lado que cabe; null se nenhum cabe
export function posicaoDeGraze(b, c, caixa, { meio = CORACAO.tamanho / 2 } = {}) {
  const linha = b.extra?.linha
  if (!linha) return null
  const { x, y, dx, dy } = linha
  const t = Math.max(0, (c.x - x) * dx + (c.y - y) * dy)
  const px = x + dx * t
  const py = y + dy * t
  const l = limitesDe(caixa)
  const dentro = (q) => q.x >= l.left + meio && q.x <= l.right - meio && q.y >= l.top + meio && q.y <= l.bottom - meio
  for (const lado of [1, -1]) {
    const q = { x: px - dy * DISTANCIA_DO_GRAZE * lado, y: py + dx * DISTANCIA_DO_GRAZE * lado }
    if (dentro(q)) return q
  }
  return null
}
