// node --test src/game/manual/__tests__/pagina1.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CORACAO } from '../../constants.js'
import { criarRng } from '../../pvp/baralho.js'
import { circuloGiz, caixaDosTracos } from '../giz.js'
import { dicasDeBotoes, linhaDeDicas } from '../botoes.js'
import { TECLAS_PADRAO } from '../../teclas.js'
import {
  criarPagina1,
  falaDaEtapa,
  moverCoracao,
  balaAcerta,
  balaFora,
  marcaAlcancada,
  fatorAssistencia,
  ETAPAS,
  FALAS_INTRO,
  BALAS,
  SOBREVIVER_MS,
  PREPARO_MS,
  RETRY_MS,
  RAIO_BALA,
  RAIO_MARCA,
} from '../pagina1.js'

const CAIXA = { esquerda: 420, direita: 760, topo: 150, base: 350 }
const nova = (op) => criarPagina1({ caixa: CAIXA, ...op })
const rodar = (p, ms, joy = { x: 0, y: 0 }) => {
  for (let t = 0; t < ms; t += 16) p.tick(16, joy)
}
// leva o coração a (x, y) em linha reta, pela mesma regra de movimento do jogo
const ir = (p, x, y) => {
  for (let i = 0; i < 400 && p.etapa === 'marcas' && Math.hypot(p.coracao.x - x, p.coracao.y - y) > 1.5; i++) {
    const dx = x - p.coracao.x
    const dy = y - p.coracao.y
    const m = Math.hypot(dx, dy)
    p.tick(16, { x: (dx / m) * 100, y: (dy / m) * 100 })
  }
}
const ate = (p, etapa) => {
  while (p.etapa !== etapa) {
    if (p.etapa === 'intro') p.avancar()
    else if (p.etapa === 'desenhando') rodar(p, 3000)
    else if (p.etapa === 'marcas') for (const m of p.marcas) ir(p, m.x, m.y)
    else if (p.etapa === 'desviar') p.tick(16, { x: 0, y: 0 }) // só para sair do loop se travar
    else break
    if (p.etapa === 'desviar' && etapa !== 'desviar') break
  }
}

test('fluxo: intro -> desenhando -> marcas -> desviar -> concluida -> virando -> fim', () => {
  const p = nova()
  assert.equal(p.etapa, 'intro')
  for (let i = 0; i < FALAS_INTRO.length - 1; i++) {
    assert.equal(p.etapa, 'intro')
    assert.equal(p.fala, FALAS_INTRO[i])
    p.avancar()
  }
  assert.equal(p.fala, FALAS_INTRO.at(-1))
  p.avancar()
  assert.equal(p.etapa, 'desenhando')
  assert.equal(p.avancar(), false, 'durante o desenho o A não faz nada')
  rodar(p, 1000)
  assert.ok(p.desenho.caixa > 0.5 && p.desenho.coracao < 1)
  rodar(p, 2000)
  assert.equal(p.etapa, 'marcas')
  assert.deepEqual(p.desenho, { caixa: 1, coracao: 1, marcas: 1 })
  for (const m of p.marcas) ir(p, m.x, m.y)
  assert.equal(p.etapa, 'desviar')
  // coração parado no canto da última marca? as balas miram e precisamos de um jogador que desvia:
  p.onda.limpar()
  p.hitbox = -1e9 // só para este teste de fluxo: nada acerta
  rodar(p, PREPARO_MS + SOBREVIVER_MS + 100)
  assert.equal(p.etapa, 'concluida')
  assert.equal(p.balas.length, 0)
  assert.equal(p.avancar(), true)
  assert.equal(p.etapa, 'virando')
  p.terminouDeVirar()
  assert.equal(p.etapa, 'fim')
  assert.ok(ETAPAS.includes(p.etapa))
})

test('toda etapa tem fala', () => {
  const p = nova()
  for (const e of ETAPAS) {
    p.etapa = e
    p.falhas = 2
    assert.ok(falaDaEtapa(p).length > 5, e)
  }
})

