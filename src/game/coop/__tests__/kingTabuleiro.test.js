// node --test src/game/coop/__tests__/kingTabuleiro.test.js
// Chaos King: o tabuleiro (casas de cada peça, refúgio, XEQUE, ROQUE), a regra e o baralho em cada fase,
// os lacaios e o Cavaleiro da Expedição
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarGrade, casasDaPeca, mesclar, chave, planejarJogada, planejarXeque, retanguloDaGaiola, empurraoParaDentro, empurraoDoRoque, temRefugio, eventosDaPeca, TABULEIRO, TABULEIRO_MINI, celulaEm } from '../chefes/kingTabuleiro.js'
import { CHEFES, ORDEM_CHEFES } from '../chefes/index.js'
import { ESPEC } from '../chefes/kingCartas.js'
import { RegraDaLuta, descricaoValida } from '../regraChefe.js'
import { criarPartidaCoop } from '../regras.js'
import { CARTAS_CHEFES, ataqueDaCartaChefe } from '../cartasChefe.js'
import { criarRng, aleatorio } from '../../pvp/baralho.js'

const LIM = { x: 100, y: 200, width: 336, height: 180 }
const grade = criarGrade(LIM, TABULEIRO)
const sorteioDe = (semente) => {
  const r = criarRng(semente)
  return () => aleatorio(r)
}
const chaves = (casas) => new Set(casas.map((x) => chave(x.c, x.r)))

test('cada peça golpeia só o que o xadrez dela diz', () => {
  assert.equal(casasDaPeca({ tipo: 'torre', c: 0, r: 2, modo: 'linha' }, TABULEIRO).length, 8)
  assert.equal(casasDaPeca({ tipo: 'torre', c: 3, r: 0, modo: 'coluna' }, TABULEIRO).length, 4)
  assert.deepEqual([...chaves(casasDaPeca({ tipo: 'peao', c: 3, r: 1 }, TABULEIRO))].sort(), ['2,2', '4,2'])
  assert.equal(casasDaPeca({ tipo: 'peao', c: 0, r: 1 }, TABULEIRO).length, 1) // na borda
  assert.equal(casasDaPeca({ tipo: 'cavalo', c: 4, r: 1 }, TABULEIRO).length, 6) // 8 L, só os que cabem em 4 linhas
  assert.ok(!chaves(casasDaPeca({ tipo: 'cavalo', c: 4, r: 1 }, TABULEIRO)).has('4,1'))
  assert.deepEqual([...chaves(casasDaPeca({ tipo: 'bispo', c: 3, r: 0 }, TABULEIRO))].sort(), ['0,3', '1,2', '2,1', '3,0', '4,1', '5,2', '6,3'])
  const rainha = chaves(casasDaPeca({ tipo: 'rainha', c: 3, r: 3 }, TABULEIRO))
  assert.ok(rainha.has('0,3') && rainha.has('3,0') && rainha.has('0,0') && rainha.has('6,0'))
  assert.equal(casasDaPeca({ tipo: 'cavalo', c: 1, r: 1 }, TABULEIRO_MINI).length, 4)
})

test('mesclar: a linha da torre vira UM retângulo', () => {
  const m = mesclar(casasDaPeca({ tipo: 'torre', c: 0, r: 2, modo: 'linha' }, TABULEIRO))
  assert.deepEqual(m, [{ c0: 0, r0: 2, c1: 7, r1: 2 }])
  assert.equal(mesclar([{ c: 0, r: 0 }, { c: 1, r: 1 }]).length, 2)
})

test('peão marcha e promove em rainha; as peças dão o aviso antes do golpe', () => {
  const { eventos, duracao } = eventosDaPeca({ tipo: 'peao', c: 3, r: 0, promove: true }, TABULEIRO, { aviso: 900, golpe: 300, passo: 100 })
  assert.deepEqual(eventos.map((e) => e.tipo), ['golpe', 'mover', 'golpe', 'mover', 'golpe', 'mover', 'promover', 'golpe'])
  assert.ok(eventos.filter((e) => e.tipo === 'golpe').every((e) => e.aviso >= 900))
  assert.ok(duracao > 3 * 1200)
  const rainha = eventos.at(-1)
  assert.ok(rainha.casas.length > 12)
})

test('a jogada sempre deixa um refúgio 2 x 2 ao alcance de cada coração e é determinística', () => {
  const alvos = [{ x: 150, y: 350 }, { x: 380, y: 350 }]
  const tipos = [['torre', 'torre'], ['bispo', 'cavalo', 'torre'], ['peao', 'peao'], ['torre', 'bispo', 'cavalo', 'peao']]
  for (let s = 0; s < 80; s++) {
    for (const tp of tipos) {
      const jogada = tp.map((tipo) => ({ tipo }))
      const um = planejarJogada({ grade, jogada, alvos, sorteio: sorteioDe(`j${s}`) })
      const dois = planejarJogada({ grade, jogada, alvos, sorteio: sorteioDe(`j${s}`) })
      assert.deepEqual(um.pecas, dois.pecas, 'mesma semente, mesma jogada')
      assert.ok(temRefugio(grade, new Set(um.ocupadas.keys())), `sem refúgio (${tp}, ${s})`)
    }
  }
})

