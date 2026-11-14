// node --test src/game/pvp/__tests__/praiaCafe.test.js
// As arenas PRAIA e CAFÉ FRANCÊS: listas de bônus, eventos novos (planos puros em
// pvp/bonus/eventos/planosPraiaCafe.js): repetíveis pela semente, sempre com aviso e com saída.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARENA, ARENAS, eventosDaArena, BONUS_POR_ARENA } from '../arenas.js'
import { EVENTO, sortearEvento } from '../bonus.js'
import { criarRng, aleatorio } from '../baralho.js'
import { ATAQUE, CORACAO } from '../../constants.js'
import { fichaDaArena } from '../../grimorio/arenas.js'
import {
  ONDA, planejarOnda, blocosDaOnda,
  CARANGUEJO, planejarCaranguejo, faseDoCaranguejo, xDoCaranguejo,
  BOLA, planejarBola, andarBola, empurraoDaBola,
  CROISSANT, planejarCroissant, posicaoDoCroissant,
  BULE, planejarVapor, areaDoVapor,
  POMBOS, planejarBando, alcancavel,
} from '../bonus/eventos/planosPraiaCafe.js'

const CAIXA = { left: 100, right: 320, top: 80, bottom: 250, width: 220, height: 170 }
const MENOR = { left: 100, right: 210, top: 80, bottom: 180, width: 110, height: 100 } // caixa mínima
const rngDe = (semente) => {
  const r = criarRng(semente)
  return () => aleatorio(r)
}
const NOVOS = {
  praia: ['ondaGigante', 'caranguejos', 'bolaDePraia'],
  cafe: ['croissants', 'buleQuente', 'pombos'],
}

test('praia e café: arenas com no mínimo 10 bônus, os novos de esquiva e os gerais', () => {
  for (const [id, novos] of Object.entries(NOVOS)) {
    assert.ok(ARENA[id], id)
    assert.ok(ARENA[id].tituloMusica && ARENA[id].musica === `arena_${id}`, `${id}: música original`)
    const ids = eventosDaArena(id).map((e) => e.id)
    assert.ok(ids.length >= BONUS_POR_ARENA, `${id}: ${ids.length}`)
    for (const g of ['duelo', 'malucas', ...novos]) assert.ok(ids.includes(g), `${id}: ${g}`)
    for (const n of novos) {
      assert.equal(EVENTO[n].cartas, 'normal', n)
      assert.equal(EVENTO[n].nome, EVENTO[n].nome.toUpperCase(), `${n}: nome em caixa alta`)
      assert.ok(EVENTO[n].descricao && EVENTO[n].cor, n)
    }
    // os novos só existem na arena deles
    const outras = ARENAS.filter((a) => a.id !== id && !['praia', 'cafe'].includes(a.id))
    for (const a of outras) for (const n of novos) assert.ok(!eventosDaArena(a.id).some((e) => e.id === n), `${a.id} tem ${n}`)
  }
})

test('praia e café: nomes próprios dos bônus reaproveitados (MARÉ ALTA, BRISA DO MAR...)', () => {
  const nome = (arena, id) => eventosDaArena(arena).find((e) => e.id === id).nome
  assert.equal(nome('praia', 'aquario'), 'MARÉ ALTA')
  assert.equal(nome('praia', 'ventania'), 'BRISA DO MAR')
  assert.equal(nome('cafe', 'karaoke'), 'CHANSON')
  assert.equal(EVENTO.aquario.nome, 'AQUÁRIO') // o original não muda
})

test('praia e café: a roleta sorteia todos os bônus novos e o Guia tem a dica de cada um', () => {
  for (const [id, novos] of Object.entries(NOVOS)) {
    const rng = criarRng(`roleta:${id}`)
    const disponiveis = eventosDaArena(id).map((e) => e.id)
    const vistos = new Set()
    for (let i = 0; i < 500; i++) vistos.add(sortearEvento(rng, { disponiveis }).id)
    for (const n of novos) assert.ok(vistos.has(n), n)
    const ficha = fichaDaArena(id)
    for (const n of novos) {
      const e = ficha.eventos.find((f) => f.id === n)
      assert.ok(e?.dica, `${id}/${n}: sem dica no Guia`)
      assert.equal(e.emTodas, false)
    }
  }
})

