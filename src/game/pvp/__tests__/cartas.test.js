// node --test src/game/pvp/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { definirAtaque, juntos, sequencia, comCaixa } from '../../attacks/definir.js'
import { CARTAS, PERSONAGENS_PVP, NAIPES, CUSTOS, custoDoValor, ataqueDaCarta, danoDaCarta, ritmoDaCarta, inverterDaCarta, efeitosDaCarta, TEMAS } from '../cartas.js'

// Biblioteca falsa com a mesma forma de attacks/index.js: usa o definir.js de
// verdade (que roda em Node) e padrões vazios que só guardam a config
const NOMES = ['rain', 'sides', 'spiral', 'aimed', 'colunas', 'ondas', 'lasers', 'quicantes', 'anel', 'divisores', 'carrossel', 'foice', 'bombas', 'caminhonete', 'brasas', 'forcado']
const configs = []
const A = { juntos, sequencia, comCaixa }
for (const nome of NOMES) {
  const padrao = definirAtaque({ nome, padrao: {}, iniciar() {} })
  A[nome] = (cfg = {}) => {
    configs.push({ nome, cfg })
    return padrao(cfg)
  }
}

const todas = Object.values(CARTAS).flat()

test('formato da carta é exatamente o combinado', () => {
  const campos = ['id', 'personagem', 'naipe', 'valor', 'nome', 'descricao', 'custo'].sort()
  for (const c of todas) {
    assert.deepEqual(Object.keys(c).sort(), campos, c.id)
    assert.ok(NAIPES.includes(c.naipe), c.id)
    assert.ok(Number.isInteger(c.valor) && c.valor >= 1 && c.valor <= 13, c.id)
    assert.equal(c.id, `${c.personagem}-${c.naipe}-${c.valor}`)
    assert.ok(c.nome && c.descricao)
    assert.equal(c.custo, custoDoValor(c.valor))
  }
})

test('7 personagens, 16 a 20 cartas, ids únicos e um Ás por naipe', () => {
  assert.deepEqual(Object.keys(CARTAS).sort(), [...PERSONAGENS_PVP].sort())
  for (const p of PERSONAGENS_PVP) {
    const lista = CARTAS[p]
    assert.ok(lista.length >= 16 && lista.length <= 20, `${p}: ${lista.length}`)
    assert.equal(new Set(lista.map((c) => c.id)).size, lista.length)
    for (const n of NAIPES) assert.equal(lista.filter((c) => c.naipe === n && c.valor === 1).length, 1, `${p} Ás de ${n}`)
    assert.ok(TEMAS[p]?.formas?.length)
  }
})

test('proporções de naipe combinam com o papel', () => {
  const conta = (p, n) => CARTAS[p].filter((c) => c.naipe === n).length
  const maior = (p, n) => NAIPES.every((o) => o === n || conta(p, n) > conta(p, o))
  assert.ok(maior('ralsei', 'copas'))
  assert.ok(maior('noelle', 'copas'))
  assert.ok(maior('susie', 'espadas'))
  assert.ok(maior('dess', 'espadas'))
  assert.ok(maior('berdly', 'ouros'))
  assert.ok(maior('kris', 'ouros'))
  // asriel: equilibrado e com mais figuras que todos
  const figuras = (p) => CARTAS[p].filter((c) => c.valor >= 11).length
  assert.ok(NAIPES.every((n) => conta('asriel', n) === 5))
  assert.ok(PERSONAGENS_PVP.every((p) => p === 'asriel' || figuras('asriel') > figuras(p)))
})

test('tabela de custos', () => {
  assert.deepEqual([2, 3, 4].map(custoDoValor), [1, 1, 1])
  assert.deepEqual([5, 6, 7, 8].map(custoDoValor), [2, 2, 2, 2])
  assert.deepEqual([9, 10, 11].map(custoDoValor), [3, 3, 3])
  assert.equal(custoDoValor(12), 4)
  assert.equal(custoDoValor(13), 5)
  assert.equal(custoDoValor(1), CUSTOS[1])
})

test('toda carta vira um ataque válido (menos o Ás de copas), com 4-7 s ativos', () => {
  for (const c of todas) {
    const ataque = ataqueDaCarta(c, { ataques: A })
    if (c.naipe === 'copas' && c.valor === 1) {
      assert.equal(ataque, null)
      continue
    }
    assert.ok(ataque && typeof ataque.iniciar === 'function', c.id)
    // sequência: soma o tempo ativo das ondas (sem respiros nem troca de caixa)
    const ativa = ataque.filhos ? ataque.filhos.reduce((s, f) => s + f.ativa, 0) : ataque.ativa
    assert.ok(ativa >= 4000 && ativa <= 7000, `${c.id}: ativa ${ativa}`)
  }
})

test('ataqueDaCarta exige a biblioteca injetada', () => {
  assert.throws(() => ataqueDaCarta(CARTAS.kris[1], {}), /contexto\.ataques/)
})

test('valor maior = mais forte (mais rápido, mais denso, mais longo, mais dano)', () => {
  const fraca = CARTAS.susie.find((c) => c.id === 'susie-espadas-2') // colunas
  const forte = CARTAS.susie.find((c) => c.id === 'susie-espadas-6') // colunas
  configs.length = 0
  const a1 = ataqueDaCarta(fraca, { ataques: A })
  const c1 = configs.at(-1).cfg
  const a2 = ataqueDaCarta(forte, { ataques: A })
  const c2 = configs.at(-1).cfg
  assert.ok(c2.velocidade > c1.velocidade)
  assert.ok(c2.intervalo < c1.intervalo)
  assert.ok(a2.ativa > a1.ativa)
  assert.ok(danoDaCarta(forte) > danoDaCarta(fraca))
})

test('copas manda só ataque fraco; espadas dá mais dano que ouros', () => {
  for (const c of todas.filter((x) => x.naipe === 'copas' && x.valor > 1)) {
    assert.equal(danoDaCarta(c), 2)
    assert.ok(efeitosDaCarta(c), c.id)
  }
  const ks = todas.filter((c) => c.valor === 13 && c.naipe === 'espadas')
  const ko = todas.filter((c) => c.valor === 13 && c.naipe === 'ouros')
  assert.ok(Math.min(...ks.map(danoDaCarta)) > Math.max(...ko.map(danoDaCarta)))
})

test('ouros acelera as balas e as figuras de ouros invertem controles', () => {
  const ouro = CARTAS.berdly.find((c) => c.valor === 13 && c.naipe === 'ouros')
  assert.ok(ritmoDaCarta(ouro).velocidade > 1)
  assert.ok(inverterDaCarta(ouro) > 0)
  const espada = CARTAS.berdly.find((c) => c.naipe === 'espadas' && c.valor === 10)
  assert.equal(ritmoDaCarta(espada).velocidade, 1)
  assert.equal(inverterDaCarta(espada), 0)
})

test('caixaFixa tira a mudança de caixa', () => {
  const c = CARTAS.kris.find((x) => x.id === 'kris-ouros-5') // caixa apertada
  assert.ok(ataqueDaCarta(c, { ataques: A }).caixa)
  assert.equal(ataqueDaCarta(c, { ataques: A, caixaFixa: true }).caixa, null)
})
