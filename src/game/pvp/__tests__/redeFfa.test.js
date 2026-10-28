// A ponte do TODOS CONTRA TODOS (pvp/rede/ArenaRedeN.js) por canais de verdade numa estrela em memória:
// node --test src/game/pvp/__tests__/redeFfa.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ArenaRedeN from '../rede/ArenaRedeN.js'
import { criarCanal } from '../../../lib/lan/canal.js'
import { criarPartidaFfa, resolverRodadaFfa, FFA } from '../ffa.js'

const PERS = ['kris', 'susie', 'ralsei', 'dess']
const espera = (ms = 30) => new Promise((r) => setTimeout(r, ms))

// host H na vaga 1, convidados A (0), B (2) e C (3)
function montar({ n = 4 } = {}) {
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
      estado: criarPartidaFfa({ personagens: PERS.slice(0, n), semente: 'rede-ffa' }),
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

test('o host começa a rodada e todos recebem o MESMO rodízio antes da escolha', async () => {
  const m = montar()
  await comecar(m)
  const alvos = m.nos.H.arena.estado.alvos
  assert.deepEqual(alvos, [1, 2, 3, 0])
  for (const id of m.convidados) assert.deepEqual(m.nos[id].arena.estado.alvos, alvos)
  m.fechar()
})

test('cada caixa é espelho menos a minha; o coração de cada caixa anda pelo pacote do host', async () => {
  const m = montar()
  await comecar(m)
  for (const id of m.ids) m.nos[id].arena.pistas[m.nos[id].vaga].coracoes[0].x = 300 + m.nos[id].vaga * 10
  for (let k = 0; k < 8; k++) {
    for (const id of m.ids) m.nos[id].rede.atualizar(40)
    await espera(15)
  }
  await espera(150)
  for (const id of m.ids) m.nos[id].rede.atualizar(40)
  for (const id of m.ids) {
    const { vaga, arena } = m.nos[id]
    arena.pistas.forEach((p, k) => {
      assert.equal(p.espelho, k !== vaga)
      if (k !== vaga) assert.ok(Math.abs(p.coracoes[0].x - (300 + k * 10)) < 25, `${id}: caixa ${k} em ${p.coracoes[0].x}`)
    })
  }
  m.fechar()
})

test('jogadas: o host não espera o eliminado nem quem caiu da rede', async () => {
  const m = montar()
  m.nos.H.arena.estado.jogadores[3].eliminado = { rodada: 0, ordem: 1, motivo: 'ko' }
  await comecar(m)
  for (const id of m.ids) m.nos[id].rede.comecarEscolha()
  m.cair('B')
  m.nos.A.rede.enviarJogada(null)
  const p = m.nos.H.rede.juntarJogadas(3000)
  m.nos.H.rede.enviarJogada(null)
  const inicio = Date.now()
  assert.deepEqual(await p, [null, null, null, null])
  assert.ok(Date.now() - inicio < 1500, 'não esperou o relógio inteiro')
  m.fechar()
})

test('quem caiu leva o ataque inteiro no fim da rodada (menos o que já levou), igual em todos os PCs', async () => {
  const m = montar({ n: 3 })
  await comecar(m)
  const e = m.nos.H.arena.estado
  e.jogadores.forEach((j) => (j.energia = 10))
  // o host (vaga 1) ataca a vaga 2 (B), que caiu
  const carta = e.jogadores[1].baralho.mao.find((c) => c.naipe === 'espadas' && c.valor > 1 && c.valor < 14) ?? e.jogadores[1].baralho.mao.find((c) => c.naipe !== 'copas' && c.valor > 1 && c.valor < 14)
  const r = resolverRodadaFfa(e, [null, carta.id, null])
  const caixa = r.caixas[2]
  assert.ok(caixa)
  const hp = e.jogadores[2].hp
  const espera1 = m.nos.A.rede.fimDaRodada()
  const fim = await m.nos.H.rede.fimDaRodada([{ j: 2, caixa, jaLevou: 0 }])
  assert.deepEqual(fim.ausentes, [{ j: 2, dano: Math.min(hp, caixa.dano * FFA.acertosAusente) }])
  const doA = await espera1
  assert.deepEqual(doA.ausentes, fim.ausentes)
  assert.equal(m.nos.A.arena.estado.jogadores[2].hp, e.jogadores[2].hp)
  m.fechar()
})

test('não voltou em 20 s: o host elimina na hora (placement daquele momento) e avisa a arena', async () => {
  const m = montar()
  await comecar(m)
  m.tirar('C') // a vaga 3 saiu de vez
  m.nos.H.rede.atualizar(16)
  const jog = m.nos.H.arena.estado.jogadores[3]
  assert.equal(jog.eliminado.motivo, 'saiu')
  assert.deepEqual(m.nos.H.log.saidas, [3])
  m.nos.H.rede.atualizar(16)
  assert.deepEqual(m.nos.H.log.saidas, [3], 'uma vez só')
  m.fechar()
})

test('quem caiu volta na rodada seguinte com o HP que tinha (evento "voltou"), sem a energia da rodada em que estava fora', async () => {
  const m = montar({ n: 3 })
  m.cair('B')
  await comecar(m)
  const e = m.nos.H.arena.estado
  assert.equal(e.jogadores[2].ausente, true)
  assert.equal(e.jogadores[2].energia, 0)
  e.jogadores[2].hp = 33
  m.voltar('B')
  e.fim = null
  const eventos = await comecar(m)
  assert.ok(eventos[0].some((ev) => ev.tipo === 'voltou' && ev.j === 2))
  assert.equal(e.jogadores[2].ausente, false)
  assert.equal(e.jogadores[2].hp, 33)
  assert.equal(e.jogadores[2].energia, 2, 'só a energia desta rodada')
  m.fechar()
})

test('volta de um convidado no meio da partida: recebe o estado e entra na rodada seguinte', async () => {
  const m = montar()
  await comecar(m)
  const dados = m.nos.H.rede.dadosRetomadaPara('A')
  assert.equal(dados.retomada.entrando, true)
  assert.equal(dados.arena, 'castelo')
  const novo = montar().nos.A
  novo.rede.aplicarRetomada(dados.retomada)
  assert.equal(novo.rede.entrouNaRodada, 1)
  novo.rede.comecarLuta()
  novo.rede.aoEvento('dano', { lado: 2, dano: 9, r: 1 }, 'H')
  assert.deepEqual(novo.log.acertos, [], 'o resto da rodada 1 não vale para quem voltou')
  m.fechar()
})
