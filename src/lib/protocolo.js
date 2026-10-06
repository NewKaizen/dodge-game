import { jogo, MAX_JOGADORES } from './estado.js'

let proximoIdBotao = 1

// Converte uma linha recebida (serial ou simulador) em atualização do store.
// Formato documentado em docs/protocolo-serial.md
export function processarLinha(linha) {
  const texto = linha.trim()
  if (!texto) return

  const [tipo, ...args] = texto.split(/\s+/)

  jogo.update((s) => {
    const novo = { ...s }
    switch (tipo.toUpperCase()) {
      case 'JOY': {
        // JOY <x> <y>  ou  JOY <jogador> <x> <y>
        const [p, x, y] = args.length >= 3 ? args : ['1', ...args]
        const i = indiceJogador(p)
        if (i === null) break
        const joy = { x: eixo(x), y: eixo(y) }
        novo.jogadores = s.jogadores.map((j, k) => (k === i ? { ...j, joy } : j))
        break
      }
      case 'BTN': {
        // BTN <A|B|C>  ou  BTN <jogador> <A|B|C>   (C = pause; START/PAUSE também valem)
        const [p, b] = args.length >= 2 ? args : ['1', args[0]]
        const i = indiceJogador(p)
        let botao = b?.toUpperCase()
        if (botao === 'START' || botao === 'PAUSE') botao = 'C'
        if (i === null || !['A', 'B', 'C'].includes(botao)) break
        novo.botao = { jogador: i, botao, id: proximoIdBotao++ }
        break
      }
    }
    return novo
  })
}

function indiceJogador(p) {
  const i = Number(p) - 1
  return Number.isInteger(i) && i >= 0 && i < MAX_JOGADORES ? i : null
}

function eixo(valor) {
  const n = Number(valor)
  return Number.isFinite(n) ? Math.max(-100, Math.min(100, n)) : 0
}
