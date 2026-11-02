import { test } from 'node:test'
import assert from 'node:assert/strict'
import { semanaDe, semanaDoId, inicioDoDia, chefeDaSemana, trofeuDaSemana, trofeuDoId, infoSemanal, lerInfoSemanal, textoRestante, AGENDA, DIA_MS } from '../semanal.js'

const t = (iso) => Date.parse(iso)

test('a semana vira na segunda 00:00 de São Paulo (UTC-3), não na do UTC', () => {
  // domingo 23:59 em SP = segunda 02:59 UTC: ainda é a semana anterior
  const antes = semanaDe(t('2026-11-02T02:59:00Z'))
  const depois = semanaDe(t('2026-11-02T03:00:00Z'))
  assert.equal(antes.id, '2026-S44')
  assert.equal(depois.id, '2026-S45')
  assert.equal(depois.inicio, t('2026-11-02T03:00:00Z'))
  assert.equal(depois.fim, t('2026-11-09T03:00:00Z'))
  assert.equal(antes.fim, depois.inicio)
  assert.equal(depois.indice, 0)
  assert.equal(antes.indice, -1)
  // o meio da semana, perto da virada do ano (semana ISO 53 de 2026 e a 1 de 2027)
  assert.equal(semanaDe(t('2026-12-31T12:00:00Z')).id, '2026-S53')
  assert.equal(semanaDe(t('2027-01-04T03:00:00Z')).id, '2027-S01')
})

test('horário de verão (o Brasil tinha até 2019): a meia-noite pulada e a hora repetida', () => {
  // 2018-11-04: 00:00 virou 01:00 (o domingo começou às 01:00 -02, 03:00 UTC)
  const domingo = Date.UTC(2018, 10, 4) / DIA_MS
  assert.equal(inicioDoDia(domingo), t('2018-11-04T03:00:00Z'))
  // a segunda seguinte (já no horário de verão, -02) começa às 02:00 UTC
  const s = semanaDe(t('2018-11-05T02:30:00Z'))
  assert.equal(s.inicio, t('2018-11-05T02:00:00Z'))
  assert.equal(s.fim, t('2018-11-12T02:00:00Z'))
  assert.equal(semanaDe(t('2018-11-05T01:59:59Z')).id, semanaDe(t('2018-11-04T12:00:00Z')).id)
  // 2019-02-16: 24:00 voltou a 23:00 (sábado com uma hora repetida); a segunda 18 começa às 03:00 UTC
  assert.equal(semanaDe(t('2019-02-18T03:00:00Z')).inicio, t('2019-02-18T03:00:00Z'))
  // toda semana tem 7 dias de 24 h (menos/mais uma hora na troca de horário) e emenda na outra
  let s2 = semanaDe(t('2018-01-01T12:00:00Z'))
  for (let i = 0; i < 120; i++) {
    const prox = semanaDe(s2.fim)
    assert.equal(prox.inicio, s2.fim)
    assert.ok(Math.abs(s2.fim - s2.inicio - 7 * DIA_MS) <= 3_600_000)
    s2 = prox
  }
})

test('o id da semana volta para a mesma semana', () => {
  for (const iso of ['2026-11-04T10:00:00Z', '2027-06-30T23:00:00Z', '2020-12-31T12:00:00Z']) {
    const s = semanaDe(t(iso))
    const de = semanaDoId(s.id)
    assert.equal(de.inicio, s.inicio)
    assert.equal(de.indice, s.indice)
  }
  assert.equal(semanaDoId('2026-S54'), null)
  assert.equal(semanaDoId('2027-S53'), null) // 2027 não tem semana 53
  assert.equal(semanaDoId('lixo'), null)
})

test('agenda: semana N = AGENDA[N % tamanho], também para trás', () => {
  assert.deepEqual(AGENDA.slice(0, 2), ['escuridao', 'ladra'])
  assert.equal(chefeDaSemana(0), 'escuridao')
  assert.equal(chefeDaSemana(1), 'ladra')
  assert.equal(chefeDaSemana(2), 'escuridao')
  assert.equal(chefeDaSemana(-1), AGENDA[AGENDA.length - 1])
  assert.equal(infoSemanal(t('2026-11-03T12:00:00Z')).chefe, 'escuridao')
  assert.equal(infoSemanal(t('2026-11-10T12:00:00Z')).chefe, 'ladra')
})

test('troféu: único por semana (nunca volta), reconstruído pelo id, tipo gira', () => {
  const ids = new Set()
  let s = semanaDe(t('2026-11-03T12:00:00Z'))
  const tipos = []
  for (let i = 0; i < 60; i++) {
    const tr = trofeuDaSemana(s)
    assert.ok(!ids.has(tr.id), `repetiu ${tr.id}`)
    ids.add(tr.id)
    assert.match(tr.id, /^(titulo|moldura|verso)\.semanal_\d{4}_\d{2}$/)
    assert.ok(tr.nome.length <= 32)
    assert.deepEqual(trofeuDoId(tr.id), tr)
    tipos.push(tr.tipo)
    s = semanaDe(s.fim)
  }
  assert.deepEqual(tipos.slice(0, 6), ['titulo', 'titulo', 'moldura', 'moldura', 'verso', 'verso'])
  assert.equal(trofeuDoId('moldura.semanal_2026_45'), null) // a S45 é título
  assert.equal(trofeuDoId('titulo.novato'), null)
})

test('info do servidor e o que o navegador aceita', () => {
  const agora = t('2026-11-06T15:00:00Z')
  const info = infoSemanal(agora)
  assert.equal(info.semana, '2026-S45')
  assert.equal(info.restanteMs, t('2026-11-09T03:00:00Z') - agora)
  assert.ok(info.mecanica.split(' ').length <= 6)
  const lido = lerInfoSemanal(JSON.parse(JSON.stringify(info)))
  assert.equal(lido.trofeu.id, info.trofeu.id)
  assert.equal(lerInfoSemanal({ ...info, chefe: 'ladra' }), null) // chefe que não é o da semana
  assert.equal(lerInfoSemanal({ semana: 'x' }), null)
  assert.equal(textoRestante(3 * DIA_MS + 4 * 3_600_000 + 5000), '3d 04h')
  assert.equal(textoRestante(5 * 3_600_000 + 12 * 60_000), '05h 12m')
  assert.equal(textoRestante(12 * 60_000 + 3000), '12m 03s')
})
