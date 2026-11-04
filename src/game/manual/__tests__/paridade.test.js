// node --test src/game/manual/__tests__/paridade.test.js
// O Manual do Ralsei usa as REGRAS REAIS: aqui a classe Balas (entities/Bullets.js) e o Heart
// (entities/Heart.js) de verdade rodam lado a lado com o manual (manual/onda.js, pagina1.js) e os
// padrões da página 2 (manual/padroes.js), com o mesmo joystick e os mesmos dt. Posição de cada bala,
// do coração, quando a bala some e o quadro do acerto têm de bater.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { CORACAO } from '../../constants.js'
import { criarOnda, moverCoracao } from '../onda.js'
import { criarRoteiro, pilotoDeDesvio, LICOES } from '../padroes.js'
import { criarPagina1 } from '../pagina1.js'
import { cenaDeMentira, caixaDeMentira } from './apoio/cenaDeMentira.mjs'

register('./apoio/ganchos.mjs', import.meta.url) // `phaser` -> Phaser de mentira (só lógica)
const { default: Balas } = await import('../../entities/Bullets.js')
const { default: Heart } = await import('../../entities/Heart.js')

const CAIXA = { esquerda: 440, direita: 780, topo: 148, base: 348 }
const DTS = [16, 17, 16, 33, 16, 8, 17] // dt variado, como num jogo de verdade

function reais(caixa = CAIXA, inicio = { x: 610, y: 248 }) {
  const cena = cenaDeMentira()
  const cx = caixaDeMentira(caixa)
  const balas = new Balas(cena, cx)
  const heart = new Heart(cena, cx, 0xff0000, 0)
  heart.mostrar(inicio.x, inicio.y)
  return { balas, heart }
}

const perto = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} != ${b}`)

function comparar(real, onda, coracao, quadro) {
  assert.equal(real.balas.lista.length, onda.lista.length, `quadro ${quadro}: quantas balas vivas`)
  real.balas.lista.forEach((b, i) => {
    const m = onda.lista[i]
    perto(b.x, m.x, `quadro ${quadro} bala ${i} x`)
    perto(b.y, m.y, `quadro ${quadro} bala ${i} y`)
    assert.equal(b.aviso, m.aviso, `quadro ${quadro} bala ${i} aviso`)
  })
  perto(real.heart.x, coracao.x, `quadro ${quadro} coração x`)
  perto(real.heart.y, coracao.y, `quadro ${quadro} coração y`)
}

// roda um roteiro da página 2 nos dois lados; joy(t, estado) decide o movimento
function rodarLadoALado(id, joyDe, { duracao } = {}) {
  const r1 = criarRoteiro(id, CAIXA, { duracao })
  const r2 = criarRoteiro(id, CAIXA, { duracao })
  const real = reais()
  const onda = criarOnda(CAIXA)
  const c = { x: 610, y: 248 }
  let t = 0
  let quadro = 0
  let acertoReal = null
  let acertoManual = null
  while (t < r1.duracao && !acertoReal && !acertoManual) {
    const dt = DTS[quadro % DTS.length]
    const joy = joyDe(t, onda, c)
    real.heart.update(joy, CORACAO.velocidadePadrao, dt)
    moverCoracao(c, joy, CORACAO.velocidadePadrao, dt, CAIXA)
    t += dt
    for (const o of r1.gerar(t, { x: real.heart.x, y: real.heart.y })) real.balas.criar({ ...o, extra: undefined })
    for (const o of r2.gerar(t, c)) onda.bala(o)
    real.balas.atualizar(dt, [real.heart], (h, b) => (acertoReal ??= { quadro, i: real.balas.lista.indexOf(b) }, true), () => {})
    const m = onda.passo(dt, { x: c.x, y: c.y, hitbox: CORACAO.hitbox })
    if (m) acertoManual = { quadro, i: onda.lista.indexOf(m) }
    if (!acertoReal && !acertoManual) comparar(real, onda, c, quadro)
    quadro++
  }
  return { acertoReal, acertoManual, quadros: quadro }
}

const zigueZague = (t) => ({ x: Math.round(100 * Math.sin(t / 650)), y: Math.round(100 * Math.cos(t / 1050)) })

for (const { id } of LICOES) {
  test(`página 2, ${id}: Balas e Heart reais = manual (posições, sumiço e acerto), andando em zigue-zague`, () => {
    const r = rodarLadoALado(id, zigueZague)
    assert.deepEqual(r.acertoManual, r.acertoReal, 'o acerto acontece no mesmo quadro, pela mesma bala')
    assert.ok(r.quadros > 50)
  })

  test(`página 2, ${id}: parado no meio, o acerto é o mesmo nos dois`, () => {
    const r = rodarLadoALado(id, () => ({ x: 0, y: 0 }))
    assert.ok(r.acertoReal, 'ficar parado não é seguro (os padrões pedem movimento)')
    assert.deepEqual(r.acertoManual, r.acertoReal)
  })

  test(`página 2, ${id}: desviando bem (o piloto da demo), nenhum dos dois acerta`, () => {
    const r = rodarLadoALado(id, (t, onda, c) => pilotoDeDesvio(onda.lista, c, CAIXA, CORACAO.velocidadePadrao))
    assert.equal(r.acertoReal, null)
    assert.equal(r.acertoManual, null)
  })
}

test('página 1: as 6 bolinhas do desvio andam e acertam igual às Balas reais', () => {
  for (const joyDe of [() => ({ x: 0, y: 0 }), zigueZague, (t) => ({ x: t % 2000 < 1000 ? 100 : -100, y: 30 })]) {
    const p = criarPagina1({ caixa: CAIXA })
    p.etapa = 'desviar' // direto ao desvio (o resto da página não tem bala)
    p.tempoEtapa = 0
    const real = reais(CAIXA, p.coracao)
    // cada bala que a página cria nasce também nas Balas reais, com as mesmas opções
    const criar = p.onda.bala
    p.onda.bala = (o) => {
      real.balas.criar({ ...o })
      return criar(o)
    }
    let acertoReal = null
    let quadro = 0
    let t = 0
    while (p.etapa === 'desviar' && quadro < 2000) {
      const dt = DTS[quadro % DTS.length]
      const joy = joyDe(t)
      real.heart.update(joy, CORACAO.velocidadePadrao, dt)
      p.tick(dt, joy)
      t += dt
      real.balas.atualizar(dt, [real.heart], () => (acertoReal ??= quadro, true), () => {})
      if (p.etapa === 'desviar') comparar(real, p.onda, p.coracao, quadro)
      quadro++
    }
    assert.equal(p.etapa === 'tentarDeNovo', acertoReal !== null, 'acertou nos dois ou em nenhum')
    if (acertoReal !== null) assert.equal(acertoReal, quadro - 1, 'no mesmo quadro')
  }
})

test('o coração do manual anda como o Heart real (diagonal limitada, preso à caixa, joy de -100 a 100)', () => {
  const real = reais(CAIXA, { x: 450, y: 160 })
  const c = { x: 450, y: 160 }
  const joys = [{ x: 100, y: 100 }, { x: -100, y: 0 }, { x: 37, y: -88 }, { x: 0, y: 100 }, { x: 100, y: -100 }, { x: -60, y: -60 }]
  for (let i = 0; i < 600; i++) {
    const joy = joys[Math.floor(i / 40) % joys.length]
    real.heart.update(joy, 180, 16)
    moverCoracao(c, joy, 180, 16, CAIXA)
    perto(real.heart.x, c.x, `passo ${i} x`)
    perto(real.heart.y, c.y, `passo ${i} y`)
  }
})
