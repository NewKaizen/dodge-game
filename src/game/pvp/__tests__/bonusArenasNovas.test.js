// node --test src/game/pvp/__tests__/
// Os bônus das arenas ESTAÇÃO ESPACIAL, CHINATOWN e CIDADE GRANDE: as arenas, as listas, e os PLANOS dos eventos
// novos (DRAGÃO, LANTERNAS, TRÂNSITO, OBRA; pvp/bonus/eventos/planosArenas.js): repetíveis pela
// semente, sempre telegrafados e sempre com um corredor de fuga (o mesmo critério de attacks/validacao.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ARENAS, ARENA, BONUS_POR_ARENA, eventosDaArena } from '../arenas.js'
import { EVENTO } from '../bonus.js'
import { criarRng, aleatorio } from '../baralho.js'
import { ATAQUE } from '../../constants.js'
import { LACUNA_MINIMA } from '../../attacks/validacao.js'
import {
  REF_CAIXA, DRAGAO, LANTERNAS, TRANSITO, OBRA, FAIXAS_TRANSITO, VEICULOS,
  planoDragao, caminhoDoDragao, planoLanternas, planoTransito, travessiaDoVeiculo, planoObra, maiorLacuna,
} from '../bonus/eventos/planosArenas.js'

const sorteDe = (semente) => {
  const rng = criarRng(semente)
  return () => aleatorio(rng) // como a arena faz: criarRng(`${semente}:efeito:${rodada}`) -> () => aleatorio(rng)
}
const SEMENTES = Array.from({ length: 40 }, (_, i) => `arenas-novas:${i}`)
// (os 8 eventos da ESTAÇÃO são conferidos em eventosEstacao.test.js)
const NOVOS = { estacao: [], chinatown: [], cidade: ['transito', 'obra'] }

test('arenas novas: existem, com música própria, e a lista de bônus tem no mínimo BONUS_POR_ARENA eventos válidos', () => {
  for (const id of Object.keys(NOVOS)) {
    const a = ARENA[id]
    assert.ok(a, id)
    assert.equal(a.musica, `arena_${id}`)
    assert.ok(a.tituloMusica && a.descricao && a.curto && a.nome)
    assert.ok(a.moldura.alpha > 0, 'véu por cima do fundo')
    const eventos = eventosDaArena(id)
    assert.ok(eventos.length >= BONUS_POR_ARENA, `${id}: ${eventos.length}`)
    assert.equal(new Set(eventos.map((e) => e.id)).size, eventos.length, `${id}: evento repetido`)
    for (const geral of ['duelo', 'malucas']) assert.ok(eventos.some((e) => e.id === geral), `${id} sem ${geral}`)
    for (const novo of NOVOS[id]) assert.ok(eventos.some((e) => e.id === novo), `${id} sem ${novo}`)
    for (const e of eventos) assert.ok(e.nome && e.descricao && typeof e.cor === 'number', `${id}/${e.id}`)
  }
  assert.equal(new Set(ARENAS.map((a) => a.id)).size, ARENAS.length)
})

test('os eventos novos existem como eventos de esquiva, com a ficha e o efeito registrados', () => {
  const efeitos = readFileSync(new URL('../bonus/eventos/index.js', import.meta.url), 'utf8')
  for (const id of Object.values(NOVOS).flat()) {
    assert.equal(EVENTO[id].cartas, 'normal', id)
    assert.equal(EVENTO[id].nome, EVENTO[id].nome.toUpperCase(), `${id}: nome em caixa alta`)
    assert.match(efeitos, new RegExp(`import ${id} from './${id}.js'`), `${id} falta no index de efeitos`)
    assert.match(efeitos, new RegExp(`\\b${id}\\b[^\\n]*\\}$`, 'm'), `${id} falta no objeto EFEITOS`)
  }
})

test('renomeados: o evento reaproveitado ganha o nome da arena sem mudar o evento original', () => {
  const nomes = (arena) => Object.fromEntries(eventosDaArena(arena).map((e) => [e.id, e.nome]))
  assert.equal(nomes('cidade').apagao, 'BLECAUTE')
  assert.equal(EVENTO.gravidade.nome, 'GRAVIDADE MALUCA')
  assert.equal(EVENTO.apagao.nome, 'APAGÃO')
})

// ---------- planos ----------

// em ordem crescente e com `aviso` de pelo menos ATAQUE.telegrafoMs
const emOrdem = (lista) => lista.every((x, i) => i === 0 || x.em > lista[i - 1].em)

