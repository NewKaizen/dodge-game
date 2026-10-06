// Sprites e sons de logo.js (menu inicial), carregados pela Boot
//   imagens: [{ chave, arquivo, quadro?: { largura, altura } }]   (quadro = spritesheet)
//   sons:    [{ nome, arquivo }]   -> tocar(cena, nome)
// Chaves com o prefixo 'menu-logo-'. Gerados por scripts/menu/logo.py
const PASTA = 'assets/sprites/menu/logo'
const SONS = 'assets/audio/menu/logo'

// As letras desenhadas (um quadro por letra, nesta ordem, nas três tiras:
// acesa, apagada e halo). Letras fora daqui viram texto em logo.js.
// Os números abaixo são o que o logo.py imprime ao rodar.
export const GLIFOS = 'DOGE'
export const QUADRO = { largura: 92, altura: 100 }
export const COLUNAS = { D: [14, 64], O: [14, 72], G: [14, 68], E: [14, 60] } // primeira e última coluna opaca (px)
export const MIOLO_O = { x: 42, y: 50 } // centro do buraco do O dentro do quadro (onde a alma mora)

export default {
  imagens: [
    { chave: 'menu-logo-letras', arquivo: `${PASTA}/letras.png`, quadro: QUADRO },
    { chave: 'menu-logo-apagadas', arquivo: `${PASTA}/apagadas.png`, quadro: QUADRO },
    { chave: 'menu-logo-brilho', arquivo: `${PASTA}/brilho.png`, quadro: QUADRO },
    { chave: 'menu-logo-alma', arquivo: `${PASTA}/alma.png` },
    { chave: 'menu-logo-alma-brilho', arquivo: `${PASTA}/alma-brilho.png` },
    { chave: 'menu-logo-disco', arquivo: `${PASTA}/disco.png` },
    { chave: 'menu-logo-anel', arquivo: `${PASTA}/anel.png` },
    { chave: 'menu-logo-varredura', arquivo: `${PASTA}/varredura.png` },
    { chave: 'menu-logo-ping', arquivo: `${PASTA}/ping.png` },
  ],
  sons: [
    { nome: 'menu-logo-acender', arquivo: `${SONS}/acender.wav` },
    { nome: 'menu-logo-falha', arquivo: `${SONS}/falha.wav` },
    { nome: 'menu-logo-glitch', arquivo: `${SONS}/glitch.wav` },
    { nome: 'menu-logo-alma', arquivo: `${SONS}/alma.wav` },
  ],
}
