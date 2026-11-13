// node --test src/lib/__tests__/relogioFundo.test.js
// O relógio de fundo: com a aba escondida os timers andam pelo tique do worker (o setTimeout da página
// fica segurado pelo navegador); visível, é o setTimeout de sempre e o worker fica parado.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarRelogio, TIQUE_MS } from '../relogioFundo.js'

// um navegador de mentira: relógio na mão, setTimeout que só dispara quando mandamos (o "segurado")
function montar({ escondida = false } = {}) {
  let t = 0
  const aba = { escondida }
  const nativos = new Map()
  let proximo = 1
  const tickers = []
  const r = criarRelogio({
    agora: () => t,
    escondida: () => aba.escondida,
    agendarNativo: (fn, ms) => {
      const h = proximo++
      nativos.set(h, { fn, quando: t + ms })
      return h
    },
    cancelarNativo: (h) => nativos.delete(h),
    criarTicker: (fn, ms) => {
      const k = { fn, ms, ligado: true }
      tickers.push(k)
      return () => (k.ligado = false)
    },
  })
  return {
    r,
    tickers,
    nativos,
    andar: (ms) => (t += ms),
    // o navegador solta os setTimeout vencidos
    soltarNativos() {
      for (const [h, n] of [...nativos])
        if (n.quando <= t) {
          nativos.delete(h)
          n.fn()
        }
    },
    esconder(v = true) {
      aba.escondida = v
      r.atualizar()
    },
  }
}

test('visível: agendar é o setTimeout de sempre, sem worker', () => {
  const m = montar()
  m.r.atualizar()
  assert.equal(m.r.ligado(), false)
  let n = 0
  m.r.agendar(() => n++, 100)
  m.andar(100)
  m.soltarNativos()
  assert.equal(n, 1)
  m.r.tique() // um tique a mais não chama de novo
  assert.equal(n, 1)
})

test('escondida: o worker liga com TIQUE_MS e o timer vence pelo tique, mesmo com o setTimeout segurado', () => {
  const m = montar()
  m.esconder()
  assert.equal(m.r.ligado(), true)
  assert.equal(m.tickers.at(-1).ms, TIQUE_MS)
  let n = 0
  m.r.agendar(() => n++, 500)
  m.andar(499)
  m.r.tique()
  assert.equal(n, 0, 'antes da hora não dispara')
  m.andar(1)
  m.r.tique()
  assert.equal(n, 1, 'na hora, pelo tique')
  assert.equal(m.nativos.size, 0, 'o setTimeout segurado foi cancelado')
  m.andar(60_000)
  m.soltarNativos() // o navegador soltaria o setTimeout um minuto depois: nada de chamar duas vezes
  m.r.tique()
  assert.equal(n, 1)
})

test('voltou a ficar visível: o worker para (e liga de novo na próxima vez)', () => {
  const m = montar()
  m.esconder()
  const primeiro = m.tickers.at(-1)
  m.esconder(false)
  assert.equal(primeiro.ligado, false)
  assert.equal(m.r.ligado(), false)
  m.esconder()
  assert.equal(m.r.ligado(), true)
  assert.equal(m.tickers.length, 2)
  m.esconder() // repetido: não abre outro
  assert.equal(m.tickers.length, 2)
})

test('dormir resolve pelo tique e cancelar o agendado não chama', async () => {
  const m = montar({ escondida: true })
  m.r.atualizar()
  const acordou = m.r.dormir(100)
  let n = 0
  const cancelar = m.r.agendar(() => n++, 50)
  cancelar()
  m.andar(150)
  m.r.tique()
  await acordou
  assert.equal(n, 0)
})

test('aoTique: quem ouve recebe o relógio a cada tique e para quando desliga', () => {
  const m = montar({ escondida: true })
  const vistos = []
  const desligar = m.r.aoTique((t) => vistos.push(t))
  m.andar(33)
  m.r.tique()
  m.andar(33)
  m.r.tique()
  desligar()
  m.r.tique()
  assert.deepEqual(vistos, [33, 66])
})

test('sem worker (criarTicker ausente): continua funcionando pelo setTimeout', async () => {
  const r = criarRelogio({ escondida: () => true })
  r.atualizar()
  assert.equal(r.ligado(), false)
  await r.dormir(1)
})
