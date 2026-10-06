// Ganchos de desenvolvimento (só em `npm run dev`), usados pelos testes
// automáticos e pelo console do navegador:
//
//   debugJogo.set({ invencivel: true, acelerar: 3 })
//   debugJogo.cena()            cenas ativas
//   debugJogo.musica()          MIDI tocando agora e o segundo atual
//   (as arenas expõem window.pvpArena / window.coopArena)
import { estadoMidi } from './midi.js'

export const debug = { invencivel: false, acelerar: 1 }

export function registrarDebug(game) {
  if (!import.meta.env.DEV) return
  window.debugJogo = {
    set: (opcoes) => Object.assign(debug, opcoes),
    config: debug,
    jogo: game, // o Phaser.Game (inspeção no console)
    musica: () => estadoMidi(), // { tocando, tempo, contexto }
    cena: () => game.scene.getScenes(true).map((s) => s.scene.key),
    // dados com que uma cena foi iniciada (ex.: modo da vitória)
    dadosCena: (chave) => game.scene.getScene(chave)?.sys.settings.data ?? null,
  }
}
