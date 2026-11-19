// As DECISÕES do bot do JOGAR RÁPIDO que não dependem de tempo real (lógica pura, testada em
// server/__tests__/bots.test.js): a carta da rodada, quanto demora para pensar, por onde o cursor
// passa antes de confirmar, o personagem e a arena. Tudo com o sorteio que vier (rng: () => 0..1).
import { cartasJogaveis } from '../../src/game/pvp/regras.js'
import { escolherJogada } from '../../src/game/pvp/bot.js'
import { PERSONAGENS_PVP } from '../../src/game/pvp/cartas.js'
import { PERSONAGENS } from '../../src/game/data/personagens.js'
import { ARENAS, ALEATORIA } from '../../src/game/pvp/arenas.js'

// a grade da PvpEscolha e os cartões da PvpVoto, na mesma ordem das telas (o cursor é o índice nelas)
export const IDS_PERSONAGENS = PERSONAGENS_PVP.filter((id) => PERSONAGENS[id])
export const OPCOES_ARENA = [...ARENAS.map((a) => a.id), ALEATORIA]

// a carta (id) ou null (passar), como gente: quase sempre a nota do pvp/bot.js com o ruído da faixa,
// às vezes uma jogável qualquer, às vezes passa sem precisar
export function escolherCarta(estado, lado, cartas, rng = Math.random) {
  const jogaveis = cartasJogaveis(estado, lado)
  if (!jogaveis.length) return null
  if (rng() < cartas.passarAToa) return null
  if (rng() < cartas.errar) return jogaveis[Math.floor(rng() * jogaveis.length)].id
  return escolherJogada(estado, lado, { nivel: { ruido: cartas.ruido, paciencia: cartas.paciencia }, rng })
}

// ms até confirmar: uma log-normal em volta do típico, entre o mínimo e o máximo da faixa, e nunca
// depois do relógio (limiteMs: o tempo que sobra, com folga). De vez em quando hesita bem mais.
export function tempoDePensar([minimo, tipico, maximo], rng = Math.random, limiteMs = Infinity) {
  const normal = Math.sqrt(-2 * Math.log(1 - rng() * 0.999999)) * Math.cos(2 * Math.PI * rng())
  let ms = tipico * Math.exp(0.38 * normal)
  if (rng() < 0.08) ms *= 1.6 // ficou na dúvida
  ms = Math.max(minimo, Math.min(maximo, ms))
  return Math.round(Math.max(250, Math.min(ms, limiteMs)))
}

// o caminho do cursor até o índice final: passa por uma ou duas cartas antes (como quem olha a mão).
// Devolve [{ indice, passar }] na ordem; o último é a escolha
export function caminhoDoCursor({ inicio, alvo, total, passar = false }, rng = Math.random) {
  const passos = []
  const n = Math.max(1, total)
  let atual = Math.min(Math.max(0, inicio), n - 1)
  const olhar = Math.floor(rng() * 3) // 0, 1 ou 2 cartas "olhadas"
  for (let k = 0; k < olhar; k++) {
    const destino = Math.floor(rng() * n)
    while (atual !== destino) {
      atual += destino > atual ? 1 : -1
      passos.push({ indice: atual, passar: false })
    }
  }
  if (passar) {
    // o botão PASSAR fica depois da última carta: anda até a ponta e "desce"
    while (atual < n - 1) passos.push({ indice: ++atual, passar: false })
    passos.push({ indice: atual, passar: true })
    return passos
  }
  const fim = Math.min(Math.max(0, alvo), n - 1)
  while (atual !== fim) {
    atual += fim > atual ? 1 : -1
    passos.push({ indice: atual, passar: false })
  }
  if (!passos.length) passos.push({ indice: atual, passar: false })
  return passos
}

// o personagem: quase sempre um dos "mains" do bot, às vezes outro qualquer
export function escolherPersonagem(ids, favoritos = [], rng = Math.random) {
  const mains = favoritos.filter((id) => ids.includes(id))
  if (mains.length && rng() < 0.82) return mains[Math.floor(rng() * mains.length)]
  return ids[Math.floor(rng() * ids.length)]
}

// a arena: às vezes a aleatória, às vezes a que já está no cursor, senão uma qualquer;
// às vezes nem vota (o relógio do host apura sem ele)
export function escolherArena(opcoes, rng = Math.random) {
  const r = rng()
  if (r < 0.1) return null
  if (r < 0.28) return opcoes[opcoes.length - 1] // o "?" (ALEATÓRIA) é o último
  return opcoes[Math.floor(rng() * (opcoes.length - 1))]
}
