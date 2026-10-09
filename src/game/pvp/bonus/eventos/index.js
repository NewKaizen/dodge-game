// Efeitos visuais dos eventos de bônus que bagunçam a esquiva (cartas 'normal').
// Cada um: export default function criar(arena, { rng, rodada, aceleracao })
// -> { comecar(), atualizar(delta), joy?(j, joy), passo?(j, delta, joy), terminar() } (ver ../LEIA-ME.md).
// 'malucas' e 'duelo' não estão aqui (a arena e o Duelo.js cuidam deles).

import explosoes from './explosoes.js'
import festa from './festa.js'
import pontaCabeca from './pontaCabeca.js'
import apagao from './apagao.js'
import gravidade from './gravidade.js'
import trocado from './trocado.js'
import pcEscola from './pcEscola.js'
import aquario from './aquario.js'
import cogumelo from './cogumelo.js'
import estatua from './estatua.js'
import gelo from './gelo.js'
import terremoto from './terremoto.js'
import pedra from './pedra.js'
import armadilhas from './armadilhas.js'
import areia from './areia.js'
import relogio from './relogio.js'

export const EFEITOS = { explosoes, festa, pontaCabeca, apagao, gravidade, trocado, pcEscola, aquario, cogumelo, estatua, gelo, terremoto, pedra, armadilhas, areia, relogio }
