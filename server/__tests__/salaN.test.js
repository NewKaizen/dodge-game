import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarLobby, PROTOCOLO, RETOMADA_MS, MODOS_SALA, maxDoModo } from '../lan.js'
import { ELEICAO_MS } from '../eleicao.js'

// Salas de N jogadores (Fase 5A): tamanho por modo, vagas estáveis, repasse em
// estrela pelo host e a queda de um convidado numa sala de 4.

function relogioFalso() {
  let t = Date.UTC(2026, 9, 27, 15, 0, 0)
  const timers = new Set()
  return {
    agora: () => t,
    agendar(fn, ms) {
      const x = { fn, quando: t + ms }
      timers.add(x)
      return () => timers.delete(x)
    },
    andar(ms) {
      t += ms
      for (const x of [...timers].sort((a, b) => a.quando - b.quando)) if (x.quando <= t && timers.delete(x)) x.fn()
    },
  }
}

function montar({ relacoes = null, eleicaoMs = 0 } = {}) {
  const relogio = relogioFalso()
  const lobby = criarLobby({ online: true, agora: relogio.agora, agendar: relogio.agendar, relacoes, eleicaoMs })
  const entrar = (nome, { retomar = null } = {}) => {
    const recebidas = []
    const ws = { readyState: 1, bufferedAmount: 0, send: (m) => recebidas.push(JSON.parse(m)) }
    ws.terminate = () => (ws.readyState = 3)
    const c = lobby.conectar(ws, '10.0.0.2')
    const p = {
      c,
      ws,
      recebidas,
      mandar: (m) => lobby.receber(c, JSON.stringify(m), false, ws),
      ultima: (t) => recebidas.filter((m) => m.t === t).at(-1),
      tipo: (t) => recebidas.filter((m) => m.t === t),
      sala: () => recebidas.filter((m) => m.t === 'sala').at(-1)?.sala,
      chave: () => recebidas.filter((m) => m.t === 'bemvindo').at(-1)?.retomada,
      cair: () => {
        ws.readyState = 3
        lobby.desconectar(c, ws)
      },
    }
    p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome, ...(retomar && { retomar }) })
    return p
  }
  // host + convidados numa sala no modo dado
  const sala = (n, modo = 'coop4') => {
    const host = entrar('ANA')
    host.mandar({ t: 'criar' })
    host.mandar({ t: 'modo', modo })
    const codigo = host.sala().codigo
    const convs = ['BETO', 'CAIO', 'DUDA'].slice(0, n - 1).map((nome) => {
      const p = entrar(nome)
      p.mandar({ t: 'entrar', codigo })
      return p
    })
    return { host, convs, todos: [host, ...convs], codigo, id: host.sala().id }
  }
  return { lobby, relogio, entrar, sala }
}

const vagas = (sala) => sala.membros.map((m) => [m.nome, m.vaga])

test('o tamanho da sala vem do modo', () => {
  assert.equal(maxDoModo('pvp'), 2)
  assert.equal(maxDoModo('coop'), 2)
  assert.equal(maxDoModo('coop4'), 4)
  assert.equal(maxDoModo('ffa'), 4)
  assert.equal(maxDoModo('2x2'), 4)
  assert.equal(maxDoModo('inexistente'), 2)
  assert.ok(Object.values(MODOS_SALA).every((m) => !m.emBreve), 'o CO-OP 3–4 existe desde a 5B, o todos contra todos desde a 5D e o 2x2 desde a 5E')

  const m = montar()
  const { host, codigo } = m.sala(1, 'pvp')
  assert.equal(host.sala().max, 2)
  const b = m.entrar('BETO')
  b.mandar({ t: 'entrar', codigo })
  const c = m.entrar('CAIO')
  c.mandar({ t: 'entrar', codigo })
  assert.equal(c.ultima('erro').msg, 'a sala está cheia: peça outro código ao seu amigo')
  // PVP com 2 não vira sala de 4 sozinha: o host troca o modo e o terceiro entra
  host.mandar({ t: 'modo', modo: 'coop4' })
  assert.equal(host.sala().max, 4)
  c.mandar({ t: 'entrar', codigo })
  assert.equal(host.sala().membros.length, 3)
  // com 3 na sala, um modo de 2 não serve
  host.mandar({ t: 'modo', modo: 'pvp' })
  assert.equal(host.sala().modo, 'coop4')
  assert.match(host.ultima('erro').msg, /até 2 jogadores: a sala tem 3/)
})

