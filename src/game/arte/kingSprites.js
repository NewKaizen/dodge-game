// Arte do TABULEIRO REAL (Chaos King): as peças de xadrez em pixel art (originais), desenhadas por código.
// Os ícones pequenos (king-p-*) ficam nas casas do quadro; os grandes são o sprite do chefe dos lacaios
// (king-lacaios: a torre e dois peões) e do tenente (king-cavaleiro). texturas.js junta GERADORES_KING.
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
    '..kk........',
    '.kffk.......',
    '.kfffkk.....',
    'kfffffffk...',
    'kfekfffffk..',
    'kffffffffsk.',
    'kkkfffffffsk',
    '..kfffffffsk',
    '...kffffffsk',
    '..kfffffffsk',
    '.kfffffffssk',
    '.kkkkkkkkkkk',
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

// desenha um mapa em (x0, y0) com cada pixel de k x k; `troca` muda cores da paleta (o tenente é roxo)
function mapa(g, linhas, x0, y0, k = 1, troca = {}) {
  linhas.forEach((linha, y) => {
    ;[...linha].forEach((ch, x) => {
      const cor = troca[ch] ?? PALETA[ch]
      if (!cor || ch === '.') return
      g.fillStyle = cor
      g.fillRect(x0 + x * k, y0 + y * k, k, k)
    })
  })
}

const icone = (tipo) => () => {
  const linhas = PECAS[tipo]
  const [c, g] = tela(Math.max(...linhas.map((l) => l.length)), linhas.length)
  mapa(g, linhas, 0, 0)
  return c
}

// A torre grande no meio e dois peões na frente: os LACAIOS do Chaos King
function lacaios() {
  const [c, g] = tela(44, 32)
  mapa(g, PECAS.torre, 11, 6, 2) // 22 x 24, atrás
  mapa(g, PECAS.peao, 0, 18) // 12 x 12, na frente à esquerda
  mapa(g, PECAS.peao, 32, 18) // à direita
  // olhos vermelhos nos três
  g.fillStyle = PALETA.e
  g.fillRect(17, 13, 3, 2)
  g.fillRect(24, 13, 3, 2)
  g.fillRect(4, 22, 1, 1)
  g.fillRect(7, 22, 1, 1)
  g.fillRect(36, 22, 1, 1)
  g.fillRect(39, 22, 1, 1)
  return c
}

// O CAVALEIRO (tenente): a cabeça de cavalo em tamanho de chefe, roxa, com a crina dourada e o olho vermelho
const CAVALEIRO = [
  '..........kk............',
  '.........kffk.yy........',
  '........kfffkyyyy.......',
  '.......kfffffkyyyyk.....',
  '......kfffffffkyyyyk....',
  '.....kfffffffffkyyyk....',
  '....kfffffffffffkyyk....',
  '...kffeekffffffffkyk....',
  '..kfffeekffffffffffk....',
  '.kffffffkfffffffffsk....',
  'kfffffffffffffffffsk....',
  'kffffkkffffffffffssk....',
  'kfffkk.kffffffffffsk....',
  '.kkkk..kfffffffffssk....',
  '.......kffffffffsssk....',
  '......kfffffffffssk.....',
  '.....kffffffffffssk.....',
  '....kfffffffffffssk.....',
  '...kffffffffffffssk.....',
  '..kfffffffffffffssk.....',
  '..kkkkkkkkkkkkkkkkk.....',
]

function cavaleiro() {
  const [c, g] = tela(24, CAVALEIRO.length)
  mapa(g, CAVALEIRO, 0, 0, 1, { f: '#a98be8', s: '#6a4fb0' })
  return c
}

export const GERADORES_KING = {
  'king-p-peao': icone('peao'),
  'king-p-torre': icone('torre'),
  'king-p-bispo': icone('bispo'),
  'king-p-cavalo': icone('cavalo'),
  'king-p-rainha': icone('rainha'),
  'king-lacaios': lacaios,
  'king-cavaleiro': cavaleiro,
}
