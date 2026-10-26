import { writable } from 'svelte/store'
import { CORACAO } from '../game/constants.js'
import { resumirFontes } from '../game/fontes.js'

export const MAX_JOGADORES = 2

// Configurações (tela Config do jogo) ficam salvas no navegador entre uma
// sessão e outra: volumes (0 a 100), som ligado e velocidade do coração
const CHAVE_CONFIG = 'dodge-config'
const PADRAO = { volume: { musica: 70, efeitos: 80 }, som: true, velocidade: CORACAO.velocidadePadrao }
function lerConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE_CONFIG))
    const volume = c?.volume && Number.isFinite(c.volume.musica) && Number.isFinite(c.volume.efeitos) ? c.volume : PADRAO.volume
    return {
      volume,
      som: typeof c?.som === 'boolean' ? c.som : PADRAO.som,
      velocidade: Number.isFinite(c?.velocidade) ? c.velocidade : PADRAO.velocidade,
    }
  } catch {
    return { ...PADRAO }
  }
}
const salvo = lerConfig()
export const CONFIG_PADRAO = PADRAO // "restaurar padrão" da tela Config

// Estado compartilhado entre a UI (Svelte) e o jogo (Phaser, via bridge.js)
export const jogo = writable({
  conectado: false, // alguma fonte de controle ligada (teclado, controle ou serial)
  fonte: null, // a principal: 'serial' | 'gamepad' | 'teclado' (game/fontes.js)
  fontes: { teclado: false, gamepad: false, serial: false }, // todas as ligadas
  numJogadores: 1, // as telas de escolha recomeçam quando muda
  jogadores: Array.from({ length: MAX_JOGADORES }, () => ({ joy: { x: 0, y: 0 } })),
  botao: null, // último botão apertado: { jogador, botao: 'A' | 'B' | 'C', id } (C = pause)
  velocidade: salvo.velocidade, // px/s do coração
  som: salvo.som,
  volume: salvo.volume, // { musica, efeitos } em %
})

// Liga/desliga uma fonte de controle: 'teclado' (lib/simulador.js), 'gamepad'
// (lib/gamepad.js) ou 'serial' (lib/serial.js). Várias podem estar ligadas.
export function definirFonte(nome, ativa) {
  jogo.update((s) => {
    if (Boolean(s.fontes[nome]) === Boolean(ativa)) return s
    const fontes = { ...s.fontes, [nome]: Boolean(ativa) }
    return { ...s, fontes, ...resumirFontes(fontes) }
  })
}

let configSalva = null
jogo.subscribe((s) => {
  const texto = JSON.stringify({ volume: s.volume, som: s.som, velocidade: s.velocidade })
  if (texto === configSalva) return
  configSalva = texto
  try {
    localStorage.setItem(CHAVE_CONFIG, texto)
  } catch {}
})
