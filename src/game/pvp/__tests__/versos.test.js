import { test } from 'node:test'
import assert from 'node:assert/strict'
import { corDoVerso, realcarVerso, versosDaSala, coresDosVersosDaPartida, versosDasVagas } from '../versos.js'

test('versosDasVagas: em salas de N cada vaga usa o verso (cor + arte) do seu participante; sem conta, o padrão', () => {
  const part = [
    { indice: 2, conta: { verso: 'verso.galaxia' } },
    { indice: 0, conta: { verso: 'verso.dourado' } },
    { indice: 3, conta: null }, // convidado sem login
    { indice: 1, conta: { verso: 'verso.inventado' } }, // id desconhecido
    { indice: 9, conta: { verso: 'verso.galaxia' } }, // fora das n vagas
  ]
  const v = versosDasVagas({ participantes: part, n: 4, emRede: true, perfil: { verso_equipado: 'verso.carmesim' } })
  assert.equal(v.length, 4)
  assert.deepEqual(v[0], { cor: realcarVerso(0x6e561e), arte: null }, 'verso liso: só a cor')
  assert.equal(v[2].arte, 'verso-galaxia', 'verso ilustrado: o id do registro')
  assert.notEqual(v[2].cor, null, 'a cor segue junto (o liso se o desenho não carregar)')
  assert.deepEqual(v[1], { cor: null, arte: null })
  assert.deepEqual(v[3], { cor: null, arte: null })
  assert.notDeepEqual(v[0], v[2], 'cada vaga o seu')
})

test('versosDasVagas: fora da rede só a vaga 0 usa o verso de quem está logado; sem nada, tudo padrão', () => {
  const v = versosDasVagas({ n: 3, perfil: { verso_equipado: 'verso.galaxia' } })
  assert.equal(v[0].arte, 'verso-galaxia')
  assert.deepEqual(v.slice(1), [{ cor: null, arte: null }, { cor: null, arte: null }])
  for (const entrada of [undefined, {}, { n: 4, perfil: null }, { n: 4, emRede: true, participantes: null }]) {
    assert.ok(versosDasVagas(entrada).every((x) => x.cor === null && x.arte === null))
  }
  assert.equal(versosDasVagas({ n: 4 }).length, 4)
})
import { CATALOGO } from '../../../lib/progresso.js'

test('corDoVerso: o da trilha vira a cor do catálogo; padrão e desconhecido ficam sem cor (verso de sempre)', () => {
  assert.equal(corDoVerso('verso.estrelas'), realcarVerso(0x1e2a6e))
  assert.equal(corDoVerso('verso.carmesim'), realcarVerso(0x6e1e2a))
  assert.equal(corDoVerso('verso.classico'), null, 'o padrão é o verso colorido pelo personagem')
  for (const lixo of [null, undefined, '', 'verso.inventado', 'moldura.bronze', 42, {}]) assert.equal(corDoVerso(lixo), null)
  // todo verso da trilha tem cor desenhável
  for (const i of CATALOGO.filter((x) => x.tipo === 'verso' && !x.padrao)) assert.notEqual(corDoVerso(i.id), null, i.id)
})

test('em rede cada lado usa o verso do seu jogador (host = lado 0); fora da rede, o de quem está logado', () => {
  const sala = { membros: [{ papel: 'host', conta: { verso: 'verso.dourado' } }, { papel: 'convidado', conta: { verso: null } }] }
  assert.deepEqual(versosDaSala(sala), ['verso.dourado', null])
  assert.deepEqual(coresDosVersosDaPartida({ sala, perfil: { verso_equipado: 'verso.estrelas' } }), [realcarVerso(0x6e561e), null], 'em rede o perfil local não manda')
  const invertida = { membros: [{ papel: 'convidado', conta: { verso: 'verso.estrelas' } }, { papel: 'host', conta: null }] }
  assert.deepEqual(coresDosVersosDaPartida({ sala: invertida }), [null, realcarVerso(0x1e2a6e)])
  // sala de um só (ainda não é partida em rede) ou sem sala: o local
  assert.deepEqual(coresDosVersosDaPartida({ sala: { membros: [sala.membros[0]] }, perfil: { verso_equipado: 'verso.carmesim' } }), [realcarVerso(0x6e1e2a), null])
  assert.deepEqual(coresDosVersosDaPartida({ perfil: null }), [null, null])
  assert.deepEqual(coresDosVersosDaPartida(), [null, null])
})

test('realcarVerso: mantém o matiz e fica bem mais claro que a cor do catálogo', () => {
  const lum = (c) => (Math.max((c >> 16) & 255, (c >> 8) & 255, c & 255) + Math.min((c >> 16) & 255, (c >> 8) & 255, c & 255)) / 510
  const matiz = (c) => {
    const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255
    return b > r && b > g ? 'azul' : g > b * 1.5 ? 'ouro' : 'vermelho'
  }
  for (const [base, tom] of [[0x1e2a6e, 'azul'], [0x6e1e2a, 'vermelho'], [0x6e561e, 'ouro']]) {
    const nova = realcarVerso(base)
    assert.ok(lum(nova) > lum(base) + 0.08, `${base.toString(16)} -> ${nova.toString(16)}`)
    assert.equal(matiz(nova), tom)
  }
})

test('as arenas de 3 e 4 ligam o verso de cada vaga ao monte, à carta virada, à mão e à revelação', async () => {
  const { readFileSync } = await import('node:fs')
  for (const arquivo of ['PvpArenaN', 'CoopArenaN']) {
    const fonte = readFileSync(new URL(`../../scenes/${arquivo}.js`, import.meta.url), 'utf8')
    assert.match(fonte, /versosDasVagasDaPartida\(this\.n\)/, `${arquivo}: o verso de cada vaga`)
    assert.match(fonte, /criarMonte\(this, \{[^}]*verso: this\.versos\[/, `${arquivo}: o monte de cada vaga com o verso dela`)
    assert.match(fonte, /criarViradaEscolhida\(this, \{[^}]*verso: this\.versos\[/, `${arquivo}: a carta virada de cada vaga`)
    assert.match(fonte, /new Mao\(this, \{[^\n]*corVerso: this\.versos\[this\.meu\]\.cor, arteVerso: this\.versos\[this\.meu\]\.arte/, `${arquivo}: a minha mão`)
    assert.match(fonte, /corVerso: this\.versos\[j\]\.cor, arteVerso: this\.versos\[j\]\.arte/, `${arquivo}: as cartas reveladas de cada um`)
  }
})
