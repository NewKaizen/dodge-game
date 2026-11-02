// node --test server/__tests__/party.test.js
// MODO PARTY no servidor (docs/online.md "Modo Party"): o COMEÇAR PARTY elege o host sem marcar a
// partida, o host muda o modo entre as partidas, quem é de fora só entra na tela CONTINUAR/SAIR e a
// party acaba com menos de 3 ou sem o host.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarLobby, PROTOCOLO } from '../lan.js'

function montar({ eleicaoMs = 0 } = {}) {
  const lobby = criarLobby({ online: true, eleicaoMs, agendar: () => () => {} })
  const entrar = (nome) => {
    const recebidas = []
    const ws = { readyState: 1, bufferedAmount: 0, send: (m) => recebidas.push(JSON.parse(m)) }
    ws.terminate = () => (ws.readyState = 3)
    const c = lobby.conectar(ws, '10.0.0.2')
    const p = {
      c,
      recebidas,
      mandar: (m) => lobby.receber(c, JSON.stringify(m), false, ws),
      ultima: (t) => recebidas.filter((m) => m.t === t).at(-1),
      sala: () => recebidas.filter((m) => m.t === 'sala').at(-1)?.sala,
    }
    p.mandar({ t: 'ola', protocolo: PROTOCOLO, nome })
    return p
  }
  const sala = (n, modo = 'coop4') => {
    const dono = entrar('ANA')
    dono.mandar({ t: 'criar' })
    dono.mandar({ t: 'modo', modo })
    const codigo = dono.sala().codigo
    const convs = ['BETO', 'CAIO', 'DUDA'].slice(0, n - 1).map((nome) => {
      const p = entrar(nome)
      p.mandar({ t: 'entrar', codigo })
      p.mandar({ t: 'pronto', valor: true })
      return p
    })
    return { dono, convs, todos: [dono, ...convs], codigo }
  }
  return { entrar, sala }
}

const comecarParty = (dono) => dono.mandar({ t: 'partida', valor: true, eleicao: true, party: true })
const hostDe = (todos) => todos.find((p) => p.sala().membros.find((m) => m.id === p.c.id).papel === 'host')

test('COMEÇAR PARTY: elege o host, não marca a partida e manda comecar com party', () => {
  const m = montar()
  const { dono, todos } = m.sala(4)
  comecarParty(dono)
  const s = dono.sala()
  assert.deepEqual(s.party, { aberta: false })
  assert.equal(s.emPartida, false)
  const host = hostDe(todos)
  assert.deepEqual(host.ultima('comecar'), { t: 'comecar', salaId: s.id, party: true })
})

test('a party precisa de 3: com 2 não começa', () => {
  const m = montar()
  const { dono } = m.sala(2)
  comecarParty(dono)
  assert.equal(dono.sala().party, null)
  assert.match(dono.ultima('erro').msg, /3 ou 4/)
})

test('o host muda o modo entre as partidas (2x2 só com 4) e o dono não muda no meio da party', () => {
  const m = montar()
  const { dono, todos } = m.sala(3)
  comecarParty(dono)
  const host = hostDe(todos)
  host.mandar({ t: 'party', acao: 'modo', modo: '2x2' })
  assert.equal(dono.sala().modo, 'coop4', '2x2 com 3 não cabe')
  host.mandar({ t: 'party', acao: 'modo', modo: 'ffa' })
  assert.equal(dono.sala().modo, 'ffa')
  host.mandar({ t: 'party', acao: 'modo', modo: 'pvp' })
  assert.equal(dono.sala().modo, 'ffa', 'modo de 2 não é da party')
  dono.mandar({ t: 'modo', modo: 'coop4' })
  assert.equal(dono.sala().modo, 'ffa')
  // na partida o modo não muda
  host.mandar({ t: 'partida', valor: true })
  host.mandar({ t: 'party', acao: 'modo', modo: 'coop4' })
  assert.equal(dono.sala().modo, 'ffa')
  assert.equal(dono.sala().emPartida, true)
  assert.ok(dono.sala().party, 'a party segue durante a partida')
})

test('quem é de fora só entra com a party aberta (a tela CONTINUAR/SAIR)', () => {
  const m = montar()
  const { dono, todos, codigo } = m.sala(3)
  comecarParty(dono)
  const host = hostDe(todos)
  const novo = m.entrar('EVA')
  novo.mandar({ t: 'entrar', codigo })
  assert.match(novo.ultima('erro').msg, /meio de uma partida/)
  host.mandar({ t: 'party', acao: 'aberta', valor: true })
  assert.equal(dono.sala().party.aberta, true)
  novo.mandar({ t: 'entrar', codigo })
  assert.equal(dono.sala().membros.length, 4)
  assert.ok(novo.sala().party, 'quem entrou vê a party (vai para a próxima votação)')
})

test('a sala cai para 2: a party acaba e a sala segue', () => {
  const m = montar()
  const { dono, convs, todos } = m.sala(3)
  comecarParty(dono)
  const host = hostDe(todos)
  const sai = convs.find((p) => p !== host)
  sai.mandar({ t: 'sair' })
  assert.equal(dono.sala().party, null)
  assert.equal(dono.sala().membros.length, 2)
})

test('o host da party sai (não é o dono): a party acaba, o centro volta ao dono', () => {
  const m = montar({ eleicaoMs: 1500 })
  const { dono, convs, todos } = m.sala(4)
  for (const [p, ms] of [[dono, 200], [convs[0], 40], [convs[1], 20], [convs[2], 40]]) p.mandar({ t: 'meuPing', ms })
  comecarParty(dono)
  const pedido = convs[0].ultima('eleicao')
  const c = convs[1]
  for (const p of todos) p.mandar({ t: 'medicao', id: pedido.id, diretos: p === c ? { [dono.c.id]: 60, [convs[0].c.id]: 10, [convs[2].c.id]: 12 } : {} })
  assert.equal(hostDe(todos), c)
  assert.equal(c.ultima('comecar').party, true)
  c.mandar({ t: 'sair' })
  const s = dono.sala()
  assert.equal(s.party, null)
  assert.equal(s.membros.length, 3)
  assert.equal(s.membros.find((x) => x.papel === 'host').nome, 'ANA')
})

test('party fim: o host ou o dono encerram; um convidado não', () => {
  const m = montar()
  const { dono, convs, todos } = m.sala(4)
  comecarParty(dono)
  const outro = convs.find((p) => p !== hostDe(todos))
  outro.mandar({ t: 'party', acao: 'fim' })
  assert.ok(dono.sala().party)
  dono.mandar({ t: 'party', acao: 'fim' })
  assert.equal(dono.sala().party, null)
})
