// MODO PARTY: a escolha de personagem feita na ESPERA (tela CONTINUAR e votações), docs/online.md
// "Modo Party". Lógica pura, sem Phaser e sem rede (testada em __tests__/escolha.test.js).
//
// Cada vaga tem um palpite de personagem (`picks`: {vaga: id}) que ela troca com ↑/↓ nas telas da party.
// O HOST é a autoridade: o primeiro pedido a chegar leva o personagem (sem repetir, a regra do
// EscolhaPartyN), e ele manda os picks de todos. Depois do voto do mapa o host monta a partida direto
// (`montarInicio`), sem a cena de escolha de personagem.
//
//   iniciarPicks(...)   os picks de quem está na sala: mantém os válidos, o resto vira o último usado
//   vizinho(...)        o próximo personagem livre (↑/↓)
//   pedir(...)          o pedido de uma vaga (primeiro a chegar leva)
//   resolver(...)       a lista por vaga da partida: pick válido fica; senão o último válido / o mais próximo livre
//   montarInicio(...)   a cena e os dados da partida (inclui os picks de todos)
import { criarParty } from '../coop/partyN.js'
import { ehPvp } from './regras.js'

// o personagem de partida de uma vaga: o último usado por ela; senão um por vaga
export const padraoDe = (vaga, ids, ultima = []) => (ids.includes(ultima[vaga]) ? ultima[vaga] : ids[vaga % ids.length])

// o id livre mais próximo de `id` (a ordem da grade, em círculo, para a frente); `ocupados`: ids já tomados
function maisProximoLivre(id, ids, ocupados) {
  const base = Math.max(0, ids.indexOf(id))
  for (let k = 0; k < ids.length; k++) {
    const candidato = ids[(base + k) % ids.length]
    if (!ocupados.has(candidato)) return candidato
  }
  return id
}

// presentes: as vagas na sala. anteriores: os picks que já existiam (sobrevivem se ainda valem); ultima: a
// lista por vaga da última partida (registry 'party' / localStorage). Quem saiu perde o pick; quem entrou
// ganha o padrão (o último usado, ou o mais próximo livre se alguém já o tem)
export function iniciarPicks({ presentes, ids, anteriores = {}, ultima = [] }) {
  const picks = {}
  const tomados = new Set()
  const vagas = [...presentes].sort((a, b) => a - b)
  for (const v of vagas) {
    const antes = anteriores[v]
    if (ids.includes(antes) && !tomados.has(antes)) {
      picks[v] = antes
      tomados.add(antes)
    }
  }
  for (const v of vagas) {
    if (picks[v]) continue
    picks[v] = maisProximoLivre(padraoDe(v, ids, ultima), ids, tomados)
    tomados.add(picks[v])
  }
  return picks
}

// ↑/↓: o próximo personagem que ninguém mais tem (passo -1 ou 1); sem livre, fica onde está
export function vizinho(picks, vaga, passo, ids) {
  const atual = Math.max(0, ids.indexOf(picks[vaga]))
  const tomados = new Set(Object.entries(picks).filter(([v]) => Number(v) !== vaga).map(([, id]) => id))
  for (let k = 1; k < ids.length; k++) {
    const id = ids[(atual + passo * k + ids.length * k) % ids.length]
    if (!tomados.has(id)) return id
  }
  return picks[vaga]
}

// o pedido de uma vaga (host). { picks, ok }: id fora do elenco, vaga fora da sala ou id de outra vaga = recusado
export function pedir(picks, vaga, id, ids, presentes) {
  if (!ids.includes(id) || !presentes.includes(vaga) || picks[vaga] === id) return { picks, ok: false }
  if (Object.entries(picks).some(([v, outro]) => Number(v) !== vaga && outro === id)) return { picks, ok: false }
  return { picks: { ...picks, [vaga]: id }, ok: true }
}

// A lista por vaga da partida (a que a arena recebe). Regra: o pick VÁLIDO fica (no elenco e que ninguém de
// vaga menor já tenha); senão vale o último usado da vaga; senão o mais próximo livre. Quem não está na sala
// fica com um personagem que ninguém pegou (aparece "SAIU" na arena). Mesma regra no PVP (2x2, todos) e no
// CO-OP: nenhum repete e o elenco é o mesmo.
export function resolver({ picks, presentes, ids, ultima = [], tamanho }) {
  const n = tamanho ?? Math.max(3, Math.max(...presentes) + 1)
  const party = criarParty({ vagas: n })
  const tomados = new Set()
  for (const v of [...presentes].sort((a, b) => a - b)) {
    const quer = picks?.[v]
    const ultimo = ultima[v]
    const id = [quer, ultimo].find((x) => ids.includes(x) && !tomados.has(x)) ?? maisProximoLivre(quer ?? padraoDe(v, ids, ultima), ids, tomados)
    party.confirmar(v, id, ids)
    tomados.add(id)
  }
  return party.lista(ids, n)
}

// Monta a partida da party (host), com os picks de todos. Devolve { cena, dados, lista }:
//   PVP (2x2 / todos): PvpArenaN {personagens, arena, semente[, modo, times]}
//   CO-OP: Dificuldade {chefe, party, nivel} (o nível chega pré-escolhido: a cena confirma sozinha em 3 s)
export function montarInicio({ modo, vencedora, picks, presentes, ids, ultima = [], times = null, nivel = null, agora = Date.now() }) {
  const lista = resolver({ picks, presentes, ids, ultima })
  if (!ehPvp(modo)) return { cena: 'Dificuldade', dados: { chefe: vencedora, party: lista, nivel }, lista }
  if (modo === '2x2' && lista.length === 4) return { cena: 'PvpArenaN', dados: { personagens: lista, arena: vencedora, semente: `2x2:${agora}`, modo: '2x2', times }, lista }
  return { cena: 'PvpArenaN', dados: { personagens: lista, arena: vencedora, semente: `ffa:${agora}` }, lista }
}
