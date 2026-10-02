// Pixel art desenhada em código: cada linha é uma fileira de pixels e cada
// letra é uma cor da paleta ('.' = transparente). Sprites feitos pela equipe de
// design da Kagome (personagens jogáveis, 16x24). Chefes e caminhonete: versão original.

export const SPRITES = {
  kris: {
    paleta: {
      h: '#30314f', H: '#45425f', s: '#77c4df', S: '#4b8fab',
      p: '#ec95bd', P: '#b9578e', a: '#c3d5e8', A: '#7e9cb9',
      b: '#466599', B: '#2d416e', k: '#202333',
    },
    mapa: [
      '................',
      '.....HHHHHH.....',
      '....HHhhhhHH....',
      '...HHhhhhhhhH...',
      '...HHhhhhhhhh...',
      '..HhhhhhhhhhH...',
      '..HhhhhhhhhhH...',
      '..hhSSSSSSSSh...',
      '...hssssssssh...',
      '....sssSSss.....',
      '....pppppppp....',
      '...PppppppppP...',
      '...AaappppaaA...',
      '..AAaabbbaaAA...',
      '..sAabbbbbaAs...',
      '..ssabbbbaass...',
      '...bbaaaaabb....',
      '....bbbbbbbb....',
      '....BBB..BBB....',
      '....bbb..bbb....',
      '....aaa..aaa....',
      '....AAA..AAA....',
      '...kkkk..kkkk...',
      '................',
    ],
  },

  susie: {
    paleta: {
      h: '#713758', H: '#a84a80', s: '#bd80cc', S: '#8f5faa',
      k: '#28253f', w: '#fff1d5', j: '#413451', J: '#604369',
      g: '#e5c166', b: '#4a4263', B: '#302c47',
    },
    mapa: [
      '.....HHHHHH.....',
      '....HHhhhhHH....',
      '...HHhhhhhhhh...',
      '..Hhhhhhhhhhh...',
      '..HHhhhhhhhhhh..',
      '..Hhhhhhhhhhhh..',
      '.Hhhsssssssshh..',
      '.HhssSsssssshh..',
      '.Hhsswwwwsshhh..',
      '..Hhhsssssshhh..',
      '..Hhh.ssss.hhh..',
      '...JjjjjjjjjJ...',
      '..JJjjjssjjjJJ..',
      '..sJjjjssjjjJs..',
      '..ssjggjjggjss..',
      '..ssjjjjjjjjss..',
      '...jjggggggjj...',
      '...bbbbbbbbbb...',
      '...bbbb..bbbb...',
      '...Bbbb..bbbB...',
      '...Bbbb..bbbB...',
      '...gggg..gggg...',
      '..kkkkk..kkkkk..',
      '................',
    ],
  },

  ralsei: {
    paleta: {
      g: '#61cf88', G: '#32966d', k: '#202333',
      w: '#faf2e9', p: '#ee94ba', P: '#bc568d',
    },
    mapa: [
      '.......gg.....',
      '......gggg....',
      '.....gggggg...',
      '....gggggggg..',
      '...gggggggggg.',
      '.GGGGGGGGGGGGG.',
      '...kkkkkkkkkk...',
      '..wkkggkkggkkw..',
      '..wwkgwggwgkww..',
      '...kkkppppkkk...',
      '.....kkkkkk.....',
      '....pppppppp....',
      '...gGpppppGgg...',
      '..ggggppgggggg..',
      '.wgggggpggggggw.',
      '.wwgggkkkggggww.',
      '...ggkkkkkggg...',
      '...gggkkkgggg...',
      '..gggggkgggggg..',
      '..gggggggggggg..',
      '.GGGgggggggGGGG.',
      '....kkk..kkk....',
      '...kkkk..kkkk...',
      '................',
    ],
  },

  noelle: {
    paleta: {
      a: '#ae7049', A: '#784735', h: '#f5d67c', H: '#ce9d4e',
      s: '#f1cca3', S: '#cd9478', k: '#48364c', w: '#fff8ed',
      W: '#c9d3e0', b: '#996354',
    },
    mapa: [
      '...a........a...',
      '..aa.a....a.aa..',
      '...aaa....aaa...',
      '....a.hhhh.a....',
      '....hhhhhhhh....',
      '...hhHhhhhHhh...',
      '..sshhsssshhss..',
      '...shsksskshs...',
      '...hhsssssshh...',
      '...hhssSSsshh...',
      '...hhhsssshhh...',
      '...hHwwwwwwHh...',
      '..hHwWwwwwWwHh..',
      '..hsswwwwwwssh..',
      '...sswwwwwwss...',
      '....wWwwwwWw....',
      '...wwWwwwwWww...',
      '...wwwwwwwwww...',
      '..wwWwwwwwwWww..',
      '..WWWWWWWWWWWW..',
      '.....ss..ss.....',
      '.....ss..ss.....',
      '....bbb..bbb....',
      '................',
    ],
  },

  berdly: {
    paleta: {
      b: '#459ce4', B: '#2869ad', c: '#a8ddf0', k: '#23304c',
      w: '#edf7ff', y: '#f5c956', Y: '#c18c36', a: '#75c8db',
      A: '#417f9f', p: '#293951',
    },
    mapa: [
      '......bb..b.....',
      '.....bbbbbb.....',
      '....bbbbbbbb....',
      '...bbbbbbbbbb...',
      '...bbccbbbbbb...',
      '...bkkkkkkkkb...',
      '...bkwbkkwbkb...',
      '...bbkkbbkkbb...',
      '....bbyyyyyyy...',
      '....bbYYYYyy....',
      '.....bbbbbb.....',
      '...AAaacaaAA....',
      '..AAaaacaaaAA...',
      '.bAAaaacaaaAAb..',
      '.bbAaaacaaaAbb..',
      '.bbAaaacaaaAbb..',
      '...AAaaaaaAA....',
      '....ppyyyppp....',
      '....pppppppp....',
      '....ppp..ppp....',
      '....AAA..AAA....',
      '....aaa..aaa....',
      '...yyyy..yyyy...',
      '................',
    ],
  },

  dess: {
    paleta: {
      a: '#b17c55', h: '#513548', H: '#32263c', s: '#d9ab87',
      S: '#b67e65', k: '#241f32', r: '#bc526b', R: '#7c3655',
      w: '#f8e3c0', p: '#364154', b: '#624459',
    },
    mapa: [
      '..a..........a..',
      '..aa.a....a.aa..',
      '...aaa....aaa...',
      '....a......a....',
      '....hhhhhhhh....',
      '...hhhhhhhhhh...',
      '..sshHhhhhHhss..',
      '...shhsssshhs...',
      '...hhsksskshh...',
      '...hhsssssshh...',
      '...hhssSSsshh...',
      '...HhhsssshhH...',
      '...rrrwwwwrrr...',
      '..rrRrwwwwrRrr..',
      '..srRrwwwwrRrs..',
      '..ssRrwwwwrRss..',
      '....RRppppRR....',
      '....pppppppp....',
      '....ppp..ppp....',
      '....ppp..ppp....',
      '....ppp..ppp....',
      '....bbb..bbb....',
      '...bbbb..bbbb...',
      '................',
    ],
  },

  asriel: {
    paleta: {
      w: '#faf4e9', W: '#c8c3bf', h: '#eac48a', p: '#e69ba9',
      k: '#363144', g: '#70b866', G: '#45814f', y: '#eddf80',
      b: '#45506a', B: '#29354a',
    },
    mapa: [
      '.....h....h.....',
      '.....hwwwwh.....',
      '....wwwwwwww....',
      '...wwwwwwwwww...',
      '..wwwwwwwwwwww..',
      '.wwpwwwwwwwwpww.',
      '.wwpwwkwwkwwpww.',
      '..wwwwwwwwwwww..',
      '....wwwppwww....',
      '....wwwwwwww....',
      '.....WWwwWW.....',
      '....gggggggg....',
      '...gggggggggg...',
      '..gggggggggggg..',
      '..wGyyyyyyyyGw..',
      '..wGyyyyyyyyGw..',
      '..wwggggggggww..',
      '....GGGGGGGG....',
      '....bbbbbbbb....',
      '....bbb..bbb....',
      '....bbb..bbb....',
      '....WWW..WWW....',
      '...wwww..wwww...',
      '................',
    ],
  },

  coronel: {
    paleta: {
      h: '#d9b36a',
      H: '#9c7a3a',
      b: '#6b2a1a',
      s: '#e8b48a',
      k: '#3a1a10',
      o: '#20242e',
      g: '#e0e0e0',
      r: '#c8323a',
      R: '#7e1c24',
      j: '#3a5fa8',
      J: '#26407a',
      m: '#c8ccd8',
      w: '#8a5a2e',
      t: '#5a3a20',
    },
    mapa: [
      '...................m.m.m',
      '......hhhhhh.......m.m.m',
      '.....hhhhhhhh......m.m.m',
      '.....hbbbbbbh......mmmmm',
      '..hhhhhhhhhhhhhh.....w..',
      '.HHHHHHHHHHHHHHHH....w..',
      '....ssssssssss.......w..',
      '....soooosoooos......w..',
      '....ssssssssss.......w..',
      '...gggggggggggg......w..',
      '.....ssskksss........w..',
      '......ssssss.........w..',
      '...rrrrRrrrRrrrr.....w..',
      '..rrrrrRrrrRrrrrr....w..',
      '.rrjjrrRrrrRrrjjrr...w..',
      '.rrjjRRRRRRRRRjjrrr.sws.',
      '.rrjjjjjjjjjjjjjrrr.sws.',
      '.ssjjjjjjjjjjjjjrr..sws.',
      '...jjjjjmmjjjjjj.....w..',
      '...jjjjjjjjjjjjj.....w..',
      '...jjjjjjjjjjjjj.....w..',
      '...JjjjjjjjjjjjJ.....w..',
      '...jjjjjj..jjjjjj....w..',
      '...Jjjjjj..jjjjjJ....w..',
      '...Jjjjjj..jjjjjJ....w..',
      '...Jjjjjj..jjjjjJ....w..',
      '...Jjjjjj..jjjjjJ....w..',
      '...Jjjjjj..jjjjjJ....w..',
      '..tttttt...tttttt....w..',
      '..ttttttt..ttttttt...w..',
      '........................',
      '........................',
    ],
  },

  king: {
    paleta: {
      y: '#ffd23c',
      Y: '#b8860b',
      k: '#120a1e',
      f: '#e8e0f0',
      e: '#ff3040',
      c: '#3a1f66',
      C: '#5a3a99',
      r: '#1f1236',
      w: '#f0f0ff',
      s: '#c0c0d0',
    },
    mapa: [
      '........y..y..y.........',
      '........yy.yy.yy........',
      '........yyyyyyyy........',
      '........yYyYyYyy........',
      '.......ffffffffff.......',
      '.......ffeffffeff.......',
      '.......ffffffffff.......',
      '.......ffkkkkkkff.......',
      '........ffffffff........',
      '......wwwwwwwwwwww......',
      '.....cwwwwwwwwwwwwc.....',
      '....ccCrrrrrrrrrrCcc....',
      '...cccCrrrrrrrrrrCccc...',
      'yyccccCrrryyyyrrrCcccc..',
      '.sccccCrrrrrrrrrrCcccc..',
      '.fcccCCrrrrrrrrrrCCcccf.',
      '.scccCCrrrrrrrrrrCCccc..',
      '.scccCCrrrrrrrrrrCCccc..',
      '.sccccCrrrrrrrrrrCcccc..',
      '.sccccCrrrrrrrrrrCcccc..',
      '.scccccrrrrrrrrrrccccc..',
      '.scccccrrrrrrrrrrccccc..',
      '.sccccccrrrrrrrrcccccc..',
      '.sccccccrrrrrrrrcccccc..',
      '.scccccccrrrrrrccccccc..',
      '.scccccccrrrrrrccccccc..',
      '..ccccccckkkkkkccccccc..',
      '..cccccccckkkkcccccccc..',
      '...cccccccc..cccccccc...',
      '...ccccccc....ccccccc...',
      '....kkkkk......kkkkk....',
      '........................',
    ],
  },

  queen: {
    paleta: {
      h: '#2a2a3a',
      f: '#f0f0f0',
      v: '#00e5ff',
      d: '#e8e8ff',
      D: '#9aa0c8',
      m: '#ff3fb4',
      c: '#00e5ff',
    },
    mapa: [
      '..........hhhh..........',
      '.........hhhhhh.........',
      '........hhhhhhhh........',
      '........hhhhhhhh........',
      '.......hhhhhhhhhh.......',
      '.......hffffffffh.......',
      '.......hvvvvvvvvh.......',
      '.......hvvvvvvvvh.......',
      '.......hffffffffh.......',
      '........ffmmmmff........',
      '.........ffffff.........',
      '......mmmddddddmmm......',
      '.....mmddddddddddmm.....',
      '....fmmddddccddddmmf....',
      '....f.dddddccddddd.f....',
      '....f.dddddccddddd.f....',
      '.....ddddddccdddddd.....',
      '.....DdddddccdddddD.....',
      '....DDddddmmmmddddDD....',
      '...DdddddddccdddddddD...',
      '...DDddddddccddddddDD...',
      '..DDdddddddccdddddddDD..',
      '..DDdddddddccdddddddDD..',
      '..DDDddddddccddddddDDD..',
      '.DDDdddddddccdddddddDDD.',
      '.DDDdddddddccdddddddDDD.',
      '.DDDDddddddccddddddDDDD.',
      'DDDDDddddddccddddddDDDDD',
      'DDDDDDDDDDDDDDDDDDDDDDDD',
      'cccccccccccccccccccccccc',
      '........................',
      '........................',
    ],
  },

  jevil: {
    paleta: {
      p: '#7b3fd0',
      b: '#3f6fe0',
      y: '#ffe04a',
      w: '#f4f4f4',
      k: '#14101e',
      e: '#ffd400',
      r: '#ff4050',
      t: '#ffffff',
      g: '#ffc040',
    },
    mapa: [
      '..g..................g..',
      '..pp................yy..',
      '...ppp............yyy...',
      '....pppp........yyyy....',
      '.....ppppp....yyyyy.....',
      '......ppppppyyyyyy......',
      '.......pppppyyyyy.......',
      '........wwwwwwww........',
      '.......wwwwwwwwww.......',
      '.......wwkewwkeww.......',
      '.......wwwwwwwwww.......',
      '.......wkttttttkw.......',
      '........wkkkkkkw........',
      '.....rrrrrrrrrrrrrr.....',
      '....rrwrrwrrwrrwrrwr....',
      '......ppppppbbbbbb......',
      '.....pppppppbbbbbbb.....',
      '....wpppppppbbbbbbbw....',
      '....wpppppppbbbbbbbw....',
      '.....pppppppbbbbbbb.....',
      '.....ppppyyyyyybbbb.....',
      '.....pppppppbbbbbbb.....',
      '......ppppp..bbbbb......',
      '......ppppp..bbbbb......',
      '......ppppp..bbbbb......',
      '......ppppp..bbbbb......',
      '.....yyyyyy..yyyyyy.....',
      '....yyyy........yyyy....',
      '........................',
      '........................',
      '........................',
      '........................',
    ],
  },

  caminhonete: {
    paleta: {
      c: '#d8342c',
      C: '#8e1a16',
      g: '#9fd8ff',
      h: '#f2cf5a',
      H: '#c09a2a',
      k: '#141414',
      m: '#b0b0b0',
      y: '#fff27a',
      l: '#ff4040',
      b: '#707070',
    },
    mapa: [
      '................................',
      '................................',
      '..................cccccc........',
      '.....hhhhhhhhh...cggggggc.......',
      '.....hHhhhHhhhh.cgggggggc.......',
      '.....hhhhhhhhhhccggggggggc......',
      '....cCCCCCCCCCCccccccccccccc....',
      '....lccccccccccccCcccccccccy....',
      '....cccccccccccccCcccccccccy....',
      '....bcccccccccccccccccccccbb....',
      '....CCCkkkkCCCCCCCCCCkkkkCCb....',
      '.......kmmk..........kmmk.......',
      '.......kkkk..........kkkk.......',
      '................................',
      '................................',
      '................................',
    ],
  },
}

