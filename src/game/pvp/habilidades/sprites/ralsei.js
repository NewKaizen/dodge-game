// Sprites e sons das cartas de ralsei (carregados pela Boot)
//   imagens: [{ chave, arquivo, quadro?: { largura, altura } }]   (quadro = spritesheet)
//   sons:    [{ nome, arquivo }]   -> tocar(cena, nome)
// Chaves com o prefixo 'hab-ralsei-'. Gerados por scripts/habilidades/ralsei.py
const PASTA = 'assets/sprites/habilidades/ralsei'
const SONS = 'assets/audio/habilidades/ralsei'

export default {
  imagens: [
    { chave: 'hab-ralsei-estrela', arquivo: `${PASTA}/estrela.png`, quadro: { largura: 18, altura: 18 } },
    { chave: 'hab-ralsei-faisca', arquivo: `${PASTA}/faisca.png`, quadro: { largura: 9, altura: 9 } },
    { chave: 'hab-ralsei-coro', arquivo: `${PASTA}/coro.png`, quadro: { largura: 20, altura: 20 } },
    { chave: 'hab-ralsei-voz', arquivo: `${PASTA}/voz.png`, quadro: { largura: 10, altura: 10 } },
    { chave: 'hab-ralsei-nota', arquivo: `${PASTA}/nota.png`, quadro: { largura: 14, altura: 16 } },
    { chave: 'hab-ralsei-zzz', arquivo: `${PASTA}/zzz.png` },
    { chave: 'hab-ralsei-bolinho', arquivo: `${PASTA}/bolinho.png`, quadro: { largura: 22, altura: 26 } },
    { chave: 'hab-ralsei-granulado', arquivo: `${PASTA}/granulado.png`, quadro: { largura: 10, altura: 4 } },
    { chave: 'hab-ralsei-cereja', arquivo: `${PASTA}/cereja.png` },
    { chave: 'hab-ralsei-novelo', arquivo: `${PASTA}/novelo.png`, quadro: { largura: 16, altura: 16 } },
    { chave: 'hab-ralsei-fio', arquivo: `${PASTA}/fio.png`, quadro: { largura: 12, altura: 4 } },
    { chave: 'hab-ralsei-fita', arquivo: `${PASTA}/fita.png` },
    { chave: 'hab-ralsei-laco', arquivo: `${PASTA}/laco.png` },
  ],
  sons: [
    { nome: 'hab-ralsei-estrela', arquivo: `${SONS}/estrela.wav` },
    { nome: 'hab-ralsei-coro', arquivo: `${SONS}/coro.wav` },
    { nome: 'hab-ralsei-bolinho', arquivo: `${SONS}/bolinho.wav` },
    { nome: 'hab-ralsei-fita', arquivo: `${SONS}/fita.wav` },
  ],
}
