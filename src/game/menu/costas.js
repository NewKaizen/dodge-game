import { SPRITES } from '../arte/sprites.js'

// A turma vista de costas, sentada no tapete assistindo o telão (menu inicial).
// Mesmo formato dos sprites da luta (arte/sprites.js): cada linha é uma fileira
// de pixels e cada letra uma cor da paleta do personagem ('.' = transparente).
// 18x22: cabeça (cabelo, chapéu, chifres) em cima e as costas embaixo; a base
// fica escondida pela almofada em que cada um está sentado.
//
//   criarTexturasCostas(cena)   gera as texturas 'costas-<id>' (uma vez por jogo)
//   COSTAS[id].cabeca           quantas linhas, de cima, formam a cabeça (ela balança sozinha)
//
// Paleta: a do sprite de luta (mesmas cores), mais o que só aparece de costas.

export const COSTAS = {
  kris: {
    cabeca: 13,
    mapa: [
      '.......HHHH.......',
      '.....HHhhhhHH.....',
      '....HhhhhhhhhH....',
      '...HhhhhhhhhhhH...',
      '...hhhhHhhhhhhh...',
      '..HhhhhhhhhhHhhH..',
      '..hhhhhhhhhhhhhh..',
      '..hhhHhhhhhhhhhh..',
      '..HhhhhhhhhhhhhH..',
      '..hhhhhhhhhhhhhh..',
      '...hHhhhhhhhhHh...',
      '...h.hhhhhhhh.h...',
      '.....hhhhhhhh.....',
      '....PppppppppP....',
      '...AaaaaaaaaaaA...',
      '..AAaabbbbbbaaAA..',
      '..AaabbbbbbbbaaA..',
      '.sAabbbbbbbbbbaAs.',
      '.ssabbbbbbbbbbass.',
      '.ssbbbbbbbbbbbbss.',
      'BBBBbbbbbbbbbbBBBB',
      'BBBBBBBBBBBBBBBBBB',
    ],
  },
  ralsei: {
    cabeca: 12,
    mapa: [
      '........gg........',
      '.......gggg.......',
      '......gggggg......',
      '.....ggggGggg.....',
      '....gggggggggg....',
      '...gggggggggggg...',
      '.GGGGGGGGGGGGGGGG.',
      '..GGGGGGGGGGGGGG..',
      '...kkkkkkkkkkkk...',
      'ww.kkkkkkkkkkkk.ww',
      '.wwkkkkkkkkkkkkww.',
      '....kkkkkkkkkk....',
      '....pppppppppp....',
      '...PppppppppppP...',
      '...gggggggggggg...',
      '..gggggggggggggg..',
      '..gGggggggggggGg..',
      '.gggggggggggggggg.',
      '.gggggggggggggggg.',
      'wggggggggggggggggw',
      'GGGggggggggggggGGG',
      'GGGGGGGGGGGGGGGGGG',
    ],
  },
  susie: {
    cabeca: 13,
    mapa: [
      '.....HHHHHHH......',
      '...HHhhhhhhhHH....',
      '..HhhhhhhhhhhhH...',
      '..HhhhhhhhhhhhhH..',
      '.HhhhhhHhhhhhhhH..',
      '.HhhhhhhhhhhhhhhH.',
      '.hhhhhhhhhhhHhhhh.',
      '.HhhhhhhhhhhhhhhH.',
      '.hhhhHhhhhhhhhhhh.',
      '.HhhhhhhhhhhhhhhH.',
      '.hhhhhhhhhhhhhhhh.',
      '.HhhhhhhhhhhhhhhH.',
      '..hhHhhhhhhhhHhh..',
      '.JJhhhhhhhhhhhhJJ.',
      '.JJjhhhhhhhhhhjJJ.',
      '.JjjjhHhhhhHhjjjJ.',
      '.JjjjjjhhhhjjjjjJ.',
      'sJjjjjjjjjjjjjjjJs',
      'sJjjjjjjjjjjjjjjJs',
      'ssjjjjjjjjjjjjjjss',
      'bbbbbbbbbbbbbbbbbb',
      'BBBBBBBBBBBBBBBBBB',
    ],
  },
  noelle: {
    cabeca: 13,
    mapa: [
      '..a............a..',
      '..aa.a......a.aa..',
      '...aaa......aaa...',
      '....a.HHHHHH.a....',
      '.....HhhhhhhH.....',
      '....HhhhhhhhhH....',
      '...HhhhhhhhhhhH...',
      '...hhhhhHhhhhhh...',
      '..HhhhhhhhhhhhhH..',
      '..hhhhhhhhhhhhhh..',
      '..hhhhHhhhhhhhhh..',
      '..HhhhhhhhhhhhhH..',
      '...hhhhhhhhhhhh...',
      '...HhwwwwwwwwhH...',
      '...wwwwwwwwwwww...',
      '..wWwwwwwwwwwwWw..',
      '..wwwwwwwwwwwwww..',
      '.swwwwwwwwwwwwwws.',
      '.sWwwwwwwwwwwwwWs.',
      '.wwwwwwwwwwwwwwww.',
      'WWwwwwwwwwwwwwwwWW',
      'WWWWWWWWWWWWWWWWWW',
    ],
  },
  berdly: {
    cabeca: 12,
    mapa: [
      '.......bb..b......',
      '......bbbbbb......',
      '.....bbbbbbbb.....',
      '....bbbbbbbbbb....',
      '...bbbbbBbbbbbb...',
      '...bbbbbbbbbbbb...',
      '...bBbbbbbbbbBb...',
      '...bbbbbbbbbbbb...',
      '....bbbbbbbbbb....',
      '....bBbbbbbbBb....',
      '.....bbbbbbbb.....',
      '......bbbbbb......',
      '....AAAaaaaAAA....',
      '...AAaaaaaaaaAA...',
      '..AAaaaaaaaaaaAA..',
      '.bAAaaaaaaaaaaAAb.',
      '.bbAaaaaaaaaaaAbb.',
      '.bbAaaaaaaaaaaAbb.',
      '..bAaaaaaaaaaaAb..',
      '...AAaaaaaaaaAA...',
      'pppppppppppppppppp',
      'pppppppppppppppppp',
    ],
  },
  dess: {
    cabeca: 13,
    mapa: [
      '..a............a..',
      '..aa.a......a.aa..',
      '...aaa......aaa...',
      '....a.hhhhhh.a....',
      '.....hhhhhhhh.....',
      '....hhhhhhhhhh....',
      '...hhhhhHhhhhhh...',
      '...hhhhhhhhhhhh...',
      '..hhhHhhhhhhhhhh..',
      '..hhhhhhhhhhhhhh..',
      '..hhhhhhhhhHhhhh..',
      '..HhhhhhhhhhhhhH..',
      '..HhhhhhhhhhhhhH..',
      '..rHhhhhhhhhhhHr..',
      '.rrRhhhhhhhhhhRrr.',
      '.rrRrhhhhhhhhrRrr.',
      '.rRrrrHhhhhHrrrRr.',
      'srRrrrrrrrrrrrrRrs',
      'ssRrrrrrrrrrrrrRss',
      'ssrrrrrrrrrrrrrrss',
      'pppppppppppppppppp',
      'pppppppppppppppppp',
    ],
  },
  asriel: {
    cabeca: 12,
    mapa: [
      '.....h......h.....',
      '.....hwwwwwwh.....',
      '....wwwwwwwwww....',
      '...wwwwwwwwwwww...',
      '..wwwwwwwwwwwwww..',
      '.WwwwwwwwwwwwwwwW.',
      'WWwwwwwwwwwwwwwwWW',
      'Ww.wwwwwwwwwwww.wW',
      'W..wwwwwwwwwwww..W',
      '...wwwwwwwwwwww...',
      '....wwwwwwwwww....',
      '.....WwwwwwwW.....',
      '....gggggggggg....',
      '...gggggggggggg...',
      '..gggggggggggggg..',
      '.wGyyyyyyyyyyyyGw.',
      '.wGyyyyyyyyyyyyGw.',
      '.wwggggggggggggww.',
      '.wggggggggggggggw.',
      '..gggggggggggggg..',
      'GGGGGGGGGGGGGGGGGG',
      'bbbbbbbbbbbbbbbbbb',
    ],
  },
}

export const chaveCostas = (id) => `costas-${id}`

// Gera as texturas a partir dos mapas (com a paleta do sprite de luta)
export function criarTexturasCostas(cena) {
  for (const [id, { mapa }] of Object.entries(COSTAS)) {
    const chave = chaveCostas(id)
    if (cena.textures.exists(chave)) continue
    const paleta = SPRITES[id].paleta
    const largura = Math.max(...mapa.map((l) => l.length))
    const tela = cena.textures.createCanvas(chave, largura, mapa.length)
    const g = tela.getContext()
    mapa.forEach((linha, y) =>
      [...linha].forEach((ch, x) => {
        if (!paleta[ch]) return
        g.fillStyle = paleta[ch]
        g.fillRect(x, y, 1, 1)
      }),
    )
    tela.refresh()
  }
}
