// Sprites e sons do SUPER de Asriel (carregados pela Boot)
//   imagens: [{ chave, arquivo, quadro?: { largura, altura } }]   (quadro = spritesheet)
//   sons:    [{ nome, arquivo }]   -> tocar(cena, nome)
// Gerados por scripts/super/asriel.py
const PASTA = 'assets/sprites/super/asriel'
const SONS = 'assets/audio/super/asriel'

export default {
  imagens: [
    { chave: 'super-asriel-carta', arquivo: `${PASTA}/carta.png` },
    { chave: 'super-asriel-buraco', arquivo: `${PASTA}/buraco.png`, quadro: { largura: 64, altura: 64 } },
    { chave: 'super-asriel-estrelas', arquivo: `${PASTA}/estrelas.png`, quadro: { largura: 16, altura: 16 } },
    { chave: 'super-asriel-no', arquivo: `${PASTA}/no.png`, quadro: { largura: 16, altura: 16 } },
    { chave: 'super-asriel-nova', arquivo: `${PASTA}/nova.png` },
  ],
  sons: [
    { nome: 'super-asriel-pulso', arquivo: `${SONS}/pulso.wav` },
    { nome: 'super-asriel-colapso', arquivo: `${SONS}/colapso.wav` },
    { nome: 'super-asriel-estoura', arquivo: `${SONS}/estoura.wav` },
  ],
}
