// node --test src/game/pvp/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lerAtrasado, MAPAS_TECLADO, MAPA_NORMAL, aplicarMapa, inverterMapa, sortearMapa, setaResultante, SETAS, MODOS_CLONE, espelhar } from '../bonusInformatica.js'
import { eventosDaArena } from '../arenas.js'
import { criarRng, aleatorio } from '../baralho.js'

test('lag: o comando só chega depois do atraso e continua valendo até o próximo', () => {
  const fila = [
    { t: 0, x: 100, y: 0 },
    { t: 100, x: 0, y: 100 },
    { t: 200, x: -100, y: 0 },
  ]
  assert.equal(lerAtrasado(fila, -1), null)
  assert.deepEqual(lerAtrasado(fila, 50), { t: 0, x: 100, y: 0 })
  assert.deepEqual(lerAtrasado(fila, 99), { t: 0, x: 100, y: 0 })
  assert.deepEqual(lerAtrasado(fila, 150), { t: 100, x: 0, y: 100 })
  assert.equal(fila.length, 2) // o que já chegou e passou sai da fila
  assert.deepEqual(lerAtrasado(fila, 1000), { t: 200, x: -100, y: 0 })
  assert.equal(fila.length, 1)
})

test('teclado: toda troca leva seta em seta, as 4 setas continuam distintas e nenhuma é a identidade', () => {
  assert.equal(MAPAS_TECLADO.length, 7)
  for (const mapa of MAPAS_TECLADO) {
    const saidas = Object.keys(SETAS).map((s) => setaResultante(mapa, s))
    assert.ok(saidas.every(Boolean), mapa.id)
    assert.equal(new Set(saidas).size, 4, mapa.id)
    assert.ok(Object.keys(SETAS).some((s) => setaResultante(mapa, s) !== s), `${mapa.id} não troca nada`)
  }
  for (const s of Object.keys(SETAS)) assert.equal(setaResultante(MAPA_NORMAL, s), s)
})

test('teclado: a inversa desfaz a troca (é o que a CPU usa depois de aprender)', () => {
  const joys = [{ x: 100, y: 0 }, { x: -40, y: 70 }, { x: 0, y: -100 }]
  for (const mapa of MAPAS_TECLADO) {
    const inv = inverterMapa(mapa)
    for (const j of joys) assert.deepEqual(aplicarMapa(inv, aplicarMapa(mapa, j)), j, mapa.id)
  }
  assert.equal(setaResultante(MAPAS_TECLADO.find((m) => m.id === 'espelhoLados'), 'esquerda'), 'direita')
})

test('teclado: o sorteio nunca repete o mapa atual', () => {
  const estado = criarRng('teclado')
  const rng = () => aleatorio(estado)
  let atual = MAPA_NORMAL
  for (let k = 0; k < 200; k++) {
    const novo = sortearMapa(rng, atual)
    assert.notEqual(novo.id, atual.id)
    assert.ok(MAPAS_TECLADO.includes(novo))
    atual = novo
  }
})

test('clone: o espelho fica dentro da caixa e espelhar duas vezes volta ao lugar', () => {
  const l = { left: 50, right: 270, top: 113, bottom: 283 }
  for (const modo of MODOS_CLONE) {
    for (const [x, y] of [[60, 120], [160, 198], [265, 280]]) {
      const p = espelhar(modo, l, x, y)
      assert.ok(p.x >= l.left && p.x <= l.right && p.y >= l.top && p.y <= l.bottom, modo)
      assert.deepEqual(espelhar(modo, l, p.x, p.y), { x, y }, modo)
    }
  }
  assert.deepEqual(espelhar('lados', l, 60, 120), { x: 260, y: 120 })
  assert.deepEqual(espelhar('cimaBaixo', l, 60, 120), { x: 60, y: 276 })
  assert.deepEqual(espelhar('centro', l, 60, 120), { x: 260, y: 276 })
})

test('sala de informática: pelo menos 10 bônus, com os 6 da sala', () => {
  const ids = eventosDaArena('informatica').map((e) => e.id)
  assert.ok(ids.length >= 10, `só ${ids.length}`)
  for (const id of ['popups', 'lag', 'teclado', 'clone', 'telaAzul', 'cursor']) assert.ok(ids.includes(id), id)
})
