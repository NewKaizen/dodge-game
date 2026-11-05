// O MAPA da campanha (puro; a cena Campanha desenha): uma escada que desce para o escuro, da esquerda
// para a direita. Cada fase é um patamar com uma porta; a do chefe é a última, mais funda e maior.
//
//   const m = layoutDoMapa(n, { largura, topo, base, margem })
//   m.patamares   [{ i, x, y, largura, porta: { x, y, w, h }, kris: { x, y }, estrelas: [{ x, y }] }]
//                 (y é o chão do patamar; a porta fica de pé sobre ele)
//   m.degraus     [{ x, y, w, h }]  os degraus entre um patamar e o próximo (descendo)
export const PORTA = { w: 40, h: 66 }
export const PORTA_CHEFE = { w: 52, h: 84 }

export function layoutDoMapa(n, { largura = 854, topo = 178, base = 334, margem = 92, chefe = true } = {}) {
  const patamares = []
  const degraus = []
  const passoX = n > 1 ? (largura - 2 * margem) / (n - 1) : 0
  const passoY = n > 1 ? (base - topo) / (n - 1) : 0
  const larguraPatamar = Math.min(84, passoX * 0.62)
  for (let i = 0; i < n; i++) {
    const x = Math.round(margem + i * passoX)
    const y = Math.round(topo + i * passoY)
    const doChefe = chefe && i === n - 1
    const p = doChefe ? PORTA_CHEFE : PORTA
    patamares.push({
      i,
      x,
      y,
      largura: Math.round(doChefe ? larguraPatamar * 1.2 : larguraPatamar),
      porta: { x: x + 8, y, w: p.w, h: p.h },
      kris: { x: x - 30, y },
      estrelas: [-1, 0, 1].map((k) => ({ x: x + 8 + k * 11, y: y + 14 })),
    })
  }
  // os degraus: do fim de um patamar ao começo do próximo, descendo
  for (let i = 0; i < n - 1; i++) {
    const a = patamares[i]
    const b = patamares[i + 1]
    const x0 = a.x + a.largura / 2
    const x1 = b.x - b.largura / 2
    const k = Math.max(2, Math.round((b.y - a.y) / 8))
    const w = (x1 - x0) / k
    const h = (b.y - a.y) / k
    for (let j = 0; j < k; j++) degraus.push({ x: Math.round(x0 + j * w), y: Math.round(a.y + (j + 1) * h), w: Math.ceil(w), h: Math.round(h) })
  }
  return { patamares, degraus }
}
