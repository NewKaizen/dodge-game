// Sprites e sons do SUPER de Ralsei (carregados pela Boot)
//   imagens: [{ chave, arquivo, quadro?: { largura, altura } }]   (quadro = spritesheet)
//   sons:    [{ nome, arquivo }]   -> tocar(cena, nome)
// Gerados por scripts/super/ralsei.py
const PASTA = 'assets/sprites/super/ralsei'
const SONS = 'assets/audio/super/ralsei'

export default {
  imagens: [
    { chave: 'super-ralsei-carta', arquivo: `${PASTA}/carta.png` },
    { chave: 'super-ralsei-pagina', arquivo: `${PASTA}/pagina.png` },
    { chave: 'super-ralsei-chama', arquivo: `${PASTA}/chama.png`, quadro: { largura: 16, altura: 16 } },
    { chave: 'super-ralsei-asa', arquivo: `${PASTA}/asa.png` },
    { chave: 'super-ralsei-espinho', arquivo: `${PASTA}/espinho.png`, quadro: { largura: 14, altura: 30 } },
    { chave: 'super-ralsei-lamina-fogo', arquivo: `${PASTA}/lamina-fogo.png` },
    { chave: 'super-ralsei-sombra-dragao', arquivo: `${PASTA}/sombra-dragao.png` },
  ],
  sons: [
    { nome: 'super-ralsei-pagina', arquivo: `${SONS}/pagina.wav` },
    { nome: 'super-ralsei-sopro', arquivo: `${SONS}/sopro.wav` },
    { nome: 'super-ralsei-espinho', arquivo: `${SONS}/espinho.wav` },
    { nome: 'super-ralsei-dragao', arquivo: `${SONS}/dragao.wav` },
  ],
}
