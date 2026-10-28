import { get } from 'svelte/store'
import { jogo } from '../lib/estado.js'
import { armarTeclado } from '../lib/simulador.js'
import { iniciarGamepads } from '../lib/gamepad.js'
import { vigiarSerial } from '../lib/serial.js'
import { avisar } from './conta/avisos.js'
import { criarDetector } from './jogadores.js'
import { lan } from '../lib/lan/rede.js'

// Liga os controles do jogo sozinhos (Game.svelte chama uma vez), sem botão nenhum
// para clicar:
//   - teclado: a primeira tecla do jogo apertada na página liga (lib/simulador.js)
//   - controle físico: o primeiro botão apertado liga (lib/gamepad.js)
//   - joystick serial: reabre sozinho uma porta já autorizada e religa ao plugar o cabo
//     (lib/serial.js), uma fonte por porta; o PRIMEIRO pareamento precisa de um gesto, em CONFIGURAÇÕES
// Também avisa o jogo quando a entrada some no meio da partida (janela sem foco,
// controle ou joystick desconectado): o evento 'entrada-perdida' do Phaser, que as
// arenas locais ouvem para pausar (game/controles.js, onPerdaDeFoco).
// E decide sozinho se são 1 ou 2 jogadores locais (game/jogadores.js): duas fontes
// distintas ativas = 2 jogadores, com um aviso; sem botão nenhum.
export function instalarEntrada(game) {
  const perdeu = (motivo) => game.events.emit('entrada-perdida', motivo)

  const pararTeclado = armarTeclado()
  const pararPads = iniciarGamepads({ aviso: avisar, aoPerder: perdeu })
  const pararSerial = vigiarSerial()

  // joystick serial ligou / desligou (um por porta USB)
  let seriais = get(jogo).seriais
  const pararStore = jogo.subscribe((s) => {
    if (s.seriais === seriais) return
    const ligou = s.seriais > seriais
    seriais = s.seriais
    avisar({
      id: `serial:${Date.now()}`,
      tipo: 'info',
      titulo: ligou ? 'JOYSTICK CONECTADO' : 'JOYSTICK DESCONECTADO',
      texto: ligou ? `${seriais} joystick${seriais > 1 ? 's' : ''} serial pronto${seriais > 1 ? 's' : ''}` : 'plugue o cabo para voltar',
      ms: 3500,
    })
    if (!ligou) perdeu('joystick desconectado')
  })

  // 1 ou 2 jogadores: reavalia quando uma fonte muda e de tempos em tempos (a cena ativa
  // muda sem avisar). Nunca mexe na partida: só em cena livre (Menu e telas de escolha).
  const detector = criarDetector({
    aplicar: ({ numero, p2Teclado }) => jogo.update((x) => ({ ...x, numJogadores: numero, p2Teclado })),
    avisar: (titulo) => avisar({ id: `p2:${Date.now()}`, tipo: 'info', titulo, ms: 3500 }),
  })
  const avaliar = () => {
    const s = get(jogo)
    detector.avaliar({
      numero: s.numJogadores,
      p2Teclado: s.p2Teclado,
      teclado: s.fontes.teclado,
      pads: s.pads,
      serial: s.seriais,
      cenas: game.scene.getScenes(true).map((c) => c.scene.key),
      emSala: get(lan).fase === 'sala',
    })
  }
  let chaveFontes = ''
  const pararFontes = jogo.subscribe((s) => {
    const chave = `${s.fontes.teclado}|${s.pads}|${s.seriais}|${s.numJogadores}|${s.p2Teclado}`
    if (chave === chaveFontes) return // os joysticks mexem no store 60 vezes por segundo
    chaveFontes = chave
    queueMicrotask(avaliar)
  })
  const relogio = setInterval(avaliar, 150)

  const aoPerderFoco = () => perdeu('a janela perdeu o foco')
  const aoMudarVisibilidade = () => document.hidden && aoPerderFoco()
  window.addEventListener('blur', aoPerderFoco)
  document.addEventListener('visibilitychange', aoMudarVisibilidade)

  return () => {
    window.removeEventListener('blur', aoPerderFoco)
    document.removeEventListener('visibilitychange', aoMudarVisibilidade)
    pararStore()
    pararFontes()
    clearInterval(relogio)
    pararSerial()
    pararPads()
    pararTeclado()
  }
}
