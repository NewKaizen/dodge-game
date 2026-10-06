// Sprites e sons de sala.js (menu inicial), carregados pela Boot
//   imagens: [{ chave, arquivo, quadro?: { largura, altura } }]   (quadro = spritesheet)
//   sons:    [{ nome, arquivo }]   -> tocar(cena, nome)
// Chaves com o prefixo 'menu-sala-'. Gerados por scripts/menu/sala.py
const PASTA = 'assets/sprites/menu/sala'

export default {
  imagens: [
    { chave: 'menu-sala-fundo', arquivo: `${PASTA}/fundo.png` }, // o quarto na penumbra (640x480)
    { chave: 'menu-sala-luz-parede', arquivo: `${PASTA}/luz-parede.png` }, // o que a luz do telão revela na parede (cinza, ADD)
    { chave: 'menu-sala-luz-chao', arquivo: `${PASTA}/luz-chao.png` }, // o cone de luz no chão (cinza, ADD)
    { chave: 'menu-sala-vinheta', arquivo: `${PASTA}/vinheta.png` }, // escurece cantos, logo e opções
    { chave: 'menu-sala-poeira', arquivo: `${PASTA}/poeira.png` }, // grão de poeira 2x2
  ],
  sons: [],
}
