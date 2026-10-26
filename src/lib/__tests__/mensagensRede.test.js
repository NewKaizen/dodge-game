// As mensagens de conexão e de fim do online (lib/lan/rede.js): cada uma diz o
// que aconteceu e o que fazer. WebSocket falso, sem rede.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { get } from 'svelte/store'

const sockets = []
class WsFalso {
  static OPEN = 1
  constructor(url) {
    this.url = url
    this.readyState = 1
    this.enviadas = []
    sockets.push(this)
  }
  send(m) {
    this.enviadas.push(JSON.parse(m))
  }
  close() {
    this.readyState = 3
  }
  // o servidor fala
  receber(m) {
    this.onmessage?.({ data: JSON.stringify(m) })
  }
  cair(code = 1006) {
    this.readyState = 3
    this.onclose?.({ code })
  }
}
globalThis.WebSocket = WsFalso
globalThis.location = { protocol: 'https:', host: 'dodge.onrender.com', search: '' }

const rede = await import('../lan/rede.js')
const s = () => get(rede.lan)
const bemvindo = (extra = {}) => ({ t: 'bemvindo', id: 'eu', online: true, enderecos: [], ice: [], conta: null, ...extra })
const ultimo = () => sockets.at(-1)

test('o site na internet sem servidor: diz que ele pode estar ligando, não manda rodar npm run lan', () => {
  assert.equal(rede.siteNaInternet(), true)
  globalThis.location.host = 'localhost:5180'
  assert.equal(rede.siteNaInternet(), false)
  globalThis.location.host = '192.168.0.10:5180'
  assert.equal(rede.siteNaInternet(), false)
  globalThis.location.host = 'dodge.onrender.com'

  rede.abrirLobby()
  ultimo().cair() // nunca abriu
  assert.equal(s().erro, rede.MSG_SEM_SERVIDOR)
  assert.match(s().erro, /ligando|internet/)
  assert.doesNotMatch(s().erro, /npm run lan/)
  assert.equal(s().fase, 'navegando')
})

test('servidor lotado (fechou com 1013) tem texto próprio', async () => {
  await new Promise((r) => setTimeout(r, 3100)) // o cliente tenta de novo sozinho
  ultimo().cair(1013)
  assert.equal(s().erro, rede.MSG_LOTADO)
})

test('conta que o servidor não confirmou: avisa que está como convidado e o que fazer', async () => {
  await new Promise((r) => setTimeout(r, 3100))
  const w = ultimo()
  w.onopen?.()
  w.receber(bemvindo({ contaInvalida: true }))
  assert.equal(s().erro, rede.MSG_CONTA_INVALIDA)
  assert.match(s().erro, /convidado/)
  assert.match(s().erro, /entre de novo/)
  // depois, com o lobby aberto, o servidor responde à troca de conta
  w.receber({ t: 'conta', conta: null })
  w.receber({ t: 'conta', conta: null, contaInvalida: true })
  assert.equal(s().erro, rede.MSG_CONTA_INVALIDA)
})

test('a conexão cai na sala e na fila: ninguém fica preso e o aviso fica depois de reconectar', async () => {
  const w = ultimo()
  w.receber(bemvindo())
  assert.equal(s().erro, '')
  // na fila
  rede.entrarFila()
  w.receber({ t: 'fila', estado: 'procurando', esperaMs: 0 })
  assert.equal(s().fila.estado, 'procurando')
  w.cair()
  assert.equal(s().fila, null, 'saiu da fila')
  assert.match(s().filaAviso, /saiu da fila.*procurar de novo/)
  assert.match(s().erro, /reconectando/)
  // reconecta, entra numa sala e a conexão cai de novo
  await new Promise((r) => setTimeout(r, 1600))
  const w2 = ultimo()
  assert.notEqual(w2, w)
  w2.onopen?.()
  w2.receber(bemvindo())
  assert.equal(s().erro, '')
  const sala = { id: 'sala1', codigo: 'ABCD', nome: 'S', modo: 'pvp', emPartida: false, casual: false, max: 2, membros: [{ id: 'eu', nome: 'EU', papel: 'host', pronto: true }] }
  w2.receber({ t: 'sala', sala })
  assert.equal(s().fase, 'sala')
  w2.cair()
  assert.equal(s().fase, 'navegando')
  assert.equal(s().sala, null)
  assert.match(s().filaAviso, /saiu da sala/)
  assert.match(s().filaAviso, /entre de novo/)
})

test('o oponente sai no meio da partida de amigos: aviso claro e a sala continua', async () => {
  await new Promise((r) => setTimeout(r, 1600))
  const w = ultimo()
  w.onopen?.()
  w.receber(bemvindo())
  const membros = [
    { id: 'eu', nome: 'EU', papel: 'host', pronto: true },
    { id: 'amigo', nome: 'ANA', papel: 'convidado', pronto: true },
  ]
  const sala = { id: 'sala2', codigo: 'WXYZ', nome: 'S', modo: 'pvp', emPartida: true, casual: false, max: 2, membros }
  w.receber({ t: 'sala', sala })
  w.receber({ t: 'sala', sala: { ...sala, membros: [membros[0]] } })
  assert.equal(s().fase, 'sala')
  assert.match(s().erro, /ANA saiu no meio da partida/)
  assert.match(s().erro, /sala continua aberta/)
  // o host fecha a sala: motivo claro vindo do servidor
  w.receber({ t: 'fechada', motivo: 'o host perdeu a conexão: a sala foi fechada' })
  assert.equal(s().erro, 'o host perdeu a conexão: a sala foi fechada')
  assert.equal(s().fase, 'navegando')
  rede.fecharLobby() // sem timers de reconexão pendurados
})
