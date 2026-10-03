// Sprites e sons do SUPER de Susie, "Demolição Total" (carregados pela Boot)
// Gerados por scripts/super/susie.py
//   imagens: [{ chave, arquivo, quadro?: { largura, altura } }]   (quadro = spritesheet)
//   sons:    [{ nome, arquivo }]   -> tocar(cena, nome)
const PASTA = 'assets/sprites/super/susie'
const SONS = 'assets/audio/super/susie'

export default {
  imagens: [
    { chave: 'super-susie-carta', arquivo: `${PASTA}/carta.png` },
    { chave: 'super-susie-machado', arquivo: `${PASTA}/machado.png` },
    { chave: 'super-susie-laje', arquivo: `${PASTA}/laje.png` },
    { chave: 'super-susie-racha', arquivo: `${PASTA}/racha.png` },
    { chave: 'super-susie-buraco', arquivo: `${PASTA}/buraco.png` },
    { chave: 'super-susie-impacto', arquivo: `${PASTA}/impacto.png` },
    { chave: 'super-susie-pedra', arquivo: `${PASTA}/pedra.png`, quadro: { largura: 12, altura: 12 } },
    { chave: 'super-susie-buster', arquivo: `${PASTA}/buster.png`, quadro: { largura: 40, altura: 112 } },
    { chave: 'super-susie-tijolo', arquivo: `${PASTA}/tijolo.png`, quadro: { largura: 32, altura: 16 } },
  ],
  sons: [
    { nome: 'super-susie-pancada', arquivo: `${SONS}/pancada.wav` },
    { nome: 'super-susie-desaba', arquivo: `${SONS}/desaba.wav` },
    { nome: 'super-susie-buster', arquivo: `${SONS}/buster.wav` },
    { nome: 'super-susie-muro', arquivo: `${SONS}/muro.wav` },
  ],
}
