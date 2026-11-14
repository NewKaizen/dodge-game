// node --test src/game/__tests__/segundoPlano.test.js
// Aba em segundo plano e pausa online (docs/rede-pvp.md): o motor que dá o passo do jogo com a aba
// escondida, a trava da entrada do menu de pausa online e o AUSENTE/PAUSADO que os outros veem.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarMotor, LIMIAR_MS, MAX_DELTA_MS } from '../motorFundo.js'
import { TIQUE_MS, criarRelogio } from '../../lib/relogioFundo.js'
import { travarEntrada, podeLer, entradaTravada } from '../travaEntrada.js'
import { marcaDeAusencia, assinaturaDeAusencia, outroAusente, ladoDe } from '../ausencia.js'

// ---------- o motor de fundo ----------

test('motor: com o requestAnimationFrame rodando o tique não dá passo nenhum (nunca dois no mesmo quadro)', () => {
  const passos = []
  const m = criarMotor({ passo: (t, d) => passos.push([t, d]) })
  for (let t = 0; t < 1000; t += 16) {
    m.marcar(t) // o rAF deu o passo
    m.tique(t + 5) // e o tique chega logo depois
  }
  assert.deepEqual(passos, [])
})

test('motor: o rAF parou (aba escondida): cada tique é um passo, com o tempo de verdade como delta', () => {
  const passos = []
  const m = criarMotor({ passo: (t, d) => passos.push([t, d]) })
  m.marcar(1000) // o último quadro antes de esconder
  assert.equal(m.tique(1000 + LIMIAR_MS - 1), false, 'pouco depois: ainda pode ser o rAF')
  for (let k = 1; k <= 30; k++) m.tique(1000 + LIMIAR_MS + k * TIQUE_MS)
  assert.equal(passos.length, 30)
  assert.equal(passos[0][1], LIMIAR_MS + TIQUE_MS > MAX_DELTA_MS ? MAX_DELTA_MS : LIMIAR_MS + TIQUE_MS)
  for (const [, d] of passos.slice(1)) assert.equal(d, TIQUE_MS)
  // ~1 s de relógio = ~1 s de jogo (o relógio da escolha e a esquiva andam no ritmo dos outros)
  const andou = passos.reduce((s, [, d]) => s + d, 0)
  assert.ok(Math.abs(andou - (LIMIAR_MS + 30 * TIQUE_MS)) < MAX_DELTA_MS, `andou ${andou}`)
})

test('motor: o POST_STEP do nosso próprio passo não conta como quadro do rAF (um passo por tique)', () => {
  const passos = []
  const m = criarMotor({ passo: (t, d) => (passos.push(d), m.marcar(t)) }) // headlessStep emite POST_STEP
  m.marcar(0)
  for (let k = 1; k <= 60; k++) m.tique(LIMIAR_MS + k * TIQUE_MS)
  assert.equal(passos.length, 60)
  // e o rAF voltando (aba visível) tira o motor do caminho
  m.marcar(10_000)
  assert.equal(m.tique(10_010), false)
})

test('motor: um tique atrasado (o navegador segurou o worker) vira no máximo MAX_DELTA_MS', () => {
  const passos = []
  const m = criarMotor({ passo: (t, d) => passos.push(d) })
  m.marcar(0)
  m.tique(5000)
  assert.deepEqual(passos, [MAX_DELTA_MS])
})

test('motor: fora de uma sala (ou da campanha) a aba escondida dorme como sempre', () => {
  let dentro = false
  const passos = []
  const m = criarMotor({ passo: (t, d) => passos.push(d), manter: () => dentro })
  m.marcar(0)
  assert.equal(m.tique(500), false)
  dentro = true
  assert.equal(m.tique(600), true)
  assert.equal(passos.length, 1)
})

