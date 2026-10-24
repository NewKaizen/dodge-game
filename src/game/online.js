import { lan, partidaOnline } from '../lib/lan/rede.js'

// Regras da partida ONLINE (docs/online.md). O outro jogador está do outro
// lado da internet, então:
//   - não tem pausa (Controles ignora o C: pausar travaria o amigo);
//   - não tem revanche: no fim (PvpResultado, Vitoria, GameOver) a única
//     opção é voltar ao lobby da sala (cena Lan), onde dá para conversar e
//     começar outra partida; a sala continua aberta;
//   - se o convidado sai no meio, o host volta para o lobby da sala; se o
//     host perde a conexão, volta ao menu.
//
//   partidaOnline()            true com a partida online rolando
//   voltarAoLobbyOnline(cena)  fim da partida: os dois voltam ao lobby da sala
//   instalarOnline(game)       vigia a sala durante a partida; devolve o desligar
export { partidaOnline }

// a cena Lan, ao abrir com a partida marcada, avisa o servidor que ela acabou
// (encerrarPartida) e o convidado volta junto
export function voltarAoLobbyOnline(cena) {
  cena.scene.start('Lan')
}

function trocarCena(game, destino) {
  for (const cena of game.scene.getScenes(true)) cena.scene.stop()
  game.scene.start(destino)
}

export function instalarOnline(game) {
  let comParceiro = false // host com a partida online rolando e o convidado na sala
  return lan.subscribe((s) => {
    // o PVP em rede tem o próprio vigia (game/rede.js); aqui é o CO-OP (Remote Play)
    const naSala = s.fase === 'sala' && s.online && s.papel === 'host' && s.sala?.modo !== 'pvp'
    const agora = naSala && Boolean(s.sala?.emPartida) && s.sala.membros.length > 1
    if (comParceiro && !agora) {
      if (!naSala) trocarCena(game, 'Menu') // a sala caiu
      else if (s.sala.emPartida) trocarCena(game, 'Lan') // o convidado saiu no meio
      // emPartida desligado: a partida acabou e já está voltando ao lobby
    }
    comParceiro = agora
  })
}
