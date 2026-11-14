// node --test src/game/__tests__/musicaArenasPraiaCafe.test.js
// As músicas das arenas PRAIA e CAFÉ FRANCÊS (scripts/musica/arenasPraiaCafe.mjs): arquivo válido,
// loop exato, andamento, compasso e tonalidade que prometem; o arquivo no disco é o que o script gera.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { lerMidi } from '../../../scripts/musica/midi.mjs'
import { PPQ } from '../../../scripts/musica/trilhas.mjs'
import { TRILHAS_ARENAS } from '../../../scripts/musica/arenasPraiaCafe.mjs'
import { ARENA } from '../pvp/arenas.js'

const pasta = new URL('../../../public/assets/musicas/', import.meta.url)
const MAIOR = (t) => [0, 2, 4, 5, 7, 9, 11].map((i) => (t + i) % 12)
const MENOR_HARMONICA = (t) => [0, 2, 3, 5, 7, 8, 11].map((i) => (t + i) % 12)
const ESPERADO = {
  'arena_praia.mid': { escala: MAIOR(0), bpm: [100, 120], compasso: [4, 4], segundos: [40, 100], bateria: true },
  'arena_cafe.mid': { escala: [...MENOR_HARMONICA(9), 7], bpm: [135, 165], compasso: [3, 4], segundos: [25, 70], bateria: true },
}

for (const [nome, compor] of Object.entries(TRILHAS_ARENAS)) {
  test(`${nome}: válido, em loop exato, no andamento, compasso e tonalidade certos`, () => {
    const bytes = compor()
    const m = lerMidi(bytes)
    const e = ESPERADO[nome]
    assert.equal(m.formato, 1)
    assert.equal(m.ppq, PPQ)
    const fim = m.trilhas[0].fim
    for (const t of m.trilhas) assert.equal(t.fim, fim, 'toda trilha termina no ponto de loop')
    const tempo = m.trilhas[0].eventos.find((x) => x.meta === 0x51)
    const mspq = (tempo.dados[0] << 16) | (tempo.dados[1] << 8) | tempo.dados[2]
    const bpm = 60e6 / mspq
    assert.ok(bpm >= e.bpm[0] && bpm <= e.bpm[1], `${bpm} bpm`)
    const compasso = m.trilhas[0].eventos.find((x) => x.meta === 0x58)
    assert.deepEqual([compasso.dados[0], 2 ** compasso.dados[1]], e.compasso)
    // o loop fecha num número inteiro de compassos
    const tamanho = (PPQ * 4 * e.compasso[0]) / e.compasso[1]
    assert.equal(fim % tamanho, 0)
    const s = (fim / PPQ) * (mspq / 1e6)
    assert.ok(s >= e.segundos[0] && s <= e.segundos[1], `${s} s`)
    let total = 0
    let fora = 0
    for (const t of m.trilhas)
      for (const n of t.eventos.filter((x) => x.tipo === 'on' && x.canal !== 9)) {
        total++
        if (!e.escala.includes(n.d1 % 12)) fora++
        assert.ok(n.d2 >= 1 && n.d2 <= 127)
      }
    assert.ok(total > 200, `${total} notas`)
    assert.ok(fora / total <= 0.02, `${fora}/${total} notas fora da escala`)
    assert.equal(m.trilhas.some((t) => t.eventos.some((x) => x.tipo === 'on' && x.canal === 9)), e.bateria)
    assert.deepEqual(new Uint8Array(fs.readFileSync(new URL(nome, pasta))), bytes)
  })
}

test('as arenas apontam para as músicas novas (e têm título original)', () => {
  for (const id of ['praia', 'cafe']) {
    assert.ok(`arena_${id}.mid` in TRILHAS_ARENAS)
    assert.equal(ARENA[id].musica, `arena_${id}`)
    assert.ok(ARENA[id].tituloMusica)
  }
})
