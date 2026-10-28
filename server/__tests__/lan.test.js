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
  assert.equal(terceiro.ultima('erro').msg, 'a sala está cheia: peça outro código ao seu amigo')
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
  assert.equal(conv.ultima('fechada').motivo, 'o host perdeu a conexão: a sala foi fechada')
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

test('chat da sala passa pelo filtro de palavras (os dois veem ***)', () => {
  const { entrar } = montar()
  const host = entrar('127.0.0.1', 'ANA')
  const conv = entrar('192.168.0.33', 'BETO')
  host.mandar({ t: 'criar' })
  conv.mandar({ t: 'entrar', sala: host.ultima('sala').sala.id })
  conv.mandar({ t: 'chat', texto: 'vai fdp' })
  for (const p of [host, conv]) assert.equal(p.ultima('chat').texto, 'vai ***')
  // o filtro novo: porra, caralho com leet, cu só como palavra inteira
  for (const [entrada, saida] of [['que PORRA, vsf', 'que *****, ***'], ['c4r4lh0 de jogo', '******* de jogo'], ['curso de computador', 'curso de computador'], ['vai tomar no cu', 'vai tomar no **']]) {
    conv.mandar({ t: 'chat', texto: entrada })
    for (const p of [host, conv]) assert.equal(p.ultima('chat').texto, saida)
  }
})

// ---------- ONLINE ----------

function montarOnline(extra = {}) {
  const lobby = criarLobby({ locais: () => LOCAIS, online: true, ice: [{ urls: ['stun:stun.exemplo:3478'] }], ...extra })
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

test('online: boas-vindas dizem que é online e mandam o STUN/TURN', () => {
  const { entrar } = montarOnline()
  const ana = entrar('200.1.2.3', 'ANA')
  const ola = ana.ultima('bemvindo')
  assert.equal(ola.online, true)
  assert.deepEqual(ola.ice, [{ urls: ['stun:stun.exemplo:3478'] }])
  assert.deepEqual(ola.enderecos, [], 'na internet não mostra o IP da máquina')
})

test('online: salas não aparecem na lista; entra pelo código', () => {
  const { lobby, entrar } = montarOnline()
  const host = entrar('200.1.2.3', 'ANA')
  const conv = entrar('177.4.5.6', 'BETO')
  host.mandar({ t: 'criar' })
  const sala = host.ultima('sala').sala
  assert.match(sala.codigo, /^[A-Z2-9]{5}$/)
  assert.doesNotMatch(sala.codigo, /[01OIL]/)

  conv.mandar({ t: 'listar' })
  assert.deepEqual(conv.ultima('salas').salas, [])
  conv.mandar({ t: 'entrar', sala: sala.id }) // pelo id não dá
  assert.match(conv.ultima('erro').msg, /não existe/)
  assert.equal(lobby.salas.get(sala.id).membros.size, 1)

  conv.mandar({ t: 'entrar', codigo: 'ZZZZZ' })
  assert.equal(conv.ultima('erro').msg, 'não achei a sala ZZZZZ: confira o código')

  conv.mandar({ t: 'entrar', codigo: ` ${sala.codigo.toLowerCase()} ` }) // minúsculo e com espaço vale
  assert.deepEqual(conv.ultima('sala').sala.membros.map((m) => m.nome), ['ANA', 'BETO'])
})

test('online: o código some quando a sala fecha', () => {
  const { lobby, entrar } = montarOnline()
  const host = entrar('200.1.2.3', 'ANA')
  host.mandar({ t: 'criar' })
  const { codigo } = host.ultima('sala').sala
  lobby.desconectar(host.c)
  const conv = entrar('177.4.5.6', 'BETO')
  conv.mandar({ t: 'entrar', codigo })
  assert.match(conv.ultima('erro').msg, /não achei a sala/)
})

test('online: repassa os sinais do WebRTC sem mexer', () => {
  const { entrar } = montarOnline()
  const host = entrar('200.1.2.3', 'ANA')
  const conv = entrar('177.4.5.6', 'BETO')
  host.mandar({ t: 'criar' })
  conv.mandar({ t: 'entrar', codigo: host.ultima('sala').sala.codigo })
  const candidato = { candidate: 'candidate:1 1 udp 1 abc-1.local 5000 typ host', sdpMid: '0' }
  host.mandar({ t: 'para', dados: { tipo: 'ice', candidato } })
  assert.deepEqual(conv.ultima('de').dados.candidato, candidato)
})

test('online: servidor lotado não cria sala', () => {
  const { lobby, entrar } = montarOnline({ maxSalas: 1 })
  entrar('200.1.2.3', 'ANA').mandar({ t: 'criar' })
  const beto = entrar('177.4.5.6', 'BETO')
  beto.mandar({ t: 'criar' })
  assert.match(beto.ultima('erro').msg, /lotado/)
  assert.equal(lobby.salas.size, 1)
})

test('limita quem manda mensagem demais', () => {
  let t = 0
  const { entrar } = montarOnline({ agora: () => t })
  const host = entrar('200.1.2.3', 'ANA')
  const conv = entrar('177.4.5.6', 'BETO')
  host.mandar({ t: 'criar' })
  conv.mandar({ t: 'entrar', codigo: host.ultima('sala').sala.codigo })
  const antes = host.recebidas.length
  for (let i = 0; i < 1000; i++) conv.mandar({ t: 'para', dados: { tipo: 'joy', x: i, y: 0 } })
  const passaram = host.recebidas.length - antes
  assert.ok(passaram > 100 && passaram < 300, `passaram ${passaram}`)
  t += 1000 // um segundo depois, volta a passar
  conv.mandar({ t: 'para', dados: { tipo: 'joy', x: 1, y: 0 } })
  assert.deepEqual(host.ultima('de').dados, { tipo: 'joy', x: 1, y: 0 })
})

test('nome de convidado com palavrão não aparece para os outros (convidado não tem denúncia)', () => {
  const { entrar } = montar()
  const host = entrar('127.0.0.1', 'C4R4LH0')
  const conv = entrar('192.168.0.33', 'BETO')
  host.mandar({ t: 'criar' })
  conv.mandar({ t: 'entrar', sala: host.ultima('sala').sala.id })
  assert.deepEqual(conv.ultima('sala').sala.membros.map((m) => m.nome), ['JOGADOR', 'BETO'])
  conv.mandar({ t: 'nome', nome: 'filho da puta' })
  assert.match(conv.ultima('erro').msg, /não é permitido/)
  assert.equal(host.ultima('sala').sala.membros[1].nome, 'BETO')
  conv.mandar({ t: 'nome', nome: 'Computador' }) // palavra inocente que contém outra
  assert.equal(host.ultima('sala').sala.membros[1].nome, 'Computador')
})
