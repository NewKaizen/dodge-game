// BAÚS no servidor (docs/baus.md). Só se ganha jogando: nada aqui (nem em lugar nenhum) vende baú.
//
// CONCEDER: o servidor só concede onde ele JÁ sabe do que aconteceu, depois da concessão de sempre:
//   * subiu de nível         um baú por nível novo           (partidas, campanha, desafio: nivelAntes/nivelDepois)
//   * baú do dia             a 1ª partida TERMINADA do dia   (partidas: resultado jogado; campanha e desafio: vitória/derrota)
//   * desafio diário         a 1ª vitória do dia             (campanha.js, primeiraHoje)
//   * boss semanal           o troféu da semana               (partidas.js, trofeu.novo)
//   * algumas conquistas     CONQUISTAS_COM_BAU               (conquistas.js, as novas)
// Cada fonte tem uma CHAVE por conta no banco (conceder_bau, unique (conta, chave)): repetir, reconectar ou
// mandar em paralelo não dá dois baús. O banco confere a fonte de novo (nível alcançado, desafio vencido...).
//
// ABRIR: os números saem do crypto.randomInt DAQUI (o navegador nunca sorteia nada) e as regras rodam no
// banco (abrir_bau), com a conta travada: a pena (épico garantido a cada PITY) e o "já tinha" ficam certos
// mesmo com dois pedidos juntos.
//
//   const baus = criarBaus({ registro, log, sortear })
//   await baus.conceder(usuario, fonte, ref)         -> { novo, fonte, fechados } | null   (nunca lança)
//   await baus.depoisDoXp(usuario, { nivelAntes, nivelDepois, jogou, desafioDia, semana, conquistas })
//                                                    -> [{ fonte, ... }] os NOVOS (para o aviso)
//   await baus.estado(usuario)                       -> { fechados, abertos, desdeEpico, lista }
//   await baus.abrir(usuario, bauId?)                -> { aberto, recompensas, xpGanho, ... }
//
// registro: o banco (criarRegistro em server/partidas.js) ou null (sem contas: nada acontece)
import crypto from 'node:crypto'
import { ESCALA, SORTEIO_TAMANHO, CONQUISTAS_COM_BAU, ehItemDoBau } from '../src/lib/cosmeticos.js'

export const ABRIR_INTERVALO_MS = 1500 // um "abrir" por conexão a cada 1,5 s (a animação leva mais que isso)
export const ESTADO_INTERVALO_MS = 1000 // um pedido do estado por conexão por segundo
export const MAX_NIVEIS_POR_VEZ = 10 // subiu 30 níveis de uma vez? (não acontece) no máximo 10 baús por concessão

export const sortearPadrao = () => Array.from({ length: SORTEIO_TAMANHO }, () => crypto.randomInt(0, ESCALA))

export function criarBaus({ registro = null, log = () => {}, sortear = sortearPadrao } = {}) {
  const disponivel = () => Boolean(registro?.concederBau)

  async function conceder(usuario, fonte, ref) {
    if (!usuario || !disponivel()) return null
    try {
      return await registro.concederBau(usuario, fonte, ref == null ? null : String(ref))
    } catch (e) {
      log(`[baus] ${fonte}:${ref ?? ''} de ${usuario}: ${e.message}`)
      return null
    }
  }

  // tudo que uma concessão de XP pode render de baú (cada um com a própria chave no banco)
  async function depoisDoXp(usuario, { nivelAntes = null, nivelDepois = null, jogou = false, desafioDia = null, semana = null, conquistas = [] } = {}) {
    if (!usuario || !disponivel()) return []
    const novos = []
    const somar = (r) => r?.novo && novos.push(r)
    if (Number.isInteger(nivelAntes) && Number.isInteger(nivelDepois) && nivelDepois > nivelAntes)
      for (let n = Math.max(2, nivelAntes + 1, nivelDepois - MAX_NIVEIS_POR_VEZ + 1); n <= nivelDepois; n++) somar(await conceder(usuario, 'nivel', n))
    if (jogou) somar(await conceder(usuario, 'dia', null))
    if (desafioDia) somar(await conceder(usuario, 'desafio', desafioDia))
    if (semana) somar(await conceder(usuario, 'semanal', semana))
    for (const id of conquistas ?? []) if (CONQUISTAS_COM_BAU.includes(id)) somar(await conceder(usuario, 'conquista', id))
    return novos
  }

  async function estado(usuario) {
    if (!usuario || !registro?.estadoBaus) return { fechados: 0, abertos: 0, desdeEpico: 0, lista: [] }
    return registro.estadoBaus(usuario)
  }

  async function abrir(usuario, bauId = null) {
    if (!usuario || !registro?.abrirBau) return { aberto: false, motivo: 'indisponivel' }
    const r = await registro.abrirBau(usuario, bauId, sortear())
    // só o que o catálogo conhece vai para o navegador
    if (r.aberto) r.recompensas = r.recompensas.filter((x) => x.tipo === 'xp' || ehItemDoBau(x.id))
    return r
  }

  return { disponivel, conceder, depoisDoXp, estado, abrir }
}

// a mensagem do aviso "você ganhou um baú" (só com algo novo)
export const msgBauGanho = (novos) => (novos?.length ? { t: 'bauGanho', fontes: novos.map((n) => n.fonte), fechados: Math.max(...novos.map((n) => Number(n.fechados) || 0)) } : null)
