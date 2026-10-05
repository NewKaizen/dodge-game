// Sprites e sons das cartas de susie (carregados pela Boot)
//   imagens: [{ chave, arquivo, quadro?: { largura, altura } }]   (quadro = spritesheet)
//   sons:    [{ nome, arquivo }]   -> tocar(cena, nome)
// Chaves com o prefixo 'hab-susie-'. Gerados por scripts/habilidades/susie.py
const PASTA = 'assets/sprites/habilidades/susie'
const SONS = 'assets/audio/habilidades/susie'

export default {
  imagens: [
    // Cabeçada
    { chave: 'hab-susie-calombo', arquivo: `${PASTA}/calombo.png` },
    { chave: 'hab-susie-bonk', arquivo: `${PASTA}/bonk.png` },
    { chave: 'hab-susie-estrela', arquivo: `${PASTA}/estrela.png`, quadro: { largura: 14, altura: 14 } },
    // Pisão
    { chave: 'hab-susie-pilar', arquivo: `${PASTA}/pilar.png`, quadro: { largura: 18, altura: 64 } },
    { chave: 'hab-susie-cascalho', arquivo: `${PASTA}/cascalho.png`, quadro: { largura: 12, altura: 12 } },
    { chave: 'hab-susie-marca', arquivo: `${PASTA}/marca.png` },
    // Giro do Machado
    { chave: 'hab-susie-giro', arquivo: `${PASTA}/giro.png` },
    { chave: 'hab-susie-redemoinho', arquivo: `${PASTA}/redemoinho.png` },
    // Encarar
    { chave: 'hab-susie-raiva', arquivo: `${PASTA}/raiva.png` },
    { chave: 'hab-susie-olhar', arquivo: `${PASTA}/olhar.png` },
    // Rugido
    { chave: 'hab-susie-som', arquivo: `${PASTA}/som.png`, quadro: { largura: 10, altura: 18 } },
    { chave: 'hab-susie-boca', arquivo: `${PASTA}/boca.png` },
    // Bomba de Giz
    { chave: 'hab-susie-bomba', arquivo: `${PASTA}/bomba.png`, quadro: { largura: 22, altura: 22 } },
    { chave: 'hab-susie-giz', arquivo: `${PASTA}/giz.png`, quadro: { largura: 10, altura: 8 } },
    { chave: 'hab-susie-poeira', arquivo: `${PASTA}/poeira.png` },
  ],
  sons: [
    { nome: 'hab-susie-bonk', arquivo: `${SONS}/bonk.wav` },
    { nome: 'hab-susie-pisao', arquivo: `${SONS}/pisao.wav` },
    { nome: 'hab-susie-giro', arquivo: `${SONS}/giro.wav` },
    { nome: 'hab-susie-rugido', arquivo: `${SONS}/rugido.wav` },
    { nome: 'hab-susie-giz', arquivo: `${SONS}/giz.wav` },
  ],
}
