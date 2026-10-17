// Sprites e sons do SUPER de Noelle (carregados pela Boot)
//   imagens: [{ chave, arquivo, quadro?: { largura, altura } }]   (quadro = spritesheet)
//   sons:    [{ nome, arquivo }]   -> tocar(cena, nome)
// Gerados por scripts/super/noelle.py
const PASTA = 'assets/sprites/super/noelle'
const SONS = 'assets/audio/super/noelle'

export default {
  imagens: [
    { chave: 'super-noelle-carta', arquivo: `${PASTA}/carta.png` },
    { chave: 'super-noelle-pingente', arquivo: `${PASTA}/pingente.png` },
    { chave: 'super-noelle-impacto', arquivo: `${PASTA}/impacto.png` },
    { chave: 'super-noelle-pilar', arquivo: `${PASTA}/pilar.png` },
    { chave: 'super-noelle-flocao', arquivo: `${PASTA}/flocao.png` },
    { chave: 'super-noelle-estilhaco', arquivo: `${PASTA}/estilhaco.png` },
  ],
  sons: [
    { nome: 'super-noelle-tique', arquivo: `${SONS}/tique.wav` },
    { nome: 'super-noelle-quebra', arquivo: `${SONS}/quebra.wav` },
    { nome: 'super-noelle-vento', arquivo: `${SONS}/vento.wav` },
    { nome: 'super-noelle-estilhaco', arquivo: `${SONS}/estilhaco.wav` },
    { nome: 'super-noelle-nevasca', arquivo: `${SONS}/nevasca.wav` },
    { nome: 'super-noelle-redemoinho', arquivo: `${SONS}/redemoinho.wav` },
    { nome: 'super-noelle-pilar', arquivo: `${SONS}/pilar.wav` },
    { nome: 'super-noelle-cristal', arquivo: `${SONS}/cristal.wav` },
    { nome: 'super-noelle-implosao', arquivo: `${SONS}/implosao.wav` },
  ],
}
