// node --test src/game/manual/__tests__/ralsei.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarRng } from '../../pvp/baralho.js'
import { partesDoRalsei, rostoDoRalsei, EXPRESSOES, expressaoDoRalsei, piscaEm, SUSTO_MS, FESTA_MS } from '../ralsei.js'
import { ETAPAS } from '../pagina1.js'

const finitas = (camadas) =>
  camadas.every((c) => (c.tipo === 'traco' ? c.tracos.flat() : c.poligono).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))

test('cara por etapa: concentrado desenhando, incentivo depois de errar, animado no fim', () => {
  assert.equal(expressaoDoRalsei('intro'), 'feliz')
  assert.equal(expressaoDoRalsei('desenhando'), 'concentrado')
  assert.equal(expressaoDoRalsei('marcas'), 'feliz')
  assert.equal(expressaoDoRalsei('desviar'), 'feliz')
  assert.equal(expressaoDoRalsei('tentarDeNovo'), 'incentivo')
  for (const e of ['concluida', 'virando', 'fim']) assert.equal(expressaoDoRalsei(e), 'animado')
  for (const e of ETAPAS) assert.ok(EXPRESSOES.includes(expressaoDoRalsei(e)), e)
})

test('o último evento manda por um instante: susto no acerto, festa na marca', () => {
  assert.equal(expressaoDoRalsei('tentarDeNovo', { tipo: 'acerto', ha: 0 }), 'surpreso')
  assert.equal(expressaoDoRalsei('tentarDeNovo', { tipo: 'acerto', ha: SUSTO_MS - 1 }), 'surpreso')
  assert.equal(expressaoDoRalsei('tentarDeNovo', { tipo: 'acerto', ha: SUSTO_MS }), 'incentivo')
  assert.equal(expressaoDoRalsei('marcas', { tipo: 'marca', ha: 10 }), 'animado')
  assert.equal(expressaoDoRalsei('marcas', { tipo: 'marca', ha: FESTA_MS + 1 }), 'feliz')
  assert.equal(expressaoDoRalsei('desviar', { tipo: 'outro', ha: 0 }), 'feliz')
})

test('desenho do Ralsei: determinístico, com corpo/cabeça/chapéu e todas as caras', () => {
  const a = partesDoRalsei(criarRng('r'))
  assert.deepEqual(a, partesDoRalsei(criarRng('r')))
  for (const k of ['corpo', 'cabeca', 'chapeu']) {
    assert.ok(a[k].length > 2, k)
    assert.ok(finitas(a[k]), k)
  }
  for (const e of EXPRESSOES) {
    const r = rostoDoRalsei(criarRng(e), e)
    assert.deepEqual(r, rostoDoRalsei(criarRng(e), e))
    assert.ok(finitas(r) && r.length > 3, e)
  }
  // piscar muda a cara (menos quando os olhos já estão fechadinhos de alegria)
  assert.notDeepEqual(rostoDoRalsei(criarRng('f'), 'feliz'), rostoDoRalsei(criarRng('f'), 'feliz', { piscando: true }))
  assert.deepEqual(rostoDoRalsei(criarRng('a'), 'animado'), rostoDoRalsei(criarRng('a'), 'animado', { piscando: true }))
  // caras diferentes de verdade
  assert.notDeepEqual(rostoDoRalsei(criarRng('x'), 'feliz'), rostoDoRalsei(criarRng('x'), 'surpreso'))
})

test('piscadas: de 2,6 s a 5 s depois', () => {
  const rng = criarRng('p')
  for (let i = 0; i < 50; i++) {
    const t = piscaEm(rng, 1000)
    assert.ok(t >= 3600 && t <= 6000)
  }
})
