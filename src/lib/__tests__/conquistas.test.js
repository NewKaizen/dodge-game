// node --test src/lib/__tests__/conquistas.test.js
// CONQUISTAS e MAESTRIA puras (src/lib/conquistas.js): a conta dos níveis, os cosméticos de cada
// personagem e QUAIS conquistas cada evento cumpre (o servidor decide com isto; o banco só grava).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CONQUISTAS, IDS_CONQUISTAS, conquistasDoEvento, conquistaDe, pontosDeMaestria, nivelDaMaestria, progressoDaMaestria, MAESTRIA_NIVEIS, MAESTRIA_MAXIMA, ITENS_MAESTRIA, itensDaMaestriaAte, itemDaMaestria, PERSONAGENS_MAESTRIA, NIVEL_TITULO_MAESTRIA } from '../conquistas.js'
import { PERSONAGENS } from '../../game/data/personagens.js'

test('maestria: pontos por resultado e os níveis', () => {
  assert.equal(pontosDeMaestria('vitoria'), 3)
  assert.equal(pontosDeMaestria('derrota'), 1)
  assert.equal(pontosDeMaestria('participacao'), 1)
  assert.equal(pontosDeMaestria('abandono'), 0)
  assert.equal(pontosDeMaestria('suspeita'), 0)
  assert.equal(nivelDaMaestria(0), 1)
  assert.equal(nivelDaMaestria(9), 1)
  assert.equal(nivelDaMaestria(10), 2)
  assert.equal(nivelDaMaestria(100), 5)
  assert.equal(nivelDaMaestria(449), 9)
  assert.equal(nivelDaMaestria(450), MAESTRIA_MAXIMA)
  assert.equal(nivelDaMaestria(1e9), MAESTRIA_MAXIMA)
  assert.equal(nivelDaMaestria(-5), 1)
  assert.equal(nivelDaMaestria('lixo'), 1)
  // os níveis sobem sempre (e cada vez custam mais)
  for (let i = 2; i < MAESTRIA_NIVEIS.length; i++) assert.ok(MAESTRIA_NIVEIS[i] - MAESTRIA_NIVEIS[i - 1] >= MAESTRIA_NIVEIS[i - 1] - MAESTRIA_NIVEIS[i - 2])
  assert.deepEqual(progressoDaMaestria(15), { nivel: 2, atual: 5, proximo: 20, fracao: 0.25 })
  assert.equal(progressoDaMaestria(9999).fracao, 1)
  assert.equal(progressoDaMaestria(9999).proximo, null)
})

test('cosméticos da maestria: um título e uma moldura por personagem, nunca da trilha de níveis', () => {
  assert.deepEqual(PERSONAGENS_MAESTRIA.slice().sort(), Object.keys(PERSONAGENS).sort())
  assert.equal(ITENS_MAESTRIA.length, PERSONAGENS_MAESTRIA.length * 2)
  for (const i of ITENS_MAESTRIA) {
    assert.match(i.id, /^(titulo|moldura)\.maestria_[a-z]+$/)
    assert.ok(i.nome.length <= 32, i.nome)
    assert.equal(itemDaMaestria(i.id), i)
  }
  assert.deepEqual(itensDaMaestriaAte('kris', 4), [])
  assert.deepEqual(itensDaMaestriaAte('kris', 5).map((i) => i.id), ['titulo.maestria_kris'])
  assert.deepEqual(itensDaMaestriaAte('kris', 10).map((i) => i.id), ['titulo.maestria_kris', 'moldura.maestria_kris'])
})

test('conquistas: ids únicos, nomes curtos, as ocultas existem', () => {
  assert.equal(new Set(IDS_CONQUISTAS).size, CONQUISTAS.length)
  assert.ok(CONQUISTAS.length >= 12 && CONQUISTAS.length <= 20)
  for (const c of CONQUISTAS) {
    assert.match(c.id, /^[a-z_]{2,32}$/)
    assert.ok(c.nome.length <= 24 && c.descricao.length <= 80, c.id)
  }
  assert.ok(CONQUISTAS.some((c) => c.oculta))
  assert.equal(conquistaDe('coruja').oculta, true)
  assert.equal(conquistaDe('nada'), null)
})

