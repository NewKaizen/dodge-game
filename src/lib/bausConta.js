import { writable, get } from 'svelte/store'
import { aoServidor, enviarLobby, manterLobby } from './lan/rede.js'
import { conta, ganhouItem, recarregarPerfil } from './conta.js'
import { ehItemDoBau, RARIDADES, PITY } from './cosmeticos.js'

// BAÚS do lado do navegador (docs/baus.md). Quem concede, sorteia e abre é o servidor (server/baus.js e
// abrir_bau no banco); daqui só saem os pedidos e chegam os resultados e os avisos. Nada se compra.
//
//   bausConta (store)   { carregado, convidado, disponivel, erro, fechados, abertos, desdeEpico, pity,
//                         abrindo, ultimo (o resultado do último baú aberto), erroAbrir }
//   pedirBaus()         garante a conexão (logado) e pede o estado
//   abrirBau()          pede para abrir o fechado mais antigo (a resposta chega no store: ultimo)
//   aoBauGanho(fn)      fn({ fontes, fechados }) a cada baú novo (o aviso do menu)
//   lerAberto(m)        a mensagem bauAberto do servidor, conferida (puro; o teste usa)
export const bausConta = writable({ carregado: false, convidado: false, disponivel: false, erro: '', fechados: 0, abertos: 0, desdeEpico: 0, pity: PITY, abrindo: false, ultimo: null, erroAbrir: '' })

const ouvintes = new Set()
let ligado = false

const inteiro = (x) => Math.max(0, Math.floor(Number(x) || 0))

export function lerAberto(m) {
  const recompensas = (Array.isArray(m?.recompensas) ? m.recompensas : [])
    .filter((r) => r && RARIDADES.includes(r.raridade) && (r.tipo === 'xp' || ((r.tipo === 'item' || r.tipo === 'duplicado') && ehItemDoBau(r.id))))
    .slice(0, 3)
    .map((r) => ({ tipo: r.tipo, raridade: r.raridade, ...(r.id && { id: r.id }), ...(r.xp != null && { xp: inteiro(r.xp) }) }))
  return {
    bauId: typeof m?.bauId === 'string' ? m.bauId : null,
    fonte: typeof m?.fonte === 'string' ? m.fonte : null,
    recompensas,
    xpGanho: inteiro(m?.xpGanho),
    teto: Boolean(m?.teto),
    nivelAntes: m?.nivelAntes ?? null,
    nivelDepois: m?.nivelDepois ?? null,
    itensNovos: (Array.isArray(m?.itensNovos) ? m.itensNovos : []).filter((x) => typeof x === 'string'),
    pity: Boolean(m?.pity),
    repetido: Boolean(m?.repetido),
  }
}

function ligar() {
  if (ligado) return
  ligado = true
  aoServidor((m) => {
    if (m?.t === 'bausEstado') {
      bausConta.update((s) => ({ ...s, carregado: true, convidado: Boolean(m.convidado), disponivel: Boolean(m.disponivel), erro: String(m.erro ?? ''), fechados: inteiro(m.fechados), abertos: inteiro(m.abertos), desdeEpico: inteiro(m.desdeEpico), pity: inteiro(m.pity) || PITY }))
    }
    if (m?.t === 'bauAberto') {
      const r = lerAberto(m)
      for (const x of r.recompensas) if (x.tipo === 'item') ganhouItem(x.id)
      for (const id of r.itensNovos) ganhouItem(id)
      bausConta.update((s) => ({ ...s, abrindo: false, erroAbrir: '', ultimo: r, fechados: inteiro(m.fechados), abertos: r.repetido ? s.abertos : s.abertos + 1, desdeEpico: inteiro(m.desdeEpico) }))
      if (r.xpGanho > 0) recarregarPerfil()
    }
    if (m?.t === 'bausErro') bausConta.update((s) => ({ ...s, abrindo: false, erroAbrir: String(m.msg ?? 'não deu para abrir'), ...(m.motivo === 'sem_bau' && { fechados: 0 }) }))
    if (m?.t === 'bauGanho') {
      const aviso = { fontes: (Array.isArray(m.fontes) ? m.fontes : []).filter((x) => typeof x === 'string'), fechados: inteiro(m.fechados) }
      bausConta.update((s) => ({ ...s, fechados: Math.max(s.fechados, aviso.fechados) }))
      ouvintes.forEach((fn) => fn(aviso))
    }
  })
}

export function aoBauGanho(fn) {
  ligar()
  ouvintes.add(fn)
  return () => ouvintes.delete(fn)
}

export function pedirBaus() {
  ligar()
  if (get(conta).estado === 'logado') manterLobby(true)
  enviarLobby({ t: 'baus', acao: 'estado' })
}

export function abrirBau() {
  ligar()
  if (get(bausConta).abrindo) return false
  bausConta.update((s) => ({ ...s, abrindo: true, erroAbrir: '', ultimo: null }))
  enviarLobby({ t: 'baus', acao: 'abrir' })
  return true
}

// o abrir que não teve resposta (conexão caiu): a tela destrava
export const desistirDeAbrir = () => bausConta.update((s) => (s.abrindo ? { ...s, abrindo: false, erroAbrir: 'o servidor não respondeu: tente de novo' } : s))

// equipar pelo LOBBY (o dev com contas falsas, sem Supabase): a resposta 'equipado' resolve a promessa
export function equiparPeloLobby(tipo, item, { esperaMs = 5000 } = {}) {
  ligar()
  return new Promise((resolve) => {
    let parar = null
    const timer = setTimeout(() => {
      parar?.()
      resolve({ ok: false, erro: 'o servidor não respondeu: tente de novo' })
    }, esperaMs)
    parar = aoServidor((m) => {
      if (m?.t !== 'equipado' || m.tipo !== tipo) return
      clearTimeout(timer)
      parar()
      resolve(m.ok ? { ok: true, perfil: m.perfil ?? null } : { ok: false, erro: String(m.erro ?? 'não deu para equipar') })
    })
    enviarLobby({ t: 'baus', acao: 'equipar', tipo, item: item ?? null })
  })
}