test('vagas: o host é a 0, quem entra pega a menor livre; fora da partida as vagas se compactam', () => {
  const m = montar()
  const { host, convs, codigo } = m.sala(4)
  assert.deepEqual(vagas(host.sala()), [['ANA', 0], ['BETO', 1], ['CAIO', 2], ['DUDA', 3]])
  // todo mundo vê a mesma ordem (por vaga, o host primeiro)
  for (const p of convs) assert.deepEqual(vagas(p.sala()), vagas(host.sala()))
  // o da vaga 1 sai no lobby: os outros descem (sem buracos)
  convs[0].mandar({ t: 'sair' })
  assert.deepEqual(vagas(host.sala()), [['ANA', 0], ['CAIO', 1], ['DUDA', 2]])
  const novo = m.entrar('EVA')
  novo.mandar({ t: 'entrar', codigo })
  assert.deepEqual(vagas(host.sala()), [['ANA', 0], ['CAIO', 1], ['DUDA', 2], ['EVA', 3]])
  // pronto por membro
  convs[1].mandar({ t: 'pronto', valor: true })
  assert.deepEqual(host.sala().membros.map((x) => x.pronto), [true, true, false, false])
})

test('na partida as vagas não mudam: quem sai deixa a vaga vazia até a partida acabar', () => {
  const m = montar()
  const { host, convs } = m.sala(4)
  host.mandar({ t: 'partida', valor: true })
  convs[0].mandar({ t: 'sair' })
  assert.deepEqual(vagas(host.sala()), [['ANA', 0], ['CAIO', 2], ['DUDA', 3]])
  host.mandar({ t: 'partida', valor: false })
  assert.deepEqual(vagas(host.sala()), [['ANA', 0], ['CAIO', 1], ['DUDA', 2]])
})

test('expulsar numa sala de 4: só o alvo sai, os outros ficam', () => {
  const m = montar()
  const { host, convs } = m.sala(4)
  host.mandar({ t: 'expulsar', id: convs[1].c.id })
  assert.equal(convs[1].ultima('fechada').motivo, 'o host tirou você da sala')
  assert.deepEqual(vagas(host.sala()), [['ANA', 0], ['BETO', 1], ['DUDA', 2]])
  // convidado não expulsa
  convs[0].mandar({ t: 'expulsar', id: convs[2].c.id })
  assert.equal(host.sala().membros.length, 3)
})

test('estrela: o convidado só fala com o host; o host fala com todos ou com um', () => {
  const m = montar()
  const { host, convs } = m.sala(4)
  const [a, b, c] = convs
  const limpar = () => [host, a, b, c].forEach((p) => (p.recebidas.length = 0))
  const repasses = (p) => p.tipo('de').map((x) => [x.de, x.dados.n])

  limpar()
  a.mandar({ t: 'para', dados: { tipo: 'rede', n: 1 } })
  // tentando mandar direto para outro convidado: vai para o host mesmo assim
  a.mandar({ t: 'para', a: b.c.id, dados: { tipo: 'rede', n: 2 } })
  assert.deepEqual(repasses(host), [[a.c.id, 1], [a.c.id, 2]])
  assert.deepEqual(repasses(b), [])
  assert.deepEqual(repasses(c), [])

  limpar()
  host.mandar({ t: 'para', dados: { tipo: 'rede', n: 3 } }) // todos
  host.mandar({ t: 'para', a: b.c.id, dados: { tipo: 'rede', n: 4 } }) // só um
  host.mandar({ t: 'para', a: 'nao-existe', dados: { tipo: 'rede', n: 5 } }) // ninguém
  assert.deepEqual(repasses(a), [[host.c.id, 3]])
  assert.deepEqual(repasses(b), [[host.c.id, 3], [host.c.id, 4]])
  assert.deepEqual(repasses(c), [[host.c.id, 3]])
  assert.deepEqual(repasses(host), [])
})