test('onda gigante: sempre tem vão (>= 3x o coração), repetível e o próximo vão é alcançável no aviso', () => {
  for (const caixa of [CAIXA, MENOR]) {
    for (let s = 0; s < 60; s++) {
      const sorte = rngDe(`onda${s}`)
      let anterior = null
      for (let k = 0; k < 8; k++) {
        const p = planejarOnda(sorte, caixa, anterior)
        assert.ok(ONDA.vao >= 3 * CORACAO.tamanho, 'vão largo o bastante')
        assert.ok(p.vaoY - ONDA.vao / 2 >= caixa.top && p.vaoY + ONDA.vao / 2 <= caixa.bottom, 'vão dentro da caixa')
        const blocos = blocosDaOnda(caixa, p.vaoY)
        const coberto = blocos.reduce((a, b) => a + (b.y1 - b.y0), 0)
        assert.ok(Math.abs(coberto - (caixa.height - ONDA.vao)) < 1e-6, 'só o vão fica livre')
        if (anterior) assert.ok(alcancavel(Math.abs(p.vaoY - anterior.vaoY), ONDA.avisoMs), 'dá tempo de ir do vão anterior ao novo')
        anterior = p
      }
    }
  }
  assert.ok(ONDA.avisoMs >= ATAQUE.telegrafoMs)
  assert.deepEqual(planejarOnda(rngDe('x'), CAIXA), planejarOnda(rngDe('x'), CAIXA))
})

test('onda gigante: de qualquer ponto da caixa dá para chegar no vão durante o aviso', () => {
  const pior = Math.max(CAIXA.height - ONDA.vao)
  assert.ok(alcancavel(pior, ONDA.avisoMs), `${pior}px em ${ONDA.avisoMs}ms`)
})

test('caranguejos: ciclo anda -> abre (aviso) -> belisca, aviso >= telegrafoMs e fileiras separadas', () => {
  assert.ok(CARANGUEJO.abreMs >= ATAQUE.telegrafoMs)
  assert.ok(CARANGUEJO.raioPinca > CARANGUEJO.raioCorpo)
  const sorte = rngDe('c1')
  const outros = []
  for (let k = 0; k < 30; k++) {
    const p = planejarCaranguejo(sorte, CAIXA, outros.slice(-1))
    assert.ok(p.y >= CAIXA.top + 16 && p.y <= CAIXA.bottom - 16)
    assert.ok([-1, 1].includes(p.lado))
    assert.ok(p.vel >= CARANGUEJO.velocidade.min && p.vel <= CARANGUEJO.velocidade.max)
    outros.push(p.y)
    // a sequência de fases
    const ordem = []
    for (let t = 0; t < 6000; t += 10) {
      const f = faseDoCaranguejo(p, t)
      if (ordem.at(-1) !== f.fase) ordem.push(f.fase)
    }
    assert.deepEqual(ordem.slice(0, 6), ['anda', 'abre', 'belisca', 'anda', 'abre', 'belisca'])
    // o beliscão sempre vem DEPOIS de abreMs de aviso
    const fim = faseDoCaranguejo(p, p.andaMs[0] + CARANGUEJO.abreMs - 1)
    assert.equal(fim.fase, 'abre')
    assert.equal(faseDoCaranguejo(p, p.andaMs[0] + CARANGUEJO.abreMs + 1).fase, 'belisca')
  }
  // só anda andando: a posição só avança na fase "anda"
  const p = { lado: 1, y: 100, vel: 60, andaMs: [1000] }
  const a = faseDoCaranguejo(p, 1000 + 100) // abrindo
  assert.equal(xDoCaranguejo(p, 0, a.andou), 60)
  assert.deepEqual(planejarCaranguejo(rngDe('z'), CAIXA), planejarCaranguejo(rngDe('z'), CAIXA))
})

test('bola de praia: quica dentro da caixa, não depende do coração e empurra para longe sem dano', () => {
  for (let s = 0; s < 40; s++) {
    const b = planejarBola(rngDe(`b${s}`), CAIXA)
    const v = Math.hypot(b.vx, b.vy)
    assert.ok(Math.abs(v - BOLA.velocidade) < 1e-6)
    // nem só horizontal, nem só vertical
    assert.ok(Math.abs(b.vx) > 20 && Math.abs(b.vy) > 20)
    let quicou = 0
    for (let k = 0; k < 2000; k++) {
      if (andarBola(b, 16, CAIXA)) quicou++
      assert.ok(b.x >= CAIXA.left + BOLA.raio - 1e-6 && b.x <= CAIXA.right - BOLA.raio + 1e-6)
      assert.ok(b.y >= CAIXA.top + BOLA.raio - 1e-6 && b.y <= CAIXA.bottom - BOLA.raio + 1e-6)
    }
    assert.ok(quicou > 5)
  }
  const bola = { x: 200, y: 150 }
  const longe = empurraoDaBola(bola, 200 + BOLA.raio + CORACAO.hitbox + 20, 150)
  assert.deepEqual(longe, { x: 0, y: 0 })
  const perto = empurraoDaBola(bola, 200 + BOLA.raio, 150)
  assert.ok(perto.x > 0 && Math.abs(perto.y) < 1e-9, 'empurra para longe da bola')
  assert.ok(BOLA.forca > 100, 'vence o direcional do jogador (não dá para atravessar a bola)')
  assert.deepEqual(planejarBola(rngDe('q'), CAIXA), planejarBola(rngDe('q'), CAIXA))
})

