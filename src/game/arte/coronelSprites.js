// Pixel art da turma do Coronel Caçamba (CO-OP 2.0, docs/coop-cartas.md "Coronel Caçamba"; o próprio Coronel fica
// em arte/chefoes.js; o Caminhão Compactador e os lacaios da Expedição, em arte/expedicao.js): o caminhão de lixo das cartas. Original.
// Mesmo formato de arte/sprites.js: cada linha é uma fileira de pixels, cada letra uma cor ('.' = transparente).
// O verde é só da RECICLAGEM (o item que não machuca): nenhuma arte do lixo que machuca usa verde.

// completa cada linha com '.' até a largura (editar a arte fica fácil) e confere o tamanho
const linhas = (largura, ...mapa) => mapa.map((l) => l.padEnd(largura, '.'))

export const SPRITES_CORONEL = {
  // o caminhão de lixo que cruza as faixas (bala), de lado, de frente para a direita
  caminhaoLixo: {
    paleta: { o: '#e8892a', O: '#a85a14', w: '#e9ecf2', W: '#aab2c0', g: '#9fd8ff', k: '#15151c', m: '#8a909c', M: '#4a4f5a', y: '#fff27a', r: '#d83a3a', b: '#2a2e38' },
    mapa: linhas(
      32,
      '................................',
      '..mmmmmmmmmmmmmmmmmm............',
      '.mMMMMMMMMMMMMMMMMMMm...wwwwww..',
      '.moooooooooooooooooom..wwwwwwww.',
      '.moOooooooooooooooOom..wggggggww',
      '.mooooooooooooooooomwwwwggggggww',
      '.moooooOOOOOOOoooooomwwwggggggww',
      'rmooooOooooooOooooommwwwwwwwwwwy',
      'rmoooooOOOOOOOooooomMwwwwwwwwwwy',
      '.moooooooooooooooooMWWWWWWWWWWWW',
      '.mOOOOOOOOOOOOOOOOOMbbbbbbbbbbbW',
      '..bbbbbbbbbbbbbbbbbbbbbbbbbbbbb.',
      '...kkkk.......kkkk.....kkkk.....',
      '..kkWWkk.....kkWWkk...kkWWkk....',
      '..kkWWkk.....kkWWkk...kkWWkk....',
      '...kkkk.......kkkk.....kkkk.....',
    ),
  },
}
