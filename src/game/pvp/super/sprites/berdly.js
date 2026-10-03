// Sprites e sons do SUPER de Berdly (carregados pela Boot)
//   imagens: [{ chave, arquivo, quadro?: { largura, altura } }]   (quadro = spritesheet)
//   sons:    [{ nome, arquivo }]   -> tocar(cena, nome)
// Gerados por scripts/super/berdly.py
const PASTA = 'assets/sprites/super/berdly'
const SONS = 'assets/audio/super/berdly'

export default {
  imagens: [
    { chave: 'super-berdly-carta', arquivo: `${PASTA}/carta.png` },
    { chave: 'super-berdly-lamina', arquivo: `${PASTA}/lamina.png` },
    { chave: 'super-berdly-pagina', arquivo: `${PASTA}/pagina.png`, quadro: { largura: 14, altura: 14 } },
    { chave: 'super-berdly-impacto', arquivo: `${PASTA}/impacto.png` },
    { chave: 'super-berdly-orbita', arquivo: `${PASTA}/orbita.png`, quadro: { largura: 16, altura: 16 } },
    { chave: 'super-berdly-feixe', arquivo: `${PASTA}/feixe.png` },
  ],
  sons: [
    { nome: 'super-berdly-vento', arquivo: `${SONS}/vento.wav` },
    { nome: 'super-berdly-tique', arquivo: `${SONS}/tique.wav` },
    { nome: 'super-berdly-estalo', arquivo: `${SONS}/estalo.wav` },
    { nome: 'super-berdly-giro', arquivo: `${SONS}/giro.wav` },
  ],
}
