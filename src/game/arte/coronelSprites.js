// Pixel art do Coronel Caçamba e da turma dele (CO-OP 2.0, docs/coop-cartas.md "Coronel Caçamba"): o caminhão de
// lixo das cartas, o Caminhão Compactador (tenente) e os lacaios (guaxinins e um saco de lixo). Original.
// Mesmo formato de arte/sprites.js: cada linha é uma fileira de pixels, cada letra uma cor ('.' = transparente).
// O verde é só da RECICLAGEM (o item que não machuca): nenhuma arte do lixo que machuca usa verde.

// completa cada linha com '.' até a largura (editar a arte fica fácil) e confere o tamanho
const linhas = (largura, ...mapa) => mapa.map((l) => l.padEnd(largura, '.'))
// espelha uma metade (a arte de frente é simétrica)
const espelhada = (metade) => metade.map((l) => l + [...l].reverse().join(''))

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

  // O Caminhão Compactador (tenente): de frente, os faróis de olhos bravos, a boca de grade e a caçamba atrás
  caminhaoCompactador: {
    paleta: { o: '#e8892a', O: '#a85a14', w: '#e9ecf2', W: '#aab2c0', g: '#7cc4f0', G: '#4a8fc0', k: '#15151c', m: '#8a909c', M: '#4a4f5a', y: '#fff27a', Y: '#e0b020', r: '#e8323a', b: '#2a2e38', s: '#c8ccd8' },
    mapa: espelhada(
      linhas(
        16,
        '.......mmmmmmmmm',
        '......mMMMMMMMMM',
        '.....mMOOOOOOOOO',
        '....mMoooooooooo',
        '....mMoooooooooo',
        '....mMooOooooooo',
        '....mMoooooooooo',
        '.....mmmmmmmmmmm',
        '......wwwwwwwwww',
        '.....wWWWWWWWWWW',
        '....wwGggggggggg',
        '....wGgrrgggggkk',
        '....wGgrrkgggggg',
        '....wGggggggggWW',
        '....wwWWWWWWWWWW',
        '...wwwwwwwwwwwww',
        '..wyyywwwwwwwwww',
        '..wyYyywbbbbbbbb',
        '..wyyyywbsbsbsbs',
        '..wwwwwwbsbsbsbs',
        '.kkkkkkwbbbbbbbb',
        'kkWWkkwwwwwwwwww',
        'kWWWWkkWWWWWWWWW',
        'kWWWWkkkkkkkkkkk',
        '.kkkk...........',
      ),
    ),
  },

  // os lacaios (um grupo só): guaxinim, saco de lixo e guaxinim (a metade da esquerda é o guaxinim)
  lacaios: {
    paleta: { g: '#8f96a3', G: '#5f6572', k: '#15151c', w: '#f2f2f2', n: '#e89aa0', t: '#d8d0b0', s: '#3d3d4d', S: '#23232e', l: '#5c5f6e', e: '#f05a5a', d: '#2f3140' },
    mapa: (() => {
      // guaxinim de frente (14 x 17); o saco de lixo (12 x 17) fica no meio
      const guaxinim = linhas(
        14,
        '..gg......gg..',
        '.gGggggggggGg.',
        '.gggggggggggg.',
        '.gkkkggggkkkg.',
        '.kwkkgggkkwkk.',
        '.gkkkggggkkkg.',
        '..ggggnnnggg..',
        '..gGgggngggG..',
        '.gggggggggggg.',
        'tgGGgggggGGggt',
        'tgGgGgggggGgGt',
        'tgggGggggGgggt',
        '.ggdddggdddgg.',
        '..gggg..gggg..',
        '..gggg..gggg..',
        '..kkkk..kkkk..',
        '..............',
      )
      const saco = linhas(
        12,
        '.....ll.....',
        '....lSSl....',
        '...lSSSSl...',
        '..lSSSSSSl..',
        '.lSSSSSSSSl.',
        '.lSewSSwSel.',
        '.lSSSSSSSSl.',
        '.lSSSwwSSSl.',
        'lSSsSSSSsSSl',
        'lSSSSSSSSSSl',
        'lSsSSSSSSsSl',
        'lSSSSSsSSSSl',
        'lSSSSSSSSSSl',
        '.lSSSSSSSSl.',
        '..lllllllll.',
        '............',
        '............',
      )
      const direita = guaxinim.map((l) => [...l].reverse().join(''))
      return guaxinim.map((l, i) => l + saco[i] + direita[i])
    })(),
  },
}
