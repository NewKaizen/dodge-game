import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarCanal, REENVIO_MS } from '../lan/canal.js'
import { criarSincCena } from '../lan/sincCena.js'

// A estrela pelo host (Fase 5A): o canal do host tem uma sessão por convidado; cada
// convidado só fala com o host. A rede aqui é falsa: cada mensagem tem destino e
// fica num fio até alguém entregar (ou perder).

function relogio() {
  let t = 0
  const timers = []
  return {
    agora: () => t,
    agendar(fn, ms) {
      timers.push({ fn, quando: t + ms })
      return { unref() {} }
    },
    andar(ms) {
      t += ms
      for (;;) {
        timers.sort((a, b) => a.quando - b.quando)
        if (!timers.length || timers[0].quando > t) break
        timers.shift().fn()
      }
    },
  }
}

// host H e convidados (ids), com o fio de cada sentido
function estrela(convidados = ['A', 'B', 'C']) {
  const r = relogio()
  const fios = [] // { de, para, msg, reserva }
  const nos = {}
  const no = (id, destinos) => {
    const mandar = (reserva) => (msg, para) => {
      // um convidado sempre manda para o host (é o que o servidor faz: server/lan.js "para")
      const alvo = id === 'H' ? para : 'H'
      fios.push({ de: id, para: alvo, msg, reserva })
    }
    nos[id] = criarCanal({ enviarBruto: mandar(false), enviarReserva: mandar(true), meuId: () => id, agora: r.agora, agendar: r.agendar, destinos })
  }
  let membros = ['H', ...convidados]
  no('H', () => membros.filter((x) => x !== 'H'))
  for (const c of convidados) no(c, () => (membros.includes(c) ? ['H'] : []))
  // entrega o que está no fio (menos o que `perder` disser)
  const entregar = ({ perder = () => false } = {}) => {
    while (fios.length) {
      const f = fios.shift()
      if (perder(f)) continue
      nos[f.para]?.entregar(f.msg)
    }
  }
  return { r, fios, nos, entregar, sair: (id) => (membros = membros.filter((x) => x !== id)) }
}

test('host manda para todos: cada convidado recebe uma vez, numerada na sessão dele', async () => {
  const { nos, fios, entregar } = estrela()
  nos.H.enviar('cena', null, { chave: 'X' })
  assert.deepEqual(
    fios.map((f) => f.para),
    ['A', 'B', 'C'],
  )
  const sessoes = new Set(fios.map((f) => f.msg.e))
  assert.equal(sessoes.size, 3, 'uma sessão por convidado')
  assert.ok(fios.every((f) => f.msg.s === 0))
  entregar()
  for (const c of ['A', 'B', 'C']) assert.deepEqual(await nos[c].receber('cena', null), { chave: 'X' })
  assert.equal(nos.H.estadoDebug().semRecibo, 0, 'os três recibos chegaram')
})

test('mandar só para um; o que ele manda chega ao host com quem mandou', async () => {
  const { nos, fios, entregar } = estrela()
  nos.H.enviarPara('B', 'retomada', 1, { r: 3 })
  assert.deepEqual(
    fios.map((f) => f.para),
    ['B'],
  )
  entregar()
  assert.deepEqual(await nos.B.receber('retomada', 1), { r: 3 })
  // os convidados mandam jogadas: o host separa por quem mandou
  nos.C.enviar('jogada', 1, 'c9')
  nos.A.enviar('jogada', 1, 'a2')
  const vistos = []
  entregar()
  assert.equal(await nos.H.receber('jogada', 1, { de: 'A' }), 'a2')
  assert.equal(await nos.H.receber('jogada', 1, { de: 'C' }), 'c9')
  nos.H.ao('cursor', (d, chave, de) => vistos.push([de, d]))
  nos.A.enviarRapido('cursor', 1)
  nos.B.enviarRapido('cursor', 2)
  entregar()
  assert.deepEqual(vistos, [['A', 1], ['B', 2]])
})

test('isolamento: o que um convidado manda nunca chega a outro convidado', () => {
  const { nos, fios, entregar } = estrela()
  const chegou = { A: [], B: [], C: [] }
  for (const c of ['A', 'B', 'C']) nos[c].ao('x', (d, _, de) => chegou[c].push(de))
  nos.A.enviar('x', null, 1)
  nos.A.enviarRapido('x', 2)
  // mesmo pedindo um destino que não é o host, o canal do convidado não tem outro parceiro
  nos.A.enviarPara('B', 'x', null, 3)
  assert.ok(fios.every((f) => f.de === 'A' && f.para === 'H'))
  entregar()
  assert.deepEqual(chegou, { A: [], B: [], C: [] })
  // o host repassa (é o único caminho entre convidados)
  nos.H.ao('x', (d, _, de) => de === 'A' && nos.H.enviarRapidoPara('B', 'x', d))
  nos.A.enviarRapido('x', 4)
  entregar()
  assert.deepEqual(chegou.B, ['H'])
})

