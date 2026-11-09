// Paleta da interface; as cores de perigo, jogadores e hitboxes continuam semânticas.
export const UI = {
  fundo: 0x0b0d19,
  painel: 0x11182a,
  elevado: 0x1b2a40,
  linha: 0x354963,
  ciano: 0x63efdb,
  coral: 0xff6486,
  texto: '#f1f5ff',
  secundario: '#a9bad1',
  destaque: '#63efdb',
}

export function molduraArcade(cena, profundidade = -4) {
  const g = cena.add.graphics().setDepth(profundidade)
  g.fillStyle(UI.fundo, 0.62).fillRect(0, 0, 854, 480)
  g.fillStyle(UI.painel, 0.82).fillRect(0, 0, 854, 62).fillRect(0, 446, 854, 34)
  g.lineStyle(1, UI.linha, 0.8).lineBetween(24, 62, 830, 62).lineBetween(24, 446, 830, 446)
  g.lineStyle(2, UI.ciano, 0.9).lineBetween(24, 62, 78, 62)
  g.lineStyle(2, UI.coral, 0.9).lineBetween(776, 446, 830, 446)
  return g
}

export function detalheCarta(cena, x, y, largura, altura, cor) {
  const g = cena.add.graphics()
  const esquerda = x - largura / 2
  const topo = y - altura / 2
  g.fillStyle(cor, 0.11).fillTriangle(esquerda + 1, topo + 1, esquerda + largura - 1, topo + 1, esquerda + 1, topo + altura - 1)
  g.fillStyle(cor, 0.85).fillRect(esquerda + 1, topo + 1, 24, 2)
  g.fillStyle(UI.fundo, 0.8).fillRect(esquerda + 1, topo + altura - 25, largura - 2, 24)
  return g
}
