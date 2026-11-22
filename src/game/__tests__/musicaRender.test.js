// node --test src/game/__tests__/musicaRender.test.js
// As músicas pré-renderizadas (scripts/musica/renderizar.mjs): o manifesto cobre todo .mid de
// assets-fonte/musicas/, os arquivos existem, e os loops têm as margens que o musica.js usa.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { ARENA } from '../pvp/arenas.js'
import { CHEFES } from '../coop/chefes/index.js'

const fonte = new URL('../../../assets-fonte/musicas/', import.meta.url)
const render = new URL('../../../public/assets/musicas/render/', import.meta.url)
const manifesto = JSON.parse(fs.readFileSync(new URL('musicas.json', render), 'utf8'))
const midis = fs
  .readdirSync(fonte)
  .filter((f) => f.endsWith('.mid'))
  .map((f) => f.slice(0, -4))
  .sort()

test('o manifesto tem exatamente uma faixa por .mid', () => {
  assert.ok(midis.length > 30)
  assert.deepEqual(Object.keys(manifesto.faixas).sort(), midis)
  assert.equal(manifesto.taxa, 48000)
})

test('cada faixa: os dois formatos existem, com o hash no nome, e nada sobra na pasta', () => {
  const usados = new Set(['musicas.json'])
  for (const [nome, f] of Object.entries(manifesto.faixas)) {
    assert.deepEqual(Object.keys(f.formatos).sort(), ['m4a', 'webm'], nome)
    for (const [formato, arquivo] of Object.entries(f.formatos)) {
      assert.match(arquivo, new RegExp(`^${nome}\\.[0-9a-f]{12}\\.${formato}$`))
      const tamanho = fs.statSync(new URL(arquivo, render)).size
      // ~64 kbit/s (Opus) e ~96 kbit/s (AAC), com folga para trechos quietos
      const kbps = (tamanho * 8) / f.duracao / 1000
      assert.ok(kbps > 8 && kbps < (formato === 'webm' ? 90 : 130), `${arquivo}: ${kbps.toFixed(0)} kbit/s`)
      usados.add(arquivo)
    }
    assert.match(f.hash, /^[0-9a-f]{12}$/)
  }
  assert.deepEqual(fs.readdirSync(render).filter((a) => !usados.has(a)), [])
})

test('os loops: margem de 1,5 s antes do loopStart e 2,5 s depois do loopEnd, do tamanho do .mid', () => {
  for (const [nome, f] of Object.entries(manifesto.faixas)) {
    assert.ok(Math.abs(f.loopStart - 1.5) < 0.01, `${nome} loopStart ${f.loopStart}`)
    assert.ok(Math.abs(f.duracao - f.loopEnd - 2.5) < 0.01, `${nome} duração ${f.duracao}`)
    assert.ok(f.loopEnd - f.loopStart > 5, nome)
    // o período é múltiplo de uma amostra (o AudioBuffer faz o loop na amostra)
    assert.ok(Math.abs((f.loopEnd - f.loopStart) * 48000 - Math.round((f.loopEnd - f.loopStart) * 48000)) < 0.1, nome)
    // pico abaixo de 0 dBFS (o king.mid estourava)
    assert.ok(f.picoDb <= -1.9, `${nome} pico ${f.picoDb}`)
    // o nível de antes: nenhum ganho; só o limitador mexe, sempre para baixo e pouco (o máximo é o
    // super_dess, que estourava muito: -1,2 dB)
    assert.equal(f.ganhoDb, 0, `${nome} ganho ${f.ganhoDb}`)
    assert.ok(f.lufsFinal <= f.lufs + 0.05 && f.lufsFinal >= f.lufs - 1.5, `${nome}: ${f.lufs} -> ${f.lufsFinal} LUFS`)
  }
})

test('toda música que o jogo pede existe', () => {
  const pedidas = ['menu', 'selecao', 'lobby', 'pvp', 'pvpEscolha', 'pvpResultado', 'vitoria', 'gameover', 'tutorial', 'tutorial2', 'campanha', 'campanha2']
  for (const a of Object.values(ARENA)) if (a.musica) pedidas.push(a.musica)
  for (const c of Object.values(CHEFES)) if (c.musica) pedidas.push(c.musica)
  for (const p of ['kris', 'susie', 'ralsei', 'noelle', 'berdly', 'dess', 'asriel']) pedidas.push(`super_${p}`)
  for (const n of pedidas) assert.ok(manifesto.faixas[n], `falta ${n}`)
})
