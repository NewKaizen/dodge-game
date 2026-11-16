// Arte do TABULEIRO REAL (Chaos King): as peças de xadrez em pixel art (originais), desenhadas por código.
// Os ícones pequenos (king-p-*) ficam nas casas do quadro. Os lacaios (king-lacaios) e o Cavaleiro (king-cavaleiro)
// da Expedição moram em arte/expedicao.js. texturas.js junta GERADORES_KING.
const PALETA = { k: '#120a1e', f: '#f2ead8', s: '#b9a98a', y: '#ffd23c', Y: '#b8860b', e: '#ff3040', p: '#7a5cc0', r: '#c8323a' }

export const PECAS = {
  peao: [
    '....kkkk....',
    '...kffffk...',
    '...kfffsk...',
    '...kfffsk...',
    '....kffk....',
    '...kkffkk...',
    '....kffsk...',
    '....kffsk...',
    '...kfffssk..',
    '..kfffffssk.',
    '.kfffffffssk',
    '.kkkkkkkkkkk',
  ],
  torre: [
    'kkk.kkk.kkk',
    'kfk.kfk.kfk',
    'kffkkfkkffk',
    'kfffffffffk',
    '.kkfffffkk.',
    '..kfffffk..',
    '..kffffsk..',
    '..kffffsk..',
    '..kffffsk..',
    '.kfffffffk.',
    'kfffffffssk',
    'kkkkkkkkkkk',
  ],
  bispo: [
    '....kkk....',
    '....kyk....',
    '...kfffk...',
    '..kffffsk..',
    '..kfffkfk..',
    '..kffkkfk..',
    '..kffffsk..',
    '...kffsk...',
    '....kfk....',
    '...kfffk...',
    '..kfffffk..',
    '.kfffffffk.',
    '.kkkkkkkkk.',
  ],
  cavalo: [
    '......kk....',
    '.....kffk...',
    '....kfffkk..',
    '...kffeffsk.',
    '..kfffffffsk',
    '.kffffkffssk',
    'kffffk.kfssk',
    'kkkkk..kfssk',
    '......kffssk',
    '.....kfffssk',
    '....kffffssk',
    '...kfffffssk',
    '..kkkkkkkkkk',
  ],
  rainha: [
    'k..k.kk.k..k',
    'ky.kykkyk.yk',
    'kfykfykfykfk',
    '.kfkffffkfk.',
    '..kffffffk..',
    '...kffffk...',
    '...kfffsk...',
    '....kffk....',
    '...kfffsk...',
    '..kfffffsk..',
    '.kfffffffsk.',
    '.kkkkkkkkkk.',
  ],
}

const tela = (l, a) => {
  const c = document.createElement('canvas')
  c.width = l
  c.height = a
  const g = c.getContext('2d')
  g.imageSmoothingEnabled = false
  return [c, g]
}

// desenha um mapa em (x0, y0)
function mapa(g, linhas, x0, y0) {
  linhas.forEach((linha, y) => {
    ;[...linha].forEach((ch, x) => {
      const cor = PALETA[ch]
      if (!cor || ch === '.') return
      g.fillStyle = cor
      g.fillRect(x0 + x, y0 + y, 1, 1)
    })
  })
}

const icone = (tipo) => () => {
  const linhas = PECAS[tipo]
  const [c, g] = tela(Math.max(...linhas.map((l) => l.length)), linhas.length)
  mapa(g, linhas, 0, 0)
  return c
}

export const GERADORES_KING = {
  'king-p-peao': icone('peao'),
  'king-p-torre': icone('torre'),
  'king-p-bispo': icone('bispo'),
  'king-p-cavalo': icone('cavalo'),
  'king-p-rainha': icone('rainha'),
}
