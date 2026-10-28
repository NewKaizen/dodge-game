import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarBuzzer, linhasDeTeste, ESPACO_KO } from '../buzzer.js'
import { rotearSaida } from '../../lib/joysticks.js'

// relógio e agenda falsos: nada de timers de verdade
function montar({ ativo = true } = {}) {
  const env = { t: 10_000, enviadas: [], pendentes: [], ativo }
  env.b = criarBuzzer({
    enviar: (l) => env.enviadas.push(l),
    ativo: () => env.ativo,
    agora: () => env.t,
    agendar: (fn, ms) => env.pendentes.push({ fn, em: env.t + ms }),
  })
  env.avancar = (ms) => {
    env.t += ms
    env.pendentes.filter((p) => p.em <= env.t).forEach((p) => p.fn())
    env.pendentes = env.pendentes.filter((p) => p.em > env.t)
  }
  return env
}

test('HP normal e golpes comuns: nenhum apito', () => {
  const e = montar()
  for (const hp of [100, 80, 60, 40, 30]) {
    e.b.ko(0, hp)
    e.b.baixa(0, hp, 100)
  }
  assert.deepEqual(e.enviadas, [])
})

test('HP baixo: apita uma vez só (< 25%), rearma se curar acima de 40%', () => {
  const e = montar()
  e.b.baixa(0, 100, 100)
  e.b.baixa(0, 24, 100)
  e.avancar(2000)
  e.b.baixa(0, 20, 100)
  e.b.baixa(0, 10, 100)
  assert.deepEqual(e.enviadas, ['1 BUZZER'])
  e.b.baixa(0, 35, 100) // curou, mas não passou de 40%
  e.avancar(2000)
  e.b.baixa(0, 20, 100)
  assert.equal(e.enviadas.length, 1)
  e.b.baixa(0, 50, 100) // acima de 40%: rearma
  e.avancar(2000)
  e.b.baixa(0, 20, 100)
  assert.equal(e.enviadas.length, 2)
})

test('já começar com HP baixo não apita', () => {
  const e = montar()
  e.b.baixa(0, 10, 100)
  e.b.baixa(0, 8, 100)
  assert.deepEqual(e.enviadas, [])
})

test('K.O.: dois apitos separados por ~350 ms; quem já começa caído não apita', () => {
  const e = montar()
  e.b.ko(1, 0) // começou caído
  assert.deepEqual(e.enviadas, [])
  e.b.ko(1, 40)
  e.b.ko(1, 0)
  assert.deepEqual(e.enviadas, ['2 BUZZER'])
  e.avancar(ESPACO_KO)
  assert.deepEqual(e.enviadas, ['2 BUZZER', '2 BUZZER'])
  e.b.ko(1, 0) // repetido
  e.avancar(2000)
  assert.equal(e.enviadas.length, 2)
})

test('K.O. depois de HP baixo/golpe de SUPER colado fura o intervalo; reiniciar cancela o 2º apito', () => {
  const e = montar()
  e.b.golpeSuper(0)
  e.b.ko(0, 5)
  e.avancar(100)
  e.b.ko(0, 0)
  assert.equal(e.enviadas.length, 2) // super + 1º do K.O.
  e.b.reiniciar()
  e.avancar(1000)
  assert.equal(e.enviadas.length, 2) // o 2º apito não sai depois de reiniciar
})

test('golpe de SUPER e vitória: um apito cada; intervalo mínimo de 1 s por jogador', () => {
  const e = montar()
  e.b.golpeSuper(0)
  e.b.golpeSuper(0) // empilhado: ignorado
  e.b.golpeSuper(1) // outro jogador: independente
  e.avancar(500)
  e.b.venceu(0) // ainda dentro de 1 s
  assert.deepEqual(e.enviadas, ['1 BUZZER', '2 BUZZER'])
  e.avancar(600)
  e.b.venceu(0)
  assert.deepEqual(e.enviadas, ['1 BUZZER', '2 BUZZER', '1 BUZZER'])
})

test('HP baixo barrado pelo intervalo tenta de novo depois', () => {
  const e = montar()
  e.b.baixa(0, 100, 100)
  e.b.golpeSuper(0)
  e.b.baixa(0, 20, 100) // dentro de 1 s: não gasta o aviso
  assert.equal(e.enviadas.length, 1)
  e.avancar(1100)
  e.b.baixa(0, 20, 100)
  assert.equal(e.enviadas.length, 2)
})

test('preferência desligada: nada sai (nem o 2º apito do K.O.)', () => {
  const e = montar({ ativo: false })
  e.b.golpeSuper(0)
  e.b.venceu(0)
  e.b.baixa(0, 100, 100)
  e.b.baixa(0, 10, 100)
  e.b.ko(0, 5)
  e.b.ko(0, 0)
  e.avancar(2000)
  assert.deepEqual(e.enviadas, [])
})

test('roteamento por jogador: duas portas, uma placa por porta, e modo relé', () => {
  const duas = [{ porta: 'A', jogador: 1 }, { porta: 'B', jogador: 2 }]
  assert.deepEqual(rotearSaida('2 BUZZER', duas), [{ porta: 'B', linha: '1 BUZZER' }])
  assert.deepEqual(rotearSaida('1 BUZZER', duas), [{ porta: 'A', linha: '1 BUZZER' }])
  const rele = [{ porta: 'A', jogador: 1 }]
  assert.deepEqual(rotearSaida('2 BUZZER', rele), [{ porta: 'A', linha: '2 BUZZER' }])
  assert.deepEqual(rotearSaida('1 BUZZER', rele), [{ porta: 'A', linha: '1 BUZZER' }])
  // CPU/ausente: nada
  assert.deepEqual(rotearSaida('2 BUZZER', rele.slice(0, 0)), [])
})

test('TESTAR BUZZER: uma linha para cada porta aberta', () => {
  const lista = [
    { porta: 'A', jogador: 1, aberta: true },
    { porta: 'B', jogador: 2, aberta: true },
    { porta: 'C', jogador: 2, aberta: false },
  ]
  const linhas = linhasDeTeste(lista)
  assert.deepEqual(linhas, ['1 BUZZER', '2 BUZZER'])
  const abertas = lista.filter((x) => x.aberta)
  const portas = linhas.flatMap((l) => rotearSaida(l, abertas))
  assert.deepEqual(portas, [{ porta: 'A', linha: '1 BUZZER' }, { porta: 'B', linha: '1 BUZZER' }])
  assert.deepEqual(linhasDeTeste([]), [])
})
