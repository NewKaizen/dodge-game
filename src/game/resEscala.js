// A escala de desenho atual (game/resolucao.js calcula e muda os campos). Fica num módulo sem Phaser
// para quem só precisa ler a escala (arte/assar.js) poder ser importado nos testes do Node.
//   RES.zoom     quantas vezes o 854x480 é ampliado (ou reduzido) na página (CSS)
//   RES.dpr      pixels do monitor por pixel CSS (telas HiDPI)
//   RES.escala   zoom x dpr: pixels reais por pixel do jogo
export const RES = { zoom: 1, dpr: 1, escala: 1 }
