// Os sprites (pixel art desenhada em código, originais) da Expedição do Jevil: os LACAIOS (um grupo de cartas
// vivas e um palhacinho, em UMA imagem) e o MESTRE DE PICADEIRO (o tenente). Entram na tabela de geradores de
// texturas.js (uma textura por chave, na escala ESCALA.chefe).
function tela(largura, altura) {
  const c = document.createElement('canvas')
  c.width = largura
  c.height = altura
  const g = c.getContext('2d')
  g.imageSmoothingEnabled = false
  const px = (x, y, w, h, cor) => {
    g.fillStyle = cor
    g.fillRect(x, y, w, h)
  }
  return [c, px]
}

// um mapa de pixels ('.' = vazio) no canto (x0, y0)
function mapa(px, x0, y0, linhas, paleta) {
  linhas.forEach((l, y) => [...l].forEach((ch, x) => paleta[ch] && px(x0 + x, y0 + y, 1, 1, paleta[ch])))
}

// o naipe grande no meio da carta viva (10 x 18, com o rostinho e as perninhas)
const SINAIS = {
  copas: ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
  espadas: ['...k...', '..kkk..', '.kkkkk.', 'kkkkkkk', '.kk.kk.', '...k...'],
}

function desenharCarta(px, x0, y0, naipe) {
  const paleta = { o: '#1c1033', w: '#faf6ff', p: '#7b3fd0', r: '#e8344f', k: '#2a2347', e: '#14101e', b: '#ff8aa6' }
  const base = [
    'oooooooooo',
    'owwwwwwwwo',
    'owwwwwwwwo',
    'owwwwwwwwo',
    'owwwwwwwwo',
    'owwwwwwwwo',
    'owwwwwwwwo',
    'owwwwwwwwo',
    'owwwwwwwwo',
    'owwwwwwwwo',
    'owwwwwwwwo',
    'owwwwwwwwo',
    'owwwwwwwwo',
    'oooooooooo',
    '.oo....oo.',
    '.pp....pp.',
    '.pp....pp.',
    'ppp....ppp',
  ]
  mapa(px, x0, y0, base, paleta)
  const cor = naipe === 'copas' ? paleta.r : paleta.k
  const sinal = SINAIS[naipe]
  sinal.forEach((l, y) => [...l].forEach((ch, x) => ch !== '.' && px(x0 + 1 + x + 0.5 - 0.5, y0 + 2 + y, 1, 1, cor)))
  // olhinhos de bravo
  px(x0 + 2, y0 + 10, 2, 2, paleta.e)
  px(x0 + 6, y0 + 10, 2, 2, paleta.e)
  px(x0 + 2, y0 + 9, 3, 1, paleta.e)
  px(x0 + 5, y0 + 9, 3, 1, paleta.e)
}

// o palhacinho (12 x 20): chapéu de bico, nariz vermelho, roupa listrada
const PALHACO = [
  '.....y......',
  '....ypy.....',
  '...ypppy....',
  '..yppppppy..',
  '..wwwwwwww..',
  '.wwkwwwwkww.',
  '.wwwwrrwwww.',
  '..wwkkkkww..',
  '...rrrrrr...',
  '..rwrwrwrr..',
  '.wrbbbbbbrw.',
  '.wrbbbbbbrw.',
  '..rbbbbbbr..',
  '...rwrwrw...',
  '...bb..bb...',
  '...bb..bb...',
  '..yyy..yyy..',
  '.yyyy..yyyy.',
]
const PALETA_PALHACO = { y: '#ffe04a', p: '#7b3fd0', w: '#f4f0ff', k: '#14101e', r: '#ff4050', b: '#3f6fe0' }

// o Mestre de Picadeiro (24 x 32): cartola, bigode, casaca vermelha e o chicote
const MESTRE = [
  '........kkkkkkkkkk......',
  '........kkkkkkkkkk......',
  '........kkkkkkkkkk......',
  '........kkkkkkkkkk......',
  '........rrrrrrrrrr......',
  '........kkkkkkkkkk......',
  '.....kkkkkkkkkkkkkkkk...',
  '.....kkkkkkkkkkkkkkkk...',
  '........wwwwwwwwww......',
  '.......wwwwwwwwwwww.....',
  '.......wwkwwwwwwkww.....',
  '.......wwwwwwwwwwww.....',
  '.......wwkkkkkkkkww.....',
  '........wwkwwwwkw.......',
  '........wwwwwwwww.......',
  '......rrrgrrrrrgrrr.....',
  '.....rrrrrgrrrrgrrrr....',
  '....wrrrrrgrrrrgrrrrw...',
  '....wrrrrrgrrrrgrrrrw...',
  '...wwrrrrrgrrrrgrrrrww..',
  '...wwrrrrrrrrrrrrrrrww..',
  '....wrrrrrgrrrrgrrrr.h..',
  '.....rrrrrrrrrrrrrr..h..',
  '.....kkkkkkkkkkkkkk..h..',
  '.....kkkkk....kkkkk..h..',
  '.....kkkkk....kkkkk.hh..',
  '.....kkkkk....kkkkk.h...',
  '.....kkkkk....kkkkk.h...',
  '....kkkkkk....kkkkkkh...',
  '...ggggggg....ggggggh...',
  '........................',
  '........................',
]
const PALETA_MESTRE = { k: '#1a1228', r: '#d8342c', g: '#ffc040', w: '#f4f0ff', h: '#a8742c' }

export const GERADORES_JEVIL = {
  // os lacaios: duas cartas vivas e um palhacinho (um grupo de 3, uma imagem só)
  'jevil-lacaios': () => {
    const [c, px] = tela(44, 22)
    desenharCarta(px, 1, 3, 'espadas')
    mapa(px, 16, 2, PALHACO, PALETA_PALHACO)
    desenharCarta(px, 33, 3, 'copas')
    return c
  },
  'jevil-mestre': () => {
    const [c, px] = tela(24, 32)
    mapa(px, 0, 0, MESTRE, PALETA_MESTRE)
    return c
  },
}
