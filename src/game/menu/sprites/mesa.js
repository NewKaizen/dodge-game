// GERADO por scripts/menu/mesa.py (não edite à mão: rode o script de novo)
// Sprites e posições da MESA DE CARTAS (menu inicial alternativo), carregados pela Boot.
//   imagens: [{ chave, arquivo }]
//   DADOS_MESA: posições em px de jogo (854x480)
//     tela        a tela do telão na ilustração (onde a luta passa ao vivo)
//     cabecas     [{ id, chave, x, y, largura, altura, jeito, olhos?: { chave, dx, dy }, raiva?: { ... } }]
//     exclamacao  o "!!" da Susie · cartaSuper: a carta que ela bate na mesa
//     brilhos     os ✦ em volta da Noelle · luzes: lâmpadas e velas (cintilam)
const PASTA = 'assets/sprites/menu/mesa'

export default {
  imagens: [
    { chave: 'menu-mesa-fundo', arquivo: `${PASTA}/fundo.png` },
    { chave: 'menu-mesa-cabeca-kris', arquivo: `${PASTA}/cabeca-kris.png` },
    { chave: 'menu-mesa-cabeca-ralsei', arquivo: `${PASTA}/cabeca-ralsei.png` },
    { chave: 'menu-mesa-cabeca-susie', arquivo: `${PASTA}/cabeca-susie.png` },
    { chave: 'menu-mesa-cabeca-noelle', arquivo: `${PASTA}/cabeca-noelle.png` },
    { chave: 'menu-mesa-cabeca-berdly', arquivo: `${PASTA}/cabeca-berdly.png` },
    { chave: 'menu-mesa-cabeca-asriel', arquivo: `${PASTA}/cabeca-asriel.png` },
    { chave: 'menu-mesa-cabeca-dess', arquivo: `${PASTA}/cabeca-dess.png` },
    { chave: 'menu-mesa-exclamacao', arquivo: `${PASTA}/exclamacao.png` },
    { chave: 'menu-mesa-olhos-ralsei', arquivo: `${PASTA}/olhos-ralsei.png` },
    { chave: 'menu-mesa-olhos-asriel', arquivo: `${PASTA}/olhos-asriel.png` },
    { chave: 'menu-mesa-raiva', arquivo: `${PASTA}/raiva.png` },
  ],
  sons: [],
}

export const DADOS_MESA = {"cabecas": [{"id": "kris", "chave": "menu-mesa-cabeca-kris", "x": 222, "y": 230, "largura": 90, "altura": 76, "jeito": "cabeca"}, {"id": "ralsei", "chave": "menu-mesa-cabeca-ralsei", "x": 336, "y": 182, "largura": 78, "altura": 76, "jeito": "balanco", "olhos": {"chave": "menu-mesa-olhos-ralsei", "dx": 32, "dy": 46}}, {"id": "susie", "chave": "menu-mesa-cabeca-susie", "x": 412, "y": 136, "largura": 150, "altura": 96, "jeito": "headbang"}, {"id": "noelle", "chave": "menu-mesa-cabeca-noelle", "x": 576, "y": 192, "largura": 102, "altura": 66, "jeito": "timida"}, {"id": "berdly", "chave": "menu-mesa-cabeca-berdly", "x": 746, "y": 194, "largura": 68, "altura": 72, "jeito": "pulo", "raiva": {"chave": "menu-mesa-raiva", "dx": 42, "dy": 36, "largura": 16, "altura": 18}}, {"id": "asriel", "chave": "menu-mesa-cabeca-asriel", "x": 700, "y": 294, "largura": 102, "altura": 70, "jeito": "saltinho", "olhos": {"chave": "menu-mesa-olhos-asriel", "dx": 20, "dy": 40}}, {"id": "dess", "chave": "menu-mesa-cabeca-dess", "x": 322, "y": 308, "largura": 140, "altura": 108, "jeito": "roqueira"}], "brilhos": [{"x": 583, "y": 214}, {"x": 574, "y": 228}, {"x": 678, "y": 211}, {"x": 675, "y": 232}, {"x": 568, "y": 248}, {"x": 683, "y": 194}], "luzes": [{"x": 529, "y": 1, "tamanho": 4}, {"x": 402, "y": 8, "tamanho": 1}, {"x": 428, "y": 18, "tamanho": 1}, {"x": 432, "y": 20, "tamanho": 1}, {"x": 460, "y": 28, "tamanho": 4}, {"x": 816, "y": 41, "tamanho": 4}, {"x": 745, "y": 89, "tamanho": 4}, {"x": 450, "y": 131, "tamanho": 2}, {"x": 444, "y": 134, "tamanho": 1}, {"x": 448, "y": 136, "tamanho": 1}, {"x": 759, "y": 175, "tamanho": 2}, {"x": 758, "y": 180, "tamanho": 1}, {"x": 758, "y": 187, "tamanho": 2}, {"x": 55, "y": 195, "tamanho": 3}, {"x": 742, "y": 194, "tamanho": 1}, {"x": 72, "y": 198, "tamanho": 1}, {"x": 76, "y": 200, "tamanho": 1}, {"x": 73, "y": 204, "tamanho": 2}, {"x": 678, "y": 208, "tamanho": 1}, {"x": 32, "y": 213, "tamanho": 2}, {"x": 676, "y": 212, "tamanho": 1}, {"x": 264, "y": 220, "tamanho": 1}, {"x": 573, "y": 225, "tamanho": 2}, {"x": 572, "y": 229, "tamanho": 3}, {"x": 676, "y": 232, "tamanho": 1}], "exclamacao": {"chave": "menu-mesa-exclamacao", "x": 550, "y": 150, "largura": 22, "altura": 30}, "tela": {"x": 497, "y": 21, "largura": 228, "altura": 141}, "cartaSuper": {"x": 506, "y": 309}}
