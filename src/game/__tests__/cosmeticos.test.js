// node --test src/game/__tests__/cosmeticos.test.js
// Cosméticos (src/game/cosmeticos/): integridade do registro, receitas sonoras dentro do limite e
// limpeza total (ouvintes e objetos) ao destruir. Usa uma cena de mentira que registra tudo o que
// os cosméticos criam, sem precisar do Phaser nem de navegador.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import {
  SONS_DANO, EFEITOS_CARTA, LANCAMENTOS, MOLDURAS_ANIMADAS, RARIDADES, CATALOGO_COSMETICOS, temRenderizador,
  aplicarEfeitoCarta, animarLancamento, desenharMoldura, previa, tocarSomDano,
} from '../cosmeticos/registro.js'
import { receitas, criarKit, DURACAO_MAX } from '../cosmeticos/sons.js'
import { definirPref } from '../preferencias.js'
import { MAX_PARTICULAS, ERROS } from '../cosmeticos/util.js'

// ---------- cena de mentira ----------
const NUMEROS = { x: 0, y: 0, width: 70, height: 100, displayWidth: 70, displayHeight: 100, alpha: 1, scaleX: 1, scaleY: 1, rotation: 0, angle: 0, depth: 0 }

function criarCena() {
  const eventos = new EventEmitter()
  eventos.setMaxListeners(0)
  const criados = []
  const objeto = (tipo) => {
    const dados = { ...NUMEROS }
    const filhos = []
    const emissor = new EventEmitter()
    let proxy
    const base = function () {}
    proxy = new Proxy(base, {
      get(_, nome) {
        if (nome === 'tipo') return tipo
        if (nome === 'destruido') return dados.destruido === true
        if (nome === 'active') return dados.destruido !== true
        if (nome === 'isDestroyed') return dados.destruido === true
        if (nome === 'scene') return dados.destruido ? undefined : cena
        if (nome === 'visible') return dados.visible ?? true
        if (nome === 'then') return undefined
        if (nome === 'destroy') return () => {
          if (dados.destruido) return
          dados.destruido = true
          emissor.emit('destroy')
          filhos.forEach((f) => f.destroy?.())
        }
        if (nome === 'add') return (x) => {
          for (const f of [].concat(x)) filhos.push(f)
          return proxy
        }
        if (nome === 'removeAll') return (destruir) => {
          if (destruir) filhos.forEach((f) => f.destroy?.())
          filhos.length = 0
        }
        if (nome === 'once' || nome === 'on' || nome === 'off') return (...a) => (emissor[nome](...a), proxy)
        if (nome === 'getWorldTransformMatrix') return undefined
        if (nome in dados) return dados[nome]
        if (typeof nome === 'symbol') return undefined
        return (...a) => {
          if (/^set(X|Y|Rotation|Alpha|Depth|ScaleX|ScaleY)$/.test(nome)) dados[nome.slice(3).toLowerCase().replace(/^./, (c) => c)] = a[0]
          if (nome === 'setPosition') [dados.x, dados.y] = a
          if (nome === 'setVisible') dados.visible = a[0]
          if (nome === 'setScale') [dados.scaleX, dados.scaleY] = [a[0], a[1] ?? a[0]]
          return proxy
        }
      },
      set(_, nome, valor) {
        dados[nome] = valor
        return true
      },
    })
    criados.push(proxy)
    return proxy
  }
  const cena = {
    events: eventos,
    criados,
    textures: { exists: () => true, createCanvas: () => null },
    add: {
      container: () => objeto('container'),
      graphics: () => objeto('graphics'),
      image: () => objeto('image'),
      zone: () => objeto('zone'),
    },
  }
  return cena
}

const passar = (cena, quadros = 60, dt = 16) => {
  for (let i = 0; i < quadros; i++) cena.events.emit('update', i * dt, dt)
  assert.deepEqual(ERROS.splice(0), [], 'um quadro lançou erro')
}
const ouvintes = (cena) => cena.events.listenerCount('update') + cena.events.listenerCount('shutdown') + cena.events.listenerCount('destroy')
const todosDestruidos = (cena) => cena.criados.every((o) => o.destruido)

// ---------- registro ----------
const TIPOS = { som: SONS_DANO, efeito: EFEITOS_CARTA, lancamento: LANCAMENTOS, moldura: MOLDURAS_ANIMADAS }
const PADROES = { som: 'dano-padrao', efeito: 'efeito-nenhum', lancamento: 'lancamento-padrao', moldura: 'moldura-nenhuma' }

for (const [tipo, lista] of Object.entries(TIPOS)) {
  test(`registro ${tipo}: ids únicos kebab-case, padrão no índice 0, raridades válidas, todos com renderizador`, () => {
    assert.equal(lista[0].id, PADROES[tipo])
    assert.equal(lista[0].raridade, 'comum')
    assert.equal(new Set(lista.map((i) => i.id)).size, lista.length, 'ids repetidos')
    for (const i of lista) {
      assert.match(i.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, i.id)
      assert.ok(RARIDADES.includes(i.raridade), `${i.id}: raridade ${i.raridade}`)
      assert.ok(i.nome && typeof i.nome === 'string')
      assert.ok(temRenderizador(tipo, i.id), `${i.id} sem renderizador`)
    }
    assert.equal(CATALOGO_COSMETICOS[tipo], lista)
  })
}

