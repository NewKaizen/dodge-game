// Eleição do HOST DA PARTIDA pela melhor conexão (Fase 5A; docs/rede-pvp.md
// "Host da partida"). Lógica pura, testada em __tests__/eleicao.test.js.
//
// Numa sala de amigos o DONO (quem criou) cuida do lobby: tira gente, escolhe o
// modo, convida. O HOST DA PARTIDA é a autoridade e o centro da estrela daquela
// partida. Quando o dono começa, o servidor mede por ELEICAO_MS e escolhe:
//
//   elegerHost({ membros, diretos, dono }) -> { host, motivo, pontos }
//     membros: [{ id, vaga, ping (ms até o servidor | null), quedas (nesta sala) }]
//     diretos: { [id]: { [outroId]: rtt em ms } }  o RTT medido no canal direto
//              (WebRTC) que já estava aberto; quem não tem direto com alguém não manda
//     dono:    id do dono (o host de antes de qualquer eleição)
//
// O CUSTO de cada candidato h (menor é melhor):
//   ligação(h, o) = o RTT direto entre h e o (o menor dos dois relatos), ou, sem
//                   direto, o caminho pelo servidor: ping(h) + ping(o) + RELE_EXTRA_MS
//   atraso de cada PAR de jogadores na estrela de h (só ida):
//     h com o        ligação(h, o) / 2
//     a com b        (ligação(h, a) + ligação(h, b)) / 2   (a -> h -> b)
//   pontos(h) = (pior par + média dos pares) / 2 + QUEDA_MS × quedas(h)
// Quem não tem como medir a ligação com alguém (sem direto e sem ping) não concorre.
// Fica o DONO se: faltam medidas para ele, a sala tem menos de 2, ou o melhor não
// ganha dele por mais de MARGEM_MS (troca à toa custa a estrela de novo). Empate
// entre outros: a menor vaga. Com 2 jogadores a ligação é a mesma nos dois sentidos:
// decide a estabilidade (quedas) e, no empate, fica o dono.
export const ELEICAO_MS = 1500 // a janela de medição
export const MARGEM_MS = 30
export const RELE_EXTRA_MS = 15 // o servidor no meio do caminho (fila, processamento)
export const QUEDA_MS = 40 // cada queda/retomada nesta sala pesa como 40 ms
export const MAX_RTT_MS = 5000

const numero = (x) => (Number.isFinite(x) && x >= 0 && x <= MAX_RTT_MS ? x : null)

// o RTT entre a e b: o direto (o menor dos dois relatos) ou pelo servidor
export function ligacao(a, b, diretos) {
  const d = [numero(diretos?.[a.id]?.[b.id]), numero(diretos?.[b.id]?.[a.id])].filter((x) => x != null)
  if (d.length) return { ms: Math.min(...d), direto: true }
  const pa = numero(a.ping)
  const pb = numero(b.ping)
  if (pa == null || pb == null) return null
  return { ms: pa + pb + RELE_EXTRA_MS, direto: false }
}

// pontos de h (null: falta medida para algum par)
export function pontuar(h, membros, diretos) {
  const outros = membros.filter((m) => m.id !== h.id)
  const lig = new Map()
  for (const o of outros) {
    const l = ligacao(h, o, diretos)
    if (!l) return null
    lig.set(o.id, l.ms)
  }
  const pares = outros.map((o) => lig.get(o.id) / 2)
  for (let i = 0; i < outros.length; i++) for (let j = i + 1; j < outros.length; j++) pares.push((lig.get(outros[i].id) + lig.get(outros[j].id)) / 2)
  if (!pares.length) return null
  const pior = Math.max(...pares)
  const media = pares.reduce((a, b) => a + b, 0) / pares.length
  return Math.round(((pior + media) / 2 + QUEDA_MS * (Number(membros.find((m) => m.id === h.id)?.quedas) || 0)) * 10) / 10
}

export function elegerHost({ membros = [], diretos = {}, dono = null, margemMs = MARGEM_MS } = {}) {
  const pontos = Object.fromEntries(membros.map((m) => [m.id, pontuar(m, membros, diretos)]))
  const ficaDono = (motivo) => ({ host: dono, motivo, pontos })
  if (membros.length < 2 || !membros.some((m) => m.id === dono)) return ficaDono('sem_sala')
  if (pontos[dono] == null) return ficaDono('sem_medidas')
  const candidatos = membros.filter((m) => pontos[m.id] != null).sort((a, b) => pontos[a.id] - pontos[b.id] || (a.vaga ?? 99) - (b.vaga ?? 99))
  const melhor = candidatos[0]
  if (melhor.id === dono || pontos[dono] - pontos[melhor.id] <= margemMs) return ficaDono(melhor.id === dono ? 'melhor_conexao' : 'margem')
  return { host: melhor.id, motivo: 'melhor_conexao', pontos }
}

// o que o cliente mandou como medidas (só ids da sala, números que fazem sentido)
export function lerDiretos(m, ids) {
  const saida = {}
  if (!m || typeof m !== 'object') return saida
  for (const id of ids) {
    const ms = numero(Number(m[id]))
    if (ms != null && Object.hasOwn(m, id)) saida[id] = ms
  }
  return saida
}
