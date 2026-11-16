// As dicas do CO-OP 2.0 que aparecem UMA vez por PC (o cartão COMO FUNCIONA, "Encoste na alma...", a
// primeira QUEBRA...): ficam no navegador (localStorage), numa chave própria. Sem localStorage (testes,
// modo privado travado) cada dica aparece uma vez por sessão.
//
//   jaViu(id) · marcarVisto(id) · umaVez(id) -> true na primeira vez (e marca) · esquecerDicas()
const CHAVE = 'dodge-coop-dicas'
let memoria = null

function ler() {
  if (memoria) return memoria
  try {
    memoria = JSON.parse(globalThis.localStorage?.getItem(CHAVE) ?? '{}') ?? {}
  } catch {
    memoria = {}
  }
  if (typeof memoria !== 'object' || Array.isArray(memoria)) memoria = {}
  return memoria
}

export const jaViu = (id) => Boolean(ler()[id])

export function marcarVisto(id) {
  const m = ler()
  m[id] = true
  try {
    globalThis.localStorage?.setItem(CHAVE, JSON.stringify(m))
  } catch {
    /* sem espaço / bloqueado: vale só nesta sessão */
  }
}

export function umaVez(id) {
  if (jaViu(id)) return false
  marcarVisto(id)
  return true
}

export function esquecerDicas() {
  memoria = {}
  try {
    globalThis.localStorage?.removeItem(CHAVE)
  } catch {
    /* nada */
  }
}
