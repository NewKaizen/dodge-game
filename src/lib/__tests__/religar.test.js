import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarReligar, esperaDaTentativa, ESPERAS_MS, RETOMADA_MS, guardarChave, lerChave, apagarChave, CHAVE_RETOMADA } from '../lan/religar.js'
import { RETOMADA_MS as RETOMADA_SERVIDOR } from '../../../server/lan.js'

function relogioFalso() {
  let t = 0
  const timers = new Set()
  return {
    agora: () => t,
    agendar(fn, ms) {
      const x = { fn, quando: t + ms }
      timers.add(x)
      return () => timers.delete(x)
    },
    andar(ms) {
      const fim = t + ms
      for (;;) {
        const prox = [...timers].sort((a, b) => a.quando - b.quando)[0]
        if (!prox || prox.quando > fim) break
        t = prox.quando
        timers.delete(prox)
        prox.fn()
      }
      t = fim
    },
    ativos: () => timers.size,
  }
}

test('a janela do cliente é a mesma do servidor', () => {
  assert.equal(RETOMADA_MS, RETOMADA_SERVIDOR)
})

test('espera crescente entre as tentativas (a última se repete)', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 9].map(esperaDaTentativa), [...ESPERAS_MS, ESPERAS_MS.at(-1), ESPERAS_MS.at(-1)])
  for (let i = 1; i < ESPERAS_MS.length; i++) assert.ok(ESPERAS_MS[i] >= ESPERAS_MS[i - 1])
})

test('tenta várias vezes dentro da janela e desiste uma vez só no fim', () => {
  const r = relogioFalso()
  const tentativas = []
  let desistiu = 0
  // cada tentativa falha 100 ms depois (o servidor não responde / recusa)
  const religar = criarReligar({
    agora: r.agora,
    agendar: r.agendar,
    tentar: (n) => {
      tentativas.push([n, r.agora()])
      r.agendar(() => religar.falhou(), 100)
    },
    desistir: () => desistiu++,
  })
  religar.comecar()
  assert.equal(religar.ate(), RETOMADA_MS)
  r.andar(RETOMADA_MS + 1000)
  assert.ok(tentativas.length >= 7, `tentou ${tentativas.length} vezes`)
  assert.deepEqual(
    tentativas.map(([n]) => n),
    tentativas.map((_, i) => i + 1),
  )
  assert.ok(tentativas.every(([, t]) => t < RETOMADA_MS), 'nenhuma tentativa depois da janela')
  assert.equal(tentativas[0][1], ESPERAS_MS[0])
  assert.equal(desistiu, 1)
  assert.equal(religar.ativo(), false)
  r.andar(60_000)
  religar.falhou()
  assert.equal(desistiu, 1)
  assert.equal(r.ativos(), 0)
})

test('voltou: para de tentar e não desiste', () => {
  const r = relogioFalso()
  let n = 0
  let desistiu = false
  const religar = criarReligar({ agora: r.agora, agendar: r.agendar, tentar: () => n++, desistir: () => (desistiu = true) })
  religar.comecar()
  r.andar(ESPERAS_MS[0])
  assert.equal(n, 1)
  religar.conseguiu()
  r.andar(RETOMADA_MS * 2)
  assert.equal(n, 1)
  assert.equal(desistiu, false)
  assert.equal(r.ativos(), 0)
})

test('a tentativa que fica pendurada (sem falhar nem conseguir) também desiste no fim', () => {
  const r = relogioFalso()
  let desistiu = 0
  const religar = criarReligar({ agora: r.agora, agendar: r.agendar, tentar: () => {}, desistir: () => desistiu++, janelaMs: 1000 })
  religar.comecar()
  r.andar(ESPERAS_MS[0])
  religar.falhou() // a próxima espera (750) ainda cabe
  r.andar(800)
  religar.falhou() // a próxima já não cabe: desiste no fim da janela
  r.andar(1000)
  assert.equal(desistiu, 1)
})

test('comecar duas vezes não abre duas janelas; parar não desiste', () => {
  const r = relogioFalso()
  let desistiu = 0
  const religar = criarReligar({ agora: r.agora, agendar: r.agendar, tentar: () => {}, desistir: () => desistiu++ })
  religar.comecar()
  r.andar(1000)
  religar.comecar()
  assert.equal(religar.ate(), RETOMADA_MS)
  religar.parar()
  r.andar(RETOMADA_MS * 2)
  assert.equal(desistiu, 0)
})

test('chave de retomada: guarda, lê e apaga (e não quebra sem armazenamento)', () => {
  const mapa = new Map()
  const arm = { setItem: (k, v) => mapa.set(k, v), getItem: (k) => mapa.get(k) ?? null, removeItem: (k) => mapa.delete(k) }
  assert.equal(lerChave(arm), null)
  guardarChave('abc', arm)
  assert.equal(mapa.get(CHAVE_RETOMADA), 'abc')
  assert.equal(lerChave(arm), 'abc')
  guardarChave('', arm)
  assert.equal(lerChave(arm), 'abc', 'chave vazia não troca')
  apagarChave(arm)
  assert.equal(lerChave(arm), null)
  const quebrado = {
    setItem() {
      throw new Error('bloqueado')
    },
    getItem() {
      throw new Error('bloqueado')
    },
    removeItem() {
      throw new Error('bloqueado')
    },
  }
  guardarChave('x', quebrado)
  assert.equal(lerChave(quebrado), null)
  apagarChave(quebrado)
  assert.equal(lerChave(null), null)
})
