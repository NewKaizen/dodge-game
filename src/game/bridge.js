import { jogo } from '../lib/estado.js'
import { setSomLigado, setVolumes } from './audio.js'

// Repassa mudanças do store para o Phaser:
// - estado vai para o registry: this.registry.get('jogadores')
// - botões viram eventos: this.game.events.on('botao', ({ jogador, botao }) => ...)
//   (nas cenas, use game/controles.js, que já trata o modo 1 jogador)
export function ligarBridge(game) {
  let ultimoBotao = null

  return jogo.subscribe((s) => {
    game.registry.set('conectado', s.conectado)
    game.registry.set('numJogadores', s.numJogadores)
    game.registry.set('jogadores', s.jogadores)
    game.registry.set('velocidade', s.velocidade)
    setSomLigado(s.som)
    setVolumes(s.volume.musica / 100, s.volume.efeitos / 100)

    if (s.botao && s.botao !== ultimoBotao) {
      ultimoBotao = s.botao
      game.events.emit('botao', s.botao)
    }
  })
}