// Coração do jogador (branco; o jogo pinta com a cor de cada jogador)
export const CORACAO_MAPA = [
  '..##...##..',
  '.####.####.',
  '###########',
  '###########',
  '###########',
  '.#########.',
  '..#######..',
  '...#####...',
  '....###....',
  '.....#.....',
]

// Coluna da rachadura do coração em cada linha (tela de game over)
export const RACHADURA = [5, 5, 4, 5, 6, 5, 4, 5, 5, 5]

// Ícones dos comandos (12x12, brancos)
export const ICONES = {
  fight: [
    '..........##',
    '.........###',
    '........###.',
    '.......###..',
    '......###...',
    '.#...###....',
    '.##.###.....',
    '..####......',
    '...##.......',
    '..####......',
    '.##..##.....',
    '##....#.....',
  ],
  act: [
    '............',
    '.##########.',
    '#..........#',
    '#.##....##.#',
    '#..........#',
    '#..#....#..#',
    '#...####...#',
    '#..........#',
    '.##########.',
    '...##.......',
    '..##........',
    '............',
  ],
  magic: [
    '.....##.....',
    '.....##.....',
    '....####....',
    '############',
    '.##########.',
    '..########..',
    '...######...',
    '..###..###..',
    '..##....##..',
    '.##......##.',
    '............',
    '............',
  ],
  item: [
    '....####....',
    '....#..#....',
    '.....##.....',
    '....#..#....',
    '...#....#...',
    '..#......#..',
    '..#.####.#..',
    '..#.####.#..',
    '..#.####.#..',
    '..#......#..',
    '...######...',
    '............',
  ],
  spare: [
    '##........##',
    '###......###',
    '.###....###.',
    '..###..###..',
    '...######...',
    '....####....',
    '....####....',
    '...######...',
    '..###..###..',
    '.###....###.',
    '###......###',
    '##........##',
  ],
  defend: [
    '.##########.',
    '#..........#',
    '#.########.#',
    '#.########.#',
    '#.########.#',
    '#.########.#',
    '.#.######.#.',
    '.#.######.#.',
    '..#.####.#..',
    '...#.##.#...',
    '....#..#....',
    '.....##.....',
  ],
}

