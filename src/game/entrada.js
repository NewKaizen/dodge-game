import { get } from 'svelte/store'
import { jogo } from '../lib/estado.js'
import { armarTeclado } from '../lib/simulador.js'
import { iniciarGamepads } from '../lib/gamepad.js'
import { vigiarSerial } from '../lib/serial.js'
import { avisar } from './conta/avisos.js'

// Liga os controles do jogo sozinhos (Game.svelte chama uma vez), sem botão nenhum
// para clicar:
//   - teclado: a primeira tecla do jogo apertada na página liga (lib/simulador.js)
//   - controle físico: o primeiro botão apertado liga (lib/gamepad.js)
//   - joystick serial: reabre sozinho uma porta já autorizada e religa ao plugar o cabo
//     (lib/serial.js); o PRIMEIRO pareamento precisa de um gesto, em CONFIGURAÇÕES
// Também avisa o jogo quando a entrada some no meio da partida (janela sem foco,
// controle ou joystick desconectado): o evento 'entrada-perdida' do Phaser, que as
// arenas locais ouvem para pausar (game/controles.js, onPerdaDeFoco).
export function instalarEntrada(game) {
  const perdeu = (motivo) => game.events.emit('entrada-perdida', motivo)

  const pararTeclado = armarTeclado()
  const pararPads = iniciarGamepads({ aviso: avisar, aoPerder: perdeu })
  const pararSerial = vigiarSerial()

  // joystick serial ligou / desligou
  let serialLigado = get(jogo).fontes.serial
  const pararStore = jogo.subscribe((s) => {
    if (s.fontes.serial === serialLigado) return
    serialLigado = s.fontes.serial
    avisar({
      id: `serial:${Date.now()}`,
      tipo: 'info',
      titulo: serialLigado ? 'JOYSTICK CONECTADO' : 'JOYSTICK DESCONECTADO',
      texto: serialLigado ? 'joystick serial pronto' : 'plugue o cabo para voltar',
      ms: 3500,
    })
    if (!serialLigado) perdeu('joystick desconectado')
  })

  const aoPerderFoco = () => perdeu('a janela perdeu o foco')
  const aoMudarVisibilidade = () => document.hidden && aoPerderFoco()
  window.addEventListener('blur', aoPerderFoco)
  document.addEventListener('visibilitychange', aoMudarVisibilidade)

  return () => {
    window.removeEventListener('blur', aoPerderFoco)
    document.removeEventListener('visibilitychange', aoMudarVisibilidade)
    pararStore()
    pararSerial()
    pararPads()
    pararTeclado()
  }
}