test('os ids combinados com o servidor existem', () => {
  const ids = (l) => l.map((i) => i.id)
  for (const id of ['dano-latido', 'dano-pato', 'dano-buzina', 'dano-vidro', 'dano-moeda', 'dano-boing', 'dano-miau', 'dano-sino', 'dano-cabra', 'dano-laser']) assert.ok(ids(SONS_DANO).includes(id), id)
  for (const id of ['efeito-chamas', 'efeito-holografico', 'efeito-arco-iris', 'efeito-brilho', 'efeito-bolhas', 'efeito-folhas', 'efeito-sombra', 'efeito-eletrico', 'efeito-pixel-fogo', 'efeito-estrelas']) assert.ok(ids(EFEITOS_CARTA).includes(id), id)
  for (const id of ['lancamento-explosao', 'lancamento-arco-iris-borboletas', 'lancamento-tsunami', 'lancamento-confete', 'lancamento-raio', 'lancamento-buraco-negro', 'lancamento-sakura', 'lancamento-meteoro']) assert.ok(ids(LANCAMENTOS).includes(id), id)
  for (const id of ['moldura-anim-fogo', 'moldura-anim-arco-iris', 'moldura-anim-glitch', 'moldura-anim-coracoes', 'moldura-anim-estrelas', 'moldura-anim-slime', 'moldura-anim-neon', 'moldura-anim-gelo', 'moldura-anim-gerson', 'moldura-anim-galaxia']) assert.ok(ids(MOLDURAS_ANIMADAS).includes(id), id)
})

// ---------- sons ----------
function contextoFalso() {
  const nos = { osc: 0, ruido: 0, ganhos: 0, fim: 0 }
  const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, value: 0 })
  const no = () => ({ connect: (x) => x, start() {}, stop(t) { nos.fim = Math.max(nos.fim, t) }, frequency: param(), gain: param(), Q: param(), type: '', loop: false, buffer: null })
  return {
    nos,
    sampleRate: 8000,
    currentTime: 0,
    createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }),
    createOscillator: () => (nos.osc++, no()),
    createBufferSource: () => (nos.ruido++, no()),
    createGain: () => (nos.ganhos++, no()),
    createBiquadFilter: () => no(),
  }
}

for (const [id, receita] of Object.entries(receitas)) {
  test(`som ${id}: dura no máximo ${DURACAO_MAX * 1000} ms e tem fonte sonora`, () => {
    const c = contextoFalso()
    receita(criarKit(c, c.createGain(), 0))
    assert.ok(c.nos.osc + c.nos.ruido > 0)
    assert.ok(c.nos.fim <= DURACAO_MAX + 0.05, `${id} termina em ${c.nos.fim}s`)
  })
}

test('tocarSomDano sem contexto de áudio (Node) não lança', () => {
  assert.doesNotThrow(() => {
    tocarSomDano({}, 'dano-latido')
    tocarSomDano({}, 'id-que-nao-existe')
    tocarSomDano(null)
  })
})

// ---------- efeitos de carta ----------
const alvoDe = (cena) => {
  const a = Object.assign(cena.add.container(), { largura: 70, altura: 100 })
  a.x = 100
  a.y = 100
  return a
}

for (const { id } of EFEITOS_CARTA.slice(1)) {
  test(`efeito ${id}: roda, segue o alvo e destroy() limpa ouvintes e objetos`, () => {
    const cena = criarCena()
    const alvo = alvoDe(cena)
    const base = ouvintes(cena)
    const e = aplicarEfeitoCarta(cena, alvo, id)
    assert.ok(ouvintes(cena) > base)
    passar(cena, 90)
    e.destroy()
    e.destroy()
    assert.equal(ouvintes(cena), base, 'sobrou ouvinte')
    assert.ok(cena.criados.filter((o) => o !== alvo).every((o) => o.destruido), 'sobrou objeto')
  })

  test(`efeito ${id}: some sozinho no shutdown da cena e se o alvo é destruído`, () => {
    const cena = criarCena()
    const alvo = alvoDe(cena)
    aplicarEfeitoCarta(cena, alvo, id)
    passar(cena, 5)
    cena.events.emit('shutdown')
    assert.equal(ouvintes(cena), 0)
    const cena2 = criarCena()
    const alvo2 = alvoDe(cena2)
    aplicarEfeitoCarta(cena2, alvo2, id)
    alvo2.destroy()
    passar(cena2, 3)
    assert.equal(ouvintes(cena2), 0)
    assert.ok(cena2.criados.filter((o) => o !== alvo2).every((o) => o.destruido))
  })

  test(`efeito ${id}: no máximo ${MAX_PARTICULAS} partículas (imagens)`, () => {
    const cena = criarCena()
    aplicarEfeitoCarta(cena, alvoDe(cena), id)
    assert.ok(cena.criados.filter((o) => o.tipo === 'image').length <= MAX_PARTICULAS)
  })
}

