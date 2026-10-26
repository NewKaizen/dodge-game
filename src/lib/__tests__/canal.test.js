import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarCanal } from '../lan/canal.js'

// dois canais ligados: o que um manda, o outro recebe (com controle da entrega)
function par() {
  const fioAB = []
  const fioBA = []
  const a = criarCanal({ enviarBruto: (m) => fioAB.push(m), meuId: () => 'A' })
  const b = criarCanal({ enviarBruto: (m) => fioBA.push(m), meuId: () => 'B' })
  const entregarTudo = () => {
    while (fioAB.length) b.entregar(fioAB.shift())
    while (fioBA.length) a.entregar(fioBA.shift())
  }
  return { a, b, fioAB, fioBA, entregarTudo }
}

test('mensagem que chega antes de ser pedida fica no correio', async () => {
  const { a, b, entregarTudo } = par()
  a.enviar('jogada', 3, { carta: 'kris-espadas-9' })
  entregarTudo()
  assert.deepEqual(await b.receber('jogada', 3), { carta: 'kris-espadas-9' })
})

test('pedido feito antes da mensagem chegar espera por ela', async () => {
  const { a, b, entregarTudo } = par()
  const promessa = b.receber('jogada', 1)
  a.enviar('jogada', 2, 'outra rodada')
  a.enviar('jogada', 1, 'esta')
  entregarTudo()
  assert.equal(await promessa, 'esta')
  assert.equal(await b.receber('jogada', 2), 'outra rodada')
})

test('confiáveis saem em ordem mesmo chegando fora de ordem (WebRTC x servidor)', () => {
  const { a, b, fioAB } = par()
  const vistos = []
  b.ao('dano', (d) => vistos.push(d))
  a.enviar('dano', null, 1)
  a.enviar('dano', null, 2)
  a.enviar('dano', null, 3)
  const [m1, m2, m3] = fioAB.splice(0)
  b.entregar(m3)
  b.entregar(m1)
  assert.deepEqual(vistos, [1])
  b.entregar(m2)
  b.entregar(m2) // repetida: ignora
  assert.deepEqual(vistos, [1, 2, 3])
})

test('rápidas: a mais velha que a última entregue é descartada', () => {
  let t = 0
  const fio = []
  const a = criarCanal({ enviarBruto: (m) => fio.push(m), meuId: () => 'A', agora: () => t })
  const b = criarCanal({ enviarBruto: () => {} })
  const pos = []
  b.ao('pos', (d) => pos.push(d))
  t = 1
  a.enviarRapido('pos', { x: 1 })
  t = 2
  a.enviarRapido('pos', { x: 2 })
  const [velha, nova] = fio.splice(0)
  b.entregar(nova)
  b.entregar(velha)
  assert.deepEqual(pos, [{ x: 2 }])
})

test('timeout do receber resolve com null', async () => {
  const b = criarCanal({ enviarBruto: () => {}, agendar: (fn) => fn() })
  assert.equal(await b.receber('nada', 1, { timeoutMs: 10 }), null)
})

test('ignora o que não é do canal e esquece o parceiro antigo', () => {
  const { a, b, fioAB } = par()
  assert.equal(b.entregar({ tipo: 'joy', x: 1 }), false)
  const vistos = []
  b.ao('x', (d) => vistos.push(d))
  a.enviar('x', null, 'antes')
  b.entregar(fioAB.shift())
  b.esquecer('A')
  // o parceiro reconectou e começou a contar do zero
  const novo = criarCanal({ enviarBruto: (m) => b.entregar(m), meuId: () => 'A' })
  novo.enviar('x', null, 'depois')
  assert.deepEqual(vistos, ['antes', 'depois'])
})

