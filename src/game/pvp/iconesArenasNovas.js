// Ícones (vetoriais, ~44 px, centrados em (x, y)) das arenas ESTAÇÃO ESPACIAL, CHINATOWN, CIDADE GRANDE, PRAIA e CAFÉ,
// para o cartão da votação (scenes/PvpVoto.js, desenharIcone). `g` é um Phaser.GameObjects.Graphics.
//   ICONES_ARENAS_NOVAS[id](g, x, y, cor)

export const ICONES_ARENAS_NOVAS = {
  // um planeta com anel e um satélite com painéis solares
  estacao(g, x, y, cor) {
    g.fillStyle(cor, 1).fillCircle(x - 2, y + 2, 13)
    g.fillStyle(0x000000, 0.25).fillCircle(x + 3, y + 6, 10)
    g.fillStyle(0xffffff, 0.4).fillRect(x - 11, y - 3, 14, 2).fillRect(x - 12, y + 3, 10, 2)
    g.lineStyle(3, 0xf0f4ff, 0.95).strokeEllipse(x - 2, y + 3, 44, 12)
    g.fillStyle(cor, 1).fillRect(x - 15, y - 1, 10, 6) // o planeta passa na frente do anel
    g.fillStyle(0xd8dce8, 1).fillRect(x + 11, y - 17, 7, 5)
    g.fillStyle(0x4a7aff, 1).fillRect(x + 5, y - 16, 5, 3).fillRect(x + 19, y - 16, 5, 3)
    g.fillStyle(0xffffff, 1).fillRect(x - 19, y - 14, 2, 2).fillRect(x + 19, y + 8, 2, 2).fillRect(x - 6, y - 19, 2, 2)
  },
  // uma lanterna vermelha com tampas douradas e franja, e o telhado do portal por cima
  chinatown(g, x, y, cor) {
    g.fillStyle(0x2a1a14, 1).fillRect(x - 1, y - 20, 2, 6)
    g.fillStyle(0xf0b428, 1).fillRect(x - 8, y - 15, 16, 4).fillRect(x - 8, y + 11, 16, 4)
    g.fillStyle(cor, 1).fillEllipse(x, y - 1, 26, 26)
    g.lineStyle(1.5, 0x6a0c10, 0.8).strokeEllipse(x, y - 1, 14, 26).strokeEllipse(x, y - 1, 5, 26)
    g.fillStyle(0xf0b428, 1).fillCircle(x, y - 1, 3.5)
    g.lineStyle(2, 0xf0c850, 1)
    for (const dx of [-4, 0, 4]) g.lineBetween(x + dx, y + 15, x + dx * 1.4, y + 21)
  },
  // o skyline: prédios com janelas acesas e a lua
  cidade(g, x, y, cor) {
    g.fillStyle(0xfff0c0, 1).fillCircle(x + 12, y - 12, 5)
    const predios = [[-20, 10, 10, 30], [-9, 4, 12, 36], [4, 12, 10, 28], [14, 6, 8, 34]]
    predios.forEach(([dx, topo, w, h], i) => {
      g.fillStyle(i % 2 ? 0x4a5278 : 0x363c5c, 1).fillRect(x + dx, y - 18 + topo, w, h)
      g.fillStyle(cor, 0.95)
      for (let k = 0; k < 3; k++) g.fillRect(x + dx + 2 + (k % 2) * 4, y - 18 + topo + 3 + k * 6, 2, 3)
    })
    g.fillStyle(0x4a5278, 1).fillRect(x - 3, y - 20, 2, 8)
    g.fillStyle(0xffffff, 0.35).fillRect(x - 24, y + 18, 50, 2)
  },
  // um guarda-sol listrado com o sol atrás e a onda embaixo
  praia(g, x, y, cor) {
    g.fillStyle(0xffd34d, 1).fillCircle(x + 12, y - 12, 7)
    g.fillStyle(0xffffff, 1).slice(x - 4, y - 2, 18, Math.PI, 0, false).fillPath()
    g.fillStyle(0xff4a5a, 1)
    for (let k = 0; k < 3; k++) g.slice(x - 4, y - 2, 18, Math.PI + (k * 2 * Math.PI) / 6, Math.PI + ((k * 2 + 1) * Math.PI) / 6, false).fillPath()
    g.fillStyle(0x6a4a2a, 1).fillRect(x - 5, y - 2, 2, 18)
    g.fillStyle(0xf0d890, 1).fillRect(x - 22, y + 14, 44, 5)
    g.lineStyle(3, cor, 1)
    g.beginPath().moveTo(x - 22, y + 10)
    for (let i = 1; i <= 8; i++) g.lineTo(x - 22 + i * 5.5, y + 10 + (i % 2 ? -3 : 0))
    g.strokePath()
  },
  // uma xícara de café com pires e o vapor subindo
  cafe(g, x, y, cor) {
    g.lineStyle(2, 0xffffff, 0.75)
    for (const dx of [-5, 2]) g.beginPath().moveTo(x + dx, y - 4).lineTo(x + dx + 3, y - 10).lineTo(x + dx, y - 16).lineTo(x + dx + 3, y - 21).strokePath()
    g.fillStyle(0xf4ecdc, 1).fillRect(x - 12, y - 2, 20, 16)
    g.fillStyle(0x5a3a22, 1).fillRect(x - 10, y - 1, 16, 4)
    g.lineStyle(3, 0xf4ecdc, 1).strokeCircle(x + 11, y + 5, 5)
    g.fillStyle(cor, 1).fillRect(x - 12, y + 6, 20, 3)
    g.fillStyle(0xf4ecdc, 1).fillEllipse(x - 2, y + 16, 34, 6)
  },
}
