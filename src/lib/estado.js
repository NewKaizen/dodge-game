import { writable } from 'svelte/store'
import { CORACAO } from '../game/constants.js'

export const MAX_JOGADORES = 2

// Volumes (0 a 100) ficam salvos no navegador entre uma sessão e outra
const CHAVE_VOLUME = 'dodge-volume'
function lerVolume() {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_VOLUME))
    if (v && Number.isFinite(v.musica) && Number.isFinite(v.efeitos)) return v
  } catch {}
  return { musica: 70, efeitos: 80 }
}

// Estado compartilhado entre a UI (Svelte) e o jogo (Phaser, via bridge.js)
export const jogo = writable({
  conectado: false,
  fonte: null, // 'serial' | 'simulador'
  numJogadores: 1, // lido quando a batalha começa
  jogadores: Array.from({ length: MAX_JOGADORES }, () => ({ joy: { x: 0, y: 0 } })),
  botao: null, // último botão apertado: { jogador, botao: 'A' | 'B' | 'C', id } (C = pause)
  velocidade: CORACAO.velocidadePadrao, // px/s do coração
  som: true,
  volume: lerVolume(), // { musica, efeitos } em %
  ultimoEvento: null,
})

let volumeSalvo = null
jogo.subscribe((s) => {
  const texto = JSON.stringify(s.volume)
  if (texto === volumeSalvo) return
  volumeSalvo = texto
  try {
    localStorage.setItem(CHAVE_VOLUME, texto)
  } catch {}
})
