import { writable, derived, get } from 'svelte/store'
import { conta, clienteSupabase } from './conta.js'
import { avatarDoPerfil } from './contaRegras.js'
import { lan, manterLobby, aoServidor, enviarLobby } from './lan/rede.js'

// Amigos, pedidos, bloqueios, presença e convites (Fase 1B).
//
// Quem guarda amizades é o Supabase (supabase/migrations/0002_amigos.sql): o
// navegador só chama as funções do banco (rpc). A PRESENÇA (disponível / em
// partida) e os CONVITES passam pelo servidor do lobby (server/lan.js), pela
// mesma conexão da tela ONLINE; logado, essa conexão fica aberta o tempo todo
// (rede.js manterLobby). Convidado não tem nada disto.
//
//   iniciarAmigos()                          uma vez, no começo (App.svelte)
//   pedirAmizade(tag) · responderPedido(id, aceitar) · cancelarPedido(id)
//   removerAmigo(id) · bloquearJogador(id) · desbloquearJogador(id)
//                                            { ok, erro?, resultado? }; depois de cada uma o servidor é avisado
//   recarregar()                             relê a lista no banco
//   convidarAmigo(id) · responderConvite(id, aceitar) · limparAviso()
//   copiarTexto(texto)
//
// O store `amigos`:
//   amigos, recebidos, enviados, bloqueados: [{ id, tag, nome, avatar, nivel, titulo, desde }]
//   presenca: { [id]: 'disponivel' | 'em_partida' }  (quem não está aí está offline)
//   convites: [{ id, de: { id, tag, nome, avatar }, modo, ate }]   convites que EU recebi (ate = Date.now() do fim)
//   pendentes: { [idDoAmigo]: { id, ate } }                        convites que EU mandei
//   aviso, erro: textos curtos para o painel / a notificação
export const CONVITE_MS = 60_000
export const MAX_CONVITES_NA_TELA = 4
const VAZIO = { carregando: false, amigos: [], recebidos: [], enviados: [], bloqueados: [], presenca: {}, convites: [], pendentes: {}, aviso: '', erro: '' }
export const amigos = writable({ ...VAZIO })

const mudar = (parcial) => amigos.update((s) => ({ ...s, ...parcial }))
let timerRecarregar = null
let carregamento = 0

// ---------- lista (banco) ----------

export const perfilDaLinha = (l) => ({
  id: l.id,
  tag: l.tag,
  nome: l.nome_exibicao,
  avatar: avatarDoPerfil(l),
  nivel: Number(l.nivel) || 1,
  titulo: l.titulo_equipado ?? null,
  desde: l.desde ?? null,
})

// linhas de listar_amigos() -> grupos
export function agrupar(linhas) {
  const grupos = { amigos: [], recebidos: [], enviados: [] }
  const chave = { amigo: 'amigos', recebido: 'recebidos', enviado: 'enviados' }
  for (const l of linhas ?? []) if (chave[l.relacao]) grupos[chave[l.relacao]].push(perfilDaLinha(l))
  return grupos
}

export async function recarregar() {
  const sb = clienteSupabase()
  if (!sb || get(conta).estado !== 'logado') return
  const rodada = ++carregamento
  mudar({ carregando: true })
  const [a, b] = await Promise.all([sb.rpc('listar_amigos'), sb.rpc('listar_bloqueados')])
  if (rodada !== carregamento) return // chegou uma leitura mais nova
  if (a.error || b.error) return mudar({ carregando: false, erro: 'não deu para carregar os amigos: tente de novo' })
  mudar({ carregando: false, erro: '', ...agrupar(a.data), bloqueados: (b.data ?? []).map(perfilDaLinha) })
}

// várias mudanças seguidas viram uma leitura só
function agendarRecarregar() {
  clearTimeout(timerRecarregar)
  timerRecarregar = setTimeout(recarregar, 300)
}

// ---------- ações (banco) ----------

// as funções do banco falam português (errcodes nossos); o resto é erro de rede etc.
const CODIGOS_NOSSOS = new Set(['28000', '22023', 'P0002', '23505', '54000', '42501'])
const textoDoErro = (error) => (CODIGOS_NOSSOS.has(error?.code) && error.message ? error.message : 'não deu para fazer isso: tente de novo')

async function chamar(funcao, parametros, { outro = null } = {}) {
  const sb = clienteSupabase()
  if (!sb || get(conta).estado !== 'logado') return { ok: false, erro: 'entre com sua conta' }
  const { data, error } = await sb.rpc(funcao, parametros)
  if (error) return { ok: false, erro: textoDoErro(error) }
  // a lista mudou: o servidor relê (presença) e avisa o outro, se estiver online
  const com = outro ?? data?.id ?? null
  enviarLobby({ t: 'amigosMudaram', ...(com && { com }) })
  await recarregar()
  return { ok: true, resultado: data?.resultado ?? null, nome: data?.nome ?? null }
}