test('croissants: a curva fica sempre dentro da caixa (inclusive na caixa mínima) e o aviso vale', () => {
  assert.ok(CROISSANT.avisoMs >= ATAQUE.telegrafoMs)
  for (const caixa of [CAIXA, MENOR]) {
    for (let s = 0; s < 80; s++) {
      const p = planejarCroissant(rngDe(`cr${s}`), caixa)
      for (let t = 0; t < 4000; t += 25) {
        const { y } = posicaoDoCroissant(p, 0, t)
        assert.ok(y >= caixa.top + CROISSANT.raio && y <= caixa.bottom - CROISSANT.raio, `y=${y}`)
      }
    }
  }
  // determinismo e sentido
  const a = posicaoDoCroissant({ lado: -1, y0: 100, amp: 20, freq: 4, fase: 1 }, 400, 500)
  assert.deepEqual(a, posicaoDoCroissant({ lado: -1, y0: 100, amp: 20, freq: 4, fase: 1 }, 400, 500))
  assert.ok(a.x < 400)
})

test('bule quente: nuvens afastadas, dentro da caixa e sobra bastante área livre', () => {
  assert.ok(BULE.avisoMs >= ATAQUE.telegrafoMs)
  for (const caixa of [CAIXA, MENOR]) {
    for (let s = 0; s < 120; s++) {
      const sorte = rngDe(`bu${s}`)
      const coracao = s % 2 ? { x: caixa.left + 40, y: caixa.top + 40 } : null
      const nuvens = planejarVapor(sorte, caixa, coracao)
      assert.ok(nuvens.length >= 1 && nuvens.length <= BULE.nuvens.max)
      for (const n of nuvens) {
        assert.ok(n.x - n.raio >= caixa.left - 1e-6 && n.x + n.raio <= caixa.right + 1e-6)
        assert.ok(n.y - n.raio >= caixa.top - 1e-6 && n.y + n.raio <= caixa.bottom + 1e-6)
      }
      for (let a = 0; a < nuvens.length; a++) {
        for (let b = a + 1; b < nuvens.length; b++) {
          const d = Math.hypot(nuvens[a].x - nuvens[b].x, nuvens[a].y - nuvens[b].y)
          assert.ok(d >= nuvens[a].raio + nuvens[b].raio + 30, 'sobra um corredor entre as nuvens')
        }
      }
      if (caixa === CAIXA) assert.ok(areaDoVapor(nuvens) / (caixa.width * caixa.height) <= BULE.ocupacaoMax, 'a caixa nunca fica tomada')
    }
  }
  assert.deepEqual(planejarVapor(rngDe('k'), CAIXA), planejarVapor(rngDe('k'), CAIXA))
})

test('pombos: o bando sempre deixa o vão, em cunha, e o vão seguinte é alcançável', () => {
  assert.ok(POMBOS.avisoMs >= ATAQUE.telegrafoMs)
  assert.ok(POMBOS.vao >= 3 * CORACAO.tamanho)
  for (const caixa of [CAIXA, MENOR]) {
    for (let s = 0; s < 60; s++) {
      const sorte = rngDe(`po${s}`)
      let anterior = null
      for (let k = 0; k < 6; k++) {
        const b = planejarBando(sorte, caixa, anterior)
        assert.ok(b.pombos.length >= 1)
        for (const p of b.pombos) {
          // nenhum pombo (nem a borda dele) entra no vão
          const dentro = p.y + POMBOS.raio > b.vaoY - POMBOS.vao / 2 && p.y - POMBOS.raio < b.vaoY + POMBOS.vao / 2
          assert.ok(!dentro, `pombo y=${p.y} no vão ${b.vaoY}`)
          assert.ok(p.y >= caixa.top && p.y <= caixa.bottom)
          assert.ok(p.atraso >= 0)
        }
        // o vão fica livre na caixa (mesmo na caixa mínima)
        assert.ok(b.vaoY - POMBOS.vao / 2 >= caixa.top && b.vaoY + POMBOS.vao / 2 <= caixa.bottom)
        if (anterior) assert.ok(alcancavel(Math.abs(b.vaoY - anterior.vaoY), POMBOS.avisoMs))
        anterior = b
      }
    }
  }
  assert.deepEqual(planejarBando(rngDe('p'), CAIXA), planejarBando(rngDe('p'), CAIXA))
})
