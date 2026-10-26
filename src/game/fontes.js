// De onde vêm os controles (teclado, controle físico, joystick serial): lógica
// pura, testada em Node (__tests__/fontes.test.js).
//
//   resumirFontes({ teclado, gamepad, serial })   { conectado, fonte }: o que o resto do jogo enxerga.
//        `fonte` é a principal (serial > gamepad > teclado); a saída para o Arduino
//        (lib/saida.js) só sai com 'serial'. Várias fontes podem estar ligadas ao mesmo tempo.
//   teclaAtiva(code, mapaDeTeclas)                true se a tecla é uma das do jogo (a primeira
//        dessas na página liga o teclado sozinho)
//   criarAtribuidor({ vagas })                     quem é o jogador 1, 2...: a vaga de cada controle
//        .vagaDe(chave)       a vaga do controle (a primeira vez, a menor livre: o primeiro a apertar é o
//                             jogador 1, o segundo é o 2). { vaga, novo }
//        .ligou(chave) / .desligou(chave)          está na mesa / saiu. Quem saiu guarda a vaga: ao voltar
//                                                  (mesma chave) ele continua sendo o mesmo jogador
//        .vagaConhecida(chave)                      vaga ou -1 (sem criar)
//        .esquecer()                                zera tudo
import { ACOES, JOGADORES } from './teclas.js'

export const PRIORIDADE_FONTES = ['serial', 'gamepad', 'teclado']

export function resumirFontes(fontes = {}) {
  const fonte = PRIORIDADE_FONTES.find((f) => fontes[f]) ?? null
  return { conectado: fonte !== null, fonte }
}

export function teclaAtiva(code, mapa) {
  if (typeof code !== 'string' || !mapa) return false
  return JOGADORES.some((j) => ACOES.some((a) => mapa[j]?.[a]?.includes(code)))
}

export function criarAtribuidor({ vagas = 2 } = {}) {
  const lembradas = new Map() // chave -> vaga (fica depois que o controle sai)
  const presentes = new Set()

  const ocupada = (v, soPresentes) => [...lembradas].some(([c, vaga]) => vaga === v && (!soPresentes || presentes.has(c)))

  return {
    vagaDe(chave) {
      if (lembradas.has(chave)) {
        presentes.add(chave)
        return { vaga: lembradas.get(chave), novo: false }
      }
      let vaga = -1
      for (let v = 0; v < vagas && vaga < 0; v++) if (!ocupada(v, false)) vaga = v // nenhuma vaga é de ninguém
      for (let v = 0; v < vagas && vaga < 0; v++) if (!ocupada(v, true)) vaga = v // vaga de quem saiu (não volta tão cedo)
      if (vaga < 0) vaga = 0 // mais controles que jogadores: o extra ajuda o jogador 1
      lembradas.set(chave, vaga)
      presentes.add(chave)
      return { vaga, novo: true }
    },
    ligou: (chave) => presentes.add(chave),
    desligou: (chave) => presentes.delete(chave),
    vagaConhecida: (chave) => lembradas.get(chave) ?? -1,
    estaPresente: (chave) => presentes.has(chave),
    esquecer() {
      lembradas.clear()
      presentes.clear()
    },
  }
}
