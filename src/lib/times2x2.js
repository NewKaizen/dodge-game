// Os times do 2x2 (Fase 5E, docs/pvp-regras.md "2x2"): quem joga com quem, por VAGA da sala (0..3). Usado
// pelo jogo (pvp/dupla.js, o lobby) e pelo servidor (server/lan.js guarda o arranjo da sala; server/partidas.js
// grava o time de cada lado). A vaga 0 (o dono) é sempre do TIME A (0); o TROCAR TIME passa para o próximo:
//   0  A = vagas 0 e 2 · B = 1 e 3   (o padrão: lado % 2)
//   1  A = vagas 0 e 1 · B = 2 e 3
//   2  A = vagas 0 e 3 · B = 1 e 2
export const ARRANJOS = [
  [0, 1, 0, 1],
  [0, 0, 1, 1],
  [0, 1, 1, 0],
]

export const arranjoValido = (a) => Number.isInteger(a) && a >= 0 && a < ARRANJOS.length

// times[vaga] = 0 (TIME A) | 1 (TIME B)
export const timesDoArranjo = (a) => [...ARRANJOS[arranjoValido(a) ? a : 0]]

export const proximoArranjo = (a) => ((arranjoValido(a) ? a : 0) + 1) % ARRANJOS.length

export const ROTULO_TIME = ['TIME A', 'TIME B']

// Onde cada vaga senta na tela do 2x2, para os times ficarem JUNTOS (qualquer arranjo): o TIME A à esquerda e
// o TIME B à direita, como no anúncio dos duelos. Dentro do time, a vaga menor primeiro.
//   celula[vaga]  0 alto-esq · 1 alto-dir · 2 baixo-esq · 3 baixo-dir   (TIME A: 0 e 2 · TIME B: 1 e 3)
//   coluna[vaga]  o cartão do placar no alto: 0 1 | relógio | 2 3        (TIME A: 0 e 1 · TIME B: 2 e 3)
export function lugaresDoTime(times) {
  const celula = []
  const coluna = []
  for (const t of [0, 1]) {
    times
      .map((x, v) => (x === t ? v : -1))
      .filter((v) => v >= 0)
      .forEach((v, i) => {
        celula[v] = t + i * 2
        coluna[v] = t * 2 + i
      })
  }
  return { celula, coluna }
}
