// Fim da partida do TODOS CONTRA TODOS (3 e 4, em rede; Fase 5D): o que cada vaga quer fazer e quando
// TODOS concordam (lógica pura, testada em __tests__/fimDePartidaN.test.js; a cena é PvpResultadoN). É o
// acordo da 2E (pvp/fimDePartidaRede.js) para N:
//   REVANCHE            os mesmos personagens e a mesma arena, partida nova
//   TROCAR PERSONAGEM   todos voltam à escolha de lutador (PvpEscolhaN)
// Só começa quando TODOS os que estão na sala escolheram; um TROCAR vale para todos. Quem não responde em
// ESPERA_MS cancela a espera (todos podem escolher de novo). VOLTAR AO LOBBY vale na hora (o do host leva
// todos; o do convidado pede ao host). Quem SAI da sala nessa hora não segura os outros (sai da conta).
// 2x2 (Fase 5E): também TROCAR TIME (a revanche com o próximo arranjo dos times, src/lib/times2x2.js). Todos
// precisam responder; vale a maior mudança pedida: TROCAR PERSONAGEM > TROCAR TIME > REVANCHE.
import { ESPERA_MS, ROTULO as ROTULO_2 } from './fimDePartidaRede.js'

export const ROTULO = { ...ROTULO_2, trocarTime: 'TROCAR TIME' }
export { ESPERA_MS }
export const OPCOES_N = ['revanche', 'trocar', 'lobby']
export const OPCOES_2X2 = ['revanche', 'trocar', 'trocarTime', 'lobby']

export const novoAceiteN = () => ({ escolhas: {}, ate: null })

const vale = (e) => (e === 'revanche' || e === 'trocar' || e === 'trocarTime' ? e : null)

// a vaga escolheu (a espera começa na primeira escolha); repetir a mesma escolha não muda nada
export function registrarN(aceite, vaga, escolha, agora) {
  const e = vale(escolha)
  if (!e || !Number.isInteger(vaga) || vaga < 0) return aceite
  return { escolhas: { ...aceite.escolhas, [vaga]: e }, ate: aceite.ate ?? agora + ESPERA_MS }
}

// todos os `presentes` escolheram? null (ainda não) | 'revanche' | 'trocar'
export function decidirN(aceite, presentes) {
  if (!presentes.length || !presentes.every((v) => aceite.escolhas[v])) return null
  const pediu = (e) => presentes.some((v) => aceite.escolhas[v] === e)
  return pediu('trocar') ? 'trocar' : pediu('trocarTime') ? 'trocarTime' : 'revanche'
}

export const expirouN = ({ ate }, agora) => ate != null && agora >= ate

export const restanteN = ({ ate }, agora) => (ate == null ? 0 : Math.max(0, Math.ceil((ate - agora) / 1000)))

// as linhas de "quem escolheu o quê", por vaga: { vaga, texto, pronto }
export function linhasDoAceiteN(aceite, presentes) {
  return presentes.map((vaga) => ({ vaga, texto: aceite.escolhas[vaga] ? ROTULO[aceite.escolhas[vaga]] : 'escolhendo…', pronto: Boolean(aceite.escolhas[vaga]) }))
}

// a frase do que falta
export function dicaDoAceiteN(aceite, presentes, agora) {
  const faltam = presentes.filter((v) => !aceite.escolhas[v]).length
  if (!Object.keys(aceite.escolhas).length) return ''
  const acao = decidirN(aceite, presentes)
  if (acao) return acao === 'trocar' ? 'trocando de personagem…' : acao === 'trocarTime' ? 'trocando os times…' : 'revanche!'
  return `esperando ${faltam} jogador${faltam > 1 ? 'es' : ''} (${restanteN(aceite, agora)}s)`
}
