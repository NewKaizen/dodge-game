// node --test src/game/campanha/__tests__/amostras.test.js
// As posições do coração que vão ao servidor: o formato compacto e a plausibilidade (velocidade,
// caixa, teleporte, tempo, taxa) que o servidor confere em toda esquiva.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarGravador, ler, validarAmostras, alvoNoTempo, posicaoNoTempo, AMOSTRA_MS, MAX_INTERVALO_MS } from '../amostras.js'
import { inicioDaCaixa } from '../simulacao.js'
import { CAIXA_CAMPANHA } from '../partida.js'
import { desviar } from './apoio.js'

const caixa = CAIXA_CAMPANHA
const inicio = inicioDaCaixa(caixa)
const ataque = { modelos: ['chuva'], forca: 0.5, duracao: 5000, caixa, semente: 'teste' }
const honesta = () => ler(desviar(ataque, { piloto: 'zigue' }).amostras)
const op = (extra = {}) => ({ caixa, velocidade: 180, duracao: ataque.duracao, inicio, decorridoMs: 6000, ...extra })

test('o gravador grava ~20 Hz no passo da simulação, em décimos de px', () => {
  const g = criarGravador()
  assert.equal(g.registrar(0, 10.04, 20.06), true)
  assert.equal(g.registrar(16, 11, 21), false)
  assert.equal(g.registrar(48, 11, 21), false)
  assert.equal(g.registrar(64, 12.5, 22.25), true)
  assert.deepEqual(g.lista, [0, 100, 201, 64, 125, 223])
  assert.deepEqual(g.tirar(), [0, 100, 201, 64, 125, 223])
  assert.deepEqual(g.tirar(), [])
  const a = honesta()
  const intervalos = a.slice(1).map((s, i) => s.t - a[i].t)
  assert.ok(intervalos.every((d) => d >= AMOSTRA_MS - 16 && d <= AMOSTRA_MS + 16), `intervalos: ${[...new Set(intervalos)]}`)
})

test('ler: só lista plana de inteiros em trincas', () => {
  assert.deepEqual(ler([0, 10, 20]), [{ t: 0, x: 1, y: 2 }])
  for (const ruim of [null, {}, [1, 2], [0, 1.5, 2], [0, 'a', 1], new Array(3 * 401).fill(0)]) assert.equal(ler(ruim), null)
})

test('alvo = a última amostra até t; posição = interpolada', () => {
  const a = [{ t: 0, x: 0, y: 0 }, { t: 100, x: 10, y: 20 }]
  assert.deepEqual(alvoNoTempo(a, 99, inicio), { x: 0, y: 0 })
  assert.deepEqual(alvoNoTempo(a, 100, inicio), { x: 10, y: 20 })
  assert.deepEqual(posicaoNoTempo(a, 50, inicio), { x: 5, y: 10 })
  assert.deepEqual(posicaoNoTempo(a, 500, inicio), { x: 10, y: 20 })
})

test('esquiva honesta passa (vários pilotos e quadros tortos)', () => {
  for (const piloto of ['bom', 'zigue', 'parado', 'reto']) {
    const a = ler(desviar(ataque, { piloto, dts: [16, 50, 7, 33, 120, 16] }).amostras)
    assert.deepEqual(validarAmostras(a, op()), { ok: true, motivo: null }, piloto)
  }
})

test('teleporte, velocidade, fora da caixa, tempo, buraco, taxa, curta e rápida demais', () => {
  const base = honesta()
  const mexer = (f) => {
    const a = base.map((s) => ({ ...s }))
    f(a)
    return validarAmostras(a, op()).motivo
  }
  assert.equal(mexer((a) => (a[40].x = a[40].x > (caixa.esquerda + caixa.direita) / 2 ? caixa.esquerda + 20 : caixa.direita - 20)), 'teleporte')
  // vai e volta em linha reta a v px/s: 180 vale; 205 (14% acima) não é teleporte, mas não vale
  const linha = (v) => {
    const a = []
    let x = inicio.x
    let dir = -1
    for (let t = 0; t <= ataque.duracao; t += 48) {
      a.push({ t, x: Math.round(x * 10) / 10, y: inicio.y })
      x += (dir * v * 48) / 1000
      if (x < caixa.esquerda + 9 || x > caixa.direita - 9) dir = -dir
      x = Math.max(caixa.esquerda + 8, Math.min(caixa.direita - 8, x))
    }
    return a
  }
  assert.equal(validarAmostras(linha(180), op()).ok, true)
  assert.equal(validarAmostras(linha(205), op()).motivo, 'velocidade')
  assert.equal(mexer((a) => (a[0].x = inicio.x + 60)), 'inicio')
  assert.equal(mexer((a) => { for (const s of a) s.y = caixa.base + 40 }), 'fora_da_caixa')
  assert.equal(mexer((a) => (a[30].t = a[29].t)), 'tempo')
  assert.equal(mexer((a) => a.splice(30, 8)), 'intervalo')
  assert.equal(mexer((a) => a.splice(a.length - 10)), 'curta')
  assert.equal(validarAmostras(base, op({ decorridoMs: 3000 })).motivo, 'rapida_demais')
  assert.equal(validarAmostras([], op()).motivo, 'vazia')
  assert.equal(validarAmostras(null, op()).motivo, 'formato')
  // amostras grudadas (5 ms uma da outra): taxa
  const grudadas = base.flatMap((s, i) => (i ? [{ ...base[i - 1], t: s.t - 5 }, s] : [s]))
  assert.equal(validarAmostras(grudadas, op()).motivo, 'taxa')
  assert.ok(MAX_INTERVALO_MS >= 200)
})

test('sem ataque na caixa (duração 0): nada a conferir', () => {
  assert.equal(validarAmostras([], op({ duracao: 0 })).ok, true)
})
