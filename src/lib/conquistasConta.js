import { writable, get } from 'svelte/store'
import { aoServidor, enviarLobby, manterLobby } from './lan/rede.js'
import { conta, ganhouItem, recarregarPerfil } from './conta.js'
import { conquistaDe, PERSONAGENS_MAESTRIA } from './conquistas.js'

// CONQUISTAS e MAESTRIA do lado do navegador (Fase 4B; docs/desafio-diario.md). Quem desbloqueia é o
// servidor (server/conquistas.js); daqui só sai o pedido do estado (a Coleção) e chegam os avisos.
//
//   conquistasConta (store)  { carregado, convidado, erro, conquistas: Map(id -> em), maestria: { personagem: { pontos, partidas, vitorias } } }
//   pedirConquistas()        garante a conexão (logado) e pede o estado ao servidor
//   aoConquistaNova(fn)      fn({ id, nome, descricao }) para cada conquista nova (os avisos do jogo)
export const conquistasConta = writable({ carregado: false, convidado: false, erro: '', conquistas: new Map(), maestria: {} })

const ouvintes = new Set()
let ligado = false

function lerMaestria(lista) {
  const m = {}
  for (const x of Array.isArray(lista) ? lista : []) if (PERSONAGENS_MAESTRIA.includes(x?.personagem)) m[x.personagem] = { pontos: Number(x.pontos) || 0, partidas: Number(x.partidas) || 0, vitorias: Number(x.vitorias) || 0 }
  return m
}

function ligar() {
  if (ligado) return
  ligado = true
  aoServidor((m) => {
    if (m?.t === 'conquistasEstado') {
      const conquistas = new Map()
      for (const c of Array.isArray(m.conquistas) ? m.conquistas : []) if (conquistaDe(c?.id)) conquistas.set(c.id, c.em ?? null)
      conquistasConta.set({ carregado: true, convidado: Boolean(m.convidado), erro: String(m.erro ?? ''), conquistas, maestria: lerMaestria(m.maestria) })
    }
    if (m?.t === 'conquistas') {
      const novas = (Array.isArray(m.novas) ? m.novas : []).map(conquistaDe).filter(Boolean)
      for (const id of Array.isArray(m.itensNovos) ? m.itensNovos : []) if (typeof id === 'string') ganhouItem(id)
      if (m.itensNovos?.length) recarregarPerfil()
      conquistasConta.update((s) => {
        const conquistas = new Map(s.conquistas)
        for (const c of novas) if (!conquistas.has(c.id)) conquistas.set(c.id, new Date().toISOString())
        const maestria = { ...s.maestria }
        const x = m.maestria
        if (x && PERSONAGENS_MAESTRIA.includes(x.personagem)) maestria[x.personagem] = { ...(maestria[x.personagem] ?? { partidas: 0, vitorias: 0 }), pontos: Number(x.pontos) || 0 }
        return { ...s, conquistas, maestria }
      })
      for (const c of novas) ouvintes.forEach((fn) => fn(c))
    }
  })
}

export function aoConquistaNova(fn) {
  ligar()
  ouvintes.add(fn)
  return () => ouvintes.delete(fn)
}

export function pedirConquistas() {
  ligar()
  if (get(conta).estado === 'logado') manterLobby(true)
  enviarLobby({ t: 'conquistas' })
}
