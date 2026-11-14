// node --test src/game/__tests__/musicaArenasNovas.test.js
// As músicas das arenas ESTAÇÃO, CHINATOWN e CIDADE (scripts/musica/arenasNovas.mjs): arquivos válidos, em
// loop exato, no andamento e na escala que prometem, e o arquivo no disco é o que o script gera.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { lerMidi } from '../../../scripts/musica/midi.mjs'
import { PPQ } from '../../../scripts/musica/trilhas.mjs'
import { TRILHAS_ARENAS } from '../../../scripts/musica/arenasNovas.mjs'
import { ARENA } from '../pvp/arenas.js'

const pasta = new URL('../../../public/assets/musicas/', import.meta.url)
const MAIOR = (t) => [0, 2, 4, 5, 7, 9, 11].map((i) => (t + i) % 12)
const MENOR = (t) => [0, 2, 3, 5, 7, 8, 10].map((i) => (t + i) % 12)
const ESPERADO = {
  'arena_estacao.mid': { escala: MENOR(9), bpm: [70, 95], segundos: [30, 70] }, // Lá menor
  'arena_chinatown.mid': { escala: MAIOR(2), bpm: [120, 150], segundos: [20, 50] }, // Ré maior (melodia pentatônica)
  'arena_cidade.mid': { escala: [...MAIOR(0), 1, 3, 10], bpm: [85, 105], segundos: [30, 60] }, // Dó maior + o Dó# do A7 e as notas blues
}

for (const [nome, compor] of Object.entries(TRILHAS_ARENAS)) {
  test(`${nome}: válido, em loop exato, no andamento e na escala certos`, () => {
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
    let total = 0
    let fora = 0
    for (const t of m.trilhas)
      for (const n of t.eventos.filter((x) => x.tipo === 'on' && x.canal !== 9)) {
        total++
        if (!e.escala.includes(n.d1 % 12)) fora++
        assert.ok(n.d2 >= 1 && n.d2 <= 127)
      }
    assert.ok(total > 100, `${total} notas`)
    assert.equal(fora, 0, `${fora}/${total} notas fora da escala`)
    assert.ok(m.trilhas.some((t) => t.eventos.some((x) => x.tipo === 'on' && x.canal === 9)), 'tem bateria')
    assert.deepEqual(new Uint8Array(fs.readFileSync(new URL(nome, pasta))), bytes, 'o arquivo em disco é o que o script gera (rode node scripts/musica/arenasNovas.mjs)')
  })
}

test('cada arena nova aponta para a sua música, que existe, e tem título original', () => {
  for (const [id, arquivo, titulo] of [['estacao', 'arena_estacao', 'Órbita Baixa'], ['chinatown', 'arena_chinatown', 'Rua das Mil Lanternas'], ['cidade', 'arena_cidade', 'Hora do Rush']]) {
    assert.equal(ARENA[id].musica, arquivo)
    assert.equal(ARENA[id].tituloMusica, titulo)
    assert.ok(fs.existsSync(new URL(`${arquivo}.mid`, pasta)), arquivo)
  }
})
