// Sprites e sons das cartas de noelle (carregados pela Boot)
//   imagens: [{ chave, arquivo, quadro?: { largura, altura } }]   (quadro = spritesheet)
//   sons:    [{ nome, arquivo }]   -> tocar(cena, nome)
// Chaves com o prefixo 'hab-noelle-'. Gerados por scripts/habilidades/noelle.py
const PASTA = 'assets/sprites/habilidades/noelle'
const SONS = 'assets/audio/habilidades/noelle'

const imagem = (nome, quadro) => ({ chave: `hab-noelle-${nome}`, arquivo: `${PASTA}/${nome}.png`, ...(quadro ? { quadro } : {}) })
const som = (nome) => ({ nome: `hab-noelle-${nome}`, arquivo: `${SONS}/${nome}.wav` })

export default {
  imagens: [
    imagem('floco'), // Floco Afiado
    imagem('granizo'), // Granizo
    imagem('lasca'),
    imagem('rajada'), // Vento Gélido
    imagem('vento'),
    imagem('cristal'), // Raio de Gelo
    imagem('feixe'),
    imagem('geada'),
    imagem('eterno', { largura: 14, altura: 14 }), // Inverno Eterno (0 voando, 1 congelado)
    imagem('canto'),
    imagem('pingente'), // Pingentes
    imagem('estalactite'), // Estalactites
    imagem('bola'), // Avalanche
    imagem('monte'),
  ],
  sons: ['floco', 'granizo', 'vento', 'raio', 'congelar', 'estalactite', 'avalanche'].map(som),
}
