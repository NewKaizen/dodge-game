// CPU aliada do CO-OP de cartas (1 jogador: o P2 é a CPU). Lógica pura.
//
//   escolherJogadaCoop(estado, j, { rng })   -> id da carta ou null (passar)
//
// Dá uma nota a cada carta jogável pensando no time: levantar o parceiro
// caído vem antes de tudo; com o SUPER do chefe chegando, defesa; com HP
// baixo (dela ou do parceiro), cura; senão, o golpe que mais tira do chefe
// por energia. Guarda energia para o próprio SUPER quando está perto.
// O chefe joga UMA carta, que os dois desviam juntos no quadro: o A♠, o A♦ e o
// A♣ tiram o ataque dos DOIS (valem mais com o parceiro de pé no quadro).
import { especialDaCarta, efeitosDaCarta, ehSuper } from '../pvp/cartas.js'
import { aleatorio } from '../pvp/baralho.js'
import { GOLPE } from './regras.js'
import { DUPLAS, atordoadoAgora } from './coop2.js'

// CO-OP 2.0: a CPU joga CARTAS DE DUPLA às vezes (coop2.js). Ela olha a carta em que o parceiro está com o
// cursor (dica.carta: segue quem joga) e, sem isso, a mão dele (com menos peso)
const comum = (c) => Boolean(c) && !ehSuper(c) && !especialDaCarta(c) && c.valor >= 2 && c.valor <= 13
const PARES = [
  [...DUPLAS.pinca.naipes, 22],
  [...DUPLAS.barreira.naipes, 16],
]
function bonusDeDupla(carta, outra) {
  if (!comum(carta) || !comum(outra)) return 0
  for (const [a, b, bonus] of PARES) if ((carta.naipe === a && outra.naipe === b) || (carta.naipe === b && outra.naipe === a)) return bonus
  if (carta.naipe === outra.naipe && carta.naipe !== 'copas') return 8 // COMBO
  return 0
}
function notaDeDupla(estado, j, carta, dica) {
  if (dica?.carta) return bonusDeDupla(carta, dica.carta)
  const parceiro = estado.jogadores.find((jog, k) => k !== j && !jog.caido && !jog.saiu && !jog.ausente)
  if (!parceiro) return 0
  const possiveis = parceiro.baralho.mao.filter((c) => c.custo <= parceiro.energia)
  return Math.max(0, ...possiveis.map((c) => bonusDeDupla(carta, c))) * 0.35
}

const fracao = (jog) => (jog.caido ? 0 : jog.hp / jog.hpMax)

// o "parceiro" que a nota olha: com 2 jogadores o outro; num grupo de 3+ o que mais precisa
// (um caído primeiro, senão o de menor fração de HP)
function parceiroDe(estado, j) {
  if (estado.jogadores.length <= 2) return estado.jogadores[1 - j]
  const outros = estado.jogadores.filter((_, k) => k !== j && !estado.jogadores[k].saiu)
  return [...outros].sort((a, b) => (b.caido ? 1 : 0) - (a.caido ? 1 : 0) || fracao(a) - fracao(b))[0] ?? estado.jogadores[1 - j] ?? estado.jogadores[0]
}

function notaDaCartaCoop(estado, j, carta) {
  const jog = estado.jogadores[j]
  const parceiro = parceiroDe(estado, j)
  const intencao = estado.chefe.intencao
  const superVindo = ehSuper(intencao)
  const apertado = fracao(jog) < 0.35 || (!parceiro.caido && fracao(parceiro) < 0.35)
  // carta do chefe que dá para tirar do quadro (o SUPER dele não sai); refletir a de
  // copas quase não machuca, mas anular/roubar ela ainda tira a cura dele
  const tiravel = Boolean(intencao) && !superVindo
  // tirar o ataque do quadro protege os dois: vale mais com o parceiro de pé
  const dupla = parceiro.caido ? 1 : 1.3
  if (ehSuper(carta)) return 100
  const especial = especialDaCarta(carta)
  if (especial === 'segundaChance') return parceiro.caido ? 80 : superVindo || apertado ? 60 : 1
  if (especial === 'espelho') return tiravel && intencao.naipe !== 'copas' ? (14 + intencao.valor * 2) * dupla : 6
  if (especial === 'anular') return tiravel ? (8 + intencao.valor * 1.5) * dupla + (estado.chefe.carga >= estado.chefe.cargaMax - 1 ? 10 : 0) : 3
  if (especial === 'roubo') return tiravel ? (10 + intencao.valor * 1.5) * dupla : 4
  if (carta.naipe === 'copas') {
    const ef = efeitosDaCarta(carta) ?? {}
    let nota = 0
    if (ef.cura) nota += parceiro.caido ? 75 : apertado ? ef.cura * 1.6 : ef.cura * 0.25
    if (ef.escudo) nota += superVindo ? 40 : (1 - ef.escudo) * 18
    if (ef.energia) nota += ef.energia * 3
    if (ef.compra) nota += 4 * ef.compra
    return nota
  }
  const golpe = GOLPE[carta.naipe]
  if (!golpe) return 0
  return golpe(carta.valor) * (carta.naipe === 'paus' ? 1.1 : 1) - carta.custo * 1.2
}

// dica = { carta } (opcional): a carta em que o parceiro está agora (a CPU tenta fechar uma carta de dupla)
export function escolherJogadaCoop(estado, j, { rng = null, dica = null } = {}) {
  const jog = estado.jogadores[j]
  if (jog.caido) return null
  const jogaveis = jog.baralho.mao.filter((c) => c.custo <= jog.energia)
  const sorte = () => (rng ? aleatorio(rng) : Math.random())
  // chefe ATORDOADO (coop2.js): os golpes batem mais e não há ataque para tirar: bater com tudo
  const parado = atordoadoAgora(estado)
  const nota = (carta) => {
    const base = notaDaCartaCoop(estado, j, carta)
    const golpe = GOLPE[carta.naipe] && comum(carta)
    return base * (parado && golpe ? 1.5 : 1) + notaDeDupla(estado, j, carta, dica)
  }
  const notas = jogaveis.map((carta) => ({ carta, nota: nota(carta) + sorte() * 3 }))
  notas.sort((a, b) => b.nota - a.nota)
  const melhor = notas[0]
  // com o SUPER na mão e perto da energia dele, junta energia (se não for emergência)
  const superNaMao = jog.baralho.mao.find(ehSuper)
  const emergencia = melhor && melhor.nota >= 40
  if (superNaMao && !ehSuper(melhor?.carta) && jog.energia >= superNaMao.custo - 4 && !emergencia) return null
  if (!melhor || melhor.nota < 5) return null
  return melhor.carta.id
}
