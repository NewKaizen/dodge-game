// Sprites e sons das cartas de kris (carregados pela Boot)
//   imagens: [{ chave, arquivo, quadro?: { largura, altura } }]   (quadro = spritesheet)
//   sons:    [{ nome, arquivo }]   -> tocar(cena, nome)
// Chaves com o prefixo 'hab-kris-'. Gerados por scripts/habilidades/kris.py
const PASTA = 'assets/sprites/habilidades/kris'
const SONS = 'assets/audio/habilidades/kris'

export default {
  imagens: [
    { chave: 'hab-kris-espada', arquivo: `${PASTA}/espada.png` },
    { chave: 'hab-kris-florete', arquivo: `${PASTA}/florete.png` },
    { chave: 'hab-kris-olho', arquivo: `${PASTA}/olho.png`, quadro: { largura: 26, altura: 16 } },
    { chave: 'hab-kris-clarao', arquivo: `${PASTA}/clarao.png` },
    { chave: 'hab-kris-brilho', arquivo: `${PASTA}/brilho.png` },
    { chave: 'hab-kris-pegada', arquivo: `${PASTA}/pegada.png` },
    { chave: 'hab-kris-pisada', arquivo: `${PASTA}/pisada.png` },
    { chave: 'hab-kris-peao', arquivo: `${PASTA}/peao.png` },
    { chave: 'hab-kris-seta', arquivo: `${PASTA}/seta.png` },
    { chave: 'hab-kris-alma', arquivo: `${PASTA}/alma.png`, quadro: { largura: 24, altura: 22 } },
    { chave: 'hab-kris-caco', arquivo: `${PASTA}/caco.png` },
    { chave: 'hab-kris-placa', arquivo: `${PASTA}/placa.png`, quadro: { largura: 24, altura: 24 } },
  ],
  sons: [
    { nome: 'hab-kris-corte', arquivo: `${SONS}/corte.wav` },
    { nome: 'hab-kris-estoque', arquivo: `${SONS}/estoque.wav` },
    { nome: 'hab-kris-passo', arquivo: `${SONS}/passo.wav` },
    { nome: 'hab-kris-olhar', arquivo: `${SONS}/olhar.wav` },
    { nome: 'hab-kris-pulso', arquivo: `${SONS}/pulso.wav` },
    { nome: 'hab-kris-clique', arquivo: `${SONS}/clique.wav` },
    { nome: 'hab-kris-espinhos', arquivo: `${SONS}/espinhos.wav` },
  ],
}
