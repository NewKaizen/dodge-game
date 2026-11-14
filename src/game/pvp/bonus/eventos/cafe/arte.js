import { texturaCanvas } from '../../../../arte/pixelCanvas.js'

// Sprites desenhados na grade, com contorno de um pixel e três tons por material.
// As dimensões/chaves continuam as mesmas: coleta, colisão e animações não mudam.
const PALETA = { k: 0x352b3c, b: 0x975748, o: 0xf3a44d, y: 0xffdf88, w: 0xffead0, s: 0xa5d4d1, t: 0x28b5a5, p: 0xff71b6, P: 0xb83e85 }
const PRATOS = {
  croissant: [
    '......kkkkkk......',
    '....kkoyyyyokk....',
    '...koyyoyyoyyok...',
    '..koyyboyyboyyok..',
    '.koyybbyyybbyyok.',
    '.koybokkkkobyyok.',
    'koybok....kobyoyk',
    'kook........kook',
    '.kk..........kk.',
  ],
  baguete: [
    '................kk..',
    '..............kkwyk.',
    '............kkwyyok.',
    '..........kkwboyyok.',
    '........kkwyyboook..',
    '......kkwboyyyokk...',
    '....kkwyyboookk.....',
    '..kkwboyyyokk.......',
    '.kwyyboookk.........',
    '.kyyyookk...........',
    '..kkkkk.............',
  ],
  queijo: [
    '..kkk...........',
    '..kwykkk........',
    '..kwyyywkkk.....',
    '..kwyyoyyywkkk..',
    '..kwyyyyoyyyywk.',
    '..kyyyyyyyyyyok.',
    '..kyoyyyoyyoyok.',
    '..kyyyyyyyyyook.',
    '..kooooooooobok.',
    '..kkkkkkkkkkkkk.',
  ],
  sopa: [
    '.....s....s.....',
    '....s....s......',
    '.....s....s.....',
    '................',
    '..kkkkkkkkkkkk..',
    '.kswoyyyoyyywsk.',
    'kswoyywyyoyyowsk',
    'kwwsssssssssswwk',
    '.kwwwwwwwwwwssk.',
    '.kswwwwwwwwsssk.',
    '..kswwwwwwsssk..',
    '...kssssssssk...',
    '....kkkkkkkk....',
  ],
  macaron: [
    '....kkkkkkkk....',
    '..kkppwwppppkk..',
    '.kpppwwppppppPk.',
    '.kppppppppppPPk.',
    'kPPPPPPPPPPPPPPk',
    'kwwwwwwwwwwwwwwk',
    '.kwwwwwwwwwwwsk.',
    'kppppppppppppPPk',
    '.kppppppppppPPk.',
    '..kkPPPPPPPPkk..',
    '....kkkkkkkk....',
  ],
}
const XICARA = [
  '....kkkkkkkk....',
  '...kwoooooowk...',
  '...kwobbboowkkk.',
  '...kwwwwwwwwkswk',
  '...kwwwwwwsskkwk',
  '...kwtttttssk.k.',
  '....kwwwwssk.k..',
  '....kssssssk....',
  '..kkwkkkkkkwkk..',
  '.kwwwwwwwwwwssk.',
  '..kksssssssskk..',
  '....kkkkkkkk....',
]
function pintar(px, mapa, largura, altura) {
  const w = Math.max(...mapa.map(l => l.length))
  const ox = Math.floor((largura - w) / 2), oy = Math.floor((altura - mapa.length) / 2)
  mapa.forEach((linha, y) => [...linha].forEach((ch, x) => {
    if (PALETA[ch] !== undefined) px(ox + x, oy + y, 1, 1, PALETA[ch])
  }))
}
export function texturasDoMenu(scene) {
  for (const [id, mapa] of Object.entries(PRATOS)) {
    // Sprites de comida ocupam 2 px por ponto no atlas de 32 px.
    texturaCanvas(scene, `cafe-prato-${id}`, 32, 32, (ctx, px) => {
      const escala = Math.min(2, 30 / Math.max(...mapa.map(l => l.length)))
      pintar((x, y, w, h, c) => px(x * escala, y * escala, Math.ceil(w * escala), Math.ceil(h * escala), c), mapa, 32 / escala, 32 / escala)
    })
  }
  texturaCanvas(scene, 'cafe-xicara', 20, 20, (ctx, px) => pintar(px, XICARA, 20, 20))
}