// ---------- boneco genérico (placeholder) ----------
//
// Manequim neutro, igual para todos os personagens sem arte própria: só muda a
// cor e a inicial no peito. Não representa ninguém de propósito; troque pelo
// seu PNG em assets.js (ver public/assets/sprites/LEIA-ME.txt).
//   boneco(cor, letra)       -> { mapa, paleta } de 17x24 (mesma altura de kris/susie)
//   iconeBoneco(cor, letra)  -> { mapa, paleta } de 11x11 (cabeça com a inicial)
// cor é um número 0xRRGGBB (o mesmo `cor` de personagens.js).

// Letras 3x5 para a inicial
const LETRAS = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
}

// 0xRRGGBB -> '#rrggbb' com o brilho multiplicado por f
function tom(cor, f) {
  const canal = (d) => Math.min(255, Math.round(((cor >> d) & 0xff) * f))
  return '#' + [16, 8, 0].map((d) => canal(d).toString(16).padStart(2, '0')).join('')
}

// Letra escura em cor clara, branca em cor escura
function corDaLetra(cor) {
  const luz = 0.299 * ((cor >> 16) & 0xff) + 0.587 * ((cor >> 8) & 0xff) + 0.114 * (cor & 0xff)
  return luz > 150 ? '#1a1a2e' : '#ffffff'
}