test('um convidado cai numa sala de 4: a sala segue, só a vaga dele espera 20 s', () => {
  const m = montar()
  const { host, convs } = m.sala(4)
  host.mandar({ t: 'partida', valor: true })
  const [a, b, c] = convs
  const chave = b.chave()
  b.cair()
  const s = host.sala()
  assert.equal(s.membros.length, 4)
  assert.ok(s.membros.find((x) => x.nome === 'CAIO').caiu > 0)
  assert.ok(s.membros.filter((x) => x.nome !== 'CAIO').every((x) => x.caiu === null))
  // volta antes do prazo: a mesma vaga
  m.relogio.andar(5000)
  const volta = m.entrar('CAIO', { retomar: chave })
  assert.equal(volta.ultima('bemvindo').retomado, true)
  assert.deepEqual(vagas(host.sala()), [['ANA', 0], ['BETO', 1], ['CAIO', 2], ['DUDA', 3]])
  assert.ok(host.sala().membros.every((x) => x.caiu === null))

  // cai de novo e não volta: sai da sala, que continua com os outros três (e as vagas deles)
  const outro = volta
  outro.cair()
  m.relogio.andar(RETOMADA_MS + 10)
  assert.deepEqual(vagas(host.sala()), [['ANA', 0], ['BETO', 1], ['DUDA', 3]])
  assert.equal(host.sala().emPartida, true)
  for (const p of [a, c]) assert.equal(p.ultima('fechada'), undefined)
  // a partida acaba: a sala volta a ser 0..n-1
  host.mandar({ t: 'partida', valor: false })
  assert.deepEqual(vagas(a.sala()), [['ANA', 0], ['BETO', 1], ['DUDA', 2]])
})

test('o host cai numa sala de 4 e não volta: a sala fecha para todos (a regra da 2D)', () => {
  const m = montar()
  const { host, convs } = m.sala(4)
  host.mandar({ t: 'partida', valor: true })
  host.cair()
  for (const p of convs) assert.ok(p.sala().membros[0].caiu > 0)
  m.relogio.andar(RETOMADA_MS + 10)
  for (const p of convs) assert.match(p.ultima('fechada').motivo, /o host não voltou a tempo/)
  assert.equal(m.lobby.salas.size, 0)
})

test('bloqueio entre dois convidados: o que entrou depois sai; o host fica', async () => {
  const bloqueios = { 'u-caio': new Set(['u-beto']) }
  const relacoes = async (u) => ({ amigos: new Set(), bloqueios: bloqueios[u] ?? new Set(), pedidos: new Set() })
  const m = montar({ relacoes })
  const { host, convs } = m.sala(3)
  // sem contas não há bloqueio: simula as contas já carregadas
  const [b, c] = convs
  b.c.usuario = 'u-beto'
  c.c.usuario = 'u-caio'
  c.c.bloqueios = new Set(['u-beto'])
  host.mandar({ t: 'partida', valor: true })
  host.mandar({ t: 'partida', valor: false }) // ao voltar ao lobby o bloqueio vale
  assert.match(c.ultima('fechada').motivo, /há um bloqueio/)
  assert.deepEqual(vagas(host.sala()), [['ANA', 0], ['BETO', 1]])
})

// ---------- dono x host da partida (eleição pela conexão) ----------

const ping = (p, ms) => p.mandar({ t: 'meuPing', ms })
const papeis = (sala) => sala.membros.map((x) => [x.nome, x.papel, x.dono])

