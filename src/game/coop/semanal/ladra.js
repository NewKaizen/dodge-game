// BOSS SEMANAL · LADRA DE CARTAS: as regras puras do roubo (sem Phaser; testadas em
// coop/__tests__/ladra.test.js). Quem chama é coop/regras.js (iniciarRodadaCoop e
// resolverRodadaCoop), só quando o chefe tem `ladra` (coop/chefes/ladra.js). Como todo o resto da
// regra, roda no host e vai no estado para os outros PCs.
//
// estado.chefe.roubadas = [{ carta, dono }] (a mais antiga primeiro; ficam viradas para cima em cima dela)
// estado.chefe.alvoRoubo = o próximo jogador do rodízio
//
//   1. Começo de cada rodada (depois de completar as mãos): ela ROUBA uma carta (2 a K, nunca Ás nem
//      SUPER) da mão do próximo jogador de pé do rodízio que tenha uma; a carta sai da mão dele.
//      Com LADRA.maxMao roubadas na mão ela não rouba mais (joga antes).
//   2. A cada LADRA.jogaACada rodadas (ou com a mão cheia) a carta virada dela é a roubada MAIS
//      ANTIGA (cartaDaLadra): o efeito da carta do jogador virado contra o time (ver chefes/ladra.js).
//      Depois de jogada (ou anulada/refletida/roubada/varrida) a carta volta para o DESCARTE do dono.
//   3. Na resolução: cada ♣ (armadilha) jogado por quem está de pé pega a ladra e devolve a ÚLTIMA
//      roubada (a mais recente) para a MÃO do dono; um SUPER de jogador devolve TODAS.
import { ehSuper } from '../../pvp/cartas.js'
import { inteiro } from '../../pvp/baralho.js'

export const LADRA = { maxMao: 4, jogaACada: 2 }

// dá para roubar: carta numerada (2 a K), sem Ás e sem SUPER
export const roubavel = (carta) => Boolean(carta) && !ehSuper(carta) && carta.valor >= 2 && carta.valor <= 13

// o próximo alvo do rodízio (a partir de alvoRoubo, em ordem de vaga) entre `podem` com carta roubável
export function alvoDoRoubo(estado, podem) {
  const n = estado.jogadores.length
  const inicio = estado.chefe.alvoRoubo ?? 0
  for (let k = 0; k < n; k++) {
    const j = (inicio + k) % n
    if (podem.includes(j) && estado.jogadores[j].baralho.mao.some(roubavel)) return j
  }
  return null
}

// rouba uma carta (o rodízio anda). Devolve { j, carta } ou null
export function roubar(estado, podem) {
  const c = estado.chefe
  c.roubadas ??= []
  if (c.roubadas.length >= LADRA.maxMao) return null
  const j = alvoDoRoubo(estado, podem)
  if (j === null) return null
  const mao = estado.jogadores[j].baralho.mao
  const opcoes = mao.filter(roubavel)
  const carta = opcoes[inteiro(estado.rng, 0, opcoes.length - 1)]
  mao.splice(mao.indexOf(carta), 1)
  c.roubadas.push({ carta, dono: j })
  c.alvoRoubo = (j + 1) % estado.jogadores.length
  return { j, carta }
}

// ela joga uma roubada nesta rodada?
export const jogaRoubada = (estado) => (estado.chefe.roubadas?.length ?? 0) > 0 && (estado.rodada % LADRA.jogaACada === 0 || estado.chefe.roubadas.length >= LADRA.maxMao)

const NOME_NAIPE = { espadas: 'GOLPE ROUBADO', ouros: 'ADIANTA AS BALAS', paus: 'ARMADILHA ROUBADA', copas: 'ELA SE CURA' }

// a carta virada da ladra feita da roubada mais antiga (sai da mão dela)
export function cartaDaLadra(estado) {
  const { carta, dono } = estado.chefe.roubadas.shift()
  const descricao = carta.naipe === 'copas' ? `A ladra usa o ${carta.nome} roubado: ela se cura. Manda só um ataque fraquinho.` : `A ladra usa a carta roubada do P${dono + 1} contra o time (${NOME_NAIPE[carta.naipe].toLowerCase()}).`
  return { id: `ladra-roubo-${carta.id}`, personagem: carta.personagem, chefe: estado.chefe.id, naipe: carta.naipe, valor: carta.valor, nome: carta.nome, descricao, custo: 0, fase: null, roubada: { carta, dono } }
}

// a cura da ♥ roubada (antes do dobro de COOP.curaChefe)
export const curaDaRoubada = (carta) => 4 * carta.valor

// devolve a última roubada (ou todas) para a MÃO do dono. Devolve [{ dono, carta }]
export function devolver(estado, todas = false) {
  const c = estado.chefe
  if (!c.roubadas?.length) return []
  const saem = todas ? c.roubadas.splice(0) : [c.roubadas.pop()]
  for (const { carta, dono } of saem) estado.jogadores[dono].baralho.mao.push(carta)
  return saem
}

// a roubada que ela jogou (ou que foi tirada do quadro) volta ao descarte do dono
export function largarRoubada(estado, intencao) {
  const r = intencao?.roubada
  if (!r) return false
  estado.jogadores[r.dono]?.baralho.descarte.push(r.carta)
  return true
}
