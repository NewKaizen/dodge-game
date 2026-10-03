// Sprites e sons das cartas de dess (carregados pela Boot)
//   imagens: [{ chave, arquivo, quadro?: { largura, altura } }]   (quadro = spritesheet)
//   sons:    [{ nome, arquivo }]   -> tocar(cena, nome)
// Chaves com o prefixo 'hab-dess-'. Gerados por scripts/habilidades/dess.py
const PASTA = 'assets/sprites/habilidades/dess'
const SONS = 'assets/audio/habilidades/dess'

const IMAGENS = ['nota', 'notas', 'guitarra', 'taco', 'bola', 'impacto', 'microfone', 'chiado', 'palheta', 'caixasom', 'pulso', 'lata', 'fumaca', 'brasa', 'amp', 'arco', 'cabo', 'plugue']
const SONS_DESS = ['tacada', 'rebatida', 'microfonia', 'palheta', 'fumaca', 'grave']

export default {
  imagens: IMAGENS.map((n) => ({ chave: `hab-dess-${n}`, arquivo: `${PASTA}/${n}.png` })),
  sons: SONS_DESS.map((n) => ({ nome: `hab-dess-${n}`, arquivo: `${SONS}/${n}.wav` })),
}