test('a peça mirada ameaça a casa do coração parado (torre, bispo, cavalo)', () => {
  let mirou = 0
  let total = 0
  for (let s = 0; s < 60; s++) {
    const alvo = { x: 100 + 336 * ((s % 7) / 8 + 0.07), y: 200 + 20 + 45 * (s % 4) }
    const cel = celulaEm(grade, alvo.x, alvo.y)
    for (const tipo of ['torre', 'bispo', 'cavalo']) {
      const { pecas } = planejarJogada({ grade, jogada: [{ tipo }], alvos: [alvo], sorteio: sorteioDe(`m${s}${tipo}`) })
      if (!pecas.length) continue
      total++
      if (chaves(pecas[0].eventos[0].casas).has(chave(cel.c, cel.r))) mirou++
    }
  }
  assert.ok(total > 100 && mirou === total, `mirou ${mirou} de ${total}`)
})

test('casas protegidas (gaiola, captura) nunca são golpeadas', () => {
  const protegidas = new Set(['0,3', '1,3', '0,2', '1,2'])
  for (let s = 0; s < 60; s++) {
    const { pecas } = planejarJogada({ grade, jogada: [{ tipo: 'torre' }, { tipo: 'bispo' }, { tipo: 'cavalo' }], alvos: [{ x: 300, y: 350 }], protegidas, sorteio: sorteioDe(`p${s}`) })
    for (const p of pecas) for (const e of p.eventos) if (e.casas) for (const x of e.casas) assert.ok(!protegidas.has(chave(x.c, x.r)))
  }
})

test('XEQUE: determinístico, prende um coração, a captura fica longe e protegida, sem parceiro não há xeque', () => {
  const um = planejarXeque({ grade, vivos: [true, true], sorteio: sorteioDe('x1') })
  const dois = planejarXeque({ grade, vivos: [true, true], sorteio: sorteioDe('x1') })
  assert.deepEqual(um, dois)
  assert.equal(planejarXeque({ grade, vivos: [true, false], sorteio: sorteioDe('x') }), null)
  assert.equal(planejarXeque({ grade, vivos: [false, false], sorteio: sorteioDe('x') }), null)
  for (let s = 0; s < 100; s++) {
    const n = 2 + (s % 3)
    const vivos = Array.from({ length: n }, () => true)
    const x = planejarXeque({ grade, vivos, sorteio: sorteioDe(`x${s}`) })
    assert.ok(x.j >= 0 && x.j < n && !x.parceiros.includes(x.j) && x.parceiros.length === n - 1)
    assert.equal(x.gaiola.casas.length, 4)
    assert.ok(x.captura.r <= 1, 'a casa da captura fica em cima')
    assert.ok(x.protegidas.has(chave(x.captura.c, x.captura.r)))
    for (const k of x.gaiola.casas) assert.ok(x.protegidas.has(chave(k.c, k.r)))
    // o parceiro chega na casa da captura bem antes do golpe (aviso do xeque >= 2,3 s)
    const ret = retanguloDaGaiola(grade, x.gaiola)
    assert.ok(ret.right <= grade.left + grade.width + 0.01 && ret.bottom <= grade.top + grade.height + 0.01)
  }
})

test('a gaiola empurra o coração para dentro; o ROQUE espelha o coração', () => {
  const ret = { left: 100, top: 100, right: 184, bottom: 190 }
  assert.deepEqual(empurraoParaDentro(ret, 120, 150), { dx: 0, dy: 0 })
  const { dx, dy } = empurraoParaDentro(ret, 300, 20)
  assert.ok(dx < 0 && dy > 0)
  assert.equal(300 + dx, ret.right - 7)
  const r = empurraoDoRoque(grade, grade.left + 50)
  assert.equal(grade.left + 50 + r.dx, grade.left + grade.width - 50)
})

// ---------- a regra e o baralho ----------

function ponte(estado, { meus = [0, 1] } = {}) {
  const log = { zonas: [], quebra: 0, banners: [], empurroes: [] }
  const coracoes = [{ j: 0, x: 180, y: 350, ativo: true }, { j: 1, x: 350, y: 350, ativo: true }]
  return {
    log,
    ponte: {
      semente: 's', nivel: 'medio', n: 2, rodada: () => estado.rodada, estado: () => estado, meu: (j) => meus.includes(j), meuLado: () => 0,
      coracoes: () => coracoes, limites: () => LIM, desenharItem: () => null, desenharZona: (z) => (log.zonas.push(z), null), apagar: () => {},
      banner: (t) => log.banners.push(t), dica: () => {}, quebra: (p) => (log.quebra += p), danoNoChefe: () => {}, curar: () => {}, ferir: () => {},
      empurrar: (j, dx, dy) => log.empurroes.push([j, dx, dy]), enviar: () => {},
    },
    coracoes,
  }
}

