import { lan, partidaOnline, fecharLobby } from '../lib/lan/rede.js'

// Regras da partida ONLINE (docs/online.md). O jogo roda no PC do host e o
// outro está do outro lado da internet, então:
//   - não tem pausa (Controles ignora o C: pausar travaria o amigo);
//   - não tem revanche: no fim (PvpResultado, Vitoria, GameOver) a única
//     opção é voltar ao menu inicial, e a sala fecha para os dois (o convidado
//     volta ao menu sozinho: cena Lan);
//   - se o convidado sai no meio, o host volta para o lobby da sala; se o
//     host perde a conexão, volta ao menu.
//
//   partidaOnline()            true com a partida online rolando
//   sairDaPartidaOnline(cena)  fim da partida: fecha a sala e vai ao menu
//   instalarOnline(game)       vigia a sala durante a partida; devolve o desligar
export { partidaOnline }

let saindo = false

export function sairDaPartidaOnline(cena) {
  saindo = true
  fecharLobby()
  saindo = false
  cena.scene.start('Menu')
}

function trocarCena(game, destino) {
  for (const cena of game.scene.getScenes(true)) cena.scene.stop()
  game.scene.start(destino)
}

export function instalarOnline(game) {
  let comParceiro = false // host com a partida online rolando e o convidado na sala
  return lan.subscribe((s) => {
    const host = s.fase === 'sala' && s.online && s.papel === 'host' && Boolean(s.sala?.emPartida)
    const agora = host && s.sala.membros.length > 1
    if (comParceiro && !agora && !saindo) trocarCena(game, host ? 'Lan' : 'Menu') // o convidado saiu / a sala caiu
    comParceiro = agora
  })
}
