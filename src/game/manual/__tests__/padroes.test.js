// node --test src/game/manual/__tests__/padroes.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ATAQUE, CORACAO } from '../../constants.js'
import { criarOnda, moverCoracao, limitesDe } from '../onda.js'
import { criarRoteiro, pilotoDeDesvio, fileira, tiro, maiorLacunaDaFileira, LACUNA_MINIMA, LICOES, BURACO, AVISO_MIRA } from '../padroes.js'
import { criarRng } from '../../pvp/baralho.js'

const CAIXA = { esquerda: 440, direita: 780, topo: 148, base: 348 }
const L = { ...limitesDe(CAIXA), width: 340, height: 200 }

// todas as balas que o roteiro cria em `duracao` ms (coração parado no meio)
function todas(id, op) {
  const r = criarRoteiro(id, CAIXA, op)
  const saida = []
  for (let t = 0; t <= r.duracao; t += 16) saida.push(...r.gerar(t, { x: 610, y: 248 }).map((o) => ({ t, ...o })))
  return saida
}

test('mesma semente, mesmas balas; semente diferente, outras', () => {
  for (const { id } of LICOES) {
    assert.deepEqual(todas(id), todas(id), id)
    assert.notDeepEqual(todas(id, { semente: 'outra' }), todas(id), id)
  }
})

test('as 4 mini-lições: 5 a 8 s cada, a mistura 10 s; só a mistura não tem demonstração', () => {
  assert.deepEqual(LICOES.map((l) => l.id), ['chuva', 'linha', 'mira', 'mistura'])
  for (const l of LICOES.slice(0, 3)) {
    assert.ok(l.duracao >= 5000 && l.duracao <= 8000, l.id)
    assert.ok(l.demo > 0 && l.demo < l.duracao)
  }
  assert.equal(LICOES[3].duracao, 10000)
  assert.equal(LICOES[3].demo, 0)
})

test('chuva: gotas nascem logo acima da caixa e entram caindo (sem pisca), acelerando até ~95 px/s', () => {
  const gotas = todas('chuva')
  assert.ok(gotas.length >= 10)
  for (const g of gotas) {
    assert.ok(g.y < CAIXA.topo && g.y > CAIXA.topo - 20)
    assert.ok(g.x > CAIXA.esquerda && g.x < CAIXA.direita)
    assert.equal(g.entrando, true)
    assert.ok(g.vy > 0 && g.ay > 0)
    const vFundo = Math.sqrt(g.vy ** 2 + 2 * g.ay * L.height)
    assert.ok(Math.abs(vFundo - 95) < 1e-6, 'v² = v0² + 2·g·h, como attacks/rain.js')
  }
})

test('linha: toda fileira tem UM buraco de pelo menos BURACO px (> LACUNA_MINIMA) e varre de lado', () => {
  assert.ok(BURACO >= LACUNA_MINIMA)
  for (const sem of ['manual:p2:linha', 'a', 'b', 'c', 'd', 'e']) {
    const balas = todas('linha', { semente: sem })
    const porT = Map.groupBy(balas, (b) => b.t)
    assert.ok(porT.size >= 2)
    let anterior = null
    for (const fila of porT.values()) {
      assert.ok(fila.every((b) => b.vx > 0 && b.vy === undefined && b.x < CAIXA.esquerda))
      const gap = maiorLacunaDaFileira(fila, L)
      assert.ok(gap >= BURACO - 0.01, `buraco de ${gap}px`)
      const buraco = fila[0].extra.buraco
      if (anterior !== null) assert.ok(Math.abs(buraco - anterior) >= 70 - 1e-9, 'o próximo buraco pede para andar')
      anterior = buraco
    }
  }
  // as bolinhas de fora do buraco ficam juntas demais para o coração passar
  const f = fileira(L, { buraco: 200 })
  for (let i = 1; i < f.length; i++) {
    if (f[i].y - f[i - 1].y > 30) continue // o buraco
    assert.ok(f[i].y - f[i - 1].y - 2 * f[i].raio < 2 * CORACAO.hitbox)
  }
})

