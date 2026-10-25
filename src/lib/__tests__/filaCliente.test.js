// O lado do navegador do JOGAR RÁPIDO (lib/lan/rede.js) falando com o lobby de
// verdade (server/lan.js) por um WebSocket falso, sem rede.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { get } from 'svelte/store'
import { criarLobby, PROTOCOLO } from '../../../server/lan.js'

const lobby = criarLobby({ locais: () => [{ ip: '192.168.0.10', mascara: '255.255.255.0' }], online: true })
const esperar = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r))
}

class WsFalso {
  static OPEN = 1
  constructor() {
    this.readyState = 1
    this.bufferedAmount = 0
    this.c = lobby.conectar({ readyState: 1, bufferedAmount: 0, send: (m) => setImmediate(() => this.onmessage?.({ data: m })) }, '10.0.0.3')
    setImmediate(() => this.onopen?.())
  }
  send(m) {
    lobby.receber(this.c, m)
  }
  close() {
    this.readyState = 3
    lobby.desconectar(this.c)
    setImmediate(() => this.onclose?.())
  }
}
globalThis.WebSocket = WsFalso
globalThis.location = { protocol: 'http:', host: 'localhost:5180', search: '' }

const rede = await import('../lan/rede.js')
const s = () => get(rede.lan)

// o outro jogador, direto no lobby
function outro(nome) {
  const recebidas = []
  const c = lobby.conectar({ readyState: 1, bufferedAmount: 0, send: (m) => recebidas.push(JSON.parse(m)) }, '10.0.0.4')
  const mandar = (m) => lobby.receber(c, JSON.stringify(m))
  mandar({ t: 'ola', protocolo: PROTOCOLO, nome })
  return { c, mandar, ultima: (t) => recebidas.filter((m) => m.t === t).at(-1) }
}

test('fila no cliente: procurar, achar, aceitar, sala casual, revanche e o oponente saindo', async () => {
  rede.abrirLobby()
  await esperar()
  assert.equal(s().fase, 'navegando')

  rede.entrarFila()
  assert.equal(s().fila.estado, 'procurando')
  await esperar()
  assert.equal(s().fila.convidado, true)

  // o oponente recusa: volta a procurar, com o aviso
  const beto = outro('BETO')
  beto.mandar({ t: 'fila', acao: 'entrar' })
  await esperar()
  assert.equal(s().fila.estado, 'pareado')
  assert.equal(s().fila.oponente.nome, 'BETO')
  beto.mandar({ t: 'confirmar', id: beto.ultima('pareado').id, aceitar: false })
  await esperar()
  assert.equal(s().fila.estado, 'procurando')
  assert.match(s().filaAviso, /recusou/)

  // agora aceitam os dois: sala casual, eu (primeiro a aceitar) sou o host
  const caio = outro('CAIO')
  caio.mandar({ t: 'fila', acao: 'entrar' })
  await esperar()
  rede.responderPartida(true)
  assert.equal(s().fila.eu, true)
  caio.mandar({ t: 'confirmar', id: caio.ultima('pareado').id })
  await esperar()
  assert.equal(s().fase, 'sala')
  assert.equal(s().papel, 'host')
  assert.equal(s().sala.casual, true)
  assert.equal(s().fila, null)
  assert.equal(rede.salaCasual(), true)
  assert.equal(rede.consumirCasual(), s().sala.id)
  assert.equal(rede.consumirCasual(), null, 'começa uma vez só')

  // revanche
  rede.iniciarPartida()
  rede.pedirRevanche(true)
  await esperar()
  assert.deepEqual([s().revanche.estado, s().revanche.minha], ['pedida', true])
  caio.mandar({ t: 'revanche', aceitar: true })
  await esperar()
  assert.equal(s().revanche.estado, 'aceita')

  // o oponente sai: a sala fecha e o aviso fica
  caio.mandar({ t: 'sair' })
  await esperar()
  assert.equal(s().fase, 'navegando')
  assert.equal(s().erro, 'o oponente saiu da partida')
  assert.equal(s().ultimaCasual, true)
  assert.equal(s().revanche, null)

  // jogar novamente e desistir; sair da tela tira da fila
  rede.entrarFila()
  await esperar()
  rede.sairFila()
  await esperar()
  assert.equal(s().fila, null)
  rede.entrarFila()
  await esperar()
  rede.fecharLobby()
  await esperar()
  assert.equal(lobby.fila.tamanho() + lobby.fila.pares(), 0)
})
