// Fila de avisos (toasts) dos menus: lógica pura, sem Phaser (testada em
// __tests__/avisos.test.js). Quem desenha é conta/avisos.js.
//
// Um aviso: { id, tipo, titulo, texto?, avatar?, ms?, ate? }
//   ms   quanto tempo fica na tela (padrão MS_PADRAO)
//   ate  fim absoluto (Date.now()): o convite de amigo vale até lá; passou, o aviso some sem aparecer
//
//   const fila = criarFilaAvisos()
//   fila.empurrar(aviso)            false se o id já passou por aqui (não repete)
//   fila.descartar(id)              tira da fila e da tela (o convite foi respondido / expirou)
//   fila.atualizar(agora, pode)     o aviso da vez (ou null). `pode` false = não estamos num menu
//                                   (partida rolando): ninguém aparece e o da tela volta ao começo da fila
//   fila.atual() · fila.pendentes()
export const MS_PADRAO = 5000
export const PAUSA_ENTRE_MS = 350 // folga entre um aviso e o seguinte
const MAX_FILA = 12
const MAX_VISTOS = 200

export function criarFilaAvisos({ pausaMs = PAUSA_ENTRE_MS, max = MAX_FILA } = {}) {
  let itens = []
  let atual = null // { aviso, fim }
  let livreEm = 0 // a partir de quando o próximo pode entrar
  const vistos = new Set()

  const venceu = (aviso, agora) => aviso.ate != null && aviso.ate <= agora

  return {
    empurrar(aviso) {
      if (!aviso?.id || vistos.has(aviso.id)) return false
      vistos.add(aviso.id)
      if (vistos.size > MAX_VISTOS) vistos.delete(vistos.values().next().value)
      itens.push(aviso)
      // fila cheia: o mais antigo que não é convite sai (convite tem relógio próprio)
      while (itens.length > max) {
        const i = itens.findIndex((a) => a.tipo !== 'convite')
        itens.splice(i < 0 ? 0 : i, 1)
      }
      return true
    },

    descartar(id) {
      itens = itens.filter((a) => a.id !== id)
      if (atual?.aviso.id === id) {
        atual = null
        livreEm = 0
      }
    },

    atualizar(agora, pode = true) {
      if (atual && !pode) {
        itens.unshift(atual.aviso)
        atual = null
      }
      if (atual && (agora >= atual.fim || venceu(atual.aviso, agora))) {
        atual = null
        livreEm = agora + pausaMs
      }
      if (!atual && pode && agora >= livreEm) {
        itens = itens.filter((a) => !venceu(a, agora))
        const proximo = itens.shift()
        if (proximo) atual = { aviso: proximo, fim: proximo.ate ?? agora + (proximo.ms ?? MS_PADRAO) }
      }
      return atual?.aviso ?? null
    },

    // quanto falta para o aviso da tela sumir (ms); null sem aviso
    restante: (agora) => (atual ? Math.max(0, atual.fim - agora) : null),
    atual: () => atual?.aviso ?? null,
    pendentes: () => itens.length,
  }
}