test('a regra do King: UMA frase curta, ataque das peças, XEQUE só com parceiro de pé', () => {
  const def = CHEFES.king.regra
  assert.ok(descricaoValida(def.descricao) && descricaoValida(CHEFES.kingTenente.regra.descricao))
  for (const f of Object.values(def.fases)) assert.ok(descricaoValida(f.descricao))
  const estado = criarPartidaCoop({ party: ['kris', 'susie'], chefe: 'king', semente: 'r' })
  const { ponte: p } = ponte(estado)
  const regra = new RegraDaLuta(def, p)
  const xeque = CARTAS_CHEFES.king.fases.flat().find((c) => c.nome === 'Xeque!')
  const normal = CARTAS_CHEFES.king.fases[0].find((c) => c.nome === 'Torre à Vista')
  const A = new Proxy({}, { get: () => () => ({}) })
  const at = regra.ataque(normal, A, { nome: 'padrao' })
  assert.equal(at.nome, 'tabuleiro')
  // dois de pé: o ataque do xeque nasce; a regra guarda a gaiola quando a esquiva começa (via aoIniciar, no jogo)
  assert.equal(regra.ataque(xeque, A, null).nome, 'tabuleiro')
  estado.jogadores[1].caido = true
  assert.equal(regra.ataque(xeque, A, null).nome, 'tabuleiro') // sem parceiro: só as peças
  assert.equal(regra.inst.alvoDoBot(1), null)
  regra.terminar()
})

test('o baralho do King: 3 fases, peões/torres, depois bispos/cavalos, depois promoção/roque; XEQUE em cada fase', () => {
  const k = CHEFES.king
  assert.deepEqual(k.fases.map((f) => f.hp), [1, 0.66, 0.33])
  const nomes = (f) => k.fases[f].cartas.map((c) => c[2])
  assert.ok(nomes(0).includes('Xeque!') && nomes(1).includes('Xeque Duplo') && nomes(2).includes('Xeque da Rainha'))
  assert.ok(nomes(2).includes('Promoção') && nomes(2).includes('Roque'))
  for (const f of k.fases) for (const [, , nome, ataque] of f.cartas) if (ataque) assert.ok(ESPEC.king[nome], `sem jogada para ${nome}`)
  const tipos = (nome) => new Set(ESPEC.king[nome].cfg.jogadas.flat().map((p) => p.tipo))
  for (const n of nomes(0).filter((x) => ESPEC.king[x] && !ESPEC.king[x].xeque)) assert.ok([...tipos(n)].every((t) => ['peao', 'torre'].includes(t)), n)
  assert.ok(tipos('Bispos em V').has('bispo') && tipos('Salto do Cavalo').has('cavalo'))
  assert.ok(tipos('Promoção').has('peao') && ESPEC.king.Promoção.cfg.jogadas[0][0].promove)
  assert.ok(ESPEC.king.Roque.roque && ESPEC.king['Tabuleiro Virado'].roque)
  // todas as cartas montam ataque (sem a biblioteca: não usam `A`)
  for (const c of CARTAS_CHEFES.king.fases.flat()) assert.ok(ataqueDaCartaChefe(c, { ataques: {} }))
  assert.ok(ataqueDaCartaChefe(CARTAS_CHEFES.king.super, { ataques: {} }))
})

test('lacaios e Cavaleiro: registrados, da Expedição, escondidos da seleção, sem XEQUE', () => {
  for (const id of ['kingLacaios', 'kingTenente']) {
    assert.ok(CHEFES[id].expedicao && !ORDEM_CHEFES.includes(id))
    assert.ok(CHEFES[id].sprite && CHEFES[id].fundo && CHEFES[id].musica)
    for (const f of CHEFES[id].fases) for (const [, , nome, ataque] of f.cartas) if (ataque) assert.ok(ESPEC[id][nome] && !ESPEC[id][nome].xeque, `${id}/${nome}`)
  }
  assert.equal(CHEFES.kingLacaios.regra, undefined)
  assert.ok(CHEFES.kingTenente.regra)
  const tipos = new Set(Object.values(ESPEC.kingTenente).flatMap((e) => e.cfg.jogadas.flat().map((p) => p.tipo)))
  assert.deepEqual([...tipos], ['cavalo'])
  for (const e of Object.values(ESPEC.kingTenente)) assert.equal(e.cfg.tabuleiro.colunas, 4)
  const tipos2 = new Set(Object.values(ESPEC.kingLacaios).flatMap((e) => e.cfg.jogadas.flat().map((p) => p.tipo)))
  assert.ok([...tipos2].every((t) => ['peao', 'torre'].includes(t)))
  assert.ok(CHEFES.kingLacaios.hp < CHEFES.kingTenente.hp && CHEFES.kingTenente.hp < CHEFES.king.hp)
})
