// node --test src/game/campanha/__tests__/ataqueReal.test.js
// O ataque DE VERDADE das cartas na caixa da CPU (campanha/ataqueReal.js): o servidor roda a biblioteca
// attacks/ sem Phaser, a CPU desvia e ele conta os acertos; o navegador repete com as amostras.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CARTAS } from '../../pvp/cartas.js'
import { simularCpuReal, criarAtaqueReal, cenaSemTela, limitesReais, inicioReal, ataqueRealDaCarta } from '../ataqueReal.js'
import { ler, posicaoNoTempo, PASSO_MS } from '../amostras.js'

const todas = Object.values(CARTAS).flat()

test('toda carta que ataca no PvP roda no servidor (sem Phaser), com amostras plausíveis da CPU', () => {
  let rodaram = 0
  for (const carta of todas) {
    if (!ataqueRealDaCarta(carta)) continue
    const r = simularCpuReal({ carta, dano: 5, ritmo: {}, semente: `t:${carta.id}` })
    rodaram++
    assert.ok(Number.isInteger(r.acertos) && r.acertos >= 0, carta.id)
    assert.ok(r.duracao > 1000 && r.duracao < 20000, `${carta.id}: ${r.duracao}`)
    const a = ler(r.amostras)
    assert.ok(a && a.length >= 10, carta.id)
    const l = limitesReais()
    for (const p of a) assert.ok(p.x >= l.left && p.x <= l.right && p.y >= l.top && p.y <= l.bottom, `${carta.id}: CPU fora da caixa`)
  }
  assert.ok(rodaram >= 120, `rodaram ${rodaram}`)
})

test('determinístico: mesma carta e semente, mesmo resultado', () => {
  for (const id of ['kris-espadas-9', 'susie-espadas-14', 'asriel-ouros-7', 'noelle-espadas-14']) {
    const carta = todas.find((c) => c.id === id)
    const x = simularCpuReal({ carta, dano: 7, ritmo: { velocidade: 1.1, densidade: 1.1 }, semente: 's' })
    const y = simularCpuReal({ carta, dano: 7, ritmo: { velocidade: 1.1, densidade: 1.1 }, semente: 's' })
    assert.deepEqual(x, y)
  }
})

test('a CPU leva acertos de verdade (os ataques do jogo valem) e às vezes desvia de tudo', () => {
  let total = 0
  let zeros = 0
  for (const carta of todas.filter((c) => c.personagem === 'kris' && ataqueRealDaCarta(c))) {
    const r = simularCpuReal({ carta, dano: 5, ritmo: {}, semente: `k:${carta.id}` })
    total += r.acertos
    if (!r.acertos) zeros++
  }
  assert.ok(total > 5 && zeros > 0, `total ${total}, zeros ${zeros}`)
})

test('a repetição do navegador (amostras do servidor) chega aos mesmos acertos, quase sempre', () => {
  let iguais = 0
  let n = 0
  for (const carta of todas.filter((c) => ['kris', 'ralsei', 'susie'].includes(c.personagem) && ataqueRealDaCarta(c))) {
    const plano = { carta, dano: 5, ritmo: {}, semente: `rep:${carta.id}` }
    const s = simularCpuReal(plano)
    const amostras = ler(s.amostras)
    const coracao = { ...inicioReal() }
    const e = criarAtaqueReal(cenaSemTela(), { ...plano, limites: limitesReais(), coracao })
    while (!e.acabou) {
      const p = posicaoNoTempo(amostras, e.t + PASSO_MS, inicioReal())
      coracao.x = p.x
      coracao.y = p.y
      e.passo()
    }
    n++
    if (e.acertos === s.acertos) iguais++
  }
  assert.ok(iguais / n >= 0.8, `iguais ${iguais}/${n}`)
})