test('marcas: detecta pelo raio, em qualquer ordem, e conta cada uma uma vez', () => {
  const p = nova()
  ate(p, 'marcas')
  assert.equal(p.etapa, 'marcas')
  const [a, b, c] = p.marcas
  assert.equal(marcaAlcancada(a, { x: a.x + RAIO_MARCA - 1, y: a.y }), true)
  assert.equal(marcaAlcancada(a, { x: a.x + RAIO_MARCA + 1, y: a.y }), false)
  ir(p, c.x, c.y)
  assert.equal(p.marcasPegas, 1)
  assert.ok(c.pega && !a.pega && !b.pega)
  p.drenar()
  ir(p, a.x, a.y)
  const ev = p.drenar().filter((e) => e.tipo === 'marca')
  assert.deepEqual(ev.map((e) => e.indice), [0])
  assert.equal(p.marcasPegas, 2)
  assert.equal(p.etapa, 'marcas')
  ir(p, b.x, b.y)
  assert.equal(p.etapa, 'desviar')
})

test('marcas ficam dentro da caixa e alcançáveis pelo coração (preso à caixa)', () => {
  const p = nova()
  for (const m of p.marcas) {
    assert.ok(m.x - 8 > CAIXA.esquerda && m.x + 8 < CAIXA.direita && m.y - 8 > CAIXA.topo && m.y + 8 < CAIXA.base)
  }
})

test('movimento do coração: preso à caixa e diagonal não é mais rápida', () => {
  const c = { x: 590, y: 250 }
  moverCoracao(c, { x: 100, y: 100 }, 180, 1000, CAIXA)
  const andou = Math.hypot(c.x - 590, c.y - 250)
  assert.ok(Math.abs(andou - 180) < 1e-6 || c.x === CAIXA.direita - CORACAO.tamanho / 2 || c.y === CAIXA.base - CORACAO.tamanho / 2)
  moverCoracao(c, { x: 100, y: 0 }, 180, 10000, CAIXA)
  assert.equal(c.x, CAIXA.direita - CORACAO.tamanho / 2)
  moverCoracao(c, { x: -100, y: -100 }, 180, 10000, CAIXA)
  assert.equal(c.x, CAIXA.esquerda + CORACAO.tamanho / 2)
  assert.equal(c.y, CAIXA.topo + CORACAO.tamanho / 2)
  const d = { x: 500, y: 250 }
  moverCoracao(d, { x: 100, y: 100 }, 180, 100, CAIXA)
  assert.ok(Math.abs(Math.hypot(d.x - 500, d.y - 250) - 18) < 1e-6, 'diagonal = 18 px em 100 ms')
})

test('acerto: igual ao do jogo (folga <= hitbox) e só com a bala dentro da caixa', () => {
  const b = { x: 600, y: 250, raio: RAIO_BALA }
  const h = CORACAO.hitbox
  assert.equal(balaAcerta(b, { x: 600 + RAIO_BALA + h - 0.01, y: 250 }), true)
  assert.equal(balaAcerta(b, { x: 600 + RAIO_BALA + h + 0.01, y: 250 }), false)
  assert.equal(balaFora({ x: CAIXA.esquerda - RAIO_BALA - 1, y: 250, raio: RAIO_BALA }, CAIXA), true)
  assert.equal(balaFora({ x: CAIXA.esquerda - RAIO_BALA + 1, y: 250, raio: RAIO_BALA }, CAIXA), false)
})

test('a hitbox não depende do tremor do desenho: giz sorteado de qualquer jeito, mesmo acerto', () => {
  const b = { x: 600, y: 250, raio: RAIO_BALA }
  const antes = [0, 3, 6, 9, 12].map((d) => balaAcerta(b, { x: 600 + d, y: 250 }))
  for (const sem of ['a', 'b', 'c', 'd']) {
    // desenha "o blob" da bala com tremor alto: só gera pontos, e a colisão lê x/y/raio
    const blob = circuloGiz(criarRng(sem), b.x, b.y, b.raio, { tremor: 2 })
    assert.ok(caixaDosTracos(blob).maxX > b.x)
    const depois = [0, 3, 6, 9, 12].map((d) => balaAcerta(b, { x: 600 + d, y: 250 }))
    assert.deepEqual(depois, antes)
  }
  assert.deepEqual(Object.keys(b).sort(), ['raio', 'x', 'y'])
})

