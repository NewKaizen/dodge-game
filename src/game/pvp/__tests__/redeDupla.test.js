// A ponte do 2x2 (pvp/rede/ArenaRedeN.js com pvp/dupla.js) por canais de verdade numa estrela em memória:
// node --test src/game/pvp/__tests__/redeDupla.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ArenaRedeN from '../rede/ArenaRedeN.js'
import { criarCanal } from '../../../lib/lan/canal.js'
import { aplicarDanoFfa } from '../ffa.js'
import { criarPartidaDupla, resolverRodadaDupla } from '../dupla.js'

const PERS = ['kris', 'susie', 'ralsei', 'dess']
const espera = (ms = 30) => new Promise((r) => setTimeout(r, ms))

// host H na vaga 1, convidados A (0), B (2) e C (3)
function montar({ n = 4, times = [0, 1, 0, 1] } = {}) {
  const vagas = { A: 0, H: 1, B: 2, C: 3 }
  const host = 'H'
  const ids = Object.keys(vagas).filter((id) => vagas[id] < n)
  const nos = {}
  let membros = ids.map((id) => ({ id, indice: vagas[id], nome: id, caiu: null }))
  const participantes = () => membros.map((m) => ({ ...m }))
  for (const id of ids) {
    const souHost = id === host
    const mandar = (msg, para) => setImmediate(() => nos[souHost ? para : host]?.canal.entregar(msg))
    const todos = (msg) => membros.filter((m) => m.id !== id).forEach((m) => mandar(msg, m.id))
    const destinos = () => (souHost ? membros.filter((m) => m.id !== id).map((m) => m.id) : [host])
    const canal = criarCanal({ enviarBruto: mandar, enviarReserva: mandar, enviarTodos: souHost ? todos : null, meuId: () => id, destinos })
    const log = { acertos: [], saidas: [] }
    const arena = {
      estado: criarPartidaDupla({ personagens: PERS.slice(0, n), times, semente: 'rede-2x2' }),
      saindo: false,
      acertosRodada: Array(n).fill(0),
      ko: Array(n).fill(false),
      sys: { settings: { data: { arena: 'castelo' } } },
      pistas: Array.from({ length: n }, (_, k) => ({ aberta: true, espelho: false, coracoes: [{ ativo: true, x: 100 + k * 50, y: 100, ajustar() {} }] })),
      aplicarAcerto: (j, dano) => log.acertos.push([j, dano]),
      aplicarGraze: () => {},
      marcarPronto: () => {},
      aoSaiu: (j) => log.saidas.push(j),
      extrasRetomada: () => ({}),
    }
    nos[id] = { canal, arena, log, vaga: vagas[id], rede: new ArenaRedeN(arena, { canal, meuIndice: vagas[id], souHost, participantes, dev: true }) }
  }
  return {
    nos,
    ids,
    host,
    convidados: ids.filter((i) => i !== host),
    vivos: () => membros.map((m) => m.id),
    cair: (id) => (membros = membros.map((m) => (m.id === id ? { ...m, caiu: 15000 } : m))),
    voltar: (id) => (membros = membros.map((m) => (m.id === id ? { ...m, caiu: null } : m))),
    tirar: (id) => (membros = membros.filter((m) => m.id !== id)),
    fechar: () => ids.forEach((i) => nos[i].rede.destruir()),
  }
}

async function comecar(m) {
  const pend = m.convidados.filter((id) => m.vivos().includes(id)).map((id) => m.nos[id].rede.iniciarRodada())
  const h = await m.nos[m.host].rede.iniciarRodada()
  return [h, ...(await Promise.all(pend))]
}

const cair = (e, j) => {
  e.jogadores[j].hp = 0
  e.jogadores[j].caido = { rodada: e.rodada, ordem: 1 }
}

test('todos recebem os MESMOS duelos cruzados antes da escolha (e alternam na rodada seguinte)', async () => {
  const m = montar()
  await comecar(m)
  assert.deepEqual(m.nos.H.arena.estado.alvos, [1, 0, 3, 2])
  for (const id of m.convidados) assert.deepEqual(m.nos[id].arena.estado.alvos, [1, 0, 3, 2])
  for (const id of m.ids) m.nos[id].rede.comecarEscolha()
  m.nos.H.rede.enviarJogada(null)
  for (const id of m.convidados) m.nos[id].rede.enviarJogada(null)
  const jogadas = await m.nos.H.rede.juntarJogadas(3000)
  const e = m.nos.H.arena.estado
  const r = resolverRodadaDupla(e, jogadas)
  m.nos.H.rede.enviarResolucao(jogadas, r)
  await Promise.all(m.convidados.map((id) => m.nos[id].rede.receberResolucao()))
  const fins = m.convidados.map((id) => m.nos[id].rede.fimDaRodada())
  await m.nos.H.rede.fimDaRodada()
  await Promise.all(fins)
  await comecar(m)
  for (const id of m.ids) assert.deepEqual(m.nos[id].arena.estado.alvos, [3, 2, 1, 0])
  m.fechar()
})

test('a jogada do convidado leva em quem vai o ♥ ({ carta, apoio }) e o host não espera o caído', async () => {
  const m = montar()
  cair(m.nos.H.arena.estado, 3)
  await comecar(m)
  for (const id of m.ids) m.nos[id].rede.comecarEscolha()
  const copas = m.nos.A.arena.estado.jogadores[0].baralho.mao.find((c) => c.naipe === 'copas')
  const jogadaA = copas ? { carta: copas.id, apoio: 2 } : null
  m.nos.A.rede.enviarJogada(jogadaA)
  m.nos.B.rede.enviarJogada(null)
  const p = m.nos.H.rede.juntarJogadas(3000)
  m.nos.H.rede.enviarJogada(null)
  const inicio = Date.now()
  const jogadas = await p
  assert.ok(Date.now() - inicio < 1500, 'não esperou o caído')
  assert.deepEqual(jogadas, [jogadaA, null, null, null])
  m.fechar()
})

test('o fim da rodada chega igual a todos: o resgate pela rodada limpa e o time vencedor', async () => {
  const m = montar()
  const e = m.nos.H.arena.estado
  cair(e, 2)
  await comecar(m)
  resolverRodadaDupla(e, [null, null, null, null])
  let pend = m.convidados.map((id) => m.nos[id].rede.fimDaRodada())
  let fim = await m.nos.H.rede.fimDaRodada([], { limpas: [true, false, false, false] })
  assert.deepEqual(fim.resgatados, [{ j: 2, por: 0 }])
  for (const doConv of await Promise.all(pend)) assert.deepEqual(doConv.resgatados, fim.resgatados)
  assert.ok(m.nos.B.arena.estado.jogadores[2].hp > 0)
  // a rodada seguinte: o time B zera
  await comecar(m)
  resolverRodadaDupla(e, [null, null, null, null])
  aplicarDanoFfa(e, 1, 999, 0)
  aplicarDanoFfa(e, 3, 999, 2)
  pend = m.convidados.map((id) => m.nos[id].rede.fimDaRodada())
  fim = await m.nos.H.rede.fimDaRodada()
  assert.equal(fim.fim, 'ko')
  assert.equal(fim.vencedorTime, 0)
  for (const doConv of await Promise.all(pend)) {
    assert.equal(doConv.vencedorTime, 0)
    assert.deepEqual(doConv.caidos.sort(), [1, 3])
  }
  m.fechar()
})
