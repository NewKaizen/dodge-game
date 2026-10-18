import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fatoresDe, quantas } from '../acessibilidade.js'
import { paletaDaltonismo, aplicarDaltonismo, distancia, claridade, simularDaltonismo, MODOS } from '../daltonismo.js'
import { OPCOES } from '../preferencias.js'
import { CORES } from '../constants.js'
import { TEXTO_JOGADOR } from '../pvp/perfil.js'

// ---------- níveis -> fatores ----------

test('padrão (máximo, sem reduzir) = jogo como era', () => {
  const f = fatoresDe({})
  assert.equal(f.nivel, 2)
  assert.equal(f.tremor, 1)
  assert.equal(f.clarao, 1)
  assert.equal(f.particulas, 1)
  assert.equal(f.festa, 1)
  assert.equal(f.fundo, 'animado')
  assert.equal(f.velocidadeFundo, 1)
  assert.equal(f.filtros, true)
  assert.equal(f.rastros, true)
  assert.equal(f.zoom, 1)
  assert.equal(f.lenta, 1)
  assert.equal(f.piscar, true)
})

test('gráficos: cada nível tem menos enfeite que o de cima', () => {
  const [min, med, max] = OPCOES.graficos.map((graficos) => fatoresDe({ graficos }))
  assert.ok(min.particulas < med.particulas && med.particulas < max.particulas)
  assert.ok(min.festa < med.festa && med.festa < max.festa)
  assert.ok(min.balasTelao < med.balasTelao && med.balasTelao <= max.balasTelao)
  assert.ok(Math.abs(med.particulas - 0.5) < 0.01, 'médio ~50% das partículas')
  assert.ok(min.particulas <= 0.2, 'mínimo: quase sem partículas')
  assert.equal(min.fundo, 'parado')
  assert.equal(med.fundo, 'animado')
  assert.equal(min.rastros, false)
  assert.equal(med.filtros, false)
  assert.equal(min.filtros, false)
  // gráficos não mexem em tremor/clarão (são outras preferências)
  for (const f of [min, med]) {
    assert.equal(f.tremor, 1)
    assert.equal(f.clarao, 1)
  }
})

test('nível inválido cai no máximo', () => {
  assert.equal(fatoresDe({ graficos: 'ultra' }).nivel, 2)
})

test('tremor: reduzido ~40%, desligado = nada', () => {
  assert.equal(fatoresDe({ tremor: 'normal' }).tremor, 1)
  assert.ok(Math.abs(fatoresDe({ tremor: 'reduzido' }).tremor - 0.4) < 0.01)
  assert.equal(fatoresDe({ tremor: 'desligado' }).tremor, 0)
})

test('clarões desligados = nenhum; reduzir animações = fraco', () => {
  assert.equal(fatoresDe({ flashes: false }).clarao, 0)
  const calmo = fatoresDe({ reduzirMovimento: true })
  assert.ok(calmo.clarao > 0 && calmo.clarao <= 0.3)
  assert.equal(fatoresDe({ reduzirMovimento: true, flashes: false }).clarao, 0)
})

test('reduzir animações: amansa tremor, zoom, câmera lenta, piscadas e fundos', () => {
  const f = fatoresDe({ reduzirMovimento: true })
  assert.ok(f.tremor <= 0.4)
  assert.equal(fatoresDe({ reduzirMovimento: true, tremor: 'desligado' }).tremor, 0, 'não religa o que foi desligado')
  assert.ok(f.zoom < 1)
  assert.ok(f.lenta < 1)
  assert.equal(f.piscar, false)
  assert.ok(f.velocidadeFundo < 1)
  // não mexe nos gráficos
  assert.equal(f.particulas, 1)
  assert.equal(f.fundo, 'animado')
})

