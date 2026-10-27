import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fatoresDe } from '../acessibilidade.js'

// preferencias.js lê o localStorage ao ser importado: cada caso importa uma cópia nova
let n = 0
async function carregar(salvo) {
  const guardado = new Map()
  if (salvo !== undefined) guardado.set('dodge-preferencias', typeof salvo === 'string' ? salvo : JSON.stringify(salvo))
  globalThis.localStorage = {
    getItem: (k) => guardado.get(k) ?? null,
    setItem: (k, v) => guardado.set(k, String(v)),
  }
  const m = await import(`../preferencias.js?caso=${++n}`)
  return { ...m, guardado }
}

test('sem nada salvo: padrões (flashes, tremor e movimento são três preferências separadas)', async () => {
  const { pref, PREFERENCIAS_PADRAO } = await carregar()
  assert.equal(pref('flashes'), true)
  assert.equal(pref('tremor'), 'normal')
  assert.equal(pref('reduzirMovimento'), false)
  assert.equal(pref('daltonismo'), 'nenhum')
  assert.ok('flashes' in PREFERENCIAS_PADRAO && 'tremor' in PREFERENCIAS_PADRAO && 'reduzirMovimento' in PREFERENCIAS_PADRAO)
})

test('valor salvo válido é lido; inválido volta ao padrão (cada chave isolada)', async () => {
  const { pref } = await carregar({ flashes: false, tremor: 'desligado', daltonismo: 'azul-neon', reduzirMovimento: 'sim', graficos: 'medio', fantasma: 1 })
  assert.equal(pref('flashes'), false)
  assert.equal(pref('tremor'), 'desligado')
  assert.equal(pref('daltonismo'), 'nenhum', 'modo desconhecido')
  assert.equal(pref('reduzirMovimento'), false, 'tipo errado (string em vez de booleano)')
  assert.equal(pref('graficos'), 'medio')
  assert.equal(pref('fantasma'), undefined, 'chave desconhecida é ignorada')
})

test('JSON quebrado ou de outro tipo não derruba nem muda os padrões', async () => {
  for (const salvo of ['{quebrado', 'null', '[1,2]', '"texto"', '42']) {
    const { pref } = await carregar(salvo)
    assert.equal(pref('flashes'), true, salvo)
    assert.equal(pref('tremor'), 'normal', salvo)
  }
})

test('definirPref valida, salva e avisa só quando muda', async () => {
  const { pref, definirPref, aoMudarPref, guardado } = await carregar()
  const visto = []
  const parar = aoMudarPref((k, v) => visto.push([k, v]))
  definirPref('tremor', 'reduzido')
  definirPref('tremor', 'reduzido') // igual: nada
  definirPref('tremor', 'enorme') // inválido: nada
  definirPref('flashes', 'sim') // tipo errado: nada
  definirPref('flashes', false)
  parar()
  definirPref('reduzirMovimento', true) // depois de parar: salva, mas ninguém ouve
  assert.deepEqual(visto, [['tremor', 'reduzido'], ['flashes', false]])
  assert.equal(pref('tremor'), 'reduzido')
  assert.equal(pref('flashes'), false)
  const salvo = JSON.parse(guardado.get('dodge-preferencias'))
  assert.equal(salvo.tremor, 'reduzido')
  assert.equal(salvo.flashes, false)
  assert.equal(salvo.reduzirMovimento, true)
})

test('as três preferências agem em coisas diferentes', () => {
  // só "clarões" desligados: sem clarão, mas o tremor continua
  const semClarao = fatoresDe({ flashes: false })
  assert.equal(semClarao.clarao, 0)
  assert.equal(semClarao.tremor, 1)
  assert.equal(semClarao.zoom, 1)
  // só tremor desligado: clarão e zoom continuam
  const semTremor = fatoresDe({ tremor: 'desligado' })
  assert.equal(semTremor.tremor, 0)
  assert.equal(semTremor.clarao, 1)
  assert.equal(fatoresDe({ tremor: 'reduzido' }).tremor, 0.4)
  // reduzir animações: amansa os dois, sem ligar o que foi desligado
  const calmo = fatoresDe({ reduzirMovimento: true })
  assert.ok(calmo.tremor <= 0.3 && calmo.clarao <= 0.25 && calmo.zoom < 1 && calmo.piscar === false)
  assert.equal(fatoresDe({ reduzirMovimento: true, tremor: 'desligado', flashes: false }).tremor, 0)
  assert.equal(fatoresDe({ reduzirMovimento: true, flashes: false }).clarao, 0)
})

test('piscadas dos avisos: mais lentas (3x) sem clarões ou com reduzir animações; nunca mudam o tempo do aviso', () => {
  assert.equal(fatoresDe({}).pulso, 1)
  assert.equal(fatoresDe({ flashes: false }).pulso, 3)
  assert.equal(fatoresDe({ reduzirMovimento: true }).pulso, 3)
  assert.equal(fatoresDe({ tremor: 'desligado' }).pulso, 1, 'tremor não tem a ver com piscar')
})
