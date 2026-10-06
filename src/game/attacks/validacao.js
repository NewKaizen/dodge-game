import { ATAQUE, CORACAO } from '../constants.js'

// Checagens de justiça dos ataques. Rodam só em modo dev e só avisam no
// console (não mudam o jogo). Critério de rota de fuga: sempre precisa
// existir uma lacuna de pelo menos LACUNA_MINIMA px (3x o coração). Os dois
// corações podem se sobrepor, então uma lacuna assim serve para os dois.

export const LACUNA_MINIMA = CORACAO.tamanho * ATAQUE.lacunaMinima

const DEV = import.meta.env.DEV
const jaAvisados = new Set()

export function avisar(chave, mensagem) {
  if (!DEV || jaAvisados.has(chave)) return
  jaAvisados.add(chave)
  console.warn(mensagem)
}

// Chamado a cada ataque (Pista.rodar) para os avisos voltarem a aparecer
export function novaRodada() {
  jaAvisados.clear()
}

// Trechos livres de [ini, fim] depois de tirar os trechos ocupados
export function lacunasLivres(ini, fim, ocupados) {
  const ordenados = ocupados
    .map(([a, b]) => [Math.max(ini, a), Math.min(fim, b)])
    .filter(([a, b]) => b > a)
    .sort((p, q) => p[0] - q[0])
  const livres = []
  let cursor = ini
  for (const [a, b] of ordenados) {
    if (a > cursor) livres.push([cursor, a])
    cursor = Math.max(cursor, b)
  }
  if (cursor < fim) livres.push([cursor, fim])
  return livres
}

// Parede que atravessa a caixa inteira. eixo 'x': a parede é horizontal e
// as lacunas são trechos em x; eixo 'y': parede vertical, lacunas em y.
// Passe `lacunas` já prontas ou os trechos `ocupados` pelas balas.
export function validarParede({ padrao, eixo, limites, lacunas, ocupados = [] }) {
  if (!DEV) return true
  const [ini, fim] = eixo === 'x' ? [limites.left, limites.right] : [limites.top, limites.bottom]
  const livres = lacunas ?? lacunasLivres(ini, fim, ocupados)
  const maior = Math.max(0, ...livres.map(([a, b]) => Math.min(b, fim) - Math.max(a, ini)))
  if (maior >= LACUNA_MINIMA) return true
  avisar(
    `parede:${padrao}`,
    `[rota de fuga] ${padrao}: parede sem saída (maior lacuna ${Math.round(maior)}px, mínimo ${LACUNA_MINIMA}px)`,
  )
  return false
}

// Abertura isolada (ex.: vão de um anel)
export function validarLacuna(padrao, tamanho, descricao = 'abertura') {
  if (!DEV) return true
  if (tamanho >= LACUNA_MINIMA) return true
  avisar(
    `lacuna:${padrao}:${descricao}`,
    `[rota de fuga] ${padrao}: ${descricao} de ${Math.round(tamanho)}px (mínimo ${LACUNA_MINIMA}px)`,
  )
  return false
}

// Com as balas perigosas de agora, procura um círculo livre de diâmetro
// LACUNA_MINIMA dentro da caixa
export function validarEspacoLivre({ padrao, limites, balas, tempo }) {
  if (!DEV) return true
  const r = LACUNA_MINIMA / 2
  const perigosas = balas.lista.filter((b) => balas.perigosa(b))
  for (let y = limites.top + r; y <= limites.bottom - r; y += 6) {
    for (let x = limites.left + r; x <= limites.right - r; x += 6) {
      if (perigosas.every((b) => balas.folga(b, x, y) >= r)) return true
    }
  }
  avisar(
    `espaco:${padrao}`,
    `[rota de fuga] ${padrao}: nenhum espaço livre de ${LACUNA_MINIMA}px na caixa (t=${Math.round(tempo)}ms)`,
  )
  return false
}
