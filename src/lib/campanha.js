import { writable, get } from 'svelte/store'
import { lan, aoServidor, enviarLobby, manterLobby } from './lan/rede.js'
import { conta, recarregarPerfil, ganhouItem } from './conta.js'
import { lerDesafio, cosmeticoDoId } from './desafio.js'

// A CAMPANHA do lado do navegador (docs/campanha.md): o servidor roda a partida
// (server/campanha.js); daqui só saem a carta de cada rodada, as posições do coração e as
// escolhas dos diálogos. Usa a mesma conexão do lobby (lib/lan/rede.js), que fica aberta para
// quem está logado (lib/amigos.js).
//
//   campanha (store)        { carregado, fases: [{ mundo, fase, estrelas, concluida }], escolhas, xpHoje, teto, erro }
//   podeJogarCampanha()     logado E com a conta confirmada pelo servidor
//   entrarNaCampanha()      garante a conexão e pede o progresso
//   aoCampanha(fn)          as mensagens campanha* do servidor (e '_fechou' quando a conexão cai)
//   comecarFase(m, f) · jogarCarta(corrida, id | null) · enviarPosicoes(corrida, rodada, seq, a)
//   terminarEsquiva(corrida, rodada, acertos) · escolherNoDialogo(m, chave, valor) · desistirDaCorrida(corrida)
export const campanha = writable({ carregado: false, fases: [], escolhas: {}, xpHoje: 0, teto: 0, erro: '' })

const ouvintes = new Set()
let ligado = false

function ligar() {
  if (ligado) return
  ligado = true
  aoServidor((m) => {
    if (typeof m?.t !== 'string') return
    if (m.t === 'campanhaProgresso') {
      const fases = Array.isArray(m.fases) ? m.fases.filter((f) => Number.isInteger(f?.mundo) && Number.isInteger(f?.fase)) : []
      campanha.set({ carregado: true, fases, escolhas: m.escolhas && typeof m.escolhas === 'object' ? m.escolhas : {}, xpHoje: Number(m.xpHoje) || 0, teto: Number(m.teto) || 0, erro: '' })
    }
    if (m.t === 'campanhaErro' && !m.corrida) campanha.update((s) => ({ ...s, erro: String(m.msg ?? '') }))
    if (m.t === 'campanhaFim') {
      for (const id of Array.isArray(m.itensNovos) ? m.itensNovos : []) if (typeof id === 'string') ganhouItem(id)
      if (m.xpGanho > 0 || m.itensNovos?.length) recarregarPerfil()
    }
    if (m.t === 'desafioEstado') desafioDiario.set(lerEstadoDesafio(m))
    if (m.t.startsWith('campanha') || m.t === 'desafioEstado' || m.t === '_fechou') ouvintes.forEach((fn) => fn(m))
  })
}

// ---------- DESAFIO DIÁRIO (docs/desafio-diario.md) ----------
// A mesma corrida da campanha (o servidor roda a luta), com a definição do dia pelo relógio do
// SERVIDOR (src/lib/desafio.js). Convidado também joga, sem recompensa nem recorde.
//   desafioDiario (store)   { carregado, dia, semana, desafio, convidado, disponivel, recorde, concluido,
//                             diasSemana, meta, cosmetico, cosmeticoGanho, concluidos, amigos, xp, ate, erro }
//   entrarNoDesafio() · sairDoDesafio() · conectadoAoLobby() · pedirDesafio() · comecarDesafio(dia)
export const desafioDiario = writable({ carregado: false })

