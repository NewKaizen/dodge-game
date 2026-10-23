import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarLobby, trocarMdns, ipParaAlcancar, broadcasts, PROTOCOLO } from '../lan.js'

const LOCAIS = [{ ip: '192.168.0.10', mascara: '255.255.255.0' }, { ip: '10.0.0.5', mascara: '255.0.0.0' }]

function montar() {
  const lobby = criarLobby({ locais: () => LOCAIS })
  const entrar = (ip, nome) => {
    const recebidas = []
    const ws = { readyState: 1, bufferedAmount: 0, send: (m) => recebidas.push(typeof m === 'string' ? JSON.parse(m) : m) }
    const c = lobby.conectar(ws, ip)
    const mandar = (m) => lobby.receber(c, JSON.stringify(m))
    mandar({ t: 'ola', protocolo: PROTOCOLO, nome })
    return { c, recebidas, mandar, ultima: (t) => recebidas.filter((m) => m.t === t).at(-1) }
  }
  return { lobby, entrar }
}

test('troca o nome mDNS do candidato pelo IP', () => {
  const c = 'candidate:1 1 udp 2122260223 3f1c2a4e-1b2c-4d5e-8f90-abcdef012345.local 54321 typ host generation 0'
  assert.equal(trocarMdns(c, '192.168.0.20'), 'candidate:1 1 udp 2122260223 192.168.0.20 54321 typ host generation 0')
  assert.equal(trocarMdns(undefined, '1.2.3.4'), undefined)
})

test('escolhe o IP da mesma rede de quem vai receber', () => {
  assert.equal(ipParaAlcancar('192.168.0.33', LOCAIS), '192.168.0.10')
  assert.equal(ipParaAlcancar('10.9.8.7', LOCAIS), '10.0.0.5')
  assert.equal(ipParaAlcancar('127.0.0.1', LOCAIS), '127.0.0.1')
  assert.equal(ipParaAlcancar('172.16.0.2', LOCAIS), '192.168.0.10')
})

test('broadcast de cada rede', () => {
  assert.deepEqual(broadcasts(LOCAIS), ['192.168.0.255', '10.255.255.255', '255.255.255.255'])
})

test('versão diferente não entra', () => {
  const lobby = criarLobby({ locais: () => LOCAIS })
  const recebidas = []
  const c = lobby.conectar({ readyState: 1, send: (m) => recebidas.push(JSON.parse(m)) }, '192.168.0.2')
  lobby.receber(c, JSON.stringify({ t: 'ola', protocolo: 999, nome: 'x' }))
  lobby.receber(c, JSON.stringify({ t: 'criar' }))
  assert.equal(recebidas[0].t, 'erro')
  assert.equal(lobby.salas.size, 0)
})

test('criar, entrar, pronto, modo e partida', () => {
  const { lobby, entrar } = montar()
  const host = entrar('127.0.0.1', 'ANA')
  const conv = entrar('192.168.0.33', 'BETO')
  host.mandar({ t: 'criar' })
  const sala = host.ultima('sala').sala
  assert.equal(sala.nome, 'SALA DE ANA')

  conv.mandar({ t: 'listar' })
  assert.equal(conv.ultima('salas').salas[0].host, 'ANA')

  conv.mandar({ t: 'entrar', sala: sala.id })
  assert.deepEqual(conv.ultima('sala').sala.membros.map((m) => [m.nome, m.papel, m.pronto]), [
    ['ANA', 'host', true],
    ['BETO', 'convidado', false],
  ])

  conv.mandar({ t: 'pronto', valor: true })
  assert.equal(host.ultima('sala').sala.membros[1].pronto, true)
  host.mandar({ t: 'modo', modo: 'coop' })
  assert.equal(host.ultima('sala').sala.modo, 'coop')
  assert.equal(host.ultima('sala').sala.membros[1].pronto, false, 'trocar o modo pede confirmação de novo')

  conv.mandar({ t: 'partida', valor: true }) // só o host começa
  assert.equal(host.ultima('sala').sala.emPartida, false)
  host.mandar({ t: 'partida', valor: true })
  assert.equal(conv.ultima('sala').sala.emPartida, true)

  // terceiro não entra
  const terceiro = entrar('192.168.0.44', 'CAIO')
  terceiro.mandar({ t: 'entrar', sala: sala.id })
  assert.equal(terceiro.ultima('erro').msg, 'a sala está cheia')
  assert.equal(lobby.salas.get(sala.id).membros.size, 2)
})