test('eleição: o dono começa, o servidor mede e o melhor centro vira o host da partida', () => {
  const m = montar({ eleicaoMs: ELEICAO_MS })
  const { host: dono, convs, todos } = m.sala(4)
  const [b, c, d] = convs
  ping(dono, 200)
  ping(b, 40)
  ping(c, 20)
  ping(d, 40)
  // só o dono pede a eleição
  b.mandar({ t: 'partida', valor: true, eleicao: true })
  assert.equal(dono.sala().eleicao, false)
  dono.mandar({ t: 'partida', valor: true, eleicao: true })
  const pedido = b.ultima('eleicao')
  assert.equal(pedido.ms, ELEICAO_MS)
  assert.equal(dono.sala().eleicao, true)
  assert.equal(dono.sala().emPartida, false)
  // c tem direto com todos (rápido); quem manda medida de outra eleição não conta
  c.mandar({ t: 'medicao', id: 'outra', diretos: {} })
  for (const p of todos) p.mandar({ t: 'medicao', id: pedido.id, diretos: p === c ? { [dono.c.id]: 60, [b.c.id]: 10, [d.c.id]: 12 } : {} })
  // todos responderam: não espera o prazo
  const s = dono.sala()
  assert.equal(s.emPartida, true)
  assert.equal(s.eleito.nome, 'CAIO')
  assert.equal(s.eleito.motivo, 'melhor_conexao')
  assert.deepEqual(papeis(s), [['ANA', 'convidado', true], ['BETO', 'convidado', false], ['CAIO', 'host', false], ['DUDA', 'convidado', false]])
  assert.equal(c.ultima('comecar').salaId, s.id)
  assert.equal(dono.ultima('comecar'), undefined)
  // as vagas não mudam: o host da partida é outra coisa
  assert.deepEqual(vagas(s), [['ANA', 0], ['BETO', 1], ['CAIO', 2], ['DUDA', 3]])

  // a estrela agora é em volta de CAIO: o que o dono manda só chega a ele
  for (const p of todos) p.recebidas.length = 0
  dono.mandar({ t: 'para', dados: { tipo: 'rede', n: 1 } })
  assert.deepEqual(c.tipo('de').map((x) => x.de), [dono.c.id])
  assert.equal(b.tipo('de').length, 0)
  c.mandar({ t: 'para', a: b.c.id, dados: { tipo: 'rede', n: 2 } })
  assert.equal(b.tipo('de').length, 1)

  // revanche: o host marca de novo, sem eleição e sem trocar ninguém
  c.mandar({ t: 'partida', valor: false })
  c.mandar({ t: 'partida', valor: true })
  assert.equal(dono.sala().eleito.nome, 'CAIO')
  assert.equal(dono.sala().emPartida, true)
})

test('papéis separados: o dono continua tirando gente e escolhendo o modo com outro de host', () => {
  const m = montar()
  const { host: dono, convs } = m.sala(3)
  const [b, c] = convs
  ping(dono, 400)
  ping(b, 10)
  ping(c, 10)
  dono.mandar({ t: 'partida', valor: true, eleicao: true }) // eleicaoMs 0: decide na hora
  assert.equal(dono.sala().eleito.nome, 'BETO')
  // o host da partida volta ao lobby (só ele desmarca)
  dono.mandar({ t: 'partida', valor: false })
  assert.equal(dono.sala().emPartida, true)
  b.mandar({ t: 'partida', valor: false })
  assert.equal(dono.sala().emPartida, false)
  // no lobby: o host eleito não tira ninguém nem muda o modo; o dono sim
  b.mandar({ t: 'expulsar', id: c.c.id })
  b.mandar({ t: 'modo', modo: 'ffa' })
  assert.equal(dono.sala().membros.length, 3)
  assert.equal(dono.sala().modo, 'coop4')
  dono.mandar({ t: 'modo', modo: 'ffa' })
  assert.equal(dono.sala().modo, 'ffa')
  // o host eleito marca pronto como convidado; o dono não precisa
  b.mandar({ t: 'pronto', valor: true })
  assert.deepEqual(dono.sala().membros.map((x) => x.pronto), [true, true, false])
  dono.mandar({ t: 'expulsar', id: c.c.id })
  assert.equal(dono.sala().membros.length, 2)
  // o host eleito sai no lobby: o centro volta ao dono
  b.mandar({ t: 'sair' })
  assert.deepEqual(papeis(dono.sala()), [['ANA', 'host', true]])
  assert.equal(dono.sala().eleito, null)
})

test('o host eleito sai no meio da partida: a sala fecha para todos (como o host de sempre)', () => {
  const m = montar()
  const { host: dono, convs } = m.sala(3)
  ping(dono, 400)
  ping(convs[0], 10)
  ping(convs[1], 10)
  dono.mandar({ t: 'partida', valor: true, eleicao: true })
  assert.equal(dono.sala().eleito.nome, 'BETO')
  convs[0].mandar({ t: 'sair' })
  assert.ok(dono.ultima('fechada'))
  assert.ok(convs[1].ultima('fechada'))
})

