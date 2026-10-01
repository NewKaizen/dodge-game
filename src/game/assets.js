// Manifesto único de assets. Por padrão tudo é gerado por código:
//   texturas: null -> desenhada em game/arte/ (pixel art e formas procedurais)
//   sons:     null -> sintetizado em game/audio.js
//   musicas:  null -> procura public/assets/musicas/<nome>.mid (tocado com soundfont, ver midi.js);
//             não achou -> silêncio. Pode apontar para outro arquivo: 'assets/musicas/tema.mid' ou .ogg
//
// Para trocar por arquivos seus, coloque o caminho relativo a public/, ex.:
//   texturas: { kris: 'assets/sprites/kris.png' }
//   sons:     { dano: 'assets/audio/dano.ogg' }
//
// Texturas de bala (bala-*) e ícones (icone-*) devem ser brancas: o jogo pinta
// com a cor do tema. Sprites de personagem são desenhados em escala 1 e
// ampliados no jogo (ver ESCALA em arte/texturas.js).
export const ASSETS = {
  fonte: {
    familia: 'Pixelify Sans',
    arquivos: {
      400: 'assets/fonts/PixelifySans-Regular.woff2',
    },
  },

  texturas: {
    // personagens e chefes
    kris: null,
    susie: null,
    king: null,
    queen: null,
    jevil: null,
    coronel: null,
    'icone-kris': null,
    'icone-susie': null,

    // interface
    coracao: null,
    'coracao-rachado': null,
    'coracao-esq': null,
    'coracao-dir': null,
    'icone-fight': null,
    'icone-act': null,
    'icone-magic': null,
    'icone-item': null,
    'icone-spare': null,
    'icone-defend': null,
    faisca: null,
    brilho: null,
    vinheta: null,
    aviso: null,
    confete: null,
    estrela: null,
    raio: null,

    // balas
    'bala-bola': null,
    'bala-chama': null,
    'bala-caminhonete': null,
    'bala-losango': null,
    'bala-coroa': null,
    'bala-hex': null,
    'bala-barra': null,
    'bala-espadas': null,
    'bala-copas': null,
    'bala-ouros': null,
    'bala-paus': null,
    'bala-foice': null,
    bomba: null,

    // fundos
    'fundo-king-losangos': null,
    'fundo-queen-cidade': null,
    'fundo-queen-cidade-perto': null,
  },

  sons: {
    texto: null,
    mover: null,
    confirmar: null,
    cancelar: null,
    erro: null,
    dano: null,
    graze: null,
    cura: null,
    golpe: null,
    critico: null,
    combo: null,
    explosao: null,
    aviso: null,
    laser: null,
    tpMax: null,
    vitoria: null,
    gameover: null,
    quebrar: null,
    voo: null,
    buzina: null,
    motor: null,
    tensao: null,
    rachar: null,
    impacto: null,
    estalo: null,
    estouro: null,
    // tela de vitória
    subida: null,
    estouroFesta: null,
    fanfarra: null,
    fogo: null,
    contador: null,
    contadorFim: null,
    rufar: null,
    carimbo: null,
    brilhoRank: null,
    // derrota e game over
    batimento: null,
    trincar: null,
    estilhacar: null,
    abismo: null,
    letraPesada: null,
    lamento: null,
    sino: null,
  },

  musicas: {
    selecao: null,
    king: null,
    queen: null,
    jevil: null,
    coronel: null,
    vitoria: null,
  },
}
