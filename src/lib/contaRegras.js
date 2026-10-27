// Regras da conta que o navegador confere antes de mandar (o banco confere de
// novo: supabase/migrations/0001_contas.sql, normalizar_nome e atualizar_perfil).
//
//   validarNome(texto)  -> { ok: true, nome } | { ok: false, erro }
//   nomeInicialDoGoogle(bruto)  o nome do perfil criado a partir do nome do Google (espelho de criar_perfil, 0005)
//   nomeSeguro(nome)    o nome do perfil como o servidor mostra aos outros (lista de nomes: JOGADOR)
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

// Nome neutro quando o nome não serve (vazio, curto, fora da regra ou da lista de palavras)
export const NOME_NEUTRO = 'JOGADOR'

// O nome que o banco dá ao perfil novo (criar_perfil em 0001_contas.sql, com o filtro
// da 0005_pendencias.sql): tira o que a regra não aceita, limita a 16 letras e, se
// ficar curto demais ou tiver palavra da lista de nomes, vira JOGADOR (a tag nasce
// do nome já filtrado). server/__tests__/pendenciasSql.test.js confere com o banco.
export function nomeInicialDoGoogle(bruto) {
  const limpo = String(bruto ?? '')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
  const nome = [...limpo].slice(0, NOME_MAX).join('').trim()
  const r = validarNome(nome)
  return r.ok ? r.nome : NOME_NEUTRO
}

// O servidor repete o filtro no nome que lê do perfil (perfis antigos, banco sem a 0005):
// nome fora da lista passa igual; da lista vira JOGADOR.
export const nomeSeguro = (nome) => (nomeOfensivo(nome) ? NOME_NEUTRO : String(nome ?? ''))
