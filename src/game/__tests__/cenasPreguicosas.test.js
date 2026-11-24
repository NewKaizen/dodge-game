import { test } from 'node:test'
import assert from 'node:assert/strict'
import { instalarCenasPreguicosas } from '../cenasPreguicosas.js'

// um SceneManager de mentira: só o que cenasPreguicosas.js usa
function falso(chaves) {
  const cena = (k) => ({ sys: { settings: { key: k } } })
  const mgr = {
    keys: Object.fromEntries(chaves.map((k) => [k, true])),
    scenes: chaves.map(cena),
    ativas: new Set(),
    log: [],
    start(k, d) {
      mgr.log.push(['start', k, d])
      mgr.ativas.add(k)
      return mgr
    },
    run(k, d) {
      mgr.log.push(['run', k, d])
      return mgr
    },
    switch(a, b) {
      mgr.log.push(['switch', a, b])
      return mgr
    },
    sleep(k) {
      mgr.log.push(['sleep', k])
      mgr.ativas.delete(k)
    },
    add(k) {
      mgr.keys[k] = true
      const c = cena(k)
      mgr.scenes.push(c)
      return c
    },
    isActive: (k) => mgr.ativas.has(k),
    getScenes: () => mgr.scenes.filter((s) => mgr.ativas.has(s.sys.settings.key)),
    bringToTop(k) {
      mgr.log.push(['topo', k])
    },
  }
  const eventos = []
  return { mgr, game: { scene: mgr, events: { emit: (...a) => eventos.push(a) } }, eventos }
}

test('cena sob demanda: o start espera o import, entra no lugar dela e é refeito com os mesmos dados', async () => {
  const { mgr, game, eventos } = falso(['Boot', 'Menu', 'Carregando'])
  let soltar
  const importou = new Promise((r) => (soltar = r))
  instalarCenasPreguicosas(game, { cenas: { Campanha: () => importou }, ordem: ['Boot', 'Menu', 'Campanha', 'Carregando'] })
  mgr.start('Menu')
  mgr.start('Campanha', { mundo: 1 })
  assert.equal(globalThis.__cenasCarregando, 1)
  assert.ok(!mgr.log.some(([op, k]) => op === 'start' && k === 'Campanha'), 'ainda não abriu')
  soltar({ default: class {} })
  await importou
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(globalThis.__cenasCarregando, 0)
  assert.deepEqual(
    mgr.log.find(([op, k]) => op === 'start' && k === 'Campanha'),
    ['start', 'Campanha', { mundo: 1 }],
  )
  // a ordem de desenho é a do config (Carregando continua por cima)
  assert.deepEqual(
    mgr.scenes.map((s) => s.sys.settings.key),
    ['Boot', 'Menu', 'Campanha', 'Carregando'],
  )
  assert.ok(eventos.some(([nome]) => nome === 'cenanova'))
  // carregada: o próximo start é direto
  const antes = mgr.log.length
  mgr.start('Campanha', { mundo: 2 })
  assert.deepEqual(mgr.log[antes], ['start', 'Campanha', { mundo: 2 }])
})

test('cena sob demanda: sem nada na tela, o CARREGANDO cobre a espera; switch dorme a cena de antes', async () => {
  const { mgr, game } = falso(['Boot', 'Menu', 'Carregando'])
  instalarCenasPreguicosas(game, { cenas: { Lan: async () => ({ default: class {} }) }, ordem: ['Boot', 'Menu', 'Lan', 'Carregando'] })
  mgr.switch('Menu', 'Lan')
  assert.deepEqual(mgr.log[0], ['sleep', 'Menu'])
  assert.ok(mgr.log.some(([op, k]) => op === 'start' && k === 'Carregando'), 'cobriu com o CARREGANDO')
  await new Promise((r) => setTimeout(r, 0))
  assert.ok(mgr.log.some(([op, a, b]) => op === 'switch' && a === 'Menu' && b === 'Lan'))
  assert.ok(mgr.log.some(([op, k]) => op === 'topo' && k === 'Carregando'))
})