test('um convidado lento (perdendo tudo): os outros seguem; o dele vai pelo reenvio', async () => {
  const { r, nos, fios, entregar } = estrela()
  nos.H.enviar('cena', null, 'n1')
  entregar({ perder: (f) => f.para === 'C' || f.de === 'C' })
  assert.equal(nos.H.estadoDebug().porParceiro.C.semRecibo, 1)
  assert.equal(nos.H.estadoDebug().porParceiro.A.semRecibo, 0)
  // depois do REENVIO_MS a de C sai de novo pelo caminho garantido (só para C)
  r.andar(REENVIO_MS)
  assert.deepEqual(
    fios.map((f) => [f.para, f.reserva]),
    [['C', true]],
  )
  entregar()
  assert.equal(await nos.C.receber('cena', null), 'n1')
  assert.equal(nos.H.estadoDebug().semRecibo, 0)
})

test('troca de cena com um convidado lento: o host sabe quem falta', async () => {
  const r = relogio()
  const sinc = criarSincCena({ agora: r.agora })
  const n = sinc.nova('PvpEscolha', ['A', 'B', 'C'])
  const espera = sinc.esperar({ timeoutMs: 5000, agendar: r.agendar })
  sinc.ok('A', n)
  sinc.ok('B', n)
  sinc.ok('B', n - 1) // de uma cena velha: não conta
  r.andar(1000)
  assert.deepEqual(sinc.estado().faltam, ['C'])
  assert.deepEqual(sinc.atrasados(500), ['C'])
  assert.deepEqual(sinc.atrasados(5000), [])
  r.andar(1500)
  sinc.ok('C', n)
  assert.deepEqual(await espera, { ok: true, faltam: [] })
  // o lento não chega: o tempo acaba e diz quem faltou
  const n2 = sinc.nova('PvpVoto', ['A', 'B', 'C'])
  const espera2 = sinc.esperar({ timeoutMs: 3000, agendar: r.agendar })
  sinc.ok('A', n2)
  sinc.ok('B', n2)
  r.andar(3000)
  assert.deepEqual(await espera2, { ok: false, faltam: ['C'] })
  // ele sai da sala: não é mais esperado
  sinc.saiu('C')
  assert.equal(sinc.todos(), true)
  // cena nova enquanto alguém esperava a velha: a espera velha solta
  sinc.nova('X', ['A'])
  const velha = sinc.esperar({})
  sinc.nova('Y', ['A'])
  assert.equal((await velha).ok, false)
})

test('um convidado cai numa sala de 4: só a sessão dele recomeça; os outros nem percebem', async () => {
  const { nos, entregar, fios } = estrela()
  nos.H.enviar('inicio', 1, 'r1')
  entregar()
  for (const c of ['A', 'B', 'C']) await nos[c].receber('inicio', 1)
  const sessaoA = nos.H.estadoDebug().porParceiro.A
  // B cai: o que estava no caminho de/para ele se perde
  nos.B.enviar('jogada', 1, 'velha')
  nos.H.enviar('inicio', 2, 'r2')
  entregar({ perder: (f) => f.de === 'B' || f.para === 'B' })
  // B volta (retomada): o host descarta a sessão velha dele e abre outra só com ele
  nos.H.descartar('B')
  nos.H.reiniciar('B')
  nos.B.reiniciar()
  nos.H.enviarPara('B', 'cena', null, { retomada: true })
  assert.deepEqual(
    fios.map((f) => [f.para, f.msg.s]),
    [['B', 0]],
  )
  entregar()
  assert.deepEqual(await nos.B.receber('cena', null), { retomada: true })
  // a jogada velha de B (sessão que já passou) não entra mais
  nos.B.enviar('jogada', 2, 'nova')
  entregar()
  assert.equal(await nos.H.receber('jogada', 2, { de: 'B' }), 'nova')
  // A e C continuam na mesma sessão, com a numeração seguindo
  assert.equal(nos.H.estadoDebug().porParceiro.A.seq, sessaoA.seq + 1)
  assert.equal(await nos.A.receber('inicio', 2), 'r2')
})

test('quem sai da sala deixa de receber (a sessão dele acaba)', () => {
  const s = estrela()
  s.sair('C')
  s.nos.H.enviar('x', null, 1)
  assert.deepEqual(
    s.fios.map((f) => f.para),
    ['A', 'B'],
  )
})