test('desviar: sem balas no preparo; 6 balas nascem na ordem; acerto -> tentarDeNovo -> recomeça só o desvio', () => {
  const p = nova()
  ate(p, 'marcas')
  for (const m of p.marcas) ir(p, m.x, m.y)
  assert.equal(p.etapa, 'desviar')
  rodar(p, PREPARO_MS - 50)
  assert.equal(p.balas.length, 0)
  // bota o coração no caminho da 1ª bala (vem da esquerda, y = 30% da caixa)
  const y1 = CAIXA.topo + BALAS[0].f * (CAIXA.base - CAIXA.topo)
  p.coracao.x = CAIXA.esquerda + 20
  p.coracao.y = y1
  rodar(p, 700)
  assert.equal(p.etapa, 'tentarDeNovo')
  assert.equal(p.falhas, 1)
  assert.ok(p.drenar().some((e) => e.tipo === 'acerto'))
  assert.match(p.fala, /tente|Tenta|de novo|Quase/i)
  assert.equal(p.marcasPegas, 3, 'as marcas continuam pegas')
  rodar(p, RETRY_MS + 50)
  assert.equal(p.etapa, 'desviar')
  assert.equal(p.balas.length, 0)
  assert.equal(p.decorrido, 0)
  assert.equal(p.tentativa, 2)
  assert.equal(p.coracao.x, (CAIXA.esquerda + CAIXA.direita) / 2)
})

test('retry instantâneo com A', () => {
  const p = nova()
  p.etapa = 'tentarDeNovo'
  p.falhas = 1
  assert.equal(p.avancar(), true)
  assert.equal(p.etapa, 'desviar')
})

test('um jogador que desvia (fugindo da bala mais perto) sobrevive os 8 s', () => {
  const p = nova()
  ate(p, 'marcas')
  for (const m of p.marcas) ir(p, m.x, m.y)
  let t = 0
  while (p.etapa === 'desviar' && t < 20000) {
    // anda para longe da bala perigosa mais próxima e, sem balas perto, volta para o meio
    let joy = { x: 0, y: 0 }
    let melhor = null
    for (const b of p.balas) {
      const d = Math.hypot(b.x - p.coracao.x, b.y - p.coracao.y)
      if (d < 90 && (!melhor || d < melhor.d)) melhor = { b, d }
    }
    if (melhor) {
      // perpendicular à velocidade da bala, para o lado que afasta
      const { vx, vy } = melhor.b
      const m = Math.hypot(vx, vy) || 1
      let px = -vy / m
      let py = vx / m
      if (px * (p.coracao.x - melhor.b.x) + py * (p.coracao.y - melhor.b.y) < 0) {
        px = -px
        py = -py
      }
      joy = { x: px * 100, y: py * 100 }
    }
    p.tick(16, joy)
    t += 16
  }
  assert.equal(p.etapa, 'concluida', `parou em ${p.etapa}, falhas ${p.falhas}`)
  assert.equal(p.falhas, 0)
})

test('assistência: depois de errar as balas ficam mais lentas (até 60%)', () => {
  assert.equal(fatorAssistencia(0), 1)
  assert.ok(fatorAssistencia(2) < 1)
  assert.equal(fatorAssistencia(20), 0.6)
})

test('dicas de botões por dispositivo', () => {
  const teclado = dicasDeBotoes('teclado', TECLAS_PADRAO)
  assert.equal(teclado.mover, 'WASD')
  assert.equal(teclado.A, 'ESPAÇO')
  assert.deepEqual(dicasDeBotoes('gamepad'), { mover: 'ANALÓGICO', A: 'A', B: 'B' })
  assert.equal(dicasDeBotoes('serial').A, 'BOTÃO A')
  assert.equal(dicasDeBotoes(null).A, teclado.A)
  assert.equal(linhaDeDicas(dicasDeBotoes('gamepad'), [{ tecla: 'A', texto: 'continuar' }, 'B']), 'A: continuar      B: sair')
  const trocadas = dicasDeBotoes('teclado', { p1: { ...TECLAS_PADRAO.p1, A: ['KeyJ'] } })
  assert.equal(trocadas.A, 'J')
})
