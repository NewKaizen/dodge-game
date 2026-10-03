// Manifesto dos sprites e sons das cartas normais (a Boot carrega tudo)
import kris from './kris.js'
import susie from './susie.js'
import ralsei from './ralsei.js'
import noelle from './noelle.js'
import berdly from './berdly.js'
import dess from './dess.js'
import asriel from './asriel.js'

const TODOS = { kris, susie, ralsei, noelle, berdly, dess, asriel }
export const IMAGENS_HABILIDADES = Object.values(TODOS).flatMap((m) => m?.imagens ?? [])
export const SONS_HABILIDADES = Object.values(TODOS).flatMap((m) => m?.sons ?? [])
