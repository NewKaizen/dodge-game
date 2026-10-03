// Ataques exclusivos das cartas normais (um arquivo por personagem). Os nomes
// levam o prefixo do personagem (krisEstocadaDupla, susieCabecada...) para não
// colidirem; as receitas de pvp/baralhos/<personagem>.js usam A.<nome>(...).
import kris from './kris.js'
import susie from './susie.js'
import ralsei from './ralsei.js'
import noelle from './noelle.js'
import berdly from './berdly.js'
import dess from './dess.js'
import asriel from './asriel.js'

export const ataquesHabilidades = { ...kris, ...susie, ...ralsei, ...noelle, ...berdly, ...dess, ...asriel }