test('repassa sinais trocando o mDNS pelo IP que o outro alcança', () => {
  const { entrar } = montar()
  const host = entrar('127.0.0.1', 'ANA')
  const conv = entrar('192.168.0.33', 'BETO')
  host.mandar({ t: 'criar' })
  conv.mandar({ t: 'entrar', sala: host.ultima('sala').sala.id })

  host.mandar({ t: 'para', dados: { tipo: 'ice', candidato: { candidate: 'candidate:1 1 udp 1 abc-1.local 5000 typ host', sdpMid: '0' } } })
  const recebido = conv.ultima('de')
  assert.equal(recebido.de, host.c.id)
  assert.equal(recebido.dados.candidato.candidate, 'candidate:1 1 udp 1 192.168.0.10 5000 typ host')

  conv.mandar({ t: 'para', dados: { tipo: 'ice', candidato: { candidate: 'candidate:1 1 udp 1 xyz.local 6000 typ host' } } })
  assert.equal(host.ultima('de').dados.candidato.candidate, 'candidate:1 1 udp 1 192.168.0.33 6000 typ host')

  conv.mandar({ t: 'para', dados: { tipo: 'joy', x: 100, y: 0 } })
  assert.deepEqual(host.ultima('de').dados, { tipo: 'joy', x: 100, y: 0 })
})

test('quadros binários só do host para o convidado', () => {
  const { lobby, entrar } = montar()
  const host = entrar('127.0.0.1', 'ANA')
  const conv = entrar('192.168.0.33', 'BETO')
  host.mandar({ t: 'criar' })
  conv.mandar({ t: 'entrar', sala: host.ultima('sala').sala.id })
  const quadro = Buffer.from([1, 2, 3])
  lobby.receber(host.c, quadro, true)
  lobby.receber(conv.c, Buffer.from([9]), true)
  assert.equal(conv.recebidas.at(-1), quadro)
  assert.ok(!host.recebidas.some((m) => Buffer.isBuffer(m)))
})

test('host saindo fecha a sala; convidado saindo libera a vaga', () => {
  const { lobby, entrar } = montar()
  const host = entrar('127.0.0.1', 'ANA')
  const conv = entrar('192.168.0.33', 'BETO')
  host.mandar({ t: 'criar' })
  const id = host.ultima('sala').sala.id
  conv.mandar({ t: 'entrar', sala: id })
  conv.mandar({ t: 'sair' })
  assert.equal(host.ultima('sala').sala.membros.length, 1)
  conv.mandar({ t: 'entrar', sala: id })
  lobby.desconectar(host.c)
  assert.equal(conv.ultima('fechada').motivo, 'o host desconectou')
  assert.equal(lobby.salas.size, 0)
  assert.equal(conv.c.sala, null)
})

test('expulsar e chat', () => {
  const { entrar } = montar()
  const host = entrar('127.0.0.1', 'ANA')
  const conv = entrar('192.168.0.33', 'BETO')
  host.mandar({ t: 'criar' })
  conv.mandar({ t: 'entrar', sala: host.ultima('sala').sala.id })
  conv.mandar({ t: 'chat', texto: '  bora\u0007  ' })
  assert.deepEqual(host.ultima('chat'), { t: 'chat', de: conv.c.id, nome: 'BETO', texto: 'bora' })
  host.mandar({ t: 'expulsar', id: conv.c.id })
  assert.equal(conv.ultima('fechada').motivo, 'o host tirou você da sala')
  assert.equal(host.ultima('sala').sala.membros.length, 1)
})
