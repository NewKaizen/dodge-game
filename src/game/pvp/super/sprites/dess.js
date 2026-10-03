// Sprites e sons do SUPER de Dess (carregados pela Boot)
//   imagens: [{ chave, arquivo, quadro?: { largura, altura } }]   (quadro = spritesheet)
//   sons:    [{ nome, arquivo }]   -> tocar(cena, nome)
// Gerados por scripts/super/dess.py
const PASTA = 'assets/sprites/super/dess'
const SONS = 'assets/audio/super/dess'

export default {
  imagens: [
    { chave: 'super-dess-carta', arquivo: `${PASTA}/carta.png` },
    { chave: 'super-dess-guitarra', arquivo: `${PASTA}/guitarra.png` },
    { chave: 'super-dess-traste', arquivo: `${PASTA}/traste.png`, quadro: { largura: 16, altura: 32 } },
    { chave: 'super-dess-nota', arquivo: `${PASTA}/nota.png` },
    { chave: 'super-dess-impacto', arquivo: `${PASTA}/impacto.png` },
  ],
  sons: [
    { nome: 'super-dess-tique', arquivo: `${SONS}/tique.wav` },
    { nome: 'super-dess-acorde', arquivo: `${SONS}/acorde.wav` },
    { nome: 'super-dess-mergulho', arquivo: `${SONS}/mergulho.wav` },
    { nome: 'super-dess-estouro', arquivo: `${SONS}/estouro.wav` },
  ],
}