export const pedirAmizade = (tag) => chamar('enviar_pedido_amizade', { p_tag: String(tag ?? '').trim() })
export const responderPedido = (id, aceitar) => chamar('responder_pedido_amizade', { p_de: id, p_aceitar: Boolean(aceitar) }, { outro: id })
export const cancelarPedido = (id) => chamar('cancelar_pedido_amizade', { p_para: id }, { outro: id })
export const removerAmigo = (id) => chamar('remover_amigo', { p_outro: id }, { outro: id })
export const bloquearJogador = (id) => chamar('bloquear', { p_outro: id }, { outro: id })
export const desbloquearJogador = (id) => chamar('desbloquear', { p_outro: id }, { outro: id })

// ---------- convites (servidor do lobby) ----------

export function convidarAmigo(id) {
  mudar({ aviso: '', erro: '' })
  enviarLobby({ t: 'convidar', para: id })
}

export function responderConvite(id, aceitar) {
  enviarLobby({ t: 'responderConvite', id, aceitar: Boolean(aceitar) })
  amigos.update((s) => ({ ...s, convites: s.convites.filter((c) => c.id !== id) }))
}

export const limparAviso = () => mudar({ aviso: '', erro: '' })

const nomeDe = (s, id) => [...s.amigos, ...s.recebidos].find((x) => x.id === id)?.nome ?? 'seu amigo'

export function aoMensagem(m) {
  switch (m.t) {
    case '_fechou':
      return amigos.update((s) => ({ ...s, presenca: {}, convites: [], pendentes: {} }))
    case 'presencas':
      return mudar({ presenca: { ...m.mapa } })
    case 'presenca':
      return amigos.update((s) => {
        const presenca = { ...s.presenca }
        if (m.status === 'disponivel' || m.status === 'em_partida') presenca[m.id] = m.status
        else delete presenca[m.id]
        return { ...s, presenca }
      })
    case 'convite':
      return amigos.update((s) => {
        if (!m.id || !m.de || s.convites.some((c) => c.id === m.id) || s.convites.length >= MAX_CONVITES_NA_TELA) return s
        const ate = Date.now() + (Number(m.restanteMs) || CONVITE_MS)
        return { ...s, convites: [...s.convites, { id: m.id, de: m.de, modo: m.modo, ate }] }
      })
    case 'conviteFim':
      return amigos.update((s) => ({ ...s, convites: s.convites.filter((c) => c.id !== m.id) }))
    case 'conviteEnviado':
      return amigos.update((s) => ({ ...s, aviso: `convite enviado para ${nomeDe(s, m.para)}`, erro: '', pendentes: { ...s.pendentes, [m.para]: { id: m.id, ate: Date.now() + CONVITE_MS } } }))
    case 'conviteResposta':
      return amigos.update((s) => {
        const pendentes = { ...s.pendentes }
        delete pendentes[m.para]
        const nome = nomeDe(s, m.para)
        const aviso = { aceito: `${nome} entrou na sala`, recusado: `${nome} recusou o convite`, expirado: `o convite para ${nome} expirou`, falhou: `${nome} não conseguiu entrar` }[m.resultado] ?? ''
        return { ...s, pendentes, aviso, erro: '' }
      })
    case 'conviteNegado':
      return mudar({ erro: String(m.msg ?? 'não deu para convidar'), aviso: '' })
    case 'amigosAtualizar':
      return agendarRecarregar()
  }
}

// ---------- quem está na sala comigo ----------

// membros da sala (menos eu) com conta: dá para pedir amizade pela tag
export const daSala = derived([lan, amigos], ([$lan, $amigos]) => {
  const tags = (lista) => new Set(lista.map((x) => x.tag))
  const amigosTags = tags($amigos.amigos)
  const enviadosTags = tags($amigos.enviados)
  const recebidosTags = tags($amigos.recebidos)
  const bloqueadosTags = tags($amigos.bloqueados)
  return ($lan.sala?.membros ?? [])
    .filter((m) => m.id !== $lan.eu.id && m.conta?.tag)
    .map((m) => ({
      id: m.id,
      nome: m.nome,
      tag: m.conta.tag,
      avatar: m.conta.avatar,
      situacao: amigosTags.has(m.conta.tag) ? 'amigo' : enviadosTags.has(m.conta.tag) ? 'enviado' : recebidosTags.has(m.conta.tag) ? 'recebido' : bloqueadosTags.has(m.conta.tag) ? 'bloqueado' : null,
    }))
})

// ---------- utilidades ----------

export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}

// ---------- ligação ----------

let iniciado = false
export function iniciarAmigos() {
  if (iniciado) return
  iniciado = true
  aoServidor(aoMensagem)
  let logado = false
  conta.subscribe((c) => {
    const agora = c.estado === 'logado' && Boolean(c.perfil)
    if (agora === logado) return
    logado = agora
    if (agora) {
      manterLobby(true)
      recarregar()
    } else {
      manterLobby(false)
      clearTimeout(timerRecarregar)
      carregamento++
      amigos.set({ ...VAZIO })
    }
  })
}
