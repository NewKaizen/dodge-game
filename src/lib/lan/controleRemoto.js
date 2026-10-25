import { setTecladoUnico } from '../simulador.js'
import { lan } from './rede.js'

// Controles no modo LAN/ONLINE (docs/lan.md).
// Numa sala o teclado daqui inteiro (os dois conjuntos de teclas) é um
// jogador só: o deste PC. Na partida (PVP e CO-OP, game/rede.js) cada um joga
// no próprio PC e os Controles mandam tudo daqui para o meu lado; nada de
// controle viaja pela rede (o que vai é o resultado, pelo canal da partida).
//
// (Antes, no "Remote Play" do CO-OP, os controles do convidado iam para o host
// e viravam o jogador 2. A partida em rede tomou o lugar dele.)
lan.subscribe((s) => setTecladoUnico(s.fase === 'sala'))
