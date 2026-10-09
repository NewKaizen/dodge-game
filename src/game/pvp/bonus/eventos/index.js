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
import encolhendo from './encolhendo.js'
import leoes from './leoes.js'
import lancas from './lancas.js'
import bigas from './bigas.js'
import brasas from './brasas.js'
import polegar from './polegar.js'
import rede from './rede.js'

export const EFEITOS = { explosoes, festa, pontaCabeca, apagao, gravidade, trocado, pcEscola, aquario, cogumelo, estatua, gelo, terremoto, encolhendo, leoes, lancas, bigas, brasas, polegar, rede }
