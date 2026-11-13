// node --test src/game/__tests__/cartasEstilos.test.js
// ESTILOS DA FRENTE DA CARTA e VERSOS ILUSTRADOS (0016; src/game/cosmeticos/frentes.js, versos.js): cada
// estilo e cada verso tem desenho e pinta sem erro (num canvas de mentira), a textura é feita UMA vez por
// jogo, o tema monta a face com todos os naipes e valores, a animação (Sakura, Holográfica) se desliga com a
// carta e com a cena, "reduzir animações" deixa tudo parado e o registro bate com o catálogo do baú.
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { ESTILOS_FRENTE, desenharFrente, miniaturaFrente, texturaFundo, temRenderizadorFrente } from '../cosmeticos/frentes.js'
import { VERSOS_ILUSTRADOS, desenharVerso, texturaVerso, temRenderizadorVerso } from '../cosmeticos/versos.js'
import { previa, miniatura, temRenderizador } from '../cosmeticos/registro.js'
import { itensDoSlot, PADRAO_REGISTRO } from '../../lib/cosmeticos.js'
import { definirPref } from '../preferencias.js'

afterEach(() => definirPref('reduzirMovimento', false))

// canvas 2D de mentira: aceita tudo e conta as chamadas
function contexto2d() {
  const valores = {}
  const conta = { chamadas: 0 }
  const gradiente = { addColorStop() {} }
  return new Proxy(valores, {
    get(alvo, nome) {
      if (nome === 'conta') return conta
      if (nome in alvo) return alvo[nome]
      return (...a) => {
        conta.chamadas++
        for (const x of a) if (typeof x === 'number' && !Number.isFinite(x)) throw new Error(`${String(nome)} com número inválido`)
        return gradiente
      }
    },
    set(alvo, nome, v) {
      alvo[nome] = v
      return true
    },
  })
}

// objeto de jogo de mentira (encadeável), registra criados e destruídos
function cenaFalsa() {
  const eventos = new EventEmitter()
  eventos.setMaxListeners(0)
  const texturas = new Map()
  const criados = []
  const objeto = () => {
    const filhos = []
    const o = new Proxy({}, {
      get(alvo, nome) {
        if (nome in alvo) return alvo[nome]
        if (nome === 'active') return !alvo.destruido
        if (nome === 'visible') return true
        if (nome === 'add') return (x) => (filhos.push(...[].concat(x)), o)
        if (nome === 'destroy') return () => {
          alvo.destruido = true
          filhos.forEach((f) => f.destroy?.())
        }
        if (nome === 'then') return undefined
        if (typeof nome === 'symbol') return undefined
        return () => o
      },
      set(alvo, nome, v) {
        alvo[nome] = v
        return true
      },
    })
    criados.push(o)
    return o
  }
  const cena = {
    events: eventos,
    criados,
    pintadas: [],
    textures: {
      exists: (k) => texturas.has(k),
      createCanvas: (k) => {
        const ctx = contexto2d()
        const t = { context: ctx, refresh() {}, setFilter() {} }
        texturas.set(k, t)
        cena.pintadas.push(k)
        return t
      },
      remove: (k) => texturas.delete(k),
      get: (k) => ({ getSourceImage: () => (texturas.has(k) ? {} : null) }),
    },
    add: { image: objeto, container: objeto, graphics: objeto, text: objeto },
  }
  return cena
}

// as formas dos naipes como a Carta entrega (polígonos e círculos de raio 1)
const p = (pts) => ({ tipo: 'poli', pontos: pts.map(([x, y]) => ({ x, y })) })
const FORMAS = {
  espadas: [p([[0, -1], [0.9, 0.3], [0, 0.4], [-0.9, 0.3]]), p([[0, 0.2], [0.4, 1], [-0.4, 1]])],
  copas: [p([[0, 0.95], [-1, -0.2], [-0.5, -0.9], [0, -0.4], [0.5, -0.9], [1, -0.2]])],
  ouros: [p([[0, -1], [0.8, 0], [0, 1], [-0.8, 0]])],
  paus: [{ tipo: 'circulo', x: 0, y: -0.45, r: 0.4 }, { tipo: 'circulo', x: -0.45, y: 0.12, r: 0.4 }, { tipo: 'circulo', x: 0.45, y: 0.12, r: 0.4 }, p([[0, 0], [0.35, 1], [-0.35, 1]])],
}

