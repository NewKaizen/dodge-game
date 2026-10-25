import { partidaOnline } from '../lib/lan/rede.js'

// Regras da partida ONLINE (docs/online.md). O outro jogador está do outro
// lado da internet, então:
//   - não tem pausa (Controles ignora o C: pausar travaria o amigo);
//   - não tem revanche: no fim (PvpResultado, Vitoria, GameOver) a única
//     opção é voltar ao lobby da sala (cena Lan), onde dá para conversar e
//     começar outra partida; a sala continua aberta;
//   - se o outro sai no meio, quem ficou volta para o lobby da sala; se a sala
//     cai, volta ao menu (quem vigia é game/rede.js: a partida numa sala, PVP
//     ou CO-OP, é sempre em rede).
//
//   partidaOnline()            true com a partida online rolando
//   voltarAoLobbyOnline(cena)  fim da partida: volta ao lobby da sala (fora da
//                              partida em rede; nela é irParaCena(cena, 'Lan'))
export { partidaOnline }

// a cena Lan, ao abrir com a partida marcada, avisa o servidor que ela acabou
// (encerrarPartida)
export function voltarAoLobbyOnline(cena) {
  cena.scene.start('Lan')
}
