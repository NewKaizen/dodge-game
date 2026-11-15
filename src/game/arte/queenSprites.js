// Os sprites da Queen na EXPEDIÇÃO (pixel art desenhada por código, arte original): os ROBOZINHOS e POP-UPS
// (lacaios) e O FIREWALL (tenente). Entram em arte/texturas.js (GERADORES) pela chave `queen-lacaios` e
// `queen-firewall`. As funções só tocam no canvas quando o Boot chama (no Node, importar não faz nada).

const ROBO = [
  '.....g......',
  '.....g......',
  '..hhhhhhhh..',
  '.hhhhhhhhhh.',
  '.hvvhhhhvvh.',
  '.hvvhhhhvvh.',
  '.hhhhmmhhhh.',
  '..hhhhhhhh..',
  '...bbbbbb...',
  '.aabbbbbbaa.',
  '.aabbccbbaa.',
  '..a.bbbb.a..',
  '....l..l....',
  '...ll..ll...',
]

const POPUP = [
  'kkkkkkkkkkkkkk',
  'ktttttttttttxk',
  'kkkkkkkkkkkkkk',
  'kwwwwwwwwwwwwk',
  'kwppppppppppwk',
  'kwwwwwwwwwwwwk',
  'kwppppppwwwwwk',
  'kwwwwwwwwwwwwk',
  'kwwwbbbbbbwwwk',
  'kwwwbbbbbbwwwk',
  'kkkkkkkkkkkkkk',
]

const FIREWALL = [
  '.....y.......y.....y....',
  '....yoy.....yoy...yoy...',
  '...yooy..y..yooy.yooy...',
  '...yooyyyoyyyooyyyooy...',
  '..yooooooooooooooooooy..',
  '..kkkkkkkkkkkkkkkkkkkk..',
  '.kRRrrRRrrRRrrRRrrRRrrk.',
  '.kRRrrRRrrRRrrRRrrRRrrk.',
  '.kmmmmmmmmmmmmmmmmmmmmk.',
  '.krrRRrrRRrrRRrrRRrrRRk.',
  '.kRRrrkkkkkkkkkkkkrrRRk.',
  '.kmmmmkeeekkkkeeekmmmmk.',
  '.krrRRkeeekkkkeeekRRrrk.',
  '.kRRrrkkkkwkwkwkkkrrRRk.',
  '.kmmmmmmmmmmmmmmmmmmmmk.',
  '.krrRRrrRRrrRRrrRRrrRRk.',
  '.kRRrrRRrrRRrrRRrrRRrrk.',
  '.kmmmmmmmmmmmmmmmmmmmmk.',
  '.krrRRrrRRrrRRrrRRrrRRk.',
  '.kRRrrRRrrRRrrRRrrRRrrk.',
  '.kmmmmmmmmmmmmmmmmmmmmk.',
  '.krrRRrrRRrrRRrrRRrrRRk.',
  '.kRRrrRRrrRRrrRRrrRRrrk.',
  '.kkkkkkkkkkkkkkkkkkkkkk.',
  '..kkk..............kkk..',
]

const PALETA_ROBO = (cabeca, corpo) => ({ g: '#ffffff', h: cabeca, v: '#101a30', m: '#ff3fb4', b: corpo, a: '#d8e0ff', c: '#ffe14a', l: '#2a2a3a' })
const PALETA_POPUP = { k: '#10102a', t: '#ff4fc8', x: '#ffffff', w: '#f4f4ff', p: '#40f0ff', b: '#ffe14a' }
const PALETA_FIREWALL = { y: '#ffe14a', o: '#ff8a1c', k: '#1a1018', R: '#8f2a22', r: '#c2382b', m: '#3a2a30', e: '#40f0ff', w: '#ffffff' }

function carimbar(g, mapa, paleta, x0, y0) {
  mapa.forEach((linha, y) => {
    ;[...linha].forEach((ch, x) => {
      const cor = paleta[ch]
      if (!cor) return
      g.fillStyle = cor
      g.fillRect(x0 + x, y0 + y, 1, 1)
    })
  })
}

function tela(largura, altura) {
  const c = document.createElement('canvas')
  c.width = largura
  c.height = altura
  const g = c.getContext('2d')
  g.imageSmoothingEnabled = false
  return [c, g]
}

// os lacaios: dois robozinhos (ciano e rosa) com um pop-up no meio
function lacaios() {
  const [c, g] = tela(42, 18)
  carimbar(g, ROBO, PALETA_ROBO('#40f0ff', '#2a7f9f'), 0, 4)
  carimbar(g, POPUP, PALETA_POPUP, 14, 0)
  carimbar(g, ROBO, PALETA_ROBO('#ff7ad0', '#9f2a7f'), 30, 4)
  return c
}

function firewall() {
  const [c, g] = tela(24, FIREWALL.length)
  carimbar(g, FIREWALL, PALETA_FIREWALL, 0, 0)
  return c
}

export const TEXTURAS_QUEEN = {
  'queen-lacaios': lacaios,
  'queen-firewall': firewall,
}