test('gatilhos: cada evento cumpre só o que é dele', () => {
  const v = (ev, r = {}) => conquistasDoEvento(ev, r).sort()
  // vitória no PVP: a primeira; "sem dano" não vale (o servidor não vê o dano do PVP)
  assert.deepEqual(v({ tipo: 'partida', modo: 'pvp', resultado: 'vitoria', acertos: 0 }), ['primeira_vitoria'])
  assert.deepEqual(v({ tipo: 'partida', modo: 'pvp', resultado: 'derrota' }), [])
  assert.deepEqual(v({ tipo: 'partida', modo: '2x2', resultado: 'vitoria' }), ['dupla_afinada', 'primeira_vitoria'])
  assert.deepEqual(v({ tipo: 'partida', modo: 'ffa', resultado: 'vitoria' }), ['primeira_vitoria', 'ultimo_de_pe'])
  assert.deepEqual(v({ tipo: 'partida', modo: 'coop4', resultado: 'vitoria' }), ['mesa_cheia', 'primeira_vitoria'])
  assert.deepEqual(v({ tipo: 'partida', modo: 'coop', resultado: 'vitoria', trofeuSemanal: true }), ['cacador_semanal', 'primeira_vitoria'])
  // campanha: sem levar acerto, a última porta, 3 estrelas, por um fio
  assert.deepEqual(v({ tipo: 'campanha', resultado: 'vitoria', acertos: 0, hpFracao: 1, mundo: 1, ultimaFase: true, estrelas: 3 }), ['casa_silenciosa', 'intocavel', 'primeira_vitoria', 'tres_estrelas'])
  assert.deepEqual(v({ tipo: 'campanha', resultado: 'vitoria', acertos: 4, hpFracao: 0.08, mundo: 1, estrelas: 1 }), ['por_um_fio', 'primeira_vitoria'])
  assert.deepEqual(v({ tipo: 'campanha', resultado: 'derrota', acertos: 0, mundo: 1, ultimaFase: true, estrelas: 0 }), [])
  // desafio: bom dia; coruja de madrugada; constância com o cosmético da semana; 7 desafios no total
  assert.deepEqual(v({ tipo: 'desafio', resultado: 'vitoria', acertos: 2, hpFracao: 0.5, hora: 14 }), ['bom_dia', 'primeira_vitoria'])
  assert.ok(v({ tipo: 'desafio', resultado: 'vitoria', acertos: 2, hpFracao: 0.5, hora: 3 }).includes('coruja'))
  assert.ok(!v({ tipo: 'desafio', resultado: 'vitoria', acertos: 2, hpFracao: 0.5, hora: 5 }).includes('coruja'))
  assert.ok(v({ tipo: 'desafio', resultado: 'vitoria', cosmeticoSemana: true }).includes('constancia'))
  assert.ok(v({ tipo: 'desafio', resultado: 'vitoria' }, { desafios: 7 }).includes('sete_sois'))
  assert.ok(!v({ tipo: 'desafio', resultado: 'vitoria' }, { desafios: 6 }).includes('sete_sois'))
  // o resumo da conta: vitórias, partidas, elenco e maestria
  assert.ok(v({ tipo: 'partida', resultado: 'derrota' }, { vitorias: 10 }).includes('mao_firme'))
  assert.ok(v({ tipo: 'partida', resultado: 'derrota' }, { vitorias: 50 }).includes('lenda_da_mesa'))
  assert.ok(v({ tipo: 'partida', resultado: 'derrota' }, { partidas: 100 }).includes('cadeira_cativa'))
  const todos = Object.fromEntries(PERSONAGENS_MAESTRIA.map((p) => [p, 1]))
  assert.ok(v({ tipo: 'partida', resultado: 'derrota' }, { maestria: todos }).includes('elenco_completo'))
  assert.ok(!v({ tipo: 'partida', resultado: 'derrota' }, { maestria: { ...todos, asriel: 0 } }).includes('elenco_completo'))
  assert.ok(v({ tipo: 'partida', resultado: 'derrota' }, { maestria: { kris: MAESTRIA_NIVEIS[NIVEL_TITULO_MAESTRIA - 1] } }).includes('alma_gemea'))
  assert.ok(!v({ tipo: 'partida', resultado: 'derrota' }, { maestria: { kris: MAESTRIA_NIVEIS[NIVEL_TITULO_MAESTRIA - 1] - 1 } }).includes('alma_gemea'))
  // tudo que sai é conquista que existe
  for (const id of v({ tipo: 'campanha', resultado: 'vitoria', acertos: 0, hpFracao: 0.05, mundo: 1, ultimaFase: true, estrelas: 3, trofeuSemanal: true, cosmeticoSemana: true, hora: 1 }, { vitorias: 99, partidas: 999, desafios: 9, maestria: todos })) assert.ok(IDS_CONQUISTAS.includes(id))
})