// uma Carta de mentira que monta a face como a de verdade (chama todos os ganchos do tema)
function cartaFalsa(cena, dados) {
  const frente = cena.add.container()
  const carta = {
    dados,
    largura: 70,
    altura: 100,
    corPersonagem: 0x4aa8ff,
    active: true,
    frente,
    verso: cena.add.container(),
    temas: [],
    texto: () => cena.add.text(),
    naipe(g, naipe, x, y, r, cor, alpha, inv) {
      if (this.tema?.naipe) this.tema.naipe(g, naipe, x, y, r, cor, alpha, inv, this.ctx)
    },
    montarFrente(tema) {
      this.tema = tema
      this.temas.push(tema)
      const g = cena.add.graphics()
      const ctx = (this.ctx = { scene: cena, carta: this, g, w: 70, h: 100, u: 1, hw: 35, hh: 50, C: tema.cores ?? {}, cor: 0xd42340, dados, super: dados.valor === 14, formas: FORMAS, adicionar: (o) => frente.add(o), camadaAnim: cena.add.container(), camadaSobre: cena.add.container() })
      tema.fundo?.(ctx)
      tema.decorar?.(ctx)
      if (!ctx.super) tema.miolo?.(ctx, -7)
      tema.faixa?.(ctx, 21, 16)
      for (const n of Object.keys(FORMAS)) for (const r of [4, 5.6, 12.4]) for (const inv of [false, true]) this.naipe(g, n, 10, 10, r, 0x112233, 1, inv)
      tema.sobre?.(ctx)
      this.anim = tema.animar?.(ctx) ?? null
    },
  }
  return carta
}

const ESTILOS = ESTILOS_FRENTE.slice(1)
const VALORES = [1, 4, 7, 10, 11, 12, 13, 14]
const NAIPES = ['espadas', 'copas', 'ouros', 'paus']

test('registro: o 0 é a clássica; ids kebab-case; todo estilo e verso tem desenho; bate com o catálogo do baú', () => {
  assert.equal(ESTILOS_FRENTE[0].id, PADRAO_REGISTRO.frente)
  for (const i of [...ESTILOS_FRENTE, ...VERSOS_ILUSTRADOS]) assert.match(i.id, /^[a-z0-9]+(-[a-z0-9]+)*$/)
  for (const i of ESTILOS_FRENTE) assert.ok(temRenderizadorFrente(i.id) && temRenderizador('frente', i.id), i.id)
  for (const i of VERSOS_ILUSTRADOS) assert.ok(temRenderizadorVerso(i.id) && temRenderizador('verso', i.id), i.id)
  assert.ok(ESTILOS.length >= 8 && VERSOS_ILUSTRADOS.length >= 10)
  const doBau = (slot) => itensDoSlot(slot).map((i) => `${i.registro}:${i.raridade}`).sort()
  assert.deepEqual(doBau('frente'), ESTILOS.map((i) => `${i.id}:${i.raridade}`).sort())
  assert.deepEqual(doBau('verso'), VERSOS_ILUSTRADOS.map((i) => `${i.id}:${i.raridade}`).sort())
  assert.equal(temRenderizadorFrente('frente-inventada'), false)
})

test('cada fundo de estilo e cada verso pinta sem erro, UMA textura por jogo', () => {
  const cena = cenaFalsa()
  for (const { id } of ESTILOS) {
    assert.equal(texturaFundo(cena, id), `frente-fundo-${id}`)
    assert.equal(texturaFundo(cena, id), `frente-fundo-${id}`)
    assert.ok(miniaturaFrente(cena, id))
  }
  assert.ok(miniaturaFrente(cena, 'frente-classica'), 'a clássica também tem miniatura (Coleção)')
  for (const { id } of VERSOS_ILUSTRADOS) {
    assert.equal(texturaVerso(cena, id), `verso-arte-${id}`)
    assert.equal(miniatura(cena, 'verso', id), `verso-arte-${id}`)
  }
  assert.equal(new Set(cena.pintadas).size, cena.pintadas.length, 'nenhuma textura pintada duas vezes')
  assert.equal(texturaFundo(cena, 'frente-inventada'), null)
})

test('um desenho que lança não deixa textura pela metade (e o erro sobe para a ponte)', () => {
  const cena = cenaFalsa()
  cena.textures.createCanvas = (k) => ({ context: new Proxy({}, { get: () => () => { throw new Error('canvas quebrado') } }), refresh() {}, k })
  assert.throws(() => texturaFundo(cena, 'frente-tarot'), /canvas quebrado/)
  assert.equal(cena.textures.exists('frente-fundo-frente-tarot'), false)
  const carta = cartaFalsa(cena, { naipe: 'copas', valor: 1, nome: 'x', custo: 1 })
  assert.throws(() => desenharFrente(cena, carta, 'frente-tarot'), /canvas quebrado/)
})

