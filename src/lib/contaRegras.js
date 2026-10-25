// Regras da conta que o navegador confere antes de mandar (o banco confere de
// novo: supabase/migrations/0001_contas.sql, normalizar_nome e atualizar_perfil).
//
//   validarNome(texto)  -> { ok: true, nome } | { ok: false, erro }
//   AVATARES_JOGO       avatares prontos (os personagens jogáveis)
//   avatarDoPerfil(p)   -> { tipo: 'padrao'|'jogo'|'enviado', id, url }

export const NOME_MIN = 3
export const NOME_MAX = 16
// letras (com acento), números, espaço, _ . -  (o [[:alnum:] _.-] do banco)
const PERMITIDO = /^[\p{L}\p{N} _.-]+$/u

export const AVATARES_JOGO = ['kris', 'susie', 'ralsei', 'noelle', 'berdly', 'dess', 'asriel']
export const TIPOS_AVATAR = ['padrao', 'jogo', 'enviado']

export function validarNome(texto) {
  const nome = String(texto ?? '')
    .trim()
    .replace(/\s+/g, ' ')
  const tamanho = [...nome].length
  if (tamanho < NOME_MIN) return { ok: false, erro: `o nome precisa de pelo menos ${NOME_MIN} letras` }
  if (tamanho > NOME_MAX) return { ok: false, erro: `o nome pode ter no máximo ${NOME_MAX} letras` }
  if (!PERMITIDO.test(nome)) return { ok: false, erro: 'use só letras, números, espaço, _ . -' }
  return { ok: true, nome }
}

export function avatarDoPerfil(perfil) {
  if (perfil?.avatar_tipo === 'enviado' && perfil.avatar_url) return { tipo: 'enviado', id: null, url: perfil.avatar_url }
  if (perfil?.avatar_tipo === 'jogo' && AVATARES_JOGO.includes(perfil.avatar_id)) return { tipo: 'jogo', id: perfil.avatar_id, url: null }
  return { tipo: 'padrao', id: null, url: null }
}

// XP para passar do nível: PROVISÓRIO (a curva de verdade chega na 1D)
export const xpDoNivel = (nivel) => 100 * Math.max(1, Math.floor(Number(nivel) || 1))
