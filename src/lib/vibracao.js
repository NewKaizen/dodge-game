import { get } from 'svelte/store'
import { jogo } from './estado.js'
import { controlesLigados, ultimoPadQueApertou } from './gamepad.js'
import { pref } from '../game/preferencias.js'
import { criarVibracao, intensidadeEfetiva, temAtuador } from '../game/vibracao.js'

// Vibração do controle físico, ligada ao mesmo aviso por jogador do BUZZER do joystick
// serial (lib/saida.js chama estas funções; as cenas não sabem que ela existe).
// A lógica (padrões, intensidade, limite de 250 ms) está em game/vibracao.js.
//
//   vibrarJogador(j, evento)   'golpe' | 'ko' | 'dupla': só o controle da vaga j vibra
//   pararVibracao()            pausa, janela sem foco, voltou ao menu
//   bloquearVibracao(sim)      partida pausada: nada vibra até desbloquear
//   testarVibracao()           CONFIGURAÇÕES: vibra o controle que apertou A por último
//
// Vagas: o controle da vaga j (game/fontes.js) é o jogador j+1. Com 1 jogador local (ou sala
// online) todos os controles comandam o mesmo lado, então todos vibram. Eventos do adversário
// nunca chegam aqui: as arenas só chamam o aviso do lado local (joystickDoLado).

const lerPads = () => {
  try {
    return Array.from(globalThis.navigator?.getGamepads?.() ?? []).filter(Boolean)
  } catch {
    return []
  }
}

const padsDa = (vaga) => {
  const ligados = controlesLigados()
  const escolhidos = get(jogo).numJogadores < 2 ? ligados : ligados.filter((c) => c.vaga === vaga)
  const indices = new Set(escolhidos.map((c) => c.pad))
  return lerPads().filter((p) => indices.has(p.index))
}

export const vibracao = criarVibracao({
  alvos: padsDa,
  ativa: () => pref('vibracao'),
  intensidade: () =>
    intensidadeEfetiva({
      vibracaoIntensidade: pref('vibracaoIntensidade'),
      tremor: pref('tremor'),
      reduzirMovimento: pref('reduzirMovimento'),
    }),
  agora: () => performance.now(),
})

export const vibrarJogador = (j, evento) => vibracao.vibrar(j, evento)
export const pararVibracao = () => vibracao.parar()
export const bloquearVibracao = (sim) => vibracao.bloquear(sim)

// Resultado do botão TESTAR VIBRAÇÃO: { ok, texto }
export function testarVibracao() {
  const pads = lerPads()
  const alvo = pads.find((p) => p.index === ultimoPadQueApertou()) ?? pads.find((p) => controlesLigados().some((c) => c.pad === p.index))
  if (!alvo) return { ok: false, texto: 'Nenhum controle em uso: aperte um botão do controle e tente de novo.' }
  if (vibracao.testar(alvo) === 'sem-atuador') return { ok: false, texto: 'este controle não vibra (ou o navegador não deixa)' }
  return { ok: true, texto: `Vibrou o controle ${alvo.index + 1}.${pref('vibracao') ? '' : ' (VIBRAÇÃO está desligada: no jogo ele não vibra)'}` }
}

export { temAtuador }
