// Sprites e sons do SUPER de Kris (carregados pela Boot)
//   imagens: [{ chave, arquivo, quadro?: { largura, altura } }]   (quadro = spritesheet)
//   sons:    [{ nome, arquivo }]   -> tocar(cena, nome)
// Gerados por scripts/super/kris.py
const PASTA = 'assets/sprites/super/kris'
const SONS = 'assets/audio/super/kris'

export default {
  imagens: [
    { chave: 'super-kris-carta', arquivo: `${PASTA}/carta.png` },
    { chave: 'super-kris-lamina', arquivo: `${PASTA}/lamina.png` },
    { chave: 'super-kris-espada', arquivo: `${PASTA}/espada.png` },
    { chave: 'super-kris-impacto', arquivo: `${PASTA}/impacto.png` },
    { chave: 'super-kris-pecas', arquivo: `${PASTA}/pecas.png`, quadro: { largura: 24, altura: 28 } },
    { chave: 'super-kris-casa', arquivo: `${PASTA}/casa.png`, quadro: { largura: 16, altura: 16 } },
    { chave: 'super-kris-eco', arquivo: `${PASTA}/eco.png`, quadro: { largura: 16, altura: 16 } },
    { chave: 'super-kris-espada-eco', arquivo: `${PASTA}/espada-eco.png` },
    { chave: 'super-kris-corte', arquivo: `${PASTA}/corte.png` },
  ],
  sons: [
    { nome: 'super-kris-pulso', arquivo: `${SONS}/pulso.wav` },
    { nome: 'super-kris-crava', arquivo: `${SONS}/crava.wav` },
    { nome: 'super-kris-corte', arquivo: `${SONS}/corte.wav` },
    { nome: 'super-kris-tique', arquivo: `${SONS}/tique.wav` },
  ],
}