test('atraso de teste mantém a ordem das confiáveis', () => {
  const agendados = []
  const fio = []
  const a = criarCanal({ enviarBruto: (m) => fio.push(m), meuId: () => 'A' })
  const b = criarCanal({ enviarBruto: () => {}, agendar: (fn, ms) => agendados.push({ fn, ms }) })
  b.testar({ atrasoMs: 100, variacaoMs: 80 })
  const vistos = []
  b.ao('n', (d) => vistos.push(d))
  for (let i = 0; i < 5; i++) a.enviar('n', null, i)
  fio.forEach((m) => b.entregar(m))
  agendados.sort((p, q) => q.ms - p.ms).forEach(({ fn }) => fn()) // a pior ordem possível
  assert.deepEqual(vistos, [0, 1, 2, 3, 4])
})

test('parceiro novo: reiniciar() começa outra sessão e o outro não fica esperando a 0', () => {
  // o host já mandou mensagens para outro convidado (ou para este, antes de ele sair e voltar)
  const fio = []
  const host = criarCanal({ enviarBruto: (m) => fio.push(m), meuId: () => 'H' })
  for (let i = 0; i < 5; i++) host.enviar('personagem', null, i)
  const conv = criarCanal({ enviarBruto: () => {}, meuId: () => 'C' })
  fio.splice(0, 3).forEach((m) => conv.entregar(m)) // o convidado viu as 3 primeiras e saiu
  const cenas = []
  conv.ao('cena', (d) => cenas.push(d))
  const velhas = fio.splice(0) // ainda no caminho
  host.reiniciar() // o convidado voltou
  host.enviar('cena', null, 'PvpEscolha')
  conv.entregar(fio.shift())
  assert.deepEqual(cenas, ['PvpEscolha'])
  // as da sessão velha que chegam atrasadas não valem mais
  const vistos = []
  conv.ao('personagem', (d) => vistos.push(d))
  velhas.forEach((m) => conv.entregar(m))
  assert.deepEqual(vistos, [])
  host.enviar('cena', null, 'PvpVoto')
  conv.entregar(fio.shift())
  assert.deepEqual(cenas, ['PvpEscolha', 'PvpVoto'])
})

test('confiável perdida no caminho é mandada de novo até chegar o recibo', () => {
  let t = 0
  const timers = []
  const rodarTimers = () => timers.splice(0).forEach((fn) => fn())
  const fioAB = []
  const fioBA = []
  const a = criarCanal({ enviarBruto: (m) => fioAB.push(m), meuId: () => 'A', agora: () => t, agendar: (fn) => timers.push(fn) })
  const b = criarCanal({ enviarBruto: (m) => fioBA.push(m), meuId: () => 'B', agora: () => t })
  const cenas = []
  b.ao('cena', (d) => cenas.push(d))
  a.enviar('cena', null, 'PvpArena')
  fioAB.splice(0) // perdeu (o WebRTC fechou no meio)
  t = 500
  rodarTimers()
  assert.equal(fioAB.length, 0, 'ainda não deu o tempo do reenvio')
  t = 1000
  rodarTimers()
  assert.equal(fioAB.length, 1)
  b.entregar(fioAB.shift())
  assert.deepEqual(cenas, ['PvpArena'])
  // o recibo chega: não manda mais
  fioBA.splice(0).forEach((m) => a.entregar(m))
  assert.equal(a.estadoDebug().semRecibo, 0)
  t = 5000
  rodarTimers()
  assert.equal(fioAB.length, 0)
  assert.equal(timers.length, 0, 'sem nada pendente o vigia para')
})

test('reenvio repetido não entrega duas vezes e ganha recibo de novo', () => {
  const { a, b, fioAB, fioBA } = par()
  const vistos = []
  b.ao('dano', (d) => vistos.push(d))
  a.enviar('dano', null, 7)
  const m = fioAB.shift()
  b.entregar(m)
  fioBA.splice(0) // o recibo se perdeu
  b.entregar(m) // o reenvio
  assert.deepEqual(vistos, [7])
  assert.equal(fioBA.length, 1)
  a.entregar(fioBA.shift())
  assert.equal(a.estadoDebug().semRecibo, 0)
})