test('efeito desconhecido / nenhum: devolve handle inofensivo', () => {
  const cena = criarCena()
  for (const id of ['efeito-nenhum', 'nao-existe', undefined]) {
    const e = aplicarEfeitoCarta(cena, alvoDe(cena), id)
    assert.doesNotThrow(() => e.destroy())
  }
  assert.equal(ouvintes(cena), 0)
})

// ---------- lançamentos ----------
for (const { id } of LANCAMENTOS) {
  test(`lançamento ${id}: termina em até 900 ms, resolve e limpa tudo`, async () => {
    const cena = criarCena()
    let resolvido = false
    const p = animarLancamento(cena, { x: 100, y: 300, alvoX: 400, alvoY: 120, cor: 0xff00ff }, id).then(() => (resolvido = true))
    assert.ok(cena.criados.filter((o) => o.tipo === 'image').length <= MAX_PARTICULAS + 8)
    let t = 0
    while (!resolvido && t < 1100) {
      cena.events.emit('update', t, 16)
      assert.deepEqual(ERROS.splice(0), [], 'um quadro lançou erro')
      t += 16
      await Promise.resolve()
    }
    await p
    assert.ok(t <= 920, `${id} levou ${t} ms`)
    assert.equal(ouvintes(cena), 0)
    assert.ok(todosDestruidos(cena))
  })
}

test('lançamento: shutdown no meio resolve a promessa e limpa; id desconhecido usa o padrão; erro não rejeita', async () => {
  const cena = criarCena()
  const p = animarLancamento(cena, { x: 0, y: 0, alvoX: 50, alvoY: 50 }, 'lancamento-tsunami')
  passar(cena, 5)
  cena.events.emit('shutdown')
  await p
  assert.equal(ouvintes(cena), 0)
  const c2 = criarCena()
  const p2 = animarLancamento(c2, { x: 0, y: 0 }, 'nao-existe')
  passar(c2, 80, 16)
  await p2
  assert.equal(ouvintes(c2), 0)
  await animarLancamento(null, {}, 'lancamento-raio')
  await animarLancamento({ add: { container() { throw new Error('quebrou') } }, events: new EventEmitter(), textures: { exists: () => true } }, {}, 'lancamento-raio')
})

// ---------- molduras ----------
for (const { id } of MOLDURAS_ANIMADAS) {
  test(`moldura ${id}: container que se limpa ao ser destruído`, () => {
    const cena = criarCena()
    const base = ouvintes(cena)
    const m = desenharMoldura(cena, 50, 50, 64, id)
    assert.ok(m)
    passar(cena, 120)
    assert.ok(cena.criados.filter((o) => o.tipo === 'image').length <= MAX_PARTICULAS + 8)
    m.destroy()
    assert.equal(ouvintes(cena), base)
    assert.ok(todosDestruidos(cena))
  })
}

// ---------- prévia ----------
test('previa de cada tipo roda e destroy() limpa', () => {
  const casos = [['som', 'dano-latido'], ['efeito', 'efeito-chamas'], ['lancamento', 'lancamento-confete'], ['moldura', 'moldura-anim-fogo'], ['efeito', 'efeito-nenhum'], ['moldura', 'moldura-nenhuma']]
  for (const [tipo, id] of casos) {
    const cena = criarCena()
    const p = previa(cena, tipo, id, 100, 100, 80)
    passar(cena, 150, 16)
    if (tipo === 'som') assert.equal(typeof p.tocar, 'function')
    p.destroy()
    assert.equal(ouvintes(cena), 0, `${tipo} ${id}`)
    assert.ok(todosDestruidos(cena), `${tipo} ${id}`)
  }
  assert.doesNotThrow(() => previa(criarCena(), 'tipo-estranho', 'x', 0, 0).destroy())
})

test('com "reduzir animações" tudo continua funcionando (e dentro dos limites)', async () => {
  definirPref('reduzirMovimento', true)
  try {
    for (const { id } of EFEITOS_CARTA) {
      const cena = criarCena()
      const e = aplicarEfeitoCarta(cena, alvoDe(cena), id)
      passar(cena, 60)
      e.destroy()
      assert.equal(ouvintes(cena), 0, id)
    }
    for (const { id } of LANCAMENTOS) {
      const cena = criarCena()
      const p = animarLancamento(cena, { x: 0, y: 0, alvoX: 200, alvoY: 100 }, id)
      passar(cena, 70)
      await p
      assert.equal(ouvintes(cena), 0, id)
    }
    for (const { id } of MOLDURAS_ANIMADAS) {
      const cena = criarCena()
      desenharMoldura(cena, 0, 0, 64, id)
      passar(cena, 60)
    }
  } finally {
    definirPref('reduzirMovimento', false)
  }
})
