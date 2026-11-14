// node --test src/game/pvp/__tests__/efeitosAses.test.js
//
// Os efeitos dos Ases (pvp/efeitosAses.js) são só enfeite: precisam existir para todo personagem x naipe,
// nunca lançar erro dentro da partida, durar pouco, ser iguais nos dois lados (nada sorteado) e não deixar
// nada na cena. Aqui uma cena falsa (sem Phaser) registra tudo o que eles criam.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CARTAS } from '../cartas.js'
import { semLigaduras } from '../../campanha/texto.js'
import { definirPref } from '../../preferencias.js'
import { EFEITOS_ASES, PERSONAGENS_ASES, NAIPES_ASES, efeitoDoAs, asDaJogada, tocarEfeitoAs, limparEfeitosAs, efeitoDoEspecial, efeitoDoReflexo, escalaDaCarta } from '../efeitosAses.js'

// ---------- cena falsa ----------

function criarCena({ quebra = null } = {}) {
  const vivos = new Set()
  const log = []
  const textos = []
  const tweens = []
  const timers = []
  const ouvintes = new Map()
  let criados = 0
  let agora = 0
  let fazendo = 0
  const objeto = (tipo, args) => {
    if (quebra === tipo) throw new Error(`falha de ${tipo}`)
    criados++
    log.push([tipo, ...args.filter((a) => typeof a === 'number')])
    const o = { scene: true, active: true, destroyed: false }
    const p = new Proxy(o, {
      get: (t, k) => {
        if (k in t) return t[k]
        if (k === 'destroy') return () => ((t.destroyed = true), (t.scene = null), vivos.delete(p))
        if (typeof k === 'symbol') return undefined
        return () => p
      },
      set: (t, k, v) => ((t[k] = v), true),
    })
    vivos.add(p)
    return p
  }
  const cena = {
    add: {
      graphics: (...a) => objeto('graphics', a),
      text: (x, y, s) => {
        textos.push(s)
        return objeto('text', [x, y])
      },
      image: (...a) => objeto('image', a.filter((v) => typeof v === 'number')),
      rectangle: (...a) => objeto('rectangle', a),
      particles: (...a) => objeto('particles', a),
    },
    tweens: {
      add: (cfg) => {
        const t = { cfg, fim: agora + (cfg.delay ?? 0) + (cfg.duration ?? 0) * (cfg.yoyo ? 2 : 1) * (1 + (cfg.repeat ?? 0)), base: agora }
        tweens.push(t)
        return t
      },
      killTweensOf: () => {},
    },
    time: {
      delayedCall: (ms, fn) => {
        const t = { ms: agora + ms, fn, removido: false, remove() { this.removido = true } }
        timers.push(t)
        return t
      },
    },
    events: { once: (nome, fn) => ouvintes.set(nome, [...(ouvintes.get(nome) ?? []), fn]) },
    textures: { exists: () => false, createCanvas: () => ({ getContext: () => ({ fillRect() {}, set fillStyle(_) {} }), refresh() {}, setFilter() {} }) },
    cache: { audio: { exists: () => false } },
    sound: { play() {} },
    cameras: { cameras: [] },
  }
  return {
    cena,
    vivos,
    log,
    textos,
    tweens,
    get criados() {
      return criados
    },
    // roda os callbacks dos tweens (como se tivessem passado) e os timers, em ordem de tempo
    soltar() {
      let guarda = 0
      const feitos = new Set()
      while (guarda++ < 400) {
        const t = timers.filter((x) => !x.removido && !feitos.has(x)).sort((a, b) => a.ms - b.ms)[0]
        const tw = tweens.filter((x) => !feitos.has(x))[0]
        if (!t && !tw) break
        if (tw && (!t || tw.base <= t.ms)) {
          feitos.add(tw)
          agora = Math.max(agora, tw.base)
          const alvo = tw.cfg.targets
          for (const f of [0.5, 1]) {
            if (alvo && typeof alvo.p === 'number' && tw.cfg.p !== undefined) alvo.p = f
            fazendo++
            tw.cfg.onUpdate?.()
            fazendo--
          }
          tw.cfg.onComplete?.()
        } else {
          feitos.add(t)
          agora = t.ms
          t.fn()
        }
      }
      assert.ok(guarda < 400, 'efeito não termina de agendar coisas')
    },
    desligar() {
      for (const fn of ouvintes.get('shutdown') ?? []) fn()
      ouvintes.delete('shutdown')
    },
    // quando o último tween ou timer (fora o vigia de 1250 ms) termina
    get fimDoUltimo() {
      return Math.max(0, ...tweens.map((t) => t.fim), ...timers.filter((t) => t.ms !== 1250).map((t) => t.ms))
    },
    get fazendo() {
      return fazendo
    },
  }
}

const TODOS = PERSONAGENS_ASES.flatMap((p) => NAIPES_ASES.map((n) => [p, n]))

// ---------- a tabela ----------

