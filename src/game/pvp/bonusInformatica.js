// Regras puras (sem Phaser, testáveis em Node) dos bônus da SALA DE
// INFORMÁTICA que mexem no controle ou na posição do coração. O visual fica
// em pvp/bonus/eventos/ (lag.js, teclado.js, clone.js).
//
//   lerAtrasado(fila, limite)      LAG: o comando que "chegou" até `limite`
//   MAPAS_TECLADO                  TECLADO EMBARALHADO: as 7 trocas de setas possíveis
//   aplicarMapa(mapa, joy)         o joystick depois da troca
//   inverterMapa(mapa)             a troca que desfaz (a CPU "aprende" o teclado novo)
//   sortearMapa(rng, atual)        uma troca diferente da atual
//   espelhar(modo, limites, x, y)  CTRL+C CTRL+V: onde fica o clone espelhado

// ---------- LAG ----------

// fila: comandos em ordem de chegada { t, x, y, ... }. Tira da frente tudo o
// que já chegou (t <= limite) e devolve o último deles, que continua valendo
// (fica de volta na frente da fila) até o próximo chegar. Nada chegou ainda: null.
export function lerAtrasado(fila, limite) {
  let saida = null
  while (fila.length && fila[0].t <= limite) saida = fila.shift()
  if (saida) fila.unshift(saida)
  return saida
}

// ---------- TECLADO EMBARALHADO ----------

// Cada troca é uma matriz 2x2 [a, b, c, d]: x' = a*x + b*y, y' = c*x + d*y.
// São as 8 simetrias do quadrado menos a identidade: girar 90°/180°/270° e os
// 4 espelhos. Todas levam seta em seta (nenhuma diagonal estranha).
export const MAPAS_TECLADO = [
  { id: 'gira90', m: [0, -1, 1, 0] },
  { id: 'gira180', m: [-1, 0, 0, -1] },
  { id: 'gira270', m: [0, 1, -1, 0] },
  { id: 'espelhoLados', m: [-1, 0, 0, 1] },
  { id: 'espelhoCimaBaixo', m: [1, 0, 0, -1] },
  { id: 'diagonal', m: [0, 1, 1, 0] },
  { id: 'antidiagonal', m: [0, -1, -1, 0] },
]
export const MAPA_NORMAL = { id: 'normal', m: [1, 0, 0, 1] }

// 0 * -1 dá -0 em JS: soma 0 para o resultado ficar limpo
export function aplicarMapa(mapa, joy) {
  const [a, b, c, d] = mapa.m
  return { x: a * joy.x + b * joy.y + 0, y: c * joy.x + d * joy.y + 0 }
}

// As matrizes são ortogonais: a inversa é a transposta
export function inverterMapa(mapa) {
  const [a, b, c, d] = mapa.m
  return { id: `inversa:${mapa.id}`, m: [a, c, b, d] }
}

export function sortearMapa(rng, atual = null) {
  const opcoes = MAPAS_TECLADO.filter((m) => m.id !== atual?.id)
  return opcoes[Math.min(opcoes.length - 1, Math.floor(rng() * opcoes.length))]
}

// As 4 setas do teclado e a direção (vetor unitário) de cada uma
export const SETAS = {
  cima: { x: 0, y: -1 },
  baixo: { x: 0, y: 1 },
  esquerda: { x: -1, y: 0 },
  direita: { x: 1, y: 0 },
}

// Qual seta sai quando se aperta `seta` com o `mapa` valendo
export function setaResultante(mapa, seta) {
  const v = aplicarMapa(mapa, SETAS[seta])
  return Object.keys(SETAS).find((s) => SETAS[s].x === Math.round(v.x) && SETAS[s].y === Math.round(v.y))
}

// ---------- CTRL+C CTRL+V ----------

// modo: 'lados' (espelho na vertical do meio da caixa), 'cimaBaixo' (na
// horizontal do meio) ou 'centro' (os dois: do outro lado do centro).
// limites: { left, right, top, bottom }. Como é simétrico em volta do centro,
// se o coração está dentro da caixa o clone também está.
export const MODOS_CLONE = ['lados', 'cimaBaixo', 'centro']

export function espelhar(modo, l, x, y) {
  const ex = l.left + l.right - x
  const ey = l.top + l.bottom - y
  if (modo === 'cimaBaixo') return { x, y: ey }
  if (modo === 'centro') return { x: ex, y: ey }
  return { x: ex, y }
}
