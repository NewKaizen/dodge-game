// Geometria (sem Phaser, testada em __tests__/asrielSuper.test.js) do Caos Final do SUPER do Asriel: raios de
// estrelas que saem do núcleo da supernova.
//
// Dois raios vizinhos nunca ficam a menos de `passo - 2 * jitter` rad um do outro, então entre eles sempre
// sobra uma fatia de pelo menos LACUNA_MINIMA px (medida a `raio` px do centro, onde as estrelas têm
// `estrela` px de raio). A 2ª onda cai no MEIO das fatias da 1ª (quem ficou parado na fatia leva).
const TAU = Math.PI * 2

// `n` ângulos igualmente espaçados a partir de `base`, cada um com um desvio de no máximo `jitter` rad
// (`sorteio()` devolve -1..1). Ordenados.
export function angulosDosRaios(n, base, jitter, sorteio) {
  const passo = TAU / n
  const lista = []
  for (let i = 0; i < n; i++) lista.push(norm(base + i * passo + sorteio() * jitter))
  return lista.sort((p, q) => p - q)
}

// ângulos do meio de cada fatia entre dois raios vizinhos (os da 2ª onda)
export function angulosDoMeio(angulos) {
  const meios = []
  for (let i = 0; i < angulos.length; i++) {
    const a = angulos[i]
    const b = angulos[(i + 1) % angulos.length] + (i + 1 === angulos.length ? TAU : 0)
    meios.push(norm((a + b) / 2))
  }
  return meios.sort((p, q) => p - q)
}

// menor distância angular entre dois raios vizinhos
export function menorFatia(angulos) {
  let menor = Infinity
  for (let i = 0; i < angulos.length; i++) {
    const a = angulos[i]
    const b = angulos[(i + 1) % angulos.length] + (i + 1 === angulos.length ? TAU : 0)
    menor = Math.min(menor, b - a)
  }
  return menor
}

// largura livre (px) de uma fatia de `fatia` rad, a `raio` px do centro, entre estrelas de raio `estrela`
// e com a folga `hitbox` do coração de cada lado
export const larguraLivre = (fatia, raio, estrela, hitbox) => fatia * raio - 2 * (estrela + hitbox)

function norm(x) {
  return ((x % TAU) + TAU) % TAU
}
