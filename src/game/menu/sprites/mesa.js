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

export const DADOS_MESA = {"arte": {"largura": 1672, "altura": 941, "escala": 0.5107655502392344}, "olhos": [{"id": "ralsei", "chave": "menu-mesa-olhos-ralsei", "x": 724, "y": 450}, {"id": "asriel", "chave": "menu-mesa-olhos-asriel", "x": 1410, "y": 654}, {"id": "berdly", "chave": "menu-mesa-olhos-berdly", "x": 1446, "y": 472}], "luzes": [{"x": 530.1, "y": 1.8, "tamanho": 2.1}, {"x": 700.0, "y": 1.9, "tamanho": 2.3}, {"x": 404.3, "y": 10.9, "tamanho": 2.7}, {"x": 493.7, "y": 11.7, "tamanho": 1.2}, {"x": 431.3, "y": 18.8, "tamanho": 2.8}, {"x": 461.1, "y": 28.1, "tamanho": 2.9}, {"x": 816.6, "y": 41.6, "tamanho": 3.0}, {"x": 744.8, "y": 90.2, "tamanho": 2.5}, {"x": 429.4, "y": 106.7, "tamanho": 0.9}, {"x": 407.5, "y": 109.5, "tamanho": 1.5}, {"x": 388.7, "y": 112.8, "tamanho": 1.1}, {"x": 421.5, "y": 116.1, "tamanho": 1.8}, {"x": 404.8, "y": 116.5, "tamanho": 0.6}, {"x": 447.8, "y": 122.9, "tamanho": 2.0}, {"x": 449.5, "y": 132.6, "tamanho": 3.2}, {"x": 431.5, "y": 134.3, "tamanho": 0.9}, {"x": 555.7, "y": 165.7, "tamanho": 2.2}, {"x": 567.1, "y": 165.4, "tamanho": 2.1}, {"x": 769.2, "y": 168.8, "tamanho": 0.6}, {"x": 553.6, "y": 172.4, "tamanho": 0.6}, {"x": 429.9, "y": 174.9, "tamanho": 2.7}, {"x": 560.5, "y": 175.8, "tamanho": 1.2}, {"x": 758.8, "y": 185.1, "tamanho": 3.1}, {"x": 56.0, "y": 195.3, "tamanho": 2.0}, {"x": 743.9, "y": 194.9, "tamanho": 2.3}, {"x": 74.1, "y": 201.7, "tamanho": 2.8}, {"x": 296.3, "y": 210.2, "tamanho": 1.1}, {"x": 34.2, "y": 214.3, "tamanho": 1.9}, {"x": 261.4, "y": 215.1, "tamanho": 1.0}, {"x": 298.6, "y": 225.1, "tamanho": 4.0}, {"x": 265.7, "y": 221.6, "tamanho": 1.7}, {"x": 296.0, "y": 236.3, "tamanho": 1.9}], "frente": {"chave": "menu-mesa-frente", "x": 968, "y": 265}, "raiva": {"chave": "menu-mesa-raiva", "x": 1544, "y": 449}, "exclamacao": {"chave": "menu-mesa-exclamacao", "x": 1079, "y": 293}, "tela": {"x": 497.5, "y": 20.9, "largura": 227.3, "altura": 141.0}, "cartaSuper": {"x": 505.7, "y": 309.0}, "brilhos": [{"x": 583.3, "y": 214.5}, {"x": 574.1, "y": 228.3}, {"x": 677.8, "y": 210.9}, {"x": 675.2, "y": 232.4}, {"x": 568.0, "y": 248.7}, {"x": 683.4, "y": 194.1}]}