test('eleição com 2: sem medidas melhores fica o dono; o PVP 1x1 segue igual', () => {
  const m = montar({ eleicaoMs: ELEICAO_MS })
  const { host: dono, convs } = m.sala(2, 'pvp')
  ping(dono, 300)
  ping(convs[0], 10)
  dono.mandar({ t: 'partida', valor: true, eleicao: true })
  m.relogio.andar(ELEICAO_MS + 1) // ninguém mandou medida: o prazo decide
  const s = dono.sala()
  assert.equal(s.emPartida, true)
  assert.equal(s.eleito.nome, 'ANA')
  assert.equal(dono.ultima('comecar').salaId, s.id)
})

test('eleição x alguém saindo: quem saiu não conta; sem gente, não começa', () => {
  const m = montar({ eleicaoMs: ELEICAO_MS })
  const { host: dono, convs } = m.sala(3)
  const [b, c] = convs
  ping(dono, 300)
  ping(b, 10)
  ping(c, 10)
  dono.mandar({ t: 'partida', valor: true, eleicao: true })
  const id = b.ultima('eleicao').id
  dono.mandar({ t: 'medicao', id, diretos: {} })
  b.mandar({ t: 'medicao', id, diretos: {} })
  // c (que faltava) sai: os que ficaram já responderam, decide agora sem ele
  c.mandar({ t: 'sair' })
  let s = dono.sala()
  assert.equal(s.emPartida, true)
  assert.equal(s.membros.length, 2)
  assert.equal(s.eleito.nome, 'ANA', 'com 2 a ligação empata: fica o dono')

  // outra sala: o único convidado sai no meio da eleição
  const m2 = montar({ eleicaoMs: ELEICAO_MS })
  const x = m2.sala(2, 'coop')
  x.host.mandar({ t: 'partida', valor: true, eleicao: true })
  x.convs[0].mandar({ t: 'sair' })
  m2.relogio.andar(ELEICAO_MS + 1)
  s = x.host.sala()
  assert.equal(s.emPartida, false)
  assert.equal(s.eleicao, false)
  assert.equal(x.host.ultima('erro').msg, 'a partida não começou: falta gente na sala')

  // o dono sai no meio da eleição: a sala fecha e o prazo não faz nada
  const m3 = montar({ eleicaoMs: ELEICAO_MS })
  const y = m3.sala(3)
  y.host.mandar({ t: 'partida', valor: true, eleicao: true })
  y.host.mandar({ t: 'sair' })
  m3.relogio.andar(ELEICAO_MS + 1)
  assert.equal(m3.lobby.salas.size, 0)
  assert.equal(y.convs[0].ultima('comecar'), undefined)
})

test('eleição x retomada: quem está caído não concorre; quem volta no meio recebe o pedido', () => {
  const m = montar({ eleicaoMs: ELEICAO_MS })
  const { host: dono, convs } = m.sala(3)
  const [b, c] = convs
  ping(dono, 300)
  ping(b, 10)
  ping(c, 10)
  // uma partida (sem eleição, como a revanche) em que c cai; o dono volta ao lobby
  dono.mandar({ t: 'partida', valor: true })
  const chave = c.chave()
  c.cair()
  dono.mandar({ t: 'partida', valor: false })
  assert.ok(dono.sala().membros.find((x) => x.nome === 'CAIO').caiu > 0)
  // eleição com c caído: ele não manda nada e mesmo assim não trava (todos os de pé responderam)
  dono.mandar({ t: 'partida', valor: true, eleicao: true })
  const id = b.ultima('eleicao').id
  dono.mandar({ t: 'medicao', id, diretos: {} })
  m.relogio.andar(200)
  // c volta no meio: recebe o pedido de novo e ainda pode responder
  const volta = m.entrar('CAIO', { retomar: chave })
  assert.equal(volta.ultima('bemvindo').retomado, true)
  assert.equal(volta.ultima('eleicao').id, id)
  assert.ok(volta.ultima('eleicao').ms <= ELEICAO_MS - 200)
  b.mandar({ t: 'medicao', id, diretos: {} })
  assert.equal(dono.sala().emPartida, false, 'c voltou: espera a medida dele')
  volta.mandar({ t: 'medicao', id, diretos: {} })
  const s = dono.sala()
  assert.equal(s.emPartida, true)
  // c caiu nesta sala: pesa contra ele; b (ping 10, sem quedas) é o melhor
  assert.equal(s.eleito.nome, 'BETO')
})
