// Arquivos carregados pela Boot (caminhos relativos a public/). O resto da
// arte é desenhado por código (arte/texturas.js), os efeitos sonoros são
// sintetizados (audio.js) e as músicas são public/assets/musicas/<nome>.mid.
// Os sprites e sons de SUPER, habilidades e menu têm manifestos próprios
// (pvp/super/sprites, pvp/habilidades/sprites, menu/sprites).
export const ASSETS = {
  fonte: { familia: 'Pixelify Sans', arquivo: 'assets/fonts/PixelifySans-Regular.woff2' },

  // bonus rounds do PvP (pvp/bonus/): PNGs gerados por scripts/gerar_sprites_bonus.py
  imagens: {
    'bonus-explosao-0': 'assets/sprites/bonus/bonus-explosao-0.png',
    'bonus-explosao-1': 'assets/sprites/bonus/bonus-explosao-1.png',
    'bonus-explosao-2': 'assets/sprites/bonus/bonus-explosao-2.png',
    'bonus-explosao-3': 'assets/sprites/bonus/bonus-explosao-3.png',
    'bonus-explosao-4': 'assets/sprites/bonus/bonus-explosao-4.png',
    'bonus-explosao-5': 'assets/sprites/bonus/bonus-explosao-5.png',
    'bonus-explosao-6': 'assets/sprites/bonus/bonus-explosao-6.png',
    'bonus-explosao-7': 'assets/sprites/bonus/bonus-explosao-7.png',
    'bonus-alvo': 'assets/sprites/bonus/bonus-alvo.png',
    'bonus-bomba': 'assets/sprites/bonus/bonus-bomba.png',
    'bonus-bola-disco': 'assets/sprites/bonus/bonus-bola-disco.png',
    'bonus-balao': 'assets/sprites/bonus/bonus-balao.png',
    'bonus-tiro': 'assets/sprites/bonus/bonus-tiro.png',
    'bonus-espada': 'assets/sprites/bonus/bonus-espada.png',
    'bonus-bumerangue': 'assets/sprites/bonus/bonus-bumerangue.png',
    'bonus-seta': 'assets/sprites/bonus/bonus-seta.png',
    'bonus-selo': 'assets/sprites/bonus/bonus-selo.png',
    'bonus-holofote': 'assets/sprites/bonus/bonus-holofote.png',
  },

  // efeitos gravados (o resto é sintetizado em audio.js); 'chuva' toca em loop no apagão
  sons: {
    trovao: 'assets/audio/trovao.ogg',
    aplausos: 'assets/audio/aplausos.ogg',
    chuva: 'assets/audio/chuva.ogg',
  },

  // nome que aparece no canto de cima do menu inicial (troque junto com menu.mid)
  tituloMusicaMenu: 'THE WORLD REVOLVING',
}
