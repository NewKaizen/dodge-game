// GERADO por scripts/menu/mesa.py (não edite à mão: rode o script de novo)
// Sprites e posições da MESA DE CARTAS (menu inicial), carregados pela Boot.
//   imagens: [{ chave, arquivo }]
//   DADOS_MESA
//     arte        tamanho da ilustração e a escala dela no jogo (px da ilustração -> px de jogo)
//     olhos, frente, raiva, exclamacao   pedaços por cima do fundo: x, y em px DA ILUSTRAÇÃO
//     tela        a tela do telão (onde a luta passa ao vivo), em px de jogo
//     cartaSuper, brilhos (✦ em volta da Noelle), luzes (lâmpadas e velas): px de jogo
const PASTA = 'assets/sprites/menu/mesa'

export default {
  imagens: [
    { chave: 'menu-mesa-fundo', arquivo: `${PASTA}/fundo.webp` },
    { chave: 'menu-mesa-frente', arquivo: `${PASTA}/frente.png` },
    { chave: 'menu-mesa-raiva', arquivo: `${PASTA}/raiva.png` },
    { chave: 'menu-mesa-exclamacao', arquivo: `${PASTA}/exclamacao.png` },
    { chave: 'menu-mesa-olhos-ralsei', arquivo: `${PASTA}/olhos-ralsei.png` },
    { chave: 'menu-mesa-olhos-asriel', arquivo: `${PASTA}/olhos-asriel.png` },
    { chave: 'menu-mesa-olhos-berdly', arquivo: `${PASTA}/olhos-berdly.png` },
  ],
  sons: [],
}

export const DADOS_MESA = {"arte": {"largura": 1672, "altura": 941, "escala": 0.5107655502392344}, "olhos": [{"id": "ralsei", "chave": "menu-mesa-olhos-ralsei", "x": 724, "y": 450}, {"id": "asriel", "chave": "menu-mesa-olhos-asriel", "x": 1409, "y": 653}, {"id": "berdly", "chave": "menu-mesa-olhos-berdly", "x": 1446, "y": 473}], "luzes": [{"x": 530.2, "y": 1.8, "tamanho": 2.1}, {"x": 700.1, "y": 2.0, "tamanho": 2.3}, {"x": 404.3, "y": 10.9, "tamanho": 2.7}, {"x": 493.8, "y": 11.8, "tamanho": 1.3}, {"x": 431.3, "y": 18.6, "tamanho": 2.7}, {"x": 461.0, "y": 28.0, "tamanho": 2.8}, {"x": 816.6, "y": 41.8, "tamanho": 3.1}, {"x": 745.0, "y": 90.1, "tamanho": 2.5}, {"x": 394.3, "y": 101.0, "tamanho": 3.5}, {"x": 430.1, "y": 104.8, "tamanho": 2.1}, {"x": 447.4, "y": 122.6, "tamanho": 1.7}, {"x": 450.1, "y": 132.3, "tamanho": 3.0}, {"x": 443.9, "y": 134.4, "tamanho": 0.9}, {"x": 555.9, "y": 165.9, "tamanho": 2.2}, {"x": 567.4, "y": 165.2, "tamanho": 2.1}, {"x": 429.3, "y": 174.3, "tamanho": 2.5}, {"x": 560.5, "y": 175.8, "tamanho": 1.2}, {"x": 758.8, "y": 185.8, "tamanho": 2.6}, {"x": 743.6, "y": 194.9, "tamanho": 2.3}, {"x": 55.9, "y": 195.6, "tamanho": 1.4}, {"x": 73.6, "y": 200.9, "tamanho": 2.2}, {"x": 34.5, "y": 214.9, "tamanho": 2.0}, {"x": 300.1, "y": 224.1, "tamanho": 2.9}, {"x": 187.2, "y": 225.0, "tamanho": 0.9}, {"x": 295.8, "y": 227.3, "tamanho": 2.0}, {"x": 295.0, "y": 236.2, "tamanho": 1.9}], "frente": {"chave": "menu-mesa-frente", "x": 968, "y": 264}, "raiva": {"chave": "menu-mesa-raiva", "x": 1544, "y": 450}, "exclamacao": {"chave": "menu-mesa-exclamacao", "x": 1080, "y": 293}, "tela": {"x": 497.5, "y": 20.9, "largura": 227.3, "altura": 141.0}, "cartaSuper": {"x": 505.7, "y": 309.0}, "brilhos": [{"x": 584.3, "y": 214.5}, {"x": 573.6, "y": 229.3}, {"x": 677.8, "y": 211.5}]}
