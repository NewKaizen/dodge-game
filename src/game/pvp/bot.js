// Bot do PvP (CPU): escolhe a carta da rodada. Lógica pura (sem Phaser),
// testável em Node. A esquiva do bot fica em pvp/botEsquiva.js.
//
//   const id = escolherJogada(estado, 1, { nivel: 'normal', rng })   // id da carta ou null (passar)
//
// Como pensa (cada carta jogável ganha uma nota; a maior vence, com um pouco de
// sorteio para não ficar previsível):
//   ataque (♠ ♦ ♣)   dano por bala x força da carta; mais vontade quando o
//                    adversário está com pouco HP; controles invertidos contam extra
//   copas (♥)        vale mais quanto mais ferido o bot está (cura/escudo);
//                    energia e compra valem pouco, mas sempre algo
//   Ás ♠ espelho     bom quando o adversário tem energia para mandar algo forte
//   Ás ♦ anular      idem, um pouco menos
//   Ás ♣ roubo       melhor com a mão do adversário cheia
//   Ás ♥ 2ª chance   só quando o HP está baixo
//   passar           quando nada jogável vale a pena ou quando segurar a energia
//                    libera uma carta forte na próxima rodada
import { cartasJogaveis, ENERGIA } from './regras.js'
import { danoDaCarta, efeitosDaCarta, especialDaCarta, forca, inverterDaCarta } from './cartas.js'
import { aleatorio } from './baralho.js'

// Níveis da CPU (a esquiva usa os mesmos nomes, ver botEsquiva.js)
//   ruido      quanto a nota de cada carta varia no sorteio (0 = sempre a melhor)
//   paciencia  quanto o bot topa passar para juntar energia (0 = nunca guarda)
export const NIVEIS_BOT = {
  facil: { ruido: 0.6, paciencia: 0.2 },
  normal: { ruido: 0.25, paciencia: 0.6 },
  dificil: { ruido: 0.08, paciencia: 1 },
}
export const NIVEL_BOT_PADRAO = 'normal'

const outro = (j) => 1 - j

// Nota de uma carta jogável para o jogador j (maior = melhor)
export function notaDaCarta(estado, j, carta) {
  const eu = estado.jogadores[j]
  const adv = estado.jogadores[outro(j)]
  const meuHp = eu.hp / eu.hpMax
  const hpAdv = adv.hp / adv.hpMax
  const especial = especialDaCarta(carta)

  if (especial === 'segundaChance') return meuHp < 0.3 ? 30 : meuHp < 0.5 ? 6 : 0.5
  if (especial === 'espelho') return 4 + Math.min(adv.energia, 6) * 1.6
  if (especial === 'anular') return 3 + Math.min(adv.energia, 6) * 1.3
  if (especial === 'roubo') return 3 + adv.baralho.mao.length * 0.9

  if (carta.naipe === 'copas') {
    const ef = efeitosDaCarta(carta) ?? {}
    let nota = 1
    if (ef.cura) nota += Math.min(ef.cura, eu.hpMax - eu.hp) * (1 - meuHp) * 1.2
    if (ef.escudo) nota += (1 - ef.escudo) * 10 * (1 - meuHp * 0.5)
    if (ef.energia) nota += ef.energia * 1.4
    if (ef.compra) nota += ef.compra * 1.8
    return nota
  }

  // ataque: dano por bala, mais forte = mais balas e mais tempo de ataque
  let nota = danoDaCarta(carta) * (0.8 + forca(carta.valor))
  if (inverterDaCarta(carta)) nota += 3
  if (hpAdv < 0.35) nota *= 1.4 // cheiro de vitória: aperta
  return nota
}

// Nota de passar a vez: alta quando segurar energia libera uma carta bem mais
// forte na próxima rodada (que hoje não dá para pagar)
function notaDePassar(estado, j, nivel, melhor) {
  const eu = estado.jogadores[j]
  const proxima = Math.min(ENERGIA.maxima, eu.energia + ENERGIA.passar + ENERGIA.porRodada)
  const caras = eu.baralho.mao.filter((c) => c.custo > eu.energia && c.custo <= proxima)
  if (!caras.length) return 0
  const sonho = Math.max(...caras.map((c) => notaDaCarta(estado, j, c)))
  // só vale guardar se a carta cara for MUITO melhor que a melhor de agora
  return sonho > melhor * 1.8 ? sonho * 0.5 * nivel.paciencia : 0
}

// id da carta que o bot joga (ou null para passar)
export function escolherJogada(estado, j, { nivel = NIVEL_BOT_PADRAO, rng } = {}) {
  const cfg = NIVEIS_BOT[nivel] ?? NIVEIS_BOT[NIVEL_BOT_PADRAO]
  const sorte = () => (rng ? aleatorio(rng) : Math.random())
  const jogaveis = cartasJogaveis(estado, j)
  if (!jogaveis.length) return null

  const notas = jogaveis.map((carta) => ({ carta, nota: notaDaCarta(estado, j, carta) * (1 + (sorte() * 2 - 1) * cfg.ruido) }))
  notas.sort((a, b) => b.nota - a.nota)
  const melhor = notas[0]
  if (melhor.nota <= 0.5) return null
  if (notaDePassar(estado, j, cfg, melhor.nota) > melhor.nota) return null
  return melhor.carta.id
}
