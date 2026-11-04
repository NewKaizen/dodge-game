// node --test src/game/__tests__/musicaTutorial.test.js
// A música do Manual do Ralsei (scripts/musica/tutorial.mjs) e o escritor de MIDI (scripts/musica/midi.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { vlq, novaTrilha, arquivoMidi, lerMidi } from '../../../scripts/musica/midi.mjs'
import { comporTutorial, MELODIA, HARMONIA, ARQUIVOS, FIM, PPQ, COMPASSOS, GM } from '../../../scripts/musica/tutorial.mjs'

const pasta = new URL('../../../public/assets/musicas/', import.meta.url)

test('VLQ do MIDI (exemplos da especificação)', () => {
  assert.deepEqual(vlq(0), [0x00])
  assert.deepEqual(vlq(0x7f), [0x7f])
  assert.deepEqual(vlq(0x80), [0x81, 0x00])
  assert.deepEqual(vlq(0x2000), [0xc0, 0x00])
  assert.deepEqual(vlq(0x3fff), [0xff, 0x7f])
  assert.deepEqual(vlq(0x0fffffff), [0xff, 0xff, 0xff, 0x7f])
  assert.throws(() => vlq(-1))
})

test('escritor: cabeçalho MThd, chunks MTrk com o tamanho certo, fim de trilha no tick pedido', () => {
  const t = novaTrilha('teste')
  t.programa(0, 8)
  t.nota(0, 0, 240, 60, 90)
  t.nota(0, 240, 240, 60, 90) // repetida colada: o note off vem antes do note on
  const bytes = arquivoMidi({ ppq: 96, trilhas: [t], fim: 960 })
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'MThd')
  const m = lerMidi(bytes)
  assert.equal(m.formato, 1)
  assert.equal(m.ppq, 96)
  assert.equal(m.trilhas.length, 1)
  assert.equal(m.trilhas[0].fim, 960)
  const ev = m.trilhas[0].eventos.filter((e) => e.tipo === 'on' || e.tipo === 'off')
  assert.deepEqual(ev.map((e) => [e.tick, e.tipo]), [[0, 'on'], [240, 'off'], [240, 'on'], [480, 'off']])
  assert.throws(() => arquivoMidi({ trilhas: [t], fim: 100 }), /passa do fim/)
  assert.throws(() => t.nota(0, 0, 10, 128, 90), /altura/)
})

test('a melodia e a harmonia: 32 compassos de 3 tempos', () => {
  assert.equal(MELODIA.length, COMPASSOS)
  assert.equal(HARMONIA.length, COMPASSOS)
  MELODIA.forEach((c, i) => assert.equal(c.reduce((s, [, t]) => s + t, 0), 3, `compasso ${i + 1}`))
  assert.equal(FIM, COMPASSOS * 3 * PPQ)
})

for (const [nome, variacao] of Object.entries(ARQUIVOS)) {
  test(`${nome}: válido, em loop exato de 45 a 75 s, notas na região de cada instrumento`, () => {
    const bytes = comporTutorial(variacao)
    const m = lerMidi(bytes)
    assert.equal(m.formato, 1)
    assert.equal(m.ppq, PPQ)
    // toda trilha termina exatamente no ponto de loop (nada sobra depois)
    for (const t of m.trilhas) assert.equal(t.fim, FIM)
    const tempo = m.trilhas[0].eventos.find((e) => e.meta === 0x51)
    const mspq = (tempo.dados[0] << 16) | (tempo.dados[1] << 8) | tempo.dados[2]
    const segundos = (FIM / PPQ) * (mspq / 1e6)
    assert.ok(segundos >= 45 && segundos <= 75, `${segundos} s`)
    // instrumentos: 3 (ou 4 na variação) entre caixinha/celesta, pizzicato, piano e glockenspiel
    const programas = m.trilhas.flatMap((t) => t.eventos.filter((e) => e.tipo === 'programa').map((e) => e.valor))
    assert.deepEqual(programas, variacao === 1 ? [GM.celesta, GM.pizzicato, GM.piano] : [GM.caixinha, GM.pizzicato, GM.piano, GM.glockenspiel])
    const faixa = { 0: [60, 96], 1: [36, 76], 2: [48, 80], 3: [72, 100] }
    for (const t of m.trilhas) {
      const abertas = new Map()
      for (const e of t.eventos) {
        if (e.tipo !== 'on' && e.tipo !== 'off') continue
        const [min, max] = faixa[e.canal]
        assert.ok(e.d1 >= min && e.d1 <= max, `canal ${e.canal}: nota ${e.d1}`)
        const k = `${e.canal}:${e.d1}`
        if (e.tipo === 'on') {
          assert.ok(e.d2 > 0 && e.d2 <= 100, 'velocidade suave')
          abertas.set(k, (abertas.get(k) ?? 0) + 1)
        } else abertas.set(k, (abertas.get(k) ?? 0) - 1)
        assert.ok((abertas.get(k) ?? 0) >= 0, 'note off sem note on')
        assert.ok(e.tick <= FIM)
      }
      assert.ok([...abertas.values()].every((n) => n === 0), 'toda nota fecha antes do loop')
    }
    // o primeiro compasso começa tocando (sem silêncio no ponto de loop)
    const primeiras = m.trilhas.flatMap((t) => t.eventos.filter((e) => e.tipo === 'on' && e.tick === 0))
    assert.ok(primeiras.length >= 2)
  })

  test(`${nome}: o arquivo em public/ é o que o gerador produz (rode node scripts/musica/tutorial.mjs)`, () => {
    const noDisco = new Uint8Array(fs.readFileSync(new URL(nome, pasta)))
    assert.deepEqual(noDisco, comporTutorial(variacao))
  })
}

test('as duas versões têm o mesmo tema (a da página 2 só ganha energia)', () => {
  const notas = (v) => lerMidi(comporTutorial(v)).trilhas[1].eventos.filter((e) => e.tipo === 'on').map((e) => [e.tick, e.d1])
  assert.deepEqual(notas(2), notas(1))
  const n = (v) => lerMidi(comporTutorial(v)).trilhas.flatMap((t) => t.eventos).filter((e) => e.tipo === 'on').length
  assert.ok(n(2) > n(1) * 1.3)
})
