// node --test src/game/campanha/__tests__/amostras.test.js
// As posições do coração que vão ao servidor: o formato compacto e a plausibilidade (velocidade,
// caixa, teleporte, tempo, taxa) que o servidor confere em toda esquiva do quadro.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ler, validarAmostras, posicaoNoTempo, MAX_INTERVALO_MS, MAX_AMOSTRAS_QUADRO, PASSO_MS } from '../amostras.js'
import { limitesDoQuadro, inicioNoQuadro } from '../quadro.js'
import { CARTAS_CHEFES } from '../../coop/cartasChefe.js'
import { desviarNoQuadro } from './apoioQuadro.js'

const l = limitesDoQuadro()
const caixa = { esquerda: l.left, direita: l.right, topo: l.top, base: l.bottom }
const inicio = inicioNoQuadro(l, 0, [true, false])
const carta = CARTAS_CHEFES.c_noelle.fases[0][0]
const esq = { chefe: 'c_noelle', nivel: 'facil', carta, danos: [5, null], hp: [90, 0], jogadores: [true, false], caixa: {}, ritmo: { velocidade: 1, densidade: 1 }, semente: 'teste' }
const amostrasDe = (piloto) => {
  const e = desviarNoQuadro(esq, { piloto })
  return { a: ler(e.amostras, MAX_AMOSTRAS_QUADRO), duracao: e.q.duracao }
}
const honesta = () => amostrasDe('zigue').a
const DURACAO = amostrasDe('parado').duracao
const op = (extra = {}) => ({ caixa, velocidade: 180, duracao: DURACAO, inicio, decorridoMs: DURACAO + 1000, ...extra })

test('o quadro grava uma amostra por passo fixo, em décimos de px', () => {
  const a = honesta()
  const intervalos = new Set(a.slice(1).map((s, i) => s.t - a[i].t))
  assert.deepEqual([...intervalos], [PASSO_MS])
  assert.equal(a[0].t, PASSO_MS)
})

test('ler: só lista plana de inteiros em trincas', () => {
  assert.deepEqual(ler([0, 10, 20]), [{ t: 0, x: 1, y: 2 }])
  for (const ruim of [null, {}, [1, 2], [0, 1.5, 2], [0, 'a', 1], new Array(3 * 401).fill(0)]) assert.equal(ler(ruim), null)
  assert.equal(ler(new Array(3 * 401).fill(0), MAX_AMOSTRAS_QUADRO).length, 401)
  assert.equal(ler(new Array(3 * (MAX_AMOSTRAS_QUADRO + 1)).fill(0), MAX_AMOSTRAS_QUADRO), null)
})

test('posição = interpolada entre as amostras; antes da primeira, o começo', () => {
  const a = [{ t: 0, x: 0, y: 0 }, { t: 100, x: 10, y: 20 }]
  assert.deepEqual(posicaoNoTempo(a, 50, inicio), { x: 5, y: 10 })
  assert.deepEqual(posicaoNoTempo(a, 500, inicio), { x: 10, y: 20 })
})

test('esquiva honesta passa (vários pilotos)', () => {
  for (const piloto of ['bom', 'medio', 'zigue', 'parado']) assert.deepEqual(validarAmostras(amostrasDe(piloto).a, op()), { ok: true, motivo: null }, piloto)
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
    for (let t = 0; t <= DURACAO; t += 48) {
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
  assert.equal(mexer((a) => a.splice(30, 20)), 'intervalo') // 20 passos sem posição: 336 ms
  assert.equal(mexer((a) => a.splice(a.length - 20)), 'curta') // parou de mandar 320 ms antes do fim
  assert.equal(validarAmostras(base, op({ decorridoMs: DURACAO - 1500 })).motivo, 'rapida_demais')
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