test('todo personagem x naipe tem efeito próprio, com o nome da carta do baralho', () => {
  assert.deepEqual([...PERSONAGENS_ASES].sort(), Object.keys(CARTAS).sort())
  for (const [p, n] of TODOS) {
    const e = EFEITOS_ASES[p]?.[n]
    assert.ok(e && typeof e.fn === 'function', `${p} ${n} sem efeito`)
    assert.equal(efeitoDoAs(p, n), e)
    const carta = CARTAS[p].find((c) => c.naipe === n && c.valor === 1)
    assert.ok(carta, `${p} ${n} sem Ás`)
    assert.equal(e.nome, carta.nome, `${p} ${n}: o nome do efeito é o da carta`)
    assert.ok(e.rotulo && Number.isInteger(e.cor))
  }
  assert.equal(TODOS.length, 28)
})

test('combinação desconhecida cai no efeito genérico (não lança)', () => {
  const g = efeitoDoAs('ninguem', 'espadas')
  assert.equal(typeof g.fn, 'function')
  const f = criarCena()
  assert.equal(tocarEfeitoAs(f.cena, 'ninguem', 'copas', { x: 100, y: 100 }), true)
  f.soltar()
  assert.equal(f.vivos.size, 0)
})

// ---------- cada efeito ----------

for (const [p, n] of TODOS) {
  test(`${p} ${n} (${EFEITOS_ASES[p][n].nome}): cria, dura pouco e não deixa nada na cena`, () => {
    const f = criarCena()
    const sorteio = Math.random
    Math.random = () => assert.fail('o efeito não pode sortear (os dois lados veem o mesmo)')
    try {
      for (const dir of [1, -1]) assert.equal(tocarEfeitoAs(f.cena, p, n, { x: 300, y: 200, dir, alvo: { x: 600, y: 120 }, escala: 1 }), true)
    } finally {
      Math.random = sorteio
    }
    assert.ok(f.criados > 0, 'não desenhou nada')
    f.soltar()
    assert.ok(f.fimDoUltimo <= 1300, `dura ${f.fimDoUltimo} ms (o limite é ~1,2 s)`)
    assert.equal(f.vivos.size, 0, 'sobrou objeto na cena depois do vigia')
  })
}

test('os textos dos efeitos passam por semLigaduras', () => {
  for (const [p, n] of TODOS) {
    const f = criarCena()
    tocarEfeitoAs(f.cena, p, n, { x: 300, y: 200 })
    for (const t of f.textos) assert.equal(t, semLigaduras(t), `${p} ${n}: "${t}"`)
  }
})

test('mesmo efeito, mesmo desenho: duas execuções criam exatamente o mesmo', () => {
  for (const [p, n] of TODOS) {
    const a = criarCena()
    const b = criarCena()
    tocarEfeitoAs(a.cena, p, n, { x: 300, y: 200, dir: -1, alvo: { x: 100, y: 100 } })
    tocarEfeitoAs(b.cena, p, n, { x: 300, y: 200, dir: -1, alvo: { x: 100, y: 100 } })
    a.soltar()
    b.soltar()
    assert.deepEqual(a.log, b.log, `${p} ${n}`)
  }
})

// ---------- nunca quebra a partida ----------

test('cena que falha ao criar objetos: o efeito engole o erro e não deixa rastro', () => {
  for (const quebra of ['graphics', 'text', 'image', 'rectangle']) {
    for (const [p, n] of TODOS) {
      const f = criarCena({ quebra })
      assert.doesNotThrow(() => tocarEfeitoAs(f.cena, p, n, { x: 300, y: 200 }), `${p} ${n} sem ${quebra}`)
      assert.doesNotThrow(() => f.soltar())
      assert.equal(f.vivos.size, 0, `${p} ${n} sem ${quebra}: sobrou objeto`)
    }
  }
})

test('entradas ruins: cena nula, sem add, coordenadas inválidas, escala maluca', () => {
  assert.equal(tocarEfeitoAs(null, 'dess', 'espadas', { x: 1, y: 1 }), false)
  assert.equal(tocarEfeitoAs({}, 'dess', 'espadas', { x: 1, y: 1 }), false)
  assert.equal(tocarEfeitoAs(criarCena().cena, 'dess', 'espadas', {}), false)
  assert.equal(tocarEfeitoAs(criarCena().cena, 'dess', 'espadas', { x: NaN, y: 1 }), false)
  const f = criarCena()
  assert.doesNotThrow(() => tocarEfeitoAs(f.cena, 'dess', 'espadas', { x: 10, y: 10, escala: NaN }))
  assert.doesNotThrow(() => tocarEfeitoAs(f.cena, 'dess', 'espadas', { x: 10, y: 10, escala: 1e9 }))
  f.soltar()
  assert.equal(f.vivos.size, 0)
})

// ---------- sair da cena ----------

test('sair da cena (shutdown) recolhe tudo na hora; os timers que sobram não fazem nada', () => {
  const f = criarCena()
  for (const [p, n] of TODOS) tocarEfeitoAs(f.cena, p, n, { x: 300, y: 200 })
  assert.ok(f.vivos.size > 20)
  f.desligar()
  assert.equal(f.vivos.size, 0)
  const antes = f.criados
  assert.doesNotThrow(() => f.soltar())
  assert.equal(f.criados, antes, 'um timer antigo criou coisa depois do shutdown')
  // cena reaproveitada: o ouvinte de shutdown volta a ser registrado
  tocarEfeitoAs(f.cena, 'dess', 'espadas', { x: 1, y: 1 })
  assert.ok(f.vivos.size > 0)
  f.desligar()
  assert.equal(f.vivos.size, 0)
})

