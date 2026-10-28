import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarGerenciadorSerial } from '../serial.js'

// Web Serial falso: a porta tem readable/writable de verdade (bytes), sem hardware
function criarPortaFalsa(info = { usbVendorId: 0x2341, usbProductId: 0x43 }) {
  let fechaLeitura
  const enviado = []
  const dec = new TextDecoder()
  const enc = new TextEncoder()
  const porta = {
    enviado,
    getInfo: () => info,
    async open() {
      this.readable = new ReadableStream({ start: (c) => (fechaLeitura = c), cancel() {} })
      this.writable = new WritableStream({ write: (b) => void enviado.push(dec.decode(b)) })
    },
    async close() {},
    chega: (texto) => fechaLeitura.enqueue(enc.encode(texto)),
    puxarCabo: () => fechaLeitura.close(),
  }
  return porta
}

function criarNavegadorFalso(portas = []) {
  const ouvintes = new Set()
  const nav = {
    addEventListener: (_, fn) => ouvintes.add(fn),
    removeEventListener: (_, fn) => ouvintes.delete(fn),
    plugar: (porta) => ouvintes.forEach((fn) => fn({ target: porta })), // evento 'connect'
  }
  nav.getPorts = async () => portas
  nav.requestPort = async () => portas.at(-1)
  return { serial: nav }
}

const esperar = (ms = 20) => new Promise((r) => setTimeout(r, ms))
const linhasDe = (p) => p.enviado.join('').split('\n').filter(Boolean)

function montar(portas, extra = {}) {
  const recebidas = []
  const salvos = []
  const g = criarGerenciadorSerial({
    navegador: criarNavegadorFalso(portas),
    aoLinha: (l) => recebidas.push(l),
    carregar: () => extra.salvo ?? null,
    salvar: (m) => salvos.push(m),
    agendar: () => {},
  })
  return { g, recebidas, salvos }
}

test('vigiar abre todas as portas autorizadas, na ordem: cada uma vira um jogador', async () => {
  const a = criarPortaFalsa(), b = criarPortaFalsa()
  const { g, recebidas } = montar([a, b])
  g.vigiar()
  await esperar()
  assert.equal(g.quantas(), 2)
  a.chega('JOY 1 10 20\nBTN 1 A\n')
  b.chega('JOY 1 -5 -6\r\nBTN 1 B\r\n')
  await esperar()
  assert.deepEqual(recebidas.sort(), ['BTN 1 A', 'BTN 2 B', 'JOY 1 10 20', 'JOY 2 -5 -6'].sort())
})

test('linha parcial é remontada e a troca vale na hora', async () => {
  const a = criarPortaFalsa(), b = criarPortaFalsa()
  const { g, recebidas } = montar([a, b])
  g.vigiar()
  await esperar()
  a.chega('JOY 1 1')
  a.chega('0 20\n')
  await esperar()
  assert.deepEqual(recebidas, ['JOY 1 10 20'])
  g.trocarJogadores()
  a.chega('BTN 1 A\n')
  await esperar()
  assert.equal(recebidas.at(-1), 'BTN 2 A')
})

test('saída: estado vai às duas portas; VIDA/BUZZER só à do jogador, como "1 ..."', async () => {
  const a = criarPortaFalsa(), b = criarPortaFalsa()
  const { g } = montar([a, b])
  g.vigiar()
  await esperar()
  await g.enviar('PING')
  await g.enviar('GAME')
  await g.enviar('2 VIDA 150 200')
  await g.enviar('1 BUZZER')
  await g.enviar('2 BUZZER')
  await esperar()
  assert.deepEqual(linhasDe(a), ['PING', 'GAME', '1 BUZZER'])
  assert.deepEqual(linhasDe(b), ['PING', 'GAME', '1 VIDA 150 200', '1 BUZZER'])
  assert.ok(![...linhasDe(a), ...linhasDe(b)].some((l) => /JOGADOR/.test(l)), 'o firmware não recebe JOGADOR')
})

test('depois de trocar, a vida de cada jogador vai para a outra porta', async () => {
  const a = criarPortaFalsa(), b = criarPortaFalsa()
  const { g } = montar([a, b])
  g.vigiar()
  await esperar()
  g.trocarJogadores()
  await g.enviar('1 VIDA 10 100')
  await esperar()
  assert.deepEqual(linhasDe(a), [])
  assert.deepEqual(linhasDe(b), ['1 VIDA 10 100'])
})

test('uma porta só (relé): linhas 1 e 2 vêm como estão e "2 VIDA" segue pela mesma porta', async () => {
  const a = criarPortaFalsa()
  const { g, recebidas } = montar([a])
  g.vigiar()
  await esperar()
  a.chega('JOY 2 7 8\nBTN 1 C\n')
  await g.enviar('2 VIDA 5 10')
  await g.enviar('1 VIDA 9 10')
  await esperar()
  assert.deepEqual(recebidas, ['JOY 2 7 8', 'BTN 1 C'])
  assert.deepEqual(linhasDe(a), ['2 VIDA 5 10', '1 VIDA 9 10'])
})

test('cabo puxado fecha só aquela fonte; ao plugar de novo volta com o mesmo jogador', async () => {
  const a = criarPortaFalsa(), b = criarPortaFalsa()
  const nav = criarNavegadorFalso([a, b])
  const recebidas = []
  const g = criarGerenciadorSerial({ navegador: nav, aoLinha: (l) => recebidas.push(l), agendar: () => {} })
  g.vigiar()
  await esperar()
  b.puxarCabo()
  await esperar()
  assert.equal(g.quantas(), 1)
  await g.enviar('2 VIDA 1 2')
  assert.deepEqual(linhasDe(b), [])
  nav.serial.plugar(b)
  await esperar()
  assert.equal(g.quantas(), 2)
  b.chega('BTN 1 A\n')
  await esperar()
  assert.equal(recebidas.at(-1), 'BTN 2 A')
})

test('conectar soma mais uma porta a cada chamada e a ordem é salva', async () => {
  const a = criarPortaFalsa(), b = criarPortaFalsa()
  const portas = []
  const nav = criarNavegadorFalso(portas)
  const salvos = []
  const g = criarGerenciadorSerial({ navegador: nav, salvar: (m) => salvos.push(m), agendar: () => {} })
  portas.push(a)
  await g.conectar()
  portas.push(b)
  await g.conectar()
  assert.equal(g.quantas(), 2)
  assert.deepEqual(salvos.at(-1), { '2341:43#0': 1, '2341:43#1': 2 })
  assert.deepEqual(g.lista().map((x) => x.jogador), [1, 2])
})

test('desconectar({ esquecer }) fecha tudo e vigiar não reabre sozinho', async () => {
  const a = criarPortaFalsa(), b = criarPortaFalsa()
  const nav = criarNavegadorFalso([a, b])
  const g = criarGerenciadorSerial({ navegador: nav, agendar: () => {} })
  g.vigiar()
  await esperar()
  await g.desconectar({ esquecer: true })
  await esperar()
  assert.equal(g.quantas(), 0)
  nav.serial.plugar(a)
  await esperar()
  assert.equal(g.quantas(), 0)
})
