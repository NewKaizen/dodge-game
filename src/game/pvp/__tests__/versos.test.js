import { test } from 'node:test'
import assert from 'node:assert/strict'
import { corDoVerso, realcarVerso, versosDaSala, coresDosVersosDaPartida } from '../versos.js'
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
