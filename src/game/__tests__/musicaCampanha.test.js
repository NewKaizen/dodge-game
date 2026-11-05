// node --test src/game/__tests__/musicaCampanha.test.js
// A música da campanha (scripts/musica/campanha.mjs): melancólica, esparsa, com o eco de cada frase.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { lerMidi } from '../../../scripts/musica/midi.mjs'
import { comporCampanha, MELODIA, HARMONIA, ARQUIVOS, FIM, PPQ, COMPASSOS, GM, ATRASO_ECO } from '../../../scripts/musica/campanha.mjs'

const pasta = new URL('../../../public/assets/musicas/', import.meta.url)
const notas = (t) => t.eventos.filter((e) => e.tipo === 'on')

test('a melodia e a harmonia: 16 compassos de 4 tempos, com muito silêncio', () => {
  assert.equal(MELODIA.length, COMPASSOS)
  assert.equal(HARMONIA.length, COMPASSOS)
  MELODIA.forEach((c, i) => assert.equal(c.reduce((s, [, t]) => s + t, 0), 4, `compasso ${i + 1}`))
  assert.equal(FIM, COMPASSOS * 4 * PPQ)
  // pelo menos um quarto do tempo da melodia é pausa (esparsa de propósito)
  const pausa = MELODIA.flat().filter(([a]) => a === null).reduce((s, [, t]) => s + t, 0)
  assert.ok(pausa >= COMPASSOS, `${pausa} tempos de pausa`)
  // Ré menor: começa e termina perto da tônica (Ré menor e o Lá dominante)
  assert.equal(HARMONIA[0], 'Dm')
  assert.match(HARMONIA.at(-1), /^A/)
})

for (const [nome, variacao] of Object.entries(ARQUIVOS)) {
  test(`${nome}: válido, lento, em loop exato de 45 a 75 s, eco uma oitava acima e mais baixo`, () => {
    const bytes = comporCampanha(variacao)
    const m = lerMidi(bytes)
    assert.equal(m.formato, 1)
    assert.equal(m.ppq, PPQ)
    for (const t of m.trilhas) assert.equal(t.fim, FIM)
    const tempo = m.trilhas[0].eventos.find((e) => e.meta === 0x51)
    const mspq = (tempo.dados[0] << 16) | (tempo.dados[1] << 8) | tempo.dados[2]
    const bpm = 60e6 / mspq
    assert.ok(bpm <= 80, `${bpm} bpm`)
    const segundos = (FIM / PPQ) * (mspq / 1e6)
    assert.ok(segundos >= 45 && segundos <= 75, `${segundos} s`)
    const programas = m.trilhas.flatMap((t) => t.eventos.filter((e) => e.tipo === 'programa').map((e) => e.valor))
    assert.deepEqual(programas, variacao === 1 ? [GM.piano, GM.piano, GM.piano, GM.cordas, GM.pad] : [GM.piano, GM.piano, GM.piano, GM.tremolo, GM.pad, GM.timpano])
    // o eco: cada nota da melodia volta ATRASO_ECO depois, uma oitava acima e mais baixa
    const [, piano, eco] = m.trilhas
    const p = notas(piano)
    const e = notas(eco)
    assert.ok(e.length >= p.length - 2 && e.length <= p.length)
    for (const n of e) {
      const original = p.find((x) => x.tick === n.tick - ATRASO_ECO && x.d1 === n.d1 - 12)
      assert.ok(original, `eco sem original em ${n.tick}`)
      assert.ok(n.d2 < original.d2 / 1.5)
    }
    // tudo baixinho: nenhuma nota acima de 64 de velocidade (é uma música de silêncio)
    for (const t of m.trilhas) for (const n of notas(t)) assert.ok(n.d2 <= 64)
    // o arquivo no disco é o que o script gera
    assert.deepEqual(new Uint8Array(fs.readFileSync(new URL(nome, pasta))), bytes)
  })
}
