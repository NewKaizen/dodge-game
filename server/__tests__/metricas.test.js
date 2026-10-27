// Métricas mínimas (server/metricas.js): agregação, privacidade (lista fechada,
// nada por jogador) e os pontos ligados no lobby.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarMetricas, percentil, CONTADORES, METRICAS_NULA } from '../metricas.js'
import { criarLobby, PROTOCOLO, RETOMADA_MS } from '../lan.js'
import { ABANDONO_GRACA_MS } from '../partidas.js'

test('percentil: posto mais próximo', () => {
  assert.equal(percentil([], 50), null)
  assert.equal(percentil([7], 90), 7)
  const dez = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  assert.equal(percentil(dez, 50), 5)
  assert.equal(percentil(dez, 90), 9)
  assert.equal(percentil(dez, 100), 10)
})

test('contadores e amostras: soma, p50/p90, janela zera e janela vazia não escreve', () => {
  let t = Date.parse('2026-10-26T12:00:00Z')
  const linhas = []
  const m = criarMetricas({ agora: () => t, escrever: (l) => linhas.push(l) })
  m.contar('logins')
  m.contar('logins', 2)
  for (const ms of [1000, 2000, 3000, 4000, 30000]) m.amostra('fila_espera_ms', ms)
  t += 15 * 60_000
  const r = m.despejar('periodico')
  assert.equal(r.contadores.logins, 3)
  assert.deepEqual(r.amostras.fila_espera_ms, { n: 5, p50: 3000, p90: 30000, max: 30000 })
  assert.equal(linhas.length, 1)
  assert.match(linhas[0], /^\[metricas\] \{/)
  const json = JSON.parse(linhas[0].replace('[metricas] ', ''))
  assert.deepEqual([json.motivo, json.de, json.ate], ['periodico', '2026-10-26T12:00:00.000Z', '2026-10-26T12:15:00.000Z'])
  // nova janela, vazia: nada escrito
  assert.equal(m.despejar('periodico'), null)
  assert.equal(linhas.length, 1)
  // parar escreve a última janela com motivo "saida"
  m.contar('conexoes')
  m.parar()
  assert.equal(JSON.parse(linhas.at(-1).replace('[metricas] ', '')).motivo, 'saida')
})

test('privacidade: só nomes da lista fechada, só números', () => {
  const linhas = []
  const m = criarMetricas({ escrever: (l) => linhas.push(l) })
  m.contar('ip_do_fulano')
  m.contar('logins', -1)
  m.contar('logins', 'x')
  m.amostra('nome_do_jogador', 5)
  m.amostra('fila_espera_ms', -1)
  m.amostra('fila_espera_ms', NaN)
  assert.equal(m.despejar(), null, 'nada aceito, nada escrito')
  m.contar('logins')
  m.despejar()
  assert.doesNotMatch(linhas.join(''), /token|chat|codigo|"ip"/)
  for (const nome of CONTADORES) assert.match(nome, /^[a-z_]+$/)
  assert.equal(METRICAS_NULA.resumo(), null) // o nulo não guarda nada
})

test('timer de despejo (iniciar/parar) e limite de amostras por janela', () => {
  const m = criarMetricas({ intervaloMs: 0, escrever: () => {} })
  m.iniciar() // intervalo 0 = desligado
  for (let i = 0; i < 2500; i++) m.amostra('fila_espera_ms', i)
  assert.equal(m.resumo().amostras.fila_espera_ms.n, 2000)
  assert.equal(m.resumo().amostras.fila_espera_ms.max, 2499)
})

// ---------- ligado no lobby ----------

function montar() {
  let t = 1_000_000
  const timers = new Set()
  const relogio = {
    agora: () => t,
    agendar: (fn, ms) => {
      const x = { fn, quando: t + ms }
      timers.add(x)
      return () => timers.delete(x)
    },
    andar(ms) {
      t += ms
      for (const x of [...timers].sort((a, b) => a.quando - b.quando)) if (x.quando <= t && timers.delete(x)) x.fn()
    },
  }
  const metricas = criarMetricas({ agora: relogio.agora, escrever: () => {} })
  const autenticar = async (token) => (token.startsWith('token-') ? { id: `u-${token.split('-')[1]}`, perfil: { id: `u-${token.split('-')[1]}`, tag: 'x#1000', nome_exibicao: 'X', avatar_tipo: 'padrao', nivel: 1, xp: 0 } } : null)
  const lobby = criarLobby({ locais: () => [{ ip: '192.168.0.10', mascara: '255.255.255.0' }], online: true, agora: relogio.agora, agendar: relogio.agendar, autenticar, relacoes: async () => ({ amigos: new Set(), bloqueios: new Set(), pedidos: new Set() }), metricas })
  const entrar = async (nome, token = null) => {
    const recebidas = []
    const ws = { readyState: 1, bufferedAmount: 0, send: (m) => recebidas.push(JSON.parse(m)) }
    const c = lobby.conectar(ws, '10.0.0.2')
    const p = { c, recebidas, mandar: (m) => lobby.receber(c, JSON.stringify(m)), ultima: (tt) => recebidas.filter((m) => m.t === tt).at(-1), sair: () => ((ws.readyState = 3), lobby.desconectar(c)) }
    p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome, ...(token && { token }) })
    for (let i = 0; i < 3; i++) await new Promise((r) => setImmediate(r))
    return p
  }
  return { lobby, relogio, metricas, entrar }
}