// Monta o mapa a partir de uma função (x, y) -> 'c' | 'C' | null e põe o
// contorno 'o' em volta de tudo que foi preenchido
function contornar(largura, altura, preencher) {
  const grade = Array.from({ length: altura }, (_, y) => Array.from({ length: largura }, (_, x) => preencher(x, y) ?? '.'))
  const cheio = (x, y) => grade[y]?.[x] !== undefined && grade[y][x] !== '.' && grade[y][x] !== 'o'
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      if (grade[y][x] !== '.') continue
      if (cheio(x - 1, y) || cheio(x + 1, y) || cheio(x, y - 1) || cheio(x, y + 1)) grade[y][x] = 'o'
    }
  }
  return grade
}

function carimbarLetra(grade, letra, x0, y0) {
  const desenho = LETRAS[String(letra).toUpperCase()] ?? LETRAS['?']
  desenho.forEach((linha, dy) => [...linha].forEach((ch, dx) => ch === '#' && (grade[y0 + dy][x0 + dx] = 'l')))
}

function paletaBoneco(cor) {
  return { c: tom(cor, 1), C: tom(cor, 0.72), o: tom(cor, 0.38), l: corDaLetra(cor) }
}

export function boneco(cor, letra) {
  const dentro = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1
  const grade = contornar(17, 24, (x, y) => {
    if ((x - 8) ** 2 + (y - 4) ** 2 <= 3.5 ** 2) return 'c' // cabeça
    if (dentro(x, y, 7, 8, 9, 8)) return 'C' // pescoço
    if (dentro(x, y, 4, 9, 12, 16) && !((x === 4 || x === 12) && y === 9)) return 'c' // tronco (ombros arredondados)
    if (dentro(x, y, 2, 10, 3, 16) || dentro(x, y, 13, 10, 14, 16)) return 'C' // braços
    if (dentro(x, y, 5, 17, 7, 21) || dentro(x, y, 9, 17, 11, 21)) return 'C' // pernas
    if (dentro(x, y, 4, 22, 7, 22) || dentro(x, y, 9, 22, 12, 22)) return 'c' // pés
    return null
  })
  carimbarLetra(grade, letra, 7, 11)
  return { mapa: grade.map((l) => l.join('')), paleta: paletaBoneco(cor) }
}

export function iconeBoneco(cor, letra) {
  const grade = contornar(11, 11, (x, y) => ((x - 5) ** 2 + (y - 5) ** 2 <= 4.6 ** 2 ? 'c' : null))
  carimbarLetra(grade, letra, 4, 3)
  return { mapa: grade.map((l) => l.join('')), paleta: paletaBoneco(cor) }
}
