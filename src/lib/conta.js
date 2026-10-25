import { writable, get } from 'svelte/store'
import { validarNome, AVATARES_JOGO } from './contaRegras.js'

// Conta do jogador (Supabase: login Google, perfil e foto). docs/supabase.md
//
// O servidor diz em GET /api/config se tem contas e passa a URL + a chave anon
// (a service_role nunca chega aqui). Sem config (LAN sem internet, servidor sem
// SUPABASE_*), o estado fica 'indisponivel' e o jogo segue como convidado: o
// supabase-js nem é baixado.
//
//   iniciarConta()                    uma vez, no começo (App.svelte)
//   entrarComGoogle() · sairDaConta()
//   mudarNomeExibicao(nome) · escolherAvatar('padrao'|'jogo'|'enviado', id?)
//   enviarFoto(blob) · removerFoto()  pelo servidor (POST/DELETE /api/avatar)
//   tokenConta()                      JWT da sessão (o lobby manda no "ola")
//   aoMudarConta(fn)                  entrou / saiu / perfil mudou -> fn(token)
//
// O store `conta`, lido pelo Svelte e pelas cenas (get(conta)):
//   estado: 'indisponivel' | 'deslogado' | 'carregando' | 'logado'
//   perfil: { id, tag, nome_exibicao, avatar_tipo, avatar_id, avatar_url, titulo_equipado, nivel, xp }
//   estatisticas: { partidas, vitorias, personagem_favorito }
export const conta = writable({ estado: 'carregando', perfil: null, estatisticas: null, erro: '' })

const COLUNAS = 'id, tag, nome_exibicao, avatar_tipo, avatar_id, avatar_url, titulo_equipado, nivel, xp'
const ESTATISTICAS_ZERO = { partidas: 0, vitorias: 0, personagem_favorito: null }

let supabase = null
let sessao = null
let iniciando = null
const ouvintes = new Set()

const mudar = (parcial) => conta.update((s) => ({ ...s, ...parcial }))
export const tokenConta = () => sessao?.access_token ?? null
export const contasDisponiveis = () => get(conta).estado !== 'indisponivel'

export function aoMudarConta(fn) {
  ouvintes.add(fn)
  return () => ouvintes.delete(fn)
}
const avisar = () => ouvintes.forEach((fn) => fn(tokenConta()))

export function iniciarConta() {
  iniciando ??= ligar().catch((e) => {
    console.warn('[conta] contas desligadas:', e?.message ?? e)
    mudar({ estado: 'indisponivel', perfil: null })
  })
  return iniciando
}

async function ligar() {
  let config
  try {
    const r = await fetch('/api/config', { cache: 'no-store' })
    config = r.ok ? await r.json() : null
  } catch {
    config = null
  }
  if (!config?.disponivel || !config.url || !config.anonKey) return mudar({ estado: 'indisponivel' })

  const { createClient } = await import('@supabase/supabase-js')
  supabase = createClient(config.url, config.anonKey, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'dodge-conta' },
  })
  supabase.auth.onAuthStateChange((evento, nova) => {
    const antes = sessao?.user?.id ?? null
    sessao = nova
    // a sessão do começo quem trata é o getSession() lá embaixo; aqui só a troca de usuário
    const agora = nova?.user?.id ?? null
    if (evento === 'INITIAL_SESSION' || agora === antes) return
    // fora do callback (o supabase-js pede para não chamar a API aqui dentro)
    setTimeout(() => (agora ? carregarPerfil() : sairLocal()), 0)
  })
  const { data } = await supabase.auth.getSession()
  sessao = data.session
  limparUrlDoLogin()
  if (sessao) await carregarPerfil()
  else mudar({ estado: 'deslogado' })
}

// volta do Google: tira o ?code= da barra de endereço
function limparUrlDoLogin() {
  const url = new URL(location.href)
  if (!url.searchParams.has('code') && !url.searchParams.has('error_description')) return
  const erro = url.searchParams.get('error_description')
  if (erro) mudar({ erro: `login cancelado: ${erro}` })
  for (const p of ['code', 'state', 'error', 'error_code', 'error_description']) url.searchParams.delete(p)
  history.replaceState(history.state, '', url.pathname + url.search + url.hash)
}

function sairLocal() {
  sessao = null
  mudar({ estado: 'deslogado', perfil: null, estatisticas: null })
  avisar()
}

async function carregarPerfil() {
  if (!supabase || !sessao) return
  const id = sessao.user.id
  if (get(conta).estado !== 'logado') mudar({ estado: 'carregando' })
  const [p, e] = await Promise.all([
    supabase.from('perfis').select(COLUNAS).eq('id', id).maybeSingle(),
    supabase.from('estatisticas_basicas').select('partidas, vitorias, personagem_favorito').eq('usuario_id', id).maybeSingle(),
  ])
  if (p.error || !p.data) {
    mudar({ estado: 'logado', perfil: null, estatisticas: null, erro: 'não deu para carregar o perfil: tente de novo mais tarde' })
    return
  }
  mudar({ estado: 'logado', perfil: p.data, estatisticas: e.data ?? ESTATISTICAS_ZERO, erro: '' })
  avisar()
}

export async function entrarComGoogle() {
  if (!supabase) return
  mudar({ erro: '' })
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } })
  if (error) mudar({ erro: `não deu para abrir o login: ${error.message}` })
}

export async function sairDaConta() {
  if (!supabase) return
  await supabase.auth.signOut().catch(() => {})
  sairLocal()
}

// erros do banco/servidor para mostrar no painel
const mensagem = (error, padrao) => {
  const m = String(error?.message ?? '')
  return /inválid|nome|avatar|foto/i.test(m) ? m : padrao
}

async function atualizar(parametros) {
  if (!supabase || !sessao) return { ok: false, erro: 'entre na conta primeiro' }
  const { data, error } = await supabase.rpc('atualizar_perfil', parametros)
  if (error) return { ok: false, erro: mensagem(error, 'não deu para salvar: tente de novo') }
  const perfil = Array.isArray(data) ? data[0] : data
  if (perfil) mudar({ perfil: { ...get(conta).perfil, ...perfil } })
  avisar()
  return { ok: true }
}

export function mudarNomeExibicao(texto) {
  const v = validarNome(texto)
  if (!v.ok) return Promise.resolve({ ok: false, erro: v.erro })
  return atualizar({ p_nome: v.nome })
}

export function escolherAvatar(tipo, id = null) {
  if (tipo === 'jogo' && !AVATARES_JOGO.includes(id)) return Promise.resolve({ ok: false, erro: 'avatar inválido' })
  return atualizar({ p_avatar_tipo: tipo, p_avatar_id: tipo === 'jogo' ? id : null })
}

async function chamarAvatar(metodo, corpo) {
  const token = tokenConta()
  if (!token) return { ok: false, erro: 'entre na conta primeiro' }
  try {
    const r = await fetch('/api/avatar', {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, ...(corpo && { 'Content-Type': corpo.type }) },
      body: corpo ?? undefined,
    })
    const resposta = await r.json().catch(() => ({}))
    if (!r.ok) return { ok: false, erro: resposta.erro ?? `erro ${r.status}` }
    if (resposta.perfil) mudar({ perfil: { ...get(conta).perfil, ...resposta.perfil } })
    avisar()
    return { ok: true }
  } catch {
    return { ok: false, erro: 'sem conexão com o servidor' }
  }
}

export const enviarFoto = (blob) => chamarAvatar('POST', blob)
export const removerFoto = () => chamarAvatar('DELETE', null)
