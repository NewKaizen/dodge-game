// Texturas da arena JARDIM (fundo backgrounds/arenas/jardim.js e os bônus da
// arena em pvp/bonus/eventos/): pixel art desenhada em código, gerada UMA vez
// por jogo (texturasJardim confere scene.textures.exists antes de desenhar).
//
//   jardim-flor-0..5   flores de canteiro (origem embaixo: o caule é a base)
//   jardim-girassol    girassol alto (origem embaixo)
//   jardim-borboleta   asas brancas (pintar com setTint; o corpo é preto)
//   jardim-abelha      abelha virada para a direita, colorida
//   jardim-folha       folha clara (pintar: verde, amarela, laranja)
//   jardim-petala      pétala branca (pintar)
//   jardim-brilho      círculo branco com borda suave (luz, brilho, vaga-lume)
//   jardim-vazio       2x2 transparente (bala invisível: o visual é do evento)

const FLORES = [
  // margarida, tulipa, rosinha, amarela, lavanda, azul
  { p: '#fff6e8', P: '#e6d2c0', c: '#ffc83a', cabeca: 'flor' },
  { p: '#ff4a5a', P: '#c42a46', c: '#ff8a8a', cabeca: 'tulipa' },
  { p: '#ff9ad2', P: '#d8609e', c: '#fff0a0', cabeca: 'estrela' },
  { p: '#ffd84a', P: '#e09a2a', c: '#8a4a1a', cabeca: 'flor' },
  { p: '#b88aff', P: '#7a52d0', c: '#e0c8ff', cabeca: 'lavanda' },
  { p: '#6ac8ff', P: '#3a7ad8', c: '#ffffff', cabeca: 'estrela' },
]

const CABECAS = {
  flor: ['..ppp..', '.pPpPp.', 'ppcccpp', 'pPcccPp', 'ppcccpp', '.pPpPp.', '..ppp..'],
  estrela: ['...p...', '..ppp..', 'ppPcPpp', '.pcccp.', '..pPp..', '.pp.pp.', '.p...p.'],
  tulipa: ['.p.p.p.', '.ppppp.', '.ppPpp.', '.pPcPp.', '.pPPPp.', '..ppp..', '...g...'],
  lavanda: ['...p...', '..pPp..', '...c...', '..pPp..', '...c...', '..pPp..', '...p...'],
}
const CAULE = ['...g...', '...g...', '.G.g...', '.GGg...', '...gGG.', '...gG..', '...g...', '...g...']
const VERDES = { g: '#3f8a3a', G: '#5fb04a' }

const GIRASSOL = [
  '....y.y....',
  '..yyyyyyy..',
  '.yyYYYYYyy.',
  '.yYbbbbbYy.',
  'yyYbBbBbYyy',
  '.yYbbBbbYy.',
  'yyYbBbBbYyy',
  '.yYbbbbbYy.',
  '.yyYYYYYyy.',
  '..yyyyyyy..',
  '....ygy....',
  '.....g.....',
  '.....g.GG..',
  '.....gGGGG.',
  '.....g.GG..',
  '.....g.....',
  '.....g.....',
  '..GG.g.....',
  '.GGGGg.....',
  '..GG.g.....',
  '.....g.....',
  '.....g.....',
  '.....g.GG..',
  '.....gGGGG.',
  '.....g.GG..',
  '.....g.....',
  '.....g.....',
  '.....g.....',
]

const BORBOLETA = ['WW.....WW', 'WwW...WwW', 'WwwWkWwwW', '.WwwkwwW.', '..WwkwW..', '.WwW.WwW.', '.WW...WW.']

const ABELHA = ['....ww.ww..', '....wWwWw..', '..yykyykyy.', 'kyykyykyyey', '..yykyykyy.']

const FOLHA = ['....ll.', '..lLLll', '.lLlLl.', 'lLll...', 'l......']

const PETALA = ['pp.', 'ppp', '.pp']

function tela(largura, altura) {
  const c = document.createElement('canvas')
  c.width = largura
  c.height = altura
  const g = c.getContext('2d')
  g.imageSmoothingEnabled = false
  return [c, g]
}

function pixelArt(mapa, paleta) {
  const largura = Math.max(...mapa.map((l) => l.length))
  const [c, g] = tela(largura, mapa.length)
  mapa.forEach((linha, y) => {
    ;[...linha].forEach((ch, x) => {
      const cor = paleta[ch]
      if (!cor) return
      g.fillStyle = cor
      g.fillRect(x, y, 1, 1)
    })
  })
  return c
}

function brilho(n = 64) {
  const [c, g] = tela(n, n)
  const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.75)')
  grad.addColorStop(0.7, 'rgba(255,255,255,0.22)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, n, n)
  return c
}

const GERADORES = {
  'jardim-girassol': () => pixelArt(GIRASSOL, { y: '#ffd23a', Y: '#f09a1a', b: '#6a3a1a', B: '#3a1e0e', ...VERDES }),
  'jardim-borboleta': () => pixelArt(BORBOLETA, { W: '#b8b8c8', w: '#ffffff', k: '#1a1020' }),
  'jardim-abelha': () => pixelArt(ABELHA, { y: '#ffd23a', k: '#2a1a10', w: '#e8f6ff', W: '#a8c8e8', e: '#000000' }),
  'jardim-folha': () => pixelArt(FOLHA, { l: '#ffffff', L: '#b4b4b4' }),
  'jardim-petala': () => pixelArt(PETALA, { p: '#ffffff' }),
  'jardim-brilho': () => brilho(),
  'jardim-vazio': () => tela(2, 2)[0],
}
FLORES.forEach((f, i) => {
  GERADORES[`jardim-flor-${i}`] = () => pixelArt([...CABECAS[f.cabeca], ...CAULE], { p: f.p, P: f.P, c: f.c, ...VERDES })
})

export const NUM_FLORES = FLORES.length

export function texturasJardim(scene) {
  for (const [chave, gerar] of Object.entries(GERADORES)) if (!scene.textures.exists(chave)) scene.textures.addCanvas(chave, gerar())
}