function lerEstadoDesafio(m) {
  const desafio = lerDesafio(m.desafio)
  const inteiro = (x) => Math.max(0, Math.floor(Number(x) || 0))
  return {
    carregado: Boolean(desafio),
    dia: desafio?.id ?? null,
    semana: typeof m.semana === 'string' ? m.semana : null,
    desafio,
    convidado: Boolean(m.convidado),
    disponivel: Boolean(m.disponivel),
    recorde: m.recorde && typeof m.recorde === 'object' ? { pontos: inteiro(m.recorde.pontos), rodadas: m.recorde.rodadas ?? null, acertos: m.recorde.acertos ?? null } : null,
    concluido: Boolean(m.concluido),
    diasSemana: inteiro(m.diasSemana),
    meta: inteiro(m.meta) || 4,
    cosmetico: cosmeticoDoId(m.cosmetico?.id),
    cosmeticoGanho: Boolean(m.cosmeticoGanho),
    concluidos: inteiro(m.concluidos),
    amigos: (Array.isArray(m.amigos) ? m.amigos : []).slice(0, 20).map((a) => ({ nome: String(a?.nome ?? '').slice(0, 24), tag: String(a?.tag ?? '').slice(0, 32), pontos: inteiro(a?.pontos) })),
    xp: inteiro(m.xp),
    // o relógio daqui só para a contagem (quem decide o dia é o servidor)
    ate: Date.now() + Math.min(86_400_000 + 3_600_000, inteiro(m.restanteMs)),
    erro: String(m.erro ?? ''),
  }
}

export function conectadoAoLobby() {
  const l = get(lan)
  if (l.fase === 'fora' || l.fase === 'conectando') return false
  return get(conta).estado !== 'logado' || Boolean(l.eu.conta)
}

// a tela do desafio abre a conexão do lobby (também para o convidado: a luta roda no servidor)
export function entrarNoDesafio() {
  ligar()
  manterLobby(true)
  if (conectadoAoLobby()) pedirDesafio()
}
// voltando ao menu: o convidado não precisa da conexão aberta (quem está logado continua: amigos)
export function sairDoDesafio() {
  if (get(conta).estado !== 'logado') manterLobby(false)
}
export const pedirDesafio = () => mandar({ acao: 'desafio' })
export const comecarDesafio = (dia) => mandar({ acao: 'comecarDesafio', dia })

export function aoCampanha(fn) {
  ligar()
  ouvintes.add(fn)
  return () => ouvintes.delete(fn)
}

export function podeJogarCampanha() {
  const c = get(conta)
  const l = get(lan)
  return c.estado === 'logado' && Boolean(c.perfil) && Boolean(l.eu.conta) && l.fase !== 'fora' && l.fase !== 'conectando'
}

export function entrarNaCampanha() {
  ligar()
  if (get(conta).estado === 'logado') manterLobby(true)
  pedirProgresso()
}

const mandar = (msg) => enviarLobby({ t: 'campanha', ...msg })
export const pedirProgresso = () => mandar({ acao: 'progresso' })
export const comecarFase = (mundo, fase) => mandar({ acao: 'comecar', mundo, fase })
export const jogarCarta = (corrida, carta) => mandar({ acao: 'carta', corrida, carta: carta ?? null })
export const enviarPosicoes = (corrida, rodada, seq, a) => mandar({ acao: 'posicoes', corrida, rodada, seq, a })
export const terminarEsquiva = (corrida, rodada, acertos) => mandar({ acao: 'fimEsquiva', corrida, rodada, acertos })
export const escolherNoDialogo = (mundo, chave, valor) => {
  campanha.update((s) => ({ ...s, escolhas: { ...s.escolhas, [mundo]: { ...(s.escolhas[mundo] ?? {}), [chave]: valor } } }))
  mandar({ acao: 'escolha', mundo, chave, valor })
}
export const desistirDaCorrida = (corrida) => mandar({ acao: 'desistir', corrida })

// melhor resultado de cada fase do mundo: { [fase]: { estrelas, concluida } }
export function progressoDoMundo(mundo, fases = get(campanha).fases) {
  const r = {}
  for (const f of fases) if (f.mundo === mundo) r[f.fase] = { estrelas: f.estrelas, concluida: f.concluida }
  return r
}

// SÓ NO DEV (os testes de navegador): window.debugCampanha.trapaca = 'teleporte' | 'semAcertos' | null
// adultera o que a arena manda, para ver o servidor recusar (docs/campanha.md)
export const trapacaDev = () => (import.meta.env?.DEV && typeof window !== 'undefined' ? window.debugCampanha?.trapaca ?? null : null)
if (import.meta.env?.DEV && typeof window !== 'undefined') window.debugCampanha ??= { trapaca: null }