test('quantas: fração com sorteio no arredondamento', () => {
  assert.equal(quantas(10, 1), 10)
  assert.equal(
    quantas(10, 0.5, () => 0),
    5,
  )
  assert.equal(
    quantas(10, 0.15, () => 0),
    1,
  )
  assert.equal(
    quantas(10, 0.15, () => 0.99),
    2,
  )
  assert.equal(
    quantas(3, 0.05, () => 0),
    0,
  )
  // média certa
  let soma = 0
  let s = 1
  const sorte = () => (s = (s * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 4000; i++) soma += quantas(7, 0.3, sorte)
  assert.ok(Math.abs(soma / 4000 - 2.1) < 0.1)
})

// ---------- paletas do modo daltônico ----------

const corValida = (c) => Number.isInteger(c) && c >= 0 && c <= 0xffffff
const textoValido = (c) => /^#[0-9a-f]{6}$/i.test(c)

test('paletaDaltonismo: todo modo tem as cores certas e válidas', () => {
  assert.deepEqual(MODOS, OPCOES.daltonismo)
  for (const modo of MODOS) {
    const p = paletaDaltonismo(modo)
    assert.ok(corValida(p.aviso) && corValida(p.acerto), modo)
    assert.equal(p.almas.length, 2)
    assert.ok(p.almas.every(corValida), modo)
    assert.equal(p.textoAlmas.length, 2)
    assert.ok(p.textoAlmas.every(textoValido), modo)
  }
  assert.deepEqual(paletaDaltonismo('xyz'), paletaDaltonismo('nenhum'))
})

test('paleta "nenhum" = as cores de sempre do jogo', () => {
  const p = paletaDaltonismo('nenhum')
  assert.equal(p.aviso, 0xff3048)
  assert.deepEqual(p.almas, [0xff2030, 0xffd23a])
  assert.deepEqual(p.textoAlmas, ['#ff5a66', '#ffd23a'])
})

test('paletaDaltonismo devolve cópia (mexer nela não estraga a próxima)', () => {
  paletaDaltonismo('protanopia').almas[0] = 0
  assert.notEqual(paletaDaltonismo('protanopia').almas[0], 0)
})

// Simulação (Machado 2009): no modo dele, P1 e P2 bem diferentes, nenhuma
// das cores se confunde com o branco das balas nem some no fundo preto, e o
// aviso fica pelo menos tão separado das almas quanto no jogo original.
test('paletas distintas para quem tem aquele tipo de daltonismo', () => {
  const original = paletaDaltonismo('nenhum')
  for (const modo of MODOS.filter((m) => m !== 'nenhum')) {
    const p = paletaDaltonismo(modo)
    const [p1, p2] = p.almas
    const d = (a, b) => distancia(a, b, modo)
    assert.ok(d(p1, p2) >= 100, `${modo}: P1 x P2 ${d(p1, p2).toFixed(0)}`)
    assert.ok(d(p1, p2) > distancia(original.almas[0], original.almas[1], modo) + 20, `${modo}: melhor que o vermelho x amarelo`)
    for (const [nome, c] of [
      ['aviso', p.aviso],
      ['P1', p1],
      ['P2', p2],
    ]) {
      assert.ok(d(c, 0xffffff) >= 30, `${modo}: ${nome} x branco ${d(c, 0xffffff).toFixed(0)}`)
      assert.ok(claridade(c, modo) >= 50, `${modo}: ${nome} claro o bastante no preto`) // o vermelho de sempre tem ~55
    }
    const avisoAlma = Math.min(d(p.aviso, p1), d(p.aviso, p2))
    const avisoAlmaOriginal = Math.min(d(original.aviso, original.almas[0]), d(original.aviso, original.almas[1]))
    assert.ok(avisoAlma >= 15 && avisoAlma > avisoAlmaOriginal, `${modo}: aviso x almas ${avisoAlma.toFixed(0)}`)
    // e para quem não é daltônico também continuam distintas
    assert.ok(distancia(p1, p2) >= 60, `${modo}: P1 x P2 na visão comum`)
    assert.ok(distancia(p.aviso, p1) >= 25 && distancia(p.aviso, p2) >= 25, `${modo}: aviso na visão comum`)
  }
})

test('simulação: cinza não muda, vermelho/verde se confundem na deuteranopia', () => {
  for (const modo of MODOS) assert.ok(distancia(0x808080, simularDaltonismo(0x808080, modo)) < 3, modo)
  assert.ok(distancia(0xd04040, 0x6a8a20, 'deuteranopia') < distancia(0xd04040, 0x6a8a20) / 3)
})

test('aplicarDaltonismo escreve em CORES e TEXTO_JOGADOR e volta', () => {
  const { antes, depois } = aplicarDaltonismo('tritanopia')
  assert.equal(antes.aviso, 0xff3048)
  assert.equal(CORES.aviso, depois.aviso)
  assert.equal(CORES.acerto, depois.acerto)
  assert.deepEqual(CORES.almas, depois.almas)
  assert.deepEqual(TEXTO_JOGADOR, depois.textoAlmas)
  aplicarDaltonismo('nenhum')
  assert.equal(CORES.aviso, 0xff3048)
  assert.deepEqual(CORES.almas, [0xff2030, 0xffd23a])
  assert.deepEqual(TEXTO_JOGADOR, ['#ff5a66', '#ffd23a'])
})
