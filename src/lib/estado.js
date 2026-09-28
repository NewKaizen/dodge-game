import { writable } from 'svelte/store'
import { CORACAO } from '../game/constants.js'

export const MAX_JOGADORES = 2

// Estado compartilhado entre a UI (Svelte) e o jogo (Phaser, via bridge.js)
export const jogo = writable({
  conectado: false,
  fonte: null, // 'serial' | 'simulador'
  numJogadores: 1, // lido quando a batalha começa
  jogadores: Array.from({ length: MAX_JOGADORES }, () => ({ joy: { x: 0, y: 0 } })),
  botao: null, // último botão apertado: { jogador, botao: 'A' | 'B', id }
  velocidade: CORACAO.velocidadePadrao, // px/s do coração
  som: true,
  ultimoEvento: null,
})
