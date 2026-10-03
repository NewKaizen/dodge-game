// Sprites e sons do SUPER de Noelle (carregados pela Boot)
//   imagens: [{ chave, arquivo, quadro?: { largura, altura } }]   (quadro = spritesheet)
//   sons:    [{ nome, arquivo }]   -> tocar(cena, nome)
// Gerados por scripts/super/noelle.py
const PASTA = 'assets/sprites/super/noelle'
const SONS = 'assets/audio/super/noelle'

export default {
  imagens: [
    { chave: 'super-noelle-carta', arquivo: `${PASTA}/carta.png` },
    { chave: 'super-noelle-placa', arquivo: `${PASTA}/placa.png`, quadro: { largura: 28, altura: 28 } },
    { chave: 'super-noelle-rachadura', arquivo: `${PASTA}/rachadura.png` },
    { chave: 'super-noelle-buraco', arquivo: `${PASTA}/buraco.png` },
    { chave: 'super-noelle-pingente', arquivo: `${PASTA}/pingente.png` },
    { chave: 'super-noelle-impacto', arquivo: `${PASTA}/impacto.png` },
    { chave: 'super-noelle-feixe', arquivo: `${PASTA}/feixe.png` },
  ],
  sons: [
    { nome: 'super-noelle-tique', arquivo: `${SONS}/tique.wav` },
    { nome: 'super-noelle-quebra', arquivo: `${SONS}/quebra.wav` },
    { nome: 'super-noelle-vento', arquivo: `${SONS}/vento.wav` },
    { nome: 'super-noelle-estilhaco', arquivo: `${SONS}/estilhaco.wav` },
  ],
}
