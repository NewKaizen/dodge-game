// Filtro de palavrões (src/lib/filtro + palavrasBloqueadas.js): positivos com
// disfarces, negativos com palavras que contêm pedaços de palavrão, chat,
// nomes, desempenho e dados. O SQL gerado (0008) é conferido em
// server/__tests__/moderacaoSql.test.js e aqui só "está em dia com os dados".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { nomeOfensivo, censurarTexto } from '../palavrasBloqueadas.js'
import { EXATAS, COLADAS, PERMITIDAS, LEVES } from '../filtro/ptbr.js'
import { gerarSql } from '../../../scripts/gerar-filtro-sql.mjs'
import { POSITIVOS, NEGATIVOS } from './filtroCasos.js'

test('positivos: palavrão e disfarces (leet, repetição, separadores, acento, maiúsculas)', () => {
  assert.ok(POSITIVOS.length >= 40)
  for (const texto of POSITIVOS) {
    assert.equal(nomeOfensivo(texto), true, `nomeOfensivo(${texto})`)
    assert.notEqual(censurarTexto(texto), texto, `censurarTexto(${texto})`)
  }
})

test('negativos: palavras inocentes que só contêm pedaços de palavrão', () => {
  assert.ok(NEGATIVOS.length >= 30)
  for (const texto of NEGATIVOS) {
    assert.equal(nomeOfensivo(texto), false, `nomeOfensivo(${texto})`)
    assert.equal(censurarTexto(texto), texto, `censurarTexto(${texto})`)
  }
})

test('chat: troca só o trecho ofensivo por asteriscos do mesmo tamanho', () => {
  assert.equal(censurarTexto('boa partida, seu fdp'), 'boa partida, seu ***')
  assert.equal(censurarTexto('que PORRA de jogo, vsf'), 'que ***** de jogo, ***')
  assert.equal(censurarTexto('vai tomar no cu'), 'vai tomar no **')
  assert.equal(censurarTexto('xcaralhox'), 'x*******x')
  assert.equal(censurarTexto('p.o.r.r.a'), '*********')
  assert.equal(censurarTexto('ótimo 😀 puta'), 'ótimo 😀 ****')
  for (const texto of [...POSITIVOS, ...NEGATIVOS, 'GG 😀😀 fdp 😀', '']) {
    assert.equal([...censurarTexto(texto)].length, [...texto].length, texto)
  }
  assert.equal(censurarTexto(null), '')
  assert.equal(censurarTexto('meu computador travou, que pena'), 'meu computador travou, que pena')
})

test('nomes: barra palavrão e deixa nome normal', () => {
  for (const ruim of ['Caralho', 'c.a.r.a.l.h.o', 'Put4', 'puta_x', 'Hitler99', 'N1gger', 'xx PORRA xx']) assert.equal(nomeOfensivo(ruim), true, ruim)
  for (const bom of ['Computador', 'Disputa', 'Ana Maria', 'João', 'Shiitake', 'Dickens', 'Analista', 'Kris', 'Susie 2000', 'Rapedo', 'Bostoniano']) assert.equal(nomeOfensivo(bom), false, bom)
})

test('leves: xingamento brando só vale se pedir', () => {
  for (const leve of LEVES) {
    assert.equal(nomeOfensivo(leve), false, leve)
    assert.equal(nomeOfensivo(leve, { leves: true }), true, leve)
  }
  assert.equal(censurarTexto('seu otário', { leves: true }), 'seu ******')
})

test('desempenho: 1.000 mensagens em menos de 200 ms', () => {
  const modelo = ['boa partida galera, gg!', 'seu fdp que jogo ruim', 'vamos jogar de novo? computador travou', 'c4r4lh0 mano que isso', 'nao consigo desviar dos ataques do chefe agora']
  const mensagens = Array.from({ length: 1000 }, (_, i) => modelo[i % modelo.length])
  censurarTexto('aquecer') // monta os matchers (uma vez só, no primeiro uso)
  const ini = performance.now()
  for (const m of mensagens) censurarTexto(m)
  const ms = performance.now() - ini
  assert.ok(ms < 200, `${ms.toFixed(0)} ms`)
})

test('dados: termos normalizados, sem repetição e a lista é grande', () => {
  for (const [nome, lista] of Object.entries({ EXATAS, COLADAS, LEVES })) {
    assert.deepEqual(lista.filter((t) => !/^[a-z]+$/.test(t)), [], `${nome}: só a-z minúsculas`)
    assert.deepEqual(lista.filter((t, i) => lista.indexOf(t) !== i), [], `${nome}: sem repetidos`)
  }
  assert.deepEqual(PERMITIDAS.filter((t) => !/^[a-z ]+$/.test(t)), [])
  assert.ok(EXATAS.length + COLADAS.length >= 150)
  assert.deepEqual(LEVES.filter((t) => EXATAS.includes(t) || COLADAS.includes(t)), [], 'leve não pode estar na lista forte')
})

test('0008_filtro_palavras.sql está em dia com os dados (rode scripts/gerar-filtro-sql.mjs)', () => {
  const arquivo = readFileSync(fileURLToPath(new URL('../../../supabase/migrations/0008_filtro_palavras.sql', import.meta.url)), 'utf8')
  assert.equal(arquivo, gerarSql())
})
