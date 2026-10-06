// Sprites e sons de telao.js (menu inicial), carregados pela Boot
//   imagens: [{ chave, arquivo, quadro?: { largura, altura } }]   (quadro = spritesheet)
//   sons:    [{ nome, arquivo }]   -> tocar(cena, nome)
// Chaves com o prefixo 'menu-telao-'. Gerados por scripts/menu/telao.py
const PASTA = 'assets/sprites/menu/telao'
const SONS = 'assets/audio/menu/telao'

export default {
  imagens: [
    { chave: 'menu-telao-moldura', arquivo: `${PASTA}/moldura.png` },
    { chave: 'menu-telao-reflexo', arquivo: `${PASTA}/reflexo.png` },
    { chave: 'menu-telao-vidro', arquivo: `${PASTA}/vidro.png` },
    { chave: 'menu-telao-chiado', arquivo: `${PASTA}/chiado.png`, quadro: { largura: 155, altura: 98 } },
    { chave: 'menu-telao-grade', arquivo: `${PASTA}/grade.png` },
    { chave: 'menu-telao-brilho', arquivo: `${PASTA}/brilho.png` },
  ],
  sons: [{ nome: 'menu-telao-ligar', arquivo: `${SONS}/ligar.wav` }],
}
