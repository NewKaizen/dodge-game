// CONQUISTAS e MAESTRIA no servidor (Fase 4B; docs/desafio-diario.md "Conquistas e maestria").
//
// O servidor só desbloqueia onde ele JÁ sabe da partida: depois da concessão do XP de uma partida
// (server/partidas.js), no fim de uma corrida da campanha e no fim do desafio diário
// (server/campanha.js). Cada evento vai UMA vez para o banco (registrar_evento_conta, idempotente pela
// referência: o id da partida ou da corrida): ele soma a maestria do personagem (com o teto do dia) e
// devolve o resumo da conta. Com o resumo e o evento, as regras puras (src/lib/conquistas.js) dizem
// quais conquistas valem; desbloquear_conquistas grava só as que faltam e devolve as NOVAS. Repetir o
// evento (reconexão, retentativa) não soma maestria de novo e não devolve conquista repetida.
//
//   const conquistas = criarConquistas({ registro, log })
//   await conquistas.evento(usuario, ref, ev)   -> { novas: [ids], itensNovos: [ids], maestria } | null
//   await conquistas.estado(usuario)            -> { conquistas: [{ id, em }], maestria: [{ personagem, pontos, partidas, vitorias }] }
//
// registro: o banco (criarRegistro em server/partidas.js) ou null (sem contas: nada acontece)
import { conquistasDoEvento, PERSONAGENS_MAESTRIA } from '../src/lib/conquistas.js'

const REF = /^[A-Za-z0-9:_-]{8,80}$/

export function criarConquistas({ registro = null, log = () => {} } = {}) {
  async function evento(usuario, ref, ev = {}) {
    if (!usuario || !registro?.registrarEventoConta || !REF.test(String(ref ?? ''))) return null
    const personagem = PERSONAGENS_MAESTRIA.includes(ev.personagem) ? ev.personagem : null
    const r = await registro.registrarEventoConta({ usuario, ref: String(ref), tipo: ev.tipo, modo: ev.modo ?? null, personagem, resultado: ev.resultado ?? null })
    const ids = conquistasDoEvento({ ...ev, personagem }, r.resumo ?? {})
    const novas = ids.length && registro.desbloquearConquistas ? await registro.desbloquearConquistas(usuario, ids) : []
    return { novas, itensNovos: r.itensNovos ?? [], maestria: r.maestria ?? null }
  }

  return {
    // nunca derruba quem chamou: um erro aqui só vai para o log
    async evento(usuario, ref, ev) {
      try {
        return await evento(usuario, ref, ev)
      } catch (e) {
        log(`[conquistas] evento ${ref}: ${e.message}`)
        return null
      }
    },
    async estado(usuario) {
      if (!usuario || !registro?.conquistasDaConta) return { conquistas: [], maestria: [] }
      return registro.conquistasDaConta(usuario)
    },
  }
}

// a mensagem para o navegador (só quando há algo novo)
export const msgConquistas = (r) => (r && (r.novas?.length || r.itensNovos?.length) ? { t: 'conquistas', novas: r.novas ?? [], itensNovos: r.itensNovos ?? [], maestria: r.maestria ?? null } : null)
