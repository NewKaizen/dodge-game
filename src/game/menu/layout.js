// Onde cada peça do menu inicial fica (coordenadas do jogo, 854x480) e o pulso
// da música. Menu.js monta as peças: sala.js (o quarto), telao.js (o caos na
// tela da parede) e logo.js (o título); a lista de opções é do próprio Menu.
// A MESA DE CARTAS (mesa.js, o menu padrão; a SALA DE TV é a outra opção) troca a
// sala e o telão pela ilustração da turma jogando cartas: o logo e as opções caem
// no lugar delas lá.
//
// Profundidades: sala 0-9 · telão 10-19 · logo 20-29 · opções e avisos 30+
export const BATIDA = 468 // ms (~128 bpm)
export const TELA = { x: 404, y: 52, largura: 410, altura: 200 } // o telão na parede (área de dentro, sem a moldura)
export const LOGO = { x: 34, y: 30, largura: 250, altura: 170 } // canto de cima à esquerda
export const OPCOES = { x: 86, y: 268, passo: 28 } // lista alinhada à esquerda (até 7 linhas: JOGAR RÁPIDO e PERFIL entram onde há conta)
// na MESA DE CARTAS: o logo maior (cobre o da ilustração) e as opções onde ela as pintou
export const LOGO_MESA = { x: 49, y: 19, largura: 250, altura: 170, escala: 1.24 }
export const OPCOES_MESA = { x: 50, y: 262, passo: 29 } // 7 linhas cabem no escuro à esquerda da mesa (a arte não pinta nada ali)
// A turma sentada no tapete, de costas, assistindo (x = centro, y = base do
// sprite, escondida na almofada). Bate com TURMA de scripts/menu/sala.py.
export const TURMA = [
  { id: 'berdly', x: 432, y: 452 },
  { id: 'ralsei', x: 492, y: 442 },
  { id: 'kris', x: 552, y: 452 },
  { id: 'noelle', x: 612, y: 442 },
  { id: 'susie', x: 672, y: 452 },
  { id: 'dess', x: 732, y: 442 },
  { id: 'asriel', x: 792, y: 452 },
]
