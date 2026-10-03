// Sprites e sons das cartas de berdly (carregados pela Boot)
//   imagens: [{ chave, arquivo, quadro?: { largura, altura } }]   (quadro = spritesheet)
//   sons:    [{ nome, arquivo }]   -> tocar(cena, nome)
// Chaves com o prefixo 'hab-berdly-'. Gerados por scripts/habilidades/berdly.py
const PASTA = 'assets/sprites/habilidades/berdly'
const SONS = 'assets/audio/habilidades/berdly'

const img = (nome, quadro) => ({ chave: `hab-berdly-${nome}`, arquivo: `${PASTA}/${nome}.png`, ...(quadro ? { quadro } : {}) })

export default {
  imagens: [
    img('bico'),
    img('marca'),
    img('pena', { largura: 20, altura: 10 }),
    img('plumas'),
    img('mergulho'),
    img('caneta'),
    img('tinta'),
    img('rajada'),
    img('simbolos', { largura: 14, altura: 14 }),
    img('tornado', { largura: 28, altura: 56 }),
    img('detrito', { largura: 10, altura: 10 }),
    img('barra'),
    img('material', { largura: 16, altura: 16 }),
    img('vento'),
    img('seta'),
    img('pena-armada'),
    img('ciclone', { largura: 28, altura: 28 }),
    img('folha', { largura: 12, altura: 12 }),
  ],
  sons: [
    { nome: 'hab-berdly-bicada', arquivo: `${SONS}/bicada.wav` },
    { nome: 'hab-berdly-vento', arquivo: `${SONS}/vento.wav` },
    { nome: 'hab-berdly-caneta', arquivo: `${SONS}/caneta.wav` },
    { nome: 'hab-berdly-calculo', arquivo: `${SONS}/calculo.wav` },
  ],
}
