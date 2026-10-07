// Onde cada peça do menu inicial fica (coordenadas do jogo, 640x480) e o pulso
// da música. Menu.js monta as peças: sala.js (o quarto), telao.js (o caos na
// tela da parede) e logo.js (o título); a lista de opções é do próprio Menu.
//
// Profundidades: sala 0-9 · telão 10-19 · logo 20-29 · opções e avisos 30+
export const BATIDA = 468 // ms (~128 bpm)
export const TELA = { x: 300, y: 46, largura: 310, altura: 196 } // o telão na parede (área de dentro, sem a moldura)
export const LOGO = { x: 34, y: 30, largura: 250, altura: 170 } // canto de cima à esquerda
export const OPCOES = { x: 58, y: 290, passo: 36 } // lista alinhada à esquerda
export const PES = 452 // y dos pés das silhuetas
