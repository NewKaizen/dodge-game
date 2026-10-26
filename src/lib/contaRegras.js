// Regras da conta que o navegador confere antes de mandar (o banco confere de
// novo: supabase/migrations/0001_contas.sql, normalizar_nome e atualizar_perfil).
//
//   validarNome(texto)  -> { ok: true, nome } | { ok: false, erro }
//   AVATARES_JOGO       avatares prontos (os personagens jogáveis)
//   avatarDoPerfil(p)   -> { tipo: 'padrao'|'jogo'|'enviado', id, url }
//   (o XP e os níveis estão em lib/progresso.js)

export const NOME_MIN = 3
export const NOME_MAX = 16
// letras (com acento), números, espaço, _ . -  (o [[:alnum:] _.-] do banco)
const PERMITIDO = /^[\p{L}\p{N} _.-]+$/u

import { AVATARES_TRILHA } from './progresso.js'
import { nomeOfensivo } from './palavrasBloqueadas.js'

export const AVATARES_JOGO = ['kris', 'susie', 'ralsei', 'noelle', 'berdly', 'dess', 'asriel']
// os da trilha de níveis (Coleção): só aparecem para quem ganhou
const AVATARES_VALIDOS = [...AVATARES_JOGO, ...AVATARES_TRILHA]
export const TIPOS_AVATAR = ['padrao', 'jogo', 'enviado']

export function validarNome(texto) {
  const nome = String(texto ?? '')
    .trim()
    .replace(/\s+/g, ' ')
  const tamanho = [...nome].length
  if (tamanho < NOME_MIN) return { ok: false, erro: `o nome precisa de pelo menos ${NOME_MIN} letras` }
  if (tamanho > NOME_MAX) return { ok: false, erro: `o nome pode ter no máximo ${NOME_MAX} letras` }
  if (!PERMITIDO.test(nome)) return { ok: false, erro: 'use só letras, números, espaço, _ . -' }
  if (nomeOfensivo(nome)) return { ok: false, erro: 'esse nome não é permitido: escolha outro' }
  return { ok: true, nome }
}

export function avatarDoPerfil(perfil) {
  if (perfil?.avatar_tipo === 'enviado' && perfil.avatar_url) return { tipo: 'enviado', id: null, url: perfil.avatar_url }
  if (perfil?.avatar_tipo === 'jogo' && AVATARES_VALIDOS.includes(perfil.avatar_id)) return { tipo: 'jogo', id: perfil.avatar_id, url: null }
  return { tipo: 'padrao', id: null, url: null }
}
