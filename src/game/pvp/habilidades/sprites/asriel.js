// Sprites e sons das cartas de asriel (carregados pela Boot)
//   imagens: [{ chave, arquivo, quadro?: { largura, altura } }]   (quadro = spritesheet)
//   sons:    [{ nome, arquivo }]   -> tocar(cena, nome)
// Chaves com o prefixo 'hab-asriel-'. Gerados por scripts/habilidades/asriel.py
const PASTA = 'assets/sprites/habilidades/asriel'
const SONS = 'assets/audio/habilidades/asriel'

const img = (nome, quadro) => ({ chave: `hab-asriel-${nome}`, arquivo: `${PASTA}/${nome}.png`, ...(quadro ? { quadro: { largura: quadro[0], altura: quadro[1] } } : {}) })
const som = (nome) => ({ nome: `hab-asriel-${nome}`, arquivo: `${SONS}/${nome}.wav` })

export default {
  imagens: [
    img('estrela-grande'),
    img('estrelinhas', [12, 12]),
    img('sabre'),
    img('canhao'),
    img('tiro'),
    img('feixe'),
    img('caveira', [64, 56]),
    img('diamantes', [10, 14]),
    img('raio', [16, 128]),
    img('faisca', [12, 12]),
    img('relogio'),
    img('ponteiro'),
    img('cadente'),
    img('poeira', [8, 8]),
    img('meteoro', [22, 16]),
    img('rochas', [8, 8]),
    img('cratera', [26, 26]),
    img('gigante', [32, 32]),
    img('clarao'),
    img('nebulosa', [14, 14]),
  ],
  sons: ['corte', 'tiro', 'carga', 'trovao', 'tique', 'retomar', 'cadente', 'nova'].map(som),
}