test('mira: a bala nasce fora, fica parada o aviso inteiro (>= telégrafo) e sai pela linha pontilhada até o coração', () => {
  const coracao = { x: 520, y: 300 }
  const o = tiro(criarRng('t'), L, coracao)
  assert.ok(o.aviso >= ATAQUE.telegrafoMs && o.aviso === AVISO_MIRA)
  assert.ok(o.x < CAIXA.esquerda || o.x > CAIXA.direita || o.y < CAIXA.topo || o.y > CAIXA.base)
  const { linha } = o.extra
  // a linha aponta para onde o coração estava
  const t = (coracao.x - linha.x) * linha.dx + (coracao.y - linha.y) * linha.dy
  assert.ok(Math.hypot(linha.x + linha.dx * t - coracao.x, linha.y + linha.dy * t - coracao.y) < 1e-9)
  const onda = criarOnda(CAIXA)
  const b = onda.bala(o)
  for (let k = 0; k < Math.floor((o.aviso - 1) / 16); k++) onda.passo(16, { ...coracao, hitbox: CORACAO.hitbox })
  assert.equal(b.x, o.x, 'parada durante a linha')
  // depois anda reto pela linha, e acerta quem ficou em cima dela
  let acertou = null
  for (let k = 0; k < 400 && !acertou; k++) acertou = onda.passo(16, { ...coracao, hitbox: CORACAO.hitbox })
  assert.equal(acertou, b)
})

test('mistura: tem gotas, fileiras (uma de cada lado, sem se cruzarem) e tiros', () => {
  const balas = todas('mistura')
  const tipos = new Set(balas.map((b) => b.extra.tipo))
  assert.deepEqual([...tipos].sort(), ['fila', 'gota', 'tiro'])
  const filas = [...Map.groupBy(balas.filter((b) => b.extra.tipo === 'fila'), (b) => b.t).values()]
  assert.equal(filas.length, 2)
  assert.ok(filas[0][0].vx > 0 && filas[1][0].vx < 0)
  // a 1ª fileira já saiu da caixa quando a 2ª entra
  const t1 = filas[0][0].t
  const atravessa = ((CAIXA.direita - CAIXA.esquerda + 20) / filas[0][0].vx) * 1000
  assert.ok(t1 + atravessa < filas[1][0].t)
})

test('dá para passar: o piloto (as mesmas regras do jogador) sobrevive a toda mini-lição, em várias sementes', () => {
  for (const { id } of LICOES) {
    for (const semente of [undefined, `manual:p2:demo:${id}`, 'x1', 'x2', 'x3', 'x4']) {
      const r = criarRoteiro(id, CAIXA, { semente })
      const onda = criarOnda(CAIXA)
      const c = { x: 610, y: 248 }
      let acertou = null
      for (let t = 0; t < r.duracao && !acertou; t += 16) {
        moverCoracao(c, pilotoDeDesvio(onda.lista, c, CAIXA, CORACAO.velocidadePadrao), CORACAO.velocidadePadrao, 16, CAIXA)
        for (const o of r.gerar(t + 16, c)) onda.bala(o)
        acertou = onda.passo(16, { ...c, hitbox: CORACAO.hitbox })
      }
      assert.equal(acertou, null, `${id} / ${semente}`)
    }
  }
})

test('nenhuma mini-lição deixa ficar parado (o padrão ensina a ler e a andar)', () => {
  for (const { id } of LICOES) {
    const r = criarRoteiro(id, CAIXA)
    const onda = criarOnda(CAIXA)
    const c = { x: 610, y: id === 'chuva' ? 284 : 248 }
    let acertou = null
    for (let t = 0; t < r.duracao && !acertou; t += 16) {
      for (const o of r.gerar(t + 16, c)) onda.bala(o)
      acertou = onda.passo(16, { ...c, hitbox: CORACAO.hitbox })
    }
    assert.ok(acertou, id)
  }
})