test('o tema monta a face com todos os naipes, valores (Ás, figuras, ★ SUPER) e nomes', () => {
  const cena = cenaFalsa()
  for (const { id } of ESTILOS) {
    for (const naipe of NAIPES) {
      for (const valor of VALORES) {
        const carta = cartaFalsa(cena, { naipe, valor, nome: 'Escudo de Fumaça Espessa', custo: 3, personagem: 'kris' })
        assert.equal(desenharFrente(cena, carta, id), true, id)
        assert.ok(carta.temas[0].cores?.vermelho && carta.temas[0].cores?.escuro !== undefined || id === 'frente-tarot', `${id}: cores do naipe`)
        carta.anim?.destroy()
      }
    }
  }
  assert.equal(desenharFrente(cena, cartaFalsa(cena, { naipe: 'copas', valor: 2 }), 'frente-inventada'), false)
  assert.equal(desenharFrente(cena, {}, 'frente-tarot'), false, 'sem montarFrente: não desenha')
})

test('vermelho e escuro continuam distintos em todos os estilos (cor do naipe)', () => {
  const luz = (c) => 0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)
  const cena = cenaFalsa()
  for (const { id } of ESTILOS) {
    const carta = cartaFalsa(cena, { naipe: 'copas', valor: 2 })
    desenharFrente(cena, carta, id)
    const { vermelho = 0xd42340, escuro = 0x1f1b2e } = carta.temas[0].cores ?? {}
    const r = (vermelho >> 16) & 255
    assert.ok(r > ((vermelho >> 8) & 255) + 80, `${id}: o vermelho é vermelho`)
    assert.ok(Math.abs(luz(vermelho) - luz(escuro)) > 40 || ((escuro >> 16) & 255) < r - 100, `${id}: escuro e vermelho se separam`)
  }
})

test('verso ilustrado: põe a imagem na carta; id desconhecido não desenha', () => {
  const cena = cenaFalsa()
  const carta = cartaFalsa(cena, { naipe: 'espadas', valor: 2 })
  for (const { id } of VERSOS_ILUSTRADOS) assert.equal(desenharVerso(cena, carta, id), true)
  assert.equal(desenharVerso(cena, carta, 'verso-inventado'), false)
})

test('animação (Sakura, Holográfica): um ouvinte por carta, que some com a carta e com a cena', () => {
  for (const id of ['frente-sakura', 'frente-holografica']) {
    const cena = cenaFalsa()
    const carta = cartaFalsa(cena, { naipe: 'copas', valor: 5 })
    desenharFrente(cena, carta, id)
    assert.ok(carta.anim, `${id} anima`)
    assert.equal(cena.events.listenerCount('update'), 1)
    for (let i = 0; i < 120; i++) cena.events.emit('update', i * 16, 16)
    carta.anim.destroy()
    assert.equal(cena.events.listenerCount('update') + cena.events.listenerCount('shutdown'), 0, `${id}: sobrou ouvinte`)
    // a cena fechando (reaproveitada depois) também desliga
    const c2 = cartaFalsa(cena, { naipe: 'paus', valor: 3 })
    desenharFrente(cena, c2, id)
    cena.events.emit('shutdown')
    assert.equal(cena.events.listenerCount('update'), 0)
    // a carta destruída: o próximo quadro desliga
    const c3 = cartaFalsa(cena, { naipe: 'paus', valor: 3 })
    desenharFrente(cena, c3, id)
    c3.active = false
    cena.events.emit('update', 0, 16)
    assert.equal(cena.events.listenerCount('update'), 0)
  }
})

test('"reduzir animações": nada anima (pétalas e brilho parados)', () => {
  definirPref('reduzirMovimento', true)
  const cena = cenaFalsa()
  for (const id of ['frente-sakura', 'frente-holografica']) {
    const carta = cartaFalsa(cena, { naipe: 'copas', valor: 5 })
    desenharFrente(cena, carta, id)
    assert.equal(carta.anim, null, id)
  }
  assert.equal(cena.events.listenerCount('update'), 0)
})

test('prévias (Coleção, roleta, galeria): sem a classe Carta, a miniatura; destroy limpa tudo', () => {
  const cena = cenaFalsa()
  for (const [tipo, lista] of [['frente', ESTILOS_FRENTE], ['verso', VERSOS_ILUSTRADOS]]) {
    for (const { id } of lista) {
      const h = previa(cena, tipo, id, 100, 100, 96)
      assert.equal(typeof h.destroy, 'function')
      h.destroy()
    }
  }
  assert.equal(cena.events.listenerCount('update'), 0)
})
