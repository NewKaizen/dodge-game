// Efeitos visuais dos eventos de bônus que bagunçam a esquiva (cartas 'normal').
// Cada um: export default function criar(arena, { rng, rodada, aceleracao })
// -> { comecar(), atualizar(delta), joy?(j, joy), passo?(j, delta, joy), terminar() } (ver ../LEIA-ME.md).
// 'malucas', 'duelo' e 'copia' não estão aqui (a arena, o Duelo.js e o Copia.js cuidam deles).

import explosoes from './explosoes.js'
import transito from './transito.js'
import obra from './obra.js'
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
import popups from './popups.js'
import lag from './lag.js'
import teclado from './teclado.js'
import telaAzul from './telaAzul.js'
import cursor from './cursor.js'
import chuva from './chuva.js'
import ventania from './ventania.js'
import abelhas from './abelhas.js'
import vagalumes from './vagalumes.js'
import polen from './polen.js'
import trepadeira from './trepadeira.js'

import encolhendo from './encolhendo.js'
import leoes from './leoes.js'
import lancas from './lancas.js'
import bigas from './bigas.js'
import brasas from './brasas.js'
import polegar from './polegar.js'
import rede from './rede.js'

import plateia from './plateia.js'
import geloSeco from './geloSeco.js'
import ritmo from './ritmo.js'
import karaoke from './karaoke.js'
import mosh from './mosh.js'

import pedra from './pedra.js'
import armadilhas from './armadilhas.js'
import areia from './areia.js'
import relogio from './relogio.js'

export const EFEITOS = { explosoes, festa, pontaCabeca, apagao, gravidade, trocado, pcEscola, aquario, cogumelo, estatua, gelo, terremoto, popups, lag, teclado, telaAzul, cursor, chuva, ventania, abelhas, vagalumes, polen, trepadeira, encolhendo, leoes, lancas, bigas, brasas, polegar, rede, plateia, geloSeco, ritmo, karaoke, mosh, pedra, armadilhas, areia, relogio, transito, obra }
export const EFEITOS = { explosoes, festa, pontaCabeca, apagao, gravidade, trocado, pcEscola, aquario, cogumelo, estatua, gelo, terremoto, popups, lag, teclado, telaAzul, cursor, chuva, ventania, abelhas, vagalumes, polen, trepadeira, encolhendo, leoes, lancas, bigas, brasas, polegar, rede, plateia, geloSeco, ritmo, karaoke, mosh, pedra, armadilhas, areia, relogio, transito, obra }




// ESTAÇÃO ESPACIAL (planos puros em estacao/planos.js)
import semAtrito from './estacao/semAtrito.js'
import minhoca from './estacao/minhoca.js'
import radar from './estacao/radar.js'
import orbita from './estacao/orbita.js'
import polaridade from './estacao/polaridade.js'
import oxigenio from './estacao/oxigenio.js'
import trator from './estacao/trator.js'
import manutencao from './estacao/manutencao.js'

Object.assign(EFEITOS, { semAtrito, minhoca, radar, orbita, polaridade, oxigenio, trator, manutencao })

// CAFÉ FRANCÊS (eventos/cafe/)
import { EFEITOS_CAFE } from './cafe/index.js'

Object.assign(EFEITOS, EFEITOS_CAFE)


// PRAIA: 8 eventos de regra nova (planos puros em praia/planos.js)
import castelodeAreia from './praia/castelo.js'
import surf from './praia/surf.js'
import solDoMeioDia from './praia/sol.js'
import cacaTesouro from './praia/tesouro.js'
import pipa from './praia/pipa.js'
import pegadas from './praia/pegadas.js'
import concha from './praia/concha.js'
import gaivotaLadra from './praia/gaivota.js'

Object.assign(EFEITOS, { castelodeAreia, surf, solDoMeioDia, cacaTesouro, pipa, pegadas, concha, gaivotaLadra })

// CHINATOWN (planos puros em chinatown/planos.js)
import biscoito from './chinatown/biscoito.js'
import hashi from './chinatown/hashi.js'
import sombras from './chinatown/sombras.js'
import abaco from './chinatown/abaco.js'
import mahjong from './chinatown/mahjong.js'
import leao from './chinatown/leao.js'
import gato from './chinatown/gato.js'
import cestinha from './chinatown/cestinha.js'

Object.assign(EFEITOS, { biscoito, hashi, sombrasChinesas: sombras, abaco, mahjong, dancaDoLeao: leao, gatoDaSorte: gato, cestinhaDeVapor: cestinha })
