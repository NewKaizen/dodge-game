// MODO PARTY (salas de amigos com 3 ou 4; docs/online.md "Modo Party"): a lógica pura, sem Phaser e
// sem rede (testada em __tests__/regras.test.js). As cenas são PartyVoto (votação do modo e do mapa)
// e PartyFim (CONTINUAR / SAIR DA PARTY); quem conta o tempo e apura é o HOST da partida.
//
//   opcoesDeModo(n)                os modos que a party oferece com n membros (2x2 só com 4)
//   sortearTres(pool, anterior, rng)   3 opções do pool, sem a do jogo anterior se o pool deixar
//   novaVotacao / votar / todosVotaram / votacaoAcabou / apurar   a votação (10 s, voto muda até acabar)
//   novoFim / marcarFim / fimDecidido                              a tela CONTINUAR / SAIR (15 s)
import { criarRng, inteiro } from '../pvp/baralho.js'

export const VOTO_MS = 10_000
export const FIM_MS = 15_000
export const MIN_PARTY = 3
export const MAX_PARTY = 4

// as opções da votação de modo, na ordem dos cartões
export const MODOS_PARTY = {
  '2x2': { rotulo: '2x2', sub: 'EQUIPES', cor: 0xffd23a, min: 4, max: 4 },
  ffa: { rotulo: 'TODOS', sub: 'CONTRA TODOS', cor: 0xff3d6e, min: 3, max: 4 },
  coop4: { rotulo: 'CO-OP', sub: 'CONTRA O CHEFE', cor: 0x6dd0ff, min: 3, max: 4 },
}
export const ehPvp = (modo) => modo === '2x2' || modo === 'ffa'

// a party continua com 3 ou 4 (com 2 ela acaba e todos voltam ao lobby)
export const partySegue = (n) => n >= MIN_PARTY && n <= MAX_PARTY

export function opcoesDeModo(n) {
  if (!partySegue(n)) return []
  return Object.keys(MODOS_PARTY).filter((id) => n >= MODOS_PARTY[id].min && n <= MODOS_PARTY[id].max)
}

// 3 opções distintas do pool, em ordem de sorteio. A do jogo anterior só entra se o pool não tiver
// outras 3 (pool pequeno). rng: o de pvp/baralho.js (criarRng) ou uma semente em texto
export function sortearTres(pool, anterior = null, rng = criarRng(`party:${Date.now()}`), k = 3) {
  const r = typeof rng === 'string' ? criarRng(rng) : rng
  const unicos = [...new Set(pool)]
  const sem = unicos.filter((id) => id !== anterior)
  const base = sem.length >= k ? sem : unicos
  const resto = [...base]
  const saida = []
  while (saida.length < k && resto.length) saida.push(resto.splice(inteiro(r, 0, resto.length - 1), 1)[0])
  return saida
}

// ---------- a votação ----------

// eleitores: as vagas que podem votar (quem estava na party quando a votação abriu)
export const novaVotacao = ({ opcoes, eleitores, agora, duracaoMs = VOTO_MS }) => ({ opcoes: [...opcoes], eleitores: [...eleitores], votos: {}, ate: agora + duracaoMs })

// a vaga vota (ou troca o voto) enquanto a votação não acabou. Devolve a votação nova (ou a mesma)
export function votar(v, vaga, opcao, agora) {
  if (agora >= v.ate || !v.eleitores.includes(vaga) || !v.opcoes.includes(opcao) || v.votos[vaga] === opcao) return v
  return { ...v, votos: { ...v.votos, [vaga]: opcao } }
}

// presentes: as vagas que ainda estão na sala (quem saiu não segura os outros nem conta)
const quemConta = (v, presentes) => v.eleitores.filter((e) => presentes.includes(e))

export const todosVotaram = (v, presentes) => {
  const contam = quemConta(v, presentes)
  return contam.length > 0 && contam.every((e) => v.votos[e] != null)
}

export const votacaoAcabou = (v, presentes, agora) => agora >= v.ate || todosVotaram(v, presentes)

export const restanteVoto = (v, agora) => Math.max(0, v.ate - agora)

// apuração: só valem os votos de quem está; ninguém votou = todas empatadas. O empate é decidido
// pelo rng (o do host: o resultado vai para os outros). voltas: quantos passos a roleta dá antes de
// parar na vencedora (a mesma animação em todos os PCs)
export function apurar(v, presentes, rng) {
  const r = typeof rng === 'string' ? criarRng(rng) : rng
  const votos = {}
  for (const e of quemConta(v, presentes)) if (v.votos[e] != null) votos[e] = v.votos[e]
  const contagem = {}
  for (const o of Object.values(votos)) contagem[o] = (contagem[o] ?? 0) + 1
  const maximo = Math.max(0, ...Object.values(contagem))
  const empatadas = maximo ? v.opcoes.filter((o) => contagem[o] === maximo) : [...v.opcoes]
  const vencedora = empatadas.length === 1 ? empatadas[0] : empatadas[inteiro(r, 0, empatadas.length - 1)]
  const voltas = empatadas.length > 1 ? 2 * empatadas.length + empatadas.indexOf(vencedora) : 0
  return { vencedora, contagem, empatadas, votos, voltas }
}

// ---------- CONTINUAR / SAIR DA PARTY ----------

export const novoFim = (agora, duracaoMs = FIM_MS) => ({ escolhas: {}, ate: agora + duracaoMs })

// 'continuar' | 'sair' (sair é definitivo: a vaga sai da sala)
export function marcarFim(f, vaga, escolha, agora) {
  if (agora >= f.ate || (escolha !== 'continuar' && escolha !== 'sair') || f.escolhas[vaga] === 'sair' || f.escolhas[vaga] === escolha) return f
  return { ...f, escolhas: { ...f.escolhas, [vaga]: escolha } }
}

// a tela acaba quando todos os presentes apertaram CONTINUAR ou o tempo acabou. Quem não apertou
// nada continua; quem apertou SAIR já saiu da sala (não está nos presentes)
export function fimDecidido(f, presentes, agora) {
  const ficam = presentes.filter((p) => f.escolhas[p] !== 'sair')
  return agora >= f.ate || (ficam.length > 0 && ficam.every((p) => f.escolhas[p] === 'continuar'))
}

export const restanteFim = (f, agora) => Math.max(0, f.ate - agora)
