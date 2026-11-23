// A escala de desenho atual (game/resolucao.js calcula e muda os campos). Fica num módulo sem Phaser
// para quem só precisa ler a escala (arte/assar.js) poder ser importado nos testes do Node.
//   RES.zoom     quantas vezes o 854x480 é ampliado (ou reduzido) na página (CSS)
//   RES.dpr      pixels do monitor por pixel CSS (telas HiDPI)
//   RES.escala   zoom x dpr: pixels reais por pixel do jogo
//   RES.batata   a resolução BATATA (canvas no tamanho do mundo, ampliado pela página: resolucao.js)
export const RES = { zoom: 1, dpr: 1, escala: 1, batata: false }

// RESOLUÇÃO BATATA (CONFIGURAÇÕES > GRÁFICOS, ou ligada sozinha: game/batata.js): o canvas fica no tamanho do
// MUNDO (854x480, escala 1) e a página amplia ele com image-rendering: pixelated. O jogo desenha 1 pixel por pixel
// do mundo: a GPU pinta RES.escala² vezes menos pixels (2x numa tela 1,4x, ~5x num celular 1,5x a 1,5 de zoom).
// A ampliação é "pixel perfeito" quando dá: se um múltiplo INTEIRO de pixels do aparelho por pixel do mundo ocupa
// pelo menos 85 % do espaço, usa ele (os pixels saem todos do mesmo tamanho); senão, o zoom livre de sempre.
export function medirBatata(zoom, dprReal) {
  const k = zoom * dprReal // pixels do aparelho por pixel do mundo
  const inteiro = Math.floor(k)
  const zoomCss = inteiro >= 1 && inteiro / k >= 0.85 ? inteiro / dprReal : zoom
  return { zoom: zoomCss, dpr: 1, escala: 1, batata: true }
}
