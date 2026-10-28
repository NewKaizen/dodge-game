import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarVibracao, padraoDe, intensidadeEfetiva, temAtuador, INTENSIDADES, INTERVALO_GOLPE } from '../vibracao.js'

// controle de mentira com vibrationActuator (Chrome/Edge)
const controle = (index = 0) => {
  const chamadas = []
  let resets = 0
  return {
    index,
    chamadas,
    get resets() {
      return resets
    },
    vibrationActuator: {
      type: 'dual-rumble',
      playEffect: async (tipo, p) => void chamadas.push({ tipo, ...p }),
      reset: async () => void resets++,
    },
  }
}

function montar({ pads = [], ativa = true, intensidade = 0.75 } = {}) {
  const est = { pads, ativa, intensidade, t: 1000, fila: [] }
  const v = criarVibracao({
    alvos: (vaga) => est.pads.filter((p) => p.vaga === vaga),
    ativa: () => est.ativa,
    intensidade: () => est.intensidade,
    agora: () => est.t,
    agendar: (fn, ms) => {
      const x = { fn, ms, vivo: true }
      est.fila.push(x)
      return x
    },
    cancelar: (id) => (id.vivo = false),
  })
  return { v, est }
}
const rodar = (est) => est.fila.filter((x) => x.vivo).forEach((x) => ((x.vivo = false), x.fn()))

test('golpe: pulso de 120 ms, forte 0.5 e fraca 0.7, escalado pela intensidade', () => {
  assert.deepEqual(padraoDe('golpe', 1), [{ atraso: 0, duracao: 120, forte: 0.5, fraca: 0.7 }])
  const [p] = padraoDe('golpe', 0.5)
  assert.equal(p.forte, 0.25)
  assert.equal(p.fraca, 0.35)
  const [ko] = padraoDe('ko', 1)
  assert.equal(ko.duracao, 400)
  assert.equal(ko.forte, 1)
  assert.equal(padraoDe('dupla', 1).length, 2)
  assert.deepEqual(padraoDe('inexistente'), [])
})

test('vibrar manda dual-rumble só ao controle da vaga certa', () => {
  const a = Object.assign(controle(0), { vaga: 0 })
  const b = Object.assign(controle(1), { vaga: 1 })
  const { v } = montar({ pads: [a, b], intensidade: 1 })
  assert.equal(v.vibrar(1, 'golpe'), 1)
  assert.equal(a.chamadas.length, 0)
  assert.equal(b.chamadas.length, 1)
  assert.equal(b.chamadas[0].tipo, 'dual-rumble')
  assert.equal(b.chamadas[0].duration, 120)
  assert.equal(b.chamadas[0].strongMagnitude, 0.5)
  assert.equal(b.chamadas[0].weakMagnitude, 0.7)
})

test('golpe tem limite de 250 ms por jogador; K.O. não', () => {
  const a = Object.assign(controle(0), { vaga: 0 })
  const b = Object.assign(controle(1), { vaga: 1 })
  const { v, est } = montar({ pads: [a, b] })
  assert.equal(v.vibrar(0, 'golpe'), 1)
  est.t += INTERVALO_GOLPE - 1
  assert.equal(v.vibrar(0, 'golpe'), 0)
  assert.equal(v.vibrar(1, 'golpe'), 1) // o outro jogador tem o seu limite
  est.t += 1
  assert.equal(v.vibrar(0, 'golpe'), 1)
  assert.equal(v.vibrar(0, 'ko'), 1)
  assert.equal(v.vibrar(0, 'ko'), 1)
  assert.equal(a.chamadas.length, 4)
  assert.equal(a.chamadas.at(-1).duration, 400)
})

test('dupla agenda o segundo pulso; parar cancela e reseta', () => {
  const a = Object.assign(controle(0), { vaga: 0 })
  const { v, est } = montar({ pads: [a] })
  v.vibrar(0, 'dupla')
  assert.equal(a.chamadas.length, 1)
  rodar(est)
  assert.equal(a.chamadas.length, 2)
  v.vibrar(0, 'dupla')
  v.parar()
  rodar(est)
  assert.equal(a.chamadas.length, 3) // o segundo pulso foi cancelado
  assert.equal(a.resets, 1)
})

test('bloquear (pausa) para o que toca e impede novos efeitos; desbloquear volta', () => {
  const a = Object.assign(controle(0), { vaga: 0 })
  const { v } = montar({ pads: [a] })
  v.vibrar(0, 'ko')
  v.bloquear(true)
  assert.equal(a.resets, 1)
  assert.equal(v.vibrar(0, 'ko'), 0)
  v.bloquear(false)
  assert.equal(v.vibrar(0, 'ko'), 1)
})

test('desligada (ou intensidade 0) não vibra; o teste ignora o liga/desliga', () => {
  const a = Object.assign(controle(0), { vaga: 0 })
  const { v, est } = montar({ pads: [a], ativa: false })
  assert.equal(v.vibrar(0, 'ko'), 0)
  assert.equal(v.testar(a), 'ok')
  assert.equal(a.chamadas.length, 1)
  est.ativa = true
  est.intensidade = 0
  assert.equal(v.vibrar(0, 'ko'), 0)
})

test('sem atuador: nada acontece e nada lança; hapticActuators.pulse serve de reserva', () => {
  const mudo = { index: 0, vaga: 0 }
  const { v } = montar({ pads: [mudo] })
  assert.equal(temAtuador(mudo), false)
  assert.equal(v.vibrar(0, 'ko'), 0)
  assert.equal(v.testar(mudo), 'sem-atuador')
  const pulsos = []
  const antigo = { index: 1, vaga: 0, hapticActuators: [{ pulse: (valor, ms) => pulsos.push([valor, ms]) }] }
  const { v: v2 } = montar({ pads: [antigo], intensidade: 1 })
  assert.equal(v2.vibrar(0, 'golpe'), 1)
  assert.deepEqual(pulsos, [[0.7, 120]])
  const quebrado = { index: 2, vaga: 0, vibrationActuator: { playEffect: () => { throw new Error('recusou') } } }
  assert.equal(montar({ pads: [quebrado] }).v.vibrar(0, 'golpe'), 1) // não lança
})

test('intensidade automática: 75%, ou 25% com tremor/animações reduzidos; a escolhida vence', () => {
  assert.deepEqual(INTENSIDADES, [0.25, 0.5, 0.75, 1])
  assert.equal(intensidadeEfetiva({}), 0.75)
  assert.equal(intensidadeEfetiva({ tremor: 'reduzido' }), 0.25)
  assert.equal(intensidadeEfetiva({ tremor: 'desligado' }), 0.25)
  assert.equal(intensidadeEfetiva({ reduzirMovimento: true }), 0.25)
  assert.equal(intensidadeEfetiva({ vibracaoIntensidade: 1, tremor: 'reduzido' }), 1)
  assert.equal(intensidadeEfetiva({ vibracaoIntensidade: 0.6 }), 0.75)
})
