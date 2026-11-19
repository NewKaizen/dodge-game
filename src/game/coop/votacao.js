// VOTAÇÃO DO CO-OP ONLINE (docs/coop-cartas.md "Votação do CO-OP"): na sala de 2 a 4, ninguém escolhe sozinho
// o modo (LUTA RÁPIDA / EXPEDIÇÃO), o chefe nem o nível: todos votam e o mais votado vence.
//
// Lógica pura e serializável, sem Phaser e sem rede (testada em __tests__/votacao.test.js). Reaproveita a
// votação da party (party/regras.js: voto que dá para trocar até o tempo acabar, quem saiu não conta) com
// três diferenças:
//   - o relógio é de 20 s (como a escolha de melhoria da Expedição);
//   - o EMPATE (ou ninguém votar) é decidido por um SORTEIO entre as empatadas, com o rng da semente da
//     sala (sementeDaVotacao): o mesmo resultado em qualquer PC, que o host manda pronto (`coopResultado`);
//   - quem cai da sala no meio perde o voto (sair): ele não conta nem segura a apuração.
//
//   novaVotacao({ tela, opcoes, eleitores, agora })   tela: 'modo' | 'chefe' | 'nivel'; opcoes: os ids votáveis
//   votar(v, vaga, opcao, agora)                      -> votação nova (a mesma se o voto não vale)
//   sair(v, presentes)                                -> tira dos eleitores e dos votos quem não está mais na sala
//   placar(v, presentes)                              -> { votaram, total } (o "X/Y votaram")
//   votacaoAcabou(v, presentes, agora)                todos votaram (os presentes) ou o tempo acabou
//   apurarVotacao(v, presentes, semente)              -> { vencedora, contagem, empatadas, votos, voltas }
//   passosDaRoleta(empatadas, voltas)                 as opções que a roleta acende, em ordem (a última é a vencedora)
import { criarRng } from '../pvp/baralho.js'
import { novaVotacao as novaBase, votar, votacaoAcabou, todosVotaram, apurar, restanteVoto } from '../party/regras.js'

export const VOTO_MS = 20_000 // o relógio (acabou: vale o que foi votado; ninguém votou: sorteio)
export const TELAS = ['modo', 'chefe', 'nivel']

export { votar, votacaoAcabou, todosVotaram, restanteVoto }

export const novaVotacao = ({ tela, opcoes, eleitores, agora, duracaoMs = VOTO_MS }) => ({ ...novaBase({ opcoes, eleitores, agora, duracaoMs }), tela })

// quem saiu da sala perde o direito e o voto (voltar depois não ressuscita o voto dele)
export function sair(v, presentes) {
  const fica = v.eleitores.filter((e) => presentes.includes(e))
  if (fica.length === v.eleitores.length) return v
  const votos = {}
  for (const e of fica) if (v.votos[e] != null) votos[e] = v.votos[e]
  return { ...v, eleitores: fica, votos }
}

export function placar(v, presentes) {
  const contam = v.eleitores.filter((e) => presentes.includes(e))
  return { votaram: contam.filter((e) => v.votos[e] != null).length, total: contam.length }
}

// a semente do sorteio de uma tela: a da sala (vai nos dados das cenas) + a tela. Igual em todos os PCs
export const sementeDaVotacao = (semente, tela) => `${semente ?? 'coop'}:voto:${tela}`

export const apurarVotacao = (v, presentes, semente) => apurar(sair(v, presentes), presentes, criarRng(sementeDaVotacao(semente, v.tela)))

// a roleta do empate: acende as empatadas em círculo e pára na vencedora (voltas = o que apurar devolve)
export const passosDaRoleta = (empatadas, voltas) => Array.from({ length: Math.max(0, voltas) + 1 }, (_, k) => empatadas[k % empatadas.length])
