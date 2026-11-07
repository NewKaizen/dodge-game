// node --test src/game/__tests__/musicaTrilhas.test.js
// As músicas novas (scripts/musica/trilhas.mjs): arquivos válidos, em loop exato, no andamento e na
// tonalidade que prometem, e o arquivo no disco é o que o script gera.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { lerMidi } from '../../../scripts/musica/midi.mjs'
import { TRILHAS, PPQ, acorde, paraMaior } from '../../../scripts/musica/trilhas.mjs'

const pasta = new URL('../../../public/assets/musicas/', import.meta.url)
// a escala de cada uma (classes de altura) e o andamento esperado (bpm) e a duração do loop (s)
const MENOR_HARMONICA = (t) => [0, 2, 3, 5, 7, 8, 10, 11].map((i) => (t + i) % 12)
const MAIOR = (t) => [0, 2, 4, 5, 7, 9, 11].map((i) => (t + i) % 12)
const ESPERADO = {
  'campanha_luta.mid': { escala: [...MENOR_HARMONICA(2), 0, 4], bpm: [120, 150], segundos: [40, 80] }, // Ré menor (com o Dó do acorde de Dó)
  'campanha_chefe.mid': { escala: [...MENOR_HARMONICA(2), 3], bpm: [140, 165], segundos: [40, 80] }, // Ré menor + o Mi bemol napolitano
  'campanha_virada.mid': { escala: MAIOR(2), bpm: [140, 165], segundos: [40, 80] }, // Ré maior
  'campanha_libertado.mid': { escala: MAIOR(5), bpm: [70, 100], segundos: [15, 40] }, // Fá maior
  'campanha_final.mid': { escala: [...MAIOR(2), 7], bpm: [60, 84], segundos: [40, 80] }, // Ré maior
  'super_kris.mid': { escala: [...MAIOR(7), 3, 6], bpm: [150, 180], segundos: [8, 20] }, // Mi menor (com a sensível Ré#)
  'pvpResultado.mid': { escala: MAIOR(0), bpm: [100, 125], segundos: [12, 30] }, // Dó maior
}

test('acordes e a passagem para o maior', () => {
  assert.deepEqual(acorde('Dm').notas.map((n) => n % 12).sort(), [2, 5, 9].sort())
  assert.equal(acorde('C/E').baixo % 12, 4)
  assert.deepEqual(acorde('A7').notas.map((n) => n % 12).sort((a, b) => a - b), [1, 4, 7, 9])
  assert.equal(paraMaior(65), 66) // Fá -> Fá#
  assert.equal(paraMaior(70), 71) // Si bemol -> Si
  assert.equal(paraMaior(62), 62) // Ré fica
})

for (const [nome, compor] of Object.entries(TRILHAS)) {
  test(`${nome}: válido, em loop exato, no andamento e na tonalidade certos`, () => {
    const bytes = compor()
    const m = lerMidi(bytes)
    const e = ESPERADO[nome]
    assert.ok(e, `sem expectativa para ${nome}`)
    assert.equal(m.formato, 1)
    assert.equal(m.ppq, PPQ)
    const fim = m.trilhas[0].fim
    for (const t of m.trilhas) assert.equal(t.fim, fim, 'toda trilha termina no ponto de loop')
    const tempo = m.trilhas[0].eventos.find((x) => x.meta === 0x51)
    const mspq = (tempo.dados[0] << 16) | (tempo.dados[1] << 8) | tempo.dados[2]
    const bpm = 60e6 / mspq
    assert.ok(bpm >= e.bpm[0] && bpm <= e.bpm[1], `${bpm} bpm`)
    const s = (fim / PPQ) * (mspq / 1e6)
    assert.ok(s >= e.segundos[0] && s <= e.segundos[1], `${s} s`)
    // todas as notas (menos a bateria, canal 10) dentro da escala: nada de nota errada
    let total = 0
    let fora = 0
    for (const t of m.trilhas)
      for (const n of t.eventos.filter((x) => x.tipo === 'on' && x.canal !== 9)) {
        total++
        if (!e.escala.includes(n.d1 % 12)) fora++
        assert.ok(n.d2 >= 1 && n.d2 <= 127)
      }
    assert.ok(total > 50, `${total} notas`)
    assert.ok(fora / total <= 0.03, `${fora}/${total} notas fora da escala`)
    assert.deepEqual(new Uint8Array(fs.readFileSync(new URL(nome, pasta))), bytes)
  })
}

test('as músicas da campanha têm bateria só nas lutas; a do amigo libertado e a do fim, não', () => {
  const temBateria = (nome) => lerMidi(TRILHAS[nome]()).trilhas.some((t) => t.eventos.some((x) => x.tipo === 'on' && x.canal === 9))
  for (const n of ['campanha_luta.mid', 'campanha_chefe.mid', 'campanha_virada.mid']) assert.ok(temBateria(n), n)
  for (const n of ['campanha_libertado.mid', 'campanha_final.mid']) assert.ok(!temBateria(n), n)
})
