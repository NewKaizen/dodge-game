// MODO PARTY: o placar da party (a rivalidade entre as partidas). Lógica pura, sem Phaser e sem rede
// (testada em __tests__/placar.test.js). Quem guarda é o HOST da party (registry 'partyPlacar'); ele
// manda o placar junto da apresentação (PartyIntro) e da tela CONTINUAR/SAIR (PartyFim).
//
// Pontos por partida:
//   TODOS CONTRA TODOS   1º 3 · 2º 2 · 3º 1 · 4º 0 (a classificação da PvpResultadoN)
//   2x2                  cada um do time vencedor 3 · empate 1 para todos
//   CO-OP                chefe derrotado: 2 para todos · derrota: 0
// Quem vence (1º, time vencedor, chefe derrotado) soma uma vitória e aumenta a sequência; quem perde zera
// a sua. Cada partida é registrada uma vez só (o id que a PartyVoto deu a ela).

export const PONTOS_FFA = [3, 2, 1, 0]
export const PONTOS_DUPLA = { vitoria: 3, empate: 1 }
export const PONTOS_COOP = 2

export const novoPlacar = () => ({ partidas: 0, ultima: null, pontos: {}, vitorias: {}, sequencia: {}, ganho: {}, chefes: 0 })

// placar vindo da rede ou do registry: sempre no formato certo
export function normalizarPlacar(p) {
  const base = novoPlacar()
  if (!p || typeof p !== 'object') return base
  const mapa = (m) => Object.fromEntries(Object.entries(m && typeof m === 'object' ? m : {}).filter(([v, n]) => Number.isInteger(Number(v)) && Number.isFinite(n)).map(([v, n]) => [Number(v), n]))
  return {
    partidas: Number.isFinite(p.partidas) ? p.partidas : 0,
    ultima: p.ultima ?? null,
    pontos: mapa(p.pontos),
    vitorias: mapa(p.vitorias),
    sequencia: mapa(p.sequencia),
    ganho: mapa(p.ganho),
    chefes: Number.isFinite(p.chefes) ? p.chefes : 0,
  }
}

// soma a partida `id`: ganhos = {vaga: pontos}, vencedores = [vagas], vagas = quem jogou
function somar(placar, id, vagas, ganhos, vencedores, extra = {}) {
  const p = normalizarPlacar(placar)
  if (id != null && p.ultima === id) return p // a mesma partida de novo (a cena abriu duas vezes)
  const novo = { ...p, partidas: p.partidas + 1, ultima: id ?? null, pontos: { ...p.pontos }, vitorias: { ...p.vitorias }, sequencia: { ...p.sequencia }, ganho: {}, ...extra }
  for (const v of vagas) {
    const g = ganhos[v] ?? 0
    novo.pontos[v] = (novo.pontos[v] ?? 0) + g
    novo.ganho[v] = g
    if (vencedores.includes(v)) {
      novo.vitorias[v] = (novo.vitorias[v] ?? 0) + 1
      novo.sequencia[v] = (novo.sequencia[v] ?? 0) + 1
    } else novo.sequencia[v] = 0
  }
  return novo
}

// classificacao: as vagas do 1º ao último
export function registrarFfa(placar, { id, classificacao }) {
  const ordem = (classificacao ?? []).filter((v) => Number.isInteger(v))
  const ganhos = Object.fromEntries(ordem.map((v, k) => [v, PONTOS_FFA[k] ?? 0]))
  return somar(placar, id, ordem, ganhos, ordem.slice(0, 1))
}

// times[vaga] = 0 | 1; vencedorTime null = empate
export function registrarDupla(placar, { id, times, vencedorTime }) {
  const vagas = (times ?? []).map((_, v) => v)
  const empate = vencedorTime == null
  const vencedores = empate ? [] : vagas.filter((v) => times[v] === vencedorTime)
  const ganhos = Object.fromEntries(vagas.map((v) => [v, empate ? PONTOS_DUPLA.empate : vencedores.includes(v) ? PONTOS_DUPLA.vitoria : 0]))
  return somar(placar, id, vagas, ganhos, vencedores)
}

export function registrarCoop(placar, { id, vagas, venceu }) {
  const lista = (vagas ?? []).filter((v) => Number.isInteger(v))
  const ganhos = Object.fromEntries(lista.map((v) => [v, venceu ? PONTOS_COOP : 0]))
  const p = normalizarPlacar(placar)
  return somar(p, id, lista, ganhos, venceu ? lista : [], { chefes: p.chefes + (venceu ? 1 : 0) })
}

// as vagas presentes do mais pontos ao menos (empate: mais vitórias, depois a vaga menor)
export function ranking(placar, presentes) {
  const p = normalizarPlacar(placar)
  return [...presentes].sort((a, b) => (p.pontos[b] ?? 0) - (p.pontos[a] ?? 0) || (p.vitorias[b] ?? 0) - (p.vitorias[a] ?? 0) || a - b)
}

// o líder da party: o único com mais pontos (com pontos > 0); empate no topo = sem coroa
export function lider(placar, presentes) {
  const p = normalizarPlacar(placar)
  const [a, b] = ranking(p, presentes)
  if (a == null || !(p.pontos[a] > 0)) return null
  return b != null && (p.pontos[b] ?? 0) === p.pontos[a] ? null : a
}

export const rotuloPontos = (n) => `${n} PT${n === 1 ? '' : 'S'}`

// a frase da rivalidade para o topo da tela (a mais quente que couber)
export function manchete(placar, presentes, nomeDe = (v) => `P${v + 1}`) {
  const p = normalizarPlacar(placar)
  if (!p.partidas) return 'a primeira partida da party: todo mundo zerado'
  const emChamas = [...presentes].filter((v) => (p.sequencia[v] ?? 0) >= 2).sort((a, b) => p.sequencia[b] - p.sequencia[a])[0]
  if (emChamas != null) return `${nomeDe(emChamas)} está EM CHAMAS: ${p.sequencia[emChamas]} vitórias seguidas`
  const l = lider(p, presentes)
  const ord = ranking(p, presentes)
  if (l == null) return 'empate no topo: a próxima decide'
  const dif = (p.pontos[l] ?? 0) - (p.pontos[ord[1]] ?? 0)
  return dif <= 2 ? `${nomeDe(l)} lidera por ${dif}: dá para virar!` : `${nomeDe(l)} lidera com folga: alguém para ele!`
}
