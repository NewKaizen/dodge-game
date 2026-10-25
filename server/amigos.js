// Amigos no lobby (Fase 1B; docs/online.md, docs/supabase.md).
//
// O banco guarda quem é amigo de quem (supabase/migrations/0002_amigos.sql) e
// o navegador mexe nisso só pelas funções do Supabase. O servidor só LÊ
// (com a service_role) para decidir quem pode ver a presença de quem e quem
// pode convidar quem. Regra de ouro: só vale se a amizade é MÚTUA no que o
// servidor sabe e não há bloqueio em nenhuma direção.
//
//   const relacoes = criarRelacoes(supabase)
//   await relacoes(userId)   { amigos:Set, bloqueios:Set, pedidos:Set } | null (erro)
//     amigos:    ids dos amigos
//     bloqueios: ids que EU bloqueei + ids que ME bloquearam
//     pedidos:   ids com pedido pendente (nos dois sentidos); só serve para
//                saber a quem avisar de que a lista mudou

export const CONVITE_MS = 60_000 // validade do convite
export const CONVITES_POR_MINUTO = 5 // por quem convida
export const MAX_CONVITES_RECEBIDOS = 10 // pendentes ao mesmo tempo para a mesma pessoa

export function criarRelacoes(supabase) {
  const ler = async (tabela, colunas, coluna, id) => {
    const r = await supabase.from(tabela).select(colunas).eq(coluna, id)
    if (r.error) throw new Error(r.error.message)
    return r.data ?? []
  }
  return async function relacoes(id) {
    if (!supabase || !id) return null
    try {
      const [amA, amB, blA, blB, peA, peB] = await Promise.all([
        ler('amizades', 'a, b', 'a', id),
        ler('amizades', 'a, b', 'b', id),
        ler('bloqueios', 'quem, bloqueado', 'quem', id),
        ler('bloqueios', 'quem, bloqueado', 'bloqueado', id),
        ler('pedidos_amizade', 'de, para', 'de', id),
        ler('pedidos_amizade', 'de, para', 'para', id),
      ])
      const outro = (l, a, b) => (l[a] === id ? l[b] : l[a])
      return {
        amigos: new Set([...amA, ...amB].map((l) => outro(l, 'a', 'b'))),
        bloqueios: new Set([...blA, ...blB].map((l) => outro(l, 'quem', 'bloqueado'))),
        pedidos: new Set([...peA, ...peB].map((l) => outro(l, 'de', 'para'))),
      }
    } catch {
      return null
    }
  }
}