test('motor: um passo que estoura não derruba o tique seguinte', () => {
  let n = 0
  const erro = console.error
  console.error = () => {}
  try {
    const m = criarMotor({
      passo: () => {
        n++
        throw new Error('cena quebrada')
      },
    })
    m.tique(100)
    m.tique(200)
    assert.equal(n, 2)
  } finally {
    console.error = erro
  }
})

test('motor + relógio: aba escondida com o worker ligado, o jogo anda ~30 passos por segundo', () => {
  let t = 0
  const tickers = []
  const r = criarRelogio({ agora: () => t, escondida: () => true, criarTicker: (fn) => (tickers.push(fn), () => {}) })
  const passos = []
  const m = criarMotor({ passo: (_, d) => passos.push(d) })
  m.marcar(0)
  r.aoTique((agora) => m.tique(agora))
  r.atualizar()
  for (let k = 0; k < 30; k++) {
    t += TIQUE_MS
    tickers[0]()
  }
  assert.ok(passos.length >= 28, `deu ${passos.length} passos`)
})

// ---------- a trava da entrada (pausa online) ----------

test('pausa online: com o menu aberto só a Pausa e a Config leem o controle; fechar solta a arena', () => {
  assert.equal(entradaTravada(), false)
  assert.equal(podeLer('PvpArena'), true)
  const destravar = travarEntrada(['Pausa', 'Config'])
  assert.equal(entradaTravada(), true)
  assert.equal(podeLer('PvpArena'), false, 'a arena não vê botão nem joystick: o coração fica parado')
  assert.equal(podeLer('Pausa'), true)
  assert.equal(podeLer('Config'), true)
  destravar()
  assert.equal(podeLer('PvpArena'), true)
})

test('pausa online: destravar uma trava velha não solta a nova (a Pausa reaberta)', () => {
  const velha = travarEntrada(['Pausa'])
  const nova = travarEntrada(['Pausa', 'Config'])
  velha()
  assert.equal(podeLer('CoopArena'), false)
  nova()
  assert.equal(podeLer('CoopArena'), true)
})

// ---------- AUSENTE / PAUSADO ----------

test('ausência: PAUSADO ganha de AUSENTE; SEM CONEXÃO (caiu) tem o aviso dele', () => {
  assert.equal(marcaDeAusencia({ segundoPlano: false, pausado: false, caiu: null }), null)
  assert.equal(marcaDeAusencia({ segundoPlano: true, pausado: false, caiu: null }), 'AUSENTE')
  assert.equal(marcaDeAusencia({ segundoPlano: true, pausado: true, caiu: null }), 'PAUSADO')
  assert.equal(marcaDeAusencia({ segundoPlano: false, pausado: true, caiu: null }), 'PAUSADO')
  assert.equal(marcaDeAusencia({ segundoPlano: true, pausado: true, caiu: 12000 }), null)
  assert.equal(marcaDeAusencia(null), null)
})

test('ausência: a assinatura muda só quando a marca de alguém muda (as arenas de N refazem os cartões)', () => {
  const lista = [
    { indice: 0, segundoPlano: false, pausado: false, caiu: null, nome: 'a' },
    { indice: 1, segundoPlano: false, pausado: false, caiu: null, nome: 'b' },
  ]
  const a = assinaturaDeAusencia(lista)
  assert.equal(assinaturaDeAusencia(lista.map((p) => ({ ...p, nome: 'outro' }))), a)
  assert.notEqual(assinaturaDeAusencia([lista[0], { ...lista[1], pausado: true }]), a)
})

test('ausência (2 jogadores): o host é o lado 0; outroAusente olha só o outro lado', () => {
  const host = { host: true, segundoPlano: false }
  const conv = { host: false, segundoPlano: true }
  assert.equal(ladoDe(host), 0)
  assert.equal(ladoDe(conv), 1)
  assert.equal(outroAusente([host, conv], 0), true, 'o host vê o convidado ausente')
  assert.equal(outroAusente([host, conv], 1), false, 'o convidado ausente não se vê ausente')
  assert.equal(outroAusente([], 0), false)
})
