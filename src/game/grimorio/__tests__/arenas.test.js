// node --test src/game/grimorio/__tests__/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PAGINAS_ARENA, PAGINAS_GUIA, fichaDaArena, fichaDoEvento, cartasDaPreviaBonus } from '../arenas.js'
import { PAGINAS } from '../fichas.js'
import { ARENAS, eventosDaArena } from '../../pvp/arenas.js'
import { EVENTO, EVENTOS } from '../../pvp/bonus.js'
import { ehSuper, resumoDoAtaque } from '../../pvp/cartas.js'

test('uma página por arena do PvP, na ordem da votação', () => {
  assert.deepEqual(
    PAGINAS_ARENA.map((p) => p.id),
    ARENAS.map((a) => a.id),
  )
  for (const p of PAGINAS_ARENA) assert.equal(p.tipo, 'arena')
})

test('o Guia tem as páginas das cartas e depois as das arenas, sem id repetido', () => {
  assert.deepEqual(PAGINAS_GUIA, [...PAGINAS, ...PAGINAS_ARENA])
  // a tela guarda o item em foco de cada página pelo id
  assert.equal(new Set(PAGINAS_GUIA.map((p) => p.id)).size, PAGINAS_GUIA.length)
})

test('a página traz todos os eventos da arena, uma vez só, com os grupos cobrindo tudo', () => {
  for (const arena of ARENAS) {
    const ficha = fichaDaArena(arena.id)
    assert.equal(ficha.nome, arena.nome)
    assert.ok(ficha.descricao)
    const esperados = eventosDaArena(arena.id).map((ev) => ev.id)
    assert.deepEqual([...ficha.eventos.map((e) => e.id)].sort(), [...esperados].sort(), arena.id)
    assert.equal(new Set(ficha.eventos.map((e) => e.id)).size, ficha.eventos.length, `${arena.id}: evento repetido`)
    assert.equal(ficha.grupos[0].inicio, 0)
    assert.equal(ficha.grupos[ficha.grupos.length - 1].fim, ficha.eventos.length - 1)
    for (let k = 1; k < ficha.grupos.length; k++) assert.equal(ficha.grupos[k].inicio, ficha.grupos[k - 1].fim + 1)
    // os que caem em todas as arenas vêm primeiro
    const emTodas = ficha.eventos.map((e) => e.emTodas)
    assert.deepEqual(emTodas, [...emTodas].sort((a, b) => b - a), arena.id)
  }
})

test('cada evento tem nome, cor, descrição e números; a dica, quando existe, é texto de verdade', () => {
  for (const arena of ARENAS) {
    for (const ev of fichaDaArena(arena.id).eventos) {
      assert.ok(ev.nome && ev.nomeOriginal, ev.id)
      assert.equal(typeof ev.cor, 'number', ev.id)
      assert.ok(ev.descricao.length > 5, ev.id)
      assert.equal(ev.descricao[0], ev.descricao[0].toUpperCase(), `${ev.id}: começa com maiúscula`)
      assert.ok(ev.numeros.length >= 2, ev.id)
      for (const n of ev.numeros) assert.ok(n.rotulo && n.valor, ev.id)
      if (ev.dica !== null) assert.ok(ev.dica.length > 20, ev.id)
      assert.ok(!ev.tambemEm.some((a) => a.id === arena.id), `${ev.id}: "também em" não repete a própria arena`)
    }
  }
})

test('o nome e a descrição próprios da arena valem (ex.: o aquário vira LAGO no Jardim)', () => {
  const renomeados = ARENAS.flatMap((a) => a.bonus.filter((b) => typeof b === 'object' && EVENTO[b.id]).map((b) => ({ arena: a.id, ...b })))
  assert.ok(renomeados.length > 0)
  for (const r of renomeados) {
    const ev = fichaDaArena(r.arena).eventos.find((e) => e.id === r.id)
    if (r.nome) assert.equal(ev.nome, r.nome)
    assert.equal(ev.nomeOriginal, EVENTO[r.id].nome)
    if (r.nome && r.nome !== EVENTO[r.id].nome) assert.ok(ev.numeros.some((n) => n.valor === EVENTO[r.id].nome), `${r.id}: diz qual evento é`)
  }
})

test('evento que some de EVENTOS some da página; evento desconhecido não quebra a ficha', () => {
  // eventosDaArena já filtra ids que não existem: a ficha só vê os que existem
  for (const arena of ARENAS) for (const ev of fichaDaArena(arena.id).eventos) assert.ok(EVENTO[ev.id], ev.id)
  // um evento novo, sem dica escrita: ficha sem dica, mas com tudo o mais
  const novo = fichaDoEvento({ id: 'inventado', nome: 'EVENTO NOVO', descricao: 'algo acontece', cartas: 'normal', cor: 0x123456 }, 'castelo')
  assert.equal(novo.dica, null)
  assert.equal(novo.descricao, 'Algo acontece')
  assert.equal(novo.previa, false)
  assert.ok(novo.numeros.length >= 2)
})

test('a dica só vale para o evento com o nome para o qual foi escrita', () => {
  const ev = EVENTOS.find((e) => e.id === 'gelo')
  assert.ok(fichaDoEvento(ev, 'castelo').dica)
  // simula outro agente trocando o evento mas mantendo o id
  const original = EVENTO.gelo.nome
  EVENTO.gelo.nome = 'MINIGAME NOVO'
  try {
    assert.equal(fichaDoEvento({ ...ev, nome: 'MINIGAME NOVO' }, 'castelo').dica, null)
  } finally {
    EVENTO.gelo.nome = original
  }
})

test('prévia ao vivo: só para os eventos que têm efeito', () => {
  const efeitos = { gelo: () => ({}) }
  const ficha = fichaDaArena('castelo', { efeitos })
  for (const ev of ficha.eventos) assert.equal(ev.previa, ev.id === 'gelo', ev.id)
})

test('as cartas da prévia ao vivo são ataques medianos que não invertem os controles', () => {
  const cartas = cartasDaPreviaBonus()
  assert.ok(cartas.length >= 20)
  for (const c of cartas) {
    assert.ok(!ehSuper(c), c.id)
    assert.notEqual(c.naipe, 'copas', c.id)
    assert.ok(c.valor >= 4 && c.valor <= 12, c.id)
    assert.ok(!resumoDoAtaque(c).inverterMs, c.id)
  }
})
