// Métricas mínimas do servidor (Fase 1E; o que é e o que NÃO é coletado está
// em docs/online.md, "Métricas").
//
// Só contadores e tempos agregados, em memória, escritos como UMA linha JSON
// no log a cada N minutos e ao desligar. Nada de IP, nome, conta, código de
// sala, conteúdo de chat ou qualquer coisa por jogador: os nomes aceitos estão
// na lista fechada abaixo (o que não está nela é ignorado).
//
//   const m = criarMetricas({ agora, escrever, intervaloMs })
//   m.contar('logins')               +1 (ou m.contar(nome, n))
//   m.amostra('fila_espera_ms', ms)  guarda o tempo (sai como n, p50, p90, max)
//   m.resumo()                       { de, ate, contadores, amostras } da janela atual
//   m.despejar('periodico')          escreve a linha e zera a janela (janela vazia não escreve)
//   m.iniciar() · m.parar()          timer do despejo (parar escreve a última janela)
//
// METRICAS_NULA: o mesmo objeto sem fazer nada (testes e modo sem métricas).

export const CONTADORES = [
  'conexoes', // conexões WebSocket abertas
  'logins', // contas que entraram (ao conectar ou com o lobby aberto)
  'reconexoes', // a mesma conta voltando em até 2 min depois de cair
  'fila_entradas',
  'fila_pares', // pares formados (cada um vira confirmação dupla)
  'fila_pares_desfeitos', // recusou, não confirmou a tempo ou saiu
  'partidas_iniciadas',
  'partidas_finalizadas', // decididas sem abandono (inclui as contestadas)
  'partidas_abandonadas',
  'partidas_contestadas',
  'partidas_quedas', // alguém caiu no meio da partida (a vaga fica guardada RETOMADA_MS)
  'partidas_retomadas', // ...e voltou a tempo
  'revanches_pedidas',
  'revanches_aceitas',
  'avatar_envios_ok',
  'avatar_envios_falha',
  'avatar_bloqueios_ip', // /api/avatar recusado pelo limite por endereço
]
export const AMOSTRAS = ['fila_espera_ms']
export const MAX_AMOSTRAS = 2000 // por janela (as mais antigas saem)
export const INTERVALO_PADRAO_MS = 15 * 60_000

// posto mais próximo (nearest-rank) de uma lista já ordenada
export function percentil(ordenada, p) {
  if (!ordenada.length) return null
  const i = Math.min(ordenada.length - 1, Math.max(0, Math.ceil((p / 100) * ordenada.length) - 1))
  return ordenada[i]
}

export const METRICAS_NULA = Object.freeze({ contar() {}, amostra() {}, resumo: () => null, despejar: () => null, iniciar() {}, parar() {} })

export function criarMetricas({ agora = Date.now, escrever = (linha) => console.log(linha), intervaloMs = INTERVALO_PADRAO_MS } = {}) {
  const permitidos = new Set(CONTADORES)
  const amostrasOk = new Set(AMOSTRAS)
  let contadores = new Map()
  let amostras = new Map()
  let inicio = agora()
  let timer = null

  const vazia = () => contadores.size === 0 && amostras.size === 0

  function resumo() {
    const amostrasResumo = {}
    for (const [nome, lista] of amostras) {
      const o = [...lista].sort((a, b) => a - b)
      amostrasResumo[nome] = { n: o.length, p50: percentil(o, 50), p90: percentil(o, 90), max: o[o.length - 1] }
    }
    return { de: new Date(inicio).toISOString(), ate: new Date(agora()).toISOString(), contadores: Object.fromEntries([...contadores].sort()), amostras: amostrasResumo }
  }

  function despejar(motivo = 'periodico') {
    if (vazia()) {
      inicio = agora()
      return null
    }
    const r = resumo()
    contadores = new Map()
    amostras = new Map()
    inicio = agora()
    escrever(`[metricas] ${JSON.stringify({ motivo, ...r })}`)
    return r
  }

  return {
    contar(nome, n = 1) {
      if (!permitidos.has(nome) || !Number.isFinite(n) || n <= 0) return
      contadores.set(nome, (contadores.get(nome) ?? 0) + n)
    },
    amostra(nome, valor) {
      if (!amostrasOk.has(nome) || !Number.isFinite(valor) || valor < 0) return
      const lista = amostras.get(nome) ?? []
      lista.push(Math.round(valor))
      if (lista.length > MAX_AMOSTRAS) lista.shift()
      amostras.set(nome, lista)
    },
    resumo,
    despejar,
    iniciar() {
      if (timer || !(intervaloMs > 0)) return
      timer = setInterval(() => despejar('periodico'), intervaloMs)
      timer.unref?.()
    },
    parar() {
      clearInterval(timer)
      timer = null
      despejar('saida')
    },
  }
}
