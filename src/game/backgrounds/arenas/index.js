// Fundos das arenas do PvP (pvp/arenas.js): mesmo formato dos fundos dos
// chefes (backgrounds/index.js): (scene, objetos) -> { atualizar(dt, estado) },
// desenhando na profundidade -10. Ficam registrados como 'arena-<id>'.
//
// Onde fica o quê na tela da arena (640x480): HUD no alto (y < 66); as duas
// caixas de esquiva em (160, 198) e (480, 198), 220x170 (podem mudar de forma
// dentro da metade de cada um, y de 74 a 334); as mãos de cartas embaixo
// (y ~ 380-480); a coluna do meio (x = 320) leva as cartas reveladas. Por cima
// do fundo a arena põe um véu escuro (arena.moldura.alpha): o fundo pode ser
// rico e animado, mas sem brilho forte atrás das caixas e das cartas.
import castelo from './castelo.js'
import jardim from './jardim.js'
import informatica from './informatica.js'
import palco from './palco.js'
import templo from './templo.js'
import coliseu from './coliseu.js'

const ARENAS = { castelo, jardim, informatica, palco, templo, coliseu }
export const FUNDOS_ARENAS = Object.fromEntries(Object.entries(ARENAS).map(([id, f]) => [`arena-${id}`, f]))
