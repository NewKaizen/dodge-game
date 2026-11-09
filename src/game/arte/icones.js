import { PERSONAGENS } from '../data/personagens.js'
import { AVATARES_TRILHA } from '../../lib/progresso.js'

// Os IDs são os mesmos já salvos nos perfis do servidor.
export const IDS_ICONES = [...Object.keys(PERSONAGENS), ...AVATARES_TRILHA]
export const iconeDoPersonagem = id => `icone-${id}`
export function carregarIcones(cena) {
  for (const id of IDS_ICONES) cena.load.image(iconeDoPersonagem(id), `assets/sprites/icones/${id}.png`)
}
