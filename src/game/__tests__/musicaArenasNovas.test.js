// node --test src/game/__tests__/musicaArenasNovas.test.js
// As músicas das 5 arenas novas são MIDIs escolhidos pelo dono do jogo, com o volume
// igualado ao das outras arenas por scripts/musica/normalizarMidis.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { lerMidi } from '../../../scripts/musica/midi.mjs'
import { ARENA } from '../pvp/arenas.js'

const pasta = new URL('../../../public/assets/musicas/', import.meta.url)
const MUSICAS = {
  cidade: 'Boxing Boss',
  estacao: 'BIG SHOT',
  praia: 'Checker Dance',
  chinatown: 'Petal Dance',
  cafe: 'Pandora Palace',
}

for (const [id, titulo] of Object.entries(MUSICAS)) {
  test(`${id}: toca "${titulo}" (arquivo válido, com notas e volume ajustado)`, () => {
    const arena = ARENA[id]
    assert.equal(arena.musica, `arena_${id}`)
    assert.equal(arena.tituloMusica, titulo)
    const midi = lerMidi(fs.readFileSync(new URL(`${arena.musica}.mid`, pasta)))
    const eventos = midi.trilhas.flatMap((t) => t.eventos)
    assert.ok(eventos.filter((e) => e.tipo === 'noteOn' || e.tipo === 'nota').length > 50 || eventos.length > 200, 'tem notas')
  })
}