test('DRAGÃO: repetível, telegrafado, e a onda do corpo deixa um corredor livre em toda a travessia', () => {
  assert.ok(DRAGAO.avisoMs >= ATAQUE.telegrafoMs)
  for (const semente of SEMENTES) {
    const plano = planoDragao(sorteDe(semente))
    assert.deepEqual(plano, planoDragao(sorteDe(semente)))
    assert.ok(plano.length >= 5 && emOrdem(plano))
    plano.forEach((d, i) => {
      assert.ok(maiorLacuna(REF_CAIXA.altura, [d.faixa]) >= LACUNA_MINIMA, 'sem rota de fuga')
      // o caminho de verdade (a senoide) fica dentro da faixa que o plano garantiu
      for (let x = -40; x <= REF_CAIXA.largura + 40; x += 5) {
        const y = caminhoDoDragao(d, REF_CAIXA, x)
        assert.ok(y - DRAGAO.raioCorpo >= d.faixa[0] - 1 && y + DRAGAO.raioCorpo <= d.faixa[1] + 1, `senoide fora da faixa em x=${x}`)
      }
      // um dragão sai antes do próximo aparecer
      if (i) {
        const duracao = ((DRAGAO.segmentos * DRAGAO.espaco + REF_CAIXA.largura + 120) / DRAGAO.velocidade) * 1000
        assert.ok(plano[i].em - plano[i - 1].em >= duracao * 0.8, 'dragões não se atropelam')
      }
    })
  }
})

test('LANTERNAS: repetível, telegrafado, e as colunas das lanternas deixam uma faixa livre na largura', () => {
  assert.ok(LANTERNAS.avisoMs >= ATAQUE.telegrafoMs)
  for (const semente of SEMENTES) {
    const plano = planoLanternas(sorteDe(semente))
    assert.deepEqual(plano, planoLanternas(sorteDe(semente)))
    assert.ok(plano.length >= 8 && emOrdem(plano))
    for (const onda of plano) {
      assert.ok(onda.lanternas.length >= 2 && onda.lanternas.length <= 4)
      assert.ok(maiorLacuna(REF_CAIXA.largura, onda.lanternas.map((l) => l.faixa)) >= LACUNA_MINIMA, 'sem rota de fuga')
    }
  }
})

test('TRÂNSITO: repetível, telegrafado, nunca todas as faixas e uma onda por vez', () => {
  assert.ok(TRANSITO.avisoMs >= ATAQUE.telegrafoMs)
  for (const semente of SEMENTES) {
    const plano = planoTransito(sorteDe(semente))
    assert.deepEqual(plano, planoTransito(sorteDe(semente)))
    assert.ok(plano.length >= 8 && emOrdem(plano))
    plano.forEach((onda, i) => {
      assert.ok(onda.faixas.length >= 1 && onda.faixas.length <= FAIXAS_TRANSITO - 1, 'sempre sobra uma faixa livre')
      assert.equal(new Set(onda.faixas.map((f) => f.faixa)).size, onda.faixas.length)
      for (const f of onda.faixas) {
        assert.ok(f.faixa >= 0 && f.faixa < FAIXAS_TRANSITO && VEICULOS[f.tipo])
        assert.equal(f.dir, f.faixa % 2 === 0 ? 1 : -1, 'sentidos alternados')
      }
      if (i) {
        const anterior = plano[i - 1]
        const acaba = anterior.em + TRANSITO.avisoMs + Math.max(...anterior.faixas.map((f) => travessiaDoVeiculo(f.tipo, REF_CAIXA.largura)))
        assert.ok(onda.em >= acaba, 'a onda nova só começa quando a anterior saiu')
      }
    })
  }
})

test('OBRA: repetível, telegrafado, e as colunas das vigas deixam um corredor livre', () => {
  assert.ok(OBRA.avisoMs >= ATAQUE.telegrafoMs && OBRA.quedaMs < OBRA.avisoMs)
  for (const semente of SEMENTES) {
    const plano = planoObra(sorteDe(semente))
    assert.deepEqual(plano, planoObra(sorteDe(semente)))
    assert.ok(plano.length >= 8 && emOrdem(plano))
    plano.forEach((onda, i) => {
      assert.ok(onda.vigas.length >= 1 && onda.vigas.length <= 3)
      assert.ok(maiorLacuna(REF_CAIXA.largura, onda.vigas.map((v) => v.faixa)) >= LACUNA_MINIMA + 20, 'sem rota de fuga')
      // a viga acaba de cair (e de machucar) antes da próxima onda avisar
      if (i) assert.ok(onda.em - plano[i - 1].em >= OBRA.quedaMs + OBRA.batidaMs, 'ondas não se sobrepõem')
    })
  }
})