test('lobby: fila, pares, partida abandonada, revanche, logins e reconexão', async () => {
  const { relogio, metricas, entrar } = montar()
  const ana = await entrar('ANA', 'token-ana')
  const beto = await entrar('BETO')
  ana.mandar({ t: 'fila', acao: 'entrar' })
  relogio.andar(4000)
  beto.mandar({ t: 'fila', acao: 'entrar' })
  const id = ana.ultima('pareado').id
  ana.mandar({ t: 'confirmar', id, aceitar: true })
  beto.mandar({ t: 'confirmar', id, aceitar: true })
  const host = ana.ultima('partidaCasual').host === ana.c.id ? ana : beto
  const outro = host === ana ? beto : ana
  host.mandar({ t: 'partida', valor: true })
  outro.mandar({ t: 'revanche', aceitar: true })
  host.mandar({ t: 'revanche', aceitar: true })
  outro.sair() // abandono no meio da partida (não voltou em RETOMADA_MS)
  relogio.andar(RETOMADA_MS)
  relogio.andar(ABANDONO_GRACA_MS + 100)
  const r = metricas.resumo()
  assert.deepEqual(
    r.contadores,
    { conexoes: 2, fila_entradas: 2, fila_pares: 1, logins: 1, partidas_abandonadas: 1, partidas_finalizadas: 1, partidas_iniciadas: 2, partidas_quedas: 1, revanches_aceitas: 1, revanches_pedidas: 1 },
    'a revanche abre uma segunda partida; a primeira acaba sem relato no prazo (20 s, o mesmo da volta) e a segunda é abandono',
  )
  assert.deepEqual(r.amostras.fila_espera_ms, { n: 2, p50: 0, p90: 4000, max: 4000 })

  // reconexão: a mesma conta cai e volta em 2 minutos
  const ana2 = await entrar('ANA', 'token-ana')
  ana2.sair()
  relogio.andar(30_000)
  await entrar('ANA', 'token-ana')
  assert.equal(metricas.resumo().contadores.reconexoes, 1)
  // depois de muito tempo é um login novo, não uma reconexão
  const ana4 = await entrar('ANA', 'token-ana')
  ana4.sair()
  relogio.andar(10 * 60_000)
  await entrar('ANA', 'token-ana')
  assert.equal(metricas.resumo().contadores.reconexoes, 1)
  assert.equal(metricas.resumo().contadores.logins, 5)
})