test('limparEfeitosAs encerra os disparos da cena', () => {
  const f = criarCena()
  tocarEfeitoAs(f.cena, 'berdly', 'ouros', { x: 300, y: 200 })
  assert.ok(f.vivos.size > 0)
  limparEfeitosAs(f.cena)
  assert.equal(f.vivos.size, 0)
  assert.doesNotThrow(() => limparEfeitosAs({}))
})

// ---------- reduzir animações ----------

test('"reduzir animações": só o rótulo e um anel parado (sem faíscas nem movimento)', () => {
  definirPref('reduzirMovimento', true)
  try {
    for (const [p, n] of TODOS) {
      const f = criarCena()
      tocarEfeitoAs(f.cena, p, n, { x: 300, y: 200 })
      assert.ok(f.textos.includes(semLigaduras(EFEITOS_ASES[p][n].rotulo)), `${p} ${n}`)
      assert.ok(f.criados <= 3, `${p} ${n}: ${f.criados} objetos`)
      assert.ok(f.log.every(([tipo]) => tipo !== 'particles' && tipo !== 'rectangle'))
      f.soltar()
      assert.equal(f.vivos.size, 0)
    }
  } finally {
    definirPref('reduzirMovimento', false)
  }
})

// ---------- ligação com as arenas ----------

test('asDaJogada: só o Ás especial que valeu (não anulado, não passou)', () => {
  const as = { personagem: 'dess', naipe: 'espadas', valor: 1 }
  assert.deepEqual(asDaJogada({ carta: as, especial: 'espelho' }), { personagem: 'dess', naipe: 'espadas' })
  assert.equal(asDaJogada({ carta: as, especial: 'espelho', anulada: true }), null)
  assert.equal(asDaJogada({ carta: null, especial: null, passou: true }), null)
  assert.equal(asDaJogada({ carta: { ...as, valor: 7 }, especial: null }), null)
  assert.equal(asDaJogada({ carta: { ...as, valor: 14 }, especial: null, super: true }), null)
  assert.equal(asDaJogada(null), null)
})

const cartaFalsa = (x, y) => ({ scene: {}, x, y, largura: 70, scaleX: 1.45 })

test('efeitoDoEspecial: ♦ vai na carta cortada; ♠ adiado espera a devolução; ♠ devolvendo usa efeitoDoReflexo', () => {
  const f = criarCena()
  const jogada = (naipe, especial) => ({ carta: { personagem: 'berdly', naipe, valor: 1 }, especial })
  const minha = cartaFalsa(100, 100)
  const dela = cartaFalsa(500, 300)
  assert.equal(efeitoDoEspecial(f.cena, jogada('ouros', 'anular'), minha, { alvoCarta: dela }), true)
  assert.equal(f.log[0][0], 'graphics')
  assert.equal(efeitoDoEspecial(f.cena, jogada('espadas', 'espelho'), minha, { adiar: true }), false)
  assert.equal(efeitoDoEspecial(f.cena, jogada('copas', 'segundaChance'), minha, { adiar: true }), true, 'adiar só vale para o ♠')
  assert.equal(efeitoDoEspecial(f.cena, { carta: null, passou: true }, minha), false)
  assert.equal(efeitoDoEspecial(f.cena, jogada('paus', 'roubo'), { scene: null, x: 1, y: 1 }), false, 'carta já destruída')
  assert.equal(efeitoDoReflexo(f.cena, jogada('espadas', 'espelho'), { x: 10, y: 10 }, { dir: -1, alvo: { x: 0, y: 0 } }), true)
  assert.equal(efeitoDoReflexo(f.cena, jogada('ouros', 'anular'), { x: 10, y: 10 }), false, 'só o ♠ reflete')
  assert.equal(efeitoDoReflexo(f.cena, jogada('espadas', 'espelho'), null), false)
  assert.ok(Math.abs(escalaDaCarta(minha) - (70 * 1.45) / 101) < 1e-9)
  assert.equal(escalaDaCarta(null), 70 / 101)
  f.soltar()
  assert.equal(f.vivos.size, 0)
})

test('as 4 arenas chamam o efeito na revelação e na devolução do ataque', () => {
  for (const arena of ['PvpArena', 'PvpArenaN', 'CoopArena', 'CoopArenaN']) {
    const fonte = readFileSync(new URL(`../../scenes/${arena}.js`, import.meta.url), 'utf8')
    assert.match(fonte, /from '\.\.\/pvp\/efeitosAses\.js'/, arena)
    assert.match(fonte, /efeitoDoEspecial\(this,/, `${arena}: revelação`)
    assert.match(fonte, /efeitoDoReflexo\(this,/, `${arena}: devolução`)
  }
})
