// Layout dos cartões da votação de arena (scenes/PvpVoto.js). Lógica pura (sem Phaser), testável em Node.
// Serve a qualquer quantidade de arenas (mais o "?"): até 8 cartões ficam numa fileira só (o visual de
// sempre), depois vira uma GRADE de 2 fileiras (até 16) e de 3 (até 24), com cartões mais baixos.
//
//   layoutVoto(n, { centroX })      { colunas, linhas, largura, altura, espaco, espacoY, compacto, topo, base, cartoes: [{ x, y }] }
//   vizinho(indice, direcao, n, colunas)  o cartão ao lado: ← → andam em fila (dão a volta); ↑ ↓ trocam de fileira
//                                         (mesma coluna; na última fileira incompleta vai para o último cartão)

export const AREA_VOTO = { largura: 760, topo: 74, base: 226, yUmaFileira: 142, alturaUmaFileira: 114, larguraMax: 118, larguraMin: 70, espaco: 10 }
export const FILEIRAS_MAX = 3
export const POR_FILEIRA_MAX = 8

export function layoutVoto(n, { centroX = 427, area = AREA_VOTO } = {}) {
  const linhas = Math.max(1, Math.min(FILEIRAS_MAX, Math.ceil(n / POR_FILEIRA_MAX)))
  const colunas = Math.max(1, Math.ceil(n / linhas))
  const espaco = area.espaco
  const largura = Math.max(area.larguraMin, Math.min(linhas === 1 ? 100 : area.larguraMax, Math.floor((area.largura - (colunas - 1) * espaco) / colunas)))
  let altura = area.alturaUmaFileira
  let espacoY = 0
  let topo = area.yUmaFileira - altura / 2
  if (linhas > 1) {
    espacoY = 12
    altura = Math.floor((area.base - area.topo - (linhas - 1) * espacoY) / linhas)
    topo = area.topo
  }
  const cartoes = Array.from({ length: n }, (_, i) => {
    const fila = Math.floor(i / colunas)
    const noFila = Math.min(colunas, n - fila * colunas) // a última fileira pode ter menos cartões: fica centralizada
    const x0 = centroX - (noFila * largura + (noFila - 1) * espaco) / 2 + largura / 2
    return { x: x0 + (i % colunas) * (largura + espaco), y: topo + altura / 2 + fila * (altura + espacoY) }
  })
  return { colunas, linhas, largura, altura, espaco, espacoY, compacto: linhas > 1, topo, base: topo + linhas * altura + (linhas - 1) * espacoY, cartoes }
}

export function vizinho(indice, direcao, n, colunas) {
  if (n <= 1) return 0
  if (direcao === 'esquerda') return (indice - 1 + n) % n
  if (direcao === 'direita') return (indice + 1) % n
  const linhas = Math.ceil(n / colunas)
  if (linhas <= 1) return indice
  const fila = Math.floor(indice / colunas)
  const coluna = indice % colunas
  const nova = (fila + (direcao === 'baixo' ? 1 : -1) + linhas) % linhas
  return Math.min(n - 1, nova * colunas + coluna)
}
