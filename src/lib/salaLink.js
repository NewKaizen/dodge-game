// Link de convite para uma sala ONLINE: https://<site>/?sala=K7QX2
// Quem abre o link cai direto na tela ONLINE e entra na sala (sem precisar de
// conta). O código é o mesmo que o host já passa de boca (server/lan.js).

export const TAMANHO_CODIGO = 5
const ALFABETO = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/

// '?sala=k7qx2' -> 'K7QX2'; '' se não tem ou não parece um código
export function codigoDaBusca(busca) {
  let valor
  try {
    valor = new URLSearchParams(String(busca ?? '')).get('sala')
  } catch {
    return ''
  }
  const codigo = String(valor ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  return codigo.length === TAMANHO_CODIGO && ALFABETO.test(codigo) ? codigo : ''
}

// origem: 'https://dodge.onrender.com' (location.origin)
export function linkDaSala(codigo, origem) {
  const c = String(codigo ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (!c) return ''
  return `${String(origem ?? '').replace(/\/+$/, '')}/?sala=${c}`
}

// tira o ?sala= da barra de endereço (para um F5 não tentar entrar de novo)
export function limparSalaDaUrl() {
  try {
    const url = new URL(location.href)
    if (!url.searchParams.has('sala')) return
    url.searchParams.delete('sala')
    history.replaceState(history.state, '', url.pathname + url.search + url.hash)
  } catch {}
}
