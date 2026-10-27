import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarLobby, PROTOCOLO, RETOMADA_MS, MODOS_SALA, maxDoModo } from '../lan.js'

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

function montar({ relacoes = null } = {}) {
  const relogio = relogioFalso()
  const lobby = criarLobby({ online: true, agora: relogio.agora, agendar: relogio.agendar, relacoes })
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
  assert.ok(MODOS_SALA.coop4.emBreve && MODOS_SALA.ffa.emBreve && MODOS_SALA['2x2'].emBreve)
  assert.ok(!MODOS_SALA.pvp.emBreve && !MODOS_SALA.coop.emBreve)

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
